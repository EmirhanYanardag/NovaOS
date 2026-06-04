export type WalletReputationConfidence = "High" | "Medium" | "Low";

export type WalletQualityTier = "Strong" | "Moderate" | "Weak" | "Unknown";

export type WalletReputationClass =
  | "Conviction Holder"
  | "Active Accumulator"
  | "High-Risk Holder"
  | "Fresh Concentrated Wallet"
  | "Contract/System"
  | "Dormant Holder"
  | "Rotation Wallet"
  | "Unknown";

export type WalletReputationInput = {
  walletAddress?: string;
  holderRank?: number;
  ownershipPercentage?: number;
  balance?: string | number;
  isContract?: boolean;
  isExchange?: boolean;
  activityScore?: number;
  dormancyScore?: number;
  concentrationScore?: number;
  reliabilityScore?: number;
  personalityLabel?: string;
  behaviorLabel?: string;
  accumulationPressure?: number;
  distributionPressure?: number;
  rotationRisk?: number;
  freshWalletRisk?: number;
  relationshipCount?: number;
  clusterMembership?: boolean;
  suspiciousClusterOverlap?: boolean;
  bundleGroupMembership?: boolean;
  fundingSimilarity?: number;
  lastActivityAgeDays?: number;
};

export type WalletReputationResult = {
  walletAddress: string;
  reputationScore: number;
  convictionContribution: number;
  riskContribution: number;
  qualityTier: WalletQualityTier;
  walletClass: WalletReputationClass;
  positives: string[];
  negatives: string[];
  missingEvidence: string[];
  confidence: WalletReputationConfidence;
};

export type TokenWalletReputationSummary = {
  analyzedWallets: number;
  strongWallets: number;
  weakWallets: number;
  highRiskWallets: number;
  unknownWallets: number;
  averageReputation: number;
  averageConvictionContribution: number;
  averageRiskContribution: number;
  dominantWalletClass: WalletReputationClass;
  topPositiveWallets: WalletReputationResult[];
  topRiskWallets: WalletReputationResult[];
  summaryVerdict: string;
};

const REQUIRED_EVIDENCE: Array<keyof WalletReputationInput> = [
  "activityScore",
  "dormancyScore",
  "concentrationScore",
  "reliabilityScore",
  "accumulationPressure",
  "distributionPressure",
  "rotationRisk",
];

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function boundedNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? clampScore(value)
    : undefined;
}

function hasText(value?: string) {
  return Boolean(value && value.trim());
}

function evidenceLabel(key: keyof WalletReputationInput) {
  const labels: Record<string, string> = {
    activityScore: "activity score",
    dormancyScore: "dormancy score",
    concentrationScore: "concentration score",
    reliabilityScore: "profile reliability",
    accumulationPressure: "accumulation pressure",
    distributionPressure: "distribution pressure",
    rotationRisk: "rotation risk",
  };

  return labels[key] || key;
}

function confidenceFromCoverage(availableEvidence: number) {
  if (availableEvidence >= 6) return "High";
  if (availableEvidence >= 3) return "Medium";
  return "Low";
}

function qualityTier(score: number, confidence: WalletReputationConfidence) {
  if (confidence === "Low") return "Unknown";
  if (score >= 70) return "Strong";
  if (score >= 45) return "Moderate";
  return "Weak";
}

function walletClass({
  input,
  score,
}: {
  input: Required<
    Pick<
      WalletReputationInput,
      | "activityScore"
      | "dormancyScore"
      | "concentrationScore"
      | "reliabilityScore"
      | "accumulationPressure"
      | "distributionPressure"
      | "rotationRisk"
      | "freshWalletRisk"
    >
  > &
    WalletReputationInput;
  score: number;
}): WalletReputationClass {
  const behavior = (input.behaviorLabel || "").toLowerCase();
  const personality = (input.personalityLabel || "").toLowerCase();

  if (input.isContract || input.isExchange || behavior.includes("contract")) {
    return "Contract/System";
  }
  if (
    input.freshWalletRisk >= 65 ||
    behavior.includes("fresh") ||
    (input.concentrationScore >= 75 && input.reliabilityScore < 45)
  ) {
    return "Fresh Concentrated Wallet";
  }
  if (
    input.bundleGroupMembership ||
    input.suspiciousClusterOverlap ||
    (input.fundingSimilarity ?? 0) >= 70 ||
    score < 35
  ) {
    return "High-Risk Holder";
  }
  if (input.rotationRisk >= 65 || personality.includes("rotat")) {
    return "Rotation Wallet";
  }
  if (input.dormancyScore >= 70 || behavior.includes("dormant")) {
    return "Dormant Holder";
  }
  if (
    input.accumulationPressure >= 60 &&
    input.accumulationPressure > input.distributionPressure + 8
  ) {
    return "Active Accumulator";
  }
  if (score >= 68 && input.distributionPressure < 55 && input.rotationRisk < 55) {
    return "Conviction Holder";
  }
  return "Unknown";
}

