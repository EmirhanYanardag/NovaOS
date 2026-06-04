export type ConvictionFormulaV2Direction = "V2 Higher" | "V2 Lower" | "Similar";

export type ConvictionFormulaV2Magnitude = "Minor" | "Moderate" | "Major";

export type ConvictionFormulaV2Input = {
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
    explanation?: {
      headline?: string;
      positives?: string[];
      negatives?: string[];
      riskNotes?: string[];
    };
  };
  walletReputation?: {
    analyzedWallets?: number;
    averageReputation?: number;
    averageConvictionContribution?: number;
    averageRiskContribution?: number;
    dominantWalletClass?: string;
    strongWallets?: number;
    highRiskWallets?: number;
    summaryVerdict?: string;
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
    analyzedWallets?: number;
    accumulationPressure?: number;
    distributionPressure?: number;
    rotationPressure?: number;
    dormancyPressure?: number;
    netFlowBias?: number;
    flowConfidence?: number;
    dominantFlow?: string;
  } | null;
  market?: {
    liquidityTrust?: number;
    marketMomentum?: number;
    liquidityUsd?: number;
    marketCapUsd?: number;
    volume24hUsd?: number;
  };
};

export type ConvictionFormulaV2Result = {
  finalConvictionScoreV2: number;
  rawConvictionScoreV2: number;
  formulaVersion: "v2-preview";
  subScores: {
    holderQualityV2: number;
    behavioralConvictionV2: number;
    structuralSafetyV2: number;
    liquidityTrustV2: number;
    momentumContextV2: number;
    dataConfidenceV2: number;
  };
  riskCapsApplied: string[];
  positiveDrivers: string[];
  negativeDrivers: string[];
  limitingFactors: string[];
  missingEvidence: string[];
  methodologyNotes: string[];
};

export type ConvictionFormulaV2Comparison = {
  v1Score: number;
  v2Score: number;
  delta: number;
  direction: ConvictionFormulaV2Direction;
  magnitude: ConvictionFormulaV2Magnitude;
  reasonsForDifference: string[];
  v2Advantages: string[];
  v2Cautions: string[];
};

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
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

function ratioScore(positive?: number, negative?: number) {
  if (positive === undefined || negative === undefined) return undefined;
  const total = positive + negative;
  if (total <= 0) return 50;
  return clampScore(50 + ((positive - negative) / total) * 35);
}

function pushUnique(list: string[], value: string | undefined | false) {
  if (!value) return;
  if (!list.includes(value)) list.push(value);
}

function scoreLabel(score: number) {
  if (score >= 70) return "supportive";
  if (score >= 45) return "mixed";
  return "weak";
}

function calculateHolderQualityV2(input: ConvictionFormulaV2Input) {
  const holder = input.holderIntelligence;
  const reputation = input.walletReputation;
  const v1 = input.v1.subScores;
  const supportRatio = ratioScore(
    holder?.strongSupportHolders ?? reputation?.strongWallets,
    holder?.strongRiskHolders ?? reputation?.highRiskWallets
  );
  const confidence = holder?.averageConfidence;
  const score = average([
    holder?.averageHolderScore,
    reputation?.averageReputation,
    reputation?.averageConvictionContribution,
    inverse(reputation?.averageRiskContribution),
    supportRatio,
    confidence,
    v1.walletQuality,
    v1.holderIntegrity,
  ]);

  return clampScore(score ?? average([v1.walletQuality, v1.holderIntegrity]) ?? 0);
}

function calculateBehavioralConvictionV2(input: ConvictionFormulaV2Input) {
  const flow = input.walletFlow;
  const v1 = input.v1.subScores;
  const netBiasLift =
    typeof flow?.netFlowBias === "number" ? clampScore(50 + flow.netFlowBias * 0.5) : undefined;
  const score = average([
    netBiasLift,
    flow?.accumulationPressure,
    inverse(flow?.distributionPressure),
    inverse(flow?.rotationPressure),
    inverse(flow?.dormancyPressure),
    flow?.flowConfidence,
    v1.behaviorStability,
  ]);

  return clampScore(score ?? v1.behaviorStability ?? 0);
}

