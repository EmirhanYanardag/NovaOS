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

type MoralisTokenTransferResponse = {
  result?: RawWalletMemoryTransfer[];
};

type MoralisTransaction = {
  block_timestamp?: string;
};

type MoralisTransactionResponse = {
  result?: MoralisTransaction[];
  total?: number;
};

type WalletPersonalityResponse = WalletPersonalityResult & {
  cache?: CacheMetadata;
};

type ApiErrorCode =
  | "MISSING_API_KEY"
  | "MISSING_CHAIN"
  | "MISSING_WALLET_ADDRESS"
  | "INVALID_WALLET_ADDRESS"
  | "INVALID_TOKEN_ADDRESS"
  | "MORALIS_REQUEST_FAILED"
  | "UNEXPECTED_ERROR";

const WALLET_PERSONALITY_CACHE_TTL_SECONDS = 900;

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
  const firstSeen = timestamps[0] || null;
  const age = daysSince(firstSeen);

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
  const walletAddress = searchParams.get("walletAddress");
  const tokenAddress = searchParams.get("tokenAddress");

  if (!chain) {
    return structuredError({
      code: "MISSING_CHAIN",
      message: "Missing chain parameter.",
      status: 400,
    });
  }

  if (!walletAddress) {
    return structuredError({
      code: "MISSING_WALLET_ADDRESS",
      message: "Missing walletAddress parameter.",
      status: 400,
    });
  }

  if (!isEvmAddress(walletAddress)) {
    return structuredError({
      code: "INVALID_WALLET_ADDRESS",
      message: "walletAddress must be a valid EVM wallet address.",
      details: { walletAddress },
      status: 400,
    });
  }

  if (tokenAddress && !isEvmAddress(tokenAddress)) {
    return structuredError({
      code: "INVALID_TOKEN_ADDRESS",
      message: "tokenAddress must be a valid EVM contract address.",
      details: { tokenAddress },
      status: 400,
    });
  }

  const mappedChain = mapChain(chain);
  const normalizedWallet = walletAddress.toLowerCase();
  const normalizedToken = tokenAddress?.toLowerCase() || null;
  const cacheKey = createTokenAnalysisCacheKey({
    route: "wallet-personality",
    chain: mappedChain,
    tokenAddress: normalizedToken,
    walletAddress: normalizedWallet,
  });

  try {
    const cachedResult = await getOrSetCache<WalletPersonalityResponse>(
      cacheKey,
      WALLET_PERSONALITY_CACHE_TTL_SECONDS,
      async () => {
        const transferUrl = new URL(
          `https://deep-index.moralis.io/api/v2.2/${normalizedWallet}/erc20/transfers`
        );
        transferUrl.searchParams.set("chain", mappedChain);
        transferUrl.searchParams.set("limit", "100");
        transferUrl.searchParams.set("order", "DESC");

        const transferData =
          await fetchMoralisJson<MoralisTokenTransferResponse>({
            url: transferUrl,
            apiKey,
          });
        const transfers = (transferData.result || []).map((transfer) =>
          normalizeWalletMemoryTransfer({
            transfer,
            walletAddress: normalizedWallet,
          })
        );
        const memory = analyzeWalletMemory({
          chain: mappedChain,
          walletAddress: normalizedWallet,
          transfers,
        });
        const walletAgeDays = await fetchWalletAgeDays({
          apiKey,
          chain: mappedChain,
          walletAddress: normalizedWallet,
        });

        rememberWalletSnapshot(memory);

        return buildWalletPersonality({
          isContract: false,
          memory,
          tokenAddress: normalizedToken,
          walletAddress: normalizedWallet,
          walletAgeDays,
        });
      },
      { provider: "moralis", route: "wallet-personality" }
    );

    return NextResponse.json({
      ...cachedResult.value,
      riskNotes: [
        ...cachedResult.value.riskNotes,
        cacheAgeWarning(WALLET_PERSONALITY_CACHE_TTL_SECONDS),
      ],
      cache: cachedResult.cache,
    });
  } catch (error) {
    return structuredError({
      code:
        error instanceof Error && error.message.includes("Moralis")
          ? "MORALIS_REQUEST_FAILED"
          : "UNEXPECTED_ERROR",
      message:
        error instanceof Error
          ? error.message
          : "Wallet personality request failed.",
      status: 500,
    });
  }
}
