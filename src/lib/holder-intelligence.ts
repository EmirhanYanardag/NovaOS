export type HolderRiskTier = "Low" | "Moderate" | "Elevated" | "Critical" | "Unknown";

export type HolderContributionTier =
  | "Strong Support"
  | "Mild Support"
  | "Neutral"
  | "Mild Risk"
  | "Strong Risk"
  | "Unknown";

export type HolderClass =
  | "Core Conviction Holder"
  | "Active Accumulator"
  | "Concentrated Whale"
  | "Fresh High-Ownership Wallet"
  | "Rotation Wallet"
  | "Distribution Pressure Wallet"
  | "Contract/System Holder"
  | "Dormant Holder"
  | "Cluster-Exposed Holder"
  | "Unknown Holder";

export type HolderConfidenceLabel = "High" | "Medium" | "Low";

export type HolderIntelligenceInput = {
  walletAddress?: string;
  shortAddress?: string;
  holderRank?: number;
  balance?: string | number;
  ownershipPercentage?: number;
  isContract?: boolean;
  isExchange?: boolean;
  tokenSymbol?: string;
  tokenAddress?: string;
  chain?: string;
  activityScore?: number;
  dormancyScore?: number;
  concentrationScore?: number;
  reliabilityScore?: number;
  behaviorLabel?: string;
  personalityLabel?: string;
  confidenceLabel?: HolderConfidenceLabel;
  accumulationPressure?: number;
  distributionPressure?: number;
  rotationRisk?: number;
  averageDistributionPressure?: number;
  averageAccumulationPressure?: number;
  recentActivityScore?: number;
  hasTokenTransferEvidence?: boolean;
  relationshipCount?: number;
  clusterMembership?: boolean;
  clusterLabel?: string;
  clusterConfidence?: HolderConfidenceLabel;
  bundleGroupMembership?: boolean;
  fundingSimilarity?: number;
  sharedCounterpartyEvidence?: boolean;
  sameWindowActivityEvidence?: boolean;
  reputationScore?: number;
  reputationQualityTier?: string;
  reputationWalletClass?: string;
  reputationConvictionContribution?: number;
  reputationRiskContribution?: number;
  reputationPositives?: string[];
  reputationNegatives?: string[];
  reputationConfidence?: HolderConfidenceLabel;
};

export type HolderIntelligenceProfile = {
  walletAddress: string;
  shortAddress: string;
  holderRank?: number;
  ownershipPercentage?: number;
  balance?: string | number;
  holderStrengthScore: number;
  behaviorStabilityScore: number;
  concentrationRiskScore: number;
  clusterExposureScore: number;
  rotationExposureScore: number;
  dormancyScore: number;
  reliabilityScore: number;
  convictionContributionScore: number;
  riskContributionScore: number;
  overallHolderScore: number;
  holderClass: HolderClass;
  riskTier: HolderRiskTier;
  contributionTier: HolderContributionTier;
  positives: string[];
  negatives: string[];
  warnings: string[];
  missingEvidence: string[];
  confidenceScore: number;
  confidenceLabel: HolderConfidenceLabel;
  oneLineSummary: string;
  whyItMatters: string;
  methodologyNotes: string[];
};

export type HolderIntelligenceSummary = {
  analyzedHolders: number;
  strongSupportHolders: number;
  mildSupportHolders: number;
  neutralHolders: number;
  mildRiskHolders: number;
  strongRiskHolders: number;
  unknownHolders: number;
  averageHolderScore: number;
  averageConfidence: number;
  averageRiskContribution: number;
  averageConvictionContribution: number;
  highestConvictionHolder?: HolderIntelligenceProfile;
  highestRiskHolder?: HolderIntelligenceProfile;
  dominantHolderClass: HolderClass;
  dominantRiskType: string;
  topPositiveDrivers: string[];
  topRiskDrivers: string[];
  missingEvidenceSummary: string[];
  summaryVerdict:
    | "Holder base is supportive"
    | "Holder base is mixed"
    | "Holder base is risk-heavy"
    | "Holder base is data-limited"
    | "Holder base is concentrated"
    | "Holder base is cluster-exposed";
};

const IMPORTANT_EVIDENCE: Array<keyof HolderIntelligenceInput> = [
  "walletAddress",
  "ownershipPercentage",
  "activityScore",
  "dormancyScore",
  "concentrationScore",
  "reliabilityScore",
  "accumulationPressure",
  "distributionPressure",
  "rotationRisk",
  "relationshipCount",
  "reputationScore",
];

