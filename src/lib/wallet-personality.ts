import type { MemoryConfidenceLabel, WalletMemoryResult } from "./wallet-memory";

export type WalletPersonalityType =
  | "Conviction Accumulator"
  | "Rotation Hunter"
  | "Passive Holder"
  | "High Activity Trader"
  | "Fresh Wallet"
  | "Contract/System Wallet"
  | "Insufficient Data";

export type WalletPersonalityResult = {
  walletAddress: string;
  shortAddress: string;
  personalityType: WalletPersonalityType;
  personalitySubtitle: string;
  personalityScores: {
    conviction: number;
    rotation: number;
    consistency: number;
    activity: number;
    concentrationAwareness: number;
    reliability: number;
  };
  traits: string[];
  strengths: string[];
  riskNotes: string[];
  shareCardText: string;
  confidenceLabel: MemoryConfidenceLabel;
  methodologyNote: string;
  warnings: string[];
};

export function buildWalletPersonality({
  isContract = false,
  memory,
  tokenAddress,
  walletAddress,
  walletAgeDays,
}: {
  isContract?: boolean;
  memory: WalletMemoryResult;
  tokenAddress?: string | null;
  walletAddress: string;
  walletAgeDays: number | null;
}): WalletPersonalityResult {
  const activity = calculateActivityScore(memory);
  const reliability = reliabilityFromConfidence(memory.confidenceLabel);
  const concentrationAwareness = calculateConcentrationAwareness({
    memory,
    tokenAddress,
  });
  const scores = {
    conviction: memory.convictionBehaviorScore,
    rotation: memory.rotationScore,
    consistency: memory.consistencyScore,
    activity,
    concentrationAwareness,
    reliability,
  };
  const personalityType = classifyPersonality({
    activity,
    isContract,
    memory,
    walletAgeDays,
  });
  const personalitySubtitle = subtitleForPersonality(personalityType);
  const traits = buildTraits({ memory, personalityType, scores });
  const strengths = buildStrengths({ memory, personalityType, scores });
  const riskNotes = buildRiskNotes({ memory, personalityType, scores });
  const shareCardText =
    `NovaOS classifies this wallet as a ${personalityType}: ` +
    `${personalitySubtitle.toLowerCase()} This is behavioral inference, not profitability analysis.`;

  return {
    walletAddress,
    shortAddress: shortAddress(walletAddress),
    personalityType,
    personalitySubtitle,
    personalityScores: scores,
    traits,
    strengths,
    riskNotes,
    shareCardText,
    confidenceLabel: memory.confidenceLabel,
    methodologyNote:
      "NovaOS classifies this wallet based on wallet metadata, transfer patterns and runtime memory. This is not a profitability or identity claim.",
    warnings: [
      "Wallet Personality Engine V1 does not calculate PnL, win rate or average hold duration.",
      "No smart money, insider identity or shared ownership claim is made.",
      "Personality labels are behavior-inference categories and may change as more wallet history is indexed.",
      ...memory.warnings,
    ],
  };
}

function classifyPersonality({
  activity,
  isContract,
  memory,
  walletAgeDays,
}: {
  activity: number;
  isContract: boolean;
  memory: WalletMemoryResult;
  walletAgeDays: number | null;
}): WalletPersonalityType {
  if (isContract) return "Contract/System Wallet";
  if (memory.transactionCount < 5) return "Insufficient Data";
  if (walletAgeDays !== null && walletAgeDays <= 14) return "Fresh Wallet";
  if (activity >= 78 && memory.rotationScore >= 58) return "High Activity Trader";
  if (memory.rotationScore >= 68 || memory.narrativeExposure.score >= 72) {
    return "Rotation Hunter";
  }
  if (
    memory.convictionBehaviorScore >= 64 &&
    memory.consistencyScore >= 48 &&
    memory.rotationScore < 68
  ) {
    return "Conviction Accumulator";
  }
  if (activity <= 36 || memory.consistencyScore >= 58) return "Passive Holder";
  return "Passive Holder";
}

