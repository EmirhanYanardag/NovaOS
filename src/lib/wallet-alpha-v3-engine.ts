import type { GMGNActivity } from "@/lib/gmgn";
import type { WalletTrade } from "@/lib/novaos-data-layer";
import {
  type WalletHistoricalEntryExitV3Result,
  analyzeWalletHistoricalEntryExitV3,
} from "@/lib/wallet-historical-entry-exit-v3";
import {
  buildCompletedTrades,
  buildTradeHistoryMetrics,
  buildWalletEvolutionMetrics,
  type CompletedTrade,
  type TradeHistoryMetrics,
  type WalletEvolutionMetrics,
} from "@/lib/wallet-trade-history-builder";
import {
  fetchGmgnWalletActivityPaginated,
  type PaginatedGmgnWalletActivityResponse,
} from "@/lib/gmgn-wallet-activity";

type UnknownRecord = Record<string, unknown>;
type KlineInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";
type ConfidenceLevel = "low" | "medium" | "high";

export type WalletAlphaV3Options = {
  walletMaxPages?: number;
  walletMaxActivities?: number;
  maxTokens?: number;
  interval?: KlineInterval;
  concurrency?: number;
};

export type WalletAlphaV3Scores = {
  consistencyV3: number;
  entryDisciplineV3: number;
  exitDisciplineV3: number;
  winRateQualityV3: number;
  positionDisciplineV3: number;
  holdDisciplineV3: number;
  rotationQualityV3: number;
  walletEvolutionV3: number;
  riskHygieneV3: number;
  dataConfidenceV3: number;
};

export type WalletAlphaV3RawMetrics = {
  activityCount: number;
  completedTradeCount: number;
  coveredHistoricalTradeCount: number;
  historicalTokenCount: number;
  uniqueTokensTraded: number;
  buyCount: number;
  sellCount: number;
  adjustedWinRate: number | null;
  rawWinRate: number | null;
  totalWinningTrades: number;
  totalLosingTrades: number;
  averageRealizedMultiple: number | null;
  medianRealizedMultiple: number | null;
  averageWinnerMultiple: number | null;
  averageLoserMultiple: number | null;
  profitFactor: number | null;
  historicalEntryDiscipline: number | null;
  historicalExitDiscipline: number | null;
  historicalPeakCapture: number | null;
  historicalMissedUpside: number | null;
  averageHoldSeconds: number | null;
  medianHoldSeconds: number | null;
  singleWinnerDominance: number | null;
  lossSeverity: number | null;
  rotationDensity: number;
  trendDirection: WalletEvolutionMetrics["trendDirection"];
  last30dPnl: number | null;
  previous30dPnl: number | null;
  last30dWinRate: number | null;
  previous30dWinRate: number | null;
};

export type WalletAlphaV3Result = {
  version: "v3.3-dex-separation-calibrated";
  wallet: string;
  walletAlphaV3: number;
  rawWalletAlphaBeforeConfidence: number;
  scores: WalletAlphaV3Scores;
  rawMetrics: WalletAlphaV3RawMetrics;
  confidenceLevel: ConfidenceLevel;
  confidenceFactor: number;
  scoreBreakdown: WalletAlphaV3ScoreBreakdown;
  explanations: string[];
  warnings: string[];
};

export type WalletAlphaV3ScoreBreakdown = {
  mainFormula: {
    rawScore: number;
    rawBase: number;
    dexSkillBonus: number;
    strongSeparationBonus: number;
    eliteSeparationBonus: number;
    loserPatternPenalty: number;
    lowConfidenceLuckyPenalty: number;
    rawAfterAdjustments: number;
    confidenceModifier: number;
    confidenceFactor: number;
    finalScore: number;
    tier: string;
    weights: Record<string, number>;
  };
  entryDisciplineV3: ScoreBreakdownSection;
  exitDisciplineV3: ScoreBreakdownSection;
  winRateQualityV3: ScoreBreakdownSection;
  consistencyV3: ScoreBreakdownSection;
  positionDisciplineV3: ScoreBreakdownSection;
  rotationQualityV3: ScoreBreakdownSection;
  walletEvolutionV3: ScoreBreakdownSection;
  riskHygieneV3: ScoreBreakdownSection;
  dataConfidenceV3: ScoreBreakdownSection;
  dexLoserPatternPenalty: {
    applied: boolean;
    penalty: number;
    reason: string;
    components: Record<string, unknown>;
  };
};

type ScoreBreakdownSection = {
  score: number;
  formula: string;
  components: Record<string, unknown>;
  reason: string;
  source?: string;
};

const DEFAULT_WALLET_MAX_PAGES = 25;
const DEFAULT_WALLET_MAX_ACTIVITIES = 5000;
const DEFAULT_MAX_TOKENS = 50;
const DEFAULT_INTERVAL: KlineInterval = "1h";
const DEFAULT_CONCURRENCY = 2;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function firstString(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = asString(record[key]);
    if (value) return value;
  }

  return null;
}

function firstNumber(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = asNumber(record[key]);
    if (value !== null) return value;
  }

  return null;
}

function nestedRecord(record: UnknownRecord, key: string) {
  const value = record[key];
  return isRecord(value) ? value : null;
}

function firstNestedString(record: UnknownRecord, paths: [string, string][]) {
  for (const [parentKey, childKey] of paths) {
    const parent = nestedRecord(record, parentKey);
    if (!parent) continue;
    const value = asString(parent[childKey]);
    if (value) return value;
  }

  return null;
}

function timestampIso(activity: GMGNActivity, raw: UnknownRecord) {
  const value =
    activity.timestamp ??
    raw.timestamp ??
    raw.timestamp_unix ??
    raw.timestampUnix ??
    raw.time ??
    raw.block_time ??
    raw.blockTime;

  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 9_999_999_999 ? value : value * 1000;
    return new Date(ms).toISOString();
  }

  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    const parsed = Number.isFinite(numeric)
      ? numeric > 9_999_999_999
        ? numeric
        : numeric * 1000
      : Date.parse(value);

    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }

  return null;
}

function activityEventType(activity: GMGNActivity, raw: UnknownRecord) {
  const value = (
    firstString(raw, ["event_type", "eventType", "side", "type", "event"]) ||
    activity.type ||
    ""
  ).toLowerCase();

  if (value === "buy" || value.includes("buy")) return "buy";
  if (value === "sell" || value.includes("sell")) return "sell";
  if (value === "transfer" || value.includes("transfer")) return "transfer";
  return "unknown";
}

