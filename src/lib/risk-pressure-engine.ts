import type { BehavioralConvictionResultV1 } from "@/lib/behavioral-conviction-engine";
import type { GmgnRiskStats } from "@/lib/gmgn-risk-stats";
import type { StructuralSafetyResultV1 } from "@/lib/structural-safety-engine";
import type { Top100HolderAlphaResultV1 } from "@/lib/top100-holder-alpha-engine";

type TrendDirection = "improving" | "stable" | "deteriorating" | "unknown";

export type RiskPressureCoverageInput = {
  walletCount: number | null;
  walletsReachedEndOfHistory: number | null;
  walletsStoppedByPageLimit: number | null;
  walletsStoppedByActivityLimit: number | null;
  averageActivitiesPerWallet: number | null;
  highConfidenceCount: number | null;
  mediumConfidenceCount: number | null;
  lowConfidenceCount: number | null;
};

export type RiskPressureHolderAlphaContext = {
  holderAlphaScore: number | null;
  weightedWalletAlphaV3: number | null;
  simpleAverageWalletAlphaV3: number | null;
  holderCompositionScore: number | null;
  confidenceScore: number | null;
  walletDataConfidenceScore: number | null;
  holderSetCoverageScore: number | null;
  totalAnalyzedOwnershipPercent: number | null;
  eliteWalletCount: number | null;
  strongWalletCount: number | null;
  goodWalletCount: number | null;
  averageWalletCount: number | null;
  weakWalletCount: number | null;
  toxicWalletCount: number | null;
  eliteOwnershipPercent: number | null;
  strongOwnershipPercent: number | null;
  goodOwnershipPercent: number | null;
  averageOwnershipPercent: number | null;
  weakOwnershipPercent: number | null;
  toxicOwnershipPercent: number | null;
  goodOrBetterOwnershipPercent: number | null;
  weakOrToxicOwnershipPercent: number | null;
  smartLikeOwnershipPercent: number | null;
  sniperLikeOwnershipPercent: number | null;
  bundlerLikeOwnershipPercent: number | null;
  suspiciousLikeOwnershipPercent: number | null;
  freshLikeOwnershipPercent: number | null;
  whaleLikeOwnershipPercent: number | null;
  analysisMode: string | null;
  deepAnalyzedWalletCount: number | null;
  lightAnalyzedWalletCount: number | null;
  realLightWalletCount: number | null;
  fallbackLightWalletCount: number | null;
};

export type RiskPressureInputV1 = {
  riskStats?: GmgnRiskStats | null;
  holderAlpha?: Top100HolderAlphaResultV1 | null;
  holderAlphaContext?: RiskPressureHolderAlphaContext | null;
  behavioralConviction?: BehavioralConvictionResultV1 | null;
  structuralSafety?: StructuralSafetyResultV1 | null;
  coverage?: RiskPressureCoverageInput | null;
  warnings?: string[];
};

export type RiskPressureSubScoresV1 = {
  insiderRiskScore: number;
  phishingRiskScore: number;
  bundlerRiskScore: number;
  sniperRiskScore: number;
  freshWalletRiskScore: number;
  botDegenRiskScore: number;
  devOwnershipRiskScore: number;
  top10ConcentrationRiskScore: number;
  holderQualityRiskScore: number;
  weakHolderRiskScore: number;
  toxicOwnershipRiskScore: number;
  suspiciousLabelPressure: number;
  liquidityRiskScore: number;
  volumeLiquidityRiskScore: number;
  sellPressureRiskScore: number;
  trendDeteriorationRiskScore: number;
  dataCoverageRiskScore: number;
};