function subtitleForPersonality(personalityType: WalletPersonalityType) {
  if (personalityType === "Conviction Accumulator") {
    return "repeated token participation with steadier transfer patterns.";
  }

  if (personalityType === "Rotation Hunter") {
    return "broad token exposure and higher rotation tendency.";
  }

  if (personalityType === "High Activity Trader") {
    return "high recent transfer activity and frequent token movement.";
  }

  if (personalityType === "Fresh Wallet") {
    return "newer observed activity with limited behavior history.";
  }

  if (personalityType === "Contract/System Wallet") {
    return "system-like wallet behavior that should not be interpreted as human trading.";
  }

  if (personalityType === "Insufficient Data") {
    return "too little recent transfer history for a strong classification.";
  }

  return "lower activity or steadier holding-style behavior.";
}

function buildTraits({
  memory,
  personalityType,
  scores,
}: {
  memory: WalletMemoryResult;
  personalityType: WalletPersonalityType;
  scores: WalletPersonalityResult["personalityScores"];
}) {
  const traits = [
    `${personalityType} classification`,
    `${memory.narrativeExposure.label} narrative exposure`,
  ];

  if (scores.activity >= 70) traits.push("High recent activity");
  if (scores.consistency >= 60) traits.push("Consistent runtime pattern");
  if (scores.rotation >= 65) traits.push("Rotation-oriented behavior");
  if (memory.repeatedTokenCount >= 2) traits.push("Repeated token participation");
  if (memory.repeatedWalletSeen) traits.push("Seen in runtime memory before");

  return unique(traits).slice(0, 6);
}

function buildStrengths({
  memory,
  personalityType,
  scores,
}: {
  memory: WalletMemoryResult;
  personalityType: WalletPersonalityType;
  scores: WalletPersonalityResult["personalityScores"];
}) {
  const strengths: string[] = [];

  if (personalityType === "Conviction Accumulator") {
    strengths.push("Shows repeated exposure to a smaller token set.");
  }

  if (scores.consistency >= 55) {
    strengths.push("Runtime memory suggests a more consistent behavior pattern.");
  }

  if (scores.activity >= 65) {
    strengths.push("Recent transfer activity is strong enough for richer behavior inference.");
  }

  if (memory.recurringClusterAppearance.detected) {
    strengths.push("Recurring pattern signals were observed in memory and transfer metadata.");
  }

  if (strengths.length === 0) {
    strengths.push("Classification remains cautious because available behavior signals are limited.");
  }

  return strengths.slice(0, 4);
}

function buildRiskNotes({
  memory,
  personalityType,
  scores,
}: {
  memory: WalletMemoryResult;
  personalityType: WalletPersonalityType;
  scores: WalletPersonalityResult["personalityScores"];
}) {
  const notes = [
    "This personality is inferred from behavior metadata, not profitability.",
  ];

  if (personalityType === "Rotation Hunter" || scores.rotation >= 65) {
    notes.push("Higher rotation tendency can indicate less stable token exposure.");
  }

  if (memory.narrativeExposure.score >= 70) {
    notes.push("Broad token exposure may indicate narrative chasing behavior.");
  }

  if (memory.confidenceLabel === "Low") {
    notes.push("Low confidence means transfer history or repeated patterns are sparse.");
  }

  return notes.slice(0, 4);
}

function calculateActivityScore(memory: WalletMemoryResult) {
  return clampScore(
    Math.min(45, memory.transactionCount * 2) +
      Math.min(35, memory.activeDaysEstimate * 8) +
      Math.min(20, memory.repeatedTokenCount * 5)
  );
}

function calculateConcentrationAwareness({
  memory,
  tokenAddress,
}: {
  memory: WalletMemoryResult;
  tokenAddress?: string | null;
}) {
  const tokenSeen = Boolean(
    tokenAddress &&
      memory.interactedTokenAddresses.includes(tokenAddress.toLowerCase())
  );
  const focusBonus =
    memory.narrativeExposure.label === "Focused"
      ? 28
      : memory.narrativeExposure.label === "Mixed"
      ? 16
      : 6;
  const repeatedBonus = Math.min(42, memory.repeatedTokenCount * 9);
  const tokenBonus = tokenSeen ? 20 : 0;

  return clampScore(focusBonus + repeatedBonus + tokenBonus);
}

function reliabilityFromConfidence(confidence: MemoryConfidenceLabel) {
  if (confidence === "High") return 85;
  if (confidence === "Medium") return 60;
  return 35;
}

function shortAddress(address: string) {
  if (!address || address.length < 10) return address || "Unknown";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