function gmgnActivityToWalletTrade({
  chain,
  wallet,
  activity,
}: {
  chain: string;
  wallet: string;
  activity: GMGNActivity;
}): WalletTrade {
  const raw = isRecord(activity.raw) ? activity.raw : {};
  const tokenAddress =
    firstNestedString(raw, [["token", "address"], ["base_token", "address"]]) ||
    firstString(raw, [
      "token_address",
      "tokenAddress",
      "base_address",
      "baseAddress",
      "contract_address",
    ]) ||
    activity.tokenAddress;

  return {
    wallet,
    chain,
    txHash:
      firstString(raw, ["tx_hash", "txHash", "hash", "transaction_hash"]) ||
      activity.txHash,
    timestamp: timestampIso(activity, raw),
    eventType: activityEventType(activity, raw),
    tokenAddress,
    tokenSymbol:
      firstNestedString(raw, [["token", "symbol"], ["base_token", "symbol"]]) ||
      firstString(raw, ["token_symbol", "tokenSymbol", "symbol"]) ||
      activity.tokenSymbol,
    tokenTotalSupply:
      firstNestedString(raw, [["token", "total_supply"], ["base_token", "total_supply"]]) ||
      firstNumber(raw, ["token_total_supply", "tokenTotalSupply", "total_supply", "totalSupply"]),
    tokenAmount:
      firstNumber(raw, ["token_amount", "tokenAmount", "amount", "base_amount", "baseAmount"]) ??
      activity.amount,
    costUsd:
      firstNumber(raw, ["cost_usd", "costUsd", "amount_usd", "amountUsd", "value_usd", "valueUsd", "usd"]) ??
      activity.valueUsd,
    buyCostUsd: firstNumber(raw, ["buy_cost_usd", "buyCostUsd", "buy_cost", "buyCost"]),
    priceUsd:
      firstNumber(raw, ["price_usd", "priceUsd", "usd_price", "usdPrice", "price"]),
    quoteAmount: firstNumber(raw, ["quote_amount", "quoteAmount"]),
    quoteSymbol: firstString(raw, ["quote_symbol", "quoteSymbol"]),
    gasUsd: firstNumber(raw, ["gas_usd", "gasUsd"]),
    dexUsd: firstNumber(raw, ["dex_usd", "dexUsd"]),
    launchpad: firstString(raw, ["launchpad"]),
  };
}

function capInteger(value: number | undefined, defaultValue: number, max: number) {
  if (!value || !Number.isInteger(value) || value < 1) return defaultValue;
  return Math.min(value, max);
}

export function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function round(value: number, decimals = 4) {
  return Number(value.toFixed(decimals));
}

function linearScore(value: number | null, points: Array<[number, number]>, fallback = 50) {
  if (value === null || !Number.isFinite(value)) return fallback;
  const sorted = [...points].sort((a, b) => a[0] - b[0]);

  if (value <= sorted[0][0]) return sorted[0][1];

  for (let i = 1; i < sorted.length; i += 1) {
    const [upperValue, upperScore] = sorted[i];
    const [lowerValue, lowerScore] = sorted[i - 1];
    if (value <= upperValue) {
      const span = upperValue - lowerValue;
      const progress = span === 0 ? 0 : (value - lowerValue) / span;
      return lowerScore + (upperScore - lowerScore) * progress;
    }
  }

  return sorted[sorted.length - 1][1];
}

function profitFactorScore(value: number | null) {
  if (value === null) return 50;
  if (value >= 5) return 92;
  if (value >= 3) return 84;
  if (value >= 2) return 76;
  if (value >= 1.5) return 68;
  if (value >= 1.2) return 60;
  if (value >= 1) return 52;
  if (value >= 0.8) return 42;
  if (value >= 0.5) return 28;
  return 15;
}

function medianMultipleScore(value: number | null) {
  if (value === null) return 50;
  if (value >= 3) return 90;
  if (value >= 2) return 82;
  if (value >= 1.5) return 74;
  if (value >= 1.2) return 66;
  if (value >= 1) return 56;
  if (value >= 0.85) return 45;
  if (value >= 0.6) return 30;
  return 15;
}

function uniqueTokens(trades: WalletTrade[]) {
  return new Set(
    trades
      .map((trade) => trade.tokenAddress?.toLowerCase())
      .filter((token): token is string => Boolean(token))
  ).size;
}

function adjustedWinRate(metrics: TradeHistoryMetrics) {
  const total = metrics.totalWinningTrades + metrics.totalLosingTrades;
  if (total === 0) return null;
  return round((metrics.totalWinningTrades + 5) / (total + 10), 4);
}

function rawWinRate(metrics: TradeHistoryMetrics) {
  const total = metrics.totalWinningTrades + metrics.totalLosingTrades;
  if (total === 0) return null;
  return round((metrics.totalWinningTrades / total) * 100, 2);
}

function singleWinnerDominance(trades: CompletedTrade[]) {
  const winningProfits = trades
    .map((trade) => Math.max(0, trade.realizedPnlUsd))
    .filter((value) => value > 0);
  const totalWinningProfit = winningProfits.reduce((sum, value) => sum + value, 0);
  if (totalWinningProfit <= 0 || winningProfits.length < 2) return null;
  return round(Math.max(...winningProfits) / totalWinningProfit, 4);
}

function lossSeverity(metrics: TradeHistoryMetrics) {
  if (metrics.avgLosingMultiple === null) return null;
  return round(Math.max(0, 1 - metrics.avgLosingMultiple), 4);
}

function winnerPowerScore(value: number | null) {
  if (value === null) return 40;
  if (value >= 20) return 98;
  if (value >= 10) return 92;
  if (value >= 5) return 84;
  if (value >= 3) return 74;
  if (value >= 2) return 64;
  if (value >= 1.5) return 54;
  return 40;
}

function repeatWinnerScore(metrics: TradeHistoryMetrics, completedTrades: CompletedTrade[]) {
  const winner2xCount = completedTrades.filter((trade) => trade.realizedMultiple >= 2).length;
  const winner2xRate = metrics.totalCompletedTrades > 0 ? winner2xCount / metrics.totalCompletedTrades : 0;
  let score =
    winner2xCount >= 25
      ? 92
      : winner2xCount >= 15
      ? 84
      : winner2xCount >= 10
      ? 76
      : winner2xCount >= 5
      ? 66
      : winner2xCount >= 3
      ? 56
      : winner2xCount >= 1
      ? 42
      : 25;

  if (winner2xRate >= 0.25) score += 8;
  else if (winner2xRate >= 0.15) score += 5;
  else if (winner2xRate < 0.05) score -= 8;

  return {
    score: clampScore(score),
    winner2xCount,
    winner2xRate: round(winner2xRate, 4),
    source: "direct-realized-multiple-count",
  };
}