function calculateStructuralSafetyV2(input: ConvictionFormulaV2Input) {
  const insider = input.insiderMath;
  const v1 = input.v1.subScores;
  const score = average([
    inverse(insider?.insiderRiskScore),
    inverse(insider?.concentrationPressureScore),
    inverse(insider?.clusterExposureScore),
    inverse(insider?.bundleStructureScore),
    inverse(insider?.freshOwnershipScore),
    inverse(insider?.contractDominanceScore),
    inverse(insider?.relationshipIntensityScore),
    insider?.evidenceConfidenceScore,
    v1.riskProtection,
    inverse(v1.insiderRisk),
    inverse(v1.clusterRisk),
  ]);

  return clampScore(score ?? v1.riskProtection ?? 0);
}

function calculateLiquidityTrustV2(input: ConvictionFormulaV2Input) {
  const market = input.market;
  const v1Liquidity = market?.liquidityTrust ?? input.v1.subScores.liquidityTrust;
  const liquidity = market?.liquidityUsd;
  const marketCap = market?.marketCapUsd;
  const volume = market?.volume24hUsd;
  const liquidityRatio =
    liquidity !== undefined && marketCap !== undefined && marketCap > 0
      ? clampScore((liquidity / marketCap) * 420)
      : undefined;
  const liquidityScale =
    liquidity !== undefined ? clampScore(Math.log10(Math.max(0, liquidity) + 1) * 10) : undefined;
  const volumeLiquiditySanity =
    liquidity !== undefined && liquidity > 0 && volume !== undefined
      ? clampScore(78 - Math.max(0, volume / liquidity - 4) * 8)
      : undefined;

  return clampScore(average([v1Liquidity, liquidityRatio, liquidityScale, volumeLiquiditySanity]) ?? v1Liquidity ?? 0);
}

function calculateMomentumContextV2(input: ConvictionFormulaV2Input) {
  const flow = input.walletFlow;
  const marketMomentum = input.market?.marketMomentum ?? input.v1.subScores.marketMomentum;
  const flowBias =
    typeof flow?.netFlowBias === "number" ? clampScore(50 + flow.netFlowBias * 0.35) : undefined;
  const accumulationSupport =
    flow?.accumulationPressure !== undefined && flow?.distributionPressure !== undefined
      ? clampScore(50 + (flow.accumulationPressure - flow.distributionPressure) * 0.25)
      : undefined;

  return clampScore(average([marketMomentum, flowBias, accumulationSupport]) ?? marketMomentum ?? 0);
}

function calculateDataConfidenceV2(input: ConvictionFormulaV2Input, missingEvidence: string[]) {
  const score = average([
    input.v1.dataConfidence?.score,
    input.holderIntelligence?.averageConfidence,
    input.insiderMath?.evidenceConfidenceScore,
    input.walletFlow?.flowConfidence,
    input.walletReputation?.analyzedWallets ? 64 : undefined,
  ]);
  const missingPenalty = Math.min(28, missingEvidence.length * 4);

  return clampScore((score ?? input.v1.dataConfidence?.score ?? 0) - missingPenalty);
}

function collectMissingEvidence(input: ConvictionFormulaV2Input) {
  const missing: string[] = [];

  if (!input.walletReputation) missing.push("wallet reputation summary");
  if (!input.holderIntelligence) missing.push("holder intelligence summary");
  if (!input.insiderMath) missing.push("insider mathematics V2");
  if (!input.walletFlow) missing.push("wallet flow V2 summary");
  if (input.market?.liquidityUsd === undefined) missing.push("liquidity USD");
  if (input.market?.marketCapUsd === undefined) missing.push("market cap USD");
  if (input.market?.volume24hUsd === undefined) missing.push("24h volume USD");
  if (!input.v1.dataConfidence) missing.push("V1 data confidence");

  return missing;
}

