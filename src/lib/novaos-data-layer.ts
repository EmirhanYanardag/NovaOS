export type DataConfidenceLevel = "low" | "medium" | "high";

export type DataAvailabilityStatus =
  | "available_directly"
  | "derivable"
  | "partially_derivable"
  | "not_available";

export type WalletTradeEventType = "buy" | "sell" | "transfer" | "unknown";

export type MissingWalletProfileData = {
  walletAge: boolean;
  tradeHistory: boolean;
  timestamps: boolean;
  pnl: boolean;
  holdings: boolean;
  tokenIdentity: boolean;
  usdValues: boolean;
  holdTimePairs: boolean;
};

export type WalletTrade = {
  wallet: string;
  chain: string;
  txHash: string | null;
  timestamp: string | null;
  eventType: WalletTradeEventType;
  tokenAddress: string | null;
  tokenSymbol: string | null;
  tokenTotalSupply: string | number | null;
  tokenAmount: string | number | null;
  costUsd: number | null;
  buyCostUsd: number | null;
  priceUsd: number | null;
  quoteAmount: string | number | null;
  quoteSymbol: string | null;
  gasUsd: number | null;
  dexUsd: number | null;
  launchpad: string | boolean | null;
};

export type WalletHolding = {
  wallet: string;
  chain: string;
  tokenAddress: string | null;
  tokenSymbol: string | null;
  tokenAmount: string | number | null;
  ownershipPercentage: number | null;
  usdValue: number | null;
  costBasisUsd: number | null;
  unrealizedPnlUsd: number | null;
  label: string | null;
};

export type WalletPerformance = {
  realizedPnlUsd: number | null;
  winCount: number | null;
  lossCount: number | null;
  winRate: number | null;
  avgTradeUsd: number | null;
  avgBuyUsd: number | null;
  avgSellUsd: number | null;
  avgHoldTimeSeconds: number | null;
};

export type WalletProfile = WalletPerformance & {
  wallet: string;
  ageDays: number | null;
  firstSeenTimestamp: string | null;
  lastSeenTimestamp: string | null;
  totalTrades: number;
  totalBuys: number;
  totalSells: number;
  totalBuyUsd: number;
  totalSellUsd: number;
  uniqueTokensTraded: number;
  currentHoldingsCount: number | null;
  confidenceLevel: DataConfidenceLevel;
  missingData: MissingWalletProfileData;
};

export type TokenHolderSnapshot = {
  chain: string;
  tokenAddress: string;
  holderRank: number;
  wallet: string | null;
  tokenAmount: string | number | null;
  ownershipPercentage: number | null;
  usdValue: number | null;
  label: string | null;
  walletProfile: WalletProfile | null;
  missingData: MissingWalletProfileData;
};

export type MetricCoverage = {
  metric: string;
  status: DataAvailabilityStatus;
  source: string;
  fields: string[];
  notes: string;
};

export const NOVAOS_DATA_COVERAGE_V1: MetricCoverage[] = [
  {
    metric: "walletAge",
    status: "derivable",
    source: "wallet activity history",
    fields: ["timestamp"],
    notes:
      "Age is derived from the oldest returned wallet activity timestamp, so first-page-only reads are lower-bound observations, not full wallet creation age.",
  },
  {
    metric: "tradeHistory",
    status: "available_directly",
    source: "wallet activity history",
    fields: ["eventType", "txHash", "timestamp", "tokenAddress", "tokenAmount"],
    notes:
      "Buy, sell and transfer history is available from normalized activity records when the provider returns event type and token identity.",
  },
  {
    metric: "realizedPnl",
    status: "derivable",
    source: "wallet activity history",
    fields: ["eventType", "costUsd", "buyCostUsd"],
    notes:
      "Approximate realized PnL is derived only for sell events with both sell cost and buy cost present.",
  },
  {
    metric: "winRate",
    status: "derivable",
    source: "wallet activity history",
    fields: ["eventType", "costUsd", "buyCostUsd"],
    notes:
      "Win/loss is derived only from sell records where both cost fields exist. Missing comparisons return null.",
  },
  {
    metric: "currentHoldings",
    status: "partially_derivable",
    source: "token holder snapshot",
    fields: ["wallet", "tokenAmount", "ownershipPercentage", "usdValue"],
    notes:
      "Current holding for the requested token is available for top holders. Full wallet portfolio holdings require an additional portfolio holdings endpoint.",
  },
  {
    metric: "smartMoneyInformation",
    status: "not_available",
    source: "none integrated",
    fields: [],
    notes:
      "No smart-money label endpoint is integrated. NovaOS should not infer this label from concentration or PnL alone.",
  },
  {
    metric: "traderInformation",
    status: "partially_derivable",
    source: "wallet activity history",
    fields: ["eventType", "timestamp", "costUsd", "tokenAddress"],
    notes:
      "Trader behavior can be described structurally later, but no ranking or scoring should be attached in Data Layer V1.",
  },
  {
    metric: "holderInformation",
    status: "available_directly",
    source: "token holder snapshot",
    fields: ["wallet", "tokenAmount", "ownershipPercentage", "usdValue", "label"],
    notes:
      "Top-holder information is available for the requested token and can seed wallet-level profile building.",
  },
];

function timestampMs(value: string | null) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4));
}

function sum(values: number[]) {
  return Number(values.reduce((total, value) => total + value, 0).toFixed(4));
}

