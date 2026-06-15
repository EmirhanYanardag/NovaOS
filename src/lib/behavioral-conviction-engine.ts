import type { GmgnHolderSnapshot, GmgnSnapshotActivity } from "@/lib/gmgn-top100-snapshot";
import {
  buildCompletedTrades,
  buildTradeHistoryMetrics,
  buildWalletEvolutionMetrics,
} from "@/lib/wallet-trade-history-builder";

type HolderMetrics = {
  walletCount: number;
  analyzedWalletCount: number;
  buyCount: number;
  sellCount: number;
  transferCount: number;
  buyUsd: number;
  sellUsd: number;
  netFlowUsd: number;
  buySellRatio: number | null;
  sellShare: number | null;
  averageActivitiesPerWallet: number | null;
  averageUniqueTokensPerWallet: number | null;
  avgHoldSeconds: number | null;
  medianHoldSeconds: number | null;
  totalCompletedTrades: number;
  last30dWinRate: number | null;
  previous30dWinRate: number | null;
  last30dPnl: number | null;
  previous30dPnl: number | null;
  trendDirection: "improving" | "stable" | "deteriorating";
};

export type BehavioralConvictionResultV1 = {
  behavioralConvictionScore: number;
  accumulationScore: number;
  holdingScore: number;
  distributionScore: number;
  rotationPressureScore: number;
  convictionStabilityScore: number;
  holderMetrics: HolderMetrics;
  explanations: string[];
};

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function round(value: number, decimals = 4) {
  return Number(value.toFixed(decimals));
}

function safeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return round(sum(values) / values.length);
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);

  return sorted.length % 2
    ? round(sorted[midpoint])
    : round((sorted[midpoint - 1] + sorted[midpoint]) / 2);
}

function allActivities(holders: GmgnHolderSnapshot[]) {
  return holders.flatMap((holder) => holder.activities || []);
}

function activitiesByType(activities: GmgnSnapshotActivity[], type: "buy" | "sell") {
  return activities.filter((activity) => activity.eventType === type);
}

function usdTotal(activities: GmgnSnapshotActivity[]) {
  return round(
    sum(
      activities
        .map((activity) => safeNumber(activity.costUsd))
        .filter((value): value is number => value !== null)
    )
  );
}

function scoreAccumulation(metrics: HolderMetrics) {
  const usdTotalFlow = metrics.buyUsd + metrics.sellUsd;
  const tradeCount = metrics.buyCount + metrics.sellCount;
  const usdDominance =
    usdTotalFlow > 0 ? (metrics.buyUsd - metrics.sellUsd) / usdTotalFlow : 0;
  const countDominance =
    tradeCount > 0 ? (metrics.buyCount - metrics.sellCount) / tradeCount : 0;

  return clampScore(50 + usdDominance * 35 + countDominance * 15);
}

function scoreDistribution(metrics: HolderMetrics) {
  const usdTotalFlow = metrics.buyUsd + metrics.sellUsd;
  const tradeCount = metrics.buyCount + metrics.sellCount;
  const sellUsdShare = usdTotalFlow > 0 ? metrics.sellUsd / usdTotalFlow : 0;
  const sellFrequencyShare = tradeCount > 0 ? metrics.sellCount / tradeCount : 0;
  const noSellBonus = metrics.sellCount === 0 && metrics.buyCount > 0 ? 10 : 0;

  return clampScore(100 - sellUsdShare * 55 - sellFrequencyShare * 35 + noSellBonus);
}

function scoreHolding(metrics: HolderMetrics, medianRealizedMultiple: number | null) {
  const holdSeconds = metrics.medianHoldSeconds ?? metrics.avgHoldSeconds;
  if (holdSeconds === null) return 50;

  const holdDays = holdSeconds / 86_400;
  let score = 50;

  if (holdDays < 0.05) score = 35;
  else if (holdDays < 1) score = 50;
  else if (holdDays < 7) score = 65;
  else if (holdDays < 30) score = 78;
  else if (holdDays < 180) score = 72;
  else score = 60;

  if (medianRealizedMultiple !== null && medianRealizedMultiple < 1) score -= 15;
  if (medianRealizedMultiple !== null && medianRealizedMultiple >= 1.2) score += 8;

  return clampScore(score);
}

function scoreRotationPressure(metrics: HolderMetrics) {
  const avgUniqueTokens = metrics.averageUniqueTokensPerWallet ?? 0;
  const avgActivities = metrics.averageActivitiesPerWallet ?? 0;
  const tokenPenalty = Math.min(55, avgUniqueTokens * 0.35);
  const activityPenalty = Math.min(45, avgActivities * 0.08);

  return clampScore(100 - tokenPenalty - activityPenalty);
}

function scoreConvictionStability(metrics: HolderMetrics) {
  let score =
    metrics.trendDirection === "improving"
      ? 75
      : metrics.trendDirection === "deteriorating"
      ? 35
      : 62;

  if (metrics.last30dPnl !== null && metrics.previous30dPnl !== null) {
    const pnlDelta = metrics.last30dPnl - metrics.previous30dPnl;
    if (pnlDelta > 0) score += 5;
    if (pnlDelta < 0) score -= 5;
  }

  return clampScore(score);
}