const evidenceLabels: Record<string, string> = {
  walletAddress: "wallet address",
  ownershipPercentage: "ownership percentage",
  activityScore: "activity score",
  dormancyScore: "dormancy score",
  concentrationScore: "concentration score",
  reliabilityScore: "reliability score",
  accumulationPressure: "accumulation pressure",
  distributionPressure: "distribution pressure",
  rotationRisk: "rotation risk",
  relationshipCount: "relationship count",
  reputationScore: "wallet reputation score",
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function boundedNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? clampScore(value)
    : undefined;
}

function normalizePercent(value?: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, value)
    : undefined;
}

function inverse(score: number) {
  return 100 - clampScore(score);
}

function compactAddress(value?: string) {
  if (!value) return "Unknown";
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function missingEvidence(input: HolderIntelligenceInput) {
  return IMPORTANT_EVIDENCE.filter((key) => {
    const value = input[key];
    if (typeof value === "number") return !Number.isFinite(value);
    return value === undefined || value === null || value === "";
  }).map((key) => evidenceLabels[key] || key);
}

function confidenceFromMissing(missingCount: number, explicit?: HolderConfidenceLabel) {
  const base = explicit === "High" ? 88 : explicit === "Medium" ? 68 : explicit === "Low" ? 46 : 72;
  return clampScore(base - missingCount * 5);
}

function labelFromConfidence(score: number): HolderConfidenceLabel {
  if (score >= 72) return "High";
  if (score >= 48) return "Medium";
  return "Low";
}

function contributionTier({
  confidenceLabel,
  convictionContributionScore,
  riskContributionScore,
}: {
  confidenceLabel: HolderConfidenceLabel;
  convictionContributionScore: number;
  riskContributionScore: number;
}): HolderContributionTier {
  if (confidenceLabel === "Low") return "Unknown";
  const delta = convictionContributionScore - riskContributionScore;
  if (delta >= 24) return "Strong Support";
  if (delta >= 8) return "Mild Support";
  if (delta <= -24) return "Strong Risk";
  if (delta <= -8) return "Mild Risk";
  return "Neutral";
}

function riskTier(score: number, confidenceLabel: HolderConfidenceLabel): HolderRiskTier {
  if (confidenceLabel === "Low") return "Unknown";
  if (score >= 75) return "Critical";
  if (score >= 58) return "Elevated";
  if (score >= 36) return "Moderate";
  return "Low";
}

function holderClass({
  accumulationPressure,
  behaviorLabel,
  clusterExposureScore,
  contribution,
  distributionPressure,
  dormancyScore,
  isContract,
  isExchange,
  ownership,
  reliabilityScore,
  reputationScore,
  rotationExposureScore,
}: {
  accumulationPressure: number;
  behaviorLabel: string;
  clusterExposureScore: number;
  contribution: HolderContributionTier;
  distributionPressure: number;
  dormancyScore: number;
  isContract: boolean;
  isExchange: boolean;
  ownership: number;
  reliabilityScore: number;
  reputationScore: number;
  rotationExposureScore: number;
}): HolderClass {
  const behavior = behaviorLabel.toLowerCase();
  if (isContract || isExchange || behavior.includes("contract")) return "Contract/System Holder";
  if ((behavior.includes("fresh") || reliabilityScore < 42) && ownership >= 2.5) {
    return "Fresh High-Ownership Wallet";
  }
  if (ownership >= 5) return "Concentrated Whale";
  if (rotationExposureScore >= 65) return "Rotation Wallet";
  if (distributionPressure > accumulationPressure + 12) return "Distribution Pressure Wallet";
  if (clusterExposureScore >= 58) return "Cluster-Exposed Holder";
  if (dormancyScore >= 68 || behavior.includes("dormant")) return "Dormant Holder";
  if (accumulationPressure > distributionPressure + 12 && boundedNumber(reputationScore)! >= 55) {
    return "Active Accumulator";
  }
  if (
    contribution === "Strong Support" &&
    reputationScore >= 62 &&
    clusterExposureScore < 45 &&
    rotationExposureScore < 45
  ) {
    return "Core Conviction Holder";
  }
  return "Unknown Holder";
}

function dominantReason(profile: HolderIntelligenceProfile) {
  if (profile.concentrationRiskScore >= 65) return "concentration";
  if (profile.clusterExposureScore >= 58) return "cluster exposure";
  if (profile.rotationExposureScore >= 58) return "rotation";
  if (profile.dormancyScore >= 65) return "dormancy";
  return "mixed risk";
}

function pushIf(list: string[], condition: boolean, text: string) {
  if (condition) list.push(text);
}

export function calculateHolderIntelligence(
  holderInput: HolderIntelligenceInput
): HolderIntelligenceProfile {
  const ownership = normalizePercent(holderInput.ownershipPercentage) ?? 0;
  const activityScore = boundedNumber(holderInput.activityScore) ?? 50;
  const dormancy = boundedNumber(holderInput.dormancyScore) ?? 50;
  const concentration = boundedNumber(holderInput.concentrationScore) ?? clampScore(ownership * 11);
  const reliability = boundedNumber(holderInput.reliabilityScore) ?? boundedNumber(holderInput.reputationScore) ?? 45;
  const accumulation = boundedNumber(holderInput.accumulationPressure) ?? boundedNumber(holderInput.averageAccumulationPressure) ?? 50;
  const distribution = boundedNumber(holderInput.distributionPressure) ?? boundedNumber(holderInput.averageDistributionPressure) ?? 50;
  const rotation = boundedNumber(holderInput.rotationRisk) ?? 50;
  const relationshipCount =
    typeof holderInput.relationshipCount === "number"
      ? Math.max(0, holderInput.relationshipCount)
      : 0;
  const fundingSimilarity = boundedNumber(holderInput.fundingSimilarity) ?? 0;
  const reputationScore = boundedNumber(holderInput.reputationScore) ?? 50;
  const reputationConviction = boundedNumber(holderInput.reputationConvictionContribution) ?? reputationScore;
  const reputationRisk = boundedNumber(holderInput.reputationRiskContribution) ?? 50;
  const isContract = Boolean(holderInput.isContract);
  const isExchange = Boolean(holderInput.isExchange);
  const positives: string[] = [];
  const negatives: string[] = [];
  const warnings: string[] = [];
  const missing = missingEvidence(holderInput);

  const holderStrengthScore = clampScore(
    42 +
      Math.min(ownership, 8) * 5 +
      (activityScore - 50) * 0.18 +
      (reliability - 50) * 0.16 -
      Math.max(0, ownership - 8) * 3
  );
  const behaviorStabilityScore = clampScore(
    58 +
      (reliability - 50) * 0.24 +
      (activityScore - 50) * 0.14 +
      (50 - dormancy) * 0.18 +
      (50 - rotation) * 0.18
  );
  const clusterExposureScore = clampScore(
    relationshipCount * 14 +
      (holderInput.clusterMembership ? 14 : 0) +
      (holderInput.bundleGroupMembership ? 28 : 0) +
      (holderInput.sharedCounterpartyEvidence ? 12 : 0) +
      (holderInput.sameWindowActivityEvidence ? 12 : 0) +
      fundingSimilarity * 0.22
  );
  const rotationExposureScore = clampScore(
    rotation * 0.78 + Math.max(0, distribution - accumulation) * 0.22
  );

  const convictionContributionScore = clampScore(
    30 +
      Math.min(ownership, 6) * 4 +
      (accumulation - distribution) * 0.22 +
      (reliability - 50) * 0.18 +
      (activityScore - 50) * 0.14 +
      inverse(clusterExposureScore) * 0.1 +
      inverse(rotationExposureScore) * 0.12 +
      (reputationConviction - 50) * 0.22
  );
  const riskContributionScore = clampScore(
    concentration * 0.26 +
      clusterExposureScore * 0.24 +
      rotationExposureScore * 0.22 +
      Math.max(0, distribution - accumulation) * 0.18 +
      fundingSimilarity * 0.08 +
      (isContract || isExchange ? Math.min(28, ownership * 3) : 0) +
      (reputationRisk - 50) * 0.12
  );

  // Overall score uses the requested V2 weights. Risk dimensions are inverted
  // because lower concentration, cluster exposure and rotation are better.
  const overallHolderScore = clampScore(
    holderStrengthScore * 0.22 +
      behaviorStabilityScore * 0.18 +
      reliability * 0.16 +
      convictionContributionScore * 0.14 +
      inverse(concentration) * 0.12 +
      inverse(clusterExposureScore) * 0.1 +
      inverse(rotationExposureScore) * 0.08
  );
  const confidenceScore = confidenceFromMissing(
    missing.length,
    holderInput.confidenceLabel || holderInput.reputationConfidence
  );
  const confidenceLabel = labelFromConfidence(confidenceScore);
  const contribution = contributionTier({
    confidenceLabel,
    convictionContributionScore,
    riskContributionScore,
  });
  const holderClassValue = holderClass({
    accumulationPressure: accumulation,
    behaviorLabel: holderInput.behaviorLabel || "",
    clusterExposureScore,
    contribution,
    distributionPressure: distribution,
    dormancyScore: dormancy,
    isContract,
    isExchange,
    ownership,
    reliabilityScore: reliability,
    reputationScore,
    rotationExposureScore,
  });
  const riskTierValue = riskTier(riskContributionScore, confidenceLabel);

  pushIf(positives, ownership > 0 && ownership < 5, "Meaningful ownership without whale-level concentration.");
  pushIf(positives, reliability >= 65, "Reliability evidence is supportive.");
  pushIf(positives, activityScore >= 60, "Activity evidence is healthy.");
  pushIf(positives, accumulation > distribution + 10, "Accumulation pressure exceeds distribution pressure.");
  pushIf(positives, rotationExposureScore <= 38, "Rotation exposure is low.");
  pushIf(positives, clusterExposureScore <= 30, "Cluster and bundle exposure are low from available data.");
  pushIf(positives, reputationScore >= 65, "Wallet Reputation is supportive.");

  pushIf(negatives, ownership >= 5, "Ownership concentration is whale-level.");
  pushIf(negatives, isContract || isExchange, "Contract, exchange, or system holder evidence is present.");
  pushIf(negatives, distribution > accumulation + 10, "Distribution pressure exceeds accumulation pressure.");
  pushIf(negatives, rotationExposureScore >= 60, "Rotation exposure is elevated.");
  pushIf(negatives, clusterExposureScore >= 58, "Cluster, bundle, funding, or timing exposure is elevated.");
  pushIf(negatives, dormancy >= 68, "Dormancy risk is elevated.");
  pushIf(negatives, reliability <= 38, "Reliability evidence is weak.");
  pushIf(negatives, reputationRisk >= 65, "Wallet Reputation risk contribution is elevated.");

  pushIf(warnings, missing.length > 0, "Some holder evidence is unavailable and lowers confidence.");
  pushIf(warnings, !holderInput.hasTokenTransferEvidence, "Token transfer evidence unavailable.");
  pushIf(warnings, true, "PnL and win-rate are not calculated.");
  pushIf(warnings, true, "No verified identity is inferred.");

  const address = holderInput.walletAddress || "unknown";
  const oneLineSummary =
    holderClassValue === "Contract/System Holder"
      ? "This wallet is contract or system-labeled, so NovaOS treats it as structural context rather than organic holder conviction."
      : contribution === "Strong Support" || contribution === "Mild Support"
        ? "This holder contributes support through available ownership, reliability, behavior and lower risk evidence."
        : contribution === "Strong Risk" || contribution === "Mild Risk"
          ? "This holder contributes more downside or structural risk than holder conviction from available evidence."
          : "This holder has mixed or limited evidence, so NovaOS keeps the interpretation conservative.";
  const whyItMatters =
    ownership > 0
      ? `This holder controls ${ownership.toFixed(2)}% of observed supply. ${oneLineSummary}`
      : `Ownership is unavailable or negligible. ${oneLineSummary}`;

  return {
    walletAddress: address,
    shortAddress: holderInput.shortAddress || compactAddress(address),
    holderRank: holderInput.holderRank,
    ownershipPercentage: holderInput.ownershipPercentage,
    balance: holderInput.balance,
    holderStrengthScore,
    behaviorStabilityScore,
    concentrationRiskScore: concentration,
    clusterExposureScore,
    rotationExposureScore,
    dormancyScore: dormancy,
    reliabilityScore: reliability,
    convictionContributionScore,
    riskContributionScore,
    overallHolderScore,
    holderClass: holderClassValue,
    riskTier: riskTierValue,
    contributionTier: contribution,
    positives: Array.from(new Set(positives)).slice(0, 5),
    negatives: Array.from(new Set(negatives)).slice(0, 5),
    warnings: Array.from(new Set(warnings)).slice(0, 5),
    missingEvidence: Array.from(new Set(missing)).slice(0, 8),
    confidenceScore,
    confidenceLabel,
    oneLineSummary,
    whyItMatters,
    methodologyNotes: [
      "Holder Intelligence V2 uses available holder metadata, wallet behavior, relationship evidence, bundle/funding signals and Wallet Reputation.",
      "It does not calculate PnL, win rate, average entry, average exit, smart money identity, insider identity, or unavailable wallet history.",
      "Missing evidence reduces confidence more than score and is reported explicitly.",
    ],
  };
}

export function calculateHolderIntelligenceMatrix(
  inputs: HolderIntelligenceInput[]
): HolderIntelligenceProfile[] {
  return inputs.map(calculateHolderIntelligence);
}

function averageScore<T>(items: T[], getScore: (item: T) => number) {
  return items.length
    ? clampScore(items.reduce((total, item) => total + getScore(item), 0) / items.length)
    : 0;
}

function mostCommon<T extends string>(values: T[], fallback: T) {
  const counts = values.reduce<Record<string, number>>((record, value) => {
    record[value] = (record[value] || 0) + 1;
    return record;
  }, {});
  return (Object.entries(counts).sort((left, right) => right[1] - left[1])[0]?.[0] as T) || fallback;
}

function topTerms(matrix: HolderIntelligenceProfile[], key: "positives" | "negatives" | "missingEvidence") {
  const counts = matrix
    .flatMap((profile) => profile[key])
    .reduce<Record<string, number>>((record, item) => {
      record[item] = (record[item] || 0) + 1;
      return record;
    }, {});

  return Object.entries(counts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([label, count]) => `${label} (${count})`);
}

export function summarizeHolderIntelligence(
  matrix: HolderIntelligenceProfile[]
): HolderIntelligenceSummary {
  const analyzedHolders = matrix.length;
  const strongSupportHolders = matrix.filter((holder) => holder.contributionTier === "Strong Support").length;
  const mildSupportHolders = matrix.filter((holder) => holder.contributionTier === "Mild Support").length;
  const neutralHolders = matrix.filter((holder) => holder.contributionTier === "Neutral").length;
  const mildRiskHolders = matrix.filter((holder) => holder.contributionTier === "Mild Risk").length;
  const strongRiskHolders = matrix.filter((holder) => holder.contributionTier === "Strong Risk").length;
  const unknownHolders = matrix.filter((holder) => holder.contributionTier === "Unknown").length;
  const highestConvictionHolder = [...matrix].sort(
    (left, right) => right.convictionContributionScore - left.convictionContributionScore
  )[0];
  const highestRiskHolder = [...matrix].sort(
    (left, right) => right.riskContributionScore - left.riskContributionScore
  )[0];
  const dominantHolderClass = mostCommon(
    matrix.map((holder) => holder.holderClass),
    "Unknown Holder" as HolderClass
  );
  const riskTypeCounts = matrix.reduce<Record<string, number>>((counts, profile) => {
    counts[dominantReason(profile)] = (counts[dominantReason(profile)] || 0) + 1;
    return counts;
  }, {});
  const dominantRiskType =
    Object.entries(riskTypeCounts).sort((left, right) => right[1] - left[1])[0]?.[0] || "data-limited";
  const averageHolderScore = averageScore(matrix, (holder) => holder.overallHolderScore);
  const averageRiskContribution = averageScore(matrix, (holder) => holder.riskContributionScore);
  const averageConvictionContribution = averageScore(matrix, (holder) => holder.convictionContributionScore);
  const averageConfidence = averageScore(matrix, (holder) => holder.confidenceScore);
  const dataLimited = analyzedHolders === 0 || unknownHolders / Math.max(analyzedHolders, 1) >= 0.5 || averageConfidence < 45;
  const concentrated = matrix.filter((holder) => holder.concentrationRiskScore >= 65).length >= Math.max(1, analyzedHolders * 0.28);
  const clusterExposed = matrix.filter((holder) => holder.clusterExposureScore >= 58).length >= Math.max(1, analyzedHolders * 0.28);
  const riskHeavy = strongRiskHolders + mildRiskHolders > strongSupportHolders + mildSupportHolders && averageRiskContribution >= 55;
  const supportive = strongSupportHolders + mildSupportHolders > mildRiskHolders + strongRiskHolders && averageHolderScore >= 56;
  const summaryVerdict: HolderIntelligenceSummary["summaryVerdict"] = dataLimited
    ? "Holder base is data-limited"
    : concentrated
      ? "Holder base is concentrated"
      : clusterExposed
        ? "Holder base is cluster-exposed"
        : riskHeavy
          ? "Holder base is risk-heavy"
          : supportive
            ? "Holder base is supportive"
            : "Holder base is mixed";

  return {
    analyzedHolders,
    strongSupportHolders,
    mildSupportHolders,
    neutralHolders,
    mildRiskHolders,
    strongRiskHolders,
    unknownHolders,
    averageHolderScore,
    averageConfidence,
    averageRiskContribution,
    averageConvictionContribution,
    highestConvictionHolder,
    highestRiskHolder,
    dominantHolderClass,
    dominantRiskType,
    topPositiveDrivers: topTerms(matrix, "positives"),
    topRiskDrivers: topTerms(matrix, "negatives"),
    missingEvidenceSummary: topTerms(matrix, "missingEvidence"),
    summaryVerdict,
  };
}
