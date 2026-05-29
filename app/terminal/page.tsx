"use client";

import { animate, motion } from "framer-motion";
import { Globe, Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildArenaInterpretation,
  type ArenaResult,
} from "../../lib/arena-engine";
import {
  runAllScenarios,
  runScenario,
  type ConvictionScenarioName,
  type ScenarioRunResult,
} from "../../lib/conviction-engine-test-lab";
import {
  compareConvictionSnapshots,
  createConvictionSnapshot,
  getInMemoryConvictionHistoryStore,
  type ConvictionSnapshot,
} from "../../lib/conviction-history";
import NovaChart from "../components/NovaChart";

type TokenResult = {
  symbol: string;
  rawSymbol?: string;
  name: string;
  chain: string;
  dex: string;
  quote?: string;
  price: string;
  marketCap: string;
  liquidity: string;
  volume24h: string;
  change24h?: number;
  pairAddress?: string;
  tokenAddress?: string;
  shortTokenAddress?: string;
  imageUrl?: string;
  logo?: string;
  logoUrl?: string;
  image?: string;
  icon?: string;
  tokenLogo?: string;
  website?: string;
  websites?: { label?: string; url?: string }[];
  twitter?: string;
  x?: string;
  telegram?: string;
  tg?: string;
  socials?: { type?: string; url?: string }[];
  categories?: string[];
  tags?: string[];
  narrative?: string;
  baseToken?: {
    logoURI?: string;
  };
  info?: {
    imageUrl?: string;
    description?: string;
    websites?: { label?: string; url?: string }[];
    socials?: { type?: string; url?: string }[];
    categories?: string[];
    tags?: string[];
  };
  profile?: {
    description?: string;
    categories?: string[];
    tags?: string[];
  };
  metadata?: {
    imageUrl?: string;
    website?: string;
    twitter?: string;
    telegram?: string;
    categories?: string[];
    tags?: string[];
    labels?: string[];
    source?: string;
  };
  url?: string;
};

type WalletRow = {
  rank: number;
  wallet: string;
  fullAddress?: string;
  balance: string;
  ownershipPercentage: string;
  label?: string;
  estimatedBehavior?: string;
  estimatedCluster?: string;
  type: string;
  flow: string;
  score: number;
  holdTime: string;
  pnl: string;
  winRate?: string;
  cluster: string;
  risk: string;
  status?: string;
  behaviorMetricsEstimated?: boolean;
  estimateNote?: string;
  color: "cyan" | "green" | "red" | "purple" | "amber" | "white";
};

type HolderLoadState = "idle" | "loading" | "loaded" | "error";

type TerminalSection =
  | "Overview"
  | "Conviction Engine"
  | "Conviction History"
  | "Bubble Intelligence"
  | "Wallet Flows"
  | "Insider Scan"
  | "Social Feed"
  | "Signals"
  | "Watchlist";

type WalletBehaviorProfile = {
  walletAddress: string;
  shortAddress: string;
  nativeBalance?: {
    raw: string;
    formatted: string;
  } | null;
  transactionCount?: number | null;
  firstSeen: string | null;
  lastActive: string | null;
  dataQuality: "partial" | "good" | "unavailable";
  walletAgeDays?: number | null;
  daysSinceLastActive?: number | null;
  activityVelocityScore?: number;
  dormancyRiskScore?: number;
  concentrationRiskScore?: number;
  behaviorReliabilityScore?: number;
  activityScore: number;
  maturityScore: number;
  concentrationScore: number;
  dataConfidence: number;
  behaviorClass:
    | "contract/system"
    | "dormant whale"
    | "active whale"
    | "active accumulator"
    | "passive holder"
    | "new/fresh wallet"
    | "insufficient data";
  behaviorExplanation?: string;
};

type WalletBehaviorPreviewData = {
  profiles: WalletBehaviorProfile[];
  summary: {
    profiledWallets: number;
    goodProfiles: number;
    partialProfiles: number;
    unavailableProfiles: number;
    averageActivityScore: number;
    averageMaturityScore: number;
    highestConcentrationScore: number;
    averageDataConfidence: number;
    averageWalletAgeDays?: number | null;
    averageActivityVelocity?: number;
    averageDormancyRisk?: number;
    highestConcentrationRisk?: number;
    reliabilityAverage?: number;
    dominantBehaviorClass: string;
  };
};

type WalletTransferDirection =
  | "buy"
  | "sell"
  | "transfer_in"
  | "transfer_out";

type WalletTransaction = {
  timestamp: string | null;
  tokenSymbol: string | null;
  tokenAddress: string | null;
  direction: WalletTransferDirection;
  valueUsd: number | null;
  amount: string | null;
  counterparty: string | null;
  txHash: string | null;
};

type WalletTransactionIntelligence = {
  transactions: WalletTransaction[];
  behaviorSummary: {
    dominantBehavior: string;
    signals: string[];
    accumulationScore: number;
    distributionScore: number;
    inactivityScore: number;
    frequencyScore: number;
    freshWalletScore: number;
    summaryStatus: "inferred";
    explanation: string;
  };
  activityMetrics: {
    recentBuyPressure: number;
    recentSellPressure: number;
    transactionFrequency: number;
    averageTransactionSize: number | null;
    buySellRatio: number | null;
    activeDaysEstimate: number;
    metricsStatus: "estimated";
  };
  confidence: {
    label: "High confidence" | "Medium confidence" | "Low confidence";
    score: number;
    rationale: string[];
  };
  warnings: string[];
};

type WalletMemoryData = {
  walletAddress: string;
  chain: string;
  walletFingerprint: string;
  consistencyScore: number;
  convictionBehaviorScore: number;
  rotationScore: number;
  narrativeExposure: {
    score: number;
    tokenDiversity: number;
    label: "Focused" | "Mixed" | "Broad";
  };
  repeatedTokenCount: number;
  repeatedWalletSeen: boolean;
  recurringClusterAppearance: {
    detected: boolean;
    score: number;
    explanation: string;
  };
  repeatedBehaviorFlags: string[];
  memorySummary: string;
  confidenceLabel: "High" | "Medium" | "Low";
  warnings: string[];
};

type WalletPersonalityData = {
  walletAddress: string;
  shortAddress: string;
  personalityType:
    | "Conviction Accumulator"
    | "Rotation Hunter"
    | "Passive Holder"
    | "High Activity Trader"
    | "Fresh Wallet"
    | "Contract/System Wallet"
    | "Insufficient Data";
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
  confidenceLabel: "High" | "Medium" | "Low";
  methodologyNote: string;
  warnings: string[];
};

type WalletPersonalityPreview = Pick<
  WalletPersonalityData,
  | "walletAddress"
  | "shortAddress"
  | "personalityType"
  | "personalitySubtitle"
  | "confidenceLabel"
  | "personalityScores"
  | "traits"
  | "riskNotes"
>;

type TokenIntelligenceData = {
  analyzedWallets: number;
  holderSummary: {
    holderCount: number;
    top10Ownership: string;
    top25Ownership: string;
    whaleCount: number;
    contractCount: number;
    exchangeCount: number;
  };
  behaviorSummary: {
    dominantBehaviorClass: string;
    averageActivityVelocity: number;
    averageDormancyRisk: number;
    highestConcentrationRisk: number;
    reliabilityAverage: number;
  };
  scores: {
    convictionScore: number;
    insiderRiskScore: number;
    holderQualityScore: number;
    activityScore: number;
    reliabilityScore: number;
  };
  thesis: {
    headline: string;
    bullets: string[];
    riskNotes: string[];
    confidenceLabel: "High" | "Medium" | "Low";
  };
  warnings: string[];
};

type WalletClusterData = {
  clusters: Array<{
    clusterId: string;
    confidence: "High" | "Medium" | "Low";
    relationshipType:
      | "Behavioral Similarity"
      | "Activity Overlap"
      | "Possible Coordination"
      | "Passive Similarity"
      | "Isolated";
    walletCount: number;
    wallets: Array<{
      walletAddress: string;
      shortAddress: string;
      ownershipPercentage: number;
      activityVelocityScore: number;
      dormancyRiskScore: number;
      concentrationRiskScore: number;
    }>;
    sharedSignals: string[];
    riskLevel: "Low" | "Medium" | "Elevated";
    explanation: string;
  }>;
  networkSummary: {
    totalAnalyzedWallets: number;
    clusteredWallets: number;
    isolatedWallets: number;
    averageClusterConfidence: number;
    dominantRelationshipType: string;
  };
  warnings: string[];
};

type MantleContext = {
  isMantleAsset: boolean;
  mantleModeActive: boolean;
  plannedIntegrations: string[];
  currentCapabilities: string[];
};

type DecisionSnapshot = {
  snapshotId: string;
  snapshotHash: string;
  status: "local_preview";
  verificationStatus: "not_onchain_yet";
  chain: string;
  tokenAddress: string;
  tokenSymbol: string | null;
  scores: {
    convictionScore: number;
    insiderRiskScore: number;
    holderQualityScore: number;
    activityScore: number;
  };
  thesisHeadline: string | null;
  createdAt: string;
  mantleVerification: {
    targetNetwork: "Mantle";
    planned: true;
    contractStatus: "not_deployed_yet";
    note: string;
  };
};