function buildDrivers({
  input,
  subScores,
}: {
  input: ConvictionFormulaV2Input;
  subScores: ConvictionFormulaV2Result["subScores"];
}) {
  const positiveDrivers: string[] = [];
  const negativeDrivers: string[] = [];
  const limitingFactors: string[] = [];

  if (subScores.holderQualityV2 >= 65) {
    pushUnique(
      positiveDrivers,
      `Holder Intelligence is ${scoreLabel(subScores.holderQualityV2)} with Holder Quality V2 at ${subScores.holderQualityV2}/100.`
    );
  } else if (subScores.holderQualityV2 < 45) {
    pushUnique(
      negativeDrivers,
      `Holder Quality V2 is weak at ${subScores.holderQualityV2}/100.`
    );
  }

  if ((input.walletReputation?.averageReputation ?? 0) >= 65) {
    pushUnique(
      positiveDrivers,
      `Wallet Reputation is supportive across analyzed holders at ${input.walletReputation?.averageReputation}/100.`
    );
  }

  if (
    input.walletFlow?.accumulationPressure !== undefined &&
    input.walletFlow?.distributionPressure !== undefined &&
    input.walletFlow.accumulationPressure > input.walletFlow.distributionPressure + 8
  ) {
    pushUnique(
      positiveDrivers,
      "Wallet Flow V2 shows accumulation pressure above distribution pressure."
    );
  }

  if (
    input.walletFlow?.distributionPressure !== undefined &&
    input.walletFlow?.accumulationPressure !== undefined &&
    input.walletFlow.distributionPressure > input.walletFlow.accumulationPressure + 8
  ) {
    pushUnique(negativeDrivers, "Distribution pressure exceeds accumulation pressure.");
  }

  if ((input.insiderMath?.insiderRiskScore ?? 0) >= 70) {
    pushUnique(
      negativeDrivers,
      "Insider Risk V2 remains elevated due to concentration, bundle, or relationship exposure."
    );
  }

  if ((input.insiderMath?.clusterExposureScore ?? 0) >= 65) {
    pushUnique(negativeDrivers, "Cluster exposure is elevated in Insider Mathematics V2.");
  }

  if ((input.insiderMath?.bundleStructureScore ?? 0) >= 65) {
    pushUnique(negativeDrivers, "Bundle structure pressure is elevated in V2 evidence.");
  }

  if (subScores.structuralSafetyV2 < 45) {
    pushUnique(
      limitingFactors,
      `Structural Safety V2 is ${subScores.structuralSafetyV2}/100, limiting preview conviction.`
    );
  }

  if (subScores.dataConfidenceV2 < 45) {
    pushUnique(
      limitingFactors,
      "Missing or partial evidence reduces Formula V2 confidence more than score."
    );
  }

  if (subScores.liquidityTrustV2 < 45) {
    pushUnique(
      limitingFactors,
      `Liquidity Trust V2 is ${subScores.liquidityTrustV2}/100.`
    );
  }

  return {
    positiveDrivers,
    negativeDrivers,
    limitingFactors,
  };
}

export function calculateConvictionFormulaV2(
  input: ConvictionFormulaV2Input
): ConvictionFormulaV2Result {
  const missingEvidence = collectMissingEvidence(input);
  const subScores = {
    holderQualityV2: calculateHolderQualityV2(input),
    behavioralConvictionV2: calculateBehavioralConvictionV2(input),
    structuralSafetyV2: calculateStructuralSafetyV2(input),
    liquidityTrustV2: calculateLiquidityTrustV2(input),
    momentumContextV2: calculateMomentumContextV2(input),
    dataConfidenceV2: 0,
  };
  subScores.dataConfidenceV2 = calculateDataConfidenceV2(input, missingEvidence);

  const rawScore = clampScore(
    subScores.holderQualityV2 * 0.24 +
      subScores.behavioralConvictionV2 * 0.2 +
      subScores.structuralSafetyV2 * 0.22 +
      subScores.liquidityTrustV2 * 0.14 +
      subScores.momentumContextV2 * 0.08 +
      subScores.dataConfidenceV2 * 0.12
  );
  let finalScore = rawScore;
  const riskCapsApplied: string[] = [];
  const warnings: string[] = [];

  const applyCap = (condition: boolean, cap: number, label: string) => {
    if (!condition || finalScore <= cap) return;
    finalScore = Math.min(finalScore, cap);
    riskCapsApplied.push(label);
  };

  applyCap(
    (input.insiderMath?.insiderRiskScore ?? 0) >= 90,
    42,
    "Insider Risk V2 >= 90 capped Formula V2 at 42."
  );
  applyCap(
    (input.insiderMath?.bundleStructureScore ?? 0) >= 90,
    38,
    "Bundle Structure Score >= 90 capped Formula V2 at 38."
  );
  applyCap(
    subScores.structuralSafetyV2 < 25,
    45,
    "Structural Safety V2 below 25 capped Formula V2 at 45."
  );
  applyCap(
    subScores.holderQualityV2 < 30 && (input.insiderMath?.insiderRiskScore ?? 0) >= 75,
    40,
    "Weak Holder Quality V2 plus elevated Insider Risk V2 capped Formula V2 at 40."
  );
  applyCap(
    subScores.dataConfidenceV2 < 35,
    65,
    "Low Data Confidence V2 capped Formula V2 at 65."
  );
  if (subScores.dataConfidenceV2 < 35) {
    warnings.push("Low data confidence limits V2 score certainty.");
  }
  applyCap(
    subScores.liquidityTrustV2 < 25,
    60,
    "Liquidity Trust V2 below 25 capped Formula V2 at 60."
  );

  const drivers = buildDrivers({ input, subScores });
  const limitingFactors = [...drivers.limitingFactors, ...riskCapsApplied, ...warnings];

  return {
    finalConvictionScoreV2: finalScore,
    rawConvictionScoreV2: rawScore,
    formulaVersion: "v2-preview",
    subScores,
    riskCapsApplied,
    positiveDrivers: drivers.positiveDrivers.slice(0, 5),
    negativeDrivers: drivers.negativeDrivers.slice(0, 5),
    limitingFactors: Array.from(new Set(limitingFactors)).slice(0, 6),
    missingEvidence: Array.from(new Set(missingEvidence)),
    methodologyNotes: [
      "Formula V2 Preview is deterministic and does not replace the canonical V1 score yet.",
      "No PnL, win rate, average entry, average exit, future price prediction, or insider identity is calculated.",
      "Missing evidence reduces confidence and is listed explicitly; it is not invented.",
    ],
  };
}