export type RiskPressureMetricsV1 = {
  insiderPercentage: number | null;
  insiderWalletCount: number | null;
  phishingPercentage: number | null;
  bundlerPercentage: number | null;
  bundlerWalletCount: number | null;
  top70SniperHoldPercentage: number | null;
  sniperWalletCount: number | null;
  freshWalletPercentage: number | null;
  freshWalletCount: number | null;
  holderCount: number | null;
  botDegenPercentage: number | null;
  suspiciousDevOwnershipPercentage: number | null;
  top10HolderPercentage: number | null;
  holderAlphaScore: number | null;
  weightedWalletAlpha: number | null;
  simpleAverageWalletAlpha: number | null;
  goodOrBetterOwnershipPercent: number | null;
  weakOrToxicOwnershipPercent: number | null;
  holderCompositionScore: number | null;
  holderAlphaConfidenceScore: number | null;
  holderSetCoverageScore: number | null;
  walletDataConfidenceScore: number | null;
  totalAnalyzedOwnershipPercent: number | null;
  goodWalletCount: number | null;
  strongWalletCount: number | null;
  eliteWalletCount: number | null;
  averageWalletCount: number | null;
  goodOwnershipPercent: number | null;
  strongOwnershipPercent: number | null;
  eliteOwnershipPercent: number | null;
  averageOwnershipPercent: number | null;
  smartLikeOwnershipPercent: number | null;
  sniperLikeOwnershipPercent: number | null;
  bundlerLikeOwnershipPercent: number | null;
  suspiciousLikeOwnershipPercent: number | null;
  freshLikeOwnershipPercent: number | null;
  whaleLikeOwnershipPercent: number | null;
  weakWalletCount: number | null;
  toxicWalletCount: number | null;
  weakOwnershipShare: number | null;
  toxicOwnershipShare: number | null;
  structuralSafetyScore: number | null;
  liquidityUsd: number | null;
  price: number | null;
  circulatingSupply: number | null;
  marketCapApprox: number | null;
  volume24h: number | null;
  buyVolume24h: number | null;
  sellVolume24h: number | null;
  volumeLiquidityRatio: number | null;
  sellPressure: number | null;
  behavioralConvictionScore: number | null;
  holdingScore: number | null;
  distributionScore: number | null;
  trendDirection: TrendDirection;
  last30dPnl: number | null;
  previous30dPnl: number | null;
  coverageRate: number | null;
  walletsReachedEndOfHistory: number | null;
  walletsStoppedByPageLimit: number | null;
  walletsStoppedByActivityLimit: number | null;
  averageActivitiesPerWallet: number | null;
  highConfidenceCount: number | null;
  mediumConfidenceCount: number | null;
  lowConfidenceCount: number | null;
};

export type RiskPressureResultV1 = {
  riskPressureScore: number;
  structuralRiskScore: number;
  holderRiskScore: number;
  marketRiskScore: number;
  behavioralRiskScore: number;
  confidenceRiskScore: number;
  subScores: RiskPressureSubScoresV1;
  metrics: RiskPressureMetricsV1;
  explanations: string[];
  warnings: string[];
};

function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function clampScore(value: number) {
  return Math.round(clamp(value));
}

