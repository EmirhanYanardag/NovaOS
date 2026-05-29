import { NextResponse } from "next/server";
import {
  cacheAgeWarning,
  createCacheKey,
  getOrSetCache,
  type CacheMetadata,
} from "../../../lib/cache";

type HolderColor = "cyan" | "green" | "red" | "purple" | "amber" | "white";

type MoralisHolder = {
  owner_address?: string;
  ownerAddress?: string;
  address?: string;
  balance?: string;
  balance_formatted?: string;
  balanceFormatted?: string;
  percentage_relative_to_total_supply?: number;
  percentage?: number;
  usd_value?: number;
  usdValue?: number;
  label?: string;
  entity?: string;
  is_contract?: boolean;
};

type HolderPersonality = {
  type: string;
  color: HolderColor;
  risk: string;
  conviction: number;
};

type HolderBehaviorFields = {
  estimatedBehavior: string;
  estimatedCluster: string;
  status: "Pending V2";
  flow: "Unavailable";
  pnl: "Unavailable";
  winRate: "Unavailable";
  holdTime: "Unavailable";
  behaviorMetricsEstimated: true;
  estimateNote: string;
};

type HolderRow = HolderBehaviorFields & {
  rank: number;
  wallet: string;
  fullAddress: string;
  balance: string;
  rawBalance: number;
  percentage: string;
  ownershipPercentage: string;
  rawPercentage: number;
  label: string;
  isContract: boolean;
  type: string;
  cluster: string;
  score: number;
  risk: string;
  color: HolderColor;
};

type HoldersSummary = {
  holderCount: number;
  top10Ownership: string;
  top25Ownership: string;
  whaleCount: number;
  contractCount: number;
  exchangeCount: number;
  insiderRisk: number;
  diamondHands: number;
  smartMoney: number;
  rotation: number;
  behaviorMetricsEstimated: true;
};

type HoldersResponse = {
  holders: HolderRow[];
  summary: HoldersSummary;
  warnings?: string[];
  cache?: CacheMetadata;
};

type ApiErrorCode =
  | "MISSING_API_KEY"
  | "MISSING_CHAIN"
  | "MISSING_TOKEN_ADDRESS"
  | "INVALID_TOKEN_ADDRESS"
  | "MORALIS_REQUEST_FAILED"
  | "UNEXPECTED_ERROR";

const HOLDERS_CACHE_TTL_SECONDS = 300;

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

function formatTokenBalance(value?: string) {
  const num = Number(value || 0);

  if (!num) return "0";
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;

  return num.toFixed(2);
}

function formatPercent(value?: number) {
  const num = Number(value || 0);
  if (!num) return "0.000%";
  return `${num.toFixed(3)}%`;
}

function getHolderPercentage(holder: MoralisHolder) {
  return (
    Number(holder.percentage_relative_to_total_supply) ||
    Number(holder.percentage) ||
    0
  );
}

function getHolderBalance(holder: MoralisHolder) {
  return Number(
    holder.balance_formatted || holder.balanceFormatted || holder.balance || 0
  );
}

function isExchangeLabel(label?: string) {
  const lower = (label || "").toLowerCase();

  return (
    lower.includes("exchange") ||
    lower.includes("binance") ||
    lower.includes("bybit") ||
    lower.includes("coinbase") ||
    lower.includes("okx") ||
    lower.includes("kucoin") ||
    lower.includes("gate") ||
    lower.includes("mexc") ||
    lower.includes("kraken")
  );
}

function personalityFromHolder({
  rank,
  percentage,
  balance,
  label,
  isContract,
}: {
  rank: number;
  percentage: number;
  balance: number;
  label?: string;
  isContract?: boolean;
}): HolderPersonality {
  if (isExchangeLabel(label)) {
    return {
      type: "Exchange Wallet",
      color: "white",
      risk: "Neutral",
      conviction: 18,
    };
  }

  if (isContract) {
    return {
      type: "Contract Holder",
      color: "purple",
      risk: "Watch",
      conviction: 52,
    };
  }

  if (rank <= 3 && percentage >= 5) {
    return {
      type: "Early Whale",
      color: "red",
      risk: "High",
      conviction: 42,
    };
  }

  if (percentage >= 4) {
    return {
      type: "Conviction Whale",
      color: "cyan",
      risk: "Medium",
      conviction: 86,
    };
  }

  if (percentage >= 1.5) {
    return {
      type: "Smart Accumulator",
      color: "green",
      risk: "Low",
      conviction: 82,
    };
  }

  if (percentage >= 0.5) {
    return {
      type: "Silent Holder",
      color: "cyan",
      risk: "Low",
      conviction: 74,
    };
  }

  if (rank <= 20 && percentage >= 0.15) {
    return {
      type: "Rotation Wallet",
      color: "purple",
      risk: "Medium",
      conviction: 64,
    };
  }

  if (percentage < 0.05 || balance < 100) {
    return {
      type: "Weak Retail",
      color: "amber",
      risk: "Fragile",
      conviction: 34,
    };
  }

  return {
    type: "Retail Holder",
    color: "white",
    risk: "Low",
    conviction: 56,
  };
}