type ExplainableConvictionData = {
  finalConvictionScore: number;
  subScores: {
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
  aggregation: {
    weightedWalletQuality: number;
    averageBotRisk: number;
    averageRotationRisk: number;
    averageConcentrationRisk: number;
    averageDormancyRisk: number;
    dataCoverage: number;
  };
  explanation: {
    headline: string;
    positives: string[];
    negatives: string[];
    riskNotes: string[];
    methodology: string;
  };
  dataConfidence: {
    score: number;
    label: "Low" | "Medium" | "High";
    warnings: string[];
  };
  walletBreakdowns: Array<{
    address: string;
    rank: number;
    scores: Record<string, number>;
    labels: {
      behaviorClass: string;
      riskClass: string;
    };
  }>;
  mapperCoverage: {
    holderCount: number;
    walletProfileCount: number;
    hasMarketData: boolean;
    hasClusterData: boolean;
    hasTokenTransferData: boolean;
  };
  mapperWarnings: string[];
  warnings: string[];
  deepBehavior?: {
    enabled: boolean;
    analyzedWallets: number;
    summary: {
      analyzedWallets: number;
      averageTokenSpecificConviction: number;
      averageWalletBehaviorQuality: number;
      averageBotLikeActivityRisk: number;
      averageRotationBehaviorRisk: number;
      averageShortHoldRisk: number;
      averageAccumulationPressure: number;
      averageDistributionPressure: number;
      highRiskWalletCount: number;
      lowDataWalletCount: number;
    };
    walletResults: Array<{
      walletAddress: string;
      tokenSpecificConvictionScore: number;
      walletBehaviorQualityScore: number;
      botLikeActivityRisk: number;
      rotationBehaviorRisk: number;
      shortHoldRisk: number;
      accumulationPressure: number;
      distributionPressure: number;
      behaviorTags: string[];
      dataQuality: {
        score: number;
        label: "Low" | "Medium" | "High";
        warnings: string[];
      };
    }>;
    warnings: string[];
  };
  deepBehaviorImpact?: {
    baselineConvictionScore: number;
    enrichedConvictionScore: number;
    delta: number;
    direction: "improved" | "weakened" | "neutral";
    strongestPositiveDrivers: string[];
    strongestNegativeDrivers: string[];
    changedSubscores: {
      holderIntegrityDelta: number;
      walletQualityDelta: number;
      behaviorStabilityDelta: number;
      riskProtectionDelta: number;
      botActivityRiskDelta: number;
      rotationRiskDelta: number;
    };
    walletDrivers: Array<{
      walletAddress: string;
      shortAddress: string;
      rank?: number;
      impact: "positive" | "negative" | "neutral";
      reason: string;
      tokenSpecificConvictionScore?: number;
      botLikeActivityRisk?: number;
      rotationBehaviorRisk?: number;
      accumulationPressure?: number;
      distributionPressure?: number;
    }>;
  };
  bundleDetection?: {
    bundleRiskScore: number;
    fundingSimilarityScore: number;
    sameWindowActivityScore: number;
    freshWalletClusterScore: number;
    sharedCounterpartyScore: number;
    fakeDecentralizationRisk: number;
    riskLevel: "Low" | "Medium" | "Elevated" | "High";
    detectedGroups: Array<{
      groupId: string;
      wallets: string[];
      reason: string;
      confidence: "Low" | "Medium" | "High";
      riskScore: number;
    }>;
    positives: string[];
    negatives: string[];
    warnings: string[];
  };
  status: "live" | "live_with_deep_behavior" | "partial";
  chain?: string;
  tokenAddress?: string;
  tokenSymbol?: string | null;
  cache?: {
    generatedAt?: string;
  };
};

type CacheStatusData = {
  stats: {
    totalGets: number;
    totalHits: number;
    totalMisses: number;
    totalSets: number;
    totalDeletes: number;
    inFlightDedupes: number;
    entriesCount: number;
    expiredClears: number;
  };
  generatedAt: string;
};

type UnifiedModuleStatus = "loaded" | "failed" | "skipped";

type UnifiedTokenAnalysisData = {
  generatedAt?: string;
  holders?: {
    holders?: WalletRow[];
    summary?: {
      insiderRisk?: number;
      diamondHands?: number;
      rotation?: number;
    };
  } | null;
  walletProfiles?: WalletBehaviorPreviewData | null;
  clusters?: WalletClusterData | null;
  tokenIntelligence?: TokenIntelligenceData | null;
  conviction?: ExplainableConvictionData | null;
  walletPersonalities?: {
    personalities?: WalletPersonalityPreview[];
  } | null;
  modules?: {
    holders?: { status: UnifiedModuleStatus; cache?: { hit?: boolean } };
    walletProfiles?: { status: UnifiedModuleStatus; cache?: { hit?: boolean } };
    clusters?: { status: UnifiedModuleStatus; cache?: { hit?: boolean } };
    tokenIntelligence?: { status: UnifiedModuleStatus; cache?: { hit?: boolean } };
    conviction?: { status: UnifiedModuleStatus; cache?: { hit?: boolean } };
    walletPersonalities?: { status: UnifiedModuleStatus; cache?: { hit?: boolean } };
  };
  cache?: {
    hit?: boolean;
  };
  warnings?: string[];
};

type ExplainableIntelligenceReport = {
  confidenceLabel: string;
  thesisHeadline: string;
  observations: string[];
  riskNotes: string[];
  metrics: {
    reliability?: number;
    activity?: number;
    wallets?: number;
  };
  methodology: string;
};

const thesisText =
  "Holder Intelligence V1 uses live holder rankings, balances and ownership percentages. Behavioral metrics will be unlocked in Wallet Behavior Engine V2.";
const DEV_CACHE_PANEL = true;

const terminalSections: TerminalSection[] = [
  "Overview",
  "Conviction Engine",
  "Conviction History",
  "Bubble Intelligence",
  "Wallet Flows",
  "Insider Scan",
  "Social Feed",
  "Signals",
  "Watchlist",
];

const overviewHolderGridClass =
  "grid-cols-[0.45fr_1.65fr_0.9fr_0.9fr_1.1fr_1.2fr_0.75fr_0.75fr_0.9fr_0.9fr]";

function chainLabel(chain: string) {
  const key = chain.toLowerCase();
  if (key === "ethereum") return "ETH";
  if (key === "base") return "BASE";
  if (key === "mantle") return "MANTLE";
  if (key === "solana") return "SOL";
  if (key === "bsc") return "BSC";
  return chain.toUpperCase();
}

function chainName(chain: string) {
  const key = chain.toLowerCase();
  if (key === "ethereum") return "Ethereum";
  if (key === "base") return "Base";
  if (key === "mantle") return "Mantle";
  if (key === "solana") return "Solana";
  if (key === "bsc") return "BNB Chain";
  return chain;
}

function isMantleChain(chain: string) {
  const key = chain.toLowerCase();
  return key === "mantle" || key === "0x1388";
}

function changeClass(value?: number) {
  if (!value) return "text-white/35";
  return value >= 0 ? "text-emerald-100/70" : "text-red-100/70";
}

function resolveTokenLogo(tokenData: TokenResult) {
  return (
    tokenData.metadata?.imageUrl ||
    tokenData.imageUrl ||
    tokenData.logo ||
    tokenData.logoUrl ||
    tokenData.image ||
    tokenData.icon ||
    tokenData.tokenLogo ||
    tokenData.baseToken?.logoURI ||
    tokenData.info?.imageUrl ||
    ""
  );
}

function tokenInitial(token: string) {
  return token.replace(/^\$/, "").trim().charAt(0).toUpperCase() || "N";
}

function normalizeExternalUrl(url?: string) {
  const trimmed = (url || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function findTokenWebsite(
  websites?: { label?: string; url?: string }[]
) {
  return websites?.find((website) => website.url)?.url || "";
}

function findTokenSocial(
  socials: { type?: string; url?: string }[] | undefined,
  types: string[]
) {
  return (
    socials?.find((social) =>
      types.includes((social.type || "").toLowerCase())
    )?.url || ""
  );
}

function getTokenLinks(tokenData: TokenResult) {
  const website = normalizeExternalUrl(
    tokenData.website ||
      tokenData.metadata?.website ||
      findTokenWebsite(tokenData.websites) ||
      findTokenWebsite(tokenData.info?.websites)
  );
  const twitter = normalizeExternalUrl(
    tokenData.twitter ||
      tokenData.x ||
      tokenData.metadata?.twitter ||
      findTokenSocial(tokenData.socials, ["twitter", "x"]) ||
      findTokenSocial(tokenData.info?.socials, ["twitter", "x"])
  );
  const telegram = normalizeExternalUrl(
    tokenData.telegram ||
      tokenData.tg ||
      tokenData.metadata?.telegram ||
      findTokenSocial(tokenData.socials, ["telegram", "tg"]) ||
      findTokenSocial(tokenData.info?.socials, ["telegram", "tg"])
  );

  return {
    website: website || undefined,
    twitter: twitter || undefined,
    telegram: telegram || undefined,
  };
}

function apiErrorMessage(error: unknown, fallback: string) {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  if (
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return fallback;
}

function scoreBand(score: number) {
  if (score >= 70) return "high";
  if (score >= 45) return "mixed";
  return "low";
}

function strongestCoreScores(subScores: ExplainableConvictionData["subScores"]) {
  const coreScores = [
    ["Holder Integrity", subScores.holderIntegrity],
    ["Wallet Quality", subScores.walletQuality],
    ["Behavior Stability", subScores.behaviorStability],
    ["Liquidity Trust", subScores.liquidityTrust],
    ["Market Momentum", subScores.marketMomentum],
    ["Risk Protection", subScores.riskProtection],
  ] as const;
  const sorted = [...coreScores].sort((a, b) => b[1] - a[1]);

  return {
    strongest: sorted[0],
    weakest: sorted[sorted.length - 1],
  };
}

function buildExplainableIntelligenceReport({
  clusterData,
  conviction,
  tokenIntelligence,
}: {
  clusterData: WalletClusterData | null;
  conviction: ExplainableConvictionData | null;
  tokenIntelligence: TokenIntelligenceData | null;
}): ExplainableIntelligenceReport {
  if (!conviction) {
    return {
      confidenceLabel: tokenIntelligence?.thesis.confidenceLabel || "Pending",
      thesisHeadline:
        tokenIntelligence?.thesis.headline ||
        "Select a token to generate a Conviction Engine intelligence report.",
      observations:
        tokenIntelligence?.thesis.bullets || [
          "Conviction Engine V1 will summarize holder structure, wallet behavior, liquidity and risk protection when data is available.",
        ],
      riskNotes:
        tokenIntelligence?.thesis.riskNotes || [
          "No token-specific conviction data is loaded yet.",
        ],
      metrics: {
        reliability: tokenIntelligence?.scores.reliabilityScore,
        activity: tokenIntelligence?.scores.activityScore,
        wallets: tokenIntelligence?.analyzedWallets,
      },
      methodology:
        "Generated from available fallback token intelligence until Conviction Engine V1 data is available. Not PnL, win-rate, identity, or price prediction.",
    };
  }

  const { strongest, weakest } = strongestCoreScores(conviction.subScores);
  const band = scoreBand(conviction.finalConvictionScore);
  const headline =
    band === "high"
      ? `High conviction: ${strongest[0].toLowerCase()} and ${conviction.subScores.riskProtection >= 65 ? "risk protection" : "core structure"} are aligned.`
      : band === "mixed"
      ? `Mixed conviction: ${strongest[0].toLowerCase()} is supportive, but ${weakest[0].toLowerCase()} limits confidence.`
      : `Low conviction: ${weakest[0].toLowerCase()} and structural risk dominate.`;
  const observations = [
    `${strongest[0]} is ${strongest[1]}/100, the strongest current Conviction Engine input.`,
    `${weakest[0]} is ${weakest[1]}/100, the main limiting factor in the current structure.`,
  ];

  if (conviction.deepBehavior) {
    observations.push(
      `Deep behavior analyzed ${conviction.deepBehavior.analyzedWallets} top wallets with ${conviction.deepBehavior.summary.averageAccumulationPressure}/100 average accumulation pressure.`
    );
  }
  if (typeof conviction.bundleDetection?.bundleRiskScore === "number") {
    observations.push(
      `Bundle risk is ${conviction.bundleDetection.riskLevel} at ${conviction.bundleDetection.bundleRiskScore}/100.`
    );
  }
  if (clusterData) {
    observations.push(
      `Cluster Intelligence analyzed ${clusterData.networkSummary.totalAnalyzedWallets} wallets; dominant relationship is ${clusterData.networkSummary.dominantRelationshipType}.`
    );
  }

  const riskNotes: string[] = [];
  if (conviction.subScores.insiderRisk >= 65) {
    riskNotes.push(
      `Insider Risk is ${conviction.subScores.insiderRisk}/100, making concentration or coordination risk material.`
    );
  }
  if (conviction.subScores.clusterRisk >= 65) {
    riskNotes.push(
      `Cluster Risk is ${conviction.subScores.clusterRisk}/100, so relationship overlap needs review.`
    );
  }
  if (conviction.subScores.botActivityRisk >= 65) {
    riskNotes.push(
      `Bot Activity Risk is ${conviction.subScores.botActivityRisk}/100 across analyzed wallets.`
    );
  }
  if (conviction.subScores.rotationRisk >= 65) {
    riskNotes.push(
      `Rotation Risk is ${conviction.subScores.rotationRisk}/100, indicating weaker holder stability.`
    );
  }
  if (conviction.subScores.riskProtection < 45) {
    riskNotes.push(
      `Risk Protection is ${conviction.subScores.riskProtection}/100, limiting final conviction.`
    );
  }
  if (conviction.dataConfidence.label !== "High") {
    riskNotes.push(
      `${conviction.dataConfidence.label} confidence means some provider or deep-behavior inputs are partial.`
    );
  }

  return {
    confidenceLabel: conviction.dataConfidence.label,
    thesisHeadline: headline,
    observations: observations.slice(0, 5),
    riskNotes: (riskNotes.length ? riskNotes : conviction.explanation.riskNotes).slice(0, 4),
    metrics: {
      reliability: conviction.dataConfidence.score,
      activity: conviction.subScores.marketMomentum,
      wallets:
        conviction.deepBehavior?.analyzedWallets ||
        tokenIntelligence?.analyzedWallets,
    },
    methodology:
      "Generated from Conviction Engine V1: holder structure, wallet behavior, liquidity, market momentum, cluster risk, bundle-risk inference, and deep transfer behavior where available. Not PnL, win-rate, identity, or price prediction.",
  };
}

export function TerminalExperience({
  initialSection = "Overview",
}: {
  initialSection?: TerminalSection;
}) {
  const [placeholder, setPlaceholder] = useState("");
  const [activeSection, setActiveSection] =
    useState<TerminalSection>(initialSection);
  const [token, setToken] = useState("$NOVA");
  const [query, setQuery] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [typedThesis, setTypedThesis] = useState("");
  const [results, setResults] = useState<TokenResult[]>([]);
  const [mantleModeEnabled, setMantleModeEnabled] = useState(false);

  const [walletRows, setWalletRows] = useState<WalletRow[]>([]);
  const [holderLoadState, setHolderLoadState] = useState<HolderLoadState>("idle");
  const [holderError, setHolderError] = useState("");
  const [behaviorPreview, setBehaviorPreview] =
    useState<WalletBehaviorPreviewData | null>(null);
  const [behaviorPreviewState, setBehaviorPreviewState] =
    useState<HolderLoadState>("idle");
  const [behaviorPreviewError, setBehaviorPreviewError] = useState("");
  const [selectedWallet, setSelectedWallet] = useState<{
    row: WalletRow;
    profile?: WalletBehaviorProfile;
  } | null>(null);
  const [transactionIntelligence, setTransactionIntelligence] =
    useState<WalletTransactionIntelligence | null>(null);
  const [transactionLoadState, setTransactionLoadState] =
    useState<HolderLoadState>("idle");
  const [transactionError, setTransactionError] = useState("");
  const [walletMemory, setWalletMemory] = useState<WalletMemoryData | null>(null);
  const [walletMemoryLoadState, setWalletMemoryLoadState] =
    useState<HolderLoadState>("idle");
  const [walletMemoryError, setWalletMemoryError] = useState("");
  const [walletPersonality, setWalletPersonality] =
    useState<WalletPersonalityData | null>(null);
  const [walletPersonalityLoadState, setWalletPersonalityLoadState] =
    useState<HolderLoadState>("idle");
  const [walletPersonalityError, setWalletPersonalityError] = useState("");
  const [walletPersonalityPreviews, setWalletPersonalityPreviews] = useState<
    WalletPersonalityPreview[]
  >([]);
  const [walletPersonalityPreviewState, setWalletPersonalityPreviewState] =
    useState<HolderLoadState>("idle");
  const [walletPersonalityPreviewError, setWalletPersonalityPreviewError] =
    useState("");

const [holderSummary, setHolderSummary] = useState({
  insiderRisk: 0,
  holderQuality: 0,
  conviction: 0,
  activity: 0,
});
  const [tokenIntelligence, setTokenIntelligence] =
    useState<TokenIntelligenceData | null>(null);
  const [tokenIntelligenceState, setTokenIntelligenceState] =
    useState<HolderLoadState>("idle");
  const [tokenIntelligenceError, setTokenIntelligenceError] = useState("");
  const [clusterData, setClusterData] = useState<WalletClusterData | null>(null);
  const [clusterLoadState, setClusterLoadState] =
    useState<HolderLoadState>("idle");
  const [clusterError, setClusterError] = useState("");
  const [decisionSnapshot, setDecisionSnapshot] =
    useState<DecisionSnapshot | null>(null);
  const [decisionSnapshotState, setDecisionSnapshotState] =
    useState<HolderLoadState>("idle");
  const [decisionSnapshotError, setDecisionSnapshotError] = useState("");
  const [explainableConviction, setExplainableConviction] =
    useState<ExplainableConvictionData | null>(null);
  const [explainableConvictionState, setExplainableConvictionState] =
    useState<HolderLoadState>("idle");
  const [explainableConvictionError, setExplainableConvictionError] =
    useState("");
  const convictionHistoryStore = useRef(
    getInMemoryConvictionHistoryStore()
  );
  const [convictionSnapshots, setConvictionSnapshots] = useState<
    ConvictionSnapshot[]
  >([]);
  const [unifiedAnalysis, setUnifiedAnalysis] =
    useState<UnifiedTokenAnalysisData | null>(null);
  const [unifiedAnalysisState, setUnifiedAnalysisState] =
    useState<HolderLoadState>("idle");
  const [unifiedAnalysisError, setUnifiedAnalysisError] = useState("");
  const [selectedSyntheticScenario, setSelectedSyntheticScenario] =
    useState<ConvictionScenarioName>("Healthy Growth");
  const [cacheStatus, setCacheStatus] = useState<CacheStatusData | null>(null);
  const [cacheStatusState, setCacheStatusState] =
    useState<HolderLoadState>("idle");
  const [cacheStatusError, setCacheStatusError] = useState("");

  const [tokenData, setTokenData] = useState<TokenResult>({
    symbol: "$NOVA",
    rawSymbol: "NOVA",
    name: "Nova",
    chain: "base",
    dex: "uniswap",
    quote: "USD",
    price: "$0.084",
    marketCap: "$8.4M",
    liquidity: "$612K",
    volume24h: "$1.8M",
    change24h: 12.4,
    pairAddress: "",
    tokenAddress: "",
    shortTokenAddress: "",
    imageUrl: "",
    url: "",
  });

  const syntheticScenarioResults = useMemo(() => runAllScenarios(), []);
  const selectedSyntheticScenarioResult = useMemo(
    () => runScenario(selectedSyntheticScenario),
    [selectedSyntheticScenario]
  );

  const [scores, setScores] = useState({
    holderQuality: 0,
    insider: 0,
    conviction: 0,
    activity: 0,
  });

  const marketCards = useMemo(
    () => [
      { label: "Price", value: tokenData.price },
      { label: "Market Cap", value: tokenData.marketCap },
      { label: "Liquidity", value: tokenData.liquidity },
      { label: "Volume 24h", value: tokenData.volume24h },
    ],
    [tokenData]
  );
  const mantleContext: MantleContext = useMemo(() => {
    const isMantleAsset = isMantleChain(tokenData.chain);

    return {
      isMantleAsset,
      mantleModeActive: isMantleAsset || mantleModeEnabled,
      currentCapabilities: [
        "Holder intelligence",
        "Wallet behavior",
        "Cluster inference",
        "Token intelligence summary",
      ],
      plannedIntegrations: [
        "mETH ecosystem context",
        "USDY liquidity context",
        "Merchant Moe venue intelligence",
        "Agni liquidity and routing intelligence",
      ],
    };
  }, [mantleModeEnabled, tokenData.chain]);

  const arenaResult = useMemo(
    () =>
      buildArenaInterpretation({
        convictionScore: tokenIntelligence?.scores.convictionScore,
        insiderRiskScore: tokenIntelligence?.scores.insiderRiskScore,
        holderQualityScore: tokenIntelligence?.scores.holderQualityScore,
        activityScore: tokenIntelligence?.scores.activityScore,
        reliabilityScore: tokenIntelligence?.scores.reliabilityScore,
        dominantBehaviorClass:
          tokenIntelligence?.behaviorSummary.dominantBehaviorClass ||
          behaviorPreview?.summary.dominantBehaviorClass,
        profiledWallets:
          behaviorPreview?.summary.profiledWallets ||
          tokenIntelligence?.analyzedWallets,
        clusterSignals: clusterData
          ? {
              totalAnalyzedWallets:
                clusterData.networkSummary.totalAnalyzedWallets,
              clusteredWallets: clusterData.networkSummary.clusteredWallets,
              isolatedWallets: clusterData.networkSummary.isolatedWallets,
              averageClusterConfidence:
                clusterData.networkSummary.averageClusterConfidence,
              dominantRelationshipType:
                clusterData.networkSummary.dominantRelationshipType,
              elevatedRiskClusters: clusterData.clusters.filter(
                (cluster) => cluster.riskLevel === "Elevated"
              ).length,
              possibleCoordinationClusters: clusterData.clusters.filter(
                (cluster) =>
                  cluster.relationshipType === "Possible Coordination"
              ).length,
            }
          : undefined,
      }),
    [behaviorPreview, clusterData, tokenIntelligence]
  );

  const overviewConvictionScore =
    explainableConviction?.finalConvictionScore ?? scores.conviction;
  const overviewConvictionState: HolderLoadState = explainableConviction
    ? "loaded"
    : explainableConvictionState === "loading"
    ? "loading"
    : explainableConvictionState === "error" && tokenIntelligenceState === "loaded"
    ? "loaded"
    : tokenIntelligenceState;
  const overviewConfidenceLabel =
    explainableConviction?.dataConfidence.label ||
    tokenIntelligence?.thesis.confidenceLabel;
  const overviewCoreSubScores = explainableConviction?.subScores || null;
  const explainableReport = useMemo(
    () =>
      buildExplainableIntelligenceReport({
        clusterData,
        conviction: explainableConviction,
        tokenIntelligence,
      }),
    [clusterData, explainableConviction, tokenIntelligence]
  );

  const arenaLoadState: HolderLoadState = !tokenData.tokenAddress
    ? "idle"
    : tokenIntelligenceState === "loading" ||
      behaviorPreviewState === "loading" ||
      clusterLoadState === "loading"
    ? "loading"
    : tokenIntelligenceState === "error"
    ? "error"
    : "loaded";

  useEffect(() => {
    const fullText = "Search token, wallet or contract";
    let index = 0;

    const interval = setInterval(() => {
      setPlaceholder(fullText.slice(0, index));
      index++;
      if (index > fullText.length) clearInterval(interval);
    }, 45);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (tokenIntelligenceState !== "loaded") {
      return;
    }

    const controls = [
      animate(0, holderSummary.holderQuality, {
        duration: 1.4,
        onUpdate: (value) =>
          setScores((prev) => ({
            ...prev,
            holderQuality: Math.round(value),
          })),
      }),

      animate(0, holderSummary.insiderRisk, {
        duration: 1.4,
        onUpdate: (value) =>
          setScores((prev) => ({
            ...prev,
            insider: Math.round(value),
          })),
      }),

      animate(0, holderSummary.conviction, {
        duration: 1.4,
        onUpdate: (value) =>
          setScores((prev) => ({
            ...prev,
            conviction: Math.round(value),
          })),
      }),

      animate(0, holderSummary.activity, {
        duration: 1.4,
        onUpdate: (value) =>
          setScores((prev) => ({
            ...prev,
            activity: Math.round(value),
          })),
      }),
    ];

    return () => {
      controls.forEach((control) => control.stop());
    };
  }, [holderSummary, tokenIntelligenceState]);


  const thesisSourceText = explainableReport.thesisHeadline
    ? explainableReport.thesisHeadline
    : tokenIntelligenceState === "loading"
    ? "Loading token intelligence from holder distribution and wallet metadata."
    : tokenIntelligenceState === "error"
    ? "Token intelligence summary is unavailable. Holder rankings and wallet behavior previews remain available."
    : thesisText;

  useEffect(() => {
    const resetFrame = requestAnimationFrame(() => setTypedThesis(""));
    let index = 0;

    const interval = setInterval(() => {
      setTypedThesis(thesisSourceText.slice(0, index));
      index++;
      if (index > thesisSourceText.length) clearInterval(interval);
    }, 12);

    return () => {
      cancelAnimationFrame(resetFrame);
      clearInterval(interval);
    };
  }, [thesisSourceText]);

  useEffect(() => {
    if (!query.trim()) {
      const resetTimer = window.setTimeout(() => {
        setResults([]);
        setIsScanning(false);
      }, 0);

      return () => clearTimeout(resetTimer);
    }

    const timer = setTimeout(async () => {
      setIsScanning(true);

      try {
        const response = await fetch(`/api/token?q=${encodeURIComponent(query)}`);
        const data = await response.json();

        if (!data.error) setResults(data.results || []);
        else setResults([]);
      } catch {
        setResults([]);
      }

      setIsScanning(false);
    }, 260);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!DEV_CACHE_PANEL || activeSection !== "Conviction Engine") return;

    const controller = new AbortController();

    async function loadCacheStatus() {
      setCacheStatusState("loading");
      setCacheStatusError("");

      try {
        const response = await fetch("/api/cache-status", {
          signal: controller.signal,
        });
        const data = await response.json();

        if (!response.ok || data.error) {
          throw new Error(
            apiErrorMessage(data.error, "Cache status request failed.")
          );
        }

        setCacheStatus(data);
        setCacheStatusState("loaded");
      } catch (error) {
        if (controller.signal.aborted) return;
        setCacheStatus(null);
        setCacheStatusState("error");
        setCacheStatusError(
          error instanceof Error ? error.message : "Cache status request failed."
        );
      }
    }

    void loadCacheStatus();
    const interval = window.setInterval(loadCacheStatus, 10_000);

    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [activeSection]);

  const selectedWalletAddress = selectedWallet?.row.fullAddress || "";
  const selectedTokenAddress = tokenData.tokenAddress || "";
  const selectedChain = tokenData.chain;

  useEffect(() => {
    if (!selectedWalletAddress) return;

    const controller = new AbortController();

    async function loadWalletTransactions() {
      try {
        const params = new URLSearchParams({
          chain: selectedChain,
          walletAddress: selectedWalletAddress,
        });

        if (selectedTokenAddress) {
          params.set("tokenAddress", selectedTokenAddress);
        }

        const response = await fetch(`/api/wallet-transactions?${params}`, {
          signal: controller.signal,
        });
        const data = await response.json();

        if (!response.ok || data.error) {
          throw new Error(
            apiErrorMessage(
              data.error,
              "Wallet transaction intelligence request failed."
            )
          );
        }

        setTransactionIntelligence(data);
        setTransactionLoadState("loaded");
      } catch (error) {
        if (controller.signal.aborted) return;

        setTransactionIntelligence(null);
        setTransactionLoadState("error");
        setTransactionError(
          error instanceof Error
            ? error.message
            : "Wallet transaction intelligence request failed."
        );
      }
    }

    void loadWalletTransactions();

    return () => controller.abort();
  }, [selectedChain, selectedTokenAddress, selectedWalletAddress]);

  useEffect(() => {
    if (!selectedWalletAddress) return;

    const controller = new AbortController();

    async function loadWalletMemory() {
      try {
        const params = new URLSearchParams({
          chain: selectedChain,
          walletAddress: selectedWalletAddress,
        });
        const response = await fetch(`/api/wallet-memory?${params}`, {
          signal: controller.signal,
        });
        const data = await response.json();

        if (!response.ok || data.error) {
          throw new Error(
            apiErrorMessage(data.error, "Wallet memory request failed.")
          );
        }

        setWalletMemory(data);
        setWalletMemoryLoadState("loaded");
      } catch (error) {
        if (controller.signal.aborted) return;

        setWalletMemory(null);
        setWalletMemoryLoadState("error");
        setWalletMemoryError(
          error instanceof Error ? error.message : "Wallet memory request failed."
        );
      }
    }

    void loadWalletMemory();

    return () => controller.abort();
  }, [selectedChain, selectedWalletAddress]);

  useEffect(() => {
    if (!selectedWalletAddress) return;

    const controller = new AbortController();

    async function loadWalletPersonality() {
      try {
        const params = new URLSearchParams({
          chain: selectedChain,
          walletAddress: selectedWalletAddress,
        });

        if (selectedTokenAddress) {
          params.set("tokenAddress", selectedTokenAddress);
        }

        const response = await fetch(`/api/wallet-personality?${params}`, {
          signal: controller.signal,
        });
        const data = await response.json();

        if (!response.ok || data.error) {
          throw new Error(
            apiErrorMessage(data.error, "Wallet personality request failed.")
          );
        }

        setWalletPersonality(data);
        setWalletPersonalityLoadState("loaded");
      } catch (error) {
        if (controller.signal.aborted) return;

        setWalletPersonality(null);
        setWalletPersonalityLoadState("error");
        setWalletPersonalityError(
          error instanceof Error
            ? error.message
            : "Wallet personality request failed."
        );
      }
    }

    void loadWalletPersonality();

    return () => controller.abort();
  }, [selectedChain, selectedTokenAddress, selectedWalletAddress]);

  function recordConvictionSnapshot(
    result: TokenResult,
    data: ExplainableConvictionData,
    generatedAt?: string
  ) {
    if (!result.tokenAddress) return;

    const snapshot = createConvictionSnapshot({
      chain: result.chain,
      tokenAddress: result.tokenAddress,
      tokenSymbol: result.rawSymbol || result.symbol,
      createdAt: data.cache?.generatedAt || generatedAt,
      finalConvictionScore: data.finalConvictionScore,
      subScores: {
        ...data.subScores,
        bundleRisk: data.bundleDetection?.bundleRiskScore,
      },
      dataConfidence: data.dataConfidence,
      explanationHeadline: data.explanation.headline,
      warnings: data.warnings,
    });

    convictionHistoryStore.current.addSnapshot(snapshot);
    setConvictionSnapshots(
      convictionHistoryStore.current.getSnapshots(
        result.chain,
        result.tokenAddress
      )
    );
  }

  async function selectToken(result: TokenResult) {
    setToken(result.symbol);
    setTokenData({
      ...result,
      pairAddress: result.pairAddress || "",
      tokenAddress: result.tokenAddress || "",
      shortTokenAddress: result.shortTokenAddress || "",
      imageUrl: result.imageUrl || "",
      url: result.url || "",
    });
    setResults([]);
    setQuery("");
    setWalletRows([]);
    setHolderError("");
    setBehaviorPreview(null);
    setBehaviorPreviewError("");
    setSelectedWallet(null);
    setTransactionIntelligence(null);
    setTransactionError("");
    setTransactionLoadState("idle");
    setWalletMemory(null);
    setWalletMemoryError("");
    setWalletMemoryLoadState("idle");
    setWalletPersonality(null);
    setWalletPersonalityError("");
    setWalletPersonalityLoadState("idle");
    setWalletPersonalityPreviews([]);
    setWalletPersonalityPreviewError("");
    setWalletPersonalityPreviewState("idle");
    setTokenIntelligence(null);
    setTokenIntelligenceError("");
    setClusterData(null);
    setClusterError("");
    setDecisionSnapshot(null);
    setDecisionSnapshotError("");
    setDecisionSnapshotState("idle");
    setExplainableConviction(null);
    setExplainableConvictionError("");
    setExplainableConvictionState("idle");
    setUnifiedAnalysis(null);
    setUnifiedAnalysisError("");
    setUnifiedAnalysisState("idle");
    setConvictionSnapshots(
      result.tokenAddress
        ? convictionHistoryStore.current.getSnapshots(
            result.chain,
            result.tokenAddress
          )
        : []
    );
    setScores({ holderQuality: 0, insider: 0, conviction: 0, activity: 0 });

    if (!result.tokenAddress) {
      setHolderLoadState("error");
      setBehaviorPreviewState("error");
      setTokenIntelligenceState("error");
      setClusterLoadState("error");
      setWalletPersonalityPreviewState("error");
      setExplainableConvictionState("error");
      setUnifiedAnalysisState("error");
      setHolderSummary({
        insiderRisk: 0,
        holderQuality: 0,
        conviction: 0,
        activity: 0,
      });
      setHolderError("Selected pair does not include a token contract address.");
      setBehaviorPreviewError("Selected pair does not include a token contract address.");
      setTokenIntelligenceError("Selected pair does not include a token contract address.");
      setClusterError("Selected pair does not include a token contract address.");
      setWalletPersonalityPreviewError("Selected pair does not include a token contract address.");
      setExplainableConvictionError("Selected pair does not include a token contract address.");
      setUnifiedAnalysisError("Selected pair does not include a token contract address.");
      return;
    }

    void loadUnifiedTokenAnalysis(result);
  }

  function applyHolderData(data: UnifiedTokenAnalysisData["holders"]) {
    setWalletRows(data?.holders || []);
    setHolderLoadState("loaded");

    if (data?.summary) {
      setHolderSummary({
        insiderRisk: data.summary.insiderRisk || 0,
        holderQuality: data.summary.diamondHands || 0,
        conviction: data.summary.diamondHands || 0,
        activity: data.summary.rotation || 0,
      });
    }
  }

  function applyTokenIntelligenceData(data: TokenIntelligenceData) {
    setTokenIntelligence(data);
    setTokenIntelligenceState("loaded");
    setHolderSummary({
      insiderRisk: data.scores?.insiderRiskScore || 0,
      holderQuality: data.scores?.holderQualityScore || 0,
      conviction: data.scores?.convictionScore || 0,
      activity: data.scores?.activityScore || 0,
    });
  }

  async function loadUnifiedTokenAnalysis(result: TokenResult) {
    if (!result.tokenAddress) return;

    setUnifiedAnalysisState("loading");
    setUnifiedAnalysis(null);
    setUnifiedAnalysisError("");
    setHolderLoadState("loading");
    setBehaviorPreviewState("loading");
    setTokenIntelligenceState("loading");
    setClusterLoadState("loading");
    setExplainableConvictionState("loading");

    try {
      const params = new URLSearchParams({
        chain: result.chain,
        tokenAddress: result.tokenAddress,
        tokenSymbol: result.rawSymbol || result.symbol,
        mode: "deep",
        limit: "10",
        deepLimit: "5",
        personalityLimit: "5",
      });

      if (result.marketCap) params.set("marketCapUsd", result.marketCap);
      if (result.liquidity) params.set("liquidityUsd", result.liquidity);
      if (result.volume24h) params.set("volume24hUsd", result.volume24h);
      if (typeof result.change24h === "number") {
        params.set("priceChange24h", String(result.change24h));
      }

      const response = await fetch(`/api/analyze-token?${params}`);
      const data = (await response.json()) as UnifiedTokenAnalysisData & {
        error?: unknown;
      };

      if (!response.ok || data.error) {
        throw new Error(
          apiErrorMessage(data.error, "Unified token analysis request failed.")
        );
      }

      if (process.env.NODE_ENV !== "production") {
        console.debug("NovaOS unified analysis", {
          modules: data.modules,
          cache: data.cache,
        });
      }

      setUnifiedAnalysis(data);
      setUnifiedAnalysisState("loaded");

      if (data.modules?.holders?.status === "loaded" && data.holders) {
        applyHolderData(data.holders);
      } else {
        void loadHolderIntelligence(result.chain, result.tokenAddress);
      }

      if (
        data.modules?.walletProfiles?.status === "loaded" &&
        data.walletProfiles
      ) {
        setBehaviorPreview({
          profiles: data.walletProfiles.profiles || [],
          summary: data.walletProfiles.summary,
        });
        setBehaviorPreviewState("loaded");
      } else {
        void loadWalletBehaviorPreview(result.chain, result.tokenAddress);
      }

      if (data.modules?.clusters?.status === "loaded" && data.clusters) {
        setClusterData(data.clusters);
        setClusterLoadState("loaded");
      } else {
        void loadClusterIntelligence(result.chain, result.tokenAddress);
      }

      if (
        data.modules?.tokenIntelligence?.status === "loaded" &&
        data.tokenIntelligence
      ) {
        applyTokenIntelligenceData(data.tokenIntelligence);
      } else {
        void loadTokenIntelligence(result.chain, result.tokenAddress);
      }

      if (data.modules?.conviction?.status === "loaded" && data.conviction) {
        setExplainableConviction(data.conviction);
        setExplainableConvictionState("loaded");
        recordConvictionSnapshot(result, data.conviction, data.generatedAt);
      } else {
        void loadExplainableConviction(result);
      }

      if (
        data.modules?.walletPersonalities?.status === "loaded" &&
        data.walletPersonalities
      ) {
        setWalletPersonalityPreviews(
          data.walletPersonalities.personalities || []
        );
        setWalletPersonalityPreviewState("loaded");
      } else {
        void loadWalletPersonalityPreviews(result.chain, result.tokenAddress);
      }
    } catch (error) {
      setUnifiedAnalysis(null);
      setUnifiedAnalysisState("error");
      setUnifiedAnalysisError(
        error instanceof Error
          ? error.message
          : "Unified token analysis request failed."
      );

      void loadHolderIntelligence(result.chain, result.tokenAddress);
      void loadWalletBehaviorPreview(result.chain, result.tokenAddress);
      void loadTokenIntelligence(result.chain, result.tokenAddress);
      void loadClusterIntelligence(result.chain, result.tokenAddress);
      void loadExplainableConviction(result);
      void loadWalletPersonalityPreviews(result.chain, result.tokenAddress);
    }
  }

  async function loadHolderIntelligence(chain: string, tokenAddress: string) {
    setHolderLoadState("loading");
    setHolderError("");

    try {
      const holdersResponse = await fetch(
        `/api/holders?chain=${encodeURIComponent(
          chain
        )}&tokenAddress=${encodeURIComponent(tokenAddress)}`
      );

      const holdersData = await holdersResponse.json();

      if (!holdersResponse.ok || holdersData.error) {
        throw new Error(
          apiErrorMessage(holdersData.error, "Holder intelligence request failed.")
        );
      }

      applyHolderData(holdersData);
    } catch (error) {
      setHolderLoadState("error");
      setWalletRows([]);
      setHolderSummary({
        insiderRisk: 0,
        holderQuality: 0,
        conviction: 0,
        activity: 0,
      });
      setHolderError(
        error instanceof Error
          ? error.message
          : "Holder intelligence request failed."
      );
    }
  }

  async function loadTokenIntelligence(chain: string, tokenAddress: string) {
    setTokenIntelligenceState("loading");
    setTokenIntelligence(null);
    setTokenIntelligenceError("");

    try {
      const response = await fetch(
        `/api/token-intelligence?chain=${encodeURIComponent(
          chain
        )}&tokenAddress=${encodeURIComponent(tokenAddress)}&limit=10`
      );
      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(
          apiErrorMessage(data.error, "Token intelligence request failed.")
        );
      }

      setTokenIntelligence(data);
      setTokenIntelligenceState("loaded");
      setHolderSummary({
        insiderRisk: data.scores?.insiderRiskScore || 0,
        holderQuality: data.scores?.holderQualityScore || 0,
        conviction: data.scores?.convictionScore || 0,
        activity: data.scores?.activityScore || 0,
      });
    } catch (error) {
      setTokenIntelligence(null);
      setTokenIntelligenceState("error");
      setTokenIntelligenceError(
        error instanceof Error
          ? error.message
          : "Token intelligence request failed."
      );
    }
  }

  async function loadClusterIntelligence(chain: string, tokenAddress: string) {
    setClusterLoadState("loading");
    setClusterData(null);
    setClusterError("");

    try {
      const response = await fetch(
        `/api/wallet-clusters?chain=${encodeURIComponent(
          chain
        )}&tokenAddress=${encodeURIComponent(tokenAddress)}&limit=20`
      );
      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(
          apiErrorMessage(data.error, "Cluster intelligence request failed.")
        );
      }

      setClusterData(data);
      setClusterLoadState("loaded");
    } catch (error) {
      setClusterData(null);
      setClusterLoadState("error");
      setClusterError(
        error instanceof Error
          ? error.message
          : "Cluster intelligence request failed."
      );
    }
  }

  async function loadExplainableConviction(result: TokenResult) {
    if (!result.tokenAddress) return;

    setExplainableConvictionState("loading");
    setExplainableConviction(null);
    setExplainableConvictionError("");

    try {
      const params = new URLSearchParams({
        chain: result.chain,
      tokenAddress: result.tokenAddress,
      tokenSymbol: result.rawSymbol || result.symbol,
      limit: "10",
      deep: "true",
      deepLimit: "5",
    });

      if (result.marketCap) params.set("marketCapUsd", result.marketCap);
      if (result.liquidity) params.set("liquidityUsd", result.liquidity);
      if (result.volume24h) params.set("volume24hUsd", result.volume24h);
      if (typeof result.change24h === "number") {
        params.set("priceChange24h", String(result.change24h));
      }

      const response = await fetch(`/api/conviction-engine?${params}`);
      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(
          apiErrorMessage(data.error, "Explainable Conviction request failed.")
        );
      }

      setExplainableConviction(data);
      setExplainableConvictionState("loaded");
      recordConvictionSnapshot(result, data);
    } catch (error) {
      setExplainableConviction(null);
      setExplainableConvictionState("error");
      setExplainableConvictionError(
        error instanceof Error
          ? error.message
          : "Explainable Conviction request failed."
      );
    }
  }

  async function loadWalletPersonalityPreviews(
    chain: string,
    tokenAddress: string
  ) {
    setWalletPersonalityPreviewState("loading");
    setWalletPersonalityPreviews([]);
    setWalletPersonalityPreviewError("");

    try {
      const response = await fetch(
        `/api/wallet-personalities?chain=${encodeURIComponent(
          chain
        )}&tokenAddress=${encodeURIComponent(tokenAddress)}&limit=5`
      );
      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(
          apiErrorMessage(data.error, "Wallet personality preview request failed.")
        );
      }

      setWalletPersonalityPreviews(data.personalities || []);
      setWalletPersonalityPreviewState("loaded");
    } catch (error) {
      setWalletPersonalityPreviews([]);
      setWalletPersonalityPreviewState("error");
      setWalletPersonalityPreviewError(
        error instanceof Error
          ? error.message
          : "Wallet personality preview request failed."
      );
    }
  }

  async function loadWalletBehaviorPreview(chain: string, tokenAddress: string) {
    setBehaviorPreviewState("loading");
    setBehaviorPreview(null);
    setBehaviorPreviewError("");

    try {
      const response = await fetch(
        `/api/wallet-profiles?chain=${encodeURIComponent(
          chain
        )}&tokenAddress=${encodeURIComponent(tokenAddress)}&limit=5`
      );

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(apiErrorMessage(data.error, "Wallet behavior preview request failed."));
      }

      setBehaviorPreview({
        profiles: data.profiles || [],
        summary: data.summary || {
          profiledWallets: 0,
          goodProfiles: 0,
          partialProfiles: 0,
          unavailableProfiles: 0,
          averageActivityScore: 0,
          averageMaturityScore: 0,
          highestConcentrationScore: 0,
          averageDataConfidence: 0,
          averageWalletAgeDays: null,
          averageActivityVelocity: 0,
          averageDormancyRisk: 0,
          highestConcentrationRisk: 0,
          reliabilityAverage: 0,
          dominantBehaviorClass: "unavailable",
        },
      });
      setBehaviorPreviewState("loaded");
    } catch (error) {
      setBehaviorPreview(null);
      setBehaviorPreviewState("error");
      setBehaviorPreviewError(
        error instanceof Error
          ? error.message
          : "Wallet behavior preview request failed."
      );
    }
  }

  function openWalletDrawer(row: WalletRow, profile?: WalletBehaviorProfile) {
    setSelectedWallet({ row, profile });
    setTransactionIntelligence(null);
    setTransactionError("");
    setTransactionLoadState(row.fullAddress ? "loading" : "error");
    setWalletMemory(null);
    setWalletMemoryError("");
    setWalletMemoryLoadState(row.fullAddress ? "loading" : "error");
    setWalletPersonality(null);
    setWalletPersonalityError("");
    setWalletPersonalityLoadState(row.fullAddress ? "loading" : "error");

    if (!row.fullAddress) {
      setTransactionError("Wallet address is unavailable for this holder row.");
      setWalletMemoryError("Wallet address is unavailable for this holder row.");
      setWalletPersonalityError("Wallet address is unavailable for this holder row.");
    }
  }

  async function createDecisionSnapshot() {
    if (!tokenData.tokenAddress || !tokenIntelligence) return;

    setDecisionSnapshotState("loading");
    setDecisionSnapshotError("");

    try {
      const response = await fetch("/api/decision-snapshot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chain: tokenData.chain,
          tokenAddress: tokenData.tokenAddress,
          tokenSymbol: tokenData.rawSymbol || tokenData.symbol,
          convictionScore: tokenIntelligence.scores.convictionScore,
          insiderRiskScore: tokenIntelligence.scores.insiderRiskScore,
          holderQualityScore: tokenIntelligence.scores.holderQualityScore,
          activityScore: tokenIntelligence.scores.activityScore,
          thesisHeadline: tokenIntelligence.thesis.headline,
        }),
      });
      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(
          apiErrorMessage(data.error, "Decision snapshot request failed.")
        );
      }

      setDecisionSnapshot(data);
      setDecisionSnapshotState("loaded");
    } catch (error) {
      setDecisionSnapshot(null);
      setDecisionSnapshotState("error");
      setDecisionSnapshotError(
        error instanceof Error
          ? error.message
          : "Decision snapshot request failed."
      );
    }
  }

  return (
    <main className="relative h-screen overflow-hidden bg-[#020407] text-white">
      <AnimatedBackground />

      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.985, filter: "blur(18px)" }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex h-screen"
      >
        <Sidebar
          activeSection={activeSection}
          onSelectSection={setActiveSection}
        />

        <section className="h-screen flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-5">
          <Header
            activeSection={activeSection}
            query={query}
            setQuery={setQuery}
            placeholder={placeholder}
            isScanning={isScanning}
            results={results}
            selectToken={selectToken}
          />

          <SectionTabs
            activeSection={activeSection}
            onSelectSection={setActiveSection}
          />

          {activeSection === "Overview" && (
            <>
              <section className="space-y-4">
                <TokenHeader
                  mantleContext={mantleContext}
                  token={token}
                  tokenData={tokenData}
                  marketCards={marketCards}
                  onToggleMantleMode={() =>
                    setMantleModeEnabled((enabled) => !enabled)
                  }
                />

                <div className="grid items-stretch gap-4 xl:grid-cols-[1.12fr_0.88fr]">
                  <div className="min-h-0">
                    <NovaChart
                      token={token}
                      price={tokenData.price}
                      marketCap={tokenData.marketCap}
                      liquidity={tokenData.liquidity}
                      volume24h={tokenData.volume24h}
                      chain={tokenData.chain}
                      pairAddress={tokenData.pairAddress}
                      chartHeight={420}
                    />
                  </div>

                  <div className="grid min-h-[420px]">
                    <div className="grid min-h-0 items-center gap-3 lg:grid-cols-[0.86fr_1.14fr] xl:grid-cols-1 2xl:grid-cols-[0.84fr_1.16fr]">
                      <ConvictionRing
                        compact
                        confidenceLabel={overviewConfidenceLabel}
                        score={overviewConvictionScore}
                        state={overviewConvictionState}
                      />
                      <OverviewScoreStrip
                        scores={overviewCoreSubScores}
                        state={explainableConvictionState}
                      />
                    </div>
                  </div>
                </div>
              </section>

              <div className="mt-6">
                <AIThesis
                  data={tokenIntelligence}
                  error={tokenIntelligenceError}
                  loadState={tokenIntelligenceState}
                  report={explainableReport}
                  typedThesis={typedThesis}
                />
              </div>

              {mantleContext.mantleModeActive && (
                <MantleEcosystemContextPanel mantleContext={mantleContext} />
              )}

              <VerifiedOnMantlePanel
                decisionSnapshot={decisionSnapshot}
                error={decisionSnapshotError}
                hasTokenIntelligence={Boolean(tokenIntelligence && tokenData.tokenAddress)}
                loadState={decisionSnapshotState}
                onCreateSnapshot={createDecisionSnapshot}
              />

              <OverviewTopHoldersTable
                behaviorProfiles={behaviorPreview?.profiles || []}
                loadState={holderLoadState}
                onSelectWallet={openWalletDrawer}
                onViewFull={() => setActiveSection("Insider Scan")}
                personalityError={walletPersonalityPreviewError}
                personalityLoadState={walletPersonalityPreviewState}
                personalityPreviews={walletPersonalityPreviews}
                walletRows={walletRows}
              />
            </>
          )}

          {activeSection === "Conviction Engine" && (
            <SectionShell
              eyebrow="Conviction Engine"
              title="Explainable Conviction Layer"
              description="A calmer view for thesis confidence, AI-versus-holder alignment, and future decision snapshots."
            >
              <ExplainableConvictionEnginePanel
                data={explainableConviction}
                error={explainableConvictionError}
                loadState={explainableConvictionState}
              />
              <SyntheticTestLabPanel
                allScenarioResults={syntheticScenarioResults}
                onSelectScenario={setSelectedSyntheticScenario}
                scenarioResult={selectedSyntheticScenarioResult}
                selectedScenario={selectedSyntheticScenario}
              />
              <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                <AIHumanArenaPanel
                  arena={arenaResult}
                  error={tokenIntelligenceError}
                  loadState={arenaLoadState}
                />
                <AIThesis
                  data={tokenIntelligence}
                  error={tokenIntelligenceError}
                  loadState={tokenIntelligenceState}
                  report={explainableReport}
                  typedThesis={typedThesis}
                />
              </div>
              <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
                <ConvictionRing
                  confidenceLabel={tokenIntelligence?.thesis.confidenceLabel}
                  score={scores.conviction}
                  state={tokenIntelligenceState}
                />
                <ConvictionInterpretationPanel
                  tokenIntelligence={tokenIntelligence}
                  loadState={tokenIntelligenceState}
                />
              </div>
              <SnapshotTimelinePlaceholder />
              {DEV_CACHE_PANEL && (
                <DevCacheStatusPanel
                  data={cacheStatus}
                  error={cacheStatusError}
                  loadState={cacheStatusState}
                  unifiedAnalysis={unifiedAnalysis}
                  unifiedAnalysisError={unifiedAnalysisError}
                  unifiedAnalysisState={unifiedAnalysisState}
                />
              )}
            </SectionShell>
          )}

          {activeSection === "Conviction History" && (
            <ConvictionHistorySection
              snapshots={convictionSnapshots}
              token={token}
              tokenAddress={tokenData.tokenAddress}
            />
          )}

          {activeSection === "Bubble Intelligence" && (
            <SectionShell
              eyebrow="Bubble Intelligence"
              title="Cluster Relationship View"
              description="Behavioral similarity, activity overlap and possible coordination are isolated here so the overview stays focused."
            >
              <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
                <ClusterIntelligencePanel
                  data={clusterData}
                  error={clusterError}
                  loadState={clusterLoadState}
                />
                <ClusterMethodologyPanel />
              </div>
            </SectionShell>
          )}

          {activeSection === "Wallet Flows" && (
            <SectionShell
              eyebrow="Wallet Flows"
              title="Wallet Behavior and Activity"
              description="Flow-oriented wallet metadata and transaction-intelligence foundations live here without claiming PnL or win rate."
            >
              <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                <WalletBehaviorPreview
                  data={behaviorPreview}
                  loadState={behaviorPreviewState}
                  error={behaviorPreviewError}
                />
                <WalletFlowSummaryPanel
                  behaviorPreview={behaviorPreview}
                  holderLoadState={holderLoadState}
                  walletRows={walletRows}
                />
              </div>
            </SectionShell>
          )}

          {activeSection === "Insider Scan" && (
            <SectionShell
              eyebrow="Insider Scan"
              title="Holder Risk Workbench"
              description="Holder concentration, dormant risk and suspicious-overlap summaries are grouped away from the conviction overview."
            >
              <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="grid gap-4">
                  <RiskRadar />
                  <TopHolderPreview
                    walletRows={walletRows}
                    loadState={holderLoadState}
                  />
                  <LiveSignals />
                  <ActivityTimeline />
                </div>
                <InsiderSummaryPanel
                  behaviorPreview={behaviorPreview}
                  clusterData={clusterData}
                  tokenIntelligence={tokenIntelligence}
                />
              </div>
              <StableWalletIntelligenceTable
                walletRows={walletRows}
                behaviorProfiles={behaviorPreview?.profiles || []}
                personalityError={walletPersonalityPreviewError}
                personalityLoadState={walletPersonalityPreviewState}
                personalityPreviews={walletPersonalityPreviews}
                loadState={holderLoadState}
                error={holderError}
                onSelectWallet={openWalletDrawer}
              />
            </SectionShell>
          )}

          {activeSection === "Signals" && (
            <SignalsConsensusArena
              arena={arenaResult}
              tokenIntelligence={tokenIntelligence}
            />
          )}

          {(activeSection === "Social Feed" || activeSection === "Watchlist") && (
            <PlaceholderSection section={activeSection} />
          )}
        </section>
      </motion.div>

      <WalletDetailDrawer
        chain={tokenData.chain}
        loadState={behaviorPreviewState}
        selected={selectedWallet}
        transactionData={transactionIntelligence}
        transactionError={transactionError}
        transactionLoadState={transactionLoadState}
        walletMemory={walletMemory}
        walletMemoryError={walletMemoryError}
        walletMemoryLoadState={walletMemoryLoadState}
        walletPersonality={walletPersonality}
        walletPersonalityError={walletPersonalityError}
        walletPersonalityLoadState={walletPersonalityLoadState}
        onClose={() => setSelectedWallet(null)}
      />
    </main>
  );
}