function sampleReliabilityScore({
  coveredHistoricalTradeCount,
  historicalTokenCount,
}: {
  coveredHistoricalTradeCount: number;
  historicalTokenCount: number;
}) {
  const tradePart = Math.max(0, Math.min(100, (coveredHistoricalTradeCount / 120) * 100));
  const tokenPart = Math.max(0, Math.min(100, (historicalTokenCount / 30) * 100));
  return tradePart * 0.65 + tokenPart * 0.35;
}

function singleWinnerDexPenalty(dominance: number | null, metrics: TradeHistoryMetrics) {
  const inferred =
    dominance ??
    (metrics.maxWinnerMultiple !== null &&
    metrics.avgWinningMultiple !== null &&
    metrics.avgWinningMultiple > 0 &&
    metrics.totalWinningTrades >= 2
      ? Math.min(1, metrics.maxWinnerMultiple / (metrics.avgWinningMultiple * metrics.totalWinningTrades))
      : null);

  if (inferred === null) return 0;
  if (inferred >= 0.7) return -22;
  if (inferred >= 0.5) return -14;
  if (inferred >= 0.35) return -7;
  return 0;
}

function scoreWinRateQualityV3(metrics: TradeHistoryMetrics): ScoreBreakdownSection {
  const adjusted = adjustedWinRate(metrics);
  const bayesianWinScore = adjusted === null ? 50 : adjusted * 100;
  const pfScore = profitFactorScore(metrics.profitFactor);
  const medianScore = medianMultipleScore(metrics.medianRealizedMultiple);
  const powerScore = winnerPowerScore(metrics.avgWinningMultiple);
  const score =
    bayesianWinScore * 0.3 +
    pfScore * 0.32 +
    medianScore * 0.23 +
    powerScore * 0.15;

  return {
    score: clampScore(score),
    formula: "0.30 * bayesianWinScore + 0.32 * profitFactorScore + 0.23 * medianMultipleScore + 0.15 * winnerPowerScore",
    components: {
      adjustedWinRate: adjusted,
      bayesianWinScore: round(bayesianWinScore, 2),
      profitFactorScore: round(pfScore, 2),
      medianMultipleScore: round(medianScore, 2),
      winnerPowerScore: round(powerScore, 2),
    },
    reason: "DEX win quality rewards repeatable profitability and winner power, not raw win rate alone.",
  };
}

function scoreConsistencyV3({
  metrics,
  completedTrades,
  dominance,
  coveredHistoricalTradeCount,
  historicalTokenCount,
}: {
  metrics: TradeHistoryMetrics;
  completedTrades: CompletedTrade[];
  dominance: number | null;
  coveredHistoricalTradeCount: number;
  historicalTokenCount: number;
}): ScoreBreakdownSection {
  const medianScore = medianMultipleScore(metrics.medianRealizedMultiple);
  const pfScore = profitFactorScore(metrics.profitFactor);
  const repeatScore = repeatWinnerScore(metrics, completedTrades);
  const lossSeverityValue = lossSeverity(metrics);
  const lossScore = lossSeverityValue === null ? 55 : Math.max(0, Math.min(100, 100 - lossSeverityValue * 100));
  const sampleScore = sampleReliabilityScore({
    coveredHistoricalTradeCount,
    historicalTokenCount,
  });
  const dominancePenalty = singleWinnerDexPenalty(dominance, metrics);
  let score =
    medianScore * 0.25 +
    pfScore * 0.27 +
    repeatScore.score * 0.24 +
    lossScore * 0.14 +
    sampleScore * 0.1 +
    dominancePenalty;

  let consistencyFloorApplied: number | null = null;
  if (
    metrics.profitFactor !== null &&
    metrics.profitFactor >= 3 &&
    coveredHistoricalTradeCount >= 100 &&
    repeatScore.winner2xCount >= 15 &&
    score < 78
  ) {
    score = 78;
    consistencyFloorApplied = 78;
  } else if (
    metrics.profitFactor !== null &&
    metrics.profitFactor >= 2 &&
    coveredHistoricalTradeCount >= 80 &&
    repeatScore.winner2xCount >= 12 &&
    score < 72
  ) {
    score = 72;
    consistencyFloorApplied = 72;
  } else if (
    metrics.profitFactor !== null &&
    metrics.profitFactor >= 1.5 &&
    coveredHistoricalTradeCount >= 50 &&
    repeatScore.winner2xCount >= 8 &&
    score < 65
  ) {
    score = 65;
    consistencyFloorApplied = 65;
  }

  return {
    score: clampScore(score),
    formula: "0.25 * medianMultipleScore + 0.27 * profitFactorScore + 0.24 * repeatWinnerScore + 0.14 * lossControlScore + 0.10 * sampleReliabilityScore + singleWinnerDominancePenalty",
    components: {
      medianMultipleScore: round(medianScore, 2),
      profitFactorScore: round(pfScore, 2),
      repeatWinnerScore: round(repeatScore.score, 2),
      repeatWinnerSource: repeatScore.source,
      winner2xCount: repeatScore.winner2xCount,
      winner2xRate: repeatScore.winner2xRate,
      lossControlScore: round(lossScore, 2),
      sampleReliabilityScore: round(sampleScore, 2),
      singleWinnerDominancePenalty: dominancePenalty,
      consistencyFloorApplied,
    },
    reason: "DEX consistency measures repeated asymmetric winners while penalizing one-trade dominance and poor loss control.",
  };
}

function scorePositionDisciplineV3({
  metrics,
  historicalMissedUpside,
  historicalRealizedMultiple,
}: {
  metrics: TradeHistoryMetrics;
  historicalMissedUpside: number | null;
  historicalRealizedMultiple: number | null;
}): ScoreBreakdownSection {
  const medianMultiple = metrics.medianRealizedMultiple;
  const medianHold = metrics.medianHoldSeconds;
  const averageHold = metrics.avgHoldSeconds;
  const profitAdjustedHoldScore =
    medianMultiple === null || medianHold === null
      ? 45
      : medianMultiple >= 2 && medianHold >= 3600 && medianHold <= 1_814_400
      ? 75
      : medianMultiple >= 1.2 && medianHold >= 3600 && medianHold <= 1_209_600
      ? 65
      : medianMultiple < 1 && medianHold > 1_209_600
      ? 25
      : medianMultiple < 1 && medianHold > 604_800
      ? 35
      : 45;
  const panicSellAvoidanceScore =
    medianMultiple === null || medianHold === null
      ? 55
      : medianHold < 600 && medianMultiple < 1
      ? 20
      : medianHold < 3600 && medianMultiple < 1
      ? 35
      : 55;
  const bagholderAvoidanceScore =
    medianMultiple === null || averageHold === null
      ? 55
      : medianMultiple < 0.8 && averageHold > 1_209_600
      ? 20
      : medianMultiple < 1 && averageHold > 604_800
      ? 35
      : 55;
  const convictionRewardScore =
    historicalRealizedMultiple === null || averageHold === null
      ? 50
      : historicalRealizedMultiple >= 10 && averageHold > 86_400
      ? 80
      : historicalRealizedMultiple >= 5 && averageHold > 86_400
      ? 75
      : historicalRealizedMultiple >= 2 && averageHold > 43_200
      ? 65
      : 50;
  let missedUpsideAdjustment = 0;
  if (historicalMissedUpside !== null) {
    if (historicalMissedUpside >= 10) missedUpsideAdjustment = -6;
    else if (historicalMissedUpside >= 5) missedUpsideAdjustment = -3;
  }
  const score =
    profitAdjustedHoldScore * 0.35 +
    panicSellAvoidanceScore * 0.25 +
    bagholderAvoidanceScore * 0.25 +
    convictionRewardScore * 0.15 +
    missedUpsideAdjustment;

  return {
    score: clampScore(score),
    formula: "0.35 * profitAdjustedHoldScore + 0.25 * panicSellAvoidanceScore + 0.25 * bagholderAvoidanceScore + 0.15 * convictionRewardScore + missedUpsideAdjustment",
    components: {
      profitAdjustedHoldScore,
      panicSellAvoidanceScore,
      bagholderAvoidanceScore,
      convictionRewardScore,
      missedUpsideAdjustment,
    },
    reason: "Position discipline stays low-impact and rewards profit-adjusted hold behavior without blindly rewarding long holds.",
  };
}

