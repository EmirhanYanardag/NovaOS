import { DEFAULT_CONVICTION_CONFIG } from "./conviction-engine-config";

export type ConvictionWalletInput = {
  rank: number;
  address: string;
  balance?: number;
  ownershipPercent?: number;
  walletAgeDays?: number;
  transactionCount?: number;
  recentTx30d?: number;
  recentTx7d?: number;
  daysSinceLastActive?: number;
  nativeBalanceUsd?: number;
  tokenTransferInCount?: number;
  tokenTransferOutCount?: number;
  tokenHoldDays?: number;
  interactedTokenCount?: number;
  deepBotLikeActivityRisk?: number;
  deepRotationBehaviorRisk?: number;
  deepTokenSpecificConvictionScore?: number;
  deepWalletBehaviorQualityScore?: number;
  isContract?: boolean;
  isExchange?: boolean;
  isFreshWallet?: boolean;
  clusterRiskScore?: number;
  fundingSimilarityScore?: number;
};

export type ConvictionMarketInput = {
  liquidityUsd?: number;
  marketCapUsd?: number;
  volume24hUsd?: number;
  priceChange24h?: number;
  volumeChange24h?: number;
};

export type ConvictionClusterInput = {
  averageClusterConfidence?: number;
  clusteredWalletPercent?: number;
  dominantRelationshipType?: string;
  elevatedRiskClusterCount?: number;
};

export type ConvictionEngineInput = {
  chain: string;
  tokenAddress: string;
  tokenSymbol?: string;
  holders: ConvictionWalletInput[];
  market?: ConvictionMarketInput;
  cluster?: ConvictionClusterInput;
  holderCount?: number;
  top10OwnershipPercent?: number;
  top25OwnershipPercent?: number;
  top100OwnershipPercent?: number;
  contractHolderCount?: number;
  exchangeHolderCount?: number;
  bundleRiskScore?: number;
  fundingSimilarityScore?: number;
  fakeDecentralizationRisk?: number;
};

type WeightedItem = {
  value: number;
  weight: number;
};

export type ConvictionWalletBreakdown = {
  address: string;
  rank: number;
  scores: {
    maturity: number;
    activity: number;
    dormancyRisk: number;
    botActivityRisk: number;
    rotationRisk: number;
    concentrationRisk: number;
    convictionBehavior: number;
    walletQuality: number;
  };
  labels: {
    behaviorClass: string;
    riskClass: string;
  };
  explanation: {
    positives: string[];
    negatives: string[];
  };
};

export type WalletScoreAggregation = {
  top10WalletQuality: number;
  top25WalletQuality: number;
  top100WalletQuality: number;
  weightedWalletQuality: number;
  averageBotRisk: number;
  averageRotationRisk: number;
  averageConcentrationRisk: number;
  averageDormancyRisk: number;
  freshWalletPercent: number;
  contractWalletPercent: number;
  exchangeWalletPercent: number;
  dataCoverage: number;
};

export type ConvictionSubScores = {
  holderIntegrity: number;
  walletQuality: number;
  behaviorStability: number;
  liquidityTrust: number;
  marketMomentum: number;
  riskProtection: number;
  insiderRisk: number;
  clusterRisk: number;
  botActivityRisk: number;
  rotationRisk: number;
  freshWalletRisk: number;
};

export type ConvictionExplanation = {
  headline: string;
  positives: string[];
  negatives: string[];
  riskNotes: string[];
  methodology: string;
};

export type ConvictionDataConfidence = {
  score: number;
  label: "Low" | "Medium" | "High";
  warnings: string[];
};

export type ConvictionEngineResult = {
  finalConvictionScore: number;
  subScores: ConvictionSubScores;
  aggregation: WalletScoreAggregation;
  walletBreakdowns: ConvictionWalletBreakdown[];
  explanation: ConvictionExplanation;
  dataConfidence: ConvictionDataConfidence;
  warnings: string[];
};

export function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function safeNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function average(values: number[]) {
  const safeValues = values.filter((value) => Number.isFinite(value));
  if (safeValues.length === 0) return 0;
  return (
    safeValues.reduce((total, value) => total + value, 0) / safeValues.length
  );
}