export default function TerminalPage() {
  return <TerminalExperience />;
}

function AnimatedBackground() {
  return (
    <>
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(1,44,59,0.62),transparent_36%),radial-gradient(circle_at_16%_72%,rgba(46,1,1,0.14),transparent_34%),radial-gradient(circle_at_88%_62%,rgba(25,9,38,0.24),transparent_34%),linear-gradient(to_bottom,#020407,#010203)]" />
      <div className="fixed inset-0 opacity-[0.045] bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:90px_90px]" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.42)_58%,rgba(0,0,0,0.88)_100%)]" />

      <motion.div
        animate={{
          x: ["-8%", "8%", "-8%"],
          y: ["-4%", "4%", "-4%"],
          opacity: [0.2, 0.34, 0.2],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none fixed left-[20%] top-[12%] h-[32rem] w-[32rem] rounded-full bg-cyan-900/12 blur-[120px]"
      />

      <motion.div
        animate={{
          x: ["8%", "-6%", "8%"],
          y: ["6%", "-4%", "6%"],
          opacity: [0.12, 0.24, 0.12],
        }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none fixed bottom-[8%] right-[10%] h-[34rem] w-[34rem] rounded-full bg-purple-950/18 blur-[130px]"
      />

      <motion.div
        animate={{ y: ["-100%", "120%"] }}
        transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
        className="pointer-events-none fixed inset-x-0 top-0 h-28 bg-gradient-to-b from-transparent via-cyan-100/[0.035] to-transparent blur-3xl"
      />
    </>
  );
}

function Sidebar({
  activeSection,
  onSelectSection,
}: {
  activeSection: TerminalSection;
  onSelectSection: (section: TerminalSection) => void;
}) {
  return (
    <aside className="hidden h-screen w-64 shrink-0 border-r border-white/10 bg-black/25 p-5 backdrop-blur-2xl lg:block">
      <div className="mb-7 flex items-center gap-3">
        <div className="relative h-8 w-8">
          <div className="absolute inset-0 rounded-full bg-cyan-300/20 blur-md" />
          <div className="relative h-8 w-8 rounded-full border border-cyan-200/25 bg-gradient-to-br from-cyan-100/55 via-[#192638] to-[#190926]" />
        </div>
        <span className="font-semibold tracking-[-0.03em]">NovaOS</span>
      </div>

      <nav className="space-y-2 text-sm text-white/50">
        {terminalSections.map((item) => {
          const isActive = item === activeSection;

          return (
          <button
            key={item}
            type="button"
            onClick={() => onSelectSection(item)}
            className={`group flex w-full items-center rounded-2xl px-4 py-3 text-left transition ${
              isActive
                ? "border border-cyan-100/10 bg-cyan-100/[0.055] text-cyan-100"
                : "hover:bg-white/[0.04] hover:text-white"
            }`}
          >
            <span
              className={`mr-3 h-1.5 w-1.5 rounded-full ${
                isActive ? "bg-cyan-100" : "bg-white/18"
              }`}
            />
            {item}
          </button>
        )})}
      </nav>

      <div className="mt-7 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
        <p className="text-xs uppercase tracking-[0.25em] text-cyan-100/45">
          System Status
        </p>
        <p className="mt-3 text-sm text-white/55">Conviction Engine active</p>
        <p className="mt-1 text-xs text-white/28">
          Monitoring Ethereum, Base, Mantle and Solana.
        </p>
      </div>
    </aside>
  );
}

function Header({
  activeSection,
  query,
  setQuery,
  placeholder,
  isScanning,
  results,
  selectToken,
}: {
  activeSection: TerminalSection;
  query: string;
  setQuery: (value: string) => void;
  placeholder: string;
  isScanning: boolean;
  results: TokenResult[];
  selectToken: (result: TokenResult) => void;
}) {
  return (
    <header className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-cyan-100/40">
          Intelligence Terminal
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-[-0.06em]">
          {activeSection}
        </h1>
      </div>

      <div className="group relative w-full xl:w-[560px]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="relative w-full rounded-full border border-white/10 bg-black/35 px-5 py-3 text-sm text-white/80 outline-none backdrop-blur-2xl transition focus:border-cyan-100/20"
        />

        {!query && (
          <div className="pointer-events-none absolute left-5 top-1/2 flex -translate-y-1/2 text-sm text-white/28">
            {placeholder}
            <motion.span
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              |
            </motion.span>
          </div>
        )}

        {query && (
          <div className="absolute right-0 top-14 z-50 max-h-[520px] w-full overflow-y-auto rounded-[1.5rem] border border-white/10 bg-[#05080a]/95 p-2 shadow-[0_30px_100px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
            {isScanning && (
              <div className="px-4 py-5 text-sm text-white/35">
                Searching token pairs...
              </div>
            )}

            {!isScanning && results.length === 0 && (
              <div className="px-4 py-5 text-sm text-white/35">
                No strong liquid pairs found.
              </div>
            )}

            {results.map((result) => (
              <button
                key={`${result.chain}-${result.dex}-${result.pairAddress}`}
                onClick={() => selectToken(result)}
                className="flex w-full items-center justify-between gap-4 rounded-2xl px-4 py-3 text-left transition hover:bg-white/[0.05]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {result.imageUrl ? (
                    <img
                      src={result.imageUrl}
                      alt={result.symbol}
                      className="h-9 w-9 rounded-full border border-white/10 object-cover"
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-100/15 bg-cyan-100/[0.045] text-xs text-cyan-100/60">
                      {result.rawSymbol?.slice(0, 2) || "?"}
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white/82">
                      {result.symbol}{" "}
                      <span className="text-white/35">{result.name}</span>
                    </p>
                    <p className="mt-1 truncate text-xs text-white/32">
                      {chainLabel(result.chain)} · {result.dex} ·{" "}
                      {result.shortTokenAddress || "contract"}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-sm text-cyan-100/70">{result.price}</p>
                  <p className="mt-1 text-xs text-white/32">
                    MC {result.marketCap} · Vol {result.volume24h}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}

function SectionTabs({
  activeSection,
  onSelectSection,
}: {
  activeSection: TerminalSection;
  onSelectSection: (section: TerminalSection) => void;
}) {
  return (
    <div className="mb-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
      {terminalSections.map((section) => {
        const isActive = section === activeSection;

        return (
          <button
            key={section}
            type="button"
            onClick={() => onSelectSection(section)}
            className={`shrink-0 rounded-full border px-4 py-2 text-xs transition ${
              isActive
                ? "border-cyan-100/16 bg-cyan-100/[0.06] text-cyan-100/75"
                : "border-white/10 bg-white/[0.025] text-white/38"
            }`}
          >
            {section}
          </button>
        );
      })}
    </div>
  );
}

function SectionShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-2xl">
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-100/42">
          {eyebrow}
        </p>
        <div className="mt-3 flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
          <h2 className="max-w-2xl text-3xl font-semibold tracking-[-0.06em] text-white/90">
            {title}
          </h2>
          <p className="max-w-xl text-sm leading-relaxed text-white/38">
            {description}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}

function XLogoIcon({ size = 17 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      fill="currentColor"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.656l-5.214-6.817-5.966 6.817H1.68l7.73-8.835L1.254 2.25h6.824l4.713 6.231 5.453-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

function TokenHeader({
  mantleContext,
  onToggleMantleMode,
  token,
  tokenData,
  marketCards,
}: {
  mantleContext: MantleContext;
  onToggleMantleMode: () => void;
  token: string;
  tokenData: TokenResult;
  marketCards: { label: string; value: string }[];
}) {
  const logoUrl = resolveTokenLogo(tokenData);
  const tokenLinks = getTokenLinks(tokenData);
  const socialLinks = [
    {
      href: tokenLinks.website,
      icon: Globe,
      label: "Website",
    },
    {
      href: tokenLinks.twitter,
      icon: XLogoIcon,
      label: "X",
    },
    {
      href: tokenLinks.telegram,
      icon: Send,
      label: "Telegram",
    },
  ].filter((link) => Boolean(link.href));
  const [failedLogoUrl, setFailedLogoUrl] = useState("");
  const showLogo = Boolean(logoUrl && failedLogoUrl !== logoUrl);

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] p-4 backdrop-blur-2xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(1,44,59,0.38),transparent_55%)]" />

      <div className="relative flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-cyan-100/14 bg-cyan-100/[0.055] shadow-[0_0_28px_rgba(34,211,238,0.13)]">
            {showLogo ? (
              <img
                alt={`${token} logo`}
                className="h-full w-full object-cover"
                src={logoUrl}
                onError={() => setFailedLogoUrl(logoUrl)}
              />
            ) : (
              <>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(180,240,255,0.28),transparent_45%),linear-gradient(135deg,rgba(34,211,238,0.12),rgba(124,58,237,0.08))]" />
                <span className="relative text-lg font-semibold text-cyan-50/82">
                  {tokenInitial(token)}
                </span>
              </>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.24em] text-white/34">
              Analyzing
            </p>
            <h2 className="mt-1 truncate text-3xl font-semibold tracking-[-0.05em]">
              {token}
            </h2>
            <p className="mt-1 truncate text-sm text-white/36">
              {tokenData.name} · {chainName(tokenData.chain)} · {tokenData.dex}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2 text-right">
          <div className="flex flex-wrap justify-end gap-2">
            {socialLinks.map(({ href, icon: Icon, label }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer"
                title={label}
                className="flex h-9 items-center justify-center text-white/70 opacity-75 drop-shadow-none transition duration-200 hover:-translate-y-px hover:text-cyan-50 hover:opacity-100 hover:drop-shadow-[0_0_10px_rgba(34,211,238,0.35)]"
              >
                <Icon size={17} strokeWidth={1.75} />
              </a>
            ))}
            <div className="rounded-full border border-cyan-100/10 bg-cyan-100/[0.04] px-4 py-2 text-sm text-cyan-100/70">
              {chainLabel(tokenData.chain)}
            </div>
            <button
              type="button"
              onClick={onToggleMantleMode}
              className={`rounded-full border px-4 py-2 text-xs transition ${
                mantleContext.mantleModeActive
                  ? "border-cyan-100/16 bg-cyan-100/[0.065] text-cyan-100/72"
                  : "border-white/10 bg-white/[0.035] text-white/45 hover:bg-white/[0.055]"
              }`}
            >
              Mantle Mode ·{" "}
              {mantleContext.isMantleAsset
                ? "Active"
                : "Available for Mantle assets"}
            </button>
          </div>
          <p className={`mt-2 text-xs ${changeClass(tokenData.change24h)}`}>
            24h {tokenData.change24h?.toFixed?.(2) || "0.00"}%
          </p>
        </div>
      </div>

      <div className="relative mt-5 grid gap-3 sm:grid-cols-4">
        {marketCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-white/10 bg-black/20 p-3"
          >
            <p className="text-xs text-white/35">{card.label}</p>
            <p className="mt-2 truncate text-lg font-semibold">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const convictionHistoryCoreScores = [
  ["holderIntegrity", "Holder Integrity"],
  ["walletQuality", "Wallet Quality"],
  ["behaviorStability", "Behavior Stability"],
  ["liquidityTrust", "Liquidity Trust"],
  ["marketMomentum", "Market Momentum"],
  ["riskProtection", "Risk Protection"],
] as const;

const convictionHistoryRiskScores = [
  ["insiderRisk", "Insider Risk"],
  ["bundleRisk", "Bundle Risk"],
  ["clusterRisk", "Cluster Risk"],
  ["botActivityRisk", "Bot Risk"],
  ["freshWalletRisk", "Fresh Wallet Risk"],
  ["rotationRisk", "Rotation Risk"],
] as const;

function snapshotScore(
  snapshot: ConvictionSnapshot,
  key: keyof ConvictionSnapshot["subScores"]
) {
  const value = snapshot.subScores[key];
  return typeof value === "number" ? Math.round(value) : null;
}

function historyDelta(previous: number | null, current: number | null) {
  if (previous === null || current === null) return null;
  return current - previous;
}

function signedHistoryDelta(delta: number | null) {
  if (delta === null) return "Unavailable";
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

function historyDeltaClass(delta: number | null, invert = false) {
  if (delta === null || delta === 0) return "text-white/42";
  const favorable = invert ? delta < 0 : delta > 0;
  return favorable ? "text-cyan-100/72" : "text-amber-100/72";
}

function historyDirectionLabel(
  direction: ReturnType<typeof compareConvictionSnapshots>["direction"]
) {
  return direction === "unchanged" ? "Stable" : direction;
}

function formatSnapshotTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

type ConvictionReplayDriver = {
  currentValue: number | null;
  delta: number;
  kind: "core" | "risk";
  label: string;
  previousValue: number | null;
  reason: string;
};

function replayDriverReason({
  delta,
  kind,
  label,
}: Pick<ConvictionReplayDriver, "delta" | "kind" | "label">) {
  if (kind === "risk") {
    return delta < 0
      ? `${label} decreased, reducing measured structural pressure.`
      : `${label} increased, adding measured structural pressure.`;
  }

  return delta > 0
    ? `${label} improved between stored snapshots.`
    : `${label} weakened between stored snapshots.`;
}

function buildConvictionReplayExplanation({
  comparison,
  drivers,
}: {
  comparison: ReturnType<typeof compareConvictionSnapshots>;
  drivers: ConvictionReplayDriver[];
}) {
  const direction =
    comparison.direction === "increased"
      ? "increased"
      : comparison.direction === "decreased"
      ? "decreased"
      : "remained stable";
  const measuredDrivers = drivers
    .slice(0, 3)
    .map((driver) => {
      const verb =
        driver.kind === "risk"
          ? driver.delta < 0
            ? "decreased"
            : "increased"
          : driver.delta > 0
          ? "improved"
          : "fell";
      return `${driver.label} ${verb} by ${Math.abs(driver.delta)} points`;
    });

  if (comparison.direction === "unchanged") {
    return `Conviction remained stable at ${comparison.currentScore}. No measured score movement changed the replay outcome.`;
  }

  return `Conviction ${direction} from ${comparison.previousScore} to ${
    comparison.currentScore
  }${
    measuredDrivers.length ? ` because ${measuredDrivers.join(", ")}` : ""
  }.`;
}

function ConvictionHistorySection({
  snapshots,
  token,
  tokenAddress,
}: {
  snapshots: ConvictionSnapshot[];
  token: string;
  tokenAddress?: string;
}) {
  const current = snapshots[snapshots.length - 1] || null;
  const previous = snapshots[snapshots.length - 2] || null;
  const comparison =
    previous && current ? compareConvictionSnapshots(previous, current) : null;
  const coreDeltas =
    previous && current
      ? convictionHistoryCoreScores
          .map(([key, label]) => {
            const previousValue = snapshotScore(previous, key);
            const currentValue = snapshotScore(current, key);
            return {
              key,
              label,
              previousValue,
              currentValue,
              delta: historyDelta(previousValue, currentValue),
            };
          })
          .filter((score) => score.delta !== null)
          .sort((left, right) => Math.abs(right.delta || 0) - Math.abs(left.delta || 0))
      : [];
  const riskDeltas =
    previous && current
      ? convictionHistoryRiskScores.map(([key, label]) => {
          const previousValue = snapshotScore(previous, key);
          const currentValue = snapshotScore(current, key);
          return {
            key,
            label,
            previousValue,
            currentValue,
            delta: historyDelta(previousValue, currentValue),
          };
        })
      : [];
  const positiveDrivers = coreDeltas.filter((score) => (score.delta || 0) > 0);
  const negativeDrivers = coreDeltas.filter((score) => (score.delta || 0) < 0);
  const riskReductions = riskDeltas
    .filter((score) => typeof score.delta === "number" && score.delta < 0)
    .sort((left, right) => Math.abs(right.delta || 0) - Math.abs(left.delta || 0));
  const riskIncreases = riskDeltas
    .filter((score) => typeof score.delta === "number" && score.delta > 0)
    .sort((left, right) => Math.abs(right.delta || 0) - Math.abs(left.delta || 0));
  const allPositiveDrivers: ConvictionReplayDriver[] = [
    ...positiveDrivers.map((driver) => ({
      ...driver,
      delta: driver.delta || 0,
      kind: "core" as const,
      reason: replayDriverReason({
        delta: driver.delta || 0,
        kind: "core",
        label: driver.label,
      }),
    })),
    ...riskReductions.map((driver) => ({
      ...driver,
      delta: driver.delta || 0,
      kind: "risk" as const,
      reason: replayDriverReason({
        delta: driver.delta || 0,
        kind: "risk",
        label: driver.label,
      }),
    })),
  ].sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta));
  const allNegativeDrivers: ConvictionReplayDriver[] = [
    ...negativeDrivers.map((driver) => ({
      ...driver,
      delta: driver.delta || 0,
      kind: "core" as const,
      reason: replayDriverReason({
        delta: driver.delta || 0,
        kind: "core",
        label: driver.label,
      }),
    })),
    ...riskIncreases.map((driver) => ({
      ...driver,
      delta: driver.delta || 0,
      kind: "risk" as const,
      reason: replayDriverReason({
        delta: driver.delta || 0,
        kind: "risk",
        label: driver.label,
      }),
    })),
  ].sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta));
  const currentLimiter = current
    ? convictionHistoryCoreScores
        .map(([key, label]) => ({
          label,
          value: snapshotScore(current, key),
        }))
        .filter((score) => typeof score.value === "number")
        .sort((left, right) => (left.value || 0) - (right.value || 0))[0]
    : null;
  const measuredReplayExplanation =
    comparison
      ? buildConvictionReplayExplanation({
          comparison,
          drivers:
            comparison.direction === "decreased"
              ? allNegativeDrivers
              : allPositiveDrivers,
        })
      : "";

  if (!tokenAddress) {
    return (
      <SectionShell
        eyebrow="Conviction History"
        title="Explainable Conviction Replay"
        description="A forensic timeline built only from successful stored conviction snapshots."
      >
        <HistoryEmptyState text="Select a token to begin storing real conviction snapshots for this runtime session." />
      </SectionShell>
    );
  }

  if (!current) {
    return (
      <SectionShell
        eyebrow="Conviction History"
        title={`${token} Conviction Replay`}
        description="A forensic timeline built only from successful stored conviction snapshots."
      >
        <HistoryEmptyState text="No successful Conviction Engine snapshot has been stored for this token yet." />
      </SectionShell>
    );
  }

  return (
    <SectionShell
      eyebrow="Conviction History"
      title={`${token} Conviction Replay`}
      description="Stored runtime snapshots only. No interpolation, generated events, or speculative narrative."
    >
      <div className="grid gap-4 xl:grid-cols-[0.88fr_1.12fr]">
        <section className="rounded-[2rem] border border-cyan-100/10 bg-cyan-100/[0.025] p-5 shadow-[0_0_70px_rgba(34,211,238,0.035)]">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-100/44">
            Conviction Timeline
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <HistoryStat label="Current Conviction" value={current.finalConvictionScore} />
            <HistoryStat
              label="Change"
              value={comparison ? signedHistoryDelta(comparison.scoreDelta) : "Baseline"}
              tone={comparison ? historyDeltaClass(comparison.scoreDelta) : "text-white/55"}
            />
            <HistoryStat
              label="Previous"
              value={previous?.finalConvictionScore ?? "Unavailable"}
            />
            <HistoryStat
              label="Direction"
              value={
                comparison
                  ? historyDirectionLabel(comparison.direction)
                  : "Awaiting replay"
              }
            />
            <HistoryStat
              label="Magnitude"
              value={comparison ? comparison.magnitude : "Unavailable"}
            />
            <HistoryStat
              label="Confidence"
              value={
                current.dataConfidence?.score !== undefined
                  ? `${Math.round(current.dataConfidence.score)} · ${
                      current.dataConfidence.label || "Unlabeled"
                    }`
                  : current.dataConfidence?.label || "Unavailable"
              }
            />
            <HistoryStat
              label="Confidence Change"
              value={comparison ? comparison.confidenceShiftSummary : "Baseline"}
            />
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.025] p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-100/44">
            Score Evolution
          </p>
          <div className="mt-4 space-y-2">
            {[...snapshots].reverse().map((snapshot, reverseIndex) => {
              const snapshotIndex = snapshots.length - 1 - reverseIndex;
              const earlierSnapshot =
                snapshotIndex > 0 ? snapshots[snapshotIndex - 1] : null;
              const delta = earlierSnapshot
                ? snapshot.finalConvictionScore -
                  earlierSnapshot.finalConvictionScore
                : null;

              return (
              <div
                key={snapshot.snapshotId}
                className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/20 px-4 py-3"
              >
                <div>
                  <p className="text-sm text-white/66">
                    {formatSnapshotTime(snapshot.createdAt)}
                  </p>
                  <p className="mt-1 text-xs text-white/30">
                    {snapshot.dataConfidence?.label || "Confidence unavailable"} confidence
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-semibold tabular-nums text-cyan-50/82">
                    {snapshot.finalConvictionScore}
                  </p>
                  <p
                    className={`mt-1 text-xs tabular-nums ${historyDeltaClass(
                      delta
                    )}`}
                  >
                    {delta === null ? "Baseline" : signedHistoryDelta(delta)}
                  </p>
                </div>
              </div>
              );
            })}
          </div>
        </section>
      </div>

      {!comparison || !previous ? (
        <HistoryBaselineState current={current} />
      ) : (
        <>
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.025] p-5">
            <HistorySectionTitle
              eyebrow="Driver Analysis"
              title="Measured score movement"
              description="Core subscores sorted by absolute change between the latest two stored snapshots."
            />
            <div className="mt-4 grid gap-2">
              {coreDeltas.map((score) => (
                <HistoryEvolutionRow
                  key={score.key}
                  currentValue={score.currentValue}
                  delta={score.delta}
                  label={score.label}
                  previousValue={score.previousValue}
                />
              ))}
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <HistoryDriverList title="Top Positive Drivers" items={allPositiveDrivers} />
              <HistoryDriverList title="Top Negative Drivers" items={allNegativeDrivers} />
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <section className="rounded-[2rem] border border-cyan-100/10 bg-cyan-100/[0.025] p-5">
              <HistorySectionTitle
                eyebrow="Why Conviction Changed"
                title={measuredReplayExplanation}
                description="Explanation generated only from measured snapshot deltas."
              />
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <HistoryMeasuredList
                  title="Primary positive drivers"
                  items={positiveDrivers.map(
                    (score) => `${score.label} improved by ${score.delta} points.`
                  )}
                />
                <HistoryMeasuredList
                  title="Primary negative drivers"
                  items={negativeDrivers.map(
                    (score) => `${score.label} decreased by ${Math.abs(score.delta || 0)} points.`
                  )}
                />
              </div>
              <HistoryMeasuredList
                className="mt-3"
                title="Risk reductions"
                items={riskReductions.map(
                  (risk) =>
                    `${risk.label} decreased from ${risk.previousValue} to ${risk.currentValue}.`
                )}
              />
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.025] p-5">
              <HistorySectionTitle
                eyebrow="Confidence Evolution"
                title={comparison.confidenceShiftSummary}
                description="Confidence replay uses stored confidence scores and labels only."
              />
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <HistoryStat
                  label="Previous Confidence"
                  value={previous.dataConfidence?.score ?? previous.dataConfidence?.label ?? "Unavailable"}
                />
                <HistoryStat
                  label="Current Confidence"
                  value={current.dataConfidence?.score ?? current.dataConfidence?.label ?? "Unavailable"}
                />
              </div>
            </section>
          </div>

          <section className="rounded-[2rem] border border-white/10 bg-white/[0.025] p-5">
            <HistorySectionTitle
              eyebrow="Risk Evolution"
              title="Structural risk replay"
              description="Current versus previous stored risk values. Lower risk is favorable."
            />
            <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {riskDeltas.map((risk) => (
                <HistoryEvolutionRow
                  key={risk.key}
                  currentValue={risk.currentValue}
                  delta={risk.delta}
                  invert
                  label={risk.label}
                  previousValue={risk.previousValue}
                />
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-cyan-100/12 bg-cyan-100/[0.025] p-5 shadow-[0_0_80px_rgba(34,211,238,0.04)]">
            <HistorySectionTitle
              eyebrow="Conviction Forensics"
              title="Largest measured movements"
              description="A math-derived forensic summary of the latest replay interval."
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <ForensicCard
                label="Largest positive contribution"
                value={
                  positiveDrivers[0]
                    ? `${positiveDrivers[0].label} ${signedHistoryDelta(positiveDrivers[0].delta)}`
                    : "None"
                }
              />
              <ForensicCard
                label="Largest negative contribution"
                value={
                  negativeDrivers[0]
                    ? `${negativeDrivers[0].label} ${signedHistoryDelta(negativeDrivers[0].delta)}`
                    : "None"
                }
              />
              <ForensicCard
                label="Largest risk reduction"
                value={
                  riskReductions[0]
                    ? `${riskReductions[0].label} ${signedHistoryDelta(riskReductions[0].delta)}`
                    : "None"
                }
              />
              <ForensicCard
                label="Largest risk increase"
                value={
                  riskIncreases[0]
                    ? `${riskIncreases[0].label} ${signedHistoryDelta(riskIncreases[0].delta)}`
                    : "None"
                }
              />
              <ForensicCard
                label="Strongest current limiting factor"
                value={
                  currentLimiter
                    ? `${currentLimiter.label} ${currentLimiter.value}`
                    : "Unavailable"
                }
              />
            </div>
          </section>
          <p className="px-2 text-xs leading-relaxed text-white/28">
            Conviction History only compares stored runtime snapshots. No generated
            events or interpolated timeline points.
          </p>
        </>
      )}
    </SectionShell>
  );
}

function HistoryEmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.025] p-8 text-center">
      <p className="text-sm text-white/54">{text}</p>
      <p className="mt-2 text-xs text-white/30">
        Conviction History never creates synthetic events or interpolated timeline points.
      </p>
    </div>
  );
}

