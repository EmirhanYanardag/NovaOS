import type { NormalizedTokenTransfer } from "./deep-wallet-behavior";
import type { HolderIntelligenceProfile } from "./holder-intelligence";
import type { WalletReputationResult } from "./wallet-reputation";

export type WalletFlowDirection =
  | "Accumulating"
  | "Distributing"
  | "Rotating"
  | "Dormant"
  | "Stable Holder"
  | "Unknown";

export type TokenDominantFlow =
  | "Accumulation Dominant"
  | "Distribution Dominant"
  | "Rotation Heavy"
  | "Dormancy Heavy"
  | "Stable / Balanced"
  | "Data Limited";

export type WalletFlowV2Input = {
  walletAddress?: string;
  ownershipPercentage?: number;
  deepBehavior?: {
    tokenTransferInCount?: number;
    tokenTransferOutCount?: number;
    tokenTransferTotalCount?: number;
    accumulationPressure?: number;
    distributionPressure?: number;
    rotationBehaviorRisk?: number;
    shortHoldRisk?: number;
    tokenSpecificConvictionScore?: number;
    walletBehaviorQualityScore?: number;
    behaviorTags?: string[];
    dataQuality?: {
      score?: number;
      label?: "Low" | "Medium" | "High";
      warnings?: string[];
    };
  };
  holderIntelligence?: HolderIntelligenceProfile;
  walletReputation?: WalletReputationResult;
  walletProfile?: {
    activityScore?: number;
    activityVelocityScore?: number;
    dormancyRiskScore?: number;
    behaviorClass?: string;
    dataConfidence?: number;
    dataQuality?: "partial" | "good" | "unavailable" | string;
    daysSinceLastActive?: number | null;
  };
  convictionSubscores?: {
    walletQuality?: number;
    riskProtection?: number;
    rotationRisk?: number;
    freshWalletRisk?: number;
  };
  tokenTransfers?: NormalizedTokenTransfer[];
};

export type WalletFlowV2Result = {
  walletAddress: string;
  ownershipPercentage: number;
  flowDirection: WalletFlowDirection;
  accumulationScore: number;
  distributionScore: number;
  rotationScore: number;
  dormancyPressureScore: number;
  activityPressureScore: number;
  netFlowBiasScore: number;
  flowConfidenceScore: number;
  weightedAccumulationImpact: number;
  weightedDistributionImpact: number;
  weightedRotationImpact: number;
  weightedDormancyImpact: number;
  ownershipWeight: number;
  positives: string[];
  negatives: string[];
  warnings: string[];
  missingEvidence: string[];
  oneLineSummary: string;
};

export type TokenFlowSummaryV2 = {
  analyzedWallets: number;
  accumulationPressure: number;
  distributionPressure: number;
  rotationPressure: number;
  dormancyPressure: number;
  netFlowBias: number;
  flowConfidence: number;
  dominantFlow: TokenDominantFlow;
  accumulatingWallets: number;
  distributingWallets: number;
  rotatingWallets: number;
  dormantWallets: number;
  stableWallets: number;
  unknownWallets: number;
  topAccumulationDrivers: WalletFlowV2Result[];
  topDistributionDrivers: WalletFlowV2Result[];
  topRotationDrivers: WalletFlowV2Result[];
  topDormancyDrivers: WalletFlowV2Result[];
  verdict: string;
};

function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function clampBias(value: number) {
  return clamp(value, -100, 100);
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function average(values: Array<number | undefined>) {
  const safeValues = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value)
  );
  if (safeValues.length === 0) return undefined;
  return safeValues.reduce((total, value) => total + value, 0) / safeValues.length;
}

function includesAny(value: string | undefined, terms: string[]) {
  const lower = (value || "").toLowerCase();
  return terms.some((term) => lower.includes(term));
}

function transferDirectionPressure(transfers?: NormalizedTokenTransfer[]) {
  if (!transfers?.length) return undefined;

  const inCount = transfers.filter((transfer) => transfer.direction === "in").length;
  const outCount = transfers.filter((transfer) => transfer.direction === "out").length;
  const total = inCount + outCount;

  if (total === 0) return undefined;

  return {
    accumulation: (inCount / total) * 100,
    distribution: (outCount / total) * 100,
  };
}

function ownershipWeight(ownershipPercentage: number) {
  const ownership = Math.max(0, ownershipPercentage);
  return Math.min(12, 1 + Math.sqrt(ownership) * 1.8 + Math.log1p(ownership) * 1.4);
}

