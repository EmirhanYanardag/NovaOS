import { NextResponse } from "next/server";
import {
  cacheAgeWarning,
  createTokenAnalysisCacheKey,
  getOrSetCache,
  type CacheMetadata,
} from "@/lib/cache";

type Direction = "buy" | "sell" | "transfer_in" | "transfer_out";

type ConfidenceLabel = "High confidence" | "Medium confidence" | "Low confidence";

type BehaviorSignal =
  | "accumulation behavior"
  | "distribution behavior"
  | "inactive behavior"
  | "high-frequency behavior"
  | "fresh-wallet behavior"
  | "insufficient data";

type MoralisTokenTransfer = {
  transaction_hash?: string;
  tx_hash?: string;
  block_timestamp?: string;
  address?: string;
  token_address?: string;
  token_symbol?: string;
  symbol?: string;
  from_address?: string;
  to_address?: string;
  from_wallet?: string;
  to_wallet?: string;
  value?: string;
  value_decimal?: string;
  value_formatted?: string;
  amount?: string;
  usd_value?: number | string;
  value_usd?: number | string;
  direction?: string;
  transaction_type?: string;
  category?: string;
};

type MoralisTokenTransferResponse = {
  result?: MoralisTokenTransfer[];
};

type NormalizedTransaction = {
  timestamp: string | null;
  tokenSymbol: string | null;
  tokenAddress: string | null;
  direction: Direction;
  valueUsd: number | null;
  amount: string | null;
  counterparty: string | null;
  txHash: string | null;
};

type ActivityMetrics = {
  recentBuyPressure: number;
  recentSellPressure: number;
  transactionFrequency: number;
  averageTransactionSize: number | null;
  buySellRatio: number | null;
  activeDaysEstimate: number;
  metricsStatus: "estimated";
};

type BehaviorSummary = {
  dominantBehavior: BehaviorSignal;
  signals: BehaviorSignal[];
  accumulationScore: number;
  distributionScore: number;
  inactivityScore: number;
  frequencyScore: number;
  freshWalletScore: number;
  summaryStatus: "inferred";
  explanation: string;
};

type WalletTransactionsResponse = {
  walletAddress: string;
  chain: string;
  tokenAddress: string | null;
  transactions: NormalizedTransaction[];
  behaviorSummary: BehaviorSummary;
  activityMetrics: ActivityMetrics;
  confidence: {
    label: ConfidenceLabel;
    score: number;
    rationale: string[];
  };
  warnings: string[];
  cache?: CacheMetadata;
};

type ApiErrorCode =
  | "MISSING_API_KEY"
  | "MISSING_CHAIN"
  | "MISSING_WALLET_ADDRESS"
  | "INVALID_WALLET_ADDRESS"
  | "INVALID_TOKEN_ADDRESS"
  | "MORALIS_REQUEST_FAILED";

const WALLET_TRANSACTIONS_CACHE_TTL_SECONDS = 900;

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

function parseTimestamp(value?: string) {
  if (!value) return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;
  return new Date(time).toISOString();
}

function parseNumber(value?: number | string | null) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function classifyDirection({
  transfer,
  walletAddress,
}: {
  transfer: MoralisTokenTransfer;
  walletAddress: string;
}): Direction {
  const semanticDirection = (
    transfer.direction ||
    transfer.transaction_type ||
    transfer.category ||
    ""
  ).toLowerCase();

  if (semanticDirection.includes("buy")) return "buy";
  if (semanticDirection.includes("sell")) return "sell";

  const wallet = walletAddress.toLowerCase();
  const from = (transfer.from_address || transfer.from_wallet || "").toLowerCase();
  const to = (transfer.to_address || transfer.to_wallet || "").toLowerCase();

  if (to === wallet) return "transfer_in";
  if (from === wallet) return "transfer_out";

  return "transfer_out";
}

function normalizeTransfer({
  transfer,
  walletAddress,
}: {
  transfer: MoralisTokenTransfer;
  walletAddress: string;
}): NormalizedTransaction {
  const direction = classifyDirection({ transfer, walletAddress });
  const wallet = walletAddress.toLowerCase();
  const from = transfer.from_address || transfer.from_wallet || null;
  const to = transfer.to_address || transfer.to_wallet || null;
  const counterparty =
    to?.toLowerCase() === wallet ? from : from?.toLowerCase() === wallet ? to : to || from;

  return {
    timestamp: parseTimestamp(transfer.block_timestamp),
    tokenSymbol: transfer.token_symbol || transfer.symbol || null,
    tokenAddress: transfer.token_address || transfer.address || null,
    direction,
    valueUsd: parseNumber(transfer.usd_value ?? transfer.value_usd),
    amount:
      transfer.value_decimal ||
      transfer.value_formatted ||
      transfer.amount ||
      transfer.value ||
      null,
    counterparty,
    txHash: transfer.transaction_hash || transfer.tx_hash || null,
  };
}