function HistoryBaselineState({ current }: { current: ConvictionSnapshot }) {
  return (
    <div className="rounded-[2rem] border border-cyan-100/10 bg-cyan-100/[0.025] p-6">
      <p className="text-xs uppercase tracking-[0.3em] text-cyan-100/44">
        Baseline Snapshot Stored
      </p>
      <p className="mt-3 text-lg font-semibold text-white/76">
        Current conviction is {current.finalConvictionScore}.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-white/48">
        Run another successful analysis later to unlock measured conviction replay.
      </p>
      <p className="mt-3 text-xs text-white/30">
        Conviction History only compares stored runtime snapshots. No generated
        events or interpolated timeline points.
      </p>
    </div>
  );
}

function HistoryStat({
  label,
  tone = "text-white/76",
  value,
}: {
  label: string;
  tone?: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
      <p className="text-xs uppercase tracking-[0.18em] text-white/32">{label}</p>
      <p className={`mt-2 text-lg font-semibold capitalize tabular-nums ${tone}`}>
        {value}
      </p>
    </div>
  );
}

function HistorySectionTitle({
  description,
  eyebrow,
  title,
}: {
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.3em] text-cyan-100/44">{eyebrow}</p>
      <h3 className="mt-2 text-lg font-semibold tracking-[-0.035em] text-white/78">
        {title}
      </h3>
      <p className="mt-2 text-xs leading-relaxed text-white/34">{description}</p>
    </div>
  );
}

function HistoryEvolutionRow({
  currentValue,
  delta,
  invert = false,
  label,
  previousValue,
}: {
  currentValue: number | null;
  delta: number | null;
  invert?: boolean;
  label: string;
  previousValue: number | null;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-2xl border border-white/8 bg-black/18 px-4 py-3">
      <p className="text-sm text-white/58">{label}</p>
      <p className="text-sm tabular-nums text-white/52">
        {previousValue ?? "—"} <span className="px-1 text-white/20">→</span>{" "}
        {currentValue ?? "—"}
      </p>
      <p className={`w-12 text-right text-sm tabular-nums ${historyDeltaClass(delta, invert)}`}>
        {signedHistoryDelta(delta)}
      </p>
    </div>
  );
}

function HistoryDriverList({
  items,
  title,
}: {
  items: ConvictionReplayDriver[];
  title: string;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/18 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-white/34">{title}</p>
      <div className="mt-3 space-y-2">
        {items.length ? (
          items.slice(0, 4).map((item) => (
            <div key={`${item.kind}-${item.label}`} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-white/58">{item.label}</span>
                <span className={historyDeltaClass(item.delta, item.kind === "risk")}>
                  {item.previousValue ?? "—"}{" "}
                  <span className="text-white/20">→</span>{" "}
                  {item.currentValue ?? "—"}{" "}
                  <span className="ml-1 tabular-nums">
                    ({signedHistoryDelta(item.delta)})
                  </span>
                </span>
              </div>
              <p className="text-xs leading-relaxed text-white/30">{item.reason}</p>
            </div>
          ))
        ) : (
          <p className="text-xs text-white/28">None measured in this replay interval.</p>
        )}
      </div>
    </div>
  );
}

function HistoryMeasuredList({
  className = "",
  items,
  title,
}: {
  className?: string;
  items: string[];
  title: string;
}) {
  return (
    <div className={`rounded-2xl border border-white/8 bg-black/18 p-4 ${className}`}>
      <p className="text-xs uppercase tracking-[0.2em] text-white/34">{title}</p>
      <div className="mt-3 space-y-2">
        {items.length ? (
          items.slice(0, 4).map((item) => (
            <p key={item} className="text-sm leading-relaxed text-white/52">
              {item}
            </p>
          ))
        ) : (
          <p className="text-xs text-white/28">None measured in this replay interval.</p>
        )}
      </div>
    </div>
  );
}

function ForensicCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-white/32">{label}</p>
      <p className="mt-3 text-sm font-medium text-white/68">{value}</p>
    </div>
  );
}

function AIThesis({
  data,
  error,
  loadState,
  report,
  typedThesis,
}: {
  data: TokenIntelligenceData | null;
  error: string;
  loadState: HolderLoadState;
  report: ExplainableIntelligenceReport;
  typedThesis: string;
}) {
  const confidence =
    report.confidenceLabel || data?.thesis.confidenceLabel || "Pending";
  const observations = report.observations.length
    ? report.observations
    : data?.thesis.bullets || [];
  const riskNotes = report.riskNotes.length
    ? report.riskNotes
    : data?.thesis.riskNotes || [];

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-cyan-100/12 bg-cyan-100/[0.024] p-4 shadow-[0_0_80px_rgba(34,211,238,0.045)] backdrop-blur-2xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(180,240,255,0.09),transparent_42%)]" />

      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-100/45">
              Explainable Intelligence
            </p>
            <p className="mt-1 text-xs text-white/30">Token thesis report</p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs ${thesisConfidenceClass(confidence)}`}>
            {confidence} confidence
          </span>
        </div>

        {loadState === "idle" && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-sm font-medium text-white/68">
              Select a token to generate an explainable intelligence report.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-white/35">
              NovaOS will summarize holder distribution, wallet metadata and
              recent activity signals without claiming PnL, win rate or smart
              money identity.
            </p>
          </div>
        )}

        {loadState === "loading" && <ThesisReportSkeleton />}

        {loadState === "error" && (
          <div className="mt-4 rounded-2xl border border-red-100/10 bg-red-100/[0.035] p-4">
            <p className="text-sm font-medium text-red-100/68">
              Token intelligence report unavailable.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-red-100/50">
              {error || "Token intelligence summary could not be loaded."}
            </p>
          </div>
        )}

        {loadState === "loaded" && (data || report.thesisHeadline) && (
          <>
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/24 p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-100/70 shadow-[0_0_12px_rgba(180,240,255,0.65)]" />
                <p className="text-xs uppercase tracking-[0.22em] text-white/32">
                  Thesis headline
                </p>
              </div>
              <p className="min-h-[44px] text-sm leading-relaxed text-white/68">
                {typedThesis}
                <motion.span
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="ml-1 text-cyan-100"
                >
                  |
                </motion.span>
              </p>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <ThesisList
                items={observations.slice(0, 5)}
                title="Observations"
                tone="cyan"
              />
              <ThesisList
                items={riskNotes.slice(0, 4)}
                title="Risk notes"
                tone="amber"
              />
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <ReportMiniMetric
                label="Reliability"
                value={
                  report.metrics.reliability ?? data?.scores.reliabilityScore ?? 0
                }
              />
              <ReportMiniMetric
                label="Activity"
                value={report.metrics.activity ?? data?.scores.activityScore ?? 0}
              />
              <ReportMiniMetric
                label="Wallets"
                value={report.metrics.wallets ?? data?.analyzedWallets ?? 0}
              />
            </div>
          </>
        )}

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-xs text-white/35">
            <span>Methodology</span>
            <span>Explainable V2</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#022026] via-cyan-100/70 to-[#192638]"
              style={{
                width: `${Math.max(
                  8,
                  report.metrics.reliability ?? data?.scores.reliabilityScore ?? 18
                )}%`,
              }}
            />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-white/32">
            {report.methodology}
          </p>
        </div>
      </div>
    </div>
  );
}

function MantleEcosystemContextPanel({
  mantleContext,
}: {
  mantleContext: MantleContext;
}) {
  return (
    <section className="mt-4 overflow-hidden rounded-[2rem] border border-cyan-100/10 bg-cyan-100/[0.025] p-4 shadow-[0_0_80px_rgba(34,211,238,0.045)] backdrop-blur-2xl">
      <div className="pointer-events-none absolute inset-0" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-100/45">
              Mantle Mode
            </p>
            <span className="rounded-full border border-cyan-100/10 bg-cyan-100/[0.045] px-3 py-1 text-xs text-cyan-100/62">
              {mantleContext.isMantleAsset
                ? "Active Mantle asset"
                : "Manual preview"}
            </span>
          </div>
          <h3 className="mt-3 text-xl font-semibold tracking-[-0.05em] text-white/82">
            Mantle-native analysis layer
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-white/40">
            NovaOS is prepared to apply holder intelligence, wallet behavior and
            cluster inference to Mantle ecosystem assets. Mantle-specific DeFi
            metrics are not live yet.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:w-[34rem]">
          <MantleContextList
            items={mantleContext.currentCapabilities}
            title="Current capabilities"
          />
          <MantleContextList
            items={mantleContext.plannedIntegrations}
            title="Planned integrations"
          />
        </div>
      </div>
    </section>
  );
}

function MantleContextList({
  items,
  title,
}: {
  items: string[];
  title: string;
}) {
  const isPlanned = title.toLowerCase().includes("planned");

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <p className="text-xs text-white/35">{title}</p>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-2 text-xs text-white/48">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-100/55 shadow-[0_0_10px_rgba(180,240,255,0.36)]" />
            <span>
              {item}
              {isPlanned && (
                <span className="ml-2 text-cyan-100/42">planned</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function VerifiedOnMantlePanel({
  decisionSnapshot,
  error,
  hasTokenIntelligence,
  loadState,
  onCreateSnapshot,
}: {
  decisionSnapshot: DecisionSnapshot | null;
  error: string;
  hasTokenIntelligence: boolean;
  loadState: HolderLoadState;
  onCreateSnapshot: () => void;
}) {
  return (
    <section className="mt-4 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] p-4 backdrop-blur-2xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-100/45">
              Verified on Mantle
            </p>
            <span className="rounded-full border border-amber-100/12 bg-amber-100/[0.045] px-3 py-1 text-xs text-amber-100/62">
              Local preview
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/40">
            Create a deterministic local decision snapshot from the current
            token intelligence scores. Not submitted on-chain yet; Mantle
            verification layer planned.
          </p>
        </div>

        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            disabled={!hasTokenIntelligence || loadState === "loading"}
            onClick={onCreateSnapshot}
            className="rounded-full border border-cyan-100/12 bg-cyan-100/[0.045] px-4 py-2 text-xs text-cyan-100/66 transition hover:bg-cyan-100/[0.075] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loadState === "loading" ? "Creating preview..." : "Create snapshot"}
          </button>
          <span className="text-xs text-white/30">
            {hasTokenIntelligence
              ? "On-chain verification planned"
              : "Token intelligence required"}
          </span>
        </div>
      </div>

      {(decisionSnapshot || loadState === "error") && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
          {loadState === "error" && (
            <p className="text-xs leading-relaxed text-red-100/60">
              {error || "Decision snapshot could not be created."}
            </p>
          )}

          {decisionSnapshot && (
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="font-mono text-sm text-cyan-100/70">
                  {shortHash(decisionSnapshot.snapshotHash)}
                </p>
                <p className="mt-1 text-xs text-white/32">
                  Snapshot status: local preview · Verification: not submitted
                  on-chain yet
                </p>
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-xs text-white/45">
                Mantle contract not deployed yet
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ThesisList({
  items,
  title,
  tone,
}: {
  items: string[];
  title: string;
  tone: "cyan" | "amber";
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <p className="text-xs text-white/35">{title}</p>
      <ul className="mt-2 space-y-2 text-xs leading-relaxed text-white/50">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span
              className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                tone === "cyan"
                  ? "bg-cyan-100/60 shadow-[0_0_10px_rgba(180,240,255,0.45)]"
                  : "bg-amber-100/55 shadow-[0_0_10px_rgba(253,230,138,0.28)]"
              }`}
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ThesisReportSkeleton() {
  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-2xl border border-white/10 bg-black/24 p-4">
        <SkeletonLine className="h-3 w-36" />
        <SkeletonLine className="mt-4 h-2 w-full" />
        <SkeletonLine className="mt-2 h-2 w-5/6" />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-white/10 bg-black/20 p-3"
          >
            <SkeletonLine className="h-2 w-24" />
            <SkeletonLine className="mt-3 h-2 w-full" />
            <SkeletonLine className="mt-2 h-2 w-4/5" />
            <SkeletonLine className="mt-2 h-2 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportMiniMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
      <p className="text-xs text-white/30">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white/75">{value}</p>
    </div>
  );
}

function thesisConfidenceClass(confidence: string) {
  if (confidence === "High") {
    return "border-emerald-100/15 bg-emerald-100/[0.05] text-emerald-100/68";
  }

  if (confidence === "Medium") {
    return "border-cyan-100/12 bg-cyan-100/[0.045] text-cyan-100/66";
  }

  if (confidence === "Low") {
    return "border-amber-100/14 bg-amber-100/[0.045] text-amber-100/62";
  }

  return "border-white/10 bg-white/[0.035] text-white/45";
}

