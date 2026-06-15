import type { GMGNHolder } from "@/lib/gmgn";
import type { WalletAlphaLight } from "@/lib/wallet-alpha-light-engine";
import type { WalletAlphaV3Result } from "@/lib/wallet-alpha-v3-engine";

type HolderAlphaV31Tier = "elite" | "strong" | "good" | "average" | "weak" | "toxic";
type ThesisQuality = "elite" | "strong" | "mixed" | "weak" | "toxic";
type ThesisConfidence = "high" | "medium" | "low";
type UnknownRecord = Record<string, unknown>;
export type AnalysisMode = "fast" | "balanced" | "deep";
type AnalysisDepth = "deep" | "light";
type WalletAlphaSource = "wallet-alpha-v3.3-deep" | "gmgn-portfolio-stats-light" | "wallet-alpha-light-fallback";

export type NormalizedHolderOwnership = {
  rawAmountPercentage: number | null;
  ownershipFraction: number;
  ownershipPercent: number;
};

export type Top100HolderAlphaV3WalletResult = NormalizedHolderOwnership & {
  wallet: string;
  holderRank: number;
  usdValue: number | null;
  analysisDepth: AnalysisDepth;
  walletAlphaScore: number;
  walletAlphaSource: WalletAlphaSource;
  isFallback: boolean;
  sourceAvailable: boolean;
  walletAlphaV3: number;
  confidenceLevel: WalletAlphaV3Result["confidenceLevel"] | WalletAlphaLight["confidenceLevel"];
  entryDisciplineV3: number | null;
  exitDisciplineV3: number | null;
  consistencyV3: number | null;
  winRateQualityV3: number | null;
  rotationQualityV3: number | null;
  riskHygieneV3: number | null;
  dataConfidenceV3: number;
  holderLabels: string[];
  isSmartLikeHolder: boolean;
  isSniperLikeHolder: boolean;
  isBundlerLikeHolder: boolean;
  isSuspiciousLikeHolder: boolean;
  isFreshLikeHolder: boolean;
  isWhaleLikeHolder: boolean;
  rawMetrics: Record<string, unknown>;
  lightScoreBreakdown?: WalletAlphaLight["scoreBreakdown"];
  explanations: string[];
  warnings: string[];
};

export type HolderCompositionThesis = {
  summary: string;
  quality: ThesisQuality;
  confidence: ThesisConfidence;
  keyPoints: string[];
};

export type Top100HolderAlphaV3Result = {
  version: "top100-holder-alpha-v3.2-wallet-alpha-v3.3";
  holderAlphaV3Score: number;
  rawHolderQuality: number;
  confidenceModifier: number;
  weightedWalletAlphaV3: number | null;
  simpleAverageWalletAlphaV3: number | null;
  holderCompositionScore: number;
  walletDataConfidenceScore: number | null;
  holderSetCoverageScore: number;
  confidenceScore: number;
  weightedHolderWalletScore: number | null;
  simpleAverageHolderWalletScore: number | null;
  analysisMode: AnalysisMode;
  deepAnalyzedWalletCount: number;
  lightAnalyzedWalletCount: number;
  deepHolderLimit: number;
  lightHolderLimit: number;
  estimatedCostLevel: "low" | "medium" | "high";
  realLightWalletCount: number;
  fallbackLightWalletCount: number;
  deepScoreWeightShare: number;
  realLightScoreWeightShare: number;
  fallbackScoreWeightShare: number;
  holderCount: number;
  analyzedWalletCount: number;
  failedWalletCount: number;
  eliteWalletCount: number;
  strongWalletCount: number;
  goodWalletCount: number;
  averageWalletCount: number;
  weakWalletCount: number;
  toxicWalletCount: number;
  eliteOwnershipPercent: number;
  strongOwnershipPercent: number;
  goodOwnershipPercent: number;
  averageOwnershipPercent: number;
  weakOwnershipPercent: number;
  toxicOwnershipPercent: number;
  goodOrBetterOwnershipPercent: number;
  weakOrToxicOwnershipPercent: number;
  totalAnalyzedOwnershipPercent: number;
  smartLikeHolderCount: number;
  sniperLikeHolderCount: number;
  bundlerLikeHolderCount: number;
  suspiciousLikeHolderCount: number;
  freshLikeHolderCount: number;
  whaleLikeHolderCount: number;
  smartLikeOwnershipPercent: number;
  sniperLikeOwnershipPercent: number;
  bundlerLikeOwnershipPercent: number;
  suspiciousLikeOwnershipPercent: number;
  freshLikeOwnershipPercent: number;
  whaleLikeOwnershipPercent: number;
  holderCompositionThesis: HolderCompositionThesis;
  topWalletsByAlphaV3: Top100HolderAlphaV3WalletResult[];
  bottomWalletsByAlphaV3: Top100HolderAlphaV3WalletResult[];
  allWalletsByHolderRank: Top100HolderAlphaV3WalletResult[];
  allWalletsByAlphaV3: Top100HolderAlphaV3WalletResult[];
  holderResults: Top100HolderAlphaV3WalletResult[];
  explanations: string[];
  warnings: string[];
};