function tradeFrequencyHealthScore({
  completedTradeCount,
  profitFactor,
}: {
  completedTradeCount: number;
  profitFactor: number | null;
}) {
  if (completedTradeCount > 150 && (profitFactor ?? 1) >= 1.2) return 65;
  if (completedTradeCount > 150 && (profitFactor ?? 1) < 0.8) return 35;
  if (completedTradeCount >= 20 && completedTradeCount <= 150) return 60;
  return 50;
}

function scoreRotationQualityV3({
  metrics,
  uniqueTokensTraded,
  entryDisciplineV3,
  winRateQualityV3,
}: {
  metrics: TradeHistoryMetrics;
  uniqueTokensTraded: number;
  entryDisciplineV3: number;
  winRateQualityV3: number;
}): ScoreBreakdownSection {
  const medianMultiple = metrics.medianRealizedMultiple;
  const medianScore = medianMultipleScore(medianMultiple);
  const powerScore = winnerPowerScore(metrics.avgWinningMultiple);
  const frequencyScore = tradeFrequencyHealthScore({
    completedTradeCount: metrics.totalCompletedTrades,
    profitFactor: metrics.profitFactor,
  });
  let spamLossPenalty = 0;
  let skilledRotationBonus = 0;

  if (uniqueTokensTraded >= 80 && (metrics.profitFactor ?? 1) < 0.8 && (medianMultiple ?? 1) < 1) spamLossPenalty = -20;
  else if (uniqueTokensTraded >= 50 && (metrics.profitFactor ?? 1) < 0.9) spamLossPenalty = -12;
  else if (uniqueTokensTraded >= 30 && (metrics.profitFactor ?? 1) < 0.75) spamLossPenalty = -8;

  if (uniqueTokensTraded >= 50 && (metrics.profitFactor ?? 0) >= 1.5 && (medianMultiple ?? 0) >= 1) skilledRotationBonus = 8;
  else if (uniqueTokensTraded >= 30 && (metrics.profitFactor ?? 0) >= 1.3 && (medianMultiple ?? 0) >= 1) skilledRotationBonus = 6;
  else if (uniqueTokensTraded >= 15 && (metrics.profitFactor ?? 0) >= 2) skilledRotationBonus = 5;

  const score =
    entryDisciplineV3 * 0.3 +
    winRateQualityV3 * 0.25 +
    medianScore * 0.18 +
    powerScore * 0.17 +
    frequencyScore * 0.1 +
    spamLossPenalty +
    skilledRotationBonus;

  return {
    score: clampScore(score),
    formula: "0.30 * entryDisciplineV3 + 0.25 * winRateQualityV3 + 0.18 * medianMultipleScore + 0.17 * winnerPowerScore + 0.10 * tradeFrequencyHealthScore + spamLossPenalty + skilledRotationBonus",
    components: {
      entryDisciplineV3,
      winRateQualityV3,
      medianMultipleScore: round(medianScore, 2),
      winnerPowerScore: round(powerScore, 2),
      tradeFrequencyHealthScore: frequencyScore,
      spamLossPenalty,
      skilledRotationBonus,
    },
    reason: "DEX rotation rewards skilled throughput and penalizes broad spray-and-pray losses.",
  };
}

function scoreWalletEvolutionV3(evolution: WalletEvolutionMetrics, warnings: string[]): ScoreBreakdownSection {
  let score = 50;
  const hasData =
    evolution.last30dPnl !== null ||
    evolution.previous30dPnl !== null ||
    evolution.last30dWinRate !== null ||
    evolution.previous30dWinRate !== null;

  if (!hasData) {
    warnings.push("Wallet evolution is neutral because insufficient 30-day comparison data was available.");
    return {
      score: 50,
      formula: "neutral fallback",
      components: {
        trendDirection: evolution.trendDirection,
      },
      reason: "Insufficient recent-vs-previous 30-day data was available.",
    };
  }

  if (evolution.trendDirection === "improving") score = 60;
  if (evolution.trendDirection === "stable") score = 50;
  if (evolution.trendDirection === "deteriorating") score = 40;

  if (evolution.previous30dPnl !== null && evolution.last30dPnl !== null) {
    if (evolution.last30dPnl > 0 && evolution.previous30dPnl < 0) score += 10;
    if (evolution.last30dPnl > evolution.previous30dPnl && evolution.last30dPnl > 0) score += 5;
    if (evolution.last30dPnl < 0) score = Math.min(score, 55);
  }

  if (evolution.last30dWinRate !== null && evolution.previous30dWinRate !== null) {
    if (evolution.last30dWinRate - evolution.previous30dWinRate >= 15) score += 5;
  }

  return {
    score: clampScore(score),
    formula: "trend base with positive-PnL improvement bonuses and negative-PnL caps",
    components: {
      trendDirection: evolution.trendDirection,
      last30dPnl: evolution.last30dPnl,
      previous30dPnl: evolution.previous30dPnl,
      last30dWinRate: evolution.last30dWinRate,
      previous30dWinRate: evolution.previous30dWinRate,
    },
    reason: "Evolution is a minor momentum signal; getting less bad while still negative is capped.",
  };
}