export function weightedAverage(items: WeightedItem[]) {
  const safeItems = items.filter(
    (item) =>
      Number.isFinite(item.value) &&
      Number.isFinite(item.weight) &&
      item.weight > 0
  );
  const weightTotal = safeItems.reduce((total, item) => total + item.weight, 0);
  if (weightTotal === 0) return 0;
  return (
    safeItems.reduce((total, item) => total + item.value * item.weight, 0) /
    weightTotal
  );
}

export function scoreLabel(score: number) {
  const value = clamp(score);
  if (value >= 75) return "High";
  if (value >= 45) return "Medium";
  return "Low";
}

export function riskLabel(score: number) {
  const value = clamp(score);
  if (value >= 70) return "High risk";
  if (value >= 40) return "Medium risk";
  return "Low risk";
}

export function calculateWalletMaturityScore(wallet: ConvictionWalletInput) {
  const config = DEFAULT_CONVICTION_CONFIG.walletMaturity;
  const age = safeNumber(wallet.walletAgeDays, wallet.isFreshWallet ? 0 : 30);
  let score = 0;

  if (age <= config.veryFreshDays) score = config.veryFreshScore;
  else if (age <= config.freshDays) score = config.freshScore;
  else if (age <= config.mediumDays) score = config.mediumScore;
  else if (age <= config.matureDays) score = config.matureScore;
  else score = config.veryMatureScore;

  if (wallet.isFreshWallet) score -= config.freshWalletPenalty;
  if (wallet.isContract || wallet.isExchange) score -= config.systemWalletPenalty;

  return clamp(score);
}

export function calculateWalletActivityScore(wallet: ConvictionWalletInput) {
  const transactionCount = Math.max(0, safeNumber(wallet.transactionCount));
  const recentTx30d = Math.max(0, safeNumber(wallet.recentTx30d));
  const recentTx7d = Math.max(0, safeNumber(wallet.recentTx7d));

  return clamp(
    Math.log10(transactionCount + 1) * 20 + recentTx30d * 0.35 + recentTx7d * 0.75
  );
}

export function calculateDormancyRiskScore(wallet: ConvictionWalletInput) {
  const config = DEFAULT_CONVICTION_CONFIG.dormancyRisk;
  const days = safeNumber(wallet.daysSinceLastActive, config.fallbackDays);
  if (days <= config.veryRecentDays) return config.veryRecentScore;
  if (days <= config.recentDays) return config.recentScore;
  if (days <= config.mediumDays) return config.mediumScore;
  if (days <= config.elevatedDays) return config.elevatedScore;
  return config.highScore;
}

export function calculateBotActivityRiskScore(wallet: ConvictionWalletInput) {
  if (typeof wallet.deepBotLikeActivityRisk === "number") {
    return clamp(wallet.deepBotLikeActivityRisk);
  }

  const recentTx7d = Math.max(0, safeNumber(wallet.recentTx7d));
  const recentTx30d = Math.max(0, safeNumber(wallet.recentTx30d));
  const inCount = Math.max(0, safeNumber(wallet.tokenTransferInCount));
  const outCount = Math.max(0, safeNumber(wallet.tokenTransferOutCount));
  const totalTokenTransfers = inCount + outCount;
  const holdDays = safeNumber(wallet.tokenHoldDays, 45);
  const outRatio = totalTokenTransfers > 0 ? outCount / totalTokenTransfers : 0;

  let risk = 0;
  risk += clamp((recentTx7d - 25) * 1.4, 0, 34);
  risk += clamp((recentTx30d - 90) * 0.45, 0, 28);
  risk += clamp((totalTokenTransfers - 20) * 1.2, 0, 22);
  if (holdDays <= 2 && totalTokenTransfers >= 4) risk += 18;
  if (outRatio > 0.42 && outRatio < 0.62 && totalTokenTransfers >= 8) risk += 14;
  if (wallet.isFreshWallet && recentTx7d >= 12) risk += 20;
  if (wallet.isContract || wallet.isExchange) risk += 8;

  return clamp(risk);
}