function buildHolderMetrics(holders: GmgnHolderSnapshot[]): {
  metrics: HolderMetrics;
  medianRealizedMultiple: number | null;
} {
  const analyzed = holders.filter((holder) => !holder.error);
  const activities = allActivities(analyzed);
  const buyActivities = activitiesByType(activities, "buy");
  const sellActivities = activitiesByType(activities, "sell");
  const completedTrades = buildCompletedTrades(activities);
  const tradeMetrics = buildTradeHistoryMetrics(completedTrades);
  const evolution = buildWalletEvolutionMetrics(completedTrades);
  const buyUsd = usdTotal(buyActivities);
  const sellUsd = usdTotal(sellActivities);
  const flowTotal = buyUsd + sellUsd;
  const holdSamples = [
    ...analyzed
      .map((holder) => safeNumber(holder.avgHoldTimeSecondsApprox))
      .filter((value): value is number => value !== null),
    ...completedTrades.map((trade) => trade.holdingSeconds),
  ];

  return {
    metrics: {
      walletCount: holders.length,
      analyzedWalletCount: analyzed.length,
      buyCount: buyActivities.length,
      sellCount: sellActivities.length,
      transferCount: activities.filter((activity) => activity.eventType === "transfer").length,
      buyUsd,
      sellUsd,
      netFlowUsd: round(buyUsd - sellUsd),
      buySellRatio: sellActivities.length > 0 ? round(buyActivities.length / sellActivities.length) : null,
      sellShare: flowTotal > 0 ? round(sellUsd / flowTotal) : null,
      averageActivitiesPerWallet: average(analyzed.map((holder) => holder.activityCount)),
      averageUniqueTokensPerWallet: average(
        analyzed.map((holder) => holder.uniqueTokensTraded)
      ),
      avgHoldSeconds: average(holdSamples),
      medianHoldSeconds: median(holdSamples),
      totalCompletedTrades: tradeMetrics.totalCompletedTrades,
      last30dWinRate: evolution.last30dWinRate,
      previous30dWinRate: evolution.previous30dWinRate,
      last30dPnl: evolution.last30dPnl,
      previous30dPnl: evolution.previous30dPnl,
      trendDirection: evolution.trendDirection,
    },
    medianRealizedMultiple: tradeMetrics.medianRealizedMultiple,
  };
}

function explanations({
  metrics,
  accumulationScore,
  distributionScore,
  rotationPressureScore,
  convictionStabilityScore,
}: {
  metrics: HolderMetrics;
  accumulationScore: number;
  distributionScore: number;
  rotationPressureScore: number;
  convictionStabilityScore: number;
}) {
  const rows: string[] = [];

  if (metrics.netFlowUsd > 0 && accumulationScore >= 60) {
    rows.push("Top holders are net accumulators.");
  } else if (metrics.netFlowUsd < 0 && accumulationScore <= 45) {
    rows.push("Top holders are net distributors.");
  } else {
    rows.push("Top holder flow is mixed rather than clearly accumulative or distributive.");
  }

  if (distributionScore >= 65) rows.push("Distribution pressure is low.");
  if (distributionScore < 45) rows.push("Distribution pressure is elevated.");

  if (rotationPressureScore >= 65) {
    rows.push("Rotation pressure is contained.");
  } else if (rotationPressureScore < 45) {
    rows.push("Rotation activity is elevated.");
  }

  if (convictionStabilityScore >= 65) {
    rows.push("Holder behavior appears stable or improving.");
  } else if (convictionStabilityScore < 45) {
    rows.push("Recent conviction has weakened.");
  }

  rows.push(
    `Observed ${metrics.buyCount} buy event(s), ${metrics.sellCount} sell event(s), and ${metrics.totalCompletedTrades} completed trade(s) across current top holders.`
  );

  return rows;
}

export function computeBehavioralConvictionV1(
  holders: GmgnHolderSnapshot[]
): BehavioralConvictionResultV1 {
  const { metrics, medianRealizedMultiple } = buildHolderMetrics(holders);
  const accumulationScore = scoreAccumulation(metrics);
  const holdingScore = scoreHolding(metrics, medianRealizedMultiple);
  const distributionScore = scoreDistribution(metrics);
  const rotationPressureScore = scoreRotationPressure(metrics);
  const convictionStabilityScore = scoreConvictionStability(metrics);
  const behavioralConvictionScore = clampScore(
    accumulationScore * 0.3 +
      holdingScore * 0.25 +
      distributionScore * 0.2 +
      rotationPressureScore * 0.15 +
      convictionStabilityScore * 0.1
  );

  return {
    behavioralConvictionScore,
    accumulationScore,
    holdingScore,
    distributionScore,
    rotationPressureScore,
    convictionStabilityScore,
    holderMetrics: metrics,
    explanations: explanations({
      metrics,
      accumulationScore,
      distributionScore,
      rotationPressureScore,
      convictionStabilityScore,
    }),
  };
}