function activeDayCount(transactions: NormalizedTransaction[]) {
  return new Set(
    transactions
      .map((transaction) => transaction.timestamp?.slice(0, 10))
      .filter((day): day is string => Boolean(day))
  ).size;
}

function newestTimestamp(transactions: NormalizedTransaction[]) {
  const timestamps = transactions
    .map((transaction) =>
      transaction.timestamp ? Date.parse(transaction.timestamp) : Number.NaN
    )
    .filter((time) => Number.isFinite(time));

  if (timestamps.length === 0) return null;
  return Math.max(...timestamps);
}

function oldestTimestamp(transactions: NormalizedTransaction[]) {
  const timestamps = transactions
    .map((transaction) =>
      transaction.timestamp ? Date.parse(transaction.timestamp) : Number.NaN
    )
    .filter((time) => Number.isFinite(time));

  if (timestamps.length === 0) return null;
  return Math.min(...timestamps);
}

function buildActivityMetrics(
  transactions: NormalizedTransaction[]
): ActivityMetrics {
  const inbound = transactions.filter(
    (transaction) =>
      transaction.direction === "buy" || transaction.direction === "transfer_in"
  );
  const outbound = transactions.filter(
    (transaction) =>
      transaction.direction === "sell" || transaction.direction === "transfer_out"
  );
  const valuedTransactions = transactions.filter(
    (transaction) => transaction.valueUsd !== null
  );
  const averageTransactionSize =
    valuedTransactions.length > 0
      ? Number(
          (
            valuedTransactions.reduce(
              (sum, transaction) => sum + (transaction.valueUsd || 0),
              0
            ) / valuedTransactions.length
          ).toFixed(2)
        )
      : null;
  const days = Math.max(1, activeDayCount(transactions));

  return {
    recentBuyPressure: inbound.length,
    recentSellPressure: outbound.length,
    transactionFrequency: Number((transactions.length / days).toFixed(2)),
    averageTransactionSize,
    buySellRatio:
      outbound.length === 0
        ? inbound.length > 0
          ? inbound.length
          : null
        : Number((inbound.length / outbound.length).toFixed(2)),
    activeDaysEstimate: activeDayCount(transactions),
    metricsStatus: "estimated",
  };
}

function buildBehaviorSummary({
  transactions,
  metrics,
}: {
  transactions: NormalizedTransaction[];
  metrics: ActivityMetrics;
}): BehaviorSummary {
  if (transactions.length === 0) {
    return {
      dominantBehavior: "insufficient data",
      signals: ["insufficient data"],
      accumulationScore: 0,
      distributionScore: 0,
      inactivityScore: 80,
      frequencyScore: 0,
      freshWalletScore: 0,
      summaryStatus: "inferred",
      explanation:
        "No recent token transfer history was returned, so behavior inference is unavailable.",
    };
  }

  const newest = newestTimestamp(transactions);
  const oldest = oldestTimestamp(transactions);
  const daysSinceLastActive =
    newest === null ? null : Math.max(0, (Date.now() - newest) / 86_400_000);
  const observedAgeDays =
    oldest === null ? null : Math.max(0, (Date.now() - oldest) / 86_400_000);
  const totalPressure = metrics.recentBuyPressure + metrics.recentSellPressure;
  const accumulationScore =
    totalPressure === 0
      ? 0
      : clampScore((metrics.recentBuyPressure / totalPressure) * 100);
  const distributionScore =
    totalPressure === 0
      ? 0
      : clampScore((metrics.recentSellPressure / totalPressure) * 100);
  const inactivityScore =
    daysSinceLastActive === null
      ? 65
      : daysSinceLastActive <= 7
      ? 5
      : daysSinceLastActive <= 30
      ? 22
      : daysSinceLastActive <= 90
      ? 48
      : 78;
  const frequencyScore = clampScore(metrics.transactionFrequency * 18);
  const freshWalletScore =
    observedAgeDays !== null && observedAgeDays <= 14 ? 82 : 0;
  const signals: BehaviorSignal[] = [];

  if (accumulationScore >= 60) signals.push("accumulation behavior");
  if (distributionScore >= 60) signals.push("distribution behavior");
  if (inactivityScore >= 60) signals.push("inactive behavior");
  if (frequencyScore >= 60) signals.push("high-frequency behavior");
  if (freshWalletScore >= 60) signals.push("fresh-wallet behavior");
  if (signals.length === 0) signals.push("insufficient data");

  const rankedSignals = [
    ["accumulation behavior", accumulationScore],
    ["distribution behavior", distributionScore],
    ["inactive behavior", inactivityScore],
    ["high-frequency behavior", frequencyScore],
    ["fresh-wallet behavior", freshWalletScore],
  ] as const;
  const dominantBehavior =
    [...rankedSignals].sort((a, b) => b[1] - a[1])[0]?.[0] ||
    "insufficient data";

  return {
    dominantBehavior,
    signals,
    accumulationScore,
    distributionScore,
    inactivityScore,
    frequencyScore,
    freshWalletScore,
    summaryStatus: "inferred",
    explanation:
      "Behavior is inferred from recent wallet token transfers, direction, timing and available values. It is not PnL, win-rate or smart-money identity.",
  };
}

