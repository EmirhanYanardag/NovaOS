import { NextResponse } from "next/server";
import {
  cacheAgeWarning,
  createTokenAnalysisCacheKey,
  getOrSetCache,
  type CacheMetadata,
} from "@/lib/cache";
import {
  analyzeWalletMemory,
  isEvmAddress,
  mapChain,
  normalizeWalletMemoryTransfer,
  rememberWalletSnapshot,
  type RawWalletMemoryTransfer,
} from "@/lib/wallet-memory";
import {
  buildWalletPersonality,
  type WalletPersonalityResult,
} from "@/lib/wallet-personality";

type MoralisHolder = {
  owner_address?: string;
  ownerAddress?: string;
  address?: string;
};

type MoralisHoldersResponse = {
  result?: MoralisHolder[];
};

type MoralisTokenTransferResponse = {
  result?: RawWalletMemoryTransfer[];
};

type MoralisTransaction = {
  block_timestamp?: string;
};

type MoralisTransactionResponse = {
  result?: MoralisTransaction[];
};

type BatchPersonality = Pick<
  WalletPersonalityResult,
  | "walletAddress"
  | "shortAddress"
  | "personalityType"
  | "personalitySubtitle"
  | "confidenceLabel"
  | "personalityScores"
  | "traits"
  | "riskNotes"
>;

type WalletPersonalitiesResponse = {
  tokenAddress: string;
  chain: string;
  limit: number;
  personalities: BatchPersonality[];
  warnings: string[];
  cache?: CacheMetadata;
};

type ApiErrorCode =
  | "MISSING_API_KEY"
  | "MISSING_CHAIN"
  | "MISSING_TOKEN_ADDRESS"
  | "INVALID_TOKEN_ADDRESS"
  | "INVALID_LIMIT"
  | "WALLET_PERSONALITIES_FAILED";

const WALLET_PERSONALITIES_CACHE_TTL_SECONDS = 900;

function structuredError({
  code,
  message,
  details,
  status,
}: {
  code: ApiErrorCode;
  message: string;
  details?: unknown;
  status: number;
}) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        details: details ?? null,
      },
    },
    { status }
  );
}

async function fetchMoralisJson<T>({
  url,
  apiKey,
}: {
  url: URL;
  apiKey: string;
}) {
  const response = await fetch(url.toString(), {
    headers: {
      accept: "application/json",
      "X-API-Key": apiKey,
    },
    cache: "no-store",
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || "Moralis request failed.");
  }

  return data as T;
}

function getHolderAddress(holder: MoralisHolder) {
  return holder.owner_address || holder.ownerAddress || holder.address || "";
}

function parseTimestamp(value?: string) {
  if (!value) return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;
  return new Date(time).toISOString();
}

function daysSince(value: string | null) {
  if (!value) return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;
  return Math.max(0, (Date.now() - time) / 86_400_000);
}

function inferWalletAgeDays(transactions: MoralisTransaction[]) {
  const timestamps = transactions
    .map((transaction) => parseTimestamp(transaction.block_timestamp))
    .filter((timestamp): timestamp is string => Boolean(timestamp))
    .sort((a, b) => Date.parse(a) - Date.parse(b));
  const age = daysSince(timestamps[0] || null);

  return age === null ? null : Math.round(age);
}

async function fetchWalletAgeDays({
  apiKey,
  chain,
  walletAddress,
}: {
  apiKey: string;
  chain: string;
  walletAddress: string;
}) {
  try {
    const url = new URL(`https://deep-index.moralis.io/api/v2.2/${walletAddress}`);
    url.searchParams.set("chain", chain);
    url.searchParams.set("limit", "100");

    const data = await fetchMoralisJson<MoralisTransactionResponse>({
      url,
      apiKey,
    });

    return inferWalletAgeDays(data.result || []);
  } catch {
    return null;
  }
}

async function fetchTopHolders({
  apiKey,
  chain,
  tokenAddress,
  limit,
}: {
  apiKey: string;
  chain: string;
  tokenAddress: string;
  limit: number;
}) {
  const url = new URL(
    `https://deep-index.moralis.io/api/v2.2/erc20/${tokenAddress}/owners`
  );
  url.searchParams.set("chain", chain);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("order", "DESC");

  const data = await fetchMoralisJson<MoralisHoldersResponse>({ url, apiKey });

  return data.result || [];
}

