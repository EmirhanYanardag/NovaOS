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
  type WalletMemoryResult,
} from "@/lib/wallet-memory";

type MoralisTokenTransferResponse = {
  result?: RawWalletMemoryTransfer[];
};

type WalletMemoryResponse = {
  walletAddress: string;
  chain: string;
  walletFingerprint: string;
  consistencyScore: number;
  convictionBehaviorScore: number;
  rotationScore: number;
  narrativeExposure: WalletMemoryResult["narrativeExposure"];
  repeatedTokenCount: number;
  repeatedWalletSeen: boolean;
  recurringClusterAppearance: WalletMemoryResult["recurringClusterAppearance"];
  repeatedBehaviorFlags: string[];
  memorySummary: string;
  confidenceLabel: WalletMemoryResult["confidenceLabel"];
  warnings: string[];
  cache?: CacheMetadata;
};

type ApiErrorCode =
  | "MISSING_API_KEY"
  | "MISSING_CHAIN"
  | "MISSING_WALLET_ADDRESS"
  | "INVALID_WALLET_ADDRESS"
  | "MORALIS_REQUEST_FAILED"
  | "UNEXPECTED_ERROR";

const WALLET_MEMORY_CACHE_TTL_SECONDS = 900;

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

  const mappedChain = mapChain(chain);
  const normalizedWallet = walletAddress.toLowerCase();
  const cacheKey = createTokenAnalysisCacheKey({
    route: "wallet-memory",
    chain: mappedChain,
    walletAddress: normalizedWallet,
  });

  try {
    const cachedResult = await getOrSetCache<WalletMemoryResponse>(
      cacheKey,
      WALLET_MEMORY_CACHE_TTL_SECONDS,
      async () => {
        const url = new URL(
          `https://deep-index.moralis.io/api/v2.2/${normalizedWallet}/erc20/transfers`
        );

        url.searchParams.set("chain", mappedChain);
        url.searchParams.set("limit", "100");
        url.searchParams.set("order", "DESC");

        const data = await fetchMoralisJson<MoralisTokenTransferResponse>({
          url,
          apiKey,
        });
        const transfers = (data.result || []).map((transfer) =>
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

        rememberWalletSnapshot(memory);

        return {
          walletAddress: normalizedWallet,
          chain: mappedChain,
          walletFingerprint: memory.walletFingerprint,
          consistencyScore: memory.consistencyScore,
          convictionBehaviorScore: memory.convictionBehaviorScore,
          rotationScore: memory.rotationScore,
          narrativeExposure: memory.narrativeExposure,
          repeatedTokenCount: memory.repeatedTokenCount,
          repeatedWalletSeen: memory.repeatedWalletSeen,
          recurringClusterAppearance: memory.recurringClusterAppearance,
          repeatedBehaviorFlags: memory.repeatedBehaviorFlags,
          memorySummary: memory.memorySummary,
          confidenceLabel: memory.confidenceLabel,
          warnings: memory.warnings,
        };
      },
      { provider: "moralis", route: "wallet-memory" }
    );

    return NextResponse.json({
      ...cachedResult.value,
      warnings: [
        ...cachedResult.value.warnings,
        cacheAgeWarning(WALLET_MEMORY_CACHE_TTL_SECONDS),
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
        error instanceof Error ? error.message : "Wallet memory request failed.",
      status: 500,
    });
  }
}