function ConvictionRing({
  compact = false,
  confidenceLabel,
  score,
  state,
}: {
  compact?: boolean;
  confidenceLabel?: string;
  score: number;
  state: HolderLoadState;
}) {
  const isLoaded = state === "loaded";
  const displayScore = isLoaded ? String(score) : "—";

  const cardMinHeight = compact ? "min-h-[420px]" : "min-h-[250px]";
  const ringSize = compact ? "h-64 w-64" : "h-44 w-44";
  const scoreSize = compact ? "text-5xl" : "text-5xl";
  const cardClass = compact
    ? "relative overflow-hidden rounded-[2rem] border border-cyan-100/10 bg-black/12 p-4 shadow-[0_0_80px_rgba(34,211,238,0.045)] backdrop-blur-2xl"
    : "relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] p-4 backdrop-blur-2xl";

  return (
    <div className={cardClass}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_44%,rgba(1,44,59,0.42),transparent_62%)]" />
      <div className={`relative flex h-full ${cardMinHeight} flex-col items-center justify-center text-center`}>
        <div className={`relative flex ${ringSize} items-center justify-center`}>
          <div className="absolute -inset-10 rounded-full bg-cyan-900/20 blur-[70px]" />
          <div className="absolute inset-0 rounded-full border border-cyan-100/14 bg-[radial-gradient(circle_at_34%_28%,rgba(175,235,255,0.16),rgba(1,44,59,0.42)_42%,rgba(2,4,7,0.92)_76%)] shadow-[0_0_90px_rgba(56,189,248,0.12)]" />

          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: compact ? 28 : 22, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 rounded-full"
          >
            <div className="absolute inset-4 rounded-full border border-cyan-100/12" />
            <div className="absolute inset-10 rounded-full border border-white/8" />
            <div className="absolute left-1/2 top-1/2 h-[1px] w-[135%] -translate-x-1/2 -translate-y-1/2 rotate-12 bg-gradient-to-r from-transparent via-cyan-100/20 to-transparent" />
            <div className="absolute left-1/2 top-1/2 h-[1px] w-[128%] -translate-x-1/2 -translate-y-1/2 -rotate-12 bg-gradient-to-r from-transparent via-purple-200/14 to-transparent" />
          </motion.div>

          <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 176 176">
            <circle
              cx="88"
              cy="88"
              r="72"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="6"
              fill="transparent"
            />
            {isLoaded ? (
              <motion.circle
                cx="88"
                cy="88"
                r="72"
                stroke="rgba(180,240,255,0.95)"
                strokeWidth="6"
                fill="transparent"
                strokeLinecap="round"
                strokeDasharray={452}
                initial={{ strokeDashoffset: 452 }}
                animate={{ strokeDashoffset: 452 - (452 * score) / 100 }}
                transition={{ duration: 1.8, ease: "easeOut" }}
              />
            ) : (
              <circle
                cx="88"
                cy="88"
                r="72"
                stroke="rgba(180,240,255,0.22)"
                strokeWidth="6"
                fill="transparent"
                strokeLinecap="round"
                strokeDasharray={452}
                strokeDashoffset={452}
              />
            )}
          </svg>

          <div className="relative z-10">
            <p className={`${scoreSize} font-semibold tracking-[-0.08em]`}>
              {displayScore}
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.3em] text-cyan-100/45">
              Conviction
            </p>
          </div>
        </div>

        <p className="mt-2 max-w-[14rem] text-xs font-light leading-relaxed text-white/36">
          {compact
            ? `${confidenceLabel || "Pending"} confidence`
            : `Token-level score inferred from holder quality, activity, reliability and dormancy. ${
                confidenceLabel || "Pending"
              } confidence.`}
        </p>
      </div>
    </div>
  );
}

function OverviewScoreStrip({
  scores,
  state,
}: {
  scores: ExplainableConvictionData["subScores"] | null;
  state: HolderLoadState;
}) {
  const items = [
    ["Holder Integrity", scores?.holderIntegrity],
    ["Wallet Quality", scores?.walletQuality],
    ["Behavior Stability", scores?.behaviorStability],
    ["Liquidity Trust", scores?.liquidityTrust],
    ["Market Momentum", scores?.marketMomentum],
    ["Risk Protection", scores?.riskProtection],
  ] as const;
  const isPending = state === "loading" || !scores;

  return (
    <div className="grid h-full min-h-[420px] grid-cols-2 grid-rows-3 gap-3">
      {items.map(([title, score]) => (
        <OverviewScoreOrb
          key={title}
          pending={isPending}
          score={typeof score === "number" ? score : null}
          title={title}
        />
      ))}
    </div>
  );
}

function OverviewScoreOrb({
  pending,
  score,
  title,
}: {
  pending?: boolean;
  score: number | null;
  title: string;
}) {
  return (
    <div className="relative flex min-h-[130px] flex-col items-center justify-center overflow-hidden rounded-[1.5rem] border border-cyan-100/10 bg-black/10 p-3 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(1,44,59,0.34),transparent_64%)]" />
      <div className="pointer-events-none absolute h-20 w-20 rounded-full bg-cyan-900/18 blur-3xl" />

      <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-cyan-100/12 bg-[radial-gradient(circle_at_34%_28%,rgba(175,235,255,0.12),rgba(1,44,59,0.42)_42%,rgba(2,4,7,0.92)_76%)] shadow-[0_0_48px_rgba(56,189,248,0.08)]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 rounded-full"
        >
          <div className="absolute inset-3 rounded-full border border-cyan-100/10" />
          <div className="absolute left-1/2 top-1/2 h-[1px] w-[130%] -translate-x-1/2 -translate-y-1/2 rotate-12 bg-gradient-to-r from-transparent via-cyan-100/16 to-transparent" />
        </motion.div>

        <div className="relative z-10 text-center">
          <p className="text-2xl font-medium tracking-[-0.06em] text-white/90 drop-shadow-[0_0_16px_rgba(180,240,255,0.24)]">
            {pending || score === null ? "—" : score}
          </p>
        </div>
      </div>

      <p className="relative z-10 mt-2 max-w-[7.5rem] truncate text-center text-[0.68rem] font-light text-white/62">
        {title}
      </p>
    </div>
  );
}

function RiskRadar() {
  return (
    <Panel title="Insider Risk Radar" tag="Estimated">
      <p className="rounded-2xl border border-white/10 bg-black/20 p-3 text-xs leading-relaxed text-white/35">
        Holder Intelligence V1 can estimate concentration from ownership
        percentages, but deployer proximity and linked-wallet clustering are not
        live yet.
      </p>
    </Panel>
  );
}

function ConvictionInterpretationPanel({
  tokenIntelligence,
  loadState,
}: {
  tokenIntelligence: TokenIntelligenceData | null;
  loadState: HolderLoadState;
}) {
  return (
    <Panel title="Conviction Interpretation" tag="Explainable">
      <div className="space-y-3">
        {loadState === "loading" && <WalletBehaviorPreviewSkeleton />}
        {loadState === "error" && (
          <BehaviorPreviewState tone="error">
            Token intelligence is unavailable. Conviction interpretation will
            return when holder distribution and wallet metadata load.
          </BehaviorPreviewState>
        )}
        {loadState !== "loading" && loadState !== "error" && (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              <BehaviorMetric
                label="Reliability"
                value={tokenIntelligence?.scores.reliabilityScore ?? "Pending"}
              />
              <BehaviorMetric
                label="Analyzed Wallets"
                value={tokenIntelligence?.analyzedWallets ?? "Pending"}
              />
              <BehaviorMetric
                label="Dormancy Risk"
                value={
                  tokenIntelligence?.behaviorSummary.averageDormancyRisk ??
                  "Pending"
                }
              />
              <BehaviorMetric
                label="Dominant Behavior"
                value={
                  tokenIntelligence?.behaviorSummary.dominantBehaviorClass ||
                  "Pending"
                }
              />
            </div>
            <p className="rounded-2xl border border-cyan-100/10 bg-cyan-100/[0.025] p-3 text-xs leading-relaxed text-white/35">
              Conviction is inferred from holder distribution, wallet metadata,
              activity and reliability. It is not a price forecast.
            </p>
          </>
        )}
      </div>
    </Panel>
  );
}