export function calculateWalletReputation(
  walletInput: WalletReputationInput
): WalletReputationResult {
  const missingEvidence = REQUIRED_EVIDENCE.filter(
    (key) => boundedNumber(walletInput[key]) === undefined
  ).map(evidenceLabel);
  const availableEvidence = REQUIRED_EVIDENCE.length - missingEvidence.length;
  const confidence = confidenceFromCoverage(availableEvidence);
  const input = {
    ...walletInput,
    activityScore: boundedNumber(walletInput.activityScore) ?? 50,
    dormancyScore: boundedNumber(walletInput.dormancyScore) ?? 50,
    concentrationScore: boundedNumber(walletInput.concentrationScore) ?? 50,
    reliabilityScore: boundedNumber(walletInput.reliabilityScore) ?? 45,
    accumulationPressure: boundedNumber(walletInput.accumulationPressure) ?? 50,
    distributionPressure: boundedNumber(walletInput.distributionPressure) ?? 50,
    rotationRisk: boundedNumber(walletInput.rotationRisk) ?? 50,
    freshWalletRisk: boundedNumber(walletInput.freshWalletRisk) ?? 0,
    relationshipCount:
      typeof walletInput.relationshipCount === "number"
        ? walletInput.relationshipCount
        : 0,
    fundingSimilarity: boundedNumber(walletInput.fundingSimilarity) ?? 0,
  };
  const positives: string[] = [];
  const negatives: string[] = [];
  let score = 50;
  let convictionContribution = 45;
  let riskContribution = 35;

  const activityLift = (input.activityScore - 50) * 0.18;
  const reliabilityLift = (input.reliabilityScore - 50) * 0.2;
  const dormancyLift = (50 - input.dormancyScore) * 0.14;
  const concentrationLift = (50 - input.concentrationScore) * 0.16;
  const accumulationLift =
    (input.accumulationPressure - input.distributionPressure) * 0.15;
  const rotationLift = (50 - input.rotationRisk) * 0.18;
  const freshLift = (50 - input.freshWalletRisk) * 0.08;

  score +=
    activityLift +
    reliabilityLift +
    dormancyLift +
    concentrationLift +
    accumulationLift +
    rotationLift +
    freshLift;

  convictionContribution +=
    (input.activityScore - 50) * 0.16 +
    (input.reliabilityScore - 50) * 0.2 +
    (input.accumulationPressure - input.distributionPressure) * 0.22 +
    (50 - input.rotationRisk) * 0.12;

  riskContribution +=
    (input.concentrationScore - 50) * 0.2 +
    (input.dormancyScore - 50) * 0.12 +
    (input.rotationRisk - 50) * 0.24 +
    (input.distributionPressure - input.accumulationPressure) * 0.18 +
    input.freshWalletRisk * 0.1;

  if (input.activityScore >= 65) positives.push("Healthy wallet activity.");
  if (input.reliabilityScore >= 65) positives.push("Profile reliability is supportive.");
  if (input.dormancyScore <= 35) positives.push("Low dormancy risk.");
  if (input.concentrationScore <= 45) positives.push("Concentration risk is contained.");
  if (input.accumulationPressure > input.distributionPressure + 10) {
    positives.push("Accumulation pressure exceeds distribution pressure.");
  }
  if (input.rotationRisk <= 35) positives.push("Rotation risk is low.");
  if (!input.bundleGroupMembership && !input.suspiciousClusterOverlap) {
    positives.push("No bundle or suspicious cluster membership detected from available data.");
  }

  if (input.isContract || input.isExchange) {
    score -= 18;
    riskContribution += 18;
    negatives.push("Contract, exchange, or system-like wallet.");
  }
  if (input.concentrationScore >= 70) negatives.push("High concentration risk.");
  if (input.dormancyScore >= 70) negatives.push("Dormancy risk is elevated.");
  if (input.reliabilityScore <= 35) negatives.push("Profile reliability is low.");
  if (input.rotationRisk >= 65) negatives.push("Rotation behavior risk is elevated.");
  if (input.distributionPressure > input.accumulationPressure + 10) {
    negatives.push("Distribution pressure exceeds accumulation pressure.");
  }
  if (input.freshWalletRisk >= 65) negatives.push("Fresh-wallet risk is elevated.");
  if (input.bundleGroupMembership) {
    score -= 12;
    riskContribution += 16;
    negatives.push("Wallet appears in a detected bundle-like group.");
  }
  if (input.suspiciousClusterOverlap) {
    score -= 8;
    riskContribution += 10;
    negatives.push("Wallet has suspicious cluster overlap.");
  }
  if (input.fundingSimilarity >= 70) {
    score -= 7;
    riskContribution += 8;
    negatives.push("Funding similarity risk is elevated.");
  }
  if (input.relationshipCount >= 3) {
    riskContribution += 5;
    negatives.push("Multiple relationship links increase coordination risk.");
  }

  score -= missingEvidence.length * 1.2;
  if (!hasText(walletInput.walletAddress)) {
    missingEvidence.push("wallet address");
  }
  if (!hasText(walletInput.behaviorLabel)) {
    missingEvidence.push("behavior label");
  }
  if (!hasText(walletInput.personalityLabel)) {
    missingEvidence.push("personality label");
  }

  const reputationScore = clampScore(score);
  const normalizedInput = input as Required<
    Pick<
      WalletReputationInput,
      | "activityScore"
      | "dormancyScore"
      | "concentrationScore"
      | "reliabilityScore"
      | "accumulationPressure"
      | "distributionPressure"
      | "rotationRisk"
      | "freshWalletRisk"
    >
  > &
    WalletReputationInput;

  return {
    walletAddress: walletInput.walletAddress || "unknown",
    reputationScore,
    convictionContribution: clampScore(convictionContribution),
    riskContribution: clampScore(riskContribution),
    qualityTier: qualityTier(reputationScore, confidence),
    walletClass: walletClass({ input: normalizedInput, score: reputationScore }),
    positives: positives.slice(0, 4),
    negatives: negatives.slice(0, 4),
    missingEvidence: Array.from(new Set(missingEvidence)).slice(0, 8),
    confidence,
  };
}