export function calculateRotationRiskScore(wallet: ConvictionWalletInput) {
  if (typeof wallet.deepRotationBehaviorRisk === "number") {
    return clamp(wallet.deepRotationBehaviorRisk);
  }

  const interactedTokenCount = Math.max(0, safeNumber(wallet.interactedTokenCount));
  const inCount = Math.max(0, safeNumber(wallet.tokenTransferInCount));
  const outCount = Math.max(0, safeNumber(wallet.tokenTransferOutCount));
  const total = inCount + outCount;
  const outRatio = total > 0 ? outCount / total : 0;
  const holdDays = safeNumber(wallet.tokenHoldDays, 45);
  const recentActivity = safeNumber(wallet.recentTx30d) + safeNumber(wallet.recentTx7d);

  let risk = 0;
  risk += clamp(interactedTokenCount * 3.2, 0, 38);
  risk += clamp(outRatio * 42, 0, 42);
  if (holdDays <= 7 && total > 0) risk += 18;
  if (holdDays <= 2 && total >= 3) risk += 14;
  risk += clamp(recentActivity * 0.22, 0, 18);

  return clamp(risk);
}

export function calculateConcentrationRiskScore(wallet: ConvictionWalletInput) {
  const config = DEFAULT_CONVICTION_CONFIG.concentrationRisk;
  const ownership = Math.max(0, safeNumber(wallet.ownershipPercent));
  let risk = Math.min(100, ownership * config.baseOwnershipMultiplier);

  if (ownership > config.onePercentThreshold) {
    risk +=
      (ownership - config.onePercentThreshold) *
      config.onePercentPenaltyMultiplier;
  }
  if (ownership > config.fivePercentThreshold) {
    risk +=
      (ownership - config.fivePercentThreshold) *
      config.fivePercentPenaltyMultiplier;
  }
  if (ownership > config.tenPercentThreshold) {
    risk +=
      (ownership - config.tenPercentThreshold) *
      config.tenPercentPenaltyMultiplier;
  }

  return clamp(risk);
}

export function calculateWalletConvictionBehaviorScore(
  wallet: ConvictionWalletInput
): number {
  const inCount = Math.max(0, safeNumber(wallet.tokenTransferInCount));
  const outCount = Math.max(0, safeNumber(wallet.tokenTransferOutCount));
  const total = inCount + outCount;
  const accumulationRatio = total > 0 ? inCount / total : 0.5;
  const outRatio = total > 0 ? outCount / total : 0.5;
  const holdDays = safeNumber(wallet.tokenHoldDays, 30);
  const ownership = safeNumber(wallet.ownershipPercent);
  const dormancyRisk = calculateDormancyRiskScore(wallet);
  const botRisk = calculateBotActivityRiskScore(wallet);
  const concentrationRisk = calculateConcentrationRiskScore(wallet);

  if (typeof wallet.deepTokenSpecificConvictionScore === "number") {
    const fallbackScore = calculateWalletConvictionBehaviorScore({
      ...wallet,
      deepTokenSpecificConvictionScore: undefined,
    });
    return clamp(
      weightedAverage([
        { value: wallet.deepTokenSpecificConvictionScore, weight: 0.7 },
        { value: fallbackScore, weight: 0.3 },
      ])
    );
  }

  let score = 42;
  score += accumulationRatio * 26;
  score += clamp(Math.log10(holdDays + 1) * 16, 0, 26);
  score += clamp(ownership * 4, 0, 10);
  score -= outRatio * 18;
  score -= clamp(botRisk * 0.28, 0, 26);
  score -= clamp(dormancyRisk * 0.18, 0, 18);
  score -= concentrationRisk > 70 ? 18 : concentrationRisk > 45 ? 9 : 0;
  if (wallet.isFreshWallet) score -= 12;

  return clamp(score);
}