function estimatedCluster(personality: HolderPersonality, percentage: number) {
  if (personality.type === "Exchange Wallet" || personality.type === "Contract Holder") {
    return "System";
  }

  if (percentage >= 5) return "High concentration";
  if (percentage >= 1) return "Medium concentration";
  return "Low concentration";
}

function behaviorPlaceholders(
  personality: HolderPersonality,
  percentage: number
): HolderBehaviorFields {
  return {
    estimatedBehavior: `Estimated ${personality.type}`,
    estimatedCluster: estimatedCluster(personality, percentage),
    status: "Pending V2",
    flow: "Unavailable",
    pnl: "Unavailable",
    winRate: "Unavailable",
    holdTime: "Unavailable",
    behaviorMetricsEstimated: true,
    estimateNote:
      "Behavior fields are placeholders derived from holder concentration only.",
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
  const tokenAddress = searchParams.get("tokenAddress");
  const chain = searchParams.get("chain");

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

  const mappedChain = mapChain(chain);
  const cacheKey = createCacheKey({
    route: "holders",
    chain: mappedChain,
    tokenAddress,
  });

  try {
    const cachedResult = await getOrSetCache<HoldersResponse>(
      cacheKey,
      HOLDERS_CACHE_TTL_SECONDS,
      async () => {
        const url = new URL(
          `https://deep-index.moralis.io/api/v2.2/erc20/${tokenAddress}/owners`
        );

        url.searchParams.set("chain", mappedChain);
        url.searchParams.set("limit", "100");
        url.searchParams.set("order", "DESC");

        const response = await fetch(url.toString(), {
          headers: {
            accept: "application/json",
            "X-API-Key": apiKey,
          },
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.message || "Moralis holders request failed.");
        }

        const rawHolders: MoralisHolder[] = data?.result || [];

        const holders: HolderRow[] = rawHolders.map((holder, index) => {
      const address =
        holder.owner_address ||
        holder.ownerAddress ||
        holder.address ||
        "";

      const percentage = getHolderPercentage(holder);
      const balance = getHolderBalance(holder);
      const label = holder.label || holder.entity || "";
      const personality = personalityFromHolder({
        rank: index + 1,
        percentage,
        balance,
        label,
        isContract: holder.is_contract,
      });
      const behavior = behaviorPlaceholders(personality, percentage);

      return {
        rank: index + 1,
        wallet: address ? shortAddress(address) : "Unknown",
        fullAddress: address,
        balance: formatTokenBalance(
          holder.balance_formatted || holder.balanceFormatted || holder.balance
        ),
        rawBalance: balance,
        percentage: formatPercent(percentage),
        ownershipPercentage: formatPercent(percentage),
        rawPercentage: percentage,
        label,
        isContract: Boolean(holder.is_contract),
        estimatedBehavior: behavior.estimatedBehavior,
        type: behavior.estimatedBehavior,
        flow: behavior.flow,
        score: personality.conviction,
        holdTime: behavior.holdTime,
        pnl: behavior.pnl,
        winRate: behavior.winRate,
        cluster: behavior.estimatedCluster,
        estimatedCluster: behavior.estimatedCluster,
        risk: personality.risk,
        status: behavior.status,
        color: personality.color,
        behaviorMetricsEstimated: behavior.behaviorMetricsEstimated,
        estimateNote: behavior.estimateNote,
      };
        });

        const top10Ownership = holders
      .slice(0, 10)
      .reduce((sum, holder) => sum + holder.rawPercentage, 0);

        const top25Ownership = holders
      .slice(0, 25)
      .reduce((sum, holder) => sum + holder.rawPercentage, 0);

        const whaleCount = holders.filter((holder) => holder.rawPercentage >= 1).length;
        const contractCount = holders.filter(
          (holder) => holder.type === "Estimated Contract Holder"
        ).length;
        const exchangeCount = holders.filter(
          (holder) => holder.type === "Estimated Exchange Wallet"
        ).length;

        const insiderRisk =
      top10Ownership > 55
        ? 86
        : top10Ownership > 38
        ? 68
        : top10Ownership > 24
        ? 49
        : 27;

        const diamondHands =
      holders.length > 0
        ? Math.round(
            holders.reduce((sum, holder) => sum + holder.score, 0) /
              holders.length
          )
        : 0;

        const smartMoney = Math.min(
      96,
      Math.max(
        18,
        Math.round(100 - insiderRisk * 0.42 + whaleCount * 3 - exchangeCount * 2)
      )
    );

        const rotation = Math.min(
      95,
      Math.max(
        22,
        Math.round(52 + whaleCount * 2 - insiderRisk * 0.12 + contractCount)
      )
    );

        return {
          holders,
          summary: {
            holderCount: holders.length,
            top10Ownership: formatPercent(top10Ownership),
            top25Ownership: formatPercent(top25Ownership),
            whaleCount,
            contractCount,
            exchangeCount,
            insiderRisk,
            diamondHands,
            smartMoney,
            rotation,
            behaviorMetricsEstimated: true,
          },
        };
      }
    );

    return NextResponse.json({
      ...cachedResult.value,
      warnings: [
        ...(cachedResult.value.warnings || []),
        cacheAgeWarning(HOLDERS_CACHE_TTL_SECONDS),
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
          : "Unexpected holders server error.",
      details: error instanceof Error ? error.message : null,
      status: 500,
    });
  }
}
