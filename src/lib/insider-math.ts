import type {
  HolderIntelligenceProfile,
  HolderIntelligenceSummary,
} from "./holder-intelligence";
import type { TokenWalletReputationSummary } from "./wallet-reputation";

export type InsiderRiskV2Tier = "Low" | "Moderate" | "Elevated" | "Critical" | "Unknown";

export type InsiderPatternSeverity = "Low" | "Moderate" | "Elevated" | "Critical";

export type InsiderEvidencePatternV2 = {
  label: string;
  severity: InsiderPatternSeverity;
  evidence: string;
  affectedWallets: string[];
  confidence: "High" | "Medium" | "Low";
};

export type InsiderEvidenceV2 = {
  positives: string[];
  negatives: string[];
  warnings: string[];
  missingEvidence: string[];
  detectedPatterns: InsiderEvidencePatternV2[];
};

export type InsiderRiskV2Result = InsiderEvidenceV2 & {
  insiderRiskScore: number;
  concentrationPressureScore: number;
  clusterExposureScore: number;
  bundleStructureScore: number;
  freshOwnershipScore: number;
  contractDominanceScore: number;
  relationshipIntensityScore: number;
  evidenceConfidenceScore: number;
  riskTier: InsiderRiskV2Tier;
  verdict: string;
  topRiskHolders: HolderIntelligenceProfile[];
  topSupportHolders: HolderIntelligenceProfile[];
};

export type InsiderRiskV2Input = {
  holderIntelligenceMatrix?: HolderIntelligenceProfile[];
  holderIntelligenceSummary?: HolderIntelligenceSummary | null;
  convictionRiskSubscores?: {
    insiderRisk?: number;
    clusterRisk?: number;
    freshWalletRisk?: number;
    bundleRisk?: number;
  };
  bundleDetection?: {
    bundleRiskScore?: number;
    fundingSimilarityScore?: number;
    fakeDecentralizationRisk?: number;
    sameWindowActivityScore?: number;
    sharedCounterpartyScore?: number;
    detectedGroups?: Array<{
      wallets?: string[];
      reason?: string;
      confidence?: "High" | "Medium" | "Low";
      riskScore?: number;
    }>;
  } | null;
  clusterData?: {
    clusters?: Array<{
      relationshipType?: string;
      walletCount?: number;
      confidence?: "High" | "Medium" | "Low";
      riskLevel?: "Low" | "Medium" | "Elevated";
      wallets?: Array<{ walletAddress?: string; ownershipPercentage?: number }>;
    }>;
    networkSummary?: {
      totalAnalyzedWallets?: number;
      clusteredWallets?: number;
      isolatedWallets?: number;
      averageClusterConfidence?: number;
    };
  } | null;
  holderSummary?: {
    top10Ownership?: string | number;
    top25Ownership?: string | number;
    whaleCount?: number;
    contractCount?: number;
  } | null;
  walletReputationSummary?: TokenWalletReputationSummary | null;
  deepBehavior?: {
    analyzedWallets?: number;
    summary?: {
      averageDistributionPressure?: number;
      averageAccumulationPressure?: number;
      averageRotationBehaviorRisk?: number;
    };
  } | null;
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function inverse(score: number) {
  return 100 - clampScore(score);
}

function percentValue(value?: string | number) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
  if (typeof value !== "string") return undefined;
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : undefined;
}

function average(values: number[]) {
  return values.length
    ? clampScore(values.reduce((total, value) => total + value, 0) / values.length)
    : 0;
}

function severityFromScore(score: number): InsiderPatternSeverity {
  if (score >= 85) return "Critical";
  if (score >= 70) return "Elevated";
  if (score >= 45) return "Moderate";
  return "Low";
}

function confidenceFromScore(score: number): "High" | "Medium" | "Low" {
  if (score >= 70) return "High";
  if (score >= 45) return "Medium";
  return "Low";
}

function tierFromScore(score: number, confidenceScore: number): InsiderRiskV2Tier {
  if (confidenceScore < 25) return "Unknown";
  if (score >= 85) return "Critical";
  if (score >= 70) return "Elevated";
  if (score >= 45) return "Moderate";
  return "Low";
}

function holderAddress(holder: HolderIntelligenceProfile) {
  return holder.shortAddress || holder.walletAddress;
}

function topHoldersBy(
  matrix: HolderIntelligenceProfile[],
  getScore: (holder: HolderIntelligenceProfile) => number
) {
  return [...matrix].sort((left, right) => getScore(right) - getScore(left)).slice(0, 5);
}

export function summarizeInsiderEvidenceV2(
  input: InsiderRiskV2Input
): InsiderEvidenceV2 {
  return calculateInsiderRiskV2(input);
}