export function calculateWalletQualityScore(wallet: ConvictionWalletInput) {
  const weights = DEFAULT_CONVICTION_CONFIG.walletQualityWeights;
  const maturity = calculateWalletMaturityScore(wallet);
  const activity = calculateWalletActivityScore(wallet);
  const convictionBehavior = calculateWalletConvictionBehaviorScore(wallet);
  const concentrationRisk = calculateConcentrationRiskScore(wallet);
  const dormancyRisk = calculateDormancyRiskScore(wallet);
  const botRisk = calculateBotActivityRiskScore(wallet);
  const clusterRisk = clamp(safeNumber(wallet.clusterRiskScore));
  const fundingRisk = clamp(safeNumber(wallet.fundingSimilarityScore));

  let score = weightedAverage([
    { value: maturity, weight: weights.maturity },
    { value: activity, weight: weights.activity },
    { value: convictionBehavior, weight: weights.convictionBehavior },
    { value: 100 - concentrationRisk, weight: weights.concentrationProtection },
    { value: 100 - dormancyRisk, weight: weights.dormancyProtection },
    { value: 100 - botRisk, weight: weights.botProtection },
    {
      value: 100 - Math.max(clusterRisk, fundingRisk),
      weight: weights.clusterProtection,
    },
  ]);

  if (wallet.isFreshWallet && concentrationRisk > 55) score = Math.min(score, 38);
  if (botRisk > 75) score = Math.min(score, 42);
  if (wallet.isContract || wallet.isExchange) score = Math.min(score, 50);
  if (typeof wallet.deepWalletBehaviorQualityScore === "number") {
    score = weightedAverage([
      { value: wallet.deepWalletBehaviorQualityScore, weight: 0.58 },
      { value: score, weight: 0.42 },
    ]);
  }

  return clamp(score);
}

function classifyWallet(
  wallet: ConvictionWalletInput,
  scores: ConvictionWalletBreakdown["scores"]
) {
  if (wallet.isContract) return "contract/system";
  if (wallet.isExchange) return "exchange/system";
  if (wallet.isFreshWallet || scores.maturity < 25) return "fresh wallet";
  if (scores.botActivityRisk >= 70) return "bot-like activity risk";
  if (scores.rotationRisk >= 70) return "rotation-heavy holder";
  if (scores.concentrationRisk >= 70) return "concentrated holder";
  if (scores.convictionBehavior >= 70) return "conviction holder";
  if (scores.activity >= 65) return "active holder";
  return "passive holder";
}

export function calculateWalletBreakdown(
  wallet: ConvictionWalletInput
): ConvictionWalletBreakdown {
  const scores = {
    maturity: Math.round(calculateWalletMaturityScore(wallet)),
    activity: Math.round(calculateWalletActivityScore(wallet)),
    dormancyRisk: Math.round(calculateDormancyRiskScore(wallet)),
    botActivityRisk: Math.round(calculateBotActivityRiskScore(wallet)),
    rotationRisk: Math.round(calculateRotationRiskScore(wallet)),
    concentrationRisk: Math.round(calculateConcentrationRiskScore(wallet)),
    convictionBehavior: Math.round(calculateWalletConvictionBehaviorScore(wallet)),
    walletQuality: Math.round(calculateWalletQualityScore(wallet)),
  };
  const positives: string[] = [];
  const negatives: string[] = [];

  if (scores.maturity >= 70) positives.push("Wallet age supports maturity.");
  if (scores.convictionBehavior >= 65) {
    positives.push("Transfer pattern leans toward accumulation or longer holding.");
  }
  if (scores.activity >= 55 && scores.botActivityRisk < 50) {
    positives.push("Wallet activity is meaningful without strong bot-like signals.");
  }
  if (scores.concentrationRisk >= 60) {
    negatives.push("Ownership concentration adds holder risk.");
  }
  if (scores.botActivityRisk >= 55) {
    negatives.push("Recent transfer pattern may be repetitive or short-cycle.");
  }
  if (scores.rotationRisk >= 55) {
    negatives.push("Wallet behavior indicates elevated rotation risk.");
  }
  if (scores.dormancyRisk >= 60) {
    negatives.push("Wallet has elevated inactivity or dormancy risk.");
  }
  if (wallet.isFreshWallet) negatives.push("Fresh wallet status lowers quality.");

  return {
    address: wallet.address,
    rank: wallet.rank,
    scores,
    labels: {
      behaviorClass: classifyWallet(wallet, scores),
      riskClass: riskLabel(
        average([
          scores.dormancyRisk,
          scores.botActivityRisk,
          scores.rotationRisk,
          scores.concentrationRisk,
        ])
      ),
    },
    explanation: { positives, negatives },
  };
}