function scoreRiskHygieneV3({
  metrics,
  entryDisciplineV3,
  exitDisciplineV3,
}: {
  metrics: TradeHistoryMetrics;
  entryDisciplineV3: number;
  exitDisciplineV3: number;
}): ScoreBreakdownSection {
  let lossControlBonus = 0;
  let profitFactorBonus = 0;
  let exitQualityBonus = 0;
  let severeLossPenalty = 0;
  let repeatedLossPenalty = 0;
  let badEntryExitPenalty = 0;
  const severity = lossSeverity(metrics);

  if (severity !== null) {
    if (severity < 0.2) lossControlBonus = 12;
    else if (severity < 0.35) lossControlBonus = 7;
    else if (severity < 0.45) lossControlBonus = 4;

    if (severity > 0.75) severeLossPenalty = -25;
    else if (severity > 0.6) severeLossPenalty = -18;
    else if (severity > 0.45) severeLossPenalty = -10;
    else if (severity > 0.35) severeLossPenalty = -6;
  }

  if (metrics.profitFactor !== null) {
    if (metrics.profitFactor >= 3) profitFactorBonus = 14;
    else if (metrics.profitFactor >= 2) profitFactorBonus = 10;
    else if (metrics.profitFactor >= 1.3) profitFactorBonus = 5;
  }

  if (exitDisciplineV3 >= 75) exitQualityBonus = 10;
  else if (exitDisciplineV3 >= 65) exitQualityBonus = 7;
  else if (exitDisciplineV3 >= 60) exitQualityBonus = 5;

  if (
    metrics.totalLosingTrades >= metrics.totalWinningTrades * 1.5 &&
    metrics.totalCompletedTrades >= 30
  ) {
    repeatedLossPenalty = -12;
  } else if (metrics.totalLosingTrades > metrics.totalWinningTrades && metrics.totalCompletedTrades >= 30) {
    repeatedLossPenalty = -6;
  }

  if (entryDisciplineV3 < 35 && exitDisciplineV3 < 45) badEntryExitPenalty = -18;
  else if (entryDisciplineV3 < 40 && exitDisciplineV3 < 50) badEntryExitPenalty = -10;

  const score =
    50 +
    lossControlBonus +
    profitFactorBonus +
    exitQualityBonus +
    severeLossPenalty +
    repeatedLossPenalty +
    badEntryExitPenalty;

  return {
    score: clampScore(score),
    formula: "50 + lossControlBonus + profitFactorBonus + exitQualityBonus + severeLossPenalty + repeatedLossPenalty + badEntryExitPenalty",
    components: {
      lossControlBonus,
      profitFactorBonus,
      exitQualityBonus,
      severeLossPenalty,
      repeatedLossPenalty,
      badEntryExitPenalty,
      lossSeverity: severity,
    },
    reason: "Risk hygiene asks whether the wallet avoids repeated catastrophic DEX behavior.",
  };
}

function historicalCoverageRate(historical: WalletHistoricalEntryExitV3Result) {
  const total = historical.tokenBreakdown.reduce((sum, token) => sum + token.totalCompletedTrades, 0);
  if (total <= 0) return 0;
  return round((historical.historicalTradeCount / total) * 100, 2);
}

function scoreDataConfidenceV3({
  metrics,
  historical,
  activity,
}: {
  metrics: TradeHistoryMetrics;
  historical: WalletHistoricalEntryExitV3Result;
  activity: PaginatedGmgnWalletActivityResponse;
}): ScoreBreakdownSection {
  const tradeCount = historical.historicalTradeCount;
  const tokenCount = historical.historicalTokenCount;
  const coverageRate = historicalCoverageRate(historical);
  const failedTokenWarnings = historical.warnings.filter((warning) =>
    warning.includes("analysis failed")
  ).length;
  const tradeDepthScore = linearScore(
    tradeCount,
    [
      [0, 20],
      [5, 35],
      [10, 45],
      [25, 60],
      [50, 70],
      [75, 80],
      [100, 90],
      [150, 100],
    ],
    20
  );
  const tokenDiversityScore = linearScore(
    tokenCount,
    [
      [0, 20],
      [3, 35],
      [5, 50],
      [10, 65],
      [20, 80],
      [30, 90],
      [50, 100],
    ],
    20
  );
  const coverageQualityScore = linearScore(
    coverageRate,
    [
      [0, 20],
      [20, 35],
      [40, 50],
      [60, 70],
      [80, 85],
    ],
    20
  );
  let penalty = 0;
  if (activity.stoppedByPageLimit) penalty -= 5;
  if (activity.stoppedByActivityLimit) penalty -= 5;
  if (failedTokenWarnings >= Math.max(3, tokenCount * 0.35)) penalty -= 10;
  else if (failedTokenWarnings > 0) penalty -= 5;
  if (metrics.totalCompletedTrades > historical.historicalTradeCount && historical.historicalTradeCount === 0) {
    penalty -= 10;
  }
  const score =
    tradeDepthScore * 0.45 +
    tokenDiversityScore * 0.35 +
    coverageQualityScore * 0.2 +
    penalty;

  return {
    score: clampScore(score),
    formula: "0.45 * tradeDepthScore + 0.35 * tokenDiversityScore + 0.20 * coverageQualityScore + penalties",
    components: {
      tradeDepthScore: round(tradeDepthScore, 2),
      tokenDiversityScore: round(tokenDiversityScore, 2),
      coverageQualityScore: round(coverageQualityScore, 2),
      coverageRate,
      failedTokenWarnings,
      penalty,
      stoppedByPageLimit: activity.stoppedByPageLimit,
      stoppedByActivityLimit: activity.stoppedByActivityLimit,
    },
    reason: "High confidence requires broad covered trade depth across enough tokens with usable kline coverage.",
  };
}

function confidenceLevel(dataConfidenceV3: number): ConfidenceLevel {
  if (dataConfidenceV3 >= 80) return "high";
  if (dataConfidenceV3 >= 60) return "medium";
  return "low";
}

function confidenceFactor(level: ConfidenceLevel) {
  if (level === "high") return 1;
  if (level === "medium") return 0.97;
  return 0.88;
}

function walletAlphaTier(score: number) {
  if (score >= 80) return "elite";
  if (score >= 65) return "strong";
  if (score >= 55) return "good";
  if (score >= 45) return "average";
  if (score >= 25) return "weak";
  return "toxic";
}

