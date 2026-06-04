import { NextResponse } from "next/server";
import {
  cacheAgeWarning,
  createTokenAnalysisCacheKey,
  getOrSetCache,
  type CacheMetadata,
} from "@/lib/cache";

type DataQuality = "partial" | "good" | "unavailable";

type MoralisTransaction = {
  block_timestamp?: string;
};

type MoralisTransactionResponse = {
  result?: MoralisTransaction[];
  total?: number;
};

type MoralisNativeBalanceResponse = {
  balance?: string;
};

type MoralisTokenBalance = {
  token_address?: string;
  balance?: string;
  balance_formatted?: string;
  symbol?: string;
  name?: string;
  decimals?: number;
  percentage_relative_to_total_supply?: number;
};

type MoralisTokenBalancesResponse = {
  result?: MoralisTokenBalance[];
};

type WalletProfile = {
  walletAddress: string;
  shortAddress: string;
  chain: string;
  isContract: boolean | null;
  nativeBalance: {
    raw: string;
    formatted: string;
  } | null;
  transactionCount: number | null;
  firstSeen: string | null;
  lastActive: string | null;
  recentActivityCount: number | null;
  tokenBalance: {
    tokenAddress: string;
    raw: string;
    formatted: string;
    symbol: string | null;
    name: string | null;
  } | null;
  dataQuality: DataQuality;
  behaviorStatus: "pending_v2";
  notes: string[];
};

type WalletProfileResponse = {
  profile: WalletProfile;
  cache?: CacheMetadata;
};

type ApiErrorCode =
  | "MISSING_API_KEY"
  | "MISSING_CHAIN"
  | "MISSING_WALLET_ADDRESS"
  | "INVALID_WALLET_ADDRESS"
  | "INVALID_TOKEN_ADDRESS";

const WALLET_PROFILE_CACHE_TTL_SECONDS = 900;

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

