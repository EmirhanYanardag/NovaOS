export type ConvictionFormulaV3Direction = "V3 Higher" | "V3 Lower" | "Similar";

export type ConvictionFormulaV3Magnitude = "Similar" | "Moderate" | "Major";

export type ConvictionFormulaV3Input = {
  v1: {
    finalConvictionScore: number;
    subScores: {
      holderIntegrity?: number;
      walletQuality?: number;
      behaviorStability?: number;
      liquidityTrust?: number;
      marketMomentum?: number;
      riskProtection?: number;
      insiderRisk?: number;
      clusterRisk?: number;
      botActivityRisk?: number;
      rotationRisk?: number;
      freshWalletRisk?: number;
    };
    dataConfidence?: {
      score?: number;
      label?: "Low" | "Medium" | "High";
      warnings?: string[];
    };
    warnings?: string[];
  };
  v2?: {
    finalConvictionScoreV2?: number;
    subScores?: Record<string, number | undefined>;
    limitingFactors?: string[];
    missingEvidence?: string[];
  } | null;
  walletReputation?: {
    analyzedWallets?: number;
    averageReputation?: number;
    averageConvictionContribution?: number;
    averageRiskContribution?: number;
    strongWallets?: number;
    highRiskWallets?: number;
    dominantWalletClass?: string;
    summaryVerdict?: string;
    topPositiveWallets?: Array<{
      reputationScore?: number;
      convictionContribution?: number;
      riskContribution?: number;
    }>;
    topRiskWallets?: Array<{
      reputationScore?: number;
      convictionContribution?: number;
      riskContribution?: number;
    }>;
  } | null;
  holderIntelligence?: {
    analyzedHolders?: number;
    averageHolderScore?: number;
    averageConfidence?: number;
    averageRiskContribution?: number;
    averageConvictionContribution?: number;
    strongSupportHolders?: number;
    strongRiskHolders?: number;
    dominantHolderClass?: string;
    dominantRiskType?: string;
    highestConvictionHolder?: {
      overallHolderScore?: number;
      convictionContributionScore?: number;
      riskContributionScore?: number;
      ownershipPercentage?: number;
    };
    highestRiskHolder?: {
      overallHolderScore?: number;
      convictionContributionScore?: number;
      riskContributionScore?: number;
      ownershipPercentage?: number;
    };
    topPositiveDrivers?: string[];
    topRiskDrivers?: string[];
    summaryVerdict?: string;
  } | null;
  insiderMath?: {
    insiderRiskScore?: number;
    concentrationPressureScore?: number;
    clusterExposureScore?: number;
    bundleStructureScore?: number;
    freshOwnershipScore?: number;
    contractDominanceScore?: number;
    relationshipIntensityScore?: number;
    evidenceConfidenceScore?: number;
    riskTier?: string;
    detectedPatterns?: Array<{ label?: string; severity?: string }>;
  } | null;
  walletFlow?: {
    accumulationPressure?: number;
    distributionPressure?: number;
    rotationPressure?: number;
    dormancyPressure?: number;
    netFlowBias?: number;
    flowConfidence?: number;
    dominantFlow?: string;
    topAccumulationDrivers?: unknown[];
    topDistributionDrivers?: unknown[];
    topRotationDrivers?: unknown[];
  } | null;
  market?: {
    liquidityTrust?: number;
    marketMomentum?: number;
    liquidityUsd?: number;
    volume24hUsd?: number;
    marketCapUsd?: number;
    priceChange24h?: number;
  };
};

export type ConvictionFormulaV3Result = {
  finalConvictionScoreV3: number;
  rawConvictionScoreV3: number;
  formulaVersion: "v3-preview";
  pillarScores: {
    holderQualityScore: number;
    structuralSafetyScore: number;
    marketIntegrityScore: number;
  };
  riskCapsApplied: string[];
  positiveDrivers: string[];
  negativeDrivers: string[];
  limitingFactors: string[];
  missingEvidence: string[];
  methodologyNotes: string[];
};

export type ConvictionFormulaV3Comparison = {
  v1Score: number;
  v2Score?: number;
  v3Score: number;
  deltaV1ToV3: number;
  deltaV2ToV3?: number;
  directionV1ToV3: ConvictionFormulaV3Direction;
  directionV2ToV3?: ConvictionFormulaV3Direction;
  magnitudeV1ToV3: ConvictionFormulaV3Magnitude;
  magnitudeV2ToV3?: ConvictionFormulaV3Magnitude;
  comparisonSummary: string;
  reasons: string[];
};

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function average(values: Array<number | undefined>) {
  const safeValues = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value)
  );
  if (!safeValues.length) return undefined;
  return safeValues.reduce((total, value) => total + value, 0) / safeValues.length;
}