function round(value: number, decimals = 4) {
  return Number(value.toFixed(decimals));
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function percentValue(value: number | null | undefined) {
  if (!isNumber(value)) return null;
  return value <= 1 ? value * 100 : value;
}

function ratioValue(value: number | null | undefined) {
  if (!isNumber(value)) return null;
  return value > 1 ? value / 100 : value;
}

function scoreByBands(
  value: number | null,
  fallback: number,
  bands: Array<{ max: number; score: number }>
) {
  if (value === null) return fallback;

  for (const band of bands) {
    if (value <= band.max) return band.score;
  }

  return bands[bands.length - 1]?.score ?? fallback;
}

function interpolate(value: number, inputMin: number, inputMax: number, outputMin: number, outputMax: number) {
  if (value <= inputMin) return outputMin;
  if (value >= inputMax) return outputMax;
  const ratio = (value - inputMin) / (inputMax - inputMin);
  return outputMin + (outputMax - outputMin) * ratio;
}

function scoreByPoints(value: number, points: Array<[number, number]>) {
  if (value <= points[0][0]) return points[0][1];
  for (let index = 1; index < points.length; index += 1) {
    const [x, y] = points[index];
    const [previousX, previousY] = points[index - 1];
    if (value <= x) return interpolate(value, previousX, x, previousY, y);
  }
  return points[points.length - 1][1];
}

function addWarning(warnings: string[], condition: boolean, warning: string) {
  if (condition && !warnings.includes(warning)) warnings.push(warning);
}

function scoreInsiderRisk(stats: GmgnRiskStats | null, warnings: string[]) {
  const percentage = percentValue(stats?.insiderPercentage);
  if (percentage !== null) {
    if (percentage === 0) return 0;
    return scoreByBands(percentage, 50, [
      { max: 1, score: 10 },
      { max: 3, score: 25 },
      { max: 5, score: 45 },
      { max: 10, score: 70 },
      { max: Number.POSITIVE_INFINITY, score: 100 },
    ]);
  }

  if (isNumber(stats?.insiderWalletCount)) {
    addWarning(warnings, true, "Insider percentage missing; used insider wallet-count fallback.");
    return clampScore(stats.insiderWalletCount * 5);
  }

  addWarning(warnings, true, "Insider risk unavailable; neutral risk fallback used.");
  return 50;
}

function scorePhishingRisk(stats: GmgnRiskStats | null, warnings: string[]) {
  const percentage = percentValue(stats?.phishingPercentage);
  addWarning(warnings, percentage === null, "Phishing percentage missing; neutral risk fallback used.");
  return scoreByBands(percentage, 50, [
    { max: 5, score: 10 },
    { max: 10, score: 30 },
    { max: 20, score: 55 },
    { max: 30, score: 80 },
    { max: Number.POSITIVE_INFINITY, score: 100 },
  ]);
}

function scoreBundlerRisk(stats: GmgnRiskStats | null, warnings: string[]) {
  const percentage = percentValue(stats?.bundlerPercentage);
  if (percentage !== null) {
    return scoreByBands(percentage, 50, [
      { max: 1, score: 5 },
      { max: 3, score: 20 },
      { max: 5, score: 40 },
      { max: 10, score: 70 },
      { max: Number.POSITIVE_INFINITY, score: 100 },
    ]);
  }

  if (isNumber(stats?.bundlerWalletCount)) {
    addWarning(warnings, true, "Bundler percentage missing; used bundler wallet-count fallback.");
    return clampScore(stats.bundlerWalletCount * 3);
  }

  addWarning(warnings, true, "Bundler risk unavailable; neutral risk fallback used.");
  return 50;
}

function scoreSniperRisk(stats: GmgnRiskStats | null, warnings: string[]) {
  const ownershipPercentage = percentValue(stats?.top70SniperHoldPercentage);
  if (ownershipPercentage !== null && ownershipPercentage > 0) {
    return scoreByBands(ownershipPercentage, 50, [
      { max: 1, score: 10 },
      { max: 3, score: 25 },
      { max: 8, score: 45 },
      { max: 15, score: 70 },
      { max: Number.POSITIVE_INFINITY, score: 90 },
    ]);
  }

  if (isNumber(stats?.sniperWalletCount)) {
    return scoreByBands(stats.sniperWalletCount, 50, [
      { max: 10, score: 10 },
      { max: 25, score: 25 },
      { max: 50, score: 45 },
      { max: 100, score: 70 },
      { max: Number.POSITIVE_INFINITY, score: 90 },
    ]);
  }

  addWarning(warnings, true, "Sniper risk unavailable; neutral risk fallback used.");
  return 50;
}

function scoreFreshWalletRisk(stats: GmgnRiskStats | null, warnings: string[]) {
  const directPercentage = percentValue(stats?.freshWalletPercentage);
  const fallbackPercentage =
    directPercentage === null &&
    isNumber(stats?.freshWalletCount) &&
    isNumber(stats?.holderCount) &&
    stats.holderCount > 0
      ? (stats.freshWalletCount / stats.holderCount) * 100
      : null;
  const percentage = directPercentage ?? fallbackPercentage;

  addWarning(
    warnings,
    directPercentage === null && fallbackPercentage !== null,
    "Fresh wallet percentage missing; derived fallback from fresh wallet count and holder count."
  );
  addWarning(warnings, percentage === null, "Fresh wallet risk unavailable; neutral risk fallback used.");

  return scoreByBands(percentage, 50, [
    { max: 3, score: 10 },
    { max: 8, score: 25 },
    { max: 15, score: 45 },
    { max: 25, score: 70 },
    { max: Number.POSITIVE_INFINITY, score: 90 },
  ]);
}

function scoreBotDegenRisk(stats: GmgnRiskStats | null, warnings: string[]) {
  const percentage = percentValue(stats?.botDegenPercentage);
  addWarning(warnings, percentage === null, "Bot degen percentage missing; neutral risk fallback used.");
  return scoreByBands(percentage, 50, [
    { max: 3, score: 5 },
    { max: 8, score: 25 },
    { max: 15, score: 50 },
    { max: 25, score: 75 },
    { max: Number.POSITIVE_INFINITY, score: 100 },
  ]);
}

function suspiciousDevOwnership(stats: GmgnRiskStats | null) {
  const values = [
    percentValue(stats?.devTeamHoldPercentage),
    percentValue(stats?.creatorHoldPercentage),
    percentValue(stats?.privateVaultHoldPercentage),
  ].filter((value): value is number => value !== null);

  if (values.length === 0) return null;
  return round(values.reduce((total, value) => total + value, 0));
}

function scoreDevOwnershipRisk(value: number | null, warnings: string[]) {
  addWarning(warnings, value === null, "Dev ownership fields missing; neutral risk fallback used.");
  if (value === null) return 50;
  if (value === 0) return 0;

  return scoreByBands(value, 50, [
    { max: 2, score: 15 },
    { max: 5, score: 35 },
    { max: 10, score: 65 },
    { max: Number.POSITIVE_INFINITY, score: 100 },
  ]);
}

function scoreTop10ConcentrationRisk({
  stats,
  structuralSafety,
  warnings,
}: {
  stats: GmgnRiskStats | null;
  structuralSafety: StructuralSafetyResultV1 | null;
  warnings: string[];
}) {
  const tokenInfoPercentage = percentValue(stats?.top10HolderPercentage);
  const structuralFallback = percentValue(structuralSafety?.metrics.top10Ownership);
  const percentage = tokenInfoPercentage ?? structuralFallback;

  addWarning(
    warnings,
    tokenInfoPercentage === null && structuralFallback !== null,
    "GMGN top10 holder percentage missing; used Structural Safety top10 ownership fallback."
  );
  addWarning(warnings, percentage === null, "Top10 concentration risk unavailable; neutral risk fallback used.");

  return scoreByBands(percentage, 50, [
    { max: 10, score: 10 },
    { max: 20, score: 25 },
    { max: 35, score: 50 },
    { max: 50, score: 75 },
    { max: Number.POSITIVE_INFINITY, score: 100 },
  ]);
}

function scoreLiquidityRisk(liquidityUsd: number | null, warnings: string[]) {
  addWarning(warnings, liquidityUsd === null, "Liquidity missing; neutral market-risk fallback used.");
  if (liquidityUsd === null) return 50;
  if (liquidityUsd >= 1_000_000) return 10;
  if (liquidityUsd >= 500_000) return 25;
  if (liquidityUsd >= 200_000) return 45;
  if (liquidityUsd >= 50_000) return 70;
  return 90;
}

function scoreMarketCapRisk(marketCapApprox: number | null, warnings: string[]) {
  addWarning(
    warnings,
    marketCapApprox === null,
    "Market cap approximation could not be computed; neutral market-cap risk fallback used."
  );
  if (marketCapApprox === null) return 50;
  if (marketCapApprox >= 50_000_000) return 15;
  if (marketCapApprox >= 10_000_000) return 25;
  if (marketCapApprox >= 2_000_000) return 45;
  if (marketCapApprox >= 500_000) return 65;
  return 85;
}

function scoreVolumeLiquidityRisk(ratio: number | null, warnings: string[]) {
  addWarning(warnings, ratio === null, "Volume/liquidity ratio unavailable; neutral market-risk fallback used.");
  if (ratio === null) return 50;
  if (ratio <= 0.05) return 70;
  if (ratio <= 0.2) return 45;
  if (ratio <= 1.5) return 20;
  if (ratio <= 4) return 45;
  return 70;
}

function scoreSellPressureRisk(sellPressure: number | null, warnings: string[]) {
  addWarning(warnings, sellPressure === null, "Sell pressure unavailable; neutral market-risk fallback used.");
  if (sellPressure === null) return 50;
  const percentage = percentValue(sellPressure) ?? 0;
  if (percentage < 45) return 15;
  if (percentage <= 55) return 30;
  if (percentage <= 65) return 55;
  if (percentage <= 75) return 75;
  return 95;
}

function trendRisk({
  trendDirection,
  last30dPnl,
  previous30dPnl,
}: {
  trendDirection: TrendDirection;
  last30dPnl: number | null;
  previous30dPnl: number | null;
}) {
  let score =
    trendDirection === "improving"
      ? 15
      : trendDirection === "stable"
        ? 35
        : trendDirection === "deteriorating"
          ? 75
          : 50;

  if (isNumber(last30dPnl) && isNumber(previous30dPnl) && last30dPnl < 0 && previous30dPnl > 0) {
    score += 15;
  }

  return clampScore(score);
}

function buildMetrics({
  riskStats,
  holderAlpha,
  holderAlphaContext,
  behavioralConviction,
  structuralSafety,
  coverage,
}: RiskPressureInputV1): RiskPressureMetricsV1 {
  const liquidityUsd = riskStats?.liquidityUsd ?? null;
  const price = riskStats?.price ?? null;
  const circulatingSupply = riskStats?.circulatingSupply ?? null;
  const marketCapApprox =
    isNumber(price) && isNumber(circulatingSupply) ? round(price * circulatingSupply) : null;
  const volume24h = riskStats?.volume24h ?? null;
  const volumeLiquidityRatio =
    isNumber(volume24h) && isNumber(liquidityUsd) && liquidityUsd > 0
      ? round(volume24h / liquidityUsd)
      : null;
  const buyVolume24h = riskStats?.buyVolume24h ?? null;
  const sellVolume24h = riskStats?.sellVolume24h ?? null;
  const sellPressure =
    isNumber(buyVolume24h) && isNumber(sellVolume24h) && buyVolume24h + sellVolume24h > 0
      ? round(sellVolume24h / (buyVolume24h + sellVolume24h))
      : null;
  const walletCount = coverage?.walletCount ?? null;
  const walletsReachedEndOfHistory = coverage?.walletsReachedEndOfHistory ?? null;
  const coverageRate =
    isNumber(walletCount) && walletCount > 0 && isNumber(walletsReachedEndOfHistory)
      ? round(walletsReachedEndOfHistory / walletCount)
      : null;

  return {
    insiderPercentage: riskStats?.insiderPercentage ?? null,
    insiderWalletCount: riskStats?.insiderWalletCount ?? null,
    phishingPercentage: riskStats?.phishingPercentage ?? null,
    bundlerPercentage: riskStats?.bundlerPercentage ?? null,
    bundlerWalletCount: riskStats?.bundlerWalletCount ?? null,
    top70SniperHoldPercentage: riskStats?.top70SniperHoldPercentage ?? null,
    sniperWalletCount: riskStats?.sniperWalletCount ?? null,
    freshWalletPercentage: riskStats?.freshWalletPercentage ?? null,
    freshWalletCount: riskStats?.freshWalletCount ?? null,
    holderCount: riskStats?.holderCount ?? null,
    botDegenPercentage: riskStats?.botDegenPercentage ?? null,
      suspiciousDevOwnershipPercentage: suspiciousDevOwnership(riskStats ?? null),
      top10HolderPercentage:
        riskStats?.top10HolderPercentage ?? structuralSafety?.metrics.top10Ownership ?? null,
      holderAlphaScore: holderAlphaContext?.holderAlphaScore ?? holderAlpha?.holderAlphaScore ?? null,
      weightedWalletAlpha: holderAlphaContext?.weightedWalletAlphaV3 ?? holderAlpha?.weightedWalletAlpha ?? structuralSafety?.metrics.weightedWalletAlpha ?? null,
      simpleAverageWalletAlpha:
        holderAlphaContext?.simpleAverageWalletAlphaV3 ?? holderAlpha?.simpleAverageWalletAlpha ?? structuralSafety?.metrics.averageWalletAlpha ?? null,
      goodOrBetterOwnershipPercent: holderAlphaContext?.goodOrBetterOwnershipPercent ?? null,
      weakOrToxicOwnershipPercent: holderAlphaContext?.weakOrToxicOwnershipPercent ?? null,
      holderCompositionScore: holderAlphaContext?.holderCompositionScore ?? null,
      holderAlphaConfidenceScore: holderAlphaContext?.confidenceScore ?? holderAlpha?.dataConfidenceScore ?? null,
      holderSetCoverageScore: holderAlphaContext?.holderSetCoverageScore ?? null,
      walletDataConfidenceScore: holderAlphaContext?.walletDataConfidenceScore ?? null,
      totalAnalyzedOwnershipPercent: holderAlphaContext?.totalAnalyzedOwnershipPercent ?? null,
      goodWalletCount: holderAlphaContext?.goodWalletCount ?? null,
      strongWalletCount: holderAlphaContext?.strongWalletCount ?? structuralSafety?.metrics.strongWalletCount ?? null,
      eliteWalletCount: holderAlphaContext?.eliteWalletCount ?? structuralSafety?.metrics.eliteWalletCount ?? null,
      averageWalletCount: holderAlphaContext?.averageWalletCount ?? structuralSafety?.metrics.averageWalletCount ?? null,
      goodOwnershipPercent: holderAlphaContext?.goodOwnershipPercent ?? null,
      strongOwnershipPercent: holderAlphaContext?.strongOwnershipPercent ?? structuralSafety?.metrics.strongOwnershipShare ?? null,
      eliteOwnershipPercent: holderAlphaContext?.eliteOwnershipPercent ?? structuralSafety?.metrics.eliteOwnershipShare ?? null,
      averageOwnershipPercent: holderAlphaContext?.averageOwnershipPercent ?? structuralSafety?.metrics.averageOwnershipShare ?? null,
      smartLikeOwnershipPercent: holderAlphaContext?.smartLikeOwnershipPercent ?? null,
      sniperLikeOwnershipPercent: holderAlphaContext?.sniperLikeOwnershipPercent ?? null,
      bundlerLikeOwnershipPercent: holderAlphaContext?.bundlerLikeOwnershipPercent ?? null,
      suspiciousLikeOwnershipPercent: holderAlphaContext?.suspiciousLikeOwnershipPercent ?? null,
      freshLikeOwnershipPercent: holderAlphaContext?.freshLikeOwnershipPercent ?? null,
      whaleLikeOwnershipPercent: holderAlphaContext?.whaleLikeOwnershipPercent ?? null,
      weakWalletCount: holderAlphaContext?.weakWalletCount ?? holderAlpha?.weakWalletCount ?? structuralSafety?.metrics.weakWalletCount ?? null,
      toxicWalletCount: holderAlphaContext?.toxicWalletCount ?? holderAlpha?.toxicWalletCount ?? structuralSafety?.metrics.toxicWalletCount ?? null,
      weakOwnershipShare: holderAlphaContext?.weakOwnershipPercent ?? holderAlpha?.weakOwnershipShare ?? structuralSafety?.metrics.weakOwnershipShare ?? null,
      toxicOwnershipShare: holderAlphaContext?.toxicOwnershipPercent ?? holderAlpha?.toxicOwnershipShare ?? structuralSafety?.metrics.toxicOwnershipShare ?? null,
    structuralSafetyScore: structuralSafety?.structuralSafetyScore ?? null,
    liquidityUsd,
    price,
    circulatingSupply,
    marketCapApprox,
    volume24h,
    buyVolume24h,
    sellVolume24h,
    volumeLiquidityRatio,
    sellPressure,
    behavioralConvictionScore: behavioralConviction?.behavioralConvictionScore ?? null,
    holdingScore: behavioralConviction?.holdingScore ?? null,
    distributionScore: behavioralConviction?.distributionScore ?? null,
    trendDirection: behavioralConviction?.holderMetrics.trendDirection ?? "unknown",
    last30dPnl: behavioralConviction?.holderMetrics.last30dPnl ?? null,
    previous30dPnl: behavioralConviction?.holderMetrics.previous30dPnl ?? null,
    coverageRate,
    walletsReachedEndOfHistory,
    walletsStoppedByPageLimit: coverage?.walletsStoppedByPageLimit ?? null,
    walletsStoppedByActivityLimit: coverage?.walletsStoppedByActivityLimit ?? null,
    averageActivitiesPerWallet: coverage?.averageActivitiesPerWallet ?? null,
    highConfidenceCount: coverage?.highConfidenceCount ?? null,
    mediumConfidenceCount: coverage?.mediumConfidenceCount ?? null,
    lowConfidenceCount: coverage?.lowConfidenceCount ?? null,
  };
}

function computeConfidenceRisk(metrics: RiskPressureMetricsV1, warnings: string[]) {
  const walletCount = metrics.highConfidenceCount !== null || metrics.lowConfidenceCount !== null
    ? (metrics.highConfidenceCount ?? 0) + (metrics.mediumConfidenceCount ?? 0) + (metrics.lowConfidenceCount ?? 0)
    : null;

  if (!isNumber(walletCount) || walletCount <= 0 || metrics.coverageRate === null) {
    addWarning(warnings, true, "Coverage data unavailable; confidence risk fallback used.");
    return 50;
  }

  return clampScore(
    (1 - metrics.coverageRate) * 60 +
      ((metrics.lowConfidenceCount ?? 0) / walletCount) * 40 +
      ((metrics.walletsStoppedByPageLimit ?? 0) / walletCount) * 30 +
      ((metrics.walletsStoppedByActivityLimit ?? 0) / walletCount) * 40
  );
}

function holderQualityRiskScore(metrics: RiskPressureMetricsV1, warnings: string[]) {
  let base = metrics.weightedWalletAlpha;
  if (base === null && metrics.holderAlphaScore !== null) {
    base = metrics.holderAlphaScore;
    addWarning(warnings, true, "Weighted Wallet Alpha missing; Holder Alpha score used as holder-quality fallback.");
  }

  addWarning(warnings, base === null, "Weighted Wallet Alpha missing; neutral holder-quality risk fallback used.");
  if (base === null) return 50;

  return clampScore(
    scoreByPoints(base, [
      [0, 95],
      [20, 88],
      [30, 78],
      [40, 65],
      [50, 48],
      [60, 32],
      [70, 18],
      [80, 8],
      [100, 8],
    ])
  );
}

function weakHolderOwnershipPressure(metrics: RiskPressureMetricsV1) {
  const weak = metrics.weakOrToxicOwnershipPercent;
  const good = metrics.goodOrBetterOwnershipPercent;

  if (weak === null || good === null) {
    const weakOwnership = percentValue(metrics.weakOwnershipShare) ?? 0;
    const toxicOwnership = percentValue(metrics.toxicOwnershipShare) ?? 0;
    return clampScore(
      weakOwnership * 1.2 +
        toxicOwnership * 2 +
        (metrics.weakWalletCount ?? 0) * 0.6 +
        (metrics.toxicWalletCount ?? 0) * 2
    );
  }

  const spread = weak - good;
  return clampScore(
    scoreByPoints(spread, [
      [-10, 5],
      [0, 15],
      [5, 30],
      [15, 55],
      [30, 78],
      [100, 92],
    ])
  );
}

function toxicOwnershipPressure(metrics: RiskPressureMetricsV1) {
  const toxicOwnership = metrics.toxicOwnershipShare ?? 0;
  return clampScore(
    scoreByPoints(toxicOwnership, [
      [0, 0],
      [0.5, 15],
      [1, 30],
      [2, 50],
      [4, 70],
      [7, 90],
      [100, 90],
    ])
  );
}

function labelOwnershipPressure(value: number | null) {
  const ownership = value ?? 0;
  return clampScore(
    scoreByPoints(ownership, [
      [0, 0],
      [0.5, 8],
      [1, 15],
      [3, 35],
      [5, 55],
      [10, 80],
      [100, 80],
    ])
  );
}

function suspiciousLabelPressure(metrics: RiskPressureMetricsV1) {
  const sniperPressure = labelOwnershipPressure(metrics.sniperLikeOwnershipPercent);
  const bundlerPressure = labelOwnershipPressure(metrics.bundlerLikeOwnershipPercent);
  const suspiciousPressure = labelOwnershipPressure(metrics.suspiciousLikeOwnershipPercent);
  const freshWalletPressure = labelOwnershipPressure(metrics.freshLikeOwnershipPercent);

  return clampScore(
    sniperPressure * 0.3 +
      bundlerPressure * 0.3 +
      suspiciousPressure * 0.25 +
      freshWalletPressure * 0.15
  );
}

function buildExplanations({
  metrics,
  subScores,
  riskPressureScore,
}: {
  metrics: RiskPressureMetricsV1;
  subScores: RiskPressureSubScoresV1;
  riskPressureScore: number;
}) {
  const rows: string[] = [];

  rows.push("Holder risk uses Top100 Holder Alpha V3.2 output when available.");

  if ((metrics.phishingPercentage ?? 0) >= 20) {
    rows.push(`Phishing exposure is elevated at ${metrics.phishingPercentage}%, increasing structural risk.`);
  } else if (metrics.phishingPercentage !== null) {
    rows.push(`Phishing exposure is contained at ${metrics.phishingPercentage}%.`);
  }

  if (metrics.insiderPercentage === 0) {
    rows.push("Insider participation appears clean at 0%.");
  } else if ((metrics.insiderPercentage ?? 0) >= 5) {
    rows.push(`Insider participation is elevated at ${metrics.insiderPercentage}%.`);
  }

  if ((metrics.bundlerPercentage ?? 0) <= 3 && metrics.bundlerPercentage !== null) {
    rows.push(`Bundler exposure is low at ${metrics.bundlerPercentage}%.`);
  } else if ((metrics.bundlerPercentage ?? 0) >= 5) {
    rows.push(`Bundler exposure is elevated at ${metrics.bundlerPercentage}%.`);
  }

  if ((metrics.top10HolderPercentage ?? 0) <= 20 && metrics.top10HolderPercentage !== null) {
    rows.push(`Top 10 holder concentration is healthy at ${metrics.top10HolderPercentage}%.`);
  } else if ((metrics.top10HolderPercentage ?? 0) >= 35) {
    rows.push(`Top 10 holder concentration is elevated at ${metrics.top10HolderPercentage}%.`);
  }

  if ((metrics.sellPressure ?? 0) > 0.55) {
    rows.push("24h sell volume exceeds buy volume, adding market pressure.");
  }

  const holderQualityBase = metrics.weightedWalletAlpha ?? metrics.holderAlphaScore;
  if ((holderQualityBase ?? 50) >= 65) {
    rows.push("Holder quality is strong, reducing holder-risk pressure.");
    rows.push("Holder quality risk is controlled because weighted wallet alpha is above 65.");
  } else if ((holderQualityBase ?? 50) < 45) {
    rows.push("Holder quality is weak, increasing holder-risk pressure.");
    rows.push("Holder quality risk is elevated because weighted wallet alpha is below 50.");
  } else {
    rows.push("Holder quality is average, so holder-risk remains moderate.");
  }

  if (
    metrics.weakOrToxicOwnershipPercent !== null &&
    metrics.goodOrBetterOwnershipPercent !== null &&
    metrics.weakOrToxicOwnershipPercent > metrics.goodOrBetterOwnershipPercent
  ) {
    rows.push("Weak/toxic ownership materially exceeds good-or-better ownership.");
  }

  if (subScores.suspiciousLabelPressure < 15) {
    rows.push("Label-based holder risk is low because sniper/bundler/suspicious ownership is limited.");
  } else if (subScores.suspiciousLabelPressure >= 45) {
    rows.push("Label-based holder risk is elevated because suspicious holder-label ownership is meaningful.");
  }

  if ((metrics.holderAlphaConfidenceScore ?? 100) < 50) {
    rows.push("Holder Alpha confidence is low; this is reported as uncertainty rather than directly increasing holder risk.");
  } else {
    rows.push("Holder Alpha confidence is used for reliability context, not as a direct risk penalty.");
  }

  if (metrics.trendDirection === "deteriorating") {
    rows.push("Recent holder behavior is deteriorating, adding behavioral risk.");
  } else if (metrics.trendDirection === "improving") {
    rows.push("Recent holder behavior is improving, reducing behavioral risk.");
  }

  if ((metrics.coverageRate ?? 0) >= 0.8) {
    rows.push("Full-history coverage is strong, reducing confidence risk.");
  } else if (metrics.coverageRate !== null) {
    rows.push("History coverage is partial, increasing confidence risk.");
  }

  rows.push(`Risk Pressure is ${riskPressureScore}/100 after combining structural, holder, market, behavioral, and confidence risk.`);
  rows.push(`Highest current sub-risk is ${Math.max(...Object.values(subScores))}/100.`);

  return rows;
}

export function computeRiskPressureV1(input: RiskPressureInputV1): RiskPressureResultV1 {
  const warnings = [...(input.warnings ?? []), ...(input.riskStats?.warnings ?? [])];
  const metrics = buildMetrics(input);
  const devOwnership = metrics.suspiciousDevOwnershipPercentage;
  const insiderRiskScore = scoreInsiderRisk(input.riskStats ?? null, warnings);
  const phishingRiskScore = scorePhishingRisk(input.riskStats ?? null, warnings);
  const bundlerRiskScore = scoreBundlerRisk(input.riskStats ?? null, warnings);
  const sniperRiskScore = scoreSniperRisk(input.riskStats ?? null, warnings);
  const freshWalletRiskScore = scoreFreshWalletRisk(input.riskStats ?? null, warnings);
  const botDegenRiskScore = scoreBotDegenRisk(input.riskStats ?? null, warnings);
  const devOwnershipRiskScore = scoreDevOwnershipRisk(devOwnership, warnings);
  const top10ConcentrationRiskScore = scoreTop10ConcentrationRisk({
    stats: input.riskStats ?? null,
    structuralSafety: input.structuralSafety ?? null,
    warnings,
  });
  const structuralRiskScore = clampScore(
    insiderRiskScore * 0.2 +
      phishingRiskScore * 0.2 +
      bundlerRiskScore * 0.15 +
      sniperRiskScore * 0.1 +
      freshWalletRiskScore * 0.1 +
      botDegenRiskScore * 0.1 +
      devOwnershipRiskScore * 0.1 +
      top10ConcentrationRiskScore * 0.05
  );
  const holderQualityRiskScoreValue = holderQualityRiskScore(metrics, warnings);
  const weakHolderRiskScore = weakHolderOwnershipPressure(metrics);
  const toxicOwnershipRiskScore = toxicOwnershipPressure(metrics);
  const suspiciousLabelRiskScore = suspiciousLabelPressure(metrics);
  const holderRiskScore = clampScore(
    holderQualityRiskScoreValue * 0.45 +
      weakHolderRiskScore * 0.35 +
      toxicOwnershipRiskScore * 0.1 +
      suspiciousLabelRiskScore * 0.1
  );
  const liquidityRiskScore = scoreLiquidityRisk(metrics.liquidityUsd, warnings);
  const marketCapRiskScore = scoreMarketCapRisk(metrics.marketCapApprox, warnings);
  const volumeLiquidityRiskScore = scoreVolumeLiquidityRisk(metrics.volumeLiquidityRatio, warnings);
  const sellPressureRiskScore = scoreSellPressureRisk(metrics.sellPressure, warnings);
  const marketRiskScore = clampScore(
    liquidityRiskScore * 0.35 +
      marketCapRiskScore * 0.25 +
      volumeLiquidityRiskScore * 0.2 +
      sellPressureRiskScore * 0.2
  );
  const behavioralWeaknessRisk = clampScore(100 - (metrics.behavioralConvictionScore ?? 50));
  const holdingWeaknessRisk = clampScore(100 - (metrics.holdingScore ?? 50));
  const sellPressureBehaviorRisk =
    input.behavioralConviction?.holderMetrics.sellShare !== undefined &&
    input.behavioralConviction.holderMetrics.sellShare !== null
      ? scoreSellPressureRisk(ratioValue(input.behavioralConviction.holderMetrics.sellShare), warnings)
      : clampScore(100 - (metrics.distributionScore ?? 50));
  const trendDeteriorationRiskScore = trendRisk({
    trendDirection: metrics.trendDirection,
    last30dPnl: metrics.last30dPnl,
    previous30dPnl: metrics.previous30dPnl,
  });

  addWarning(warnings, !input.behavioralConviction, "Behavioral module unavailable; neutral behavioral risk fallbacks used.");

  const behavioralRiskScore = clampScore(
    behavioralWeaknessRisk * 0.35 +
      holdingWeaknessRisk * 0.2 +
      sellPressureBehaviorRisk * 0.2 +
      trendDeteriorationRiskScore * 0.25
  );
  const confidenceRiskScore = computeConfidenceRisk(metrics, warnings);
  const dataCoverageRiskScore = confidenceRiskScore;
  const subScores = {
    insiderRiskScore,
    phishingRiskScore,
    bundlerRiskScore,
    sniperRiskScore,
    freshWalletRiskScore,
    botDegenRiskScore,
    devOwnershipRiskScore,
      top10ConcentrationRiskScore,
      holderQualityRiskScore: holderQualityRiskScoreValue,
      weakHolderRiskScore,
      toxicOwnershipRiskScore,
      suspiciousLabelPressure: suspiciousLabelRiskScore,
    liquidityRiskScore,
    volumeLiquidityRiskScore,
    sellPressureRiskScore,
    trendDeteriorationRiskScore,
    dataCoverageRiskScore,
  };
  const riskPressureScore = clampScore(
    structuralRiskScore * 0.3 +
      holderRiskScore * 0.2 +
      marketRiskScore * 0.2 +
      behavioralRiskScore * 0.2 +
      confidenceRiskScore * 0.1
  );

  return {
    riskPressureScore,
    structuralRiskScore,
    holderRiskScore,
    marketRiskScore,
    behavioralRiskScore,
    confidenceRiskScore,
    subScores,
    metrics,
    explanations: buildExplanations({
      metrics,
      subScores,
      riskPressureScore,
    }),
    warnings: Array.from(new Set(warnings)),
  };
}