function scoreEntryDisciplineV3(historical: WalletHistoricalEntryExitV3Result, warnings: string[]): ScoreBreakdownSection {
  if (historical.historicalEntryDiscipline !== null) {
    const entryBase = historical.historicalEntryDiscipline;
    let entryLift = 0;
    let eliteEntryLift = 0;
    const realized = historical.historicalRealizedMultiple;
    if (realized !== null && entryBase >= 45) {
      if (realized >= 20) entryLift = 10;
      else if (realized >= 10) entryLift = 8;
      else if (realized >= 5) entryLift = 6;
      else if (realized >= 2) entryLift = 4;
      else if (realized >= 1.2) entryLift = 2;
    }

    if (entryBase >= 80 && historical.historicalTradeCount >= 30 && historical.historicalTokenCount >= 8) {
      eliteEntryLift = 4;
    } else if (entryBase >= 70 && historical.historicalTradeCount >= 50 && historical.historicalTokenCount >= 15) {
      eliteEntryLift = 3;
    }

    const score = Math.max(0, Math.min(100, entryBase + entryLift + eliteEntryLift));

    return {
      score: clampScore(score),
      source: "wallet-historical-entry-exit-v3",
      formula: "historicalEntryDiscipline + realized outcome lift when base entry >= 45 + early-entry evidence lift",
      components: {
        entryBase,
        historicalRealizedMultiple: realized,
        entryLift,
        evidenceLift: eliteEntryLift,
        coveredHistoricalTradeCount: historical.historicalTradeCount,
        historicalTokenCount: historical.historicalTokenCount,
      },
      reason: "Historical Entry/Exit V3 provides token-level peak context; realized upside supports moderate-or-better entries without rescuing truly poor entries.",
    };
  }

  warnings.push("Historical Entry Discipline V3 was unavailable; neutral entry score was used.");
  return {
    score: 50,
    source: "neutral-fallback",
    formula: "neutral fallback",
    components: {},
    reason: "Historical Entry Discipline V3 was unavailable.",
  };
}

function scoreExitDisciplineV3(historical: WalletHistoricalEntryExitV3Result, warnings: string[]): ScoreBreakdownSection {
  if (historical.historicalExitDiscipline !== null) {
    const exitBase = historical.historicalExitDiscipline;
    let exitLift = 0;
    let missedPenalty = 0;
    let peakBonus = 0;
    const realized = historical.historicalRealizedMultiple;
    if (realized !== null) {
      if (realized >= 20) exitLift = 16;
      else if (realized >= 10) exitLift = 13;
      else if (realized >= 5) exitLift = 10;
      else if (realized >= 2) exitLift = 6;
      else if (realized >= 1.25) exitLift = 3;
    }

    if (historical.historicalMissedUpside !== null) {
      if (historical.historicalMissedUpside >= 15) missedPenalty = -10;
      else if (historical.historicalMissedUpside >= 10) missedPenalty = -7;
      else if (historical.historicalMissedUpside >= 5) missedPenalty = -4;
      else if (historical.historicalMissedUpside >= 3) missedPenalty = -2;
    }

    if (historical.historicalPeakCapture !== null) {
      if (historical.historicalPeakCapture >= 0.7) peakBonus = 10;
      else if (historical.historicalPeakCapture >= 0.5) peakBonus = 7;
      else if (historical.historicalPeakCapture >= 0.35) peakBonus = 4;
      else if (historical.historicalPeakCapture >= 0.25) peakBonus = 2;
    }

    const score = Math.max(0, Math.min(100, exitBase + exitLift + peakBonus + missedPenalty));

    return {
      score: clampScore(score),
      source: "wallet-historical-entry-exit-v3",
      formula: "historicalExitDiscipline + realized multiple lift + peak capture bonus + missed upside penalty",
      components: {
        exitBase,
        historicalRealizedMultiple: realized,
        historicalPeakCapture: historical.historicalPeakCapture,
        historicalMissedUpside: historical.historicalMissedUpside,
        exitLift,
        peakBonus,
        missedPenalty,
      },
      reason: "A strong DEX exit can be good even if it misses the absolute top, but repeated early exits still limit the score.",
    };
  }

  warnings.push("Historical Exit Discipline V3 was unavailable; neutral exit score was used.");
  return {
    score: 50,
    source: "neutral-fallback",
    formula: "neutral fallback",
    components: {},
    reason: "Historical Exit Discipline V3 was unavailable.",
  };
}

function explanations({
  scores,
  rawMetrics,
  confidenceLevelValue,
  dexLoserPatternPenalty,
}: {
  scores: WalletAlphaV3Scores;
  rawMetrics: WalletAlphaV3RawMetrics;
  confidenceLevelValue: ConfidenceLevel;
  dexLoserPatternPenalty: number;
}) {
  const rows = [
    "Wallet Alpha V3.2 uses DEX quality-calibrated historical Entry/Exit V3 across all covered traded tokens.",
  ];

  if (scores.entryDisciplineV3 >= 80) {
    rows.push("Entry quality is elite because the wallet historically enters far before major upside.");
  } else if (scores.entryDisciplineV3 >= 60) {
    rows.push("Entry quality is good because the wallet historically enters before meaningful upside.");
  } else if (scores.entryDisciplineV3 <= 35) {
    rows.push("Entry quality is weak because covered historical entries were late relative to later peaks.");
  }

  if (scores.exitDisciplineV3 >= 70) {
    rows.push("Exit quality is strong because covered exits captured meaningful realized upside.");
  } else if (scores.exitDisciplineV3 >= 40) {
    rows.push("Exit quality is mixed because realized exits and missed-upside control are uneven.");
  } else {
    rows.push("Exit quality is weak because peak capture is low, missed upside is high, or realized exits were poor.");
  }

  if (rawMetrics.singleWinnerDominance !== null && rawMetrics.singleWinnerDominance > 0.65) {
    rows.push("Consistency was reduced because one winner dominates realized performance.");
  }

  if (dexLoserPatternPenalty < 0) {
    rows.push("DEX loser pattern penalty applied because the wallet trades many tokens while showing weak entry, weak exit, poor profit factor, and sub-1 median multiple.");
  }

  if (
    rawMetrics.averageRealizedMultiple !== null &&
    rawMetrics.medianRealizedMultiple !== null &&
    rawMetrics.medianRealizedMultiple > 0 &&
    rawMetrics.averageRealizedMultiple / rawMetrics.medianRealizedMultiple > 10
  ) {
    rows.push("Average realized multiple is dominated by outliers; median multiple was preferred for scoring.");
    rows.push("Average realized multiple was not used as a primary scoring driver because it is dominated by outliers.");
  }

  rows.push(
    `Confidence is ${confidenceLevelValue} because ${rawMetrics.coveredHistoricalTradeCount} covered trades across ${rawMetrics.historicalTokenCount} token(s) were analyzed.`
  );

  return rows;
}