export function aggregateWalletScores(
  wallets: ConvictionWalletInput[]
): WalletScoreAggregation {
  const sortedWallets = [...wallets].sort((a, b) => a.rank - b.rank);
  const breakdowns = sortedWallets.map(calculateWalletBreakdown);
  const top10 = breakdowns.slice(0, 10);
  const top25 = breakdowns.slice(0, 25);
  const all = breakdowns;
  const top10WalletQuality = average(top10.map((item) => item.scores.walletQuality));
  const top25WalletQuality = average(top25.map((item) => item.scores.walletQuality));
  const top100WalletQuality = average(all.map((item) => item.scores.walletQuality));
  const weightedWalletQuality = weightedAverage([
    { value: top10WalletQuality, weight: top10.length ? 0.5 : 0 },
    { value: top25WalletQuality, weight: top25.length ? 0.3 : 0 },
    { value: top100WalletQuality, weight: all.length ? 0.2 : 0 },
  ]);
  const denominator = Math.max(sortedWallets.length, 1);

  return {
    top10WalletQuality: Math.round(top10WalletQuality),
    top25WalletQuality: Math.round(top25WalletQuality),
    top100WalletQuality: Math.round(top100WalletQuality),
    weightedWalletQuality: Math.round(weightedWalletQuality),
    averageBotRisk: Math.round(average(all.map((item) => item.scores.botActivityRisk))),
    averageRotationRisk: Math.round(
      average(all.map((item) => item.scores.rotationRisk))
    ),
    averageConcentrationRisk: Math.round(
      average(all.map((item) => item.scores.concentrationRisk))
    ),
    averageDormancyRisk: Math.round(
      average(all.map((item) => item.scores.dormancyRisk))
    ),
    freshWalletPercent: Math.round(
      (sortedWallets.filter((wallet) => wallet.isFreshWallet).length / denominator) *
        100
    ),
    contractWalletPercent: Math.round(
      (sortedWallets.filter((wallet) => wallet.isContract).length / denominator) *
        100
    ),
    exchangeWalletPercent: Math.round(
      (sortedWallets.filter((wallet) => wallet.isExchange).length / denominator) *
        100
    ),
    dataCoverage: Math.round(clamp((sortedWallets.length / 100) * 100)),
  };
}

export function calculateHolderIntegrityScore(
  input: ConvictionEngineInput,
  aggregation: WalletScoreAggregation
) {
  const top10 = safeNumber(input.top10OwnershipPercent);
  const top25 = safeNumber(input.top25OwnershipPercent);
  const contractPercent =
    input.holderCount && input.contractHolderCount
      ? (input.contractHolderCount / input.holderCount) * 100
      : aggregation.contractWalletPercent;
  const exchangePercent =
    input.holderCount && input.exchangeHolderCount
      ? (input.exchangeHolderCount / input.holderCount) * 100
      : aggregation.exchangeWalletPercent;

  let score = 86;
  score -= clamp((top10 - 15) * 1.2, 0, 30);
  score -= clamp((top25 - 35) * 0.9, 0, 28);
  score -= aggregation.freshWalletPercent * 0.25;
  score -= contractPercent * 0.18;
  score -= exchangePercent * 0.12;
  score -= aggregation.averageConcentrationRisk * 0.22;

  return Math.round(clamp(score));
}

export function calculateBehaviorStabilityScore(
  aggregation: WalletScoreAggregation
) {
  return Math.round(
    clamp(
      aggregation.weightedWalletQuality * 0.38 +
        (100 - aggregation.averageBotRisk) * 0.24 +
        (100 - aggregation.averageRotationRisk) * 0.2 +
        (100 - aggregation.averageDormancyRisk) * 0.18
    )
  );
}

export function calculateLiquidityTrustScore(market?: ConvictionMarketInput) {
  const config = DEFAULT_CONVICTION_CONFIG.liquidityTrust;
  if (!market) return config.unavailableScore;

  const liquidity = safeNumber(market.liquidityUsd);
  const marketCap = safeNumber(market.marketCapUsd);
  const volume = safeNumber(market.volume24hUsd);
  const liquidityRatio = marketCap > 0 ? liquidity / marketCap : 0;
  const volumeLiquidityRatio = liquidity > 0 ? volume / liquidity : 0;

  let score = config.baseScore;
  score += clamp(
    Math.log10(liquidity + 1) * config.logLiquidityWeight,
    0,
    config.maxLogLiquidityScore
  );
  score += clamp(
    liquidityRatio * config.liquidityRatioWeight,
    0,
    config.maxLiquidityRatioScore
  );
  score +=
    volumeLiquidityRatio > config.healthyVolumeLiquidityMin &&
    volumeLiquidityRatio < config.healthyVolumeLiquidityMax
      ? config.healthyVolumeLiquidityBonus
      : 0;
  if (liquidity < config.lowLiquidityThresholdUsd) {
    score -= config.lowLiquidityPenalty;
  }
  if (
    marketCap > config.highMarketCapThresholdUsd &&
    liquidityRatio < config.weakLiquidityRatioThreshold
  ) {
    score -= config.weakLiquidityPenalty;
  }
  if (volumeLiquidityRatio > config.extremeVolumeLiquidityRatio) {
    score -= config.extremeVolumePenalty;
  }

  return Math.round(clamp(score));
}