function inverse(value?: number) {
  return value === undefined ? undefined : 100 - clampScore(value);
}

function weightedScore(parts: Array<{ score?: number; weight: number }>) {
  const available = parts.filter(
    (part): part is { score: number; weight: number } =>
      typeof part.score === "number" && Number.isFinite(part.score)
  );
  if (!available.length) return undefined;
  const totalWeight = available.reduce((total, part) => total + part.weight, 0);
  return available.reduce((total, part) => total + part.score * part.weight, 0) / totalWeight;
}

function ratioScore(positive?: number, negative?: number) {
  if (positive === undefined || negative === undefined) return undefined;
  const total = positive + negative;
  if (total <= 0) return 50;
  return clampScore(50 + ((positive - negative) / total) * 42);
}

function pushUnique(list: string[], value: string | undefined | false) {
  if (!value) return;
  if (!list.includes(value)) list.push(value);
}

function collectMissingEvidence(input: ConvictionFormulaV3Input) {
  const missing: string[] = [];

  if (!input.holderIntelligence) missing.push("holder intelligence summary");
  if (!input.walletReputation) missing.push("wallet reputation summary");
  if (!input.insiderMath) missing.push("insider mathematics V2");
  if (!input.walletFlow) missing.push("wallet flow V2 summary");
  if (input.market?.liquidityUsd === undefined) missing.push("liquidity USD");
  if (input.market?.volume24hUsd === undefined) missing.push("24h volume USD");
  if (!input.v1.dataConfidence) missing.push("V1 data confidence");

  return missing;
}

function contributionBalance(input: ConvictionFormulaV3Input) {
  const holder = input.holderIntelligence;
  const reputation = input.walletReputation;
  const conviction = average([
    holder?.averageConvictionContribution,
    reputation?.averageConvictionContribution,
  ]);
  const inverseRisk = average([
    inverse(holder?.averageRiskContribution),
    inverse(reputation?.averageRiskContribution),
  ]);

  return average([conviction, inverseRisk]);
}

function supportToRiskScore(input: ConvictionFormulaV3Input) {
  const holder = input.holderIntelligence;
  const reputation = input.walletReputation;
  const support = average([holder?.strongSupportHolders, reputation?.strongWallets]);
  const risk = average([holder?.strongRiskHolders, reputation?.highRiskWallets]);

  return ratioScore(support, risk);
}

function topHolderInfluence(input: ConvictionFormulaV3Input) {
  const holder = input.holderIntelligence;
  const reputation = input.walletReputation;
  const supportScores = [
    holder?.highestConvictionHolder?.convictionContributionScore,
    holder?.highestConvictionHolder?.overallHolderScore,
    reputation?.topPositiveWallets?.[0]?.convictionContribution,
    reputation?.topPositiveWallets?.[0]?.reputationScore,
  ];
  const riskScores = [
    holder?.highestRiskHolder?.riskContributionScore,
    reputation?.topRiskWallets?.[0]?.riskContribution,
    inverse(holder?.highestRiskHolder?.overallHolderScore),
    inverse(reputation?.topRiskWallets?.[0]?.reputationScore),
  ];
  const support = average(supportScores);
  const risk = average(riskScores);

  if (support === undefined && risk === undefined) return undefined;
  const base = 50 + ((support ?? 50) - (risk ?? 50)) * 0.24;
  const topRiskOwnership = holder?.highestRiskHolder?.ownershipPercentage;
  const ownershipPenalty =
    topRiskOwnership !== undefined ? Math.min(10, Math.max(0, topRiskOwnership - 4) * 0.8) : 0;

  return clampScore(base - ownershipPenalty);
}

function confidenceScore(input: ConvictionFormulaV3Input, missingEvidence: string[]) {
  const walletReputationConfidence =
    input.walletReputation?.analyzedWallets && input.walletReputation.analyzedWallets >= 10
      ? 72
      : input.walletReputation?.analyzedWallets
      ? 58
      : undefined;
  const score = average([
    input.holderIntelligence?.averageConfidence,
    walletReputationConfidence,
    input.v1.dataConfidence?.score,
  ]);

  return clampScore((score ?? input.v1.dataConfidence?.score ?? 45) - missingEvidence.length * 2);
}