export function calculateInsiderRiskV2(input: InsiderRiskV2Input): InsiderRiskV2Result {
  const matrix = input.holderIntelligenceMatrix || [];
  const top10Ownership = percentValue(input.holderSummary?.top10Ownership);
  const largestHolderOwnership = Math.max(
    0,
    ...matrix.map((holder) => holder.ownershipPercentage || 0)
  );
  const largeHolders = matrix.filter(
    (holder) => (holder.ownershipPercentage || 0) >= 5
  );
  const freshHighOwnership = matrix.filter(
    (holder) => holder.holderClass === "Fresh High-Ownership Wallet"
  );
  const contractDominant = matrix.filter(
    (holder) =>
      holder.holderClass === "Contract/System Holder" &&
      (holder.ownershipPercentage || 0) >= 2
  );
  const clusterExposed = matrix.filter(
    (holder) =>
      holder.clusterExposureScore >= 58 ||
      holder.holderClass === "Cluster-Exposed Holder"
  );
  const relationshipScores = matrix.map((holder) => holder.clusterExposureScore);
  const bundle = input.bundleDetection;
  const positives: string[] = [];
  const negatives: string[] = [];
  const warnings: string[] = [];
  const missingEvidence: string[] = [];
  const detectedPatterns: InsiderEvidencePatternV2[] = [];

  if (top10Ownership === undefined) missingEvidence.push("top 10 ownership");
  if (!matrix.length) missingEvidence.push("holder intelligence matrix");
  if (!input.clusterData?.clusters?.length) missingEvidence.push("cluster relationships");
  if (!bundle) missingEvidence.push("bundle detection");
  if (!input.deepBehavior?.summary) missingEvidence.push("deep behavior");

  const concentrationPressureScore = clampScore(
    (top10Ownership ?? average(matrix.map((holder) => holder.ownershipPercentage || 0)) * 4) *
      0.75 +
      largestHolderOwnership * 4.2 +
      largeHolders.length * 7 +
      average(matrix.map((holder) => holder.concentrationRiskScore)) * 0.22
  );
  const clusterExposureScore = clampScore(
    average(matrix.map((holder) => holder.clusterExposureScore)) * 0.58 +
      (clusterExposed.length / Math.max(matrix.length, 1)) * 100 * 0.24 +
      (input.clusterData?.networkSummary?.clusteredWallets || 0) * 3 +
      (input.convictionRiskSubscores?.clusterRisk || 0) * 0.18
  );
  const bundleStructureScore = clampScore(
    (bundle?.bundleRiskScore || input.convictionRiskSubscores?.bundleRisk || 0) * 0.42 +
      (bundle?.fundingSimilarityScore || 0) * 0.18 +
      (bundle?.fakeDecentralizationRisk || 0) * 0.18 +
      (bundle?.sameWindowActivityScore || 0) * 0.12 +
      (bundle?.sharedCounterpartyScore || 0) * 0.1
  );
  const freshOwnershipScore = clampScore(
    freshHighOwnership.length * 18 +
      freshHighOwnership.reduce(
        (total, holder) => total + (holder.ownershipPercentage || 0),
        0
      ) *
        5 +
      (input.convictionRiskSubscores?.freshWalletRisk || 0) * 0.3
  );
  const contractDominanceScore = clampScore(
    contractDominant.reduce(
      (total, holder) => total + (holder.ownershipPercentage || 0),
      0
    ) *
      8 +
      (input.holderSummary?.contractCount || 0) * 4
  );
  const relationshipIntensityScore = clampScore(
    average(relationshipScores) * 0.7 +
      (input.clusterData?.clusters || []).filter(
        (cluster) =>
          cluster.relationshipType !== "Isolated" || cluster.riskLevel === "Elevated"
      ).length *
        8
  );
  const evidenceConfidenceScore = clampScore(
    84 -
      missingEvidence.length * 11 +
      Math.min(matrix.length, 10) * 2 +
      (input.walletReputationSummary ? 6 : 0)
  );

  // V2 intentionally weights structural holder concentration highest, then
  // cluster and bundle-like evidence, while missing evidence affects confidence.
  const insiderRiskScore = clampScore(
    concentrationPressureScore * 0.24 +
      clusterExposureScore * 0.18 +
      bundleStructureScore * 0.18 +
      freshOwnershipScore * 0.14 +
      contractDominanceScore * 0.1 +
      relationshipIntensityScore * 0.1 +
      inverse(evidenceConfidenceScore) * 0.06
  );
  const riskTier = tierFromScore(insiderRiskScore, evidenceConfidenceScore);
  const topRiskHolders = topHoldersBy(matrix, (holder) => holder.riskContributionScore);
  const topSupportHolders = topHoldersBy(
    matrix,
    (holder) => holder.convictionContributionScore
  );

  if (concentrationPressureScore < 45) positives.push("Top-holder concentration pressure is contained.");
  if (clusterExposureScore < 45) positives.push("Cluster exposure is limited from available evidence.");
  if (bundleStructureScore < 45) positives.push("Bundle-like structure is not dominant from loaded signals.");
  if (evidenceConfidenceScore >= 65) positives.push("Evidence coverage is sufficient for a conservative structural read.");

  if (concentrationPressureScore >= 60) negatives.push("Top-holder concentration creates structural pressure.");
  if (clusterExposureScore >= 60) negatives.push("Cluster-exposed holders raise coordination-sensitive risk.");
  if (bundleStructureScore >= 60) negatives.push("Bundle-like timing, funding or decentralization signals are elevated.");
  if (freshOwnershipScore >= 55) negatives.push("Fresh high-ownership wallets contribute structural risk.");
  if (contractDominanceScore >= 55) negatives.push("Contract or system holders have material supply presence.");
  if (relationshipIntensityScore >= 55) negatives.push("Relationship intensity is elevated across analyzed holders.");

  if (evidenceConfidenceScore < 45) warnings.push("Evidence coverage is limited; risk tier should be treated cautiously.");
  if (missingEvidence.length) warnings.push("Missing evidence increases uncertainty, not automatic risk.");

  const addPattern = (
    condition: boolean,
    label: string,
    score: number,
    evidence: string,
    holders: HolderIntelligenceProfile[]
  ) => {
    if (!condition) return;
    detectedPatterns.push({
      label,
      severity: severityFromScore(score),
      evidence,
      affectedWallets: holders.map(holderAddress).slice(0, 6),
      confidence: confidenceFromScore(evidenceConfidenceScore),
    });
  };

  addPattern(
    concentrationPressureScore >= 55,
    "High top-holder concentration",
    concentrationPressureScore,
    `Top 10 ownership is ${top10Ownership ?? "unavailable"}; largest holder is ${largestHolderOwnership.toFixed(2)}%.`,
    largeHolders
  );
  addPattern(
    freshOwnershipScore >= 50,
    "Fresh high-ownership cluster",
    freshOwnershipScore,
    `${freshHighOwnership.length} fresh high-ownership holder(s) detected from Holder Intelligence.`,
    freshHighOwnership
  );
  addPattern(
    (bundle?.sameWindowActivityScore || 0) >= 55,
    "Bundle-like timing overlap",
    bundle?.sameWindowActivityScore || 0,
    "Same-window activity evidence is elevated in bundle detection.",
    topRiskHolders
  );
  addPattern(
    (bundle?.sharedCounterpartyScore || 0) >= 55 ||
      (bundle?.fundingSimilarityScore || 0) >= 55,
    "Shared funding/counterparty evidence",
    Math.max(bundle?.sharedCounterpartyScore || 0, bundle?.fundingSimilarityScore || 0),
    "Funding or shared counterparty similarity is elevated where available.",
    topRiskHolders
  );
  addPattern(
    contractDominanceScore >= 45,
    "Contract/system supply dominance",
    contractDominanceScore,
    `${contractDominant.length} material contract/system holder(s) detected.`,
    contractDominant
  );
  addPattern(
    clusterExposureScore >= 55,
    "Cluster-exposed holder base",
    clusterExposureScore,
    `${clusterExposed.length} holder(s) show elevated cluster exposure.`,
    clusterExposed
  );
  addPattern(
    relationshipIntensityScore < 25 && evidenceConfidenceScore >= 45,
    "Low relationship evidence",
    relationshipIntensityScore,
    "Loaded relationship evidence does not show broad repeated overlap.",
    []
  );
  addPattern(
    evidenceConfidenceScore < 45,
    "Data-limited insider assessment",
    inverse(evidenceConfidenceScore),
    `Missing evidence: ${missingEvidence.join(", ") || "none"}.`,
    []
  );

  const verdict =
    riskTier === "Critical"
      ? "Structural risk is critical from concentration, cluster, bundle-like or dominance signals."
      : riskTier === "Elevated"
        ? "Structural risk is elevated and coordination-sensitive evidence deserves attention."
        : riskTier === "Moderate"
          ? "Structural risk is mixed; some pressure exists but evidence is not extreme."
          : riskTier === "Unknown"
            ? "Structural risk is data-limited; NovaOS cannot make a confident V2 assessment."
            : "Structural risk is low from available V2 evidence.";

  return {
    insiderRiskScore,
    concentrationPressureScore,
    clusterExposureScore,
    bundleStructureScore,
    freshOwnershipScore,
    contractDominanceScore,
    relationshipIntensityScore,
    evidenceConfidenceScore,
    riskTier,
    verdict,
    positives: Array.from(new Set(positives)).slice(0, 5),
    negatives: Array.from(new Set(negatives)).slice(0, 6),
    warnings: Array.from(new Set(warnings)).slice(0, 5),
    missingEvidence: Array.from(new Set(missingEvidence)).slice(0, 8),
    topRiskHolders,
    topSupportHolders,
    detectedPatterns,
  };
}
