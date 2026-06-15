import type { DataConfidenceLevel } from "@/lib/novaos-data-layer";
import type { GmgnHolderSnapshot } from "@/lib/gmgn-top100-snapshot";
import {
  buildCompletedTrades,
  buildTradeHistoryMetrics,
  buildWalletEvolutionMetrics,
  type TradeHistoryMetrics,
  type WalletEvolutionMetrics,
} from "@/lib/wallet-trade-history-builder";

type NullableNumber = number | null;

export type WalletAlphaInput = Pick<
  GmgnHolderSnapshot,
  | "wallet"
  | "holderRank"
  | "ownershipPercentage"
  | "usdValue"
  | "activityCount"
  | "hasNext"
  | "buyCount"
  | "sellCount"
  | "uniqueTokensTraded"
  | "totalBuyUsd"
  | "totalSellUsd"
  | "realizedPnlUsdApprox"
  | "winCount"
  | "lossCount"
  | "winRate"
  | "avgTradeUsd"
  | "avgBuyUsd"
  | "avgSellUsd"
  | "avgHoldTimeSecondsApprox"
  | "dataConfidence"
  | "activities"
  | "historyMode"
  | "pagesFetched"
  | "reachedEndOfHistory"
  | "hasMoreHistory"
  | "stoppedByPageLimit"
  | "stoppedByActivityLimit"
  | "stoppedByTimeout"
>;

export type WalletAlphaScores = {
  walletAlpha: number;
  consistency: number;
  entryDiscipline: number;
  exitDiscipline: number;
  winRateQuality: number;
  holdDiscipline: number;
  rotationQuality: number;
  walletEvolution: number | null;
  dataConfidence: number;
};

export type WalletAlphaRawMetrics = {
  activityCount: number;
  buyCount: number;
  sellCount: number;
  uniqueTokensTraded: number;
  totalBuyUsd: NullableNumber;
  totalSellUsd: NullableNumber;
  realizedPnlUsdApprox: NullableNumber;
  winCount: NullableNumber;
  lossCount: NullableNumber;
  winRate: NullableNumber;
  avgTradeUsd: NullableNumber;
  avgBuyUsd: NullableNumber;
  avgSellUsd: NullableNumber;
  avgHoldTimeSecondsApprox: NullableNumber;
  hasNext: boolean;
  ownershipPercentage: NullableNumber;
  usdValue: NullableNumber;
};

export type WalletAlphaResult = {
  wallet: string | null;
  holderRank: number;
  scores: WalletAlphaScores;
  rawMetrics: WalletAlphaRawMetrics;
  explanation: string[];
  confidenceLevel: DataConfidenceLevel;
};

export type WalletAlphaScoresV2 = {
  walletAlphaV2: number;
  consistencyV2: number;
  exitDisciplineV2: number;
  winRateQualityV2: number;
  holdDisciplineV2: number;
  rotationQualityV2: number;
  walletEvolutionV2: number;
  entryDisciplineV2: number;
  dataConfidenceV2: number;
};

export type WalletAlphaRawMetricsV2 = WalletAlphaRawMetrics & {
  totalCompletedTrades: number;
  totalWinningTrades: number;
  totalLosingTrades: number;
  avgRealizedMultiple: NullableNumber;
  medianRealizedMultiple: NullableNumber;
  avgWinningMultiple: NullableNumber;
  avgLosingMultiple: NullableNumber;
  avgHoldSeconds: NullableNumber;
  medianHoldSeconds: NullableNumber;
  profitFactor: NullableNumber;
  maxWinnerMultiple: NullableNumber;
  maxLoserMultiple: NullableNumber;
  last30dWinRate: NullableNumber;
  previous30dWinRate: NullableNumber;
  last30dPnl: NullableNumber;
  previous30dPnl: NullableNumber;
  trendDirection: WalletEvolutionMetrics["trendDirection"];
  historyMode: GmgnHolderSnapshot["historyMode"] | null;
  pagesFetched: NullableNumber;
  reachedEndOfHistory: boolean;
  hasMoreHistory: boolean;
  stoppedByPageLimit: boolean;
  stoppedByActivityLimit: boolean;
  stoppedByTimeout: boolean;
};