export function calculateTokenWalletReputationSummary(
  wallets: WalletReputationResult[]
): TokenWalletReputationSummary {
  const analyzedWallets = wallets.length;
  const strongWallets = wallets.filter((wallet) => wallet.qualityTier === "Strong").length;
  const weakWallets = wallets.filter((wallet) => wallet.qualityTier === "Weak").length;
  const unknownWallets = wallets.filter((wallet) => wallet.qualityTier === "Unknown").length;
  const highRiskWallets = wallets.filter(
    (wallet) =>
      wallet.walletClass === "High-Risk Holder" ||
      wallet.walletClass === "Fresh Concentrated Wallet" ||
      wallet.walletClass === "Contract/System" ||
      wallet.riskContribution >= 68
  ).length;
  const average = (key: keyof Pick<
    WalletReputationResult,
    "reputationScore" | "convictionContribution" | "riskContribution"
  >) =>
    analyzedWallets
      ? clampScore(
          wallets.reduce((total, wallet) => total + wallet[key], 0) /
            analyzedWallets
        )
      : 0;
  const classCounts = wallets.reduce<Record<string, number>>((counts, wallet) => {
    counts[wallet.walletClass] = (counts[wallet.walletClass] || 0) + 1;
    return counts;
  }, {});
  const dominantWalletClass =
    (Object.entries(classCounts).sort((left, right) => right[1] - left[1])[0]?.[0] as
      | WalletReputationClass
      | undefined) || "Unknown";
  const averageReputation = average("reputationScore");
  const dataLimited =
    analyzedWallets === 0 ||
    unknownWallets / Math.max(analyzedWallets, 1) >= 0.55;
  const summaryVerdict = dataLimited
    ? "Wallet reputation is data-limited."
    : highRiskWallets > strongWallets && average("riskContribution") >= 58
      ? "Wallet reputation is risk-heavy."
      : strongWallets > weakWallets && averageReputation >= 58
        ? "Wallet reputation is supportive."
        : "Wallet reputation is mixed.";

  return {
    analyzedWallets,
    strongWallets,
    weakWallets,
    highRiskWallets,
    unknownWallets,
    averageReputation,
    averageConvictionContribution: average("convictionContribution"),
    averageRiskContribution: average("riskContribution"),
    dominantWalletClass,
    topPositiveWallets: [...wallets]
      .sort(
        (left, right) =>
          right.convictionContribution - left.convictionContribution ||
          right.reputationScore - left.reputationScore
      )
      .slice(0, 5),
    topRiskWallets: [...wallets]
      .sort(
        (left, right) =>
          right.riskContribution - left.riskContribution ||
          left.reputationScore - right.reputationScore
      )
      .slice(0, 5),
    summaryVerdict,
  };
}