function buildConfidence({
  transactions,
  behaviorSummary,
}: {
  transactions: NormalizedTransaction[];
  behaviorSummary: BehaviorSummary;
}) {
  const rationale: string[] = [];
  const valueCoverage =
    transactions.length === 0
      ? 0
      : transactions.filter((transaction) => transaction.valueUsd !== null).length /
        transactions.length;
  const repeatedPatterns =
    behaviorSummary.signals.filter((signal) => signal !== "insufficient data")
      .length;
  let score = 20;

  if (transactions.length >= 20) {
    score += 28;
    rationale.push("Recent transfer history is active enough for stronger inference.");
  } else if (transactions.length >= 5) {
    score += 16;
    rationale.push("Recent transfer history is present but limited.");
  } else {
    rationale.push("Sparse transfer history lowers confidence.");
  }

  if (valueCoverage >= 0.7) {
    score += 22;
    rationale.push("Most transfers include USD value.");
  } else if (valueCoverage >= 0.3) {
    score += 10;
    rationale.push("Some transfers include USD value.");
  } else {
    rationale.push("Missing token values lower confidence.");
  }

  if (repeatedPatterns >= 2) {
    score += 18;
    rationale.push("Repeated behavior patterns were detected.");
  } else if (repeatedPatterns === 1) {
    score += 8;
    rationale.push("A single behavior pattern was detected.");
  }

  const finalScore = clampScore(score);
  const label: ConfidenceLabel =
    finalScore >= 72
      ? "High confidence"
      : finalScore >= 45
      ? "Medium confidence"
      : "Low confidence";

  return {
    label,
    score: finalScore,
    rationale,
  };
}

function buildWarnings({
  transactions,
  tokenAddress,
}: {
  transactions: NormalizedTransaction[];
  tokenAddress: string | null;
}) {
  const warnings = [
    "All behavior labels are inference-only and do not represent profitability.",
    "PnL, win rate, average hold duration and smart money identity are unavailable in this route.",
  ];

  if (!tokenAddress) {
    warnings.push(
      "No tokenAddress was provided, so metrics summarize recent wallet token transfers across tokens."
    );
  }

  if (transactions.length === 0) {
    warnings.push("Moralis returned no recent token transfers for this wallet.");
  }

  if (transactions.some((transaction) => transaction.valueUsd === null)) {
    warnings.push(
      "Some transfers are missing USD value, so average transaction size is partial."
    );
  }

  return warnings;
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
    route: "wallet-transactions",
    chain: mappedChain,
    tokenAddress: normalizedToken,
    walletAddress: normalizedWallet,
  });

  try {
    const cachedResult = await getOrSetCache<WalletTransactionsResponse>(
      cacheKey,
      WALLET_TRANSACTIONS_CACHE_TTL_SECONDS,
      async () => {
        const url = new URL(
          `https://deep-index.moralis.io/api/v2.2/${normalizedWallet}/erc20/transfers`
        );
        url.searchParams.set("chain", mappedChain);
        url.searchParams.set("limit", "100");
        url.searchParams.set("order", "DESC");

        if (normalizedToken) {
          url.searchParams.append("contract_addresses", normalizedToken);
        }

        const data = await fetchMoralisJson<MoralisTokenTransferResponse>({
          url,
          apiKey,
        });
        const transfers = data.result || [];
        const transactions = transfers
          .map((transfer) => normalizeTransfer({ transfer, walletAddress: normalizedWallet }))
          .filter((transaction) =>
            normalizedToken
              ? transaction.tokenAddress?.toLowerCase() === normalizedToken
              : true
          );
        const activityMetrics = buildActivityMetrics(transactions);
        const behaviorSummary = buildBehaviorSummary({
          transactions,
          metrics: activityMetrics,
        });
        const confidence = buildConfidence({ transactions, behaviorSummary });
        const warnings = buildWarnings({ transactions, tokenAddress: normalizedToken });

        return {
          walletAddress: normalizedWallet,
          chain: mappedChain,
          tokenAddress: normalizedToken,
          transactions,
          behaviorSummary,
          activityMetrics,
          confidence,
          warnings,
        };
      },
      { provider: "moralis", route: "wallet-transactions" }
    );

    return NextResponse.json({
      ...cachedResult.value,
      warnings: [
        ...cachedResult.value.warnings,
        cacheAgeWarning(WALLET_TRANSACTIONS_CACHE_TTL_SECONDS),
      ],
      cache: cachedResult.cache,
    });
  } catch (error) {
    return structuredError({
      code: "MORALIS_REQUEST_FAILED",
      message:
        error instanceof Error
          ? error.message
          : "Wallet transaction request failed.",
      status: 500,
    });
  }
}