async function buildPersonalityForWallet({
  apiKey,
  chain,
  tokenAddress,
  walletAddress,
}: {
  apiKey: string;
  chain: string;
  tokenAddress: string;
  walletAddress: string;
}) {
  const transferUrl = new URL(
    `https://deep-index.moralis.io/api/v2.2/${walletAddress}/erc20/transfers`
  );
  transferUrl.searchParams.set("chain", chain);
  transferUrl.searchParams.set("limit", "100");
  transferUrl.searchParams.set("order", "DESC");

  const transferData = await fetchMoralisJson<MoralisTokenTransferResponse>({
    url: transferUrl,
    apiKey,
  });
  const transfers = (transferData.result || []).map((transfer) =>
    normalizeWalletMemoryTransfer({ transfer, walletAddress })
  );
  const memory = analyzeWalletMemory({
    chain,
    walletAddress,
    transfers,
  });
  const walletAgeDays = await fetchWalletAgeDays({
    apiKey,
    chain,
    walletAddress,
  });

  rememberWalletSnapshot(memory);

  const personality = buildWalletPersonality({
    isContract: false,
    memory,
    tokenAddress,
    walletAddress,
    walletAgeDays,
  });

  return {
    walletAddress: personality.walletAddress,
    shortAddress: personality.shortAddress,
    personalityType: personality.personalityType,
    personalitySubtitle: personality.personalitySubtitle,
    confidenceLabel: personality.confidenceLabel,
    personalityScores: personality.personalityScores,
    traits: personality.traits,
    riskNotes: personality.riskNotes,
  };
}

export async function GET(request: Request) {
  const apiKey = process.env.MORALIS_API_KEY;

  if (!apiKey) {
    return structuredError({
      code: "MISSING_API_KEY",
      message: "Missing MORALIS_API_KEY in .env file.",
      status: 500,
    });
  }

  const { searchParams } = new URL(request.url);
  const chain = searchParams.get("chain");
  const tokenAddress = searchParams.get("tokenAddress");
  const requestedLimit = Number(searchParams.get("limit") || 5);

  if (!chain) {
    return structuredError({
      code: "MISSING_CHAIN",
      message: "Missing chain parameter.",
      status: 400,
    });
  }

  if (!tokenAddress) {
    return structuredError({
      code: "MISSING_TOKEN_ADDRESS",
      message: "Missing tokenAddress parameter.",
      status: 400,
    });
  }

  if (!isEvmAddress(tokenAddress)) {
    return structuredError({
      code: "INVALID_TOKEN_ADDRESS",
      message: "tokenAddress must be a valid EVM contract address.",
      details: { tokenAddress },
      status: 400,
    });
  }

  if (searchParams.get("limit") && !Number.isFinite(requestedLimit)) {
    return structuredError({
      code: "INVALID_LIMIT",
      message: "limit must be a number between 1 and 10.",
      details: { limit: searchParams.get("limit") },
      status: 400,
    });
  }

  const mappedChain = mapChain(chain);
  const limit = Math.min(10, Math.max(1, requestedLimit));
  const normalizedTokenAddress = tokenAddress.toLowerCase();
  const cacheKey = createTokenAnalysisCacheKey({
    route: "wallet-personalities",
    chain: mappedChain,
    tokenAddress: normalizedTokenAddress,
    personalityLimit: limit,
    extra: { limit },
  });

  try {
    const cachedResult = await getOrSetCache<WalletPersonalitiesResponse>(
      cacheKey,
      WALLET_PERSONALITIES_CACHE_TTL_SECONDS,
      async () => {
        const holders = await fetchTopHolders({
          apiKey,
          chain: mappedChain,
          tokenAddress: normalizedTokenAddress,
          limit,
        });
        const personalities = await Promise.all(
          holders
            .map((holder) => getHolderAddress(holder))
            .filter((walletAddress) => isEvmAddress(walletAddress))
            .slice(0, limit)
            .map((walletAddress) =>
              buildPersonalityForWallet({
                apiKey,
                chain: mappedChain,
                tokenAddress: normalizedTokenAddress,
                walletAddress,
              })
            )
        );

        return {
          tokenAddress: normalizedTokenAddress,
          chain: mappedChain,
          limit,
          personalities,
          warnings: [
            "Batch personality fetch is limited to top holders only to reduce provider load.",
            "Personality labels are behavior inference, not profitability or identity claims.",
            "No PnL, win rate, smart money identity or insider identity is calculated.",
          ],
        };
      },
      { provider: "moralis", route: "wallet-personalities" }
    );

    return NextResponse.json({
      ...cachedResult.value,
      warnings: [
        ...cachedResult.value.warnings,
        cacheAgeWarning(WALLET_PERSONALITIES_CACHE_TTL_SECONDS),
      ],
      cache: cachedResult.cache,
    });
  } catch (error) {
    return structuredError({
      code: "WALLET_PERSONALITIES_FAILED",
      message:
        error instanceof Error
          ? error.message
          : "Wallet personalities request failed.",
      status: 500,
    });
  }
}