function calculateHolderQualityScore(
  input: ConvictionFormulaV3Input,
  missingEvidence: string[]
) {
  const holder = input.holderIntelligence;
  const reputation = input.walletReputation;
  const fallbackHolderQuality = average([
    input.v1.subScores.holderIntegrity,
    input.v1.subScores.walletQuality,
  ]);

  return clampScore(
    weightedScore([
      { score: holder?.averageHolderScore ?? fallbackHolderQuality, weight: 0.35 },
      { score: reputation?.averageReputation ?? input.v1.subScores.walletQuality, weight: 0.2 },
      { score: contributionBalance(input), weight: 0.15 },
      { score: supportToRiskScore(input), weight: 0.15 },
      { score: topHolderInfluence(input), weight: 0.1 },
      { score: confidenceScore(input, missingEvidence), weight: 0.05 },
    ]) ?? fallbackHolderQuality ?? 0
  );
}

function calculateStructuralSafetyScore(input: ConvictionFormulaV3Input) {
  const insider = input.insiderMath;
  const fallbackSafety = average([
    input.v1.subScores.riskProtection,
    inverse(input.v1.subScores.insiderRisk),
    inverse(input.v1.subScores.clusterRisk),
  ]);
  const base = weightedScore([
    { score: inverse(insider?.concentrationPressureScore), weight: 0.25 },
    { score: inverse(insider?.clusterExposureScore), weight: 0.25 },
    { score: inverse(insider?.bundleStructureScore), weight: 0.2 },
    { score: inverse(insider?.freshOwnershipScore), weight: 0.15 },
    { score: inverse(insider?.relationshipIntensityScore), weight: 0.15 },
  ]);
  const contractDominance = insider?.contractDominanceScore;
  const contractPenalty =
    contractDominance !== undefined && contractDominance > 65
      ? Math.min(12, (contractDominance - 65) * 0.35)
      : 0;

  return clampScore((base ?? fallbackSafety ?? 0) - contractPenalty);
}

function volumeQualityScore(input: ConvictionFormulaV3Input) {
  const liquidity = finiteNumber(input.market?.liquidityUsd);
  const volume = finiteNumber(input.market?.volume24hUsd);

  if (liquidity === undefined || volume === undefined || liquidity <= 0) {
    return undefined;
  }

  const ratio = volume / liquidity;
  if (ratio < 0.02) return 38;
  if (ratio < 0.08) return 56;
  if (ratio <= 2.5) return 82;
  if (ratio <= 5) return 68;
  if (ratio <= 10) return 46;
  return 28;
}

function calculateMarketIntegrityScore(input: ConvictionFormulaV3Input) {
  const liquidityTrust = input.market?.liquidityTrust ?? input.v1.subScores.liquidityTrust;
  const volumeQuality =
    volumeQualityScore(input) ??
    average([input.market?.marketMomentum, input.v1.subScores.marketMomentum, liquidityTrust]);

  return clampScore(
    weightedScore([
      { score: liquidityTrust, weight: 0.4 },
      { score: volumeQuality, weight: 0.2 },
      { score: inverse(input.walletFlow?.rotationPressure ?? input.v1.subScores.rotationRisk), weight: 0.2 },
      { score: inverse(input.walletFlow?.distributionPressure), weight: 0.2 },
    ]) ?? average([liquidityTrust, input.market?.marketMomentum, input.v1.subScores.marketMomentum]) ?? 0
  );
}