function compactAddress(value: string) {
  if (!value || value.length <= 14) return value || "unknown";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function buildConfidence({
  evidenceCount,
  holderConfidence,
  profileConfidence,
  reputationConfidence,
}: {
  evidenceCount: number;
  holderConfidence?: number;
  profileConfidence?: number;
  reputationConfidence?: string;
}) {
  const reputationScore =
    reputationConfidence === "High" ? 82 : reputationConfidence === "Medium" ? 62 : reputationConfidence === "Low" ? 42 : undefined;
  const coverageScore = Math.min(90, 26 + evidenceCount * 10);
  return clamp(average([coverageScore, holderConfidence, profileConfidence, reputationScore]) ?? coverageScore);
}

function flowDirection({
  accumulationScore,
  distributionScore,
  dormancyPressureScore,
  flowConfidenceScore,
  rotationScore,
}: Pick<
  WalletFlowV2Result,
  | "accumulationScore"
  | "distributionScore"
  | "dormancyPressureScore"
  | "flowConfidenceScore"
  | "rotationScore"
>) {
  if (flowConfidenceScore < 36) return "Unknown";
  if (dormancyPressureScore >= 72 && dormancyPressureScore >= rotationScore) return "Dormant";
  if (rotationScore >= 70 && rotationScore >= Math.max(accumulationScore, distributionScore) - 4) {
    return "Rotating";
  }
  if (accumulationScore >= distributionScore + 12) return "Accumulating";
  if (distributionScore >= accumulationScore + 12) return "Distributing";
  if (Math.max(accumulationScore, distributionScore, rotationScore, dormancyPressureScore) < 46) {
    return "Unknown";
  }
  return "Stable Holder";
}

export function calculateWalletFlowV2(input: WalletFlowV2Input): WalletFlowV2Result {
  const deep = input.deepBehavior;
  const holder = input.holderIntelligence;
  const reputation = input.walletReputation;
  const profile = input.walletProfile;
  const ownershipPercentage = Math.max(
    0,
    finiteNumber(input.ownershipPercentage) ?? holder?.ownershipPercentage ?? 0
  );
  const transferPressure = transferDirectionPressure(input.tokenTransfers);
  const profileActivity = average([
    profile?.activityVelocityScore,
    profile?.activityScore,
  ]);
  const activityPressureScore = clamp(
    average([
      profileActivity,
      holder?.reliabilityScore,
      deep?.tokenTransferTotalCount !== undefined
        ? Math.min(100, deep.tokenTransferTotalCount * 8)
        : undefined,
    ]) ?? 0
  );
  const behaviorLabel = [
    profile?.behaviorClass,
    holder?.holderClass,
    reputation?.walletClass,
  ].filter(Boolean).join(" ");
  const hasActiveAccumulatorClass =
    includesAny(behaviorLabel, ["active accumulator", "core conviction"]);
  const hasDistributionClass = includesAny(behaviorLabel, ["distribution pressure"]);
  const hasDormantClass = includesAny(behaviorLabel, ["dormant"]);
  const hasRotationClass = includesAny(behaviorLabel, ["rotation", "rotating"]);
  const reputationSupport = reputation
    ? reputation.reputationScore * 0.55 + reputation.convictionContribution * 0.45
    : undefined;
  const reputationRisk = reputation?.riskContribution;

  const accumulationScore = clamp(
    average([
      deep?.accumulationPressure,
      transferPressure?.accumulation,
      holder?.convictionContributionScore,
      reputationSupport,
      hasActiveAccumulatorClass ? 76 : undefined,
    ]) ?? 0
  );
  const weakConvictionMovement =
    activityPressureScore >= 65 && (holder?.convictionContributionScore ?? reputation?.convictionContribution ?? 50) < 45
      ? 72
      : undefined;
  const distributionScore = clamp(
    average([
      deep?.distributionPressure,
      transferPressure?.distribution,
      hasDistributionClass ? 78 : undefined,
      weakConvictionMovement,
      reputationRisk !== undefined && (deep?.distributionPressure ?? transferPressure?.distribution ?? 0) >= 58
        ? reputationRisk
        : undefined,
    ]) ?? 0
  );
  const rotationScore = clamp(
    average([
      deep?.rotationBehaviorRisk,
      holder?.rotationExposureScore,
      input.convictionSubscores?.rotationRisk,
      hasRotationClass ? 78 : undefined,
      activityPressureScore >= 68 && (holder?.behaviorStabilityScore ?? 55) < 45 ? 74 : undefined,
    ]) ?? 0
  );
  const lowRecentActivity =
    typeof profile?.daysSinceLastActive === "number" && profile.daysSinceLastActive >= 90
      ? 80
      : undefined;
  const dormancyPressureScore = clamp(
    average([
      profile?.dormancyRiskScore,
      holder?.dormancyScore,
      hasDormantClass ? 82 : undefined,
      lowRecentActivity,
      ownershipPercentage >= 2 && (profile?.dormancyRiskScore ?? holder?.dormancyScore ?? 0) >= 62
        ? 86
        : undefined,
    ]) ?? 0
  );
  const evidenceCount = [
    deep,
    holder,
    reputation,
    profile,
    transferPressure,
    finiteNumber(input.ownershipPercentage),
  ].filter(Boolean).length;
  const flowConfidenceScore = buildConfidence({
    evidenceCount,
    holderConfidence: holder?.confidenceScore,
    profileConfidence: profile?.dataConfidence,
    reputationConfidence: reputation?.confidence,
  });
  const adjustedDistribution = distributionScore + Math.max(0, rotationScore - 70) * 0.12;
  const netFlowBiasScore = clampBias(accumulationScore - adjustedDistribution);
  const weight = ownershipWeight(ownershipPercentage);
  const confidenceWeight = flowConfidenceScore / 100;
  const weightedAccumulationImpact = clamp(accumulationScore * weight * confidenceWeight, 0, 1200);
  const weightedDistributionImpact = clamp(distributionScore * weight * confidenceWeight, 0, 1200);
  const weightedRotationImpact = clamp(rotationScore * weight * confidenceWeight, 0, 1200);
  const weightedDormancyImpact = clamp(dormancyPressureScore * weight * confidenceWeight, 0, 1200);
  const missingEvidence: string[] = [];
  const positives: string[] = [];
  const negatives: string[] = [];
  const warnings: string[] = [];

  if (!deep) missingEvidence.push("deep token-transfer behavior");
  if (!holder) missingEvidence.push("holder intelligence profile");
  if (!reputation) missingEvidence.push("wallet reputation profile");
  if (!profile) missingEvidence.push("wallet activity profile");
  if (ownershipPercentage <= 0) missingEvidence.push("ownership percentage");
  if (!transferPressure && !deep) missingEvidence.push("token transfer direction evidence");

  if (accumulationScore >= distributionScore + 12) positives.push("Accumulation pressure exceeds distribution pressure.");
  if (reputationSupport !== undefined && reputationSupport >= 65) positives.push("Wallet reputation supports holder quality.");
  if (holder?.convictionContributionScore !== undefined && holder.convictionContributionScore >= 65) {
    positives.push("Holder Intelligence contribution is supportive.");
  }
  if (distributionScore >= accumulationScore + 12) negatives.push("Distribution pressure exceeds accumulation pressure.");
  if (rotationScore >= 65) negatives.push("Rotation exposure is elevated.");
  if (dormancyPressureScore >= 68) negatives.push("Dormancy pressure is elevated.");
  if (reputationRisk !== undefined && reputationRisk >= 65) negatives.push("Wallet Reputation risk contribution is elevated.");
  if (flowConfidenceScore < 45) warnings.push("Flow confidence is low because important evidence is missing.");
    if (deep?.dataQuality?.warnings?.length) warnings.push(deep.dataQuality.warnings[0]);
  if (missingEvidence.length) warnings.push("Missing evidence remains missing and is not inferred.");

  const direction = flowDirection({
    accumulationScore,
    distributionScore,
    dormancyPressureScore,
    flowConfidenceScore,
    rotationScore,
  });
  const oneLineSummary =
    direction === "Unknown"
      ? `${compactAddress(input.walletAddress || holder?.walletAddress || "unknown")} has insufficient flow evidence for a directional classification.`
      : `${compactAddress(input.walletAddress || holder?.walletAddress || "unknown")} is classified as ${direction.toLowerCase()} from available flow, holder and reputation evidence.`;

  return {
    walletAddress: input.walletAddress || holder?.walletAddress || reputation?.walletAddress || "unknown",
    ownershipPercentage,
    flowDirection: direction,
    accumulationScore,
    distributionScore,
    rotationScore,
    dormancyPressureScore,
    activityPressureScore,
    netFlowBiasScore,
    flowConfidenceScore,
    weightedAccumulationImpact,
    weightedDistributionImpact,
    weightedRotationImpact,
    weightedDormancyImpact,
    ownershipWeight: Number(weight.toFixed(2)),
    positives: Array.from(new Set(positives)).slice(0, 5),
    negatives: Array.from(new Set(negatives)).slice(0, 5),
    warnings: Array.from(new Set(warnings)).slice(0, 5),
    missingEvidence: Array.from(new Set(missingEvidence)).slice(0, 8),
    oneLineSummary,
  };
}

function weightedPressure(
  wallets: WalletFlowV2Result[],
  scoreKey: keyof Pick<
    WalletFlowV2Result,
    | "accumulationScore"
    | "distributionScore"
    | "rotationScore"
    | "dormancyPressureScore"
    | "activityPressureScore"
  >
) {
  const weighted = wallets.map((wallet) => ({
    score: wallet[scoreKey],
    weight: wallet.ownershipWeight * (wallet.flowConfidenceScore / 100),
  }));
  const totalWeight = weighted.reduce((total, item) => total + item.weight, 0);
  if (totalWeight <= 0) return 0;
  return clamp(
    weighted.reduce((total, item) => total + item.score * item.weight, 0) / totalWeight
  );
}

function summaryDominantFlow({
  accumulationPressure,
  activityPressure,
  distributionPressure,
  dormancyPressure,
  flowConfidence,
  rotationPressure,
}: {
  accumulationPressure: number;
  activityPressure: number;
  distributionPressure: number;
  dormancyPressure: number;
  flowConfidence: number;
  rotationPressure: number;
}): TokenDominantFlow {
  if (flowConfidence < 42) return "Data Limited";
  if (rotationPressure >= 68 && rotationPressure >= Math.max(accumulationPressure, distributionPressure)) {
    return "Rotation Heavy";
  }
  if (dormancyPressure >= 68 && activityPressure < 48) return "Dormancy Heavy";
  if (accumulationPressure - distributionPressure >= 12) return "Accumulation Dominant";
  if (distributionPressure - accumulationPressure >= 12) return "Distribution Dominant";
  return "Stable / Balanced";
}

function verdictForDominantFlow(dominantFlow: TokenDominantFlow, netFlowBias: number) {
  if (dominantFlow === "Data Limited") {
    return "Wallet Flow V2 is data-limited, so NovaOS is not inferring a directional flow regime.";
  }
  if (dominantFlow === "Rotation Heavy") {
    return "Rotation pressure is the leading wallet-flow condition in the available evidence.";
  }
  if (dominantFlow === "Dormancy Heavy") {
    return "Dormant or inactive ownership is materially shaping observed flow pressure.";
  }
  if (dominantFlow === "Accumulation Dominant") {
    return `Accumulation pressure leads distribution by ${Math.abs(netFlowBias)}/100 after ownership weighting.`;
  }
  if (dominantFlow === "Distribution Dominant") {
    return `Distribution pressure leads accumulation by ${Math.abs(netFlowBias)}/100 after ownership weighting.`;
  }
  return "Wallet flow is balanced or mixed in the available evidence.";
}

export function calculateTokenFlowSummaryV2(
  inputs: WalletFlowV2Input[] | WalletFlowV2Result[]
): TokenFlowSummaryV2 {
  const wallets = inputs.map((input) =>
    "flowDirection" in input ? input : calculateWalletFlowV2(input)
  );
  const analyzedWallets = wallets.length;
  const accumulationPressure = weightedPressure(wallets, "accumulationScore");
  const distributionPressure = weightedPressure(wallets, "distributionScore");
  const rotationPressure = weightedPressure(wallets, "rotationScore");
  const dormancyPressure = weightedPressure(wallets, "dormancyPressureScore");
  const activityPressure = weightedPressure(wallets, "activityPressureScore");
  const flowConfidence = analyzedWallets
    ? clamp(
        wallets.reduce((total, wallet) => total + wallet.flowConfidenceScore, 0) /
          analyzedWallets
      )
    : 0;
  const netFlowBias = clampBias(
    accumulationPressure - distributionPressure - Math.max(0, rotationPressure - 70) * 0.08
  );
  const dominantFlow = summaryDominantFlow({
    accumulationPressure,
    activityPressure,
    distributionPressure,
    dormancyPressure,
    flowConfidence,
    rotationPressure,
  });

  return {
    analyzedWallets,
    accumulationPressure,
    distributionPressure,
    rotationPressure,
    dormancyPressure,
    netFlowBias,
    flowConfidence,
    dominantFlow,
    accumulatingWallets: wallets.filter((wallet) => wallet.flowDirection === "Accumulating").length,
    distributingWallets: wallets.filter((wallet) => wallet.flowDirection === "Distributing").length,
    rotatingWallets: wallets.filter((wallet) => wallet.flowDirection === "Rotating").length,
    dormantWallets: wallets.filter((wallet) => wallet.flowDirection === "Dormant").length,
    stableWallets: wallets.filter((wallet) => wallet.flowDirection === "Stable Holder").length,
    unknownWallets: wallets.filter((wallet) => wallet.flowDirection === "Unknown").length,
    topAccumulationDrivers: [...wallets]
      .sort((left, right) => right.weightedAccumulationImpact - left.weightedAccumulationImpact)
      .slice(0, 5),
    topDistributionDrivers: [...wallets]
      .sort((left, right) => right.weightedDistributionImpact - left.weightedDistributionImpact)
      .slice(0, 5),
    topRotationDrivers: [...wallets]
      .sort((left, right) => right.weightedRotationImpact - left.weightedRotationImpact)
      .slice(0, 5),
    topDormancyDrivers: [...wallets]
      .sort((left, right) => right.weightedDormancyImpact - left.weightedDormancyImpact)
      .slice(0, 5),
    verdict: verdictForDominantFlow(dominantFlow, netFlowBias),
  };
}