function isEvmAddress(address: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function mapChain(chain: string) {
  const key = chain.toLowerCase();

  if (key === "ethereum" || key === "eth") return "eth";
  if (key === "base") return "base";
  if (key === "bsc" || key === "bnb") return "bsc";
  if (key === "mantle") return "0x1388";
  if (key === "polygon") return "polygon";
  if (key === "arbitrum") return "arbitrum";
  if (key === "optimism") return "optimism";

  return key;
}

function shortAddress(address: string) {
  if (!address || address.length < 10) return address || "Unknown";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatNativeBalance(raw?: string) {
  if (!raw) return null;

  try {
    const wei = BigInt(raw);
    const divisor = BigInt("1000000000000000000");
    const whole = wei / divisor;
    const fraction = wei % divisor;
    const fractionText = fraction.toString().padStart(18, "0").slice(0, 6);
    const trimmedFraction = fractionText.replace(/0+$/, "");

    return trimmedFraction
      ? `${whole.toString()}.${trimmedFraction}`
      : whole.toString();
  } catch {
    return raw;
  }
}

function parseTimestamp(value?: string) {
  if (!value) return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;
  return new Date(time).toISOString();
}

function pickTransactionWindow(transactions: MoralisTransaction[]) {
  const timestamps = transactions
    .map((transaction) => parseTimestamp(transaction.block_timestamp))
    .filter((timestamp): timestamp is string => Boolean(timestamp))
    .sort((a, b) => Date.parse(a) - Date.parse(b));

  return {
    firstSeen: timestamps[0] || null,
    lastActive: timestamps[timestamps.length - 1] || null,
  };
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
    route: "wallet-profile",
    chain: mappedChain,
    tokenAddress: normalizedToken,
    walletAddress: normalizedWallet,
  });

  const cachedResult = await getOrSetCache<WalletProfileResponse>(
    cacheKey,
    WALLET_PROFILE_CACHE_TTL_SECONDS,
    async () => {
      const notes: string[] = [
        "Wallet Behavior Engine V2 is not active on this route.",
        "PnL, win rate, average hold time and smart money labels are not calculated.",
      ];

      let nativeBalance: WalletProfile["nativeBalance"] = null;
      let transactionCount: number | null = null;
      let firstSeen: string | null = null;
      let lastActive: string | null = null;
      let recentActivityCount: number | null = null;
      let tokenBalance: WalletProfile["tokenBalance"] = null;
      let hasNativeBalance = false;
      let hasTransactions = false;
      let hasTokenBalanceRead = false;

      try {
        const nativeUrl = new URL(
          `https://deep-index.moralis.io/api/v2.2/${normalizedWallet}/balance`
        );
        nativeUrl.searchParams.set("chain", mappedChain);

        const nativeData = await fetchMoralisJson<MoralisNativeBalanceResponse>({
          url: nativeUrl,
          apiKey,
        });

        if (nativeData.balance) {
          nativeBalance = {
            raw: nativeData.balance,
            formatted:
              formatNativeBalance(nativeData.balance) || nativeData.balance,
          };
          hasNativeBalance = true;
          notes.push("Native balance is returned directly by Moralis.");
        }
      } catch {
        notes.push("Native balance unavailable from Moralis for this request.");
      }

      try {
        const transactionUrl = new URL(
          `https://deep-index.moralis.io/api/v2.2/${normalizedWallet}`
        );
        transactionUrl.searchParams.set("chain", mappedChain);
        transactionUrl.searchParams.set("limit", "100");

        const transactionData =
          await fetchMoralisJson<MoralisTransactionResponse>({
            url: transactionUrl,
            apiKey,
          });

        const transactions = transactionData.result || [];
        const window = pickTransactionWindow(transactions);

        transactionCount =
          typeof transactionData.total === "number"
            ? transactionData.total
            : transactions.length;
        recentActivityCount = transactions.length;
        firstSeen = window.firstSeen;
        lastActive = window.lastActive;
        hasTransactions = true;
        notes.push(
          "Transaction count and activity timestamps are inferred from Moralis native wallet transactions."
        );
        notes.push(
          "firstSeen is the oldest transaction in the returned page, not guaranteed lifetime wallet creation."
        );
      } catch {
        notes.push("Native wallet transaction history unavailable from Moralis.");
      }

      if (normalizedToken) {
        try {
          const tokenUrl = new URL(
            `https://deep-index.moralis.io/api/v2.2/wallets/${normalizedWallet}/tokens`
          );
          tokenUrl.searchParams.set("chain", mappedChain);
          tokenUrl.searchParams.set("exclude_spam", "true");

          const tokenData = await fetchMoralisJson<MoralisTokenBalancesResponse>({
            url: tokenUrl,
            apiKey,
          });

          const matchingToken = (tokenData.result || []).find(
            (token) => token.token_address?.toLowerCase() === normalizedToken
          );

          if (matchingToken) {
            tokenBalance = {
              tokenAddress: normalizedToken,
              raw: matchingToken.balance || "0",
              formatted:
                matchingToken.balance_formatted || matchingToken.balance || "0",
              symbol: matchingToken.symbol || null,
              name: matchingToken.name || null,
            };
            notes.push(
              "Token balance is returned from Moralis wallet token balances."
            );
          } else {
            tokenBalance = {
              tokenAddress: normalizedToken,
              raw: "0",
              formatted: "0",
              symbol: null,
              name: null,
            };
            notes.push(
              "Token address was provided, but Moralis returned no matching token balance for this wallet."
            );
          }

          hasTokenBalanceRead = true;
        } catch {
          notes.push("Token balance unavailable from Moralis for this request.");
        }
      } else {
        notes.push("Token balance skipped because tokenAddress was not provided.");
      }

      notes.push(
        "Token ownership percentage is unavailable here; use the holder distribution pipeline when ownership context is required."
      );
      notes.push("isContract is not returned by the Moralis endpoints used here.");

      const dataQuality: DataQuality =
        hasNativeBalance && hasTransactions
          ? "good"
          : hasNativeBalance || hasTransactions || hasTokenBalanceRead
          ? "partial"
          : "unavailable";

      return {
        profile: {
          walletAddress: normalizedWallet,
          shortAddress: shortAddress(normalizedWallet),
          chain: mappedChain,
          isContract: null,
          nativeBalance,
          transactionCount,
          firstSeen,
          lastActive,
          recentActivityCount,
          tokenBalance,
          dataQuality,
          behaviorStatus: "pending_v2",
          notes,
        },
      };
    },
    { provider: "moralis", route: "wallet-profile" }
  );

  return NextResponse.json({
    ...cachedResult.value,
    profile: {
      ...cachedResult.value.profile,
      notes: [
        ...cachedResult.value.profile.notes,
        cacheAgeWarning(WALLET_PROFILE_CACHE_TTL_SECONDS),
      ],
    },
    cache: cachedResult.cache,
  });
}