function applyRiskCaps({
  input,
  finalScore,
  pillarScores,
}: {
  input: ConvictionFormulaV3Input;
  finalScore: number;
  pillarScores: ConvictionFormulaV3Result["pillarScores"];
}) {
  let cappedScore = finalScore;
  const riskCapsApplied: string[] = [];
  const applyCap = (condition: boolean, cap: number, label: string) => {
    if (!condition || cappedScore <= cap) return;
    cappedScore = Math.min(cappedScore, cap);
    riskCapsApplied.push(label);
  };

  applyCap(
    pillarScores.structuralSafetyScore < 40,
    62,
    "Structural Safety below 40 capped Formula V3 at 62."
  );
  applyCap(
    pillarScores.structuralSafetyScore < 30,
    52,
    "Structural Safety below 30 capped Formula V3 at 52."
  );
  applyCap(
    pillarScores.structuralSafetyScore < 20,
    42,
    "Structural Safety below 20 capped Formula V3 at 42."
  );
  applyCap(
    (input.insiderMath?.insiderRiskScore ?? 0) >= 90,
    45,
    "Insider Risk Score >= 90 capped Formula V3 at 45."
  );
  applyCap(
    (input.insiderMath?.bundleStructureScore ?? 0) >= 90,
    40,
    "Bundle Structure Score >= 90 capped Formula V3 at 40."
  );
  applyCap(
    (input.insiderMath?.clusterExposureScore ?? 0) >= 90,
    45,
    "Cluster Exposure Score >= 90 capped Formula V3 at 45."
  );
  applyCap(
    (input.insiderMath?.concentrationPressureScore ?? 0) >= 90,
    45,
    "Concentration Pressure Score >= 90 capped Formula V3 at 45."
  );
  applyCap(
    (input.v1.dataConfidence?.score ?? 100) < 35,
    65,
    "Data confidence below 35 capped Formula V3 at 65."
  );
  applyCap(
    (input.market?.liquidityTrust ?? input.v1.subScores.liquidityTrust ?? 100) < 20 &&
      (input.walletFlow?.distributionPressure ?? 0) > 65,
    58,
    "Liquidity Trust below 20 plus distribution pressure above 65 capped Formula V3 at 58."
  );

  return {
    finalScore: cappedScore,
    riskCapsApplied,
  };
}

function buildDrivers({
  input,
  pillarScores,
  riskCapsApplied,
}: {
  input: ConvictionFormulaV3Input;
  pillarScores: ConvictionFormulaV3Result["pillarScores"];
  riskCapsApplied: string[];
}) {
  const positiveDrivers: string[] = [];
  const negativeDrivers: string[] = [];
  const limitingFactors: string[] = [];

  if (pillarScores.holderQualityScore >= 65) {
    pushUnique(
      positiveDrivers,
      "Holder Quality is supportive because strong support holders outnumber high-risk holders."
    );
  }
  if ((input.walletReputation?.averageReputation ?? 0) >= 65) {
    pushUnique(positiveDrivers, "Wallet Reputation supports the holder base.");
  }
  if (
    input.walletFlow?.accumulationPressure !== undefined &&
    input.walletFlow?.distributionPressure !== undefined &&
    input.walletFlow.accumulationPressure > input.walletFlow.distributionPressure + 8
  ) {
    pushUnique(positiveDrivers, "Wallet Flow shows accumulation pressure above distribution pressure.");
  }
  if (pillarScores.marketIntegrityScore >= 65) {
    pushUnique(positiveDrivers, "Market Integrity is supportive under current liquidity and flow evidence.");
  }

  if (pillarScores.structuralSafetyScore < 45) {
    pushUnique(negativeDrivers, "Structural Safety is limited by elevated cluster, bundle, or concentration exposure.");
    pushUnique(limitingFactors, `Structural Safety is ${pillarScores.structuralSafetyScore}/100.`);
  }
  if ((input.insiderMath?.clusterExposureScore ?? 0) >= 65) {
    pushUnique(negativeDrivers, "Structural Safety is limited by elevated cluster exposure.");
  }
  if ((input.insiderMath?.bundleStructureScore ?? 0) >= 65) {
    pushUnique(negativeDrivers, "Bundle structure pressure remains elevated.");
  }
  if (
    input.walletFlow?.distributionPressure !== undefined &&
    input.walletFlow?.accumulationPressure !== undefined &&
    input.walletFlow.distributionPressure > input.walletFlow.accumulationPressure + 8
  ) {
    pushUnique(negativeDrivers, "Distribution pressure exceeds accumulation pressure.");
    pushUnique(limitingFactors, "Distribution pressure exceeds accumulation pressure.");
  }
  if ((input.insiderMath?.contractDominanceScore ?? 0) >= 70) {
    pushUnique(limitingFactors, "Contract dominance is elevated and limits structural safety.");
  }

  return {
    positiveDrivers,
    negativeDrivers,
    limitingFactors: Array.from(new Set([...limitingFactors, ...riskCapsApplied])),
  };
}