export function calculateMarketMomentumScore(market?: ConvictionMarketInput) {
  if (!market) return 35;

  const volume = safeNumber(market.volume24hUsd);
  const volumeChange = safeNumber(market.volumeChange24h);
  const priceChange = safeNumber(market.priceChange24h);

  let score = 42;
  score += clamp(Math.log10(volume + 1) * 7, 0, 32);
  score += clamp(volumeChange * 0.18, -18, 18);
  score += clamp(Math.abs(priceChange) * 0.2, 0, 10);
  if (Math.abs(priceChange) > 70) score -= 18;
  if (priceChange < -35) score -= 12;

  return Math.round(clamp(score));
}

export function calculateClusterRiskScore(
  cluster: ConvictionClusterInput | undefined,
  aggregation: WalletScoreAggregation
) {
  if (!cluster) return Math.round(clamp(aggregation.averageConcentrationRisk * 0.4));

  const clusteredPercent = safeNumber(cluster.clusteredWalletPercent);
  const confidence = safeNumber(cluster.averageClusterConfidence);
  const elevatedClusters = safeNumber(cluster.elevatedRiskClusterCount);
  let risk = clusteredPercent * 0.42 + confidence * 0.18 + elevatedClusters * 12;

  if (
    cluster.dominantRelationshipType?.toLowerCase().includes("possible coordination")
  ) {
    risk += 18;
  }

  return Math.round(clamp(risk));
}

export function calculateInsiderRiskScore(
  input: ConvictionEngineInput,
  aggregation: WalletScoreAggregation,
  cluster?: ConvictionClusterInput
) {
  const top10 = safeNumber(input.top10OwnershipPercent);
  const top25 = safeNumber(input.top25OwnershipPercent);
  const clusteredPercent = safeNumber(cluster?.clusteredWalletPercent);
  const elevatedClusters = safeNumber(cluster?.elevatedRiskClusterCount);
  const bundleRisk = safeNumber(input.bundleRiskScore);
  const inputFundingSimilarity = safeNumber(input.fundingSimilarityScore);
  const fakeDecentralizationRisk = safeNumber(input.fakeDecentralizationRisk);
  const walletFundingSimilarity = average(
    input.holders.map((wallet) => safeNumber(wallet.fundingSimilarityScore))
  );
  const fundingSimilarity = Math.max(inputFundingSimilarity, walletFundingSimilarity);

  return Math.round(
    clamp(
      top10 * 1.2 +
        top25 * 0.55 +
        clusteredPercent * 0.32 +
        elevatedClusters * 10 +
        fundingSimilarity * 0.22 +
        bundleRisk * 0.3 +
        fakeDecentralizationRisk * 0.24 +
        aggregation.freshWalletPercent * 0.2 +
        aggregation.contractWalletPercent * 0.16 +
        aggregation.averageConcentrationRisk * 0.24
    )
  );
}

export function calculateRiskProtectionScore(
  input: ConvictionEngineInput,
  aggregation: WalletScoreAggregation,
  cluster?: ConvictionClusterInput
) {
  const insiderRisk = calculateInsiderRiskScore(input, aggregation, cluster);
  const clusterRisk = calculateClusterRiskScore(cluster, aggregation);
  const liquidityTrust = calculateLiquidityTrustScore(input.market);
  const liquidityRisk = 100 - liquidityTrust;
  const bundleRisk = safeNumber(input.bundleRiskScore);

  return Math.round(
    clamp(
      100 -
        weightedAverage([
          { value: insiderRisk, weight: 0.28 },
          { value: clusterRisk, weight: 0.18 },
          { value: aggregation.averageBotRisk, weight: 0.18 },
          { value: aggregation.averageRotationRisk, weight: 0.14 },
          { value: aggregation.averageConcentrationRisk, weight: 0.14 },
          { value: liquidityRisk, weight: 0.08 },
          { value: bundleRisk, weight: 0.12 },
        ])
    )
  );
}