function sumOrNull(values: number[]) {
  return values.length > 0 ? sum(values) : null;
}

function estimateHoldTimeSeconds(trades: WalletTrade[]) {
  const sorted = trades
    .filter((trade) => trade.timestamp && trade.tokenAddress)
    .sort((a, b) => (timestampMs(a.timestamp) || 0) - (timestampMs(b.timestamp) || 0));
  const buysByToken = new Map<string, number[]>();
  const holdTimes: number[] = [];

  for (const trade of sorted) {
    const token = trade.tokenAddress;
    const time = timestampMs(trade.timestamp);
    if (!token || time === null) continue;

    if (trade.eventType === "buy") {
      buysByToken.set(token, [...(buysByToken.get(token) || []), time]);
    }

    if (trade.eventType === "sell") {
      const buys = buysByToken.get(token) || [];
      const buyTime = buys.shift();

      if (buyTime !== undefined && time >= buyTime) {
        holdTimes.push((time - buyTime) / 1000);
      }

      buysByToken.set(token, buys);
    }
  }

  return average(holdTimes);
}

function confidenceLevel({
  trades,
  missingData,
  validPnlComparisons,
}: {
  trades: WalletTrade[];
  missingData: MissingWalletProfileData;
  validPnlComparisons: number;
}): DataConfidenceLevel {
  const hasHistoryDepth = trades.length >= 20;
  const hasBasicHistory = trades.length >= 5;
  const hasTimestamps = !missingData.timestamps;
  const hasUsdValues = !missingData.usdValues;

  if (hasHistoryDepth && hasTimestamps && hasUsdValues && validPnlComparisons > 0) {
    return "high";
  }

  if (hasBasicHistory && hasTimestamps && (hasUsdValues || validPnlComparisons > 0)) {
    return "medium";
  }

  return "low";
}

export function buildWalletProfileV1({
  wallet,
  trades,
  holdings,
}: {
  wallet: string;
  trades: WalletTrade[];
  holdings?: WalletHolding[];
}): WalletProfile {
  const timestamps = trades
    .map((trade) => trade.timestamp)
    .filter((timestamp): timestamp is string => Boolean(timestamp))
    .sort((a, b) => Date.parse(a) - Date.parse(b));
  const buyTrades = trades.filter((trade) => trade.eventType === "buy");
  const sellTrades = trades.filter((trade) => trade.eventType === "sell");
  const buyUsd = buyTrades
    .map((trade) => trade.costUsd)
    .filter((value): value is number => value !== null);
  const sellUsd = sellTrades
    .map((trade) => trade.costUsd)
    .filter((value): value is number => value !== null);
  const tradeUsd = trades
    .map((trade) => trade.costUsd)
    .filter((value): value is number => value !== null);
  const pnlComparisons = sellTrades
    .map((trade) =>
      trade.costUsd !== null && trade.buyCostUsd !== null
        ? trade.costUsd - trade.buyCostUsd
        : null
    )
    .filter((value): value is number => value !== null);
  const winCount =
    pnlComparisons.length > 0
      ? pnlComparisons.filter((value) => value > 0).length
      : null;
  const lossCount =
    pnlComparisons.length > 0
      ? pnlComparisons.filter((value) => value < 0).length
      : null;
  const winLossTotal = (winCount ?? 0) + (lossCount ?? 0);
  const firstSeenTimestamp = timestamps[0] || null;
  const lastSeenTimestamp = timestamps[timestamps.length - 1] || null;
  const firstSeenMs = timestampMs(firstSeenTimestamp);
  const lastSeenMs = timestampMs(lastSeenTimestamp);
  const missingData: MissingWalletProfileData = {
    walletAge: firstSeenMs === null,
    tradeHistory: trades.length === 0,
    timestamps: trades.length === 0 || timestamps.length === 0,
    pnl: pnlComparisons.length === 0,
    holdings: holdings === undefined,
    tokenIdentity: !trades.some((trade) => trade.tokenAddress),
    usdValues: tradeUsd.length === 0,
    holdTimePairs: estimateHoldTimeSeconds(trades) === null,
  };

  return {
    wallet,
    ageDays:
      firstSeenMs !== null && lastSeenMs !== null
        ? Number(Math.max(0, (lastSeenMs - firstSeenMs) / 86_400_000).toFixed(2))
        : null,
    firstSeenTimestamp,
    lastSeenTimestamp,
    totalTrades: trades.length,
    totalBuys: buyTrades.length,
    totalSells: sellTrades.length,
    totalBuyUsd: sum(buyUsd),
    totalSellUsd: sum(sellUsd),
    realizedPnlUsd: sumOrNull(pnlComparisons),
    winCount,
    lossCount,
    winRate:
      winLossTotal > 0
        ? Number((((winCount || 0) / winLossTotal) * 100).toFixed(2))
        : null,
    avgTradeUsd: average(tradeUsd),
    avgBuyUsd: average(buyUsd),
    avgSellUsd: average(sellUsd),
    avgHoldTimeSeconds: estimateHoldTimeSeconds(trades),
    uniqueTokensTraded: new Set(
      trades
        .map((trade) => trade.tokenAddress)
        .filter((token): token is string => Boolean(token))
    ).size,
    currentHoldingsCount: holdings ? holdings.length : null,
    confidenceLevel: confidenceLevel({
      trades,
      missingData,
      validPnlComparisons: pnlComparisons.length,
    }),
    missingData,
  };
}