export function calculateConvictionFormulaV3(
  input: ConvictionFormulaV3Input
): ConvictionFormulaV3Result {
  const missingEvidence = collectMissingEvidence(input);
  const pillarScores = {
    holderQualityScore: calculateHolderQualityScore(input, missingEvidence),
    structuralSafetyScore: calculateStructuralSafetyScore(input),
    marketIntegrityScore: calculateMarketIntegrityScore(input),
  };
  const rawScore = clampScore(
    pillarScores.holderQualityScore * 0.4 +
      pillarScores.structuralSafetyScore * 0.35 +
      pillarScores.marketIntegrityScore * 0.25
  );
  const capped = applyRiskCaps({
    input,
    finalScore: rawScore,
    pillarScores,
  });
  const drivers = buildDrivers({
    input,
    pillarScores,
    riskCapsApplied: capped.riskCapsApplied,
  });

  return {
    finalConvictionScoreV3: capped.finalScore,
    rawConvictionScoreV3: rawScore,
    formulaVersion: "v3-preview",
    pillarScores,
    riskCapsApplied: capped.riskCapsApplied,
    positiveDrivers: drivers.positiveDrivers.slice(0, 5),
    negativeDrivers: drivers.negativeDrivers.slice(0, 5),
    limitingFactors: drivers.limitingFactors.slice(0, 6),
    missingEvidence: Array.from(new Set(missingEvidence)),
    methodologyNotes: [
      "Formula V3 is preview-only and does not replace canonical conviction yet.",
      "Low market cap alone is not treated as a conviction failure.",
      "Structural weakness can cap conviction even when holder quality is strong.",
      "No PnL, win rate, average entry/exit, future price prediction, or identity claim is calculated.",
    ],
  };
}

function direction(delta: number): ConvictionFormulaV3Direction {
  if (Math.abs(delta) < 5) return "Similar";
  return delta > 0 ? "V3 Higher" : "V3 Lower";
}

function magnitude(delta: number): ConvictionFormulaV3Magnitude {
  const absoluteDelta = Math.abs(delta);
  if (absoluteDelta < 5) return "Similar";
  if (absoluteDelta < 15) return "Moderate";
  return "Major";
}

export function compareConvictionV3(
  input: ConvictionFormulaV3Input,
  v3Result = calculateConvictionFormulaV3(input)
): ConvictionFormulaV3Comparison {
  const v1Score = clampScore(input.v1.finalConvictionScore);
  const v2Score =
    input.v2?.finalConvictionScoreV2 !== undefined
      ? clampScore(input.v2.finalConvictionScoreV2)
      : undefined;
  const v3Score = clampScore(v3Result.finalConvictionScoreV3);
  const deltaV1ToV3 = v3Score - v1Score;
  const deltaV2ToV3 = v2Score !== undefined ? v3Score - v2Score : undefined;
  const reasons: string[] = [];

  if (
    v2Score !== undefined &&
    deltaV2ToV3 !== undefined &&
    deltaV2ToV3 < -4 &&
    v3Result.pillarScores.structuralSafetyScore < v3Result.pillarScores.holderQualityScore
  ) {
    reasons.push("V3 is lower than V2 because structural safety is weaker than holder quality.");
  }
  if (
    deltaV1ToV3 > 4 &&
    v3Result.pillarScores.holderQualityScore >= 60 &&
    v3Result.pillarScores.marketIntegrityScore >= 55
  ) {
    reasons.push(
      "V3 is higher than V1 because holder quality and market integrity are stronger than V1 weighting suggests."
    );
  }
  if (Math.abs(deltaV1ToV3) < 5) {
    reasons.push("V3 remains close to V1 because structural and market conditions offset holder quality.");
  }
  if (v3Result.riskCapsApplied.length) {
    reasons.push(v3Result.riskCapsApplied[0]);
  }
  if (v3Result.negativeDrivers.length) {
    reasons.push(v3Result.negativeDrivers[0]);
  }

  const comparisonSummary =
    reasons[0] ??
    (direction(deltaV1ToV3) === "V3 Higher"
      ? "V3 is higher than V1 under the current holder quality, structural safety, and market integrity blend."
      : direction(deltaV1ToV3) === "V3 Lower"
      ? "V3 is lower than V1 because one or more V3 pillars are more conservative under current evidence."
      : "V3 remains close to V1 under currently loaded evidence.");

  return {
    v1Score,
    v2Score,
    v3Score,
    deltaV1ToV3,
    deltaV2ToV3,
    directionV1ToV3: direction(deltaV1ToV3),
    directionV2ToV3: deltaV2ToV3 !== undefined ? direction(deltaV2ToV3) : undefined,
    magnitudeV1ToV3: magnitude(deltaV1ToV3),
    magnitudeV2ToV3: deltaV2ToV3 !== undefined ? magnitude(deltaV2ToV3) : undefined,
    comparisonSummary,
    reasons: Array.from(new Set(reasons)).slice(0, 5),
  };
}