export function calculateFinalConvictionScore(subscores: ConvictionSubScores) {
  const weights = DEFAULT_CONVICTION_CONFIG.finalConvictionWeights;
  const penalties = DEFAULT_CONVICTION_CONFIG.severeRiskPenalties;
  const caps = DEFAULT_CONVICTION_CONFIG.finalConvictionCaps;
  let finalScore =
    weights.holderIntegrity * subscores.holderIntegrity +
    weights.walletQuality * subscores.walletQuality +
    weights.behaviorStability * subscores.behaviorStability +
    weights.liquidityTrust * subscores.liquidityTrust +
    weights.marketMomentum * subscores.marketMomentum +
    weights.riskProtection * subscores.riskProtection;

  if (
    subscores.insiderRisk > penalties.insiderRiskThreshold ||
    subscores.clusterRisk > penalties.clusterRiskThreshold ||
    subscores.botActivityRisk > penalties.botActivityRiskThreshold
  ) {
    finalScore -= penalties.finalScorePenalty;
  }

  if (subscores.liquidityTrust < caps.lowLiquidityTrustThreshold) {
    finalScore = Math.min(finalScore, caps.lowLiquidityMaxConviction);
  }
  if (subscores.holderIntegrity < caps.lowHolderIntegrityThreshold) {
    finalScore = Math.min(finalScore, caps.lowHolderIntegrityMaxConviction);
  }

  return Math.round(clamp(finalScore));
}

export function calculateDataConfidence(
  input: ConvictionEngineInput,
  aggregation: WalletScoreAggregation
): ConvictionDataConfidence {
  const holdersAnalyzed = input.holders.length;
  const walletsWithAge = input.holders.filter(
    (wallet) => typeof wallet.walletAgeDays === "number"
  ).length;
  const walletsWithTransfers = input.holders.filter(
    (wallet) =>
      typeof wallet.tokenTransferInCount === "number" ||
      typeof wallet.tokenTransferOutCount === "number"
  ).length;
  const warnings: string[] = [];

  let score = 0;
  score += clamp((holdersAnalyzed / 100) * 38);
  score += clamp((walletsWithAge / Math.max(holdersAnalyzed, 1)) * 18);
  score += clamp((walletsWithTransfers / Math.max(holdersAnalyzed, 1)) * 18);
  score += input.market ? 14 : 0;
  score += input.cluster ? 12 : 0;
  score = Math.min(score, aggregation.dataCoverage + 35);

  if (holdersAnalyzed < 10) warnings.push("Fewer than 10 wallets were analyzed.");
  if (holdersAnalyzed <= 5) score = Math.min(score, 44);
  if (!input.market) warnings.push("Market data was unavailable.");
  if (!input.cluster) warnings.push("Cluster data was unavailable.");
  if (walletsWithTransfers < holdersAnalyzed * 0.5) {
    warnings.push("Transfer-level wallet data is incomplete.");
  }

  return {
    score: Math.round(clamp(score)),
    label: score >= 72 ? "High" : score >= 45 ? "Medium" : "Low",
    warnings,
  };
}