type HolderAlphaV3Input = {
  holder: GMGNHolder;
  holderRank: number;
  analysisDepth?: AnalysisDepth;
  walletAlpha: WalletAlphaV3Result | WalletAlphaLight;
  walletAlphaSource?: WalletAlphaSource;
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function round(value: number, decimals = 2) {
  return Number(value.toFixed(decimals));
}

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function holderWallet(holder: GMGNHolder) {
  return holder.wallet || holder.address || null;
}

function normalizedOwnership(holder: GMGNHolder): NormalizedHolderOwnership {
  const rawAmountPercentage =
    typeof holder.amountPercentage === "number" && Number.isFinite(holder.amountPercentage)
      ? holder.amountPercentage
      : null;

  if (rawAmountPercentage === null || rawAmountPercentage <= 0) {
    return {
      rawAmountPercentage,
      ownershipFraction: 0,
      ownershipPercent: 0,
    };
  }

  if (rawAmountPercentage <= 1) {
    return {
      rawAmountPercentage,
      ownershipFraction: rawAmountPercentage,
      ownershipPercent: round(rawAmountPercentage * 100, 6),
    };
  }

  return {
    rawAmountPercentage,
    ownershipFraction: rawAmountPercentage / 100,
    ownershipPercent: round(rawAmountPercentage, 6),
  };
}

function tier(score: number): HolderAlphaV31Tier {
  if (score >= 80) return "elite";
  if (score >= 65) return "strong";
  if (score >= 55) return "good";
  if (score >= 45) return "average";
  if (score >= 25) return "weak";
  return "toxic";
}

function emptyTierCounts() {
  return {
    elite: 0,
    strong: 0,
    good: 0,
    average: 0,
    weak: 0,
    toxic: 0,
  } satisfies Record<HolderAlphaV31Tier, number>;
}

function rankWeight(rank: number) {
  if (rank <= 10) return 1;
  if (rank <= 25) return 0.75;
  if (rank <= 50) return 0.55;
  if (rank <= 100) return 0.35;
  return 0.2;
}

function holderCombinedWeight(input: HolderAlphaV3Input) {
  const ownership = normalizedOwnership(input.holder);
  const sqrtOwnershipWeight = Math.sqrt(Math.max(ownership.ownershipFraction, 0));
  return sqrtOwnershipWeight * 0.7 + rankWeight(input.holderRank) * 0.3;
}

function holderResultCombinedWeight(holder: Top100HolderAlphaV3WalletResult) {
  const sqrtOwnershipWeight = Math.sqrt(Math.max(holder.ownershipFraction, 0));
  return sqrtOwnershipWeight * 0.7 + rankWeight(holder.holderRank) * 0.3;
}

function dedupeHolderResults(holderResults: Top100HolderAlphaV3WalletResult[]) {
  const seen = new Set<string>();
  return holderResults.filter((holder) => {
    const key = holder.wallet.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function walletAlphaScore(input: HolderAlphaV3Input) {
  return "walletAlphaV3" in input.walletAlpha
    ? input.walletAlpha.walletAlphaV3
    : input.walletAlpha.walletAlphaLight;
}

function isWalletAlphaV3Result(input: WalletAlphaV3Result | WalletAlphaLight): input is WalletAlphaV3Result {
  return "walletAlphaV3" in input;
}

function walletAlphaConfidenceScore(input: WalletAlphaV3Result | WalletAlphaLight) {
  if (isWalletAlphaV3Result(input)) return input.scores.dataConfidenceV3;
  if (input.isFallback || !input.sourceAvailable) return 35;
  if (input.confidenceLevel === "high") return 80;
  if (input.confidenceLevel === "medium") return 60;
  return 35;
}

function walletAlphaSource(input: HolderAlphaV3Input): WalletAlphaSource {
  if (input.walletAlphaSource) return input.walletAlphaSource;
  if ("walletAlphaV3" in input.walletAlpha) return "wallet-alpha-v3.3-deep";
  return input.walletAlpha.isFallback ? "wallet-alpha-light-fallback" : "gmgn-portfolio-stats-light";
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function collectLabelValues(value: unknown, labels: Set<string>) {
  const direct = stringValue(value);
  if (direct) {
    labels.add(direct);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectLabelValues(item, labels);
    return;
  }

  if (!isRecord(value)) return;

  for (const [key, nestedValue] of Object.entries(value)) {
    if (typeof nestedValue === "boolean" && nestedValue) labels.add(key);
    else collectLabelValues(nestedValue, labels);
  }
}

function holderLabels(holder: GMGNHolder) {
  const labels = new Set<string>();
  const raw = isRecord(holder.raw) ? holder.raw : {};
  const labelKeys = [
    "wallet_tag_v2",
    "tags",
    "maker_token_tags",
    "tag",
    "label",
    "wallet_tag",
    "walletTag",
    "walletType",
    "wallet_type",
  ];

  for (const key of labelKeys) collectLabelValues(raw[key], labels);
  if (holder.tag) labels.add(holder.tag);
  if (holder.label) labels.add(holder.label);

  return Array.from(labels)
    .map((label) => label.trim())
    .filter(Boolean)
    .filter((label, index, all) => all.findIndex((item) => item.toLowerCase() === label.toLowerCase()) === index);
}

function hasLabel(labels: string[], patterns: RegExp[]) {
  return labels.some((label) => patterns.some((pattern) => pattern.test(label)));
}

function labelFlags(labels: string[]) {
  return {
    isSmartLikeHolder: hasLabel(labels, [/smart/i, /renowned/i, /kol/i]),
    isSniperLikeHolder: hasLabel(labels, [/sniper/i]),
    isBundlerLikeHolder: hasLabel(labels, [/bundl/i]),
    isSuspiciousLikeHolder: hasLabel(labels, [/suspicious/i, /phish/i, /rat/i, /scam/i, /entrap/i]),
    isFreshLikeHolder: hasLabel(labels, [/fresh/i, /\bnew\b/i]),
    isWhaleLikeHolder: hasLabel(labels, [/whale/i]),
  };
}

function walletResultFromInput(input: HolderAlphaV3Input): Top100HolderAlphaV3WalletResult | null {
  const wallet = holderWallet(input.holder);
  if (!wallet) return null;

  const ownership = normalizedOwnership(input.holder);
  const labels = holderLabels(input.holder);
  const flags = labelFlags(labels);
  const isDeep = isWalletAlphaV3Result(input.walletAlpha);
  const score = walletAlphaScore(input);
  const source = walletAlphaSource(input);
  let deepScores: WalletAlphaV3Result["scores"] | null = null;
  let rawMetrics: Record<string, unknown> = {};
  let isFallback = false;
  let sourceAvailable = true;
  let lightScoreBreakdown: WalletAlphaLight["scoreBreakdown"] | undefined;

  if (isWalletAlphaV3Result(input.walletAlpha)) {
    deepScores = input.walletAlpha.scores;
    rawMetrics = {
      activityCount: input.walletAlpha.rawMetrics.activityCount,
      completedTradeCount: input.walletAlpha.rawMetrics.completedTradeCount,
      coveredHistoricalTradeCount: input.walletAlpha.rawMetrics.coveredHistoricalTradeCount,
      historicalTokenCount: input.walletAlpha.rawMetrics.historicalTokenCount,
      uniqueTokensTraded: input.walletAlpha.rawMetrics.uniqueTokensTraded,
      adjustedWinRate: input.walletAlpha.rawMetrics.adjustedWinRate,
      medianRealizedMultiple: input.walletAlpha.rawMetrics.medianRealizedMultiple,
      profitFactor: input.walletAlpha.rawMetrics.profitFactor,
      historicalEntryDiscipline: input.walletAlpha.rawMetrics.historicalEntryDiscipline,
      historicalExitDiscipline: input.walletAlpha.rawMetrics.historicalExitDiscipline,
      historicalPeakCapture: input.walletAlpha.rawMetrics.historicalPeakCapture,
      historicalMissedUpside: input.walletAlpha.rawMetrics.historicalMissedUpside,
    };
  } else {
    rawMetrics = input.walletAlpha.rawMetrics;
    isFallback = input.walletAlpha.isFallback;
    sourceAvailable = input.walletAlpha.sourceAvailable;
    lightScoreBreakdown = input.walletAlpha.scoreBreakdown;
  }

  return {
    wallet,
    holderRank: input.holderRank,
    ...ownership,
    usdValue: input.holder.usdValue,
    analysisDepth: input.analysisDepth ?? (isDeep ? "deep" : "light"),
    walletAlphaScore: score,
    walletAlphaSource: source,
    isFallback,
    sourceAvailable,
    walletAlphaV3: score,
    confidenceLevel: input.walletAlpha.confidenceLevel,
    entryDisciplineV3: deepScores?.entryDisciplineV3 ?? null,
    exitDisciplineV3: deepScores?.exitDisciplineV3 ?? null,
    consistencyV3: deepScores?.consistencyV3 ?? null,
    winRateQualityV3: deepScores?.winRateQualityV3 ?? null,
    rotationQualityV3: deepScores?.rotationQualityV3 ?? null,
    riskHygieneV3: deepScores?.riskHygieneV3 ?? null,
    dataConfidenceV3: walletAlphaConfidenceScore(input.walletAlpha),
    holderLabels: labels,
    ...flags,
    rawMetrics,
    lightScoreBreakdown,
    explanations: input.walletAlpha.explanations,
    warnings: input.walletAlpha.warnings,
  };
}

function weightedWalletAlpha(inputs: HolderAlphaV3Input[]) {
  if (inputs.length === 0) return null;

  const weights = inputs.map(holderCombinedWeight);
  const totalWeight = sum(weights);

  if (totalWeight <= 0) return average(inputs.map(walletAlphaScore));

  return round(sum(inputs.map((input, index) => walletAlphaScore(input) * (weights[index] / totalWeight))));
}

function ownershipShares(holderResults: Top100HolderAlphaV3WalletResult[]) {
  const shares = emptyTierCounts();

  for (const holder of holderResults) shares[tier(holder.walletAlphaScore)] += holder.ownershipPercent;

  return shares;
}

function labelSummary(holderResults: Top100HolderAlphaV3WalletResult[]) {
  const summary = {
    smartLikeHolderCount: 0,
    sniperLikeHolderCount: 0,
    bundlerLikeHolderCount: 0,
    suspiciousLikeHolderCount: 0,
    freshLikeHolderCount: 0,
    whaleLikeHolderCount: 0,
    smartLikeOwnershipPercent: 0,
    sniperLikeOwnershipPercent: 0,
    bundlerLikeOwnershipPercent: 0,
    suspiciousLikeOwnershipPercent: 0,
    freshLikeOwnershipPercent: 0,
    whaleLikeOwnershipPercent: 0,
  };

  for (const holder of holderResults) {
    if (holder.isSmartLikeHolder) {
      summary.smartLikeHolderCount += 1;
      summary.smartLikeOwnershipPercent += holder.ownershipPercent;
    }
    if (holder.isSniperLikeHolder) {
      summary.sniperLikeHolderCount += 1;
      summary.sniperLikeOwnershipPercent += holder.ownershipPercent;
    }
    if (holder.isBundlerLikeHolder) {
      summary.bundlerLikeHolderCount += 1;
      summary.bundlerLikeOwnershipPercent += holder.ownershipPercent;
    }
    if (holder.isSuspiciousLikeHolder) {
      summary.suspiciousLikeHolderCount += 1;
      summary.suspiciousLikeOwnershipPercent += holder.ownershipPercent;
    }
    if (holder.isFreshLikeHolder) {
      summary.freshLikeHolderCount += 1;
      summary.freshLikeOwnershipPercent += holder.ownershipPercent;
    }
    if (holder.isWhaleLikeHolder) {
      summary.whaleLikeHolderCount += 1;
      summary.whaleLikeOwnershipPercent += holder.ownershipPercent;
    }
  }

  return {
    ...summary,
    smartLikeOwnershipPercent: round(summary.smartLikeOwnershipPercent),
    sniperLikeOwnershipPercent: round(summary.sniperLikeOwnershipPercent),
    bundlerLikeOwnershipPercent: round(summary.bundlerLikeOwnershipPercent),
    suspiciousLikeOwnershipPercent: round(summary.suspiciousLikeOwnershipPercent),
    freshLikeOwnershipPercent: round(summary.freshLikeOwnershipPercent),
    whaleLikeOwnershipPercent: round(summary.whaleLikeOwnershipPercent),
  };
}

function holderCompositionScore({
  eliteOwnershipPercent,
  strongOwnershipPercent,
  goodOwnershipPercent,
  averageOwnershipPercent,
  weakOwnershipPercent,
  toxicOwnershipPercent,
}: {
  eliteOwnershipPercent: number;
  strongOwnershipPercent: number;
  goodOwnershipPercent: number;
  averageOwnershipPercent: number;
  weakOwnershipPercent: number;
  toxicOwnershipPercent: number;
}) {
  return clampScore(
    50 +
      eliteOwnershipPercent * 3 +
      strongOwnershipPercent * 2.2 +
      goodOwnershipPercent * 1.4 +
      averageOwnershipPercent * 0.4 -
      weakOwnershipPercent * 0.55 -
      toxicOwnershipPercent * 2.2
  );
}

function holderConfidenceModifier(confidenceScore: number) {
  if (confidenceScore >= 80) return 1;
  if (confidenceScore >= 65) return 0.97;
  if (confidenceScore >= 50) return 0.94;
  if (confidenceScore >= 35) return 0.9;
  return 0.85;
}

function thesisConfidence(confidenceScore: number): ThesisConfidence {
  if (confidenceScore >= 75) return "high";
  if (confidenceScore >= 50) return "medium";
  return "low";
}

function compositionThesis({
  holderAlphaV3Score,
  goodOrBetterOwnershipPercent,
  weakOrToxicOwnershipPercent,
  toxicOwnershipPercent,
  confidenceScore,
  eliteWalletCount,
  strongWalletCount,
  fallbackLightWalletCount,
  analyzedWalletCount,
}: {
  holderAlphaV3Score: number;
  goodOrBetterOwnershipPercent: number;
  weakOrToxicOwnershipPercent: number;
  toxicOwnershipPercent: number;
  confidenceScore: number;
  eliteWalletCount: number;
  strongWalletCount: number;
  fallbackLightWalletCount: number;
  analyzedWalletCount: number;
}): HolderCompositionThesis {
  const confidence = thesisConfidence(confidenceScore);
  let quality: ThesisQuality = "mixed";

  if (holderAlphaV3Score >= 75) quality = "elite";
  else if (holderAlphaV3Score >= 65) quality = "strong";
  else if (holderAlphaV3Score >= 50) quality = "mixed";
  else if (holderAlphaV3Score >= 35) quality = "weak";
  else quality = "toxic";

  if (weakOrToxicOwnershipPercent >= 35 && goodOrBetterOwnershipPercent < 10 && quality !== "toxic") {
    quality = "weak";
  }

  if (toxicOwnershipPercent >= 10) quality = "toxic";

  const keyPoints: string[] = [];
  keyPoints.push(`${round(goodOrBetterOwnershipPercent)}% of analyzed ownership is held by good-or-better Wallet Alpha V3 holders.`);
  keyPoints.push(`${round(weakOrToxicOwnershipPercent)}% of analyzed ownership is held by weak/toxic Wallet Alpha V3 holders.`);

  if (eliteWalletCount + strongWalletCount > 0 && goodOrBetterOwnershipPercent < 8) {
    keyPoints.push("Strong wallets exist, but their analyzed ownership share is too small to dominate the holder base.");
  }

  if (confidence !== "high") keyPoints.push("Confidence is limited by wallet history depth, holder coverage, or failed wallet analyses.");
  if (analyzedWalletCount > 0 && fallbackLightWalletCount / analyzedWalletCount > 0.5) {
    keyPoints.push("Most light wallet scores are neutral fallbacks because GMGN portfolio stats are unavailable.");
  }

  const summary =
    quality === "elite"
      ? "Elite holder composition with meaningful good-or-better ownership."
      : quality === "strong"
        ? "Strong holder composition with healthy quality-weighted ownership."
        : quality === "weak"
          ? "Weak holder composition; weak/toxic holders outweigh strong ownership."
          : quality === "toxic"
            ? "Toxic holder composition; toxic ownership or very low holder alpha dominates."
            : "Mixed holder composition with no decisive quality side dominating.";

  return {
    summary,
    quality,
    confidence,
    keyPoints,
  };
}

function explanations({
  score,
  weighted,
  simple,
  composition,
  confidence,
  analysisMode,
  deepAnalyzedWalletCount,
  lightAnalyzedWalletCount,
  fallbackLightWalletCount,
  realLightWalletCount,
  fallbackScoreWeightShare,
  goodOrBetterOwnershipPercent,
  weakOrToxicOwnershipPercent,
}: {
  score: number;
  weighted: number | null;
  simple: number | null;
  composition: number;
  confidence: number;
  analysisMode: AnalysisMode;
  deepAnalyzedWalletCount: number;
  lightAnalyzedWalletCount: number;
  fallbackLightWalletCount: number;
  realLightWalletCount: number;
  fallbackScoreWeightShare: number;
  goodOrBetterOwnershipPercent: number;
  weakOrToxicOwnershipPercent: number;
}) {
  const rows: string[] = [];

  rows.push(
    `Holder Alpha V3.2 is ${score}/100 in ${analysisMode} mode from weighted holder wallet quality, simple average quality, holder composition, and confidence modulation.`
  );
  rows.push(`${deepAnalyzedWalletCount} holders used deep Wallet Alpha V3.3 and ${lightAnalyzedWalletCount} holders used light wallet P&L analysis.`);
  if (fallbackLightWalletCount > 0) {
    rows.push(`${fallbackLightWalletCount} light holders used neutral fallback scores because GMGN portfolio stats were unavailable.`);
  }
  if (realLightWalletCount > 0) {
    rows.push("Light holder scores used real GMGN portfolio stats.");
  }
  if (fallbackScoreWeightShare > 30) {
    rows.push("Large fallback light score weight makes fast/balanced holder quality approximate.");
  }

  if (weighted !== null && simple !== null) {
    if (weighted >= simple + 5) {
      rows.push("Capital-weighted holder quality is stronger than broad average quality.");
    } else if (weighted <= simple - 5) {
      rows.push("Capital-weighted holder quality is weaker than broad average quality.");
    } else {
      rows.push("Weighted and simple holder quality are similar, suggesting broad holder quality rather than one-sided ownership effects.");
    }
  }

  rows.push(`Holder composition score is ${composition}/100 from ${round(goodOrBetterOwnershipPercent)}% good-or-better ownership versus ${round(weakOrToxicOwnershipPercent)}% weak/toxic ownership.`);
  rows.push(`Confidence score is ${confidence}/100 and is used as a reliability modifier, not as positive holder quality.`);
  rows.push("Ownership concentration is intentionally not included in Holder Alpha V3.2; that belongs to Structural Safety and Risk Pressure.");

  return rows;
}

export function computeTop100HolderAlphaV3({
  holders,
  walletAlphaResults,
  requestedHolderLimit,
  analysisMode = "deep",
  deepHolderLimit = requestedHolderLimit,
  lightHolderLimit = 0,
  estimatedCostLevel = "high",
  fallbackLightWalletCount = 0,
  failedWalletCount = 0,
  warnings = [],
}: {
  holders: GMGNHolder[];
  walletAlphaResults: HolderAlphaV3Input[];
  requestedHolderLimit: number;
  analysisMode?: AnalysisMode;
  deepHolderLimit?: number;
  lightHolderLimit?: number;
  estimatedCostLevel?: "low" | "medium" | "high";
  fallbackLightWalletCount?: number;
  failedWalletCount?: number;
  warnings?: string[];
}): Top100HolderAlphaV3Result {
  const holderResults = walletAlphaResults
    .map(walletResultFromInput)
    .filter((result): result is Top100HolderAlphaV3WalletResult => result !== null);
  const holderCount = holders.length;
  const analyzedWalletCount = holderResults.length;
  const scores = holderResults.map((holder) => holder.walletAlphaScore);
  const simpleAverageWalletAlphaV3 = average(scores);
  const weightedWalletAlphaV3 = weightedWalletAlpha(walletAlphaResults);
  const walletDataConfidenceScore = average(holderResults.map((holder) => holder.dataConfidenceV3));
  const holderSetCoverageScore = clampScore((analyzedWalletCount / Math.max(requestedHolderLimit, 1)) * 100);
  const confidenceScore = clampScore(
    (walletDataConfidenceScore ?? 50) * 0.6 + holderSetCoverageScore * 0.4
  );
  const counts = emptyTierCounts();

  for (const holder of holderResults) counts[tier(holder.walletAlphaScore)] += 1;

  const ownership = ownershipShares(holderResults);
  const eliteOwnershipPercent = round(ownership.elite);
  const strongOwnershipPercent = round(ownership.strong);
  const goodOwnershipPercent = round(ownership.good);
  const averageOwnershipPercent = round(ownership.average);
  const weakOwnershipPercent = round(ownership.weak);
  const toxicOwnershipPercent = round(ownership.toxic);
  const goodOrBetterOwnershipPercent = round(eliteOwnershipPercent + strongOwnershipPercent + goodOwnershipPercent);
  const weakOrToxicOwnershipPercent = round(weakOwnershipPercent + toxicOwnershipPercent);
  const totalAnalyzedOwnershipPercent = round(sum(holderResults.map((holder) => holder.ownershipPercent)));
  const composition = holderCompositionScore({
    eliteOwnershipPercent,
    strongOwnershipPercent,
    goodOwnershipPercent,
    averageOwnershipPercent,
    weakOwnershipPercent,
    toxicOwnershipPercent,
  });
  const rawHolderQuality =
    (weightedWalletAlphaV3 ?? 50) * 0.6 +
    (simpleAverageWalletAlphaV3 ?? 50) * 0.25 +
    composition * 0.15;
  const fallbackMajority = analyzedWalletCount > 0 && fallbackLightWalletCount / analyzedWalletCount > 0.5;
  const confidenceModifier = Math.min(
    holderConfidenceModifier(confidenceScore),
    fallbackMajority && analysisMode !== "deep" ? 0.9 : 1
  );
  const holderAlphaV3Score = clampScore(
    rawHolderQuality * confidenceModifier
  );
  const allWalletsByHolderRank = dedupeHolderResults(
    [...holderResults].sort((a, b) => a.holderRank - b.holderRank)
  );
  const allWalletsByAlphaV3 = dedupeHolderResults(
    [...holderResults].sort((a, b) => b.walletAlphaV3 - a.walletAlphaV3)
  );
  const sorted = allWalletsByAlphaV3;
  const deepAnalyzedWalletCount = holderResults.filter((holder) => holder.analysisDepth === "deep").length;
  const lightAnalyzedWalletCount = holderResults.filter((holder) => holder.analysisDepth === "light").length;
  const realLightWalletCount = holderResults.filter((holder) => holder.analysisDepth === "light" && !holder.isFallback).length;
  const sourceWeights = holderResults.map(holderResultCombinedWeight);
  const totalSourceWeight = sum(sourceWeights);
  const weightShare = (predicate: (holder: Top100HolderAlphaV3WalletResult) => boolean) =>
    totalSourceWeight > 0
      ? round(
          (sum(holderResults.map((holder, index) => (predicate(holder) ? sourceWeights[index] : 0))) /
            totalSourceWeight) *
            100
        )
      : 0;
  const deepScoreWeightShare = weightShare((holder) => holder.analysisDepth === "deep");
  const realLightScoreWeightShare = weightShare((holder) => holder.analysisDepth === "light" && !holder.isFallback);
  const fallbackScoreWeightShare = weightShare((holder) => holder.isFallback);
  const labelCounts = labelSummary(holderResults);
  const thesis = compositionThesis({
    holderAlphaV3Score,
    goodOrBetterOwnershipPercent,
    weakOrToxicOwnershipPercent,
    toxicOwnershipPercent,
    confidenceScore,
    eliteWalletCount: counts.elite,
    strongWalletCount: counts.strong,
    fallbackLightWalletCount,
    analyzedWalletCount,
  });
  const finalWarnings = [...warnings];
  if (fallbackScoreWeightShare > 30) {
    finalWarnings.push("Large fallback light score weight; fast/balanced holder quality is approximate.");
  }

  return {
    version: "top100-holder-alpha-v3.2-wallet-alpha-v3.3",
    holderAlphaV3Score,
    rawHolderQuality: round(rawHolderQuality),
    confidenceModifier,
    weightedWalletAlphaV3,
    simpleAverageWalletAlphaV3,
    holderCompositionScore: composition,
    walletDataConfidenceScore,
    holderSetCoverageScore,
    confidenceScore,
    weightedHolderWalletScore: weightedWalletAlphaV3,
    simpleAverageHolderWalletScore: simpleAverageWalletAlphaV3,
    analysisMode,
    deepAnalyzedWalletCount,
    lightAnalyzedWalletCount,
    deepHolderLimit,
    lightHolderLimit,
    estimatedCostLevel,
    realLightWalletCount,
    fallbackLightWalletCount,
    deepScoreWeightShare,
    realLightScoreWeightShare,
    fallbackScoreWeightShare,
    holderCount,
    analyzedWalletCount,
    failedWalletCount,
    eliteWalletCount: counts.elite,
    strongWalletCount: counts.strong,
    goodWalletCount: counts.good,
    averageWalletCount: counts.average,
    weakWalletCount: counts.weak,
    toxicWalletCount: counts.toxic,
    eliteOwnershipPercent,
    strongOwnershipPercent,
    goodOwnershipPercent,
    averageOwnershipPercent,
    weakOwnershipPercent,
    toxicOwnershipPercent,
    goodOrBetterOwnershipPercent,
    weakOrToxicOwnershipPercent,
    totalAnalyzedOwnershipPercent,
    ...labelCounts,
    holderCompositionThesis: thesis,
    topWalletsByAlphaV3: sorted.slice(0, 10),
    bottomWalletsByAlphaV3: sorted.slice(-10).reverse(),
    allWalletsByHolderRank,
    allWalletsByAlphaV3,
    holderResults,
    explanations: explanations({
      score: holderAlphaV3Score,
      weighted: weightedWalletAlphaV3,
      simple: simpleAverageWalletAlphaV3,
      composition,
      confidence: confidenceScore,
      analysisMode,
      deepAnalyzedWalletCount,
      lightAnalyzedWalletCount,
      fallbackLightWalletCount,
      realLightWalletCount,
      fallbackScoreWeightShare,
      goodOrBetterOwnershipPercent,
      weakOrToxicOwnershipPercent,
    }),
    warnings: Array.from(new Set(finalWarnings)),
  };
}