function rawMetricsFrom({
  activity,
  trades,
  completedTrades,
  metrics,
  evolution,
  historical,
  dominance,
}: {
  activity: PaginatedGmgnWalletActivityResponse;
  trades: WalletTrade[];
  completedTrades: CompletedTrade[];
  metrics: TradeHistoryMetrics;
  evolution: WalletEvolutionMetrics;
  historical: WalletHistoricalEntryExitV3Result;
  dominance: number | null;
}): WalletAlphaV3RawMetrics {
  const buyCount = trades.filter((trade) => trade.eventType === "buy").length;
  const sellCount = trades.filter((trade) => trade.eventType === "sell").length;
  const adjusted = adjustedWinRate(metrics);
  const completedTradeCount = completedTrades.length;
  const uniqueTokensTraded = uniqueTokens(trades);

  return {
    activityCount: activity.count,
    completedTradeCount,
    coveredHistoricalTradeCount: historical.historicalTradeCount,
    historicalTokenCount: historical.historicalTokenCount,
    uniqueTokensTraded,
    buyCount,
    sellCount,
    adjustedWinRate: adjusted,
    rawWinRate: rawWinRate(metrics),
    totalWinningTrades: metrics.totalWinningTrades,
    totalLosingTrades: metrics.totalLosingTrades,
    averageRealizedMultiple: metrics.avgRealizedMultiple ?? historical.historicalRealizedMultiple,
    medianRealizedMultiple: metrics.medianRealizedMultiple,
    averageWinnerMultiple: metrics.avgWinningMultiple,
    averageLoserMultiple: metrics.avgLosingMultiple,
    profitFactor: metrics.profitFactor,
    historicalEntryDiscipline: historical.historicalEntryDiscipline,
    historicalExitDiscipline: historical.historicalExitDiscipline,
    historicalPeakCapture: historical.historicalPeakCapture,
    historicalMissedUpside: historical.historicalMissedUpside,
    averageHoldSeconds: metrics.avgHoldSeconds ?? historical.historicalAverageHold,
    medianHoldSeconds: metrics.medianHoldSeconds,
    singleWinnerDominance: dominance,
    lossSeverity: lossSeverity(metrics),
    rotationDensity: round(uniqueTokensTraded / Math.max(completedTradeCount, 1), 4),
    trendDirection: evolution.trendDirection,
    last30dPnl: evolution.last30dPnl,
    previous30dPnl: evolution.previous30dPnl,
    last30dWinRate: evolution.last30dWinRate,
    previous30dWinRate: evolution.previous30dWinRate,
  };
}

