export type ArenaVerdict =
  | "AI aligned with holder behavior"
  | "AI cautious while holders accumulate"
  | "AI conviction exceeds holder confidence"
  | "Fragmented holder behavior"
  | "Insufficient behavioral agreement";

export type ArenaConfidenceLabel = "High" | "Medium" | "Low";

export type ArenaClusterSignals = {
  totalAnalyzedWallets?: number;
  clusteredWallets?: number;
  isolatedWallets?: number;
  averageClusterConfidence?: number;
  dominantRelationshipType?: string;
  elevatedRiskClusters?: number;
  possibleCoordinationClusters?: number;
};

export type ArenaEngineInput = {
  convictionScore?: number;
  insiderRiskScore?: number;
  holderQualityScore?: number;
  activityScore?: number;
  dominantBehaviorClass?: string;
  reliabilityScore?: number;
  profiledWallets?: number;
  clusterSignals?: ArenaClusterSignals;
};

export type ArenaResult = {
  verdict: ArenaVerdict;
  confidenceLabel: ArenaConfidenceLabel;
  explanation: string;
  agreementScore: number;
  disagreementScore: number;
  aiConfidenceScore: number;
  holderBehaviorScore: number;
  signals: string[];
};

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function optionalScore(value?: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? clampScore(value)
    : null;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function hasAccumulationTone(behaviorClass?: string) {
  if (!behaviorClass) return false;
  const value = behaviorClass.toLowerCase();
  return (
    value.includes("active accumulator") ||
    value.includes("active whale") ||
    value.includes("high activity") ||
    value.includes("active holder")
  );
}

function hasFragmentedClusterTone(clusterSignals?: ArenaClusterSignals) {
  if (!clusterSignals) return false;
  const dominantRelationship =
    clusterSignals.dominantRelationshipType?.toLowerCase() || "";
  const total = clusterSignals.totalAnalyzedWallets || 0;
  const clustered = clusterSignals.clusteredWallets || 0;
  const isolated = clusterSignals.isolatedWallets || 0;
  const mixedNetwork = total > 0 && clustered > 0 && isolated > 0;

  return (
    dominantRelationship.includes("possible coordination") ||
    (mixedNetwork && (clusterSignals.averageClusterConfidence || 0) < 58) ||
    (clusterSignals.elevatedRiskClusters || 0) > 0 ||
    (clusterSignals.possibleCoordinationClusters || 0) > 0
  );
}

export function buildArenaInterpretation(input: ArenaEngineInput): ArenaResult {
  const conviction = optionalScore(input.convictionScore);
  const insiderRisk = optionalScore(input.insiderRiskScore);
  const holderQuality = optionalScore(input.holderQualityScore);
  const activity = optionalScore(input.activityScore);
  const reliability = optionalScore(input.reliabilityScore);

  const availableScores = [
    conviction,
    insiderRisk,
    holderQuality,
    activity,
  ].filter((score): score is number => score !== null);

  if (availableScores.length < 3) {
    return {
      verdict: "Insufficient behavioral agreement",
      confidenceLabel: "Low",
      explanation:
        "Arena comparison needs token intelligence and holder behavior signals before it can compare AI thesis confidence against observed holder patterns.",
      agreementScore: 0,
      disagreementScore: 0,
      aiConfidenceScore: 0,
      holderBehaviorScore: 0,
      signals: ["Waiting for token intelligence", "Waiting for holder behavior"],
    };
  }

  const normalizedConviction = conviction ?? average(availableScores);
  const normalizedRisk = insiderRisk ?? 50;
  const normalizedQuality = holderQuality ?? average(availableScores);
  const normalizedActivity = activity ?? average(availableScores);
  const normalizedReliability = reliability ?? average(availableScores);

  const clusterConfidence = clampScore(
    input.clusterSignals?.averageClusterConfidence ?? 50
  );
  const clusterStability = clampScore(
    100 -
      (input.clusterSignals?.elevatedRiskClusters || 0) * 12 -
      (input.clusterSignals?.possibleCoordinationClusters || 0) * 8
  );
  const profileCoverageScore = clampScore((input.profiledWallets || 0) * 12);

  const aiConfidenceScore = clampScore(
    average([normalizedConviction, normalizedQuality, normalizedReliability])
  );
  const holderBehaviorScore = clampScore(
    normalizedQuality * 0.34 +
      normalizedActivity * 0.26 +
      (100 - normalizedRisk) * 0.24 +
      clusterStability * 0.16
  );
  const clusterPenalty = hasFragmentedClusterTone(input.clusterSignals) ? 18 : 0;
  const riskPenalty = normalizedRisk > 70 ? 12 : normalizedRisk > 55 ? 6 : 0;
  const rawDisagreement =
    Math.abs(normalizedConviction - holderBehaviorScore) +
    clusterPenalty +
    riskPenalty;
  const disagreementScore = clampScore(rawDisagreement);
  const agreementScore = clampScore(100 - disagreementScore);

  const confidenceBase = average([
    normalizedReliability,
    clusterConfidence,
    profileCoverageScore,
  ]);
  const confidenceLabel: ArenaConfidenceLabel =
    confidenceBase >= 70 ? "High" : confidenceBase >= 45 ? "Medium" : "Low";

  const fragmented = hasFragmentedClusterTone(input.clusterSignals);
  const accumulationTone =
    hasAccumulationTone(input.dominantBehaviorClass) || normalizedActivity >= 62;

  let verdict: ArenaVerdict = "Insufficient behavioral agreement";
  if (fragmented && disagreementScore >= 34) {
    verdict = "Fragmented holder behavior";
  } else if (
    normalizedConviction < 52 &&
    accumulationTone &&
    holderBehaviorScore >= 58
  ) {
    verdict = "AI cautious while holders accumulate";
  } else if (
    normalizedConviction >= 64 &&
    (holderBehaviorScore < 54 || normalizedRisk >= 62)
  ) {
    verdict = "AI conviction exceeds holder confidence";
  } else if (agreementScore >= 62 && normalizedRisk < 65) {
    verdict = "AI aligned with holder behavior";
  }

  const signals = [
    `Conviction ${normalizedConviction}`,
    `Holder behavior ${holderBehaviorScore}`,
    `Insider risk ${normalizedRisk}`,
    `Agreement ${agreementScore}`,
  ];

  if (input.dominantBehaviorClass) {
    signals.push(`Dominant behavior: ${input.dominantBehaviorClass}`);
  }

  if (input.clusterSignals?.dominantRelationshipType) {
    signals.push(
      `Cluster signal: ${input.clusterSignals.dominantRelationshipType}`
    );
  }

  const explanationByVerdict: Record<ArenaVerdict, string> = {
    "AI aligned with holder behavior":
      "Token intelligence confidence is broadly aligned with holder quality, activity metadata and current cluster signals.",
    "AI cautious while holders accumulate":
      "The thesis remains conservative while holder activity and behavior metadata show accumulation-like participation.",
    "AI conviction exceeds holder confidence":
      "The thesis confidence is stronger than the observed holder behavior support, or risk signals are still elevated.",
    "Fragmented holder behavior":
      "Holder behavior appears mixed across activity, concentration and cluster signals, so the arena reads the market as behaviorally fragmented.",
    "Insufficient behavioral agreement":
      "Available holder behavior and token intelligence signals do not yet show enough agreement for a stronger interpretation.",
  };

  return {
    verdict,
    confidenceLabel,
    explanation: explanationByVerdict[verdict],
    agreementScore,
    disagreementScore,
    aiConfidenceScore,
    holderBehaviorScore,
    signals,
  };
}