export type WalletAlphaResultV2 = {
  wallet: string | null;
  holderRank: number;
  scores: WalletAlphaScoresV2;
  rawMetrics: WalletAlphaRawMetricsV2;
  explanation: string[];
  confidenceLevel: DataConfidenceLevel;
};

export function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function safeNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return fallback;
}

function nullableNumber(value: unknown): NullableNumber {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function confidenceMultiplier(input: WalletAlphaInput) {
  if (input.activityCount < 3) return 0.72;
  if (input.dataConfidence === "high") return input.hasNext ? 0.94 : 1;
  if (input.dataConfidence === "medium") return input.hasNext ? 0.84 : 0.9;
  return input.hasNext ? 0.66 : 0.72;
}

function softenExtremes(score: number, input: WalletAlphaInput) {
  if (input.activityCount >= 10) return score;
  const sampleWeight = Math.max(0.25, input.activityCount / 10);
  return 50 + (score - 50) * sampleWeight;
}

function buySellBalance(input: WalletAlphaInput) {
  const buys = safeNumber(input.buyCount);
  const sells = safeNumber(input.sellCount);
  const total = buys + sells;
  if (total === 0) return 50;

  const ratio = Math.min(buys, sells) / Math.max(buys, sells);
  return 35 + ratio * 45;
}

function validPnlComparisons(input: WalletAlphaInput) {
  return safeNumber(input.winCount) + safeNumber(input.lossCount);
}

function walletHistoryMode(input: WalletAlphaInput) {
  return input.historyMode || "firstPage";
}

function hasMoreWalletHistory(input: WalletAlphaInput) {
  return Boolean(input.hasMoreHistory ?? input.hasNext);
}

export function scoreWinRateQuality(input: WalletAlphaInput) {
  const comparisons = validPnlComparisons(input);
  if (comparisons === 0 || input.winRate === null) {
    return clampScore(42 * confidenceMultiplier(input));
  }

  const winRate = safeNumber(input.winRate);
  const sampleBoost = Math.min(16, comparisons * 2);
  const score = winRate * 0.82 + sampleBoost;

  return clampScore(softenExtremes(score, input) * confidenceMultiplier(input));
}

export function scoreExitDiscipline(input: WalletAlphaInput) {
  const comparisons = validPnlComparisons(input);
  const pnl = nullableNumber(input.realizedPnlUsdApprox);
  const totalBuyUsd = nullableNumber(input.totalBuyUsd);
  const totalSellUsd = nullableNumber(input.totalSellUsd);
  let score = 46;

  if (comparisons > 0 && input.winRate !== null) {
    score += (safeNumber(input.winRate) - 50) * 0.45;
  }

  if (pnl !== null && totalBuyUsd !== null && totalBuyUsd > 0) {
    const pnlRatio = Math.max(-1, Math.min(1, pnl / totalBuyUsd));
    score += pnlRatio * 28;
  } else if (pnl !== null) {
    score += pnl > 0 ? 10 : pnl < 0 ? -10 : 0;
  }

  if (totalBuyUsd !== null && totalSellUsd !== null && totalBuyUsd > 0) {
    const sellToBuy = Math.min(2, totalSellUsd / totalBuyUsd);
    score += sellToBuy >= 0.35 && sellToBuy <= 1.4 ? 8 : -4;
  }

  if (comparisons === 0) score -= 8;

  return clampScore(softenExtremes(score, input) * confidenceMultiplier(input));
}

export function scoreConsistency(input: WalletAlphaInput) {
  const activity = safeNumber(input.activityCount);
  const uniqueTokens = safeNumber(input.uniqueTokensTraded);
  const buys = safeNumber(input.buyCount);
  const sells = safeNumber(input.sellCount);
  const comparisons = validPnlComparisons(input);
  let score = 35;

  score += Math.min(22, activity * 1.2);
  score += Math.min(14, comparisons * 2);
  score += buySellBalance(input) * 0.18;

  if (uniqueTokens > 0) {
    const tradesPerToken = activity / uniqueTokens;
    if (tradesPerToken >= 2 && tradesPerToken <= 18) score += 10;
    if (uniqueTokens > 35 && activity < 80) score -= 10;
    if (uniqueTokens <= 2 && activity > 20) score -= 5;
  } else {
    score -= 12;
  }

  if (buys > 0 && sells === 0 && activity >= 10) score -= 8;
  if (input.hasNext) score -= 3;

  return clampScore(softenExtremes(score, input) * confidenceMultiplier(input));
}

export function scoreHoldDiscipline(input: WalletAlphaInput) {
  const holdTime = nullableNumber(input.avgHoldTimeSecondsApprox);
  if (holdTime === null) {
    return clampScore(48 * confidenceMultiplier(input));
  }

  const hours = holdTime / 3600;
  let score = 44;

  if (hours >= 1) score += 8;
  if (hours >= 6) score += 10;
  if (hours >= 24) score += 12;
  if (hours >= 24 * 14) score -= 4;
  if (hours < 0.25) score -= 10;

  return clampScore(softenExtremes(score, input) * confidenceMultiplier(input));
}

export function scoreRotationQuality(input: WalletAlphaInput) {
  const activity = safeNumber(input.activityCount);
  const uniqueTokens = safeNumber(input.uniqueTokensTraded);
  const avgTradeUsd = nullableNumber(input.avgTradeUsd);
  let score = 54;

  if (activity === 0) return clampScore(30 * confidenceMultiplier(input));

  const diversityRatio = uniqueTokens / Math.max(1, activity);
  if (diversityRatio > 0.65) score -= 22;
  else if (diversityRatio > 0.35) score -= 8;
  else if (diversityRatio >= 0.08) score += 10;

  if (activity > 80 && uniqueTokens > 25) score -= 8;
  if (avgTradeUsd !== null && avgTradeUsd >= 100) score += 5;

  return clampScore(softenExtremes(score, input) * confidenceMultiplier(input));
}

export function scoreEntryDisciplineProvisional(input: WalletAlphaInput) {
  const avgBuyUsd = nullableNumber(input.avgBuyUsd);
  const uniqueTokens = safeNumber(input.uniqueTokensTraded);
  const buys = safeNumber(input.buyCount);
  const sells = safeNumber(input.sellCount);
  let score = 45;

  if (avgBuyUsd !== null) {
    if (avgBuyUsd >= 50) score += 8;
    if (avgBuyUsd >= 500) score += 8;
    if (avgBuyUsd >= 5_000) score += 5;
  }

  if (buys > 0 && uniqueTokens > 0) {
    const buysPerToken = buys / uniqueTokens;
    if (buysPerToken >= 1 && buysPerToken <= 6) score += 12;
    if (buysPerToken > 14) score -= 8;
  }

  score += (buySellBalance(input) - 50) * 0.22;
  if (buys > 0 && sells === 0 && input.activityCount >= 8) score -= 6;

  return clampScore(softenExtremes(score, input) * confidenceMultiplier(input));
}

export function scoreDataConfidence(input: WalletAlphaInput) {
  const comparisons = validPnlComparisons(input);
  let score =
    input.dataConfidence === "high"
      ? 78
      : input.dataConfidence === "medium"
      ? 58
      : 36;

  score += Math.min(12, safeNumber(input.activityCount) * 0.45);
  score += Math.min(8, comparisons * 1.5);
  if (input.hasNext) score -= 8;

  return clampScore(score);
}

function scoreWalletEvolution() {
  return null;
}

function rawMetrics(input: WalletAlphaInput): WalletAlphaRawMetrics {
  return {
    activityCount: safeNumber(input.activityCount),
    buyCount: safeNumber(input.buyCount),
    sellCount: safeNumber(input.sellCount),
    uniqueTokensTraded: safeNumber(input.uniqueTokensTraded),
    totalBuyUsd: nullableNumber(input.totalBuyUsd),
    totalSellUsd: nullableNumber(input.totalSellUsd),
    realizedPnlUsdApprox: nullableNumber(input.realizedPnlUsdApprox),
    winCount: nullableNumber(input.winCount),
    lossCount: nullableNumber(input.lossCount),
    winRate: nullableNumber(input.winRate),
    avgTradeUsd: nullableNumber(input.avgTradeUsd),
    avgBuyUsd: nullableNumber(input.avgBuyUsd),
    avgSellUsd: nullableNumber(input.avgSellUsd),
    avgHoldTimeSecondsApprox: nullableNumber(input.avgHoldTimeSecondsApprox),
    hasNext: hasMoreWalletHistory(input),
    ownershipPercentage: nullableNumber(input.ownershipPercentage),
    usdValue: nullableNumber(input.usdValue),
  };
}

function confidenceLevel(input: WalletAlphaInput): DataConfidenceLevel {
  const dataConfidence = scoreDataConfidence(input);
  if (dataConfidence >= 72) return "high";
  if (dataConfidence >= 48) return "medium";
  return "low";
}

function explanation(input: WalletAlphaInput, scores: WalletAlphaScores) {
  const rows: string[] = [];

  rows.push(
    `Consistency is ${scores.consistency}/100 from ${input.activityCount} observed activities across ${input.uniqueTokensTraded} unique tokens.`
  );
  rows.push(
    `Entry discipline is provisional because V1 has no market-cap entry context. It uses buy size, token selectivity, and buy/sell balance only.`
  );

  if (validPnlComparisons(input) > 0) {
    rows.push(
      `Exit discipline uses ${validPnlComparisons(input)} valid sell comparison(s), approximate PnL, and realized sell flow.`
    );
  } else {
    rows.push("Exit discipline is confidence-limited because no valid sell PnL comparisons were available.");
  }

  if (input.avgHoldTimeSecondsApprox === null) {
    rows.push("Hold discipline is neutral because buy/sell pairs could not be matched by token address.");
  }

  if (input.hasNext) {
    rows.push("Data confidence is reduced because GMGN returned a next cursor and V1 only uses the first page.");
  }

  rows.push("Ownership is retained as raw context only; it does not directly boost Wallet Alpha in V1.");

  return rows;
}

export function computeWalletAlphaV1(input: WalletAlphaInput): WalletAlphaResult {
  const consistency = scoreConsistency(input);
  const entryDiscipline = scoreEntryDisciplineProvisional(input);
  const exitDiscipline = scoreExitDiscipline(input);
  const winRateQuality = scoreWinRateQuality(input);
  const holdDiscipline = scoreHoldDiscipline(input);
  const rotationQuality = scoreRotationQuality(input);
  const walletEvolution = scoreWalletEvolution();
  const dataConfidence = scoreDataConfidence(input);
  const weighted =
    consistency * 0.24 +
    entryDiscipline * 0.16 +
    exitDiscipline * 0.18 +
    winRateQuality * 0.14 +
    holdDiscipline * 0.12 +
    rotationQuality * 0.1 +
    (walletEvolution ?? 50) * 0 +
    dataConfidence * 0.06;
  const scores = {
    walletAlpha: clampScore(weighted),
    consistency,
    entryDiscipline,
    exitDiscipline,
    winRateQuality,
    holdDiscipline,
    rotationQuality,
    walletEvolution,
    dataConfidence,
  };

  return {
    wallet: input.wallet,
    holderRank: input.holderRank,
    scores,
    rawMetrics: rawMetrics(input),
    explanation: explanation(input, scores),
    confidenceLevel: confidenceLevel(input),
  };
}

export function computeWalletAlphaBatchV1(
  wallets: WalletAlphaInput[]
): WalletAlphaResult[] {
  return wallets.map(computeWalletAlphaV1);
}

function softenV2(score: number, metrics: TradeHistoryMetrics, input: WalletAlphaInput) {
  const sampleWeight = Math.min(
    1,
    metrics.totalCompletedTrades === 0
      ? 0.35
      : metrics.totalCompletedTrades < 3
      ? 0.5
      : metrics.totalCompletedTrades < 5
      ? 0.72
      : metrics.totalCompletedTrades / 10
  );
  const nextCursorDrag = input.hasNext ? 2 : 0;
  const softened = 50 + (score - 50) * sampleWeight;
  return clampScore(softened - nextCursorDrag);
}

function v2ConfidenceCap(dataConfidenceV2: number) {
  const level = v2ConfidenceLevel(dataConfidenceV2);
  if (level === "low") return 60;
  if (level === "medium") return 75;
  return 100;
}

function v2SampleSizeCap(metrics: TradeHistoryMetrics) {
  if (metrics.totalCompletedTrades === 0) return 55;
  if (metrics.totalCompletedTrades <= 2) return 65;
  if (metrics.totalCompletedTrades <= 4) return 75;
  return 100;
}

function applyWalletAlphaV2Caps(
  score: number,
  metrics: TradeHistoryMetrics,
  dataConfidenceV2: number
) {
  return clampScore(
    Math.min(score, v2ConfidenceCap(dataConfidenceV2), v2SampleSizeCap(metrics), 90)
  );
}

function singleWinnerDominance(metrics: TradeHistoryMetrics) {
  const maxWinner = nullableNumber(metrics.maxWinnerMultiple);
  const avgWinner = nullableNumber(metrics.avgWinningMultiple);
  const completed = metrics.totalCompletedTrades;

  if (maxWinner === null || avgWinner === null || completed < 2 || avgWinner <= 0) {
    return 0;
  }

  const dominance = maxWinner / avgWinner;
  if (dominance >= 5) return 18;
  if (dominance >= 3) return 10;
  return 0;
}

function scoreConsistencyV2(
  input: WalletAlphaInput,
  metrics: TradeHistoryMetrics
) {
  if (metrics.totalCompletedTrades === 0) return softenV2(46, metrics, input);

  let score = 50;
  const medianMultiple = nullableNumber(metrics.medianRealizedMultiple);
  const avgMultiple = nullableNumber(metrics.avgRealizedMultiple);
  const profitFactor = nullableNumber(metrics.profitFactor);
  const completed = metrics.totalCompletedTrades;

  score += Math.min(14, completed * 1.7);
  if (medianMultiple !== null) {
    if (medianMultiple >= 2) score += 28;
    else if (medianMultiple >= 1.2) score += 18;
    else if (medianMultiple >= 1.05) score += 9;
    else if (medianMultiple < 0.75 && completed >= 4) score -= 22;
    else if (medianMultiple < 0.9 && completed >= 4) score -= 14;
    else if (medianMultiple < 1 && completed >= 4) score -= 8;
  }

  if (avgMultiple !== null && medianMultiple !== null && avgMultiple > medianMultiple * 2.5) {
    score -= 10;
  }

  if (profitFactor !== null) {
    if (profitFactor >= 5) score += 20;
    else if (profitFactor >= 2) score += 13;
    else if (profitFactor >= 1.3) score += 7;
    else if (profitFactor < 0.9 && completed >= 4) score -= 12;
  }

  score -= singleWinnerDominance(metrics);
  score += Math.min(8, validPnlComparisons(input));

  return softenV2(score, metrics, input);
}

function scoreExitDisciplineV2(
  input: WalletAlphaInput,
  metrics: TradeHistoryMetrics
) {
  if (metrics.totalCompletedTrades === 0) return softenV2(48, metrics, input);

  let score = 50;
  const profitFactor = nullableNumber(metrics.profitFactor);
  const medianMultiple = nullableNumber(metrics.medianRealizedMultiple);
  const avgLosingMultiple = nullableNumber(metrics.avgLosingMultiple);
  const maxLoserMultiple = nullableNumber(metrics.maxLoserMultiple);
  const realizedPnl = nullableNumber(input.realizedPnlUsdApprox);

  if (profitFactor !== null) {
    if (profitFactor >= 5) score += 24;
    else if (profitFactor >= 2) score += 16;
    else if (profitFactor >= 1.2) score += 8;
    else if (profitFactor < 1) score -= 14;
  }

  if (realizedPnl !== null) score += realizedPnl > 0 ? 8 : realizedPnl < 0 ? -8 : 0;

  if (medianMultiple !== null) {
    if (medianMultiple >= 1.2) score += 12;
    else if (medianMultiple >= 1.05) score += 6;
    if (medianMultiple < 0.9 && metrics.totalCompletedTrades >= 3) score -= 12;
  }

  if (avgLosingMultiple !== null) {
    if (avgLosingMultiple >= 0.8) score += 10;
    else if (avgLosingMultiple >= 0.65) score += 4;
    if (avgLosingMultiple < 0.5) score -= 14;
  }

  if (maxLoserMultiple !== null && maxLoserMultiple < 0.5) score -= 14;
  score -= singleWinnerDominance(metrics) * 0.5;

  return softenV2(score, metrics, input);
}

function scoreWinRateQualityV2(
  input: WalletAlphaInput,
  metrics: TradeHistoryMetrics
) {
  const comparable = metrics.totalWinningTrades + metrics.totalLosingTrades;
  if (comparable === 0) return softenV2(50, metrics, input);

  const adjustedWinRate =
    ((metrics.totalWinningTrades + 5) / (metrics.totalWinningTrades + metrics.totalLosingTrades + 10)) *
    100;
  let score = adjustedWinRate;
  score += Math.min(10, comparable * 1.2);

  if (metrics.medianRealizedMultiple !== null && metrics.medianRealizedMultiple < 0.95) {
    score -= 10;
  }

  return softenV2(score, metrics, input);
}

function scoreHoldDisciplineV2(
  input: WalletAlphaInput,
  metrics: TradeHistoryMetrics
) {
  const holdSeconds = nullableNumber(metrics.medianHoldSeconds ?? metrics.avgHoldSeconds);
  const medianMultiple = nullableNumber(metrics.medianRealizedMultiple);
  if (holdSeconds === null) return softenV2(50, metrics, input);

  const hours = holdSeconds / 3600;
  let score = 50;

  if (medianMultiple !== null && medianMultiple >= 2 && hours < 1) score += 16;
  else if (medianMultiple !== null && medianMultiple >= 1.2 && hours < 6) score += 10;
  else if (medianMultiple !== null && medianMultiple >= 1.05 && hours >= 1 && hours <= 24 * 14) {
    score += 10;
  }

  if (medianMultiple !== null && medianMultiple < 1 && hours > 24 * 7) score -= 20;
  if (medianMultiple !== null && medianMultiple < 1 && hours < 0.5) score -= 10;

  return softenV2(score, metrics, input);
}

function scoreRotationQualityV2(
  input: WalletAlphaInput,
  metrics: TradeHistoryMetrics
) {
  let score = scoreRotationQuality(input);
  const medianMultiple = nullableNumber(metrics.medianRealizedMultiple);
  const profitFactor = nullableNumber(metrics.profitFactor);

  if (safeNumber(input.uniqueTokensTraded) > 25 && medianMultiple !== null && medianMultiple < 1) {
    score -= 12;
  }

  if (safeNumber(input.uniqueTokensTraded) >= 4 && profitFactor !== null && profitFactor >= 1.5) {
    score += 8;
  }

  return softenV2(score, metrics, input);
}

function scoreWalletEvolutionV2(
  input: WalletAlphaInput,
  metrics: TradeHistoryMetrics,
  evolution: WalletEvolutionMetrics
) {
  let score = 50;

  if (evolution.trendDirection === "improving") score += 16;
  if (evolution.trendDirection === "deteriorating") score -= 16;

  if (evolution.last30dPnl !== null && evolution.previous30dPnl !== null) {
    const pnlDelta = evolution.last30dPnl - evolution.previous30dPnl;
    if (pnlDelta > 0) score += 8;
    if (pnlDelta < 0) score -= 8;
  }

  if (evolution.last30dWinRate !== null && evolution.previous30dWinRate !== null) {
    const winRateDelta = evolution.last30dWinRate - evolution.previous30dWinRate;
    if (winRateDelta > 10) score += 8;
    if (winRateDelta < -10) score -= 8;
  }

  return softenV2(score, metrics, input);
}

function scoreEntryDisciplineV2Provisional(
  input: WalletAlphaInput,
  metrics: TradeHistoryMetrics
) {
  let score = scoreEntryDisciplineProvisional(input);
  const medianMultiple = nullableNumber(metrics.medianRealizedMultiple);

  if (medianMultiple !== null && medianMultiple >= 1.05) score += 6;
  if (medianMultiple !== null && medianMultiple < 0.9 && metrics.totalCompletedTrades >= 4) {
    score -= 6;
  }

  return softenV2(score, metrics, input);
}

function scoreDataConfidenceV2(
  input: WalletAlphaInput,
  metrics: TradeHistoryMetrics
) {
  let score =
    input.dataConfidence === "high"
      ? 70
      : input.dataConfidence === "medium"
      ? 56
      : 44;

  score += Math.min(12, metrics.totalCompletedTrades * 2);
  if (metrics.profitFactor !== null) score += 5;
  if (metrics.medianRealizedMultiple !== null) score += 5;
  if (walletHistoryMode(input) === "firstPage" && hasMoreWalletHistory(input)) {
    score -= 6;
  }
  if (walletHistoryMode(input) === "full" && input.reachedEndOfHistory) {
    score += 8;
  }
  if (
    walletHistoryMode(input) === "full" &&
    (input.stoppedByPageLimit || input.stoppedByActivityLimit || input.stoppedByTimeout) &&
    input.activityCount >= 25
  ) {
    score += 4;
  }

  return clampScore(score);
}

function v2RawMetrics(
  input: WalletAlphaInput,
  metrics: TradeHistoryMetrics,
  evolution: WalletEvolutionMetrics
): WalletAlphaRawMetricsV2 {
  return {
    ...rawMetrics(input),
    totalCompletedTrades: metrics.totalCompletedTrades,
    totalWinningTrades: metrics.totalWinningTrades,
    totalLosingTrades: metrics.totalLosingTrades,
    avgRealizedMultiple: metrics.avgRealizedMultiple,
    medianRealizedMultiple: metrics.medianRealizedMultiple,
    avgWinningMultiple: metrics.avgWinningMultiple,
    avgLosingMultiple: metrics.avgLosingMultiple,
    avgHoldSeconds: metrics.avgHoldSeconds,
    medianHoldSeconds: metrics.medianHoldSeconds,
    profitFactor: metrics.profitFactor,
    maxWinnerMultiple: metrics.maxWinnerMultiple,
    maxLoserMultiple: metrics.maxLoserMultiple,
    last30dWinRate: evolution.last30dWinRate,
    previous30dWinRate: evolution.previous30dWinRate,
    last30dPnl: evolution.last30dPnl,
    previous30dPnl: evolution.previous30dPnl,
    trendDirection: evolution.trendDirection,
    historyMode: input.historyMode || null,
    pagesFetched: nullableNumber(input.pagesFetched),
    reachedEndOfHistory: Boolean(input.reachedEndOfHistory),
    hasMoreHistory: hasMoreWalletHistory(input),
    stoppedByPageLimit: Boolean(input.stoppedByPageLimit),
    stoppedByActivityLimit: Boolean(input.stoppedByActivityLimit),
    stoppedByTimeout: Boolean(input.stoppedByTimeout),
  };
}

function v2ConfidenceLevel(score: number): DataConfidenceLevel {
  if (score >= 72) return "high";
  if (score >= 48) return "medium";
  return "low";
}

function v2Explanation({
  input,
  metrics,
  evolution,
  scores,
}: {
  input: WalletAlphaInput;
  metrics: TradeHistoryMetrics;
  evolution: WalletEvolutionMetrics;
  scores: WalletAlphaScoresV2;
}) {
  const rows: string[] = [];

  if (metrics.totalCompletedTrades < 3) {
    rows.push("Low completed trade count keeps V2 scores close to neutral.");
  } else {
    rows.push(`${metrics.totalCompletedTrades} completed buy-to-sell trade(s) were used for V2 scoring.`);
  }

  if (metrics.totalCompletedTrades === 0) {
    rows.push("Missing realized trade data treated as neutral uncertainty.");
  }

  if (metrics.totalCompletedTrades < 5) {
    rows.push("Score capped due to low completed trade sample.");
  }

  if (metrics.profitFactor !== null && metrics.profitFactor >= 1.5) {
    rows.push(`Strong profit factor (${metrics.profitFactor}) supports exit discipline and consistency.`);
  }

  if (metrics.medianRealizedMultiple !== null && metrics.medianRealizedMultiple < 1) {
    rows.push(`Weak median realized multiple (${metrics.medianRealizedMultiple}x) limits consistency.`);
  }

  if (metrics.medianRealizedMultiple !== null && metrics.medianRealizedMultiple >= 1.1) {
    rows.push(`Profitable median realized multiple (${metrics.medianRealizedMultiple}x) supports consistency.`);
  }

  if (metrics.medianRealizedMultiple !== null && metrics.medianRealizedMultiple >= 1.2) {
    rows.push("Strong median multiple boosted consistency.");
  }

  if (singleWinnerDominance(metrics) > 0) {
    rows.push("A large single-winner dominance penalty was applied to avoid over-rewarding one lucky trade.");
  }

  if (
    (metrics.avgLosingMultiple !== null && metrics.avgLosingMultiple < 0.8) ||
    (metrics.maxLoserMultiple !== null && metrics.maxLoserMultiple < 0.5)
  ) {
    rows.push("Loss-control penalty applied.");
  }

  if (metrics.avgLosingMultiple !== null && metrics.avgLosingMultiple < 0.5) {
    rows.push("Poor loss control reduced exit discipline.");
  }

  if (evolution.trendDirection === "improving") {
    rows.push("Recent 30-day performance is improving versus the previous 30-day window.");
  }

  if (evolution.trendDirection === "deteriorating") {
    rows.push("Recent 30-day performance is deteriorating versus the previous 30-day window.");
  }

  const historyMode = walletHistoryMode(input);

  if (historyMode === "full" && input.reachedEndOfHistory) {
    rows.push("Full available GMGN history was used for this wallet.");
  } else if (historyMode === "full" && input.stoppedByPageLimit) {
    rows.push("History was partially analyzed and stopped by page limit.");
  } else if (historyMode === "full" && input.stoppedByActivityLimit) {
    rows.push("History was partially analyzed and stopped by activity limit.");
  } else if (historyMode === "full" && input.stoppedByTimeout) {
    rows.push("History was partially analyzed and stopped by timeout protection.");
  } else if (historyMode === "bounded") {
    rows.push("Bounded GMGN history was used.");
  } else if (historyMode === "firstPage") {
    rows.push("Only the first GMGN activity page was used.");
  }

  rows.push(
    `Entry discipline V2 is provisional at ${scores.entryDisciplineV2}/100 because true entry quality requires future market-cap and peak-history data.`
  );

  return rows;
}

export function computeWalletAlphaV2(input: WalletAlphaInput): WalletAlphaResultV2 {
  const completedTrades = buildCompletedTrades(input.activities || []);
  const metrics = buildTradeHistoryMetrics(completedTrades);
  const evolution = buildWalletEvolutionMetrics(completedTrades);
  const consistencyV2 = scoreConsistencyV2(input, metrics);
  const exitDisciplineV2 = scoreExitDisciplineV2(input, metrics);
  const winRateQualityV2 = scoreWinRateQualityV2(input, metrics);
  const holdDisciplineV2 = scoreHoldDisciplineV2(input, metrics);
  const rotationQualityV2 = scoreRotationQualityV2(input, metrics);
  const walletEvolutionV2 = scoreWalletEvolutionV2(input, metrics, evolution);
  const entryDisciplineV2 = scoreEntryDisciplineV2Provisional(input, metrics);
  const dataConfidenceV2 = scoreDataConfidenceV2(input, metrics);
  const weightedWalletAlphaV2 = clampScore(
    consistencyV2 * 0.26 +
      exitDisciplineV2 * 0.17 +
      winRateQualityV2 * 0.14 +
      holdDisciplineV2 * 0.13 +
      rotationQualityV2 * 0.12 +
      walletEvolutionV2 * 0.08 +
      entryDisciplineV2 * 0.04 +
      dataConfidenceV2 * 0.06
  );
  const walletAlphaV2 = applyWalletAlphaV2Caps(
    weightedWalletAlphaV2,
    metrics,
    dataConfidenceV2
  );
  const scores = {
    walletAlphaV2,
    consistencyV2,
    exitDisciplineV2,
    winRateQualityV2,
    holdDisciplineV2,
    rotationQualityV2,
    walletEvolutionV2,
    entryDisciplineV2,
    dataConfidenceV2,
  };

  return {
    wallet: input.wallet,
    holderRank: input.holderRank,
    scores,
    rawMetrics: v2RawMetrics(input, metrics, evolution),
    explanation: v2Explanation({ input, metrics, evolution, scores }),
    confidenceLevel: v2ConfidenceLevel(dataConfidenceV2),
  };
}

export function computeWalletAlphaBatchV2(
  wallets: WalletAlphaInput[]
): WalletAlphaResultV2[] {
  return wallets.map(computeWalletAlphaV2);
}