export async function computeWalletAlphaV3({
  chain,
  wallet,
  options = {},
}: {
  chain: string;
  wallet: string;
  options?: WalletAlphaV3Options;
}): Promise<WalletAlphaV3Result> {
  const walletMaxPages = capInteger(options.walletMaxPages, DEFAULT_WALLET_MAX_PAGES, 50);
  const walletMaxActivities = capInteger(options.walletMaxActivities, DEFAULT_WALLET_MAX_ACTIVITIES, 5000);
  const maxTokens = capInteger(options.maxTokens, DEFAULT_MAX_TOKENS, 100);
  const interval = options.interval ?? DEFAULT_INTERVAL;
  const concurrency = capInteger(options.concurrency, DEFAULT_CONCURRENCY, 5);
  const warnings: string[] = [];
  const activity = await fetchGmgnWalletActivityPaginated({
    chain,
    wallet,
    limitPerPage: 100,
    historyMode: "full",
    hardMaxPages: walletMaxPages,
    maxActivities: walletMaxActivities,
  });
  const trades = activity.activities.map((item) =>
    gmgnActivityToWalletTrade({ chain, wallet, activity: item })
  );
  const completedTrades = buildCompletedTrades(trades);
  const metrics = buildTradeHistoryMetrics(completedTrades);
  const evolution = buildWalletEvolutionMetrics(completedTrades);
  const historical = await analyzeWalletHistoricalEntryExitV3({
    chain,
    wallet,
    options: {
      walletMaxPages,
      walletMaxActivities,
      maxTokens,
      interval,
      concurrency,
    },
  });
  const dominance = singleWinnerDominance(completedTrades);

  if (activity.stoppedByPageLimit) warnings.push("Wallet activity stopped by page limit.");
  if (activity.stoppedByActivityLimit) warnings.push("Wallet activity stopped by activity limit.");
  if (activity.stoppedByTimeout) warnings.push("Wallet activity stopped by timeout.");
  warnings.push(...historical.warnings);

  if (
    metrics.avgRealizedMultiple !== null &&
    metrics.medianRealizedMultiple !== null &&
    metrics.medianRealizedMultiple > 0 &&
    metrics.avgRealizedMultiple / metrics.medianRealizedMultiple > 10
  ) {
    warnings.push("Average realized multiple is dominated by outliers; median multiple was preferred for scoring.");
  }

  const entryDisciplineBreakdown = scoreEntryDisciplineV3(historical, warnings);
  const entryDisciplineV3 = entryDisciplineBreakdown.score;
  const exitDisciplineBreakdown = scoreExitDisciplineV3(historical, warnings);
  const exitDisciplineV3 = exitDisciplineBreakdown.score;
  const winRateQualityBreakdown = scoreWinRateQualityV3(metrics);
  const winRateQualityV3 = winRateQualityBreakdown.score;
  const consistencyBreakdown = scoreConsistencyV3({
    metrics,
    completedTrades,
    dominance,
    coveredHistoricalTradeCount: historical.historicalTradeCount,
    historicalTokenCount: historical.historicalTokenCount,
  });
  const consistencyV3 = consistencyBreakdown.score;
  const positionDisciplineBreakdown = scorePositionDisciplineV3({
    metrics,
    historicalMissedUpside: historical.historicalMissedUpside,
    historicalRealizedMultiple: historical.historicalRealizedMultiple,
  });
  const positionDisciplineV3 = positionDisciplineBreakdown.score;
  const holdDisciplineV3 = positionDisciplineV3;
  const rotationQualityBreakdown = scoreRotationQualityV3({
    metrics,
    uniqueTokensTraded: uniqueTokens(trades),
    entryDisciplineV3,
    winRateQualityV3,
  });
  const rotationQualityV3 = rotationQualityBreakdown.score;
  const walletEvolutionBreakdown = scoreWalletEvolutionV3(evolution, warnings);
  const walletEvolutionV3 = walletEvolutionBreakdown.score;
  const riskHygieneBreakdown = scoreRiskHygieneV3({
    metrics,
    entryDisciplineV3,
    exitDisciplineV3,
  });
  const riskHygieneV3 = riskHygieneBreakdown.score;
  const dataConfidenceBreakdown = scoreDataConfidenceV3({
    metrics,
    historical,
    activity,
  });
  const dataConfidenceV3 = dataConfidenceBreakdown.score;
  const level = confidenceLevel(dataConfidenceV3);
  const factor = confidenceFactor(level);
  const uniqueTokensTraded = uniqueTokens(trades);
  const rawBase =
    entryDisciplineV3 * 0.24 +
    exitDisciplineV3 * 0.18 +
    consistencyV3 * 0.18 +
    winRateQualityV3 * 0.12 +
    rotationQualityV3 * 0.1 +
    riskHygieneV3 * 0.08 +
    positionDisciplineV3 * 0.06 +
    walletEvolutionV3 * 0.04;
  let dexSkillBonus = 0;

  if (level !== "low" && entryDisciplineV3 >= 80 && exitDisciplineV3 >= 65) dexSkillBonus += 4;
  if (level !== "low" && consistencyV3 >= 65 && winRateQualityV3 >= 55) dexSkillBonus += 4;
  if (
    level !== "low" &&
    (metrics.profitFactor ?? 0) >= 1.5 &&
    (metrics.medianRealizedMultiple ?? 0) >= 1 &&
    historical.historicalTradeCount >= 50
  ) dexSkillBonus += 4;
  if (
    level !== "low" &&
    (metrics.profitFactor ?? 0) >= 2 &&
    historical.historicalTradeCount >= 80 &&
    historical.historicalTokenCount >= 15
  ) dexSkillBonus += 4;
  dexSkillBonus = Math.min(12, dexSkillBonus);

  const strongSeparationBonus =
    level !== "low" &&
    entryDisciplineV3 >= 70 &&
    consistencyV3 >= 60 &&
    rotationQualityV3 >= 60 &&
    (metrics.profitFactor ?? 0) >= 1.1 &&
    historical.historicalTradeCount >= 30
      ? 4
      : 0;
  const eliteSeparationBonus =
    level === "high" &&
    entryDisciplineV3 >= 85 &&
    exitDisciplineV3 >= 70 &&
    consistencyV3 >= 72 &&
    winRateQualityV3 >= 65 &&
    (metrics.profitFactor ?? 0) >= 2 &&
    historical.historicalTradeCount >= 80 &&
    historical.historicalTokenCount >= 15
      ? 6
      : 0;

  let loserPatternPenalty = 0;
  if (
    metrics.totalCompletedTrades >= 50 &&
    uniqueTokensTraded >= 50 &&
    entryDisciplineV3 < 40 &&
    exitDisciplineV3 < 45 &&
    (metrics.profitFactor ?? 1) < 0.8 &&
    (metrics.medianRealizedMultiple ?? 1) < 1
  ) {
    loserPatternPenalty = -15;
  } else if (
    metrics.totalCompletedTrades >= 30 &&
    entryDisciplineV3 < 45 &&
    (metrics.profitFactor ?? 1) < 0.8 &&
    (metrics.medianRealizedMultiple ?? 1) < 1
  ) {
    loserPatternPenalty = -8;
  }

  let lowConfidenceLuckyPenalty = 0;
  if (level === "low" && historical.historicalTradeCount < 10 && rawBase > 60) {
    lowConfidenceLuckyPenalty = -12;
  }

  const rawAfterAdjustments = Math.max(
    0,
    Math.min(
      100,
      rawBase +
        dexSkillBonus +
        strongSeparationBonus +
        eliteSeparationBonus +
        loserPatternPenalty +
        lowConfidenceLuckyPenalty
    )
  );
  let walletAlphaV3 = clampScore(rawAfterAdjustments * factor);
  let finalCap: number | null = null;

  if (level === "low" && historical.historicalTradeCount < 10) {
    finalCap = 54;
    walletAlphaV3 = Math.min(walletAlphaV3, finalCap);
  } else if (level === "low" && rawAfterAdjustments >= 70) {
    finalCap = 64;
    walletAlphaV3 = Math.min(walletAlphaV3, finalCap);
  }

  const scores = {
    consistencyV3,
    entryDisciplineV3,
    exitDisciplineV3,
    winRateQualityV3,
    positionDisciplineV3,
    holdDisciplineV3,
    rotationQualityV3,
    walletEvolutionV3,
    riskHygieneV3,
    dataConfidenceV3,
  };
  const rawMetrics = rawMetricsFrom({
    activity,
    trades,
    completedTrades,
    metrics,
    evolution,
    historical,
    dominance,
  });
  const scoreBreakdown: WalletAlphaV3ScoreBreakdown = {
    mainFormula: {
      rawScore: round(rawAfterAdjustments, 2),
      rawBase: round(rawBase, 2),
      dexSkillBonus,
      strongSeparationBonus,
      eliteSeparationBonus,
      loserPatternPenalty,
      lowConfidenceLuckyPenalty,
      rawAfterAdjustments: round(rawAfterAdjustments, 2),
      confidenceModifier: factor,
      confidenceFactor: factor,
      finalScore: walletAlphaV3,
      tier: walletAlphaTier(walletAlphaV3),
      weights: {
        entryDisciplineV3: 0.24,
        exitDisciplineV3: 0.18,
        consistencyV3: 0.18,
        winRateQualityV3: 0.12,
        rotationQualityV3: 0.1,
        riskHygieneV3: 0.08,
        positionDisciplineV3: 0.06,
        walletEvolutionV3: 0.04,
      },
    },
    entryDisciplineV3: entryDisciplineBreakdown,
    exitDisciplineV3: exitDisciplineBreakdown,
    winRateQualityV3: winRateQualityBreakdown,
    consistencyV3: consistencyBreakdown,
    positionDisciplineV3: positionDisciplineBreakdown,
    rotationQualityV3: rotationQualityBreakdown,
    walletEvolutionV3: walletEvolutionBreakdown,
    riskHygieneV3: riskHygieneBreakdown,
    dataConfidenceV3: dataConfidenceBreakdown,
    dexLoserPatternPenalty: {
      applied: loserPatternPenalty < 0,
      penalty: loserPatternPenalty,
      reason:
        loserPatternPenalty < 0
          ? "Wallet matches DEX loser pattern: many trades, weak entry, weak exit, poor profit factor, and sub-1 median multiple."
          : "DEX loser pattern was not detected.",
      components: {
        completedTradeCount: metrics.totalCompletedTrades,
        uniqueTokensTraded,
        entryDisciplineV3,
        exitDisciplineV3,
        profitFactor: metrics.profitFactor,
        medianRealizedMultiple: metrics.medianRealizedMultiple,
        finalCap,
      },
    },
  };

  return {
    version: "v3.3-dex-separation-calibrated",
    wallet,
    walletAlphaV3,
    rawWalletAlphaBeforeConfidence: round(rawAfterAdjustments, 2),
    scores,
    rawMetrics,
    confidenceLevel: level,
    confidenceFactor: factor,
    scoreBreakdown,
    explanations: explanations({
      scores,
      rawMetrics,
      confidenceLevelValue: level,
      dexLoserPatternPenalty: loserPatternPenalty,
    }),
    warnings: Array.from(new Set(warnings)),
  };
}