export function compareConvictionV1V2(
  v1Result: ConvictionFormulaV2Input["v1"],
  v2Result: ConvictionFormulaV2Result
): ConvictionFormulaV2Comparison {
  const v1Score = clampScore(v1Result.finalConvictionScore);
  const v2Score = clampScore(v2Result.finalConvictionScoreV2);
  const delta = v2Score - v1Score;
  const absoluteDelta = Math.abs(delta);
  const direction: ConvictionFormulaV2Direction =
    absoluteDelta < 5 ? "Similar" : delta > 0 ? "V2 Higher" : "V2 Lower";
  const magnitude: ConvictionFormulaV2Magnitude =
    absoluteDelta < 5 ? "Minor" : absoluteDelta < 15 ? "Moderate" : "Major";
  const reasonsForDifference: string[] = [];
  const v2Advantages: string[] = [];
  const v2Cautions: string[] = [];

  if (direction === "V2 Higher") {
    reasonsForDifference.push(
      "V2 is higher because richer holder, reputation, flow, or confidence inputs provide more support than the V1 blend."
    );
  } else if (direction === "V2 Lower") {
    reasonsForDifference.push(
      "V2 is lower because structural, flow, liquidity, or confidence constraints reduce the preview score."
    );
  } else {
    reasonsForDifference.push("V1 and V2 are similar under currently loaded evidence.");
  }

  const strongestV2 = Object.entries(v2Result.subScores)
    .sort((left, right) => right[1] - left[1])[0];
  const weakestV2 = Object.entries(v2Result.subScores)
    .sort((left, right) => left[1] - right[1])[0];

  if (strongestV2) {
    v2Advantages.push(
      `Strongest V2 support is ${strongestV2[0]} at ${strongestV2[1]}/100.`
    );
  }
  if (v2Result.positiveDrivers.length) {
    v2Advantages.push(v2Result.positiveDrivers[0]);
  }
  if (weakestV2) {
    v2Cautions.push(`Weakest V2 input is ${weakestV2[0]} at ${weakestV2[1]}/100.`);
  }
  if (v2Result.limitingFactors.length) {
    v2Cautions.push(v2Result.limitingFactors[0]);
  }
  if (v2Result.missingEvidence.length) {
    v2Cautions.push(
      `Missing evidence: ${v2Result.missingEvidence.slice(0, 3).join(", ")}.`
    );
  }

  return {
    v1Score,
    v2Score,
    delta,
    direction,
    magnitude,
    reasonsForDifference: Array.from(new Set(reasonsForDifference)).slice(0, 4),
    v2Advantages: Array.from(new Set(v2Advantages)).slice(0, 4),
    v2Cautions: Array.from(new Set(v2Cautions)).slice(0, 4),
  };
}