function ExplainableConvictionEnginePanel({
  data,
  error,
  loadState,
}: {
  data: ExplainableConvictionData | null;
  error: string;
  loadState: HolderLoadState;
}) {
  const contributionWeights = [
    ["Holder Integrity", 22],
    ["Wallet Quality", 18],
    ["Behavior Stability", 18],
    ["Liquidity Trust", 15],
    ["Market Momentum", 12],
    ["Risk Protection", 15],
  ] as const;

  const primarySubScores: Array<[string, number]> = data
    ? [
        ["Holder Integrity", data.subScores.holderIntegrity],
        ["Wallet Quality", data.subScores.walletQuality],
        ["Behavior Stability", data.subScores.behaviorStability],
        ["Liquidity Trust", data.subScores.liquidityTrust],
        ["Market Momentum", data.subScores.marketMomentum],
        ["Risk Protection", data.subScores.riskProtection],
      ]
    : [];

  const riskSubScores: Array<[string, number]> = data
    ? [
        ["Insider Risk", data.subScores.insiderRisk],
        ["Cluster Risk", data.subScores.clusterRisk],
        ["Bot Activity Risk", data.subScores.botActivityRisk],
        ["Rotation Risk", data.subScores.rotationRisk],
        ["Fresh Wallet Risk", data.subScores.freshWalletRisk],
      ]
    : [];

  const allWarnings = data
    ? [
        ...data.mapperWarnings,
        ...data.warnings,
        ...data.dataConfidence.warnings,
      ].filter(Boolean)
    : [];

  return (
    <Panel title="Explainable Conviction Engine" tag="V1 deterministic">
      {loadState === "idle" && (
        <BehaviorPreviewState>
          Select a token to run Explainable Conviction.
        </BehaviorPreviewState>
      )}

      {loadState === "loading" && <ExplainableConvictionSkeleton />}

      {loadState === "error" && (
        <BehaviorPreviewState tone="error">
          {error || "Explainable Conviction is unavailable right now."}
        </BehaviorPreviewState>
      )}

      {loadState === "loaded" && data && (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
            <div className="rounded-3xl border border-cyan-100/10 bg-cyan-100/[0.025] p-4 shadow-[0_0_40px_rgba(103,232,249,0.06)]">
              <p className="text-[0.64rem] uppercase tracking-[0.22em] text-cyan-100/45">
                Final conviction
              </p>
              <div className="mt-4 flex items-end gap-2">
                <p className="text-6xl font-light tracking-[-0.06em] text-white">
                  {Math.round(data.finalConvictionScore)}
                </p>
                <p className="pb-2 text-sm text-white/35">/100</p>
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-cyan-100/65 shadow-[0_0_16px_rgba(180,240,255,0.38)]"
                  style={{
                    width: `${normalizeScore(data.finalConvictionScore)}%`,
                  }}
                />
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                <BehaviorMetric
                  label="Data confidence"
                  value={`${data.dataConfidence.label} ${Math.round(
                    data.dataConfidence.score
                  )}`}
                />
                <BehaviorMetric
                  label="Engine status"
                  value={data.status === "live" ? "Live input" : "Partial input"}
                />
              </div>
              <p className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs leading-relaxed text-white/35">
                Deterministic behavioral inference only. No PnL, win rate,
                smart-money identity or price prediction.
              </p>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/38">
                  Core subscores
                </p>
                <div className="mt-4 space-y-3">
                  {primarySubScores.map(([label, score]) => (
                    <ConvictionScoreBar
                      key={label}
                      label={label}
                      score={score}
                    />
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/38">
                  Risk subscores
                </p>
                <div className="mt-4 space-y-3">
                  {riskSubScores.map(([label, score]) => (
                    <ConvictionScoreBar
                      key={label}
                      label={label}
                      score={score}
                      tone="risk"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white/38">
                Score contribution
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {contributionWeights.map(([label, weight]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-white/10 bg-white/[0.025] p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-white/58">{label}</p>
                      <p className="font-mono text-xs text-cyan-100/60">
                        {weight}%
                      </p>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/8">
                      <div
                        className="h-full rounded-full bg-cyan-100/45"
                        style={{ width: `${weight * 3.25}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-cyan-100/10 bg-cyan-100/[0.025] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white/38">
                Engine explanation
              </p>
              <p className="mt-3 text-base leading-relaxed text-white/78">
                {data.explanation.headline}
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <ConvictionExplanationList
                  title="Positives"
                  items={data.explanation.positives}
                />
                <ConvictionExplanationList
                  title="Negatives"
                  items={data.explanation.negatives}
                />
                <ConvictionExplanationList
                  title="Risk notes"
                  items={data.explanation.riskNotes}
                />
              </div>
              <p className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs leading-relaxed text-white/35">
                {data.explanation.methodology}
              </p>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white/38">
                Mapper coverage
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <BehaviorMetric
                  label="Holders"
                  value={data.mapperCoverage.holderCount}
                />
                <BehaviorMetric
                  label="Wallet profiles"
                  value={data.mapperCoverage.walletProfileCount}
                />
                <BehaviorMetric
                  label="Market data"
                  value={data.mapperCoverage.hasMarketData ? "Available" : "Limited"}
                />
                <BehaviorMetric
                  label="Cluster data"
                  value={data.mapperCoverage.hasClusterData ? "Available" : "Limited"}
                />
                <BehaviorMetric
                  label="Token transfers"
                  value={
                    data.mapperCoverage.hasTokenTransferData
                      ? "Available"
                      : "Pending"
                  }
                />
                <BehaviorMetric
                  label="Wallet coverage"
                  value={`${Math.round(data.aggregation.dataCoverage)}%`}
                />
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white/38">
                Warnings and limits
              </p>
              <div className="mt-4 space-y-2">
                {(allWarnings.length ? allWarnings : [
                  "No additional engine warnings for the current response.",
                ]).map((warning) => (
                  <div
                    key={warning}
                    className="rounded-2xl border border-white/10 bg-white/[0.025] p-3 text-xs leading-relaxed text-white/38"
                  >
                    {warning}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DeepWalletBehaviorPanel data={data.deepBehavior} />
          <DeepBehaviorImpactPanel data={data.deepBehaviorImpact} />
          <BundleFundingRiskPanel data={data.bundleDetection} />
        </div>
      )}
    </Panel>
  );
}

function BundleFundingRiskPanel({
  data,
}: {
  data: NonNullable<ExplainableConvictionData["bundleDetection"]> | undefined;
}) {
  if (!data) {
    return (
      <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-white/38">
          Bundle & Funding Risk
        </p>
        <p className="mt-3 text-xs leading-relaxed text-white/35">
          Bundle detection appears when deep transfer enrichment is available.
        </p>
      </div>
    );
  }

  const metrics = [
    ["Bundle risk", data.bundleRiskScore],
    ["Funding similarity", data.fundingSimilarityScore],
    ["Same-window", data.sameWindowActivityScore],
    ["Fresh wallets", data.freshWalletClusterScore],
    ["Fake decentralization", data.fakeDecentralizationRisk],
  ] as const;

  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-white/38">
            Bundle & Funding Risk
          </p>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-white/36">
            Bundle detection is inference-based and does not prove shared
            ownership, insider identity or coordinated control.
          </p>
        </div>
        <span className="rounded-full border border-cyan-100/14 bg-cyan-100/[0.045] px-3 py-1 text-xs text-cyan-50/62">
          {data.riskLevel} risk
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {metrics.map(([label, value]) => (
          <BehaviorMetric key={label} label={label} value={value} />
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="grid gap-3 sm:grid-cols-2">
          <ConvictionExplanationList title="Positives" items={data.positives} />
          <ConvictionExplanationList title="Negatives" items={data.negatives} />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-white/36">
            Detected groups
          </p>
          <div className="mt-3 space-y-2">
            {(data.detectedGroups.length ? data.detectedGroups : [
              {
                groupId: "none",
                wallets: [],
                reason: "No strong bundle-like group detected.",
                confidence: "Low" as const,
                riskScore: 0,
              },
            ]).slice(0, 4).map((group) => (
              <div
                key={group.groupId}
                className="rounded-2xl border border-white/10 bg-black/20 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-white/62">{group.reason}</p>
                  <span className="font-mono text-xs text-cyan-100/55">
                    {group.riskScore}
                  </span>
                </div>
                <p className="mt-2 text-xs text-white/32">
                  {group.wallets.length
                    ? group.wallets.join(", ")
                    : "No grouped wallets"}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {data.warnings.length > 0 && (
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {data.warnings.slice(0, 4).map((warning) => (
            <p
              key={warning}
              className="rounded-2xl border border-white/10 bg-white/[0.018] p-3 text-xs leading-relaxed text-white/34"
            >
              {warning}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function DeepBehaviorImpactPanel({
  data,
}: {
  data: NonNullable<ExplainableConvictionData["deepBehaviorImpact"]> | undefined;
}) {
  if (!data) {
    return (
      <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-white/38">
          Deep Behavior Impact
        </p>
        <p className="mt-3 text-xs leading-relaxed text-white/35">
          Impact comparison appears when deep transfer enrichment is available.
        </p>
      </div>
    );
  }

  const directionClass =
    data.direction === "improved"
      ? "border-cyan-100/18 bg-cyan-100/[0.055] text-cyan-50/70"
      : data.direction === "weakened"
      ? "border-amber-100/18 bg-amber-100/[0.055] text-amber-50/70"
      : "border-white/12 bg-white/[0.035] text-white/56";
  const subscoreDeltas = [
    ["Holder integrity", data.changedSubscores.holderIntegrityDelta],
    ["Wallet quality", data.changedSubscores.walletQualityDelta],
    ["Behavior stability", data.changedSubscores.behaviorStabilityDelta],
    ["Risk protection", data.changedSubscores.riskProtectionDelta],
    ["Bot risk", data.changedSubscores.botActivityRiskDelta],
    ["Rotation risk", data.changedSubscores.rotationRiskDelta],
  ] as const;

  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-white/38">
            Deep Behavior Impact
          </p>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-white/36">
            Impact compares baseline holder/profile scoring with
            token-transfer-enriched scoring. No PnL, win rate or prediction
            claims are included.
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs ${directionClass}`}>
          {data.direction}
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <BehaviorMetric
          label="Baseline"
          value={data.baselineConvictionScore}
        />
        <BehaviorMetric
          label="Enriched"
          value={data.enrichedConvictionScore}
        />
        <BehaviorMetric
          label="Delta"
          value={`${data.delta > 0 ? "+" : ""}${data.delta}`}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="grid gap-3 sm:grid-cols-2">
          <ConvictionExplanationList
            title="Positive drivers"
            items={data.strongestPositiveDrivers}
          />
          <ConvictionExplanationList
            title="Negative drivers"
            items={data.strongestNegativeDrivers}
          />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-white/36">
            Changed subscores
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {subscoreDeltas.map(([label, delta]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-black/20 px-3 py-2"
              >
                <span className="truncate text-xs text-white/45">{label}</span>
                <span
                  className={`font-mono text-xs tabular-nums ${
                    delta > 0
                      ? "text-cyan-100/70"
                      : delta < 0
                      ? "text-amber-100/70"
                      : "text-white/42"
                  }`}
                >
                  {delta > 0 ? "+" : ""}
                  {delta}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="grid grid-cols-[0.85fr_0.65fr_1.55fr_0.7fr_0.7fr] gap-3 px-3 py-2 text-[0.62rem] uppercase tracking-[0.16em] text-white/32">
          <span>Wallet</span>
          <span className="text-center">Impact</span>
          <span>Reason</span>
          <span className="text-center">Token</span>
          <span className="text-center">Bot</span>
        </div>
        {data.walletDrivers.slice(0, 5).map((driver) => (
          <div
            key={driver.walletAddress}
            className="grid grid-cols-[0.85fr_0.65fr_1.55fr_0.7fr_0.7fr] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.018] px-3 py-2"
          >
            <span className="truncate font-mono text-xs text-white/62">
              {driver.rank ? `#${driver.rank} ` : ""}
              {driver.shortAddress}
            </span>
            <span className="text-center text-xs capitalize text-white/48">
              {driver.impact}
            </span>
            <span className="text-xs leading-relaxed text-white/42">
              {driver.reason}
            </span>
            <span className="text-center font-mono text-xs tabular-nums text-cyan-100/64">
              {driver.tokenSpecificConvictionScore ?? "N/A"}
            </span>
            <span className="text-center font-mono text-xs tabular-nums text-white/52">
              {driver.botLikeActivityRisk ?? "N/A"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DeepWalletBehaviorPanel({
  data,
}: {
  data: NonNullable<ExplainableConvictionData["deepBehavior"]> | undefined;
}) {
  if (!data) {
    return (
      <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-white/38">
          Deep Wallet Behavior
        </p>
        <p className="mt-3 text-xs leading-relaxed text-white/35">
          Deep transfer analysis is unavailable for this response. Standard
          conviction remains active.
        </p>
      </div>
    );
  }

  const summaryMetrics = [
    ["Analyzed wallets", data.summary.analyzedWallets],
    ["Avg token conviction", data.summary.averageTokenSpecificConviction],
    ["Avg behavior quality", data.summary.averageWalletBehaviorQuality],
    ["Avg bot risk", data.summary.averageBotLikeActivityRisk],
    ["Avg rotation risk", data.summary.averageRotationBehaviorRisk],
    ["Avg short-hold risk", data.summary.averageShortHoldRisk],
    ["Avg accumulation", data.summary.averageAccumulationPressure],
    ["Avg distribution", data.summary.averageDistributionPressure],
    ["High-risk wallets", data.summary.highRiskWalletCount],
    ["Low-data wallets", data.summary.lowDataWalletCount],
  ] as const;

  return (
    <div className="rounded-3xl border border-cyan-100/10 bg-cyan-100/[0.025] p-4 shadow-[0_0_40px_rgba(103,232,249,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-white/38">
            Deep Wallet Behavior
          </p>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-white/36">
            Deep behavior uses token transfer history and directional inference.
            This is not PnL analysis, not win-rate analysis, and DEX buy/sell
            semantics may be approximate when only transfer direction is
            available.
          </p>
        </div>
        <span className="rounded-full border border-cyan-100/14 bg-cyan-100/[0.045] px-3 py-1 text-xs text-cyan-50/62">
          {data.analyzedWallets} wallets
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {summaryMetrics.map(([label, value]) => (
          <BehaviorMetric key={label} label={label} value={value} />
        ))}
      </div>

      <div className="mt-4 space-y-2">
        <div className="grid grid-cols-[1.1fr_0.7fr_0.7fr_0.7fr_1.4fr] gap-3 px-3 py-2 text-[0.62rem] uppercase tracking-[0.16em] text-white/32">
          <span>Wallet</span>
          <span className="text-center">Conviction</span>
          <span className="text-center">Bot risk</span>
          <span className="text-center">Rotation</span>
          <span>Tags</span>
        </div>
        {data.walletResults.slice(0, 5).map((wallet) => (
          <div
            key={wallet.walletAddress}
            className="grid grid-cols-[1.1fr_0.7fr_0.7fr_0.7fr_1.4fr] items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2"
          >
            <span className="truncate font-mono text-xs text-white/68">
              {shortWalletAddress(wallet.walletAddress)}
            </span>
            <span className="text-center font-mono text-xs tabular-nums text-cyan-100/70">
              {wallet.tokenSpecificConvictionScore}
            </span>
            <span className="text-center font-mono text-xs tabular-nums text-white/58">
              {wallet.botLikeActivityRisk}
            </span>
            <span className="text-center font-mono text-xs tabular-nums text-white/58">
              {wallet.rotationBehaviorRisk}
            </span>
            <span className="flex flex-wrap gap-1">
              {wallet.behaviorTags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/10 bg-white/[0.025] px-2 py-1 text-[0.62rem] text-white/42"
                >
                  {tag}
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>

      {data.warnings.length > 0 && (
        <div className="mt-4 space-y-2">
          {data.warnings.map((warning) => (
            <p
              key={warning}
              className="rounded-2xl border border-white/10 bg-black/20 p-3 text-xs leading-relaxed text-white/34"
            >
              {warning}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function ConvictionScoreBar({
  label,
  score,
  tone = "default",
}: {
  label: string;
  score: number;
  tone?: "default" | "risk";
}) {
  const normalized = normalizeScore(score);
  const fillClass =
    tone === "risk"
      ? "bg-amber-100/55 shadow-[0_0_14px_rgba(251,191,36,0.22)]"
      : "bg-cyan-100/55 shadow-[0_0_14px_rgba(180,240,255,0.25)]";

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <p className="truncate text-xs text-white/52">{label}</p>
        <p className="font-mono text-xs tabular-nums text-white/68">
          {Math.round(score)}
        </p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
        <div
          className={`h-full rounded-full ${fillClass}`}
          style={{ width: `${normalized}%` }}
        />
      </div>
    </div>
  );
}

function ConvictionExplanationList({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <p className="text-xs uppercase tracking-[0.16em] text-white/38">
        {title}
      </p>
      <div className="mt-3 space-y-2">
        {(items.length ? items : ["No signal surfaced."]).map((item) => (
          <div key={item} className="flex gap-2 text-xs leading-relaxed">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-cyan-100/45" />
            <span className="text-white/38">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExplainableConvictionSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
        <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
          <SkeletonLine className="h-2 w-28" />
          <SkeletonLine className="mt-6 h-14 w-32" />
          <SkeletonLine className="mt-5 h-2 w-full" />
          <SkeletonLine className="mt-5 h-16 w-full" />
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {[0, 1].map((item) => (
            <div
              key={item}
              className="rounded-3xl border border-white/10 bg-black/20 p-4"
            >
              <SkeletonLine className="h-2 w-32" />
              <div className="mt-5 space-y-4">
                {[0, 1, 2, 3, 4].map((line) => (
                  <SkeletonLine key={line} className="h-2 w-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <SkeletonLine className="h-36 w-full rounded-3xl" />
    </div>
  );
}

function SyntheticTestLabPanel({
  allScenarioResults,
  onSelectScenario,
  scenarioResult,
  selectedScenario,
}: {
  allScenarioResults: ScenarioRunResult[];
  onSelectScenario: (scenario: ConvictionScenarioName) => void;
  scenarioResult: ScenarioRunResult;
  selectedScenario: ConvictionScenarioName;
}) {
  const keySubScores: Array<[string, number, "default" | "risk"]> = [
    ["Holder Integrity", scenarioResult.subScores.holderIntegrity, "default"],
    ["Wallet Quality", scenarioResult.subScores.walletQuality, "default"],
    ["Behavior Stability", scenarioResult.subScores.behaviorStability, "default"],
    ["Risk Protection", scenarioResult.subScores.riskProtection, "default"],
    ["Insider Risk", scenarioResult.subScores.insiderRisk, "risk"],
    ["Bot Risk", scenarioResult.subScores.botActivityRisk, "risk"],
    ["Rotation Risk", scenarioResult.subScores.rotationRisk, "risk"],
    ["Fresh Wallet Risk", scenarioResult.subScores.freshWalletRisk, "risk"],
  ];

  return (
    <Panel title="Synthetic Test Lab" tag="Calibration">
      <div className="space-y-4">
        <div className="rounded-2xl border border-cyan-100/10 bg-cyan-100/[0.025] p-3 text-xs leading-relaxed text-white/38">
          Synthetic calibration data. Not live market analysis. This lab lets
          NovaOS validate deterministic scoring behavior when provider quota or
          live data is unavailable.
        </div>

        <div className="flex flex-wrap gap-2">
          {allScenarioResults.map((scenario) => {
            const active = scenario.name === selectedScenario;
            return (
              <button
                key={scenario.name}
                onClick={() => onSelectScenario(scenario.name)}
                type="button"
                className={`rounded-full border px-3 py-2 text-xs transition ${
                  active
                    ? "border-cyan-100/30 bg-cyan-100/[0.08] text-cyan-50 shadow-[0_0_22px_rgba(103,232,249,0.12)]"
                    : "border-white/10 bg-black/20 text-white/42 hover:border-cyan-100/20 hover:text-white/70"
                }`}
              >
                {scenario.name}
              </button>
            );
          })}
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
          <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.64rem] uppercase tracking-[0.22em] text-cyan-100/45">
                  Selected scenario
                </p>
                <p className="mt-2 text-lg font-light text-white/82">
                  {scenarioResult.name}
                </p>
              </div>
              <SyntheticStatusBadge passed={scenarioResult.withinExpectedRange} />
            </div>
            <div className="mt-5 flex items-end gap-2">
              <p className="text-5xl font-light tracking-[-0.06em] text-white">
                {Math.round(scenarioResult.finalConvictionScore)}
              </p>
              <p className="pb-1.5 text-sm text-white/35">/100</p>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-cyan-100/60 shadow-[0_0_16px_rgba(180,240,255,0.3)]"
                style={{
                  width: `${normalizeScore(
                    scenarioResult.finalConvictionScore
                  )}%`,
                }}
              />
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              <BehaviorMetric
                label="Expected range"
                value={`${scenarioResult.expectedRange.min}-${scenarioResult.expectedRange.max}`}
              />
              <BehaviorMetric
                label="Confidence"
                value={`${scenarioResult.confidence.label} ${Math.round(
                  scenarioResult.confidence.score
                )}`}
              />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white/38">
                Key subscores
              </p>
              <div className="mt-4 space-y-3">
                {keySubScores.map(([label, score, tone]) => (
                  <ConvictionScoreBar
                    key={label}
                    label={label}
                    score={score}
                    tone={tone}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-cyan-100/10 bg-cyan-100/[0.025] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white/38">
                Scenario explanation
              </p>
              <p className="mt-3 text-sm leading-relaxed text-white/72">
                {scenarioResult.explanation.headline}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <ConvictionExplanationList
                  title="Positives"
                  items={scenarioResult.explanation.positives.slice(0, 3)}
                />
                <ConvictionExplanationList
                  title="Negatives"
                  items={scenarioResult.explanation.negatives.slice(0, 3)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.18em] text-white/38">
              All scenarios
            </p>
            <p className="text-xs text-white/30">
              Range validation for formula tuning
            </p>
          </div>
          <div className="space-y-1">
            <div className="grid grid-cols-[1.35fr_0.55fr_0.8fr_0.65fr] gap-3 px-3 py-2 text-[0.62rem] uppercase tracking-[0.16em] text-white/32">
              <span>Scenario</span>
              <span className="text-center">Score</span>
              <span className="text-center">Expected</span>
              <span className="text-right">Status</span>
            </div>
            {allScenarioResults.map((scenario) => (
              <button
                key={scenario.name}
                onClick={() => onSelectScenario(scenario.name)}
                type="button"
                className={`grid w-full grid-cols-[1.35fr_0.55fr_0.8fr_0.65fr] items-center gap-3 rounded-2xl border px-3 py-2 text-left transition ${
                  scenario.name === selectedScenario
                    ? "border-cyan-100/18 bg-cyan-100/[0.045]"
                    : "border-white/8 bg-white/[0.018] hover:border-cyan-100/14 hover:bg-cyan-100/[0.025]"
                }`}
              >
                <span className="truncate text-xs text-white/62">
                  {scenario.name}
                </span>
                <span className="text-center font-mono text-xs tabular-nums text-white/70">
                  {Math.round(scenario.finalConvictionScore)}
                </span>
                <span className="text-center font-mono text-xs tabular-nums text-white/42">
                  {scenario.expectedRange.min}-{scenario.expectedRange.max}
                </span>
                <span className="text-right">
                  <SyntheticStatusBadge compact passed={scenario.withinExpectedRange} />
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function SyntheticStatusBadge({
  compact = false,
  passed,
}: {
  compact?: boolean;
  passed: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border ${
        compact ? "px-2 py-1 text-[0.58rem]" : "px-3 py-1.5 text-xs"
      } ${
        passed
          ? "border-cyan-100/16 bg-cyan-100/[0.05] text-cyan-50/68"
          : "border-amber-100/18 bg-amber-100/[0.05] text-amber-50/68"
      }`}
    >
      {passed ? "Pass" : "Review"}
    </span>
  );
}

function SnapshotTimelinePlaceholder() {
  return (
    <Panel title="Decision Snapshot Timeline" tag="Planned">
      <div className="grid gap-3 md:grid-cols-3">
        {[
          ["Local snapshot", "Deterministic preview hash is available today."],
          ["Mantle submit", "On-chain decision record is planned."],
          ["Outcome review", "Future history will compare thesis and observed behavior."],
        ].map(([title, detail]) => (
          <div
            key={title}
            className="rounded-2xl border border-white/10 bg-black/20 p-3"
          >
            <p className="text-sm text-white/66">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-white/32">
              {detail}
            </p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function DevCacheStatusPanel({
  data,
  error,
  loadState,
  unifiedAnalysis,
  unifiedAnalysisError,
  unifiedAnalysisState,
}: {
  data: CacheStatusData | null;
  error: string;
  loadState: HolderLoadState;
  unifiedAnalysis: UnifiedTokenAnalysisData | null;
  unifiedAnalysisError: string;
  unifiedAnalysisState: HolderLoadState;
}) {
  const totalGets = data?.stats.totalGets || 0;
  const totalHits = data?.stats.totalHits || 0;
  const hitRate =
    totalGets > 0 ? Math.round((totalHits / Math.max(1, totalGets)) * 100) : 0;

  return (
    <Panel title="Dev Cache Status" tag="Debug">
      {loadState === "loading" && <WalletBehaviorPreviewSkeleton />}
      {loadState === "error" && (
        <BehaviorPreviewState tone="error">
          {error || "Cache status is unavailable."}
        </BehaviorPreviewState>
      )}
      {loadState !== "loading" && loadState !== "error" && (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <BehaviorMetric label="Hit rate" value={`${hitRate}%`} />
            <BehaviorMetric label="Hits" value={data?.stats.totalHits ?? 0} />
            <BehaviorMetric label="Misses" value={data?.stats.totalMisses ?? 0} />
            <BehaviorMetric
              label="Dedupes"
              value={data?.stats.inFlightDedupes ?? 0}
            />
            <BehaviorMetric
              label="Entries"
              value={data?.stats.entriesCount ?? 0}
            />
            <BehaviorMetric label="Sets" value={data?.stats.totalSets ?? 0} />
          </div>
          <p className="rounded-2xl border border-cyan-100/10 bg-cyan-100/[0.025] p-3 text-xs leading-relaxed text-white/35">
            Developer-only cache observability. Generated{" "}
            {data?.generatedAt
              ? new Date(data.generatedAt).toLocaleTimeString()
              : "pending"}
            . No secrets or full wallet addresses are exposed.
          </p>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-xs leading-relaxed text-white/35">
            <span className="text-white/55">Unified analysis:</span>{" "}
            {unifiedAnalysisState}
            {unifiedAnalysis?.modules && (
              <span>
                {" "}
                · holders {unifiedAnalysis.modules.holders?.status || "n/a"} ·
                profiles {unifiedAnalysis.modules.walletProfiles?.status || "n/a"} ·
                conviction {unifiedAnalysis.modules.conviction?.status || "n/a"} ·
                cache {unifiedAnalysis.cache?.hit ? "hit" : "miss"}
                {" "}· personalities{" "}
                {unifiedAnalysis.modules.walletPersonalities?.status || "n/a"}
              </span>
            )}
            {unifiedAnalysisError && (
              <span className="text-amber-100/60"> · {unifiedAnalysisError}</span>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}

function ClusterMethodologyPanel() {
  return (
    <Panel title="Relationship Methodology" tag="Conservative">
      <div className="space-y-3">
        {[
          ["Behavioral similarity", "Compares wallet age, activity cadence, dormancy and concentration."],
          ["Activity overlap", "Highlights timing and metadata overlap without claiming shared ownership."],
          ["Risk language", "Uses possible coordination and elevated risk only as conservative inference."],
        ].map(([title, detail]) => (
          <div
            key={title}
            className="rounded-2xl border border-white/10 bg-black/20 p-3"
          >
            <p className="text-sm text-white/66">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-white/32">
              {detail}
            </p>
          </div>
        ))}
        <p className="rounded-2xl border border-cyan-100/10 bg-cyan-100/[0.025] p-3 text-xs leading-relaxed text-white/35">
          Cluster Intelligence V1 does not identify insiders, same owners or
          profitability. It visualizes relationship inference only.
        </p>
      </div>
    </Panel>
  );
}

function WalletFlowSummaryPanel({
  behaviorPreview,
  holderLoadState,
  walletRows,
}: {
  behaviorPreview: WalletBehaviorPreviewData | null;
  holderLoadState: HolderLoadState;
  walletRows: WalletRow[];
}) {
  return (
    <Panel title="Flow Activity Summary" tag="Metadata">
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <BehaviorMetric
            label="Profiled Wallets"
            value={behaviorPreview?.summary.profiledWallets ?? "Pending"}
          />
          <BehaviorMetric
            label="Activity Velocity"
            value={behaviorPreview?.summary.averageActivityVelocity ?? "Pending"}
          />
          <BehaviorMetric
            label="Dormancy Risk"
            value={behaviorPreview?.summary.averageDormancyRisk ?? "Pending"}
          />
          <BehaviorMetric
            label="Holder Rows"
            value={holderLoadState === "loaded" ? walletRows.length : "Pending"}
          />
        </div>
        <p className="rounded-2xl border border-cyan-100/10 bg-cyan-100/[0.025] p-3 text-xs leading-relaxed text-white/35">
          Wallet Flows summarizes holder activity metadata. Transaction
          intelligence remains available in the wallet drawer after selecting a
          holder row.
        </p>
      </div>
    </Panel>
  );
}

function InsiderSummaryPanel({
  behaviorPreview,
  clusterData,
  tokenIntelligence,
}: {
  behaviorPreview: WalletBehaviorPreviewData | null;
  clusterData: WalletClusterData | null;
  tokenIntelligence: TokenIntelligenceData | null;
}) {
  const elevatedClusters =
    clusterData?.clusters.filter((cluster) => cluster.riskLevel === "Elevated")
      .length || 0;

  return (
    <Panel title="Insider Scan Summary" tag="Risk Inference">
      <div className="grid gap-2 sm:grid-cols-2">
        <BehaviorMetric
          label="Top 10 Ownership"
          value={tokenIntelligence?.holderSummary.top10Ownership || "Pending"}
        />
        <BehaviorMetric
          label="Whale Count"
          value={tokenIntelligence?.holderSummary.whaleCount ?? "Pending"}
        />
        <BehaviorMetric
          label="Dormancy Risk"
          value={behaviorPreview?.summary.averageDormancyRisk ?? "Pending"}
        />
        <BehaviorMetric
          label="Elevated Clusters"
          value={clusterData ? elevatedClusters : "Pending"}
        />
      </div>
      <p className="mt-3 rounded-2xl border border-cyan-100/10 bg-cyan-100/[0.025] p-3 text-xs leading-relaxed text-white/35">
        Insider Scan groups concentration and overlap signals. It does not
        confirm insider identity, common ownership or smart-money status.
      </p>
    </Panel>
  );
}

function SignalsConsensusArena({
  arena,
  tokenIntelligence,
}: {
  arena: ArenaResult;
  tokenIntelligence: TokenIntelligenceData | null;
}) {
  return (
    <SectionShell
      eyebrow="Signals"
      title="Consensus Arena Foundation"
      description="A future surface for human consensus versus machine conviction. Voting is not live yet."
    >
      <div className="grid gap-4 xl:grid-cols-[1fr_0.95fr]">
        <Panel title="Human Consensus" tag="Placeholder">
          <div className="grid gap-3 sm:grid-cols-2">
            <SentimentPlaceholder label="Bullish Sentiment" value="Pending" />
            <SentimentPlaceholder label="Bearish Sentiment" value="Pending" />
          </div>
          <p className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs leading-relaxed text-white/35">
            Community voting and sentiment history are planned. This section is
            intentionally placeholder-only.
          </p>
        </Panel>

        <Panel title="Machine Conviction" tag="Current">
          <div className="grid gap-3 sm:grid-cols-2">
            <BehaviorMetric
              label="AI Confidence"
              value={tokenIntelligence?.thesis.confidenceLabel || "Pending"}
            />
            <BehaviorMetric label="Arena Agreement" value={arena.agreementScore} />
          </div>
          <p className="mt-3 rounded-2xl border border-cyan-100/10 bg-cyan-100/[0.025] p-3 text-xs leading-relaxed text-white/35">
            Human consensus vs machine conviction is directional product
            scaffolding. It is not predictive and does not include real voting
            yet.
          </p>
        </Panel>
      </div>

      <Panel title="Future Arena History" tag="Planned">
        <div className="grid gap-3 md:grid-cols-3">
          {[
            "Consensus snapshots",
            "AI thesis checkpoints",
            "Mantle verification records",
          ].map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/55"
            >
              {item}
            </div>
          ))}
        </div>
      </Panel>
    </SectionShell>
  );
}

function SentimentPlaceholder({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs text-white/35">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.06em] text-white/78">
        {value}
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full w-1/3 rounded-full bg-cyan-100/20" />
      </div>
    </div>
  );
}

function PlaceholderSection({ section }: { section: TerminalSection }) {
  return (
    <SectionShell
      eyebrow={section}
      title={`${section} foundation`}
      description="This terminal section is reserved for a future focused workflow while the core intelligence systems remain available in the active modules."
    >
      <Panel title="Module Pending" tag="Planned">
        <p className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-relaxed text-white/38">
          {section} is intentionally a placeholder in this information
          architecture pass. No fake data has been added.
        </p>
      </Panel>
    </SectionShell>
  );
}

function OverviewTopHoldersTable({
  behaviorProfiles,
  loadState,
  onSelectWallet,
  onViewFull,
  personalityError,
  personalityLoadState,
  personalityPreviews,
  walletRows,
}: {
  behaviorProfiles: WalletBehaviorProfile[];
  loadState: HolderLoadState;
  onSelectWallet: (row: WalletRow, profile?: WalletBehaviorProfile) => void;
  onViewFull: () => void;
  personalityError: string;
  personalityLoadState: HolderLoadState;
  personalityPreviews: WalletPersonalityPreview[];
  walletRows: WalletRow[];
}) {
  const topRows = walletRows.slice(0, 10);
  const [copiedWallet, setCopiedWallet] = useState("");
  const profileByAddress = useMemo(() => {
    return new Map(
      behaviorProfiles.map((profile) => [
        profile.walletAddress.toLowerCase(),
        profile,
      ])
    );
  }, [behaviorProfiles]);
  const personalityByAddress = useMemo(() => {
    return new Map(
      personalityPreviews.map((personality) => [
        personality.walletAddress.toLowerCase(),
        personality,
      ])
    );
  }, [personalityPreviews]);

  function copyWalletAddress(address?: string) {
    if (!address) return;

    void navigator.clipboard.writeText(address);
    setCopiedWallet(address);
    window.setTimeout(() => setCopiedWallet(""), 1400);
  }

  return (
    <section className="mt-4 overflow-hidden rounded-[2rem] border border-white/10 bg-[#06080c]/88 p-4 shadow-[0_26px_90px_rgba(0,0,0,0.24)] backdrop-blur-2xl">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-cyan-100/40">
            Holder Intelligence
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-[-0.05em] text-white/88">
            Top 10 Holders
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-white/35">
            Live holder facts with V2 behavior shown only where profiled.
          </p>
        </div>
        <button
          type="button"
          onClick={onViewFull}
          className="w-fit rounded-full border border-cyan-100/12 bg-cyan-100/[0.045] px-4 py-2 text-xs text-cyan-100/66 transition hover:bg-cyan-100/[0.075]"
        >
          View full Top 100
        </button>
      </div>

      <div className="overflow-hidden rounded-[1.35rem] border border-white/10">
        <div className={`grid ${overviewHolderGridClass} gap-3 border-b border-white/10 bg-black/35 px-4 py-3 text-[10px] uppercase tracking-[0.1em] text-white/32`}>
          <span className="truncate">Rank</span>
          <span className="truncate">Wallet</span>
          <span className="truncate">Balance</span>
          <span className="truncate">Ownership</span>
          <span className="truncate text-center">V2 Behavior</span>
          <span className="truncate text-center">Personality</span>
          <span className="truncate text-center">Activity</span>
          <span className="truncate text-center">Dormancy</span>
          <span className="truncate text-center">Concentration</span>
          <span className="truncate text-center">Reliability</span>
        </div>

        <div className="max-h-[500px] overflow-y-auto overflow-x-hidden">
          {loadState === "idle" && (
            <CompactHolderState>
              Select a token to load real top holder rankings.
            </CompactHolderState>
          )}

          {loadState === "loading" && <OverviewTopHoldersSkeleton />}

          {loadState === "error" && (
            <CompactHolderState tone="error">
              Holder preview could not be loaded.
            </CompactHolderState>
          )}

          {loadState === "loaded" && topRows.length === 0 && (
            <CompactHolderState>
              No holder rows were returned for this token.
            </CompactHolderState>
          )}

          {topRows.map((row, index) => {
            const matchedProfile = row.fullAddress
              ? profileByAddress.get(row.fullAddress.toLowerCase())
              : undefined;
            const matchedPersonality = row.fullAddress
              ? personalityByAddress.get(row.fullAddress.toLowerCase())
              : undefined;

            return (
              <motion.div
                key={`${row.rank}-${row.fullAddress || row.wallet}-overview`}
                role="button"
                tabIndex={0}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.28,
                  delay: Math.min(index * 0.018, 0.14),
                }}
                onClick={() => onSelectWallet(row, matchedProfile)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectWallet(row, matchedProfile);
                  }
                }}
                className={`group grid ${overviewHolderGridClass} cursor-pointer items-center gap-3 border-b border-white/[0.055] px-4 py-2.5 text-left text-[13px] transition hover:bg-cyan-100/[0.025] focus:outline-none focus:ring-1 focus:ring-inset focus:ring-cyan-100/20`}
              >
                <span className="text-white/30">{row.rank}</span>
                <div className="min-w-0">
                  <WalletAddressCopy
                    address={row.fullAddress}
                    copied={copiedWallet === row.fullAddress}
                    fallback={row.wallet}
                    onCopy={copyWalletAddress}
                  />
                </div>
                <span className="truncate text-white/52">{row.balance}</span>
                <span className="font-medium text-cyan-100/68">
                  {row.ownershipPercentage}
                </span>
                <div className="flex justify-center">
                  <V2BehaviorBadge profile={matchedProfile} />
                </div>
                <div className="flex justify-center">
                  <PersonalityTableCell
                    isLoading={personalityLoadState === "loading" && row.rank <= 5}
                    isUnavailable={Boolean(personalityError)}
                    personality={matchedPersonality}
                  />
                </div>
                <ScoreCell centered value={matchedProfile?.activityVelocityScore} />
                <ScoreCell centered value={matchedProfile?.dormancyRiskScore} />
                <ScoreCell
                  centered
                  fallback={row.estimatedCluster || row.cluster}
                  value={matchedProfile?.concentrationRiskScore}
                />
                <ScoreCell centered value={matchedProfile?.behaviorReliabilityScore} />
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function OverviewTopHoldersSkeleton() {
  return (
    <div>
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className={`grid ${overviewHolderGridClass} items-center gap-2 border-b border-white/[0.055] px-4 py-2.5`}
        >
          <SkeletonLine className="h-3 w-5" />
          <div>
            <SkeletonLine className="h-3 w-28" />
            <SkeletonLine className="mt-2 h-2 w-44" />
          </div>
          <SkeletonLine className="h-3 w-12" />
          <SkeletonLine className="h-3 w-16" />
          <SkeletonLine className="h-6 w-24 rounded-full" />
          <SkeletonLine className="h-6 w-28 rounded-full" />
          <SkeletonLine className="h-3 w-7" />
          <SkeletonLine className="h-3 w-7" />
          <SkeletonLine className="h-3 w-7" />
          <SkeletonLine className="h-3 w-7" />
        </div>
      ))}
    </div>
  );
}

function WalletAddressCopy({
  address,
  copied,
  fallback,
  onCopy,
}: {
  address?: string;
  copied: boolean;
  fallback: string;
  onCopy: (address?: string) => void;
}) {
  const displayAddress = address ? shortWalletAddress(address) : fallback;

  return (
    <button
      type="button"
      disabled={!address}
      onClick={(event) => {
        event.stopPropagation();
        onCopy(address);
      }}
      className="group/address relative min-w-0 text-left disabled:cursor-default"
      title={address ? "Copy wallet address" : "Wallet address unavailable"}
    >
      <motion.span
        aria-hidden="true"
        animate={{ opacity: copied ? 1 : 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="pointer-events-none absolute -top-4 left-0 rounded-full border border-cyan-100/10 bg-cyan-100/[0.045] px-2 py-0.5 text-[9px] uppercase tracking-[0.16em] text-cyan-100/58 shadow-[0_0_18px_rgba(34,211,238,0.08)]"
      >
        Copied
      </motion.span>
      <span className="block truncate font-mono text-[13px] font-medium text-white/82 transition group-hover/address:text-cyan-100/82">
        {displayAddress}
      </span>
      {copied && (
        <span className="sr-only" aria-live="polite">
          Copied
        </span>
      )}
    </button>
  );
}

function CompactHolderState({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "error";
}) {
  return (
    <div className="flex min-h-[156px] items-center justify-center px-6 text-center">
      <p className={tone === "error" ? "text-sm text-red-100/60" : "text-sm text-white/38"}>
        {children}
      </p>
    </div>
  );
}

function TopHolderPreview({
  walletRows,
  loadState,
}: {
  walletRows: WalletRow[];
  loadState: HolderLoadState;
}) {
  const visibleRows = walletRows.slice(0, 3);

  return (
    <Panel title="Top Holder Preview">
      <div className="space-y-3">
        {loadState === "idle" && (
          <p className="rounded-2xl border border-white/10 bg-black/20 p-3 text-xs leading-relaxed text-white/35">
            Select a token to preview the largest real holders. Flow, PnL and
            hold-time intelligence are pending V2.
          </p>
        )}

        {loadState === "loading" && (
          <p className="rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-white/35">
            Loading holder intelligence...
          </p>
        )}

        {loadState === "error" && (
          <p className="rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-red-100/55">
            Holder preview unavailable.
          </p>
        )}

        {loadState === "loaded" && visibleRows.length === 0 && (
          <p className="rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-white/35">
            No holder rows returned for this token.
          </p>
        )}

        {visibleRows.map((row) => (
          <div
            key={row.fullAddress || row.wallet}
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 p-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm text-white/70">{row.wallet}</p>
              <p className="mt-1 text-xs text-white/32">
                {row.ownershipPercentage} ownership
              </p>
            </div>
            <p className="shrink-0 text-sm font-medium text-white/38">
              Pending V2
            </p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function AIHumanArenaPanel({
  arena,
  error,
  loadState,
}: {
  arena: ArenaResult;
  error: string;
  loadState: HolderLoadState;
}) {
  return (
    <Panel title="AI vs Human Arena" tag="Interpretation">
      <div className="space-y-3">
        {loadState === "idle" && (
          <BehaviorPreviewState>
            Select a token to compare AI thesis confidence with observed holder
            behavior patterns.
          </BehaviorPreviewState>
        )}

        {loadState === "loading" && <ArenaPanelSkeleton />}

        {loadState === "error" && (
          <BehaviorPreviewState tone="error">
            {error || "Arena comparison is unavailable for this token."}
          </BehaviorPreviewState>
        )}

        {loadState === "loaded" && (
          <>
            <div className="relative overflow-hidden rounded-2xl border border-cyan-100/10 bg-black/25 p-3 shadow-[0_0_28px_rgba(34,211,238,0.06)]">
              <motion.div
                animate={{ opacity: [0.12, 0.28, 0.12] }}
                transition={{
                  duration: 3.2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-cyan-100/45"
              />

              <div className="grid grid-cols-2 gap-3">
                <ArenaSide
                  label="AI Thesis"
                  score={arena.aiConfidenceScore}
                  tone="cyan"
                />
                <ArenaSide
                  label="Holder Behavior"
                  score={arena.holderBehaviorScore}
                  tone="purple"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-white/78">
                  {arena.verdict}
                </p>
                <span className={arenaConfidenceClass(arena.confidenceLabel)}>
                  {arena.confidenceLabel} confidence
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-white/38">
                {arena.explanation}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <BehaviorMetric label="Agreement" value={arena.agreementScore} />
              <BehaviorMetric
                label="Disagreement"
                value={arena.disagreementScore}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {arena.signals.slice(0, 4).map((signal) => (
                <span
                  key={signal}
                  className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[11px] text-white/42"
                >
                  {signal}
                </span>
              ))}
            </div>
          </>
        )}

        <p className="rounded-2xl border border-cyan-100/10 bg-cyan-100/[0.025] p-3 text-xs leading-relaxed text-white/35">
          Behavioral interpretation only. Not predictive, not financial advice,
          and not a claim about future price movement.
        </p>
      </div>
    </Panel>
  );
}

function ArenaSide({
  label,
  score,
  tone,
}: {
  label: string;
  score: number;
  tone: "cyan" | "purple";
}) {
  const glow =
    tone === "cyan"
      ? "bg-cyan-100/12 shadow-[0_0_22px_rgba(180,240,255,0.12)]"
      : "bg-purple-100/10 shadow-[0_0_22px_rgba(216,180,254,0.10)]";

  return (
    <div className="relative min-w-0 rounded-2xl border border-white/10 bg-white/[0.025] p-3">
      <div
        className={`pointer-events-none absolute right-3 top-3 h-10 w-10 rounded-full blur-xl ${glow}`}
      />
      <p className="relative text-xs text-white/35">{label}</p>
      <p className="relative mt-2 text-3xl font-semibold tracking-[-0.07em] text-white/86">
        {score}
      </p>
      <ArenaMeter value={score} tone={tone} />
    </div>
  );
}

function ArenaMeter({
  value,
  tone,
}: {
  value: number;
  tone: "cyan" | "purple";
}) {
  const fillClass =
    tone === "cyan"
      ? "bg-gradient-to-r from-cyan-100/35 to-cyan-100/70"
      : "bg-gradient-to-r from-purple-100/28 to-cyan-100/50";

  return (
    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className={`h-full rounded-full ${fillClass}`}
      />
    </div>
  );
}

function ArenaPanelSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-white/10 bg-black/20 p-3"
          >
            <SkeletonLine className="h-2 w-20" />
            <SkeletonLine className="mt-4 h-8 w-12" />
            <SkeletonLine className="mt-4 h-1.5 w-full" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
        <SkeletonLine className="h-3 w-36" />
        <SkeletonLine className="mt-3 h-2 w-full" />
        <SkeletonLine className="mt-2 h-2 w-3/4" />
      </div>
    </div>
  );
}

function arenaConfidenceClass(confidence: ArenaResult["confidenceLabel"]) {
  if (confidence === "High") {
    return "rounded-full border border-cyan-100/14 bg-cyan-100/[0.045] px-3 py-1 text-xs text-cyan-100/66";
  }

  if (confidence === "Medium") {
    return "rounded-full border border-amber-100/14 bg-amber-100/[0.045] px-3 py-1 text-xs text-amber-100/62";
  }

  return "rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-xs text-white/42";
}

function WalletBehaviorPreview({
  data,
  loadState,
  error,
}: {
  data: WalletBehaviorPreviewData | null;
  loadState: HolderLoadState;
  error: string;
}) {
  return (
    <Panel title="Wallet Behavior Preview" tag="V2 Preview">
      <div className="space-y-3">
        {loadState === "idle" && (
          <BehaviorPreviewState>
            Select a token to load a small real wallet activity preview.
          </BehaviorPreviewState>
        )}

        {loadState === "loading" && (
          <WalletBehaviorPreviewSkeleton />
        )}

        {loadState === "error" && (
          <BehaviorPreviewState tone="error">
            {error || "Wallet behavior preview is pending."}
          </BehaviorPreviewState>
        )}

        {loadState === "loaded" && (!data || data.profiles.length === 0) && (
          <BehaviorPreviewState>
            Wallet behavior preview is pending for this token.
          </BehaviorPreviewState>
        )}

        {loadState === "loaded" && data && data.profiles.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <BehaviorMetric
                label="Avg Wallet Age"
                value={formatBehaviorValue(data.summary.averageWalletAgeDays, "d")}
              />
              <BehaviorMetric
                label="Activity Velocity"
                value={data.summary.averageActivityVelocity ?? data.summary.averageActivityScore}
              />
              <BehaviorMetric
                label="Dormancy Risk"
                value={data.summary.averageDormancyRisk ?? 0}
              />
              <BehaviorMetric
                label="Reliability Avg"
                value={data.summary.reliabilityAverage ?? data.summary.averageDataConfidence}
              />
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-white/35">Dominant class</span>
                <span className="truncate text-cyan-100/70">
                  {data.summary.dominantBehaviorClass}
                </span>
              </div>
              <p className="mt-1 text-xs text-white/28">
                {data.summary.profiledWallets} wallets profiled ·{" "}
                {data.summary.goodProfiles} good · {data.summary.partialProfiles} partial
              </p>

              <div className="mt-3 flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-xs">
                <span className="text-white/30">Highest concentration risk</span>
                <span className="font-medium text-cyan-100/65">
                  {data.summary.highestConcentrationRisk ??
                    data.summary.highestConcentrationScore}
                </span>
              </div>
            </div>
          </>
        )}

        <p className="rounded-2xl border border-cyan-100/10 bg-cyan-100/[0.025] p-3 text-xs leading-relaxed text-white/35">
          Behavior inference from wallet activity metadata. PnL and win rate
          remain pending.
        </p>
      </div>
    </Panel>
  );
}

function ClusterIntelligencePanel({
  data,
  error,
  loadState,
}: {
  data: WalletClusterData | null;
  error: string;
  loadState: HolderLoadState;
}) {
  const topClusters =
    data?.clusters
      .filter((cluster) => cluster.relationshipType !== "Isolated")
      .slice(0, 3) || [];

  return (
    <Panel title="Cluster Intelligence" tag="V1 Inference">
      <div className="space-y-3">
        {loadState === "idle" && (
          <BehaviorPreviewState>
            Select a token to infer behavioral similarity across top holders.
          </BehaviorPreviewState>
        )}

        {loadState === "loading" && <ClusterPanelSkeleton />}

        {loadState === "error" && (
          <BehaviorPreviewState tone="error">
            {error || "Cluster intelligence could not be loaded."}
          </BehaviorPreviewState>
        )}

        {loadState === "loaded" && data && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <BehaviorMetric
                label="Analyzed wallets"
                value={data.networkSummary.totalAnalyzedWallets}
              />
              <BehaviorMetric
                label="Clustered"
                value={data.networkSummary.clusteredWallets}
              />
              <BehaviorMetric
                label="Isolated"
                value={data.networkSummary.isolatedWallets}
              />
              <BehaviorMetric
                label="Avg confidence"
                value={data.networkSummary.averageClusterConfidence}
              />
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-white/35">Dominant relationship</span>
                <span className="truncate text-cyan-100/68">
                  {data.networkSummary.dominantRelationshipType}
                </span>
              </div>
            </div>

            <ClusterMapPreview clusters={topClusters} loadState={loadState} />

            {topClusters.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3 text-xs leading-relaxed text-white/35">
                No strong behavioral similarity clusters were detected with the
                current conservative threshold.
              </div>
            ) : (
              <div className="space-y-2">
                {topClusters.map((cluster) => (
                  <ClusterCard key={cluster.clusterId} cluster={cluster} />
                ))}
              </div>
            )}
          </>
        )}

        <p className="rounded-2xl border border-cyan-100/10 bg-cyan-100/[0.025] p-3 text-xs leading-relaxed text-white/35">
          Cluster inference highlights behavioral similarity and activity
          overlap only. It does not indicate same owner, confirmed insider
          activity or profitability.
        </p>
      </div>
    </Panel>
  );
}

function ClusterCard({
  cluster,
}: {
  cluster: WalletClusterData["clusters"][number];
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm text-white/68">
            {cluster.relationshipType}
          </p>
          <p className="mt-1 text-xs text-white/30">
            {cluster.walletCount} wallets · {cluster.confidence} confidence
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs ${clusterRiskClass(cluster.riskLevel)}`}>
          {cluster.riskLevel}
        </span>
      </div>

      <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-white/36">
        {cluster.explanation}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {cluster.wallets.slice(0, 3).map((wallet) => (
          <span
            key={wallet.walletAddress}
            className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 font-mono text-[11px] text-white/42"
          >
            {wallet.shortAddress}
          </span>
        ))}
      </div>

      {cluster.sharedSignals.length > 0 && (
        <p className="mt-3 text-xs text-cyan-100/45">
          {cluster.sharedSignals.slice(0, 2).join(" · ")}
        </p>
      )}
    </div>
  );
}

function ClusterMapPreview({
  clusters,
  loadState,
}: {
  clusters: WalletClusterData["clusters"];
  loadState: HolderLoadState;
}) {
  const nodes = buildClusterMapNodes(clusters);

  if (loadState === "loading") {
    return (
      <div className="relative h-56 overflow-hidden rounded-2xl border border-white/10 bg-black/25 p-3">
        <SkeletonLine className="h-3 w-32" />
        <div className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-100/10 bg-cyan-100/[0.05]" />
        {Array.from({ length: 8 }).map((_, index) => (
          <SkeletonLine
            key={index}
            className="absolute h-5 w-5 rounded-full"
          />
        ))}
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-xs leading-relaxed text-white/35">
        Cluster Map Preview is pending. Visual inference appears when behavioral
        similarity clusters are detected.
      </div>
    );
  }

  return (
    <div className="relative h-56 overflow-hidden rounded-2xl border border-white/10 bg-black/25 p-3">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(180,240,255,0.06),transparent_58%)]" />
      <div className="relative z-10 flex items-center justify-between text-xs">
        <span className="text-white/35">Cluster Map Preview</span>
        <span className="text-cyan-100/45">Visual inference</span>
      </div>

      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100">
        {nodes.map((node) => (
          <line
            key={`line-${node.id}`}
            x1="50"
            y1="54"
            x2={node.x}
            y2={node.y}
            stroke={node.stroke}
            strokeOpacity="0.28"
            strokeWidth="0.5"
          />
        ))}
      </svg>

      <div className="absolute left-1/2 top-[54%] z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-cyan-100/20 bg-cyan-100/[0.06] shadow-[0_0_34px_rgba(180,240,255,0.16)]">
        <div className="h-8 w-8 rounded-full border border-cyan-100/20 bg-[#061317]" />
      </div>

      {nodes.map((node) => (
        <div
          key={node.id}
          title={`${node.wallet} · ${node.relationshipType}`}
          className={`absolute z-10 rounded-full border ${node.className}`}
          style={{
            height: node.size,
            left: `${node.x}%`,
            top: `${node.y}%`,
            transform: "translate(-50%, -50%)",
            width: node.size,
          }}
        />
      ))}

      <p className="absolute bottom-3 left-3 right-3 text-xs leading-relaxed text-white/30">
        Not proof of shared ownership. Nodes show possible behavioral
        similarity and activity overlap.
      </p>
    </div>
  );
}

function buildClusterMapNodes(clusters: WalletClusterData["clusters"]) {
  const positions = [
    [24, 32],
    [35, 22],
    [65, 22],
    [76, 34],
    [78, 66],
    [62, 78],
    [38, 78],
    [22, 63],
    [50, 18],
  ];
  let positionIndex = 0;

  return clusters.flatMap((cluster, clusterIndex) =>
    cluster.wallets.slice(0, 3).map((wallet, walletIndex) => {
      const position = positions[positionIndex % positions.length];
      positionIndex += 1;

      return {
        id: `${cluster.clusterId}-${wallet.walletAddress}`,
        className: clusterNodeClass(cluster.riskLevel),
        relationshipType: cluster.relationshipType,
        size: `${Math.max(13, 24 - clusterIndex * 3 - walletIndex * 2)}px`,
        stroke: clusterNodeStroke(cluster.riskLevel),
        wallet: wallet.shortAddress,
        x: position[0],
        y: position[1],
      };
    })
  );
}

function clusterNodeClass(riskLevel: "Low" | "Medium" | "Elevated") {
  if (riskLevel === "Elevated") {
    return "border-red-100/24 bg-red-100/[0.14] shadow-[0_0_22px_rgba(248,113,113,0.18)]";
  }

  if (riskLevel === "Medium") {
    return "border-amber-100/22 bg-amber-100/[0.13] shadow-[0_0_22px_rgba(253,230,138,0.14)]";
  }

  return "border-cyan-100/20 bg-cyan-100/[0.12] shadow-[0_0_22px_rgba(180,240,255,0.16)]";
}

function clusterNodeStroke(riskLevel: "Low" | "Medium" | "Elevated") {
  if (riskLevel === "Elevated") return "rgba(254,202,202,0.8)";
  if (riskLevel === "Medium") return "rgba(253,230,138,0.72)";
  return "rgba(180,240,255,0.72)";
}

function ClusterPanelSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5"
          >
            <SkeletonLine className="h-2 w-20" />
            <SkeletonLine className="mt-3 h-5 w-12" />
          </div>
        ))}
      </div>
      {Array.from({ length: 2 }).map((_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-white/10 bg-black/20 p-3"
        >
          <SkeletonLine className="h-3 w-36" />
          <SkeletonLine className="mt-3 h-2 w-full" />
          <SkeletonLine className="mt-2 h-2 w-3/4" />
        </div>
      ))}
    </div>
  );
}

function clusterRiskClass(riskLevel: "Low" | "Medium" | "Elevated") {
  if (riskLevel === "Elevated") {
    return "border-red-100/14 bg-red-100/[0.045] text-red-100/62";
  }

  if (riskLevel === "Medium") {
    return "border-amber-100/14 bg-amber-100/[0.045] text-amber-100/62";
  }

  return "border-cyan-100/10 bg-cyan-100/[0.045] text-cyan-100/66";
}

function BehaviorMetric({
  label,
  value,
}: {
  label: string;
  value: number | string | null | undefined;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5">
      <p className="text-xs text-white/35">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-[-0.05em] text-white/82">
        {value ?? "N/A"}
      </p>
    </div>
  );
}

function WalletBehaviorPreviewSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5"
          >
            <SkeletonLine className="h-2 w-20" />
            <SkeletonLine className="mt-3 h-5 w-14" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
        <SkeletonLine className="h-2 w-24" />
        <SkeletonLine className="mt-3 h-3 w-36" />
      </div>
    </div>
  );
}

function formatBehaviorValue(value: number | null | undefined, suffix = "") {
  if (value === null || value === undefined) return "N/A";
  return `${value}${suffix}`;
}

function normalizeScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function BehaviorPreviewState({
  children,
  pulse = false,
  tone = "default",
}: {
  children: React.ReactNode;
  pulse?: boolean;
  tone?: "default" | "error";
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-xs leading-relaxed">
      {pulse && (
        <motion.div
          animate={{ opacity: [0.35, 1, 0.35] }}
          transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
          className="mb-3 h-1.5 w-20 rounded-full bg-cyan-100/35"
        />
      )}
      <p className={tone === "error" ? "text-red-100/55" : "text-white/35"}>
        {children}
      </p>
    </div>
  );
}

function LiveSignals() {
  return (
    <Panel title="Holder Signals" tag="V1">
      <div className="space-y-3">
        {[
          ["Holder ranking live", "Top holder addresses, balances and ownership are fetched from Moralis."],
          ["Behavior metrics estimated", "Flow, PnL, win rate and hold time are not live in Holder Intelligence V1."],
          ["V2 engine pending", "Wallet behavior history will require the dedicated behavior engine."],
        ].map(([signal, detail], index) => (
          <motion.div
            key={signal}
            animate={{ opacity: [0.62, 1, 0.62] }}
            transition={{
              duration: 3 + index * 0.35,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="rounded-2xl border border-white/10 bg-black/20 p-3"
          >
            <p className="text-sm text-white/62">{signal}</p>
            <p className="mt-1 text-xs text-white/32">{detail}</p>
          </motion.div>
        ))}
      </div>
    </Panel>
  );
}

function ActivityTimeline() {
  return (
    <Panel title="Holder Pipeline">
      <div className="relative space-y-4">
        <div className="absolute left-[7px] top-2 h-[85%] w-[1px] bg-gradient-to-b from-cyan-100/30 via-cyan-100/10 to-transparent" />
        {[
          ["Token contract selected", "Required before holder fetch"],
          ["Holder route called", "chain and tokenAddress"],
          ["Real holder facts displayed", "rank, address, balance, ownership"],
          ["Behavior engine deferred", "V2 not implemented"],
        ].map(([title, time], index) => (
          <div key={title} className="relative flex gap-4">
            <motion.div
              animate={{
                opacity: [0.45, 1, 0.45],
                scale: [1, 1.15, 1],
              }}
              transition={{
                duration: 2.4 + index * 0.35,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="relative z-10 mt-1 h-4 w-4 rounded-full border border-cyan-100/20 bg-cyan-100/70 shadow-[0_0_18px_rgba(180,240,255,0.55)]"
            />
            <div>
              <p className="text-sm text-white/68">{title}</p>
              <p className="mt-1 text-xs text-white/28">{time}</p>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Panel({
  title,
  tag,
  children,
}: {
  title: string;
  tag?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] p-4 backdrop-blur-2xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(1,44,59,0.16),transparent_60%)]" />
      <div className="relative">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-medium">{title}</p>
          {tag && (
            <span className="rounded-full border border-cyan-100/10 bg-cyan-100/[0.035] px-3 py-1 text-xs text-cyan-100/55">
              {tag}
            </span>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

function StableWalletIntelligenceTable({
  walletRows,
  behaviorProfiles,
  personalityError,
  personalityLoadState,
  personalityPreviews,
  loadState,
  error,
  onSelectWallet,
}: {
  walletRows: WalletRow[];
  behaviorProfiles: WalletBehaviorProfile[];
  personalityError: string;
  personalityLoadState: HolderLoadState;
  personalityPreviews: WalletPersonalityPreview[];
  loadState: HolderLoadState;
  error: string;
  onSelectWallet: (row: WalletRow, profile?: WalletBehaviorProfile) => void;
}) {
  const isLoading = loadState === "loading";
  const isError = loadState === "error";
  const isIdle = loadState === "idle";
  const isEmptyLoaded = loadState === "loaded" && walletRows.length === 0;
  const profileByAddress = useMemo(() => {
    return new Map(
      behaviorProfiles.map((profile) => [
        profile.walletAddress.toLowerCase(),
        profile,
      ])
    );
  }, [behaviorProfiles]);
  const personalityByAddress = useMemo(() => {
    return new Map(
      personalityPreviews.map((personality) => [
        personality.walletAddress.toLowerCase(),
        personality,
      ])
    );
  }, [personalityPreviews]);

  return (
    <section className="mt-4 rounded-[2rem] border border-white/10 bg-[#06080c]/90 p-5 shadow-[0_30px_120px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-100/40">
            Holder Intelligence
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-semibold tracking-[-0.05em]">
              Top 100 Holders
            </h2>
            <span className="rounded-full border border-cyan-100/10 bg-cyan-100/[0.045] px-3 py-1 text-xs text-cyan-100/60">
              Real holders · behavior engine pending
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/35">
            Top holder facts are live. Behavior and personality inference is
            shown only for profiled wallets.
          </p>
        </div>

        <div className="hidden rounded-full border border-cyan-100/10 bg-cyan-100/[0.045] px-4 py-2 text-xs text-cyan-100/60 md:block">
          Pending V2
        </div>
      </div>

      <div className="overflow-hidden rounded-[1.4rem] border border-white/10">
        <div className="grid min-w-[1460px] grid-cols-[64px_1.3fr_0.7fr_0.7fr_1fr_1.05fr_0.6fr_0.7fr_0.8fr_0.7fr] border-b border-white/10 bg-black/35 px-4 py-3 text-[11px] uppercase tracking-[0.2em] text-white/32">
          <span>#</span>
          <span>Wallet</span>
          <span>Balance</span>
          <span>Ownership</span>
          <span>V2 Behavior</span>
          <span>Personality</span>
          <span>Activity</span>
          <span>Dormancy</span>
          <span>Concentration</span>
          <span>Reliability</span>
        </div>

        <div className="max-h-[720px] overflow-auto">
          {isIdle && (
            <HolderStateMessage
              title="Select a token to activate Holder Intelligence V1."
              detail="NovaOS will load real holder rankings, wallet addresses, balances and ownership percentages."
            />
          )}

          {isLoading && (
            <HolderTableSkeleton />
          )}

          {isError && (
            <HolderStateMessage
              title="Holder intelligence could not be loaded."
              detail={error || "The holders API returned an unexpected error."}
              tone="error"
            />
          )}

          {isEmptyLoaded && (
            <HolderStateMessage
              title="No holders were returned for this token."
              detail="This can happen when the chain is unsupported or the provider has no indexed holder list."
            />
          )}

          {walletRows.map((row, index) => {
            const matchedProfile = row.fullAddress
              ? profileByAddress.get(row.fullAddress.toLowerCase())
              : undefined;
            const matchedPersonality = row.fullAddress
              ? personalityByAddress.get(row.fullAddress.toLowerCase())
              : undefined;

            return (
            <motion.button
              type="button"
              key={`${row.rank}-${row.fullAddress || row.wallet}`}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: Math.min(index * 0.012, 0.18) }}
              onClick={() => onSelectWallet(row, matchedProfile)}
              className="group grid min-w-[1460px] grid-cols-[64px_1.3fr_0.7fr_0.7fr_1fr_1.05fr_0.6fr_0.7fr_0.8fr_0.7fr] items-center border-b border-white/[0.055] px-4 py-3.5 text-left text-sm transition hover:bg-cyan-100/[0.025] focus:outline-none focus:ring-1 focus:ring-inset focus:ring-cyan-100/20"
            >
              <span className="text-white/30">{row.rank}</span>

              <div className="flex min-w-0 items-center gap-3">
                <motion.span
                  animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.18, 1] }}
                  transition={{
                    duration: 3 + (index % 4) * 0.35,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    row.color === "red"
                      ? "bg-red-300 shadow-[0_0_14px_rgba(255,120,120,0.9)]"
                      : row.color === "amber"
                      ? "bg-amber-300 shadow-[0_0_14px_rgba(255,190,80,0.9)]"
                      : row.color === "purple"
                      ? "bg-purple-300 shadow-[0_0_14px_rgba(190,150,255,0.85)]"
                      : "bg-cyan-200 shadow-[0_0_14px_rgba(180,240,255,0.9)]"
                  }`}
                />

                <div className="min-w-0">
                  <p className="truncate font-medium text-white/72">{row.wallet}</p>
                  <p className="mt-0.5 truncate text-xs text-white/28">
                    {row.fullAddress || "Address unavailable"}
                  </p>
                </div>
              </div>

              <span className="text-white/55">{row.balance}</span>
              <span className="font-medium text-cyan-100/70">
                {row.ownershipPercentage}
              </span>
              <V2BehaviorBadge profile={matchedProfile} />
              <PersonalityTableCell
                isLoading={personalityLoadState === "loading" && row.rank <= 5}
                isUnavailable={Boolean(personalityError)}
                personality={matchedPersonality}
              />
              <ScoreCell value={matchedProfile?.activityVelocityScore} />
              <ScoreCell value={matchedProfile?.dormancyRiskScore} />
              <ScoreCell
                fallback={row.estimatedCluster || row.cluster}
                value={matchedProfile?.concentrationRiskScore}
              />
              <ScoreCell value={matchedProfile?.behaviorReliabilityScore} />
            </motion.button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HolderStateMessage({
  title,
  detail,
  tone = "default",
}: {
  title: string;
  detail: string;
  tone?: "default" | "error";
}) {
  return (
    <div className="flex min-h-[280px] items-center justify-center px-6 text-center">
      <div>
        <p className={`text-sm ${tone === "error" ? "text-red-100/65" : "text-white/45"}`}>
          {title}
        </p>
        <p className="mt-2 max-w-xl text-xs text-white/25">{detail}</p>
      </div>
    </div>
  );
}

function HolderTableSkeleton() {
  return (
    <div className="min-h-[280px]">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="grid min-w-[1460px] grid-cols-[64px_1.3fr_0.7fr_0.7fr_1fr_1.05fr_0.6fr_0.7fr_0.8fr_0.7fr] items-center border-b border-white/[0.055] px-4 py-3.5"
        >
          <SkeletonLine className="h-3 w-5" />
          <div className="flex items-center gap-3">
            <SkeletonLine className="h-2 w-2 rounded-full" />
            <div className="min-w-0 flex-1">
              <SkeletonLine className="h-3 w-28" />
              <SkeletonLine className="mt-2 h-2 w-52" />
            </div>
          </div>
          <SkeletonLine className="h-3 w-16" />
          <SkeletonLine className="h-3 w-14" />
          <SkeletonLine className="h-6 w-24 rounded-full" />
          <SkeletonLine className="h-6 w-28 rounded-full" />
          <SkeletonLine className="h-3 w-7" />
          <SkeletonLine className="h-3 w-7" />
          <SkeletonLine className="h-3 w-7" />
          <SkeletonLine className="h-3 w-7" />
        </div>
      ))}
      <p className="px-4 py-4 text-xs text-white/28">
        Loading holder intelligence...
      </p>
    </div>
  );
}

function V2BehaviorBadge({
  profile,
}: {
  profile?: WalletBehaviorProfile;
}) {
  if (!profile) {
    return (
      <span className="inline-flex min-w-[6.5rem] justify-center rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-center text-xs text-white/45">
        Pending V2
      </span>
    );
  }

  return (
    <span
      title={profile.behaviorExplanation}
      className={`inline-flex min-w-[6.5rem] justify-center rounded-full border px-3 py-1 text-center text-xs ${behaviorBadgeClass(profile)}`}
    >
      {behaviorBadgeLabel(profile)}
    </span>
  );
}

function PersonalityTableCell({
  isLoading,
  isUnavailable,
  personality,
}: {
  isLoading: boolean;
  isUnavailable: boolean;
  personality?: WalletPersonalityPreview;
}) {
  if (isLoading && !personality) {
    return <SkeletonLine className="h-6 w-28 rounded-full" />;
  }

  if (!personality) {
    return (
      <span className="inline-flex min-w-[7rem] justify-center rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-center text-xs text-white/40">
        {isUnavailable ? "Pending" : "Open drawer"}
      </span>
    );
  }

  return (
    <div className="min-w-0 text-center">
      <span
        title={personality.personalitySubtitle}
        className={`inline-flex min-w-[7rem] max-w-[9.5rem] justify-center rounded-full border px-3 py-1 text-xs ${personalityBadgeClass(
          personality.personalityType
        )}`}
      >
        <span className="truncate">{personality.personalityType}</span>
      </span>
      <p className="mt-1 text-[11px] text-white/30">
        {personality.confidenceLabel} confidence
      </p>
    </div>
  );
}

function personalityBadgeClass(
  personalityType: WalletPersonalityPreview["personalityType"]
) {
  if (
    personalityType === "Rotation Hunter" ||
    personalityType === "High Activity Trader"
  ) {
    return "border-amber-100/14 bg-amber-100/[0.045] text-amber-100/62";
  }

  if (personalityType === "Conviction Accumulator") {
    return "border-emerald-100/15 bg-emerald-100/[0.05] text-emerald-100/68";
  }

  if (personalityType === "Contract/System Wallet") {
    return "border-purple-100/15 bg-purple-100/[0.05] text-purple-100/65";
  }

  if (personalityType === "Insufficient Data") {
    return "border-white/10 bg-white/[0.035] text-white/45";
  }

  return "border-cyan-100/10 bg-cyan-100/[0.045] text-cyan-100/70";
}

function behaviorBadgeLabel(profile: WalletBehaviorProfile) {
  if (profile.behaviorClass === "contract/system") return "Contract";
  if ((profile.concentrationRiskScore || 0) >= 70) return "Concentrated";
  if ((profile.dormancyRiskScore || 0) >= 60) return "Dormant";
  if ((profile.activityVelocityScore || 0) >= 60) return "High Activity";
  return "Active";
}

function behaviorBadgeClass(profile: WalletBehaviorProfile) {
  const label = behaviorBadgeLabel(profile);

  if (label === "Contract") {
    return "border-purple-100/15 bg-purple-100/[0.05] text-purple-100/65";
  }

  if (label === "Dormant") {
    return "border-amber-100/15 bg-amber-100/[0.05] text-amber-100/65";
  }

  if (label === "Concentrated") {
    return "border-red-100/15 bg-red-100/[0.045] text-red-100/62";
  }

  if (label === "High Activity") {
    return "border-emerald-100/15 bg-emerald-100/[0.05] text-emerald-100/68";
  }

  return "border-cyan-100/10 bg-cyan-100/[0.045] text-cyan-100/70";
}

function ScoreCell({
  centered = false,
  value,
  fallback,
}: {
  centered?: boolean;
  value?: number;
  fallback?: string;
}) {
  if (typeof value === "number") {
    return (
      <span className={`font-medium tabular-nums text-cyan-100/70 ${centered ? "text-center" : ""}`}>
        {value}
      </span>
    );
  }

  return (
    <span className={`truncate text-xs text-white/35 ${centered ? "text-center" : ""}`}>
      {fallback || "—"}
    </span>
  );
}

function WalletDetailDrawer({
  selected,
  chain,
  loadState,
  transactionData,
  transactionError,
  transactionLoadState,
  walletMemory,
  walletMemoryError,
  walletMemoryLoadState,
  walletPersonality,
  walletPersonalityError,
  walletPersonalityLoadState,
  onClose,
}: {
  selected: { row: WalletRow; profile?: WalletBehaviorProfile } | null;
  chain: string;
  loadState: HolderLoadState;
  transactionData: WalletTransactionIntelligence | null;
  transactionError: string;
  transactionLoadState: HolderLoadState;
  walletMemory: WalletMemoryData | null;
  walletMemoryError: string;
  walletMemoryLoadState: HolderLoadState;
  walletPersonality: WalletPersonalityData | null;
  walletPersonalityError: string;
  walletPersonalityLoadState: HolderLoadState;
  onClose: () => void;
}) {
  const [copiedAddress, setCopiedAddress] = useState("");
  const address = selected?.row.fullAddress || "";
  const explorer = address ? explorerUrl(chain, address) : "";
  const confidence = confidenceLabel(selected?.profile);
  const isProfileLoading =
    selected && !selected.profile && loadState === "loading";

  useEffect(() => {
    if (!selected) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, selected]);

  if (!selected) return null;

  async function copyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopiedAddress(address);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close wallet detail drawer"
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.aside
        initial={{ x: 36, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 36, opacity: 0 }}
        className="relative z-10 h-full w-full max-w-xl overflow-y-auto border-l border-white/10 bg-[#05080c]/95 p-5 shadow-[0_0_90px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-100/40">
              Wallet Detail
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">
              {selected.row.wallet}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs text-white/55 transition hover:bg-white/[0.06]"
          >
            Close
          </button>
        </div>

        <div className="rounded-[1.5rem] border border-white/10 bg-black/25 p-4">
          <p className="text-xs text-white/32">Full address</p>
          <p className="mt-2 break-all font-mono text-sm leading-relaxed text-white/75">
            {address || "Address unavailable"}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyAddress}
              disabled={!address}
              className="rounded-full border border-cyan-100/10 bg-cyan-100/[0.045] px-3 py-1.5 text-xs text-cyan-100/65 transition hover:bg-cyan-100/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {copiedAddress === address ? "Copied" : "Copy address"}
            </button>
            {explorer && (
              <a
                href={explorer}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs text-white/55 transition hover:bg-white/[0.06]"
              >
                Open explorer
              </a>
            )}
          </div>
        </div>

        {isProfileLoading ? (
          <WalletDrawerSkeleton />
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <DrawerMetric
                label="Wallet age days"
                value={formatDrawerValue(selected.profile?.walletAgeDays)}
              />
              <DrawerMetric
                label="Days since active"
                value={formatDrawerValue(selected.profile?.daysSinceLastActive)}
              />
              <DrawerMetric
                label="Native balance"
                value={selected.profile?.nativeBalance?.formatted || "N/A"}
              />
              <DrawerMetric
                label="Transaction count"
                value={formatDrawerValue(selected.profile?.transactionCount)}
              />
              <DrawerMetric
                label="Activity velocity"
                value={formatDrawerValue(selected.profile?.activityVelocityScore)}
              />
              <DrawerMetric
                label="Dormancy risk"
                value={formatDrawerValue(selected.profile?.dormancyRiskScore)}
              />
              <DrawerMetric
                label="Concentration risk"
                value={formatDrawerValue(
                  selected.profile?.concentrationRiskScore
                )}
              />
              <DrawerMetric
                label="Reliability score"
                value={formatDrawerValue(
                  selected.profile?.behaviorReliabilityScore
                )}
              />
            </div>

            <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-black/25 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-white/32">Behavior class</p>
                  <p className="mt-1 text-sm text-white/72">
                    {selected.profile?.behaviorClass || "Pending V2"}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-xs ${confidenceBadgeClass(confidence)}`}
                >
                  {confidence}
                </span>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-white/38">
                {selected.profile?.behaviorExplanation ||
                  "This wallet has not been included in the current V2 profile batch. Holder facts remain live; behavior scoring is pending for this row."}
              </p>
            </div>
          </>
        )}

        <WalletPersonalitySection
          data={walletPersonality}
          error={walletPersonalityError}
          loadState={walletPersonalityLoadState}
        />

        <WalletMemorySection
          data={walletMemory}
          error={walletMemoryError}
          loadState={walletMemoryLoadState}
        />

        <TransactionIntelligenceSection
          data={transactionData}
          error={transactionError}
          loadState={transactionLoadState}
        />
      </motion.aside>
    </div>
  );
}

function TransactionIntelligenceSection({
  data,
  error,
  loadState,
}: {
  data: WalletTransactionIntelligence | null;
  error: string;
  loadState: HolderLoadState;
}) {
  const transactions = data?.transactions.slice(0, 5) || [];

  return (
    <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-black/25 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-100/38">
            Transaction Intelligence
          </p>
          <p className="mt-2 text-sm text-white/72">
            {data?.behaviorSummary.dominantBehavior || "Inferred behavior pending"}
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs ${confidenceBadgeClass(
            data?.confidence.label || "Low confidence"
          )}`}
        >
          {data?.confidence.label || "Low confidence"}
        </span>
      </div>

      {loadState === "loading" && <TransactionIntelligenceSkeleton />}

      {loadState === "error" && (
        <div className="mt-4 rounded-2xl border border-red-100/10 bg-red-100/[0.035] p-3">
          <p className="text-xs leading-relaxed text-red-100/62">
            {error || "Transaction intelligence could not be loaded."}
          </p>
        </div>
      )}

      {loadState === "loaded" && data && (
        <>
          <p className="mt-3 text-xs leading-relaxed text-white/36">
            {data.behaviorSummary.explanation}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <DrawerMetric
              label="Buy pressure"
              value={String(data.activityMetrics.recentBuyPressure)}
            />
            <DrawerMetric
              label="Sell pressure"
              value={String(data.activityMetrics.recentSellPressure)}
            />
            <DrawerMetric
              label="Tx frequency"
              value={String(data.activityMetrics.transactionFrequency)}
            />
            <DrawerMetric
              label="Avg tx size"
              value={formatUsd(data.activityMetrics.averageTransactionSize)}
            />
            <DrawerMetric
              label="Buy/sell ratio"
              value={formatDrawerValue(data.activityMetrics.buySellRatio)}
            />
            <DrawerMetric
              label="Active days est."
              value={String(data.activityMetrics.activeDaysEstimate)}
            />
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs text-white/35">Recent transfers</p>
              <p className="text-xs text-white/24">Latest 5</p>
            </div>

            {transactions.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3 text-xs text-white/35">
                No recent ERC-20 transfers found.
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map((transaction, index) => (
                  <TransactionRow
                    key={`${transaction.txHash || "tx"}-${index}`}
                    transaction={transaction}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {loadState === "idle" && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-3 text-xs text-white/35">
          Select a wallet to load transfer intelligence.
        </div>
      )}

      <p className="mt-4 rounded-2xl border border-cyan-100/10 bg-cyan-100/[0.025] p-3 text-xs leading-relaxed text-white/35">
        Transfer-based inference only. PnL, win rate and average hold duration
        are not calculated yet.
      </p>
    </div>
  );
}

function WalletPersonalitySection({
  data,
  error,
  loadState,
}: {
  data: WalletPersonalityData | null;
  error: string;
  loadState: HolderLoadState;
}) {
  const [copiedShareCard, setCopiedShareCard] = useState("");

  async function copyShareCard() {
    if (!data?.shareCardText) return;
    await navigator.clipboard.writeText(data.shareCardText);
    setCopiedShareCard(data.shareCardText);
  }

  return (
    <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-cyan-100/10 bg-cyan-100/[0.025] p-4 shadow-[0_0_60px_rgba(34,211,238,0.045)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-100/42">
            Wallet Personality
          </p>
          <p className="mt-2 text-xl font-semibold tracking-[-0.05em] text-white/82">
            {data?.personalityType || "Personality pending"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-white/38">
            {data?.personalitySubtitle ||
              "NovaOS will classify this wallet from metadata and transfer patterns."}
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs ${memoryConfidenceClass(
            data?.confidenceLabel || "Low"
          )}`}
        >
          {data?.confidenceLabel || "Low"} confidence
        </span>
      </div>

      {loadState === "loading" && <WalletPersonalitySkeleton />}

      {loadState === "error" && (
        <div className="mt-4 rounded-2xl border border-red-100/10 bg-red-100/[0.035] p-3">
          <p className="text-xs leading-relaxed text-red-100/62">
            {error || "Wallet personality could not be loaded."}
          </p>
        </div>
      )}

      {loadState === "idle" && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-3 text-xs text-white/35">
          Select a wallet to load personality inference.
        </div>
      )}

      {loadState === "loaded" && !data && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-3 text-xs text-white/35">
          Wallet personality is unavailable for this wallet.
        </div>
      )}

      {loadState === "loaded" && data && (
        <>
          <div className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-black/20 p-3">
            <PersonalityScoreBar
              label="Conviction"
              value={data.personalityScores.conviction}
            />
            <PersonalityScoreBar
              label="Rotation"
              value={data.personalityScores.rotation}
            />
            <PersonalityScoreBar
              label="Consistency"
              value={data.personalityScores.consistency}
            />
            <PersonalityScoreBar
              label="Activity"
              value={data.personalityScores.activity}
            />
            <PersonalityScoreBar
              label="Concentration awareness"
              value={data.personalityScores.concentrationAwareness}
            />
            <PersonalityScoreBar
              label="Reliability"
              value={data.personalityScores.reliability}
            />
          </div>

          <div className="mt-4 grid gap-3">
            <PersonalityBadgeGroup title="Traits" items={data.traits} />
            <PersonalityBadgeGroup title="Strengths" items={data.strengths} />
            <PersonalityBadgeGroup
              title="Risk notes"
              items={data.riskNotes}
              tone="amber"
            />
          </div>

          <ShareCardPreview
            copied={copiedShareCard === data.shareCardText}
            data={data}
            onCopy={copyShareCard}
          />

          <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-3 text-xs leading-relaxed text-white/35">
            {data.methodologyNote}
          </p>
        </>
      )}

      <p className="mt-4 rounded-2xl border border-cyan-100/10 bg-cyan-100/[0.025] p-3 text-xs leading-relaxed text-white/35">
        Behavior-inference only. No PnL, win rate, smart money identity or
        insider identity is calculated.
      </p>
    </div>
  );
}

function ShareCardPreview({
  copied,
  data,
  onCopy,
}: {
  copied: boolean;
  data: WalletPersonalityData;
  onCopy: () => void;
}) {
  const topScores = Object.entries(data.personalityScores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs text-white/35">Share Card Preview</p>
        <button
          type="button"
          onClick={onCopy}
          className="shrink-0 rounded-full border border-cyan-100/10 bg-cyan-100/[0.045] px-3 py-1 text-xs text-cyan-100/62 transition hover:bg-cyan-100/[0.08]"
        >
          {copied ? "Copied" : "Copy Card Text"}
        </button>
      </div>

      <div className="relative overflow-hidden rounded-[1.6rem] border border-cyan-100/12 bg-[#03070a] p-4 shadow-[0_0_70px_rgba(34,211,238,0.07)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(180,240,255,0.12),transparent_48%),radial-gradient(circle_at_90%_85%,rgba(126,87,194,0.12),transparent_42%)]" />

        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cyan-100 shadow-[0_0_16px_rgba(180,240,255,0.75)]" />
                <p className="text-xs font-semibold tracking-[0.28em] text-cyan-100/70">
                  NovaOS
                </p>
              </div>
              <p className="mt-2 font-mono text-xs text-white/32">
                {data.shortAddress}
              </p>
            </div>
            <span
              className={`rounded-full border px-3 py-1 text-xs ${memoryConfidenceClass(
                data.confidenceLabel
              )}`}
            >
              {data.confidenceLabel}
            </span>
          </div>

          <div className="mt-5">
            <p className="text-2xl font-semibold tracking-[-0.06em] text-white/86">
              {data.personalityType}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-white/42">
              {data.shareCardText}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {topScores.map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-white/10 bg-white/[0.035] p-2.5"
              >
                <p className="truncate text-[10px] uppercase tracking-[0.16em] text-white/28">
                  {formatScoreLabel(label)}
                </p>
                <p className="mt-1 text-lg font-semibold text-cyan-100/72">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {data.traits.slice(0, 3).map((trait) => (
              <span
                key={trait}
                className="rounded-full border border-cyan-100/10 bg-cyan-100/[0.035] px-2.5 py-1 text-[11px] text-cyan-100/58"
              >
                {trait}
              </span>
            ))}
          </div>

          <p className="mt-5 border-t border-white/10 pt-3 text-[11px] text-white/32">
            Behavior inference · Not financial advice
          </p>
        </div>
      </div>
    </div>
  );
}

function formatScoreLabel(label: string) {
  return label
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (value) => value.toUpperCase());
}

function PersonalityScoreBar({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span className="text-white/38">{label}</span>
        <span className="font-medium tabular-nums text-cyan-100/62">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#022026] via-cyan-100/60 to-[#392250]"
          style={{ width: `${Math.max(4, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

function PersonalityBadgeGroup({
  items,
  title,
  tone = "cyan",
}: {
  items: string[];
  title: string;
  tone?: "cyan" | "amber";
}) {
  return (
    <div>
      <p className="mb-2 text-xs text-white/35">{title}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item}
            className={`rounded-full border px-2.5 py-1 text-[11px] ${
              tone === "amber"
                ? "border-amber-100/12 bg-amber-100/[0.04] text-amber-100/58"
                : "border-cyan-100/10 bg-cyan-100/[0.035] text-cyan-100/58"
            }`}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function WalletPersonalitySkeleton() {
  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="mb-3 last:mb-0">
            <SkeletonLine className="h-2 w-28" />
            <SkeletonLine className="mt-2 h-1.5 w-full" />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <SkeletonLine key={index} className="h-6 w-24 rounded-full" />
        ))}
      </div>
      <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
        <SkeletonLine className="h-2 w-20" />
        <SkeletonLine className="mt-3 h-2 w-full" />
        <SkeletonLine className="mt-2 h-2 w-4/5" />
      </div>
    </div>
  );
}

function WalletMemorySection({
  data,
  error,
  loadState,
}: {
  data: WalletMemoryData | null;
  error: string;
  loadState: HolderLoadState;
}) {
  return (
    <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-black/25 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-100/38">
            Wallet Memory
          </p>
          <p className="mt-2 text-sm text-white/72">
            {data?.walletFingerprint || "Runtime pattern memory pending"}
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs ${memoryConfidenceClass(
            data?.confidenceLabel || "Low"
          )}`}
        >
          {data?.confidenceLabel || "Low"} confidence
        </span>
      </div>

      {loadState === "loading" && <WalletMemorySkeleton />}

      {loadState === "error" && (
        <div className="mt-4 rounded-2xl border border-red-100/10 bg-red-100/[0.035] p-3">
          <p className="text-xs leading-relaxed text-red-100/62">
            {error || "Wallet memory could not be loaded."}
          </p>
        </div>
      )}

      {loadState === "idle" && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-3 text-xs text-white/35">
          Select a wallet to load runtime memory.
        </div>
      )}

      {loadState === "loaded" && !data && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-3 text-xs text-white/35">
          Wallet memory is unavailable for this wallet.
        </div>
      )}

      {loadState === "loaded" && data && (
        <>
          <p className="mt-3 text-xs leading-relaxed text-white/38">
            {data.memorySummary}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <DrawerMetric
              label="Consistency"
              value={String(data.consistencyScore)}
            />
            <DrawerMetric
              label="Conviction behavior"
              value={String(data.convictionBehaviorScore)}
            />
            <DrawerMetric
              label="Rotation"
              value={String(data.rotationScore)}
            />
            <DrawerMetric
              label="Narrative exposure"
              value={`${data.narrativeExposure.label} · ${data.narrativeExposure.score}`}
            />
            <DrawerMetric
              label="Repeated tokens"
              value={String(data.repeatedTokenCount)}
            />
            <DrawerMetric
              label="Seen before"
              value={data.repeatedWalletSeen ? "Yes" : "No"}
            />
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-white/35">Recurring cluster appearance</p>
              <span className="text-xs font-medium text-cyan-100/62">
                {data.recurringClusterAppearance.detected ? "Detected" : "Not detected"}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-white/34">
              {data.recurringClusterAppearance.explanation}
            </p>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs text-white/35">Repeated behavior flags</p>
            <div className="flex flex-wrap gap-2">
              {data.repeatedBehaviorFlags.map((flag) => (
                <span
                  key={flag}
                  className="rounded-full border border-cyan-100/10 bg-cyan-100/[0.035] px-2.5 py-1 text-[11px] text-cyan-100/58"
                >
                  {formatMemoryFlag(flag)}
                </span>
              ))}
            </div>
          </div>
        </>
      )}

      <p className="mt-4 rounded-2xl border border-cyan-100/10 bg-cyan-100/[0.025] p-3 text-xs leading-relaxed text-white/35">
        Runtime memory and transfer-pattern inference. Not a profitability or
        identity claim.
      </p>
    </div>
  );
}

function WalletMemorySkeleton() {
  return (
    <div className="mt-4 space-y-3">
      <SkeletonLine className="h-2 w-full" />
      <SkeletonLine className="h-2 w-4/5" />
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-white/10 bg-black/22 p-3"
          >
            <SkeletonLine className="h-2 w-20" />
            <SkeletonLine className="mt-3 h-5 w-12" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
        <SkeletonLine className="h-3 w-40" />
        <SkeletonLine className="mt-3 h-2 w-full" />
      </div>
    </div>
  );
}

function formatMemoryFlag(flag: string) {
  return flag
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function memoryConfidenceClass(confidence: "High" | "Medium" | "Low") {
  if (confidence === "High") {
    return "border-emerald-100/15 bg-emerald-100/[0.05] text-emerald-100/68";
  }

  if (confidence === "Medium") {
    return "border-cyan-100/12 bg-cyan-100/[0.045] text-cyan-100/66";
  }

  return "border-amber-100/14 bg-amber-100/[0.045] text-amber-100/62";
}

function TransactionRow({
  transaction,
}: {
  transaction: WalletTransaction;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`rounded-full border px-2.5 py-1 text-[11px] ${directionBadgeClass(
              transaction.direction
            )}`}
          >
            {formatDirection(transaction.direction)}
          </span>
          <p className="truncate text-xs text-white/68">
            {transaction.tokenSymbol || "Token"}
          </p>
        </div>
        <p className="shrink-0 text-xs text-white/30">
          {formatTransferTime(transaction.timestamp)}
        </p>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div className="min-w-0">
          <p className="text-white/25">Amount</p>
          <p className="mt-0.5 truncate text-white/55">
            {transaction.amount || "N/A"}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-white/25">Value</p>
          <p className="mt-0.5 truncate text-white/55">
            {formatUsd(transaction.valueUsd)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-white/25">Tx</p>
          <p className="mt-0.5 truncate font-mono text-white/45">
            {shortHash(transaction.txHash)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-white/25">Counterparty</p>
          <p className="mt-0.5 truncate font-mono text-white/45">
            {shortHash(transaction.counterparty)}
          </p>
        </div>
      </div>
    </div>
  );
}

function TransactionIntelligenceSkeleton() {
  return (
    <div className="mt-4 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-white/10 bg-black/22 p-3"
          >
            <SkeletonLine className="h-2 w-20" />
            <SkeletonLine className="mt-3 h-5 w-12" />
          </div>
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-white/10 bg-white/[0.025] p-3"
        >
          <SkeletonLine className="h-3 w-32" />
          <SkeletonLine className="mt-3 h-2 w-full" />
          <SkeletonLine className="mt-2 h-2 w-2/3" />
        </div>
      ))}
    </div>
  );
}

function formatDirection(direction: WalletTransferDirection) {
  if (direction === "transfer_in") return "In";
  if (direction === "transfer_out") return "Out";
  return direction.charAt(0).toUpperCase() + direction.slice(1);
}

function directionBadgeClass(direction: WalletTransferDirection) {
  if (direction === "buy" || direction === "transfer_in") {
    return "border-emerald-100/14 bg-emerald-100/[0.045] text-emerald-100/66";
  }

  if (direction === "sell") {
    return "border-red-100/14 bg-red-100/[0.045] text-red-100/62";
  }

  return "border-amber-100/14 bg-amber-100/[0.045] text-amber-100/62";
}

function formatUsd(value: number | null | undefined) {
  if (value === null || value === undefined) return "N/A";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

function shortHash(value: string | null) {
  if (!value) return "N/A";
  if (value.length < 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function shortWalletAddress(value: string) {
  if (value.length < 12) return value;
  return `${value.slice(0, 6)}.....${value.slice(-4)}`;
}

function formatTransferTime(timestamp: string | null) {
  if (!timestamp) return "Unknown";
  const time = Date.parse(timestamp);
  if (!Number.isFinite(time)) return "Unknown";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(time));
}

function DrawerMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/22 p-3">
      <p className="text-xs text-white/32">{label}</p>
      <p className="mt-1 truncate text-base font-semibold text-white/76">
        {value}
      </p>
    </div>
  );
}

function WalletDrawerSkeleton() {
  return (
    <div className="mt-4 grid grid-cols-2 gap-3">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-white/10 bg-black/22 p-3"
        >
          <SkeletonLine className="h-2 w-20" />
          <SkeletonLine className="mt-3 h-5 w-16" />
        </div>
      ))}
    </div>
  );
}

function formatDrawerValue(value?: number | null) {
  if (value === null || value === undefined) return "N/A";
  return String(value);
}

function explorerUrl(chain: string, address: string) {
  const key = chain.toLowerCase();
  if (key === "ethereum" || key === "eth") {
    return `https://etherscan.io/address/${address}`;
  }
  if (key === "base") return `https://basescan.org/address/${address}`;
  if (key === "bsc" || key === "bnb") {
    return `https://bscscan.com/address/${address}`;
  }
  if (key === "polygon") return `https://polygonscan.com/address/${address}`;
  if (key === "arbitrum") return `https://arbiscan.io/address/${address}`;
  if (key === "optimism") {
    return `https://optimistic.etherscan.io/address/${address}`;
  }
  if (key === "mantle" || key === "0x1388") {
    return `https://explorer.mantle.xyz/address/${address}`;
  }

  return "";
}

function confidenceLabel(profile?: WalletBehaviorProfile) {
  if (!profile || profile.dataQuality === "unavailable") return "Low confidence";
  const reliability = profile.behaviorReliabilityScore ?? profile.dataConfidence;
  const hasAge = typeof profile.walletAgeDays === "number";
  const hasTransactions = typeof profile.transactionCount === "number";
  const freshEnough =
    typeof profile.daysSinceLastActive === "number" &&
    profile.daysSinceLastActive <= 90;

  if (reliability >= 75 && hasAge && hasTransactions && freshEnough) {
    return "High confidence";
  }

  if (reliability >= 45 && (hasAge || hasTransactions)) {
    return "Medium confidence";
  }

  return "Low confidence";
}

function confidenceBadgeClass(confidence: string) {
  if (confidence === "High confidence") {
    return "border-emerald-100/15 bg-emerald-100/[0.05] text-emerald-100/68";
  }

  if (confidence === "Medium confidence") {
    return "border-cyan-100/12 bg-cyan-100/[0.045] text-cyan-100/66";
  }

  return "border-amber-100/14 bg-amber-100/[0.045] text-amber-100/62";
}

function SkeletonLine({ className = "" }: { className?: string }) {
  return (
    <motion.span
      animate={{ opacity: [0.24, 0.58, 0.24] }}
      transition={{ duration: 1.35, repeat: Infinity, ease: "easeInOut" }}
      className={`block rounded-full bg-white/10 ${className}`}
    />
  );
}