export function generateConvictionExplanation(
  input: ConvictionEngineInput,
  subscores: ConvictionSubScores,
  aggregation: WalletScoreAggregation,
  walletBreakdowns: ConvictionWalletBreakdown[]
): ConvictionExplanation {
  const finalScore = calculateFinalConvictionScore(subscores);
  const positives: string[] = [];
  const negatives: string[] = [];
  const riskNotes: string[] = [];

  if (subscores.holderIntegrity >= 65) {
    positives.push("Holder distribution is relatively balanced.");
  }
  if (subscores.walletQuality >= 65) {
    positives.push("Top-wallet quality is supported by maturity and behavior signals.");
  }
  if (subscores.behaviorStability >= 65) {
    positives.push("Wallet behavior appears stable relative to bot and rotation risk.");
  }
  if (subscores.liquidityTrust >= 65) {
    positives.push("Liquidity structure supports stronger market trust.");
  }
  if (subscores.holderIntegrity < 45) {
    negatives.push("Holder concentration or fresh-wallet exposure weakens integrity.");
  }
  if (subscores.insiderRisk >= 65) {
    negatives.push("Insider-risk inputs are elevated from concentration or cluster signals.");
  }
  if (subscores.botActivityRisk >= 55) {
    negatives.push("Bot-like or short-cycle transfer behavior is elevated.");
  }
  if (subscores.rotationRisk >= 55) {
    negatives.push("Rotation risk is elevated across analyzed wallets.");
  }
  if (subscores.liquidityTrust < 35) {
    negatives.push("Liquidity trust is weak relative to market structure.");
  }

  const highRiskWallets = walletBreakdowns.filter(
    (wallet) => wallet.labels.riskClass === "High risk"
  ).length;
  if (highRiskWallets > 0) {
    riskNotes.push(`${highRiskWallets} analyzed wallets have high behavioral risk.`);
  }
  if (aggregation.freshWalletPercent > 25) {
    riskNotes.push("Fresh-wallet share is high enough to reduce confidence.");
  }
  if (safeNumber(input.top10OwnershipPercent) > 40) {
    riskNotes.push("Top 10 ownership concentration is elevated.");
  }

  const headline =
    finalScore >= 70
      ? "Conviction is high because holder quality, behavior stability, and risk protection are aligned."
      : finalScore >= 45
      ? "Conviction is mixed because supportive behavior signals are balanced by material risk factors."
      : "Conviction is low because holder concentration, wallet behavior risk, or liquidity weakness dominate the current structure.";

  return {
    headline,
    positives,
    negatives,
    riskNotes,
    methodology:
      "Conviction Engine V1 is deterministic behavioral inference from normalized holder, wallet, cluster, and market inputs. It is not financial advice, not a price prediction, and does not calculate PnL, win rate, smart-money identity, or insider identity.",
  };
}

export function calculateConvictionEngine(
  input: ConvictionEngineInput
): ConvictionEngineResult {
  const walletBreakdowns = [...input.holders]
    .sort((a, b) => a.rank - b.rank)
    .map(calculateWalletBreakdown);
  const aggregation = aggregateWalletScores(input.holders);
  const holderIntegrity = calculateHolderIntegrityScore(input, aggregation);
  const walletQuality = aggregation.weightedWalletQuality;
  const behaviorStability = calculateBehaviorStabilityScore(aggregation);
  const liquidityTrust = calculateLiquidityTrustScore(input.market);
  const marketMomentum = calculateMarketMomentumScore(input.market);
  const insiderRisk = calculateInsiderRiskScore(input, aggregation, input.cluster);
  const clusterRisk = Math.round(
    clamp(
      Math.max(
        calculateClusterRiskScore(input.cluster, aggregation),
        safeNumber(input.fakeDecentralizationRisk) * 0.85
      )
    )
  );
  const riskProtection = calculateRiskProtectionScore(
    input,
    aggregation,
    input.cluster
  );
  const subScores: ConvictionSubScores = {
    holderIntegrity,
    walletQuality,
    behaviorStability,
    liquidityTrust,
    marketMomentum,
    riskProtection,
    insiderRisk,
    clusterRisk,
    botActivityRisk: aggregation.averageBotRisk,
    rotationRisk: aggregation.averageRotationRisk,
    freshWalletRisk: aggregation.freshWalletPercent,
  };
  let finalConvictionScore = calculateFinalConvictionScore(subScores);
  const bundleRisk = safeNumber(input.bundleRiskScore);
  if (bundleRisk > 90) finalConvictionScore = Math.min(finalConvictionScore, 35);
  else if (bundleRisk > 80) {
    finalConvictionScore = Math.min(finalConvictionScore, 45);
  }
  const dataConfidence = calculateDataConfidence(input, aggregation);
  const warnings = [
    "Wallet profitability is not calculated in Conviction Engine V1.",
    "Win rate is not calculated in Conviction Engine V1.",
    "This is behavioral inference, not financial advice.",
    ...dataConfidence.warnings,
  ];

  return {
    finalConvictionScore,
    subScores,
    aggregation,
    walletBreakdowns,
    explanation: generateConvictionExplanation(
      input,
      subScores,
      aggregation,
      walletBreakdowns
    ),
    dataConfidence,
    warnings,
  };
}
