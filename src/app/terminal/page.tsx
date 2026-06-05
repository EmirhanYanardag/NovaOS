"use client";

import { animate, motion } from "framer-motion";
import { Globe, Send } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  calculateConvictionFormulaV2,
  type ConvictionFormulaV2Result,
} from "../../lib/conviction-formula-v2";
import {
  calculateConvictionFormulaV3,
  type ConvictionFormulaV3Input,
  type ConvictionFormulaV3Result,
} from "../../lib/conviction-formula-v3";
import {
  compareConvictionSnapshots,
  createConvictionSnapshot,
  getInMemoryConvictionHistoryStore,
  selectComparisonSnapshots,
  type ConvictionSnapshot,
  type ConvictionHistoryTimeframe,
} from "../../lib/conviction-history";
import {
  calculateTokenWalletReputationSummary,
  calculateWalletReputation,
  type TokenWalletReputationSummary,
  type WalletReputationInput,
  type WalletReputationResult,
} from "../../lib/wallet-reputation";
import {
  deriveNovaArenaStance,
  getArenaProgress,
  getDailyArenaWindow,
  getTimeRemaining,
  getWeeklyArenaWindow,
  type ArenaTimeframe as NovaArenaTimeframe,
  type ArenaWindow,
  type NovaArenaStance,
  type NovaArenaStanceResult,
} from "../../lib/arena-engine";
import {
  calculateTokenFlowSummaryV2,
  calculateWalletFlowV2,
  type TokenFlowSummaryV2,
  type WalletFlowV2Result,
} from "../../lib/wallet-flow-math";
import {
  calculateHolderIntelligenceMatrix,
  summarizeHolderIntelligence,
  type HolderIntelligenceInput,
  type HolderIntelligenceProfile,
  type HolderIntelligenceSummary,
} from "../../lib/holder-intelligence";
import {
  calculateInsiderRiskV2,
  type InsiderRiskV2Result,
} from "../../lib/insider-math";
import HolderBubbleMap from "@/components/HolderBubbleMap";
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
  searchQuality?: "strong" | "low-liquidity" | "unverified-liquidity";
  liquidityUsd?: number;
  volume24hUsd?: number;
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
  address?: string;
  fullAddress?: string;
  ownerAddress?: string;
  walletAddress?: string;
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
  | "AI vs Human"
  | "Bubble Intelligence"
  | "Wallet Flows"
  | "Insider Scan"
  | "Social Feed"
  | "Signals"
  | "Watchlist";

type WalletBehaviorProfile = {
  walletAddress: string;
  address?: string;
  ownerAddress?: string;
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
  address?: string;
  ownerAddress?: string;
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
    routes?: Record<
      string,
      {
        route: string;
        hits: number;
        misses: number;
        sets: number;
        inFlightDedupes: number;
        estimatedProviderCalls: number;
        hitRate: number;
      }
    >;
    recentExpensiveMisses?: Array<{
      key: string;
      route: string;
      provider: string;
      createdAt: string;
    }>;
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

type WatchlistItem = {
  id: string;
  tokenSymbol: string;
  tokenName: string;
  tokenLogo: string;
  chain: string;
  dex: string;
  tokenAddress: string;
  pairAddress: string;
  price: string;
  marketCap: string;
  liquidity: string;
  volume24h: string;
  priceChange24h?: number;
  finalConviction?: number;
  finalConvictionV1?: number;
  finalConvictionV3?: number;
  primaryFormula?: "V3" | "V1";
  dataConfidence?: string;
  holderIntegrity?: number;
  walletQuality?: number;
  riskProtection?: number;
  insiderRisk?: number;
  bundleRisk?: number;
  clusterRisk?: number;
  latestSignalVerdict?: string;
  addedAt: string;
  lastUpdatedAt: string;
};

type FormulaValidationOutcome =
  | "Unknown"
  | "Rug"
  | "Failed"
  | "Neutral"
  | "2x+"
  | "5x+"
  | "10x+";

type FormulaValidationSnapshot = {
  id: string;
  tokenSymbol: string;
  tokenName: string;
  tokenLogo?: string;
  chain: string;
  tokenAddress: string;
  pairAddress: string;
  analyzedAt: string;
  v1Score: number;
  v2Score?: number;
  v3Score: number;
  holderQualityScore: number;
  structuralSafetyScore: number;
  marketIntegrityScore: number;
  v3RiskCapsApplied: string[];
  v3PositiveDrivers: string[];
  v3LimitingFactors: string[];
  v3MissingEvidence: string[];
  outcome: FormulaValidationOutcome;
  note: string;
  outcomeUpdatedAt?: string;
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

type ArenaVote = "Bullish" | "Accumulate" | "Bearish";
type ArenaResultStatus = "Pending" | "Awaiting Settlement" | "Resolved";
type ArenaWinner = "NovaOS" | "Human" | "Tie";

type ArenaVoteEntry = {
  id: string;
  tokenAddress: string;
  tokenSymbol: string;
  chain: string;
  timeframe: NovaArenaTimeframe;
  arenaWindowId: string;
  humanVote: ArenaVote;
  submittedAt: string;
  aiPublishedStance?: NovaArenaStance;
  aiPublishedScore?: number;
  aiPublishedAt?: string;
  resultStatus: ArenaResultStatus;
  winner?: ArenaWinner;
  resolvedAt?: string;
};

const thesisText =
  "Holder Intelligence V1 uses live holder rankings, balances and ownership percentages. Behavioral metrics will be unlocked in Wallet Behavior Engine V2.";
const DEV_CACHE_PANEL = process.env.NODE_ENV !== "production";
const SHOW_INTERNAL_FORMULA_VALIDATION_TOOLS = false;
const SHOW_INTERNAL_DEVELOPER_DIAGNOSTICS = false;
const CONVICTION_HISTORY_STORAGE_KEY = "novaos.convictionHistory.v2";
const CONVICTION_HISTORY_MAX_SNAPSHOTS = 100;
const WATCHLIST_STORAGE_KEY = "novaos.watchlist.v1";
const FORMULA_VALIDATION_STORAGE_KEY = "novaos.formulaValidation.v1";
const FORMULA_VALIDATION_MAX_SNAPSHOTS = 200;
const AI_HUMAN_ARENA_STORAGE_KEY = "novaos.aiHumanArena.v1";

const terminalSections: TerminalSection[] = [
  "Overview",
  "Conviction Engine",
  "AI vs Human",
  "Wallet Flows",
  "Insider Scan",
  "Social Feed",
  "Signals",
  "Watchlist",
];

const overviewHolderGridClass =
  "grid-cols-[0.45fr_1.65fr_0.9fr_0.9fr_1.1fr_1.2fr_0.75fr_0.75fr_0.9fr_0.9fr]";
const insiderPreviewGridClass =
  "grid-cols-[minmax(150px,1.35fr)_minmax(90px,0.75fr)_minmax(120px,1fr)_minmax(150px,1.15fr)_minmax(95px,0.7fr)_minmax(85px,0.65fr)_minmax(130px,1fr)]";
const fullHolderGridClass =
  "grid-cols-[minmax(150px,1.35fr)_minmax(90px,0.75fr)_minmax(130px,1fr)_minmax(110px,0.8fr)_minmax(80px,0.55fr)]";
const terminalSurfaceClass =
  "rounded-[2rem] border border-white/10 bg-white/[0.03] shadow-[0_24px_90px_rgba(0,0,0,0.24)] backdrop-blur-2xl";
const terminalHeaderSurfaceClass =
  "relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#06090d]/92 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur-2xl";
const terminalEyebrowClass =
  "text-xs uppercase tracking-[0.28em] text-cyan-100/42";
const terminalTitleClass =
  "text-3xl font-semibold tracking-[-0.06em] text-white/90";
const terminalSubtitleClass = "text-sm leading-relaxed text-white/42";
const terminalMethodologyClass =
  "rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 text-sm leading-relaxed text-white/42 backdrop-blur-2xl";
const terminalTableHeaderClass =
  "border-b border-white/10 bg-black/35 px-4 py-3 text-[10px] uppercase tracking-[0.12em] text-white/36";
const terminalRowClass =
  "border-b border-white/[0.055] px-4 py-3 text-sm transition last:border-b-0 hover:bg-cyan-100/[0.025]";

type TerminalBadgeTone =
  | "cyan"
  | "purple"
  | "warning"
  | "danger"
  | "success"
  | "muted";

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

function safeStringArray(value: unknown, fallback: string[] = []) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : fallback;
}

function isExplainableConvictionData(value: unknown): value is ExplainableConvictionData {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ExplainableConvictionData>;

  return (
    typeof candidate.finalConvictionScore === "number" &&
    Boolean(candidate.subScores) &&
    Boolean(candidate.explanation) &&
    Boolean(candidate.dataConfidence)
  );
}

function normalizeConvictionResult(value: unknown) {
  if (isExplainableConvictionData(value)) return value;
  if (
    value &&
    typeof value === "object" &&
    "data" in value &&
    isExplainableConvictionData((value as { data?: unknown }).data)
  ) {
    return (value as { data: ExplainableConvictionData }).data;
  }

  return null;
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
  const thesis = tokenIntelligence?.thesis;
  const tokenScores = tokenIntelligence?.scores;

  if (!conviction) {
    return {
      confidenceLabel: thesis?.confidenceLabel || "Pending",
      thesisHeadline:
        thesis?.headline ||
        "Select a token to generate a Conviction Engine intelligence report.",
      observations: safeStringArray(thesis?.bullets, [
          "Conviction Engine V1 will summarize holder structure, wallet behavior, liquidity and risk protection when data is available.",
        ]),
      riskNotes: safeStringArray(thesis?.riskNotes, [
          "No token-specific conviction data is loaded yet.",
        ]),
      metrics: {
        reliability: tokenScores?.reliabilityScore,
        activity: tokenScores?.activityScore,
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
    riskNotes: (
      riskNotes.length
        ? riskNotes
        : safeStringArray(conviction.explanation?.riskNotes, [
            "No additional risk note surfaced.",
          ])
    ).slice(0, 4),
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
  const [cacheStatus, setCacheStatus] = useState<CacheStatusData | null>(null);
  const [cacheStatusState, setCacheStatusState] =
    useState<HolderLoadState>("idle");
  const [cacheStatusError, setCacheStatusError] = useState("");
  const [watchlistItems, setWatchlistItems] = useState<WatchlistItem[]>(() =>
    readStoredWatchlistItems()
  );
  const [watchlistStatus, setWatchlistStatus] = useState("");
  const [formulaValidationSnapshots, setFormulaValidationSnapshots] = useState<
    FormulaValidationSnapshot[]
  >(() => readStoredFormulaValidationSnapshots());
  const [formulaValidationStatus, setFormulaValidationStatus] = useState("");
  const activeAnalysisKeyRef = useRef("");

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
  const explainableReport = useMemo(
    () =>
      buildExplainableIntelligenceReport({
        clusterData,
        conviction: explainableConviction,
        tokenIntelligence,
      }),
    [clusterData, explainableConviction, tokenIntelligence]
  );

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
    try {
      window.localStorage.setItem(
        WATCHLIST_STORAGE_KEY,
        JSON.stringify(watchlistItems)
      );
    } catch {
      // Local storage can fail in private or restricted browser contexts.
    }
  }, [watchlistItems]);

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

  const walletReputationResults = useMemo(
    () =>
      buildWalletReputationResults({
        behaviorProfiles: behaviorPreview?.profiles || [],
        clusterData,
        conviction: explainableConviction,
        personalityPreviews: walletPersonalityPreviews,
        walletRows,
      }),
    [
      behaviorPreview?.profiles,
      clusterData,
      explainableConviction,
      walletPersonalityPreviews,
      walletRows,
    ]
  );
  const walletReputationSummary = useMemo(
    () =>
      walletReputationResults.length
        ? calculateTokenWalletReputationSummary(walletReputationResults)
        : null,
    [walletReputationResults]
  );
  const holderIntelligenceMatrix = useMemo(
    () =>
      buildHolderIntelligenceMatrix({
        behaviorProfiles: behaviorPreview?.profiles || [],
        clusterData,
        conviction: explainableConviction,
        personalityPreviews: walletPersonalityPreviews,
        tokenData,
        walletReputationResults,
        walletRows,
      }),
    [
      behaviorPreview?.profiles,
      clusterData,
      explainableConviction,
      walletPersonalityPreviews,
      tokenData,
      walletReputationResults,
      walletRows,
    ]
  );
  const holderIntelligenceSummary = useMemo(
    () =>
      holderIntelligenceMatrix.length
        ? summarizeHolderIntelligence(holderIntelligenceMatrix)
        : null,
    [holderIntelligenceMatrix]
  );
  const walletFlowV2Results = useMemo(
    () =>
      buildWalletFlowV2Results({
        behaviorProfiles: behaviorPreview?.profiles || [],
        conviction: explainableConviction,
        holderIntelligenceMatrix,
        walletReputationResults,
        walletRows,
      }),
    [
      behaviorPreview?.profiles,
      explainableConviction,
      holderIntelligenceMatrix,
      walletReputationResults,
      walletRows,
    ]
  );
  const tokenFlowSummaryV2 = useMemo(
    () =>
      walletFlowV2Results.length
        ? calculateTokenFlowSummaryV2(walletFlowV2Results)
        : null,
    [walletFlowV2Results]
  );
  const insiderRiskV2 = useMemo(
    () =>
      calculateInsiderRiskV2({
        holderIntelligenceMatrix,
        holderIntelligenceSummary,
        convictionRiskSubscores: {
          insiderRisk: explainableConviction?.subScores.insiderRisk,
          clusterRisk: explainableConviction?.subScores.clusterRisk,
          freshWalletRisk: explainableConviction?.subScores.freshWalletRisk,
          bundleRisk: explainableConviction?.bundleDetection?.bundleRiskScore,
        },
        bundleDetection: explainableConviction?.bundleDetection,
        clusterData,
        holderSummary: tokenIntelligence?.holderSummary,
        walletReputationSummary,
        deepBehavior: explainableConviction?.deepBehavior,
      }),
    [
      holderIntelligenceMatrix,
      holderIntelligenceSummary,
      explainableConviction,
      clusterData,
      tokenIntelligence?.holderSummary,
      walletReputationSummary,
    ]
  );
  const convictionFormulaV2 = useMemo(() => {
    if (!explainableConviction) return null;

    return calculateConvictionFormulaV2({
      v1: {
        finalConvictionScore: explainableConviction.finalConvictionScore,
        subScores: explainableConviction.subScores,
        dataConfidence: explainableConviction.dataConfidence,
        warnings: explainableConviction.warnings,
        explanation: explainableConviction.explanation,
      },
      walletReputation: walletReputationSummary,
      holderIntelligence: holderIntelligenceSummary,
      insiderMath: insiderRiskV2,
      walletFlow: tokenFlowSummaryV2,
      market: {
        liquidityTrust: explainableConviction.subScores.liquidityTrust,
        marketMomentum: explainableConviction.subScores.marketMomentum,
        liquidityUsd:
          tokenData.liquidityUsd ?? parseMoneyValue(tokenData.liquidity),
        marketCapUsd: parseMoneyValue(tokenData.marketCap),
        volume24hUsd:
          tokenData.volume24hUsd ?? parseMoneyValue(tokenData.volume24h),
      },
    });
  }, [
    explainableConviction,
    holderIntelligenceSummary,
    insiderRiskV2,
    tokenData.liquidity,
    tokenData.liquidityUsd,
    tokenData.marketCap,
    tokenData.volume24h,
    tokenData.volume24hUsd,
    tokenFlowSummaryV2,
    walletReputationSummary,
  ]);
  const convictionFormulaV3Input = useMemo<ConvictionFormulaV3Input | null>(() => {
    if (!explainableConviction) return null;

    return {
      v1: {
        finalConvictionScore: explainableConviction.finalConvictionScore,
        subScores: explainableConviction.subScores,
        dataConfidence: explainableConviction.dataConfidence,
        warnings: explainableConviction.warnings,
      },
      v2: convictionFormulaV2,
      walletReputation: walletReputationSummary,
      holderIntelligence: holderIntelligenceSummary,
      insiderMath: insiderRiskV2,
      walletFlow: tokenFlowSummaryV2,
      market: {
        liquidityTrust: explainableConviction.subScores.liquidityTrust,
        marketMomentum: explainableConviction.subScores.marketMomentum,
        liquidityUsd:
          tokenData.liquidityUsd ?? parseMoneyValue(tokenData.liquidity),
        marketCapUsd: parseMoneyValue(tokenData.marketCap),
        volume24hUsd:
          tokenData.volume24hUsd ?? parseMoneyValue(tokenData.volume24h),
        priceChange24h: tokenData.change24h,
      },
    };
  }, [
    convictionFormulaV2,
    explainableConviction,
    holderIntelligenceSummary,
    insiderRiskV2,
    tokenData.change24h,
    tokenData.liquidity,
    tokenData.liquidityUsd,
    tokenData.marketCap,
    tokenData.volume24h,
    tokenData.volume24hUsd,
    tokenFlowSummaryV2,
    walletReputationSummary,
  ]);
  const convictionFormulaV3 = useMemo(
    () =>
      convictionFormulaV3Input
        ? calculateConvictionFormulaV3(convictionFormulaV3Input)
        : null,
    [convictionFormulaV3Input]
  );
  const overviewConvictionScore = Math.round(
    visiblePrimaryConvictionScore(convictionFormulaV3, explainableConviction) ??
      scores.conviction
  );
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

  function getMergedConvictionSnapshots(chain: string, tokenAddress: string) {
    const storedSnapshots = readStoredConvictionSnapshots(chain, tokenAddress);
    const runtimeSnapshots = convictionHistoryStore.current.getSnapshots(
      chain,
      tokenAddress
    );
    const mergedSnapshots = mergeConvictionSnapshotLists([
      ...storedSnapshots,
      ...runtimeSnapshots,
    ]);

    mergedSnapshots.forEach((snapshot) => {
      convictionHistoryStore.current.addSnapshot(snapshot);
    });

    return mergeConvictionSnapshotLists([
      ...mergedSnapshots,
      ...convictionHistoryStore.current.getSnapshots(chain, tokenAddress),
    ]);
  }

  function recordConvictionSnapshot(
    result: TokenResult,
    data: ExplainableConvictionData
  ) {
    if (
      !result.tokenAddress ||
      !result.chain ||
      !hasCanonicalConvictionPayload(data)
    ) {
      return;
    }

    const snapshot = createConvictionSnapshot({
      chain: result.chain,
      tokenAddress: result.tokenAddress,
      tokenSymbol: result.rawSymbol || result.symbol,
      tokenLogo: resolveTokenLogo(result),
      createdAt: new Date(Date.now()).toISOString(),
      finalConvictionScore: data.finalConvictionScore,
      subScores: {
        ...data.subScores,
        bundleRisk: data.bundleDetection?.bundleRiskScore,
      },
      dataConfidence: data.dataConfidence,
      explanationHeadline: data.explanation.headline,
      warnings: data.warnings,
      source: {
        status: data.status,
        cacheGeneratedAt: data.cache?.generatedAt,
      },
    });

    convictionHistoryStore.current.addSnapshot(snapshot);
    const mergedSnapshots = writeStoredConvictionSnapshots(
      result.chain,
      result.tokenAddress,
      [
        ...readStoredConvictionSnapshots(result.chain, result.tokenAddress),
        ...convictionHistoryStore.current.getSnapshots(
          result.chain,
          result.tokenAddress
        ),
        snapshot,
      ]
    );

    mergedSnapshots.forEach((storedSnapshot) => {
      convictionHistoryStore.current.addSnapshot(storedSnapshot);
    });
    setConvictionSnapshots(
      getMergedConvictionSnapshots(result.chain, result.tokenAddress)
    );
  }

  function clearLocalConvictionHistoryForToken() {
    if (!tokenData.tokenAddress) return;
    const confirmed = window.confirm(
      `Clear local conviction history for ${tokenData.symbol}? This only removes stored snapshots for this token.`
    );
    if (!confirmed) return;

    clearStoredConvictionSnapshots(tokenData.chain, tokenData.tokenAddress);
    convictionHistoryStore.current.clearSnapshots(
      tokenData.chain,
      tokenData.tokenAddress
    );
    setConvictionSnapshots([]);
  }

  function isActiveAnalysis(requestKey: string) {
    return activeAnalysisKeyRef.current === requestKey;
  }

  async function selectToken(result: TokenResult) {
    activeAnalysisKeyRef.current = result.tokenAddress
      ? tokenAnalysisKey(result.chain, result.tokenAddress)
      : "";
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
    setExplainableConvictionState(result.tokenAddress ? "loading" : "idle");
    setUnifiedAnalysis(null);
    setUnifiedAnalysisError("");
    setUnifiedAnalysisState(result.tokenAddress ? "loading" : "idle");
    setConvictionSnapshots(
      result.tokenAddress
        ? getMergedConvictionSnapshots(result.chain, result.tokenAddress)
        : []
    );
    setScores({ holderQuality: 0, insider: 0, conviction: 0, activity: 0 });
    setHolderLoadState(result.tokenAddress ? "loading" : "idle");
    setBehaviorPreviewState(result.tokenAddress ? "loading" : "idle");
    setTokenIntelligenceState(result.tokenAddress ? "loading" : "idle");
    setClusterLoadState(result.tokenAddress ? "loading" : "idle");
    setWalletPersonalityPreviewState(result.tokenAddress ? "loading" : "idle");

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

  function createWatchlistSnapshot(): WatchlistItem | null {
    if (!tokenData.tokenAddress) return null;

    const existing = watchlistItems.find((item) =>
      sameWatchlistToken(item, tokenData)
    );
    const signalBoard = explainableConviction
      ? buildSignalBoardModel({
          behaviorPreview,
          behaviorPreviewError,
          conviction: explainableConviction,
          convictionError: explainableConvictionError,
          holderError,
          holderLoadState,
          tokenFlowSummaryV2,
          tokenIntelligence,
          unifiedAnalysis,
          walletRows,
        })
      : null;
    const now = new Date().toISOString();
    const primaryConvictionScore = visiblePrimaryConvictionScore(
      convictionFormulaV3,
      explainableConviction
    );

    return {
      id:
        existing?.id ||
        `${tokenData.chain}:${tokenData.tokenAddress}`.toLowerCase(),
      tokenSymbol: tokenData.symbol,
      tokenName: tokenData.name,
      tokenLogo: resolveTokenLogo(tokenData),
      chain: tokenData.chain,
      dex: tokenData.dex,
      tokenAddress: tokenData.tokenAddress,
      pairAddress: tokenData.pairAddress || "",
      price: tokenData.price,
      marketCap: tokenData.marketCap,
      liquidity: tokenData.liquidity,
      volume24h: tokenData.volume24h,
      priceChange24h: tokenData.change24h,
      finalConviction: primaryConvictionScore,
      finalConvictionV1: explainableConviction?.finalConvictionScore,
      finalConvictionV3: convictionFormulaV3?.finalConvictionScoreV3,
      primaryFormula: convictionFormulaV3 ? "V3" : "V1",
      dataConfidence: explainableConviction?.dataConfidence.label,
      holderIntegrity: explainableConviction?.subScores.holderIntegrity,
      walletQuality: explainableConviction?.subScores.walletQuality,
      riskProtection: explainableConviction?.subScores.riskProtection,
      insiderRisk: explainableConviction?.subScores.insiderRisk,
      bundleRisk: explainableConviction?.bundleDetection?.bundleRiskScore,
      clusterRisk: explainableConviction?.subScores.clusterRisk,
      latestSignalVerdict: signalBoard?.verdict,
      addedAt: existing?.addedAt || now,
      lastUpdatedAt: now,
    };
  }

  function addCurrentTokenToWatchlist() {
    const snapshot = createWatchlistSnapshot();
    if (!snapshot) {
      setWatchlistStatus("Analyze a token first");
      return;
    }

    const existing = watchlistItems.find((item) => item.id === snapshot.id);
    const unchanged =
      existing && JSON.stringify({ ...existing, lastUpdatedAt: snapshot.lastUpdatedAt }) ===
        JSON.stringify(snapshot);

    setWatchlistItems((items) => {
      const index = items.findIndex((item) => item.id === snapshot.id);
      if (index === -1) return [snapshot, ...items];
      return items.map((item, itemIndex) =>
        itemIndex === index ? { ...snapshot, addedAt: item.addedAt } : item
      );
    });
    setWatchlistStatus(existing ? (unchanged ? "Already tracked" : "Updated") : "Added");
    window.setTimeout(() => setWatchlistStatus(""), 1600);
  }

  function removeWatchlistItem(id: string) {
    setWatchlistItems((items) => items.filter((item) => item.id !== id));
    setWatchlistStatus("Removed");
    window.setTimeout(() => setWatchlistStatus(""), 1600);
  }

  function saveCurrentFormulaValidationSnapshot() {
    if (!explainableConviction || !convictionFormulaV3) {
      setFormulaValidationStatus("Load V1 and V3 scores before saving.");
      window.setTimeout(() => setFormulaValidationStatus(""), 1800);
      return;
    }
    if (!tokenData.tokenAddress && !tokenData.pairAddress) {
      setFormulaValidationStatus("Select a token before saving.");
      window.setTimeout(() => setFormulaValidationStatus(""), 1800);
      return;
    }

    const snapshot = buildFormulaValidationSnapshot({
      conviction: explainableConviction,
      formulaV2: convictionFormulaV2,
      formulaV3: convictionFormulaV3,
      tokenData,
    });
    let status = "Snapshot saved";

    setFormulaValidationSnapshots((snapshots) => {
      const recentIndex = snapshots.findIndex(
        (item) =>
          sameFormulaValidationToken(item, tokenData) &&
          Date.now() - Date.parse(item.analyzedAt) <= 60_000
      );
      const nextSnapshots =
        recentIndex === -1
          ? [snapshot, ...snapshots]
          : snapshots.map((item, index) =>
              index === recentIndex
                ? {
                    ...snapshot,
                    id: item.id,
                    outcome: item.outcome,
                    note: item.note,
                    outcomeUpdatedAt: item.outcomeUpdatedAt,
                  }
                : item
            );

      if (recentIndex !== -1) status = "Recent snapshot updated";
      return writeStoredFormulaValidationSnapshots(nextSnapshots);
    });
    setFormulaValidationStatus(status);
    window.setTimeout(() => setFormulaValidationStatus(""), 1800);
  }

  function updateFormulaValidationSnapshot(
    id: string,
    updates: Partial<Pick<FormulaValidationSnapshot, "note" | "outcome">>
  ) {
    setFormulaValidationSnapshots((snapshots) =>
      writeStoredFormulaValidationSnapshots(
        snapshots.map((snapshot) =>
          snapshot.id === id
            ? {
                ...snapshot,
                ...updates,
                outcomeUpdatedAt: new Date().toISOString(),
              }
            : snapshot
        )
      )
    );
  }

  function deleteFormulaValidationSnapshot(id: string) {
    setFormulaValidationSnapshots((snapshots) =>
      writeStoredFormulaValidationSnapshots(
        snapshots.filter((snapshot) => snapshot.id !== id)
      )
    );
    setFormulaValidationStatus("Snapshot deleted");
    window.setTimeout(() => setFormulaValidationStatus(""), 1600);
  }

  function clearFormulaValidationLog() {
    const confirmed = window.confirm(
      "Clear all locally stored formula validation snapshots?"
    );
    if (!confirmed) return;

    setFormulaValidationSnapshots(writeStoredFormulaValidationSnapshots([]));
    setFormulaValidationStatus("Validation log cleared");
    window.setTimeout(() => setFormulaValidationStatus(""), 1600);
  }

  function openWatchlistItem(item: WatchlistItem) {
    if (!item.tokenAddress || !item.chain) {
      setWatchlistStatus("Select this token from search to refresh live data.");
      return;
    }

    setToken(item.tokenSymbol);
    setTokenData({
      symbol: item.tokenSymbol,
      rawSymbol: item.tokenSymbol.replace(/^\$/, ""),
      name: item.tokenName,
      chain: item.chain,
      dex: item.dex,
      quote: "USD",
      price: item.price,
      marketCap: item.marketCap,
      liquidity: item.liquidity,
      volume24h: item.volume24h,
      change24h: item.priceChange24h,
      pairAddress: item.pairAddress,
      tokenAddress: item.tokenAddress,
      shortTokenAddress: shortInsiderWalletAddress(item.tokenAddress),
      imageUrl: item.tokenLogo,
      url: "",
    });
    setActiveSection("Overview");
    setWatchlistStatus("Opened local snapshot");
    window.setTimeout(() => setWatchlistStatus(""), 1600);
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
    const requestKey = tokenAnalysisKey(result.chain, result.tokenAddress);

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
        deepLimit: "3",
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
      if (!isActiveAnalysis(requestKey)) return;

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

      const normalizedConviction = normalizeConvictionResult(data.conviction);
      if (
        data.modules?.conviction?.status === "loaded" &&
        normalizedConviction
      ) {
        setExplainableConviction(normalizedConviction);
        setExplainableConvictionState("loaded");
        recordConvictionSnapshot(result, normalizedConviction);
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
      if (!isActiveAnalysis(requestKey)) return;
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
    const requestKey = tokenAnalysisKey(chain, tokenAddress);
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

      if (!isActiveAnalysis(requestKey)) return;
      applyHolderData(holdersData);
    } catch (error) {
      if (!isActiveAnalysis(requestKey)) return;
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
    const requestKey = tokenAnalysisKey(chain, tokenAddress);
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

      if (!isActiveAnalysis(requestKey)) return;
      setTokenIntelligence(data);
      setTokenIntelligenceState("loaded");
      setHolderSummary({
        insiderRisk: data.scores?.insiderRiskScore || 0,
        holderQuality: data.scores?.holderQualityScore || 0,
        conviction: data.scores?.convictionScore || 0,
        activity: data.scores?.activityScore || 0,
      });
    } catch (error) {
      if (!isActiveAnalysis(requestKey)) return;
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
    const requestKey = tokenAnalysisKey(chain, tokenAddress);
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

      if (!isActiveAnalysis(requestKey)) return;
      setClusterData(data);
      setClusterLoadState("loaded");
    } catch (error) {
      if (!isActiveAnalysis(requestKey)) return;
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
    const requestKey = tokenAnalysisKey(result.chain, result.tokenAddress);

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
      deepLimit: "3",
    });

      if (result.marketCap) params.set("marketCapUsd", result.marketCap);
      if (result.liquidity) params.set("liquidityUsd", result.liquidity);
      if (result.volume24h) params.set("volume24hUsd", result.volume24h);
      if (typeof result.change24h === "number") {
        params.set("priceChange24h", String(result.change24h));
      }

      const response = await fetch(`/api/conviction-engine?${params}`);
      const data = await response.json();
      if (!isActiveAnalysis(requestKey)) return;

      if (!response.ok || data.error) {
        throw new Error(
          apiErrorMessage(data.error, "Explainable Conviction request failed.")
        );
      }

      const normalizedConviction = normalizeConvictionResult(data);
      if (!normalizedConviction) {
        throw new Error("Explainable Conviction response was incomplete.");
      }

      setExplainableConviction(normalizedConviction);
      setExplainableConvictionState("loaded");
      recordConvictionSnapshot(result, normalizedConviction);
    } catch (error) {
      if (!isActiveAnalysis(requestKey)) return;
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
    const requestKey = tokenAnalysisKey(chain, tokenAddress);
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

      if (!isActiveAnalysis(requestKey)) return;
      setWalletPersonalityPreviews(data.personalities || []);
      setWalletPersonalityPreviewState("loaded");
    } catch (error) {
      if (!isActiveAnalysis(requestKey)) return;
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
    const requestKey = tokenAnalysisKey(chain, tokenAddress);
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

      if (!isActiveAnalysis(requestKey)) return;
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
      if (!isActiveAnalysis(requestKey)) return;
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

        <section className="h-screen flex-1 overflow-y-auto overflow-x-hidden p-4 pb-8 lg:p-5 lg:pb-8">
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
                  onAddToWatchlist={addCurrentTokenToWatchlist}
                  onToggleMantleMode={() =>
                    setMantleModeEnabled((enabled) => !enabled)
                  }
                  watchlistStatus={watchlistStatus}
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
                        conviction={explainableConviction}
                        formulaV3={convictionFormulaV3}
                        insiderRiskV2={insiderRiskV2}
                        state={explainableConvictionState}
                        tokenFlowSummaryV2={tokenFlowSummaryV2}
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
            <section className="space-y-4">
              <ConvictionHero token={token} tokenData={tokenData} />
              <ExplainableConvictionEnginePanel
                data={explainableConviction}
                error={explainableConvictionError}
                formulaV3={convictionFormulaV3}
                holderIntelligenceSummary={holderIntelligenceSummary}
                insiderRiskV2={insiderRiskV2}
                loadState={explainableConvictionState}
                tokenFlowSummaryV2={tokenFlowSummaryV2}
                walletReputationSummary={walletReputationSummary}
              />
              {SHOW_INTERNAL_FORMULA_VALIDATION_TOOLS && (
                <FormulaValidationLogPanel
                  canSave={Boolean(
                    (tokenData.tokenAddress || tokenData.pairAddress) &&
                      explainableConviction &&
                      convictionFormulaV3
                  )}
                  onClearAll={clearFormulaValidationLog}
                  onDeleteSnapshot={deleteFormulaValidationSnapshot}
                  onSaveCurrent={saveCurrentFormulaValidationSnapshot}
                  onUpdateSnapshot={updateFormulaValidationSnapshot}
                  snapshots={formulaValidationSnapshots}
                  status={formulaValidationStatus}
                />
              )}
              {SHOW_INTERNAL_DEVELOPER_DIAGNOSTICS && (
                <DevCacheStatusPanel
                  data={cacheStatus}
                  error={cacheStatusError}
                  loadState={cacheStatusState}
                  unifiedAnalysis={unifiedAnalysis}
                  unifiedAnalysisError={unifiedAnalysisError}
                  unifiedAnalysisState={unifiedAnalysisState}
                />
              )}
            </section>
          )}

          {activeSection === "Conviction History" && (
            <ConvictionHistorySection
              onClearLocalHistory={clearLocalConvictionHistoryForToken}
              snapshots={convictionSnapshots}
              token={token}
              tokenAddress={tokenData.tokenAddress}
              tokenData={tokenData}
            />
          )}

          {activeSection === "AI vs Human" && (
            <AIHumanArenaMvpSection
              behaviorPreview={behaviorPreview}
              behaviorPreviewError={behaviorPreviewError}
              conviction={explainableConviction}
              convictionError={explainableConvictionError}
              convictionLoadState={explainableConvictionState}
              formulaV3={convictionFormulaV3}
              holderError={holderError}
              holderLoadState={holderLoadState}
              personalities={walletPersonalityPreviews}
              tokenData={tokenData}
              tokenIntelligence={tokenIntelligence}
              unifiedAnalysis={unifiedAnalysis}
              walletRows={walletRows}
            />
          )}

          {activeSection === "Bubble Intelligence" && (
            <BubbleIntelligenceExperience
              behaviorPreview={behaviorPreview}
              clusterData={clusterData}
              clusterError={clusterError}
              clusterLoadState={clusterLoadState}
              conviction={explainableConviction}
              personalityPreviews={walletPersonalityPreviews}
              token={token}
              tokenData={tokenData}
              walletRows={walletRows}
            />
          )}

          {activeSection === "Wallet Flows" && (
            <WalletFlowsMvpSection
              behaviorPreview={behaviorPreview}
              behaviorPreviewError={behaviorPreviewError}
              behaviorPreviewState={behaviorPreviewState}
              conviction={explainableConviction}
              convictionError={explainableConvictionError}
              convictionLoadState={explainableConvictionState}
              holderError={holderError}
              holderLoadState={holderLoadState}
              personalities={walletPersonalityPreviews}
              personalityError={walletPersonalityPreviewError}
              tokenData={tokenData}
              tokenIntelligence={tokenIntelligence}
              tokenFlowSummaryV2={tokenFlowSummaryV2}
              unifiedAnalysis={unifiedAnalysis}
              walletFlowV2Results={walletFlowV2Results}
              walletRows={walletRows}
            />
          )}

          {activeSection === "Insider Scan" && (
            <InsiderScanDashboard
              behaviorPreview={behaviorPreview}
              clusterData={clusterData}
              conviction={explainableConviction}
              convictionError={explainableConvictionError}
              convictionLoadState={explainableConvictionState}
              holderError={holderError}
              holderLoadState={holderLoadState}
              onSelectWallet={openWalletDrawer}
              token={token}
              tokenData={tokenData}
              tokenIntelligence={tokenIntelligence}
              holderIntelligenceMatrix={holderIntelligenceMatrix}
              insiderRiskV2={insiderRiskV2}
              walletRows={walletRows}
            />
          )}

          {activeSection === "Signals" && (
            <SignalsMvpSection
              behaviorPreview={behaviorPreview}
              behaviorPreviewError={behaviorPreviewError}
              conviction={explainableConviction}
              convictionError={explainableConvictionError}
              convictionLoadState={explainableConvictionState}
              holderError={holderError}
              holderLoadState={holderLoadState}
              tokenData={tokenData}
              tokenIntelligence={tokenIntelligence}
              tokenFlowSummaryV2={tokenFlowSummaryV2}
              unifiedAnalysis={unifiedAnalysis}
              walletRows={walletRows}
            />
          )}

          {activeSection === "Watchlist" && (
            <WatchlistMvpSection
              currentTokenData={tokenData}
              items={watchlistItems}
              onAddCurrent={addCurrentTokenToWatchlist}
              onOpenItem={openWatchlistItem}
              onRemoveItem={removeWatchlistItem}
              status={watchlistStatus}
            />
          )}

          {activeSection === "Social Feed" && (
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
                No token pairs found.
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
                    <Image
                      src={result.imageUrl}
                      alt={result.symbol}
                      width={36}
                      height={36}
                      unoptimized
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
                  {result.searchQuality && result.searchQuality !== "strong" && (
                    <span className="mt-2 inline-flex rounded-full border border-amber-100/12 bg-amber-100/[0.045] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-amber-100/48">
                      {result.searchQuality === "low-liquidity"
                        ? "Low liquidity"
                        : "Unverified liquidity"}
                    </span>
                  )}
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
  eyebrow?: string;
  title: React.ReactNode;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className={`${terminalSurfaceClass} p-5`}>
        {eyebrow && <p className={terminalEyebrowClass}>{eyebrow}</p>}
        <div className={`${eyebrow ? "mt-3" : ""} flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between`}>
          <h2 className={`max-w-2xl ${terminalTitleClass}`}>{title}</h2>
          <p className={`max-w-xl ${terminalSubtitleClass}`}>{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function ConvictionHero({
  token,
  tokenData,
}: {
  token: string;
  tokenData: TokenResult;
}) {
  const logoUrl = resolveTokenLogo(tokenData);
  const [failedLogoUrl, setFailedLogoUrl] = useState("");
  const showLogo = Boolean(logoUrl && failedLogoUrl !== logoUrl);

  return (
    <section className="relative min-h-[168px] overflow-hidden rounded-[2rem] border border-white/10 bg-[#06090d]/92 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_42%,rgba(180,240,255,0.16),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-2/3 bg-gradient-to-l from-cyan-100/[0.055] via-cyan-100/[0.02] to-transparent" />
      {showLogo && (
        <div className="pointer-events-none absolute -right-12 top-1/2 h-64 w-64 -translate-y-1/2 opacity-[0.12] blur-3xl">
          <Image
            alt=""
            className="object-cover"
            fill
            sizes="256px"
            src={logoUrl || ""}
            unoptimized
            onError={() => setFailedLogoUrl(logoUrl || "")}
          />
        </div>
      )}
      <div className="relative flex min-h-[128px] items-center justify-between gap-5">
        <div className="min-w-0">
          <h1 className="text-4xl font-semibold tracking-[-0.06em] text-white/92 md:text-5xl">
            Nova Conviction
          </h1>
        </div>
        <div className="relative flex shrink-0 items-center justify-center">
          <div className="absolute h-28 w-28 rounded-full bg-cyan-100/10 blur-2xl" />
          <TokenAvatar
            logoUrl={showLogo ? logoUrl : undefined}
            sizeClass="h-24 w-24 md:h-28 md:w-28"
            token={token}
          />
        </div>
      </div>
    </section>
  );
}

function TerminalSectionHeader({
  badge,
  badgeTone = "cyan",
  children,
  eyebrow,
  subtitle,
  title,
}: {
  badge?: string;
  badgeTone?: TerminalBadgeTone;
  children?: React.ReactNode;
  eyebrow?: string;
  subtitle: string;
  title: string;
}) {
  return (
    <section className={terminalHeaderSurfaceClass}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_76%_0%,rgba(15,97,115,0.14),transparent_44%)]" />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              {eyebrow && <p className={terminalEyebrowClass}>{eyebrow}</p>}
              <h1 className={terminalTitleClass}>{title}</h1>
            </div>
            {badge && <TerminalBadge tone={badgeTone}>{badge}</TerminalBadge>}
          </div>
          <p className={`mt-2 max-w-3xl ${terminalSubtitleClass}`}>{subtitle}</p>
        </div>
        {children}
      </div>
    </section>
  );
}

function TerminalBadge({
  children,
  tone = "cyan",
}: {
  children: React.ReactNode;
  tone?: TerminalBadgeTone;
}) {
  return (
    <span className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.14em] ${terminalBadgeClass(tone)}`}>
      {children}
    </span>
  );
}

function terminalBadgeClass(tone: TerminalBadgeTone) {
  if (tone === "purple") return "border-purple-100/14 bg-purple-100/[0.045] text-purple-100/64";
  if (tone === "warning") return "border-amber-100/14 bg-amber-100/[0.045] text-amber-100/64";
  if (tone === "danger") return "border-red-100/14 bg-red-100/[0.04] text-red-100/64";
  if (tone === "success") return "border-emerald-100/14 bg-emerald-100/[0.045] text-emerald-100/64";
  if (tone === "muted") return "border-white/10 bg-white/[0.035] text-white/46";
  return "border-cyan-100/12 bg-cyan-100/[0.045] text-cyan-100/64";
}

function TerminalStatePanel({
  detail,
  pulse = false,
  title,
  tone = "default",
}: {
  detail: string;
  pulse?: boolean;
  title: string;
  tone?: "default" | "error";
}) {
  return (
    <div className={`${terminalSurfaceClass} p-6 text-center`}>
      {pulse && (
        <motion.div
          animate={{ opacity: [0.35, 1, 0.35] }}
          transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
          className="mx-auto mb-4 h-1.5 w-24 rounded-full bg-cyan-100/35"
        />
      )}
      <p className={`text-sm font-medium ${tone === "error" ? "text-red-100/68" : "text-white/68"}`}>
        {title}
      </p>
      <p className="mx-auto mt-2 max-w-2xl text-xs leading-relaxed text-white/34">
        {detail}
      </p>
    </div>
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

function TokenAvatar({
  logoUrl,
  sizeClass = "h-12 w-12",
  token,
}: {
  logoUrl?: string;
  sizeClass?: string;
  token: string;
}) {
  const [failedLogoUrl, setFailedLogoUrl] = useState("");
  const showLogo = Boolean(logoUrl && failedLogoUrl !== logoUrl);

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-cyan-100/14 bg-cyan-100/[0.055] shadow-[0_0_28px_rgba(34,211,238,0.13)] ${sizeClass}`}
    >
      {showLogo ? (
        <Image
          alt={`${token} logo`}
          className="h-full w-full object-cover"
          fill
          sizes="48px"
          src={logoUrl || ""}
          unoptimized
          onError={() => setFailedLogoUrl(logoUrl || "")}
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
  );
}

function TokenHeader({
  mantleContext,
  onAddToWatchlist,
  onToggleMantleMode,
  token,
  tokenData,
  marketCards,
  watchlistStatus,
}: {
  mantleContext: MantleContext;
  onAddToWatchlist: () => void;
  onToggleMantleMode: () => void;
  token: string;
  tokenData: TokenResult;
  marketCards: { label: string; value: string }[];
  watchlistStatus: string;
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

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] p-4 backdrop-blur-2xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(1,44,59,0.38),transparent_55%)]" />

      <div className="relative flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <TokenAvatar logoUrl={logoUrl} token={token} />
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
              onClick={onAddToWatchlist}
              className="rounded-full border border-purple-100/12 bg-purple-100/[0.045] px-4 py-2 text-xs text-purple-100/68 transition hover:bg-purple-100/[0.075]"
            >
              {watchlistStatus || "Add to Watchlist"}
            </button>
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
  ["botActivityRisk", "Bot Activity Risk"],
  ["freshWalletRisk", "Fresh Wallet Risk"],
  ["rotationRisk", "Rotation Risk"],
] as const;

const convictionHistoryTimeframes: Array<{
  label: string;
  value: ConvictionHistoryTimeframe;
}> = [
  { label: "1H", value: "1h" },
  { label: "1D", value: "1d" },
  { label: "7D", value: "7d" },
  { label: "30D", value: "30d" },
  { label: "All", value: "all" },
];

function convictionHistoryTokenKey(chain?: string, tokenAddress?: string) {
  if (!chain || !tokenAddress) return "";
  return `${chain.toLowerCase()}:${tokenAddress.toLowerCase()}`;
}

function isStoredConvictionSnapshot(value: unknown): value is ConvictionSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<ConvictionSnapshot>;

  return Boolean(
    snapshot.snapshotId &&
      snapshot.createdAt &&
      snapshot.chain &&
      snapshot.tokenAddress &&
      typeof snapshot.finalConvictionScore === "number" &&
      snapshot.subScores &&
      typeof snapshot.subScores === "object"
  );
}

function readStoredConvictionHistory() {
  if (typeof window === "undefined") return {};

  try {
    const stored = window.localStorage.getItem(CONVICTION_HISTORY_STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return Object.entries(parsed).reduce<Record<string, ConvictionSnapshot[]>>(
      (history, [key, value]) => {
        if (!Array.isArray(value)) return history;
        const normalizedKey = key.toLowerCase();
        history[normalizedKey] = mergeConvictionSnapshotLists(
          value.filter(isStoredConvictionSnapshot)
        );
        return history;
      },
      {}
    );
  } catch {
    return {};
  }
}

function readStoredConvictionSnapshots(chain?: string, tokenAddress?: string) {
  const key = convictionHistoryTokenKey(chain, tokenAddress);
  if (!key) return [];
  return readStoredConvictionHistory()[key] || [];
}

function writeStoredConvictionSnapshots(
  chain: string,
  tokenAddress: string,
  snapshots: ConvictionSnapshot[]
) {
  if (typeof window === "undefined") return mergeConvictionSnapshotLists(snapshots);
  const key = convictionHistoryTokenKey(chain, tokenAddress);
  const nextSnapshots = mergeConvictionSnapshotLists(snapshots);
  if (!key) return nextSnapshots;

  try {
    const history = readStoredConvictionHistory();
    history[key] = nextSnapshots;
    window.localStorage.setItem(
      CONVICTION_HISTORY_STORAGE_KEY,
      JSON.stringify(history)
    );
  } catch {
    // Local storage can fail in private or restricted browser contexts.
  }

  return nextSnapshots;
}

function clearStoredConvictionSnapshots(chain?: string, tokenAddress?: string) {
  if (typeof window === "undefined") return;
  const key = convictionHistoryTokenKey(chain, tokenAddress);
  if (!key) return;

  try {
    const history = readStoredConvictionHistory();
    delete history[key];
    window.localStorage.setItem(
      CONVICTION_HISTORY_STORAGE_KEY,
      JSON.stringify(history)
    );
  } catch {
    // Local storage can fail in private or restricted browser contexts.
  }
}

const formulaValidationOutcomes: FormulaValidationOutcome[] = [
  "Unknown",
  "Rug",
  "Failed",
  "Neutral",
  "2x+",
  "5x+",
  "10x+",
];

function isFormulaValidationOutcome(
  value: unknown
): value is FormulaValidationOutcome {
  return formulaValidationOutcomes.includes(value as FormulaValidationOutcome);
}

function isStoredFormulaValidationSnapshot(
  value: unknown
): value is FormulaValidationSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<FormulaValidationSnapshot>;

  return Boolean(
    snapshot.id &&
      snapshot.tokenSymbol &&
      snapshot.tokenName &&
      snapshot.chain &&
      snapshot.analyzedAt &&
      typeof snapshot.v1Score === "number" &&
      typeof snapshot.v3Score === "number" &&
      typeof snapshot.holderQualityScore === "number" &&
      typeof snapshot.structuralSafetyScore === "number" &&
      typeof snapshot.marketIntegrityScore === "number" &&
      isFormulaValidationOutcome(snapshot.outcome)
  );
}

function sortFormulaValidationSnapshots(
  snapshots: FormulaValidationSnapshot[]
) {
  return [...snapshots]
    .sort((left, right) => Date.parse(right.analyzedAt) - Date.parse(left.analyzedAt))
    .slice(0, FORMULA_VALIDATION_MAX_SNAPSHOTS);
}

function readStoredFormulaValidationSnapshots() {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(FORMULA_VALIDATION_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return sortFormulaValidationSnapshots(
      parsed.filter(isStoredFormulaValidationSnapshot)
    );
  } catch {
    return [];
  }
}

function writeStoredFormulaValidationSnapshots(
  snapshots: FormulaValidationSnapshot[]
) {
  const nextSnapshots = sortFormulaValidationSnapshots(snapshots);
  if (typeof window === "undefined") return nextSnapshots;

  try {
    window.localStorage.setItem(
      FORMULA_VALIDATION_STORAGE_KEY,
      JSON.stringify(nextSnapshots)
    );
  } catch {
    // Local storage can fail in private or restricted browser contexts.
  }

  return nextSnapshots;
}

function sameFormulaValidationToken(
  snapshot: FormulaValidationSnapshot,
  tokenData: TokenResult
) {
  const snapshotAddress = snapshot.tokenAddress.toLowerCase();
  const tokenAddress = (tokenData.tokenAddress || "").toLowerCase();
  const snapshotPair = snapshot.pairAddress.toLowerCase();
  const tokenPair = (tokenData.pairAddress || "").toLowerCase();

  if (snapshotAddress && tokenAddress) return snapshotAddress === tokenAddress;
  if (snapshotPair && tokenPair) return snapshotPair === tokenPair;

  return (
    snapshot.chain.toLowerCase() === tokenData.chain.toLowerCase() &&
    snapshot.tokenSymbol.toLowerCase() ===
      (tokenData.rawSymbol || tokenData.symbol).toLowerCase()
  );
}

function tokenAnalysisKey(chain: string, tokenAddress: string) {
  return `${chain.toLowerCase()}:${tokenAddress.toLowerCase()}`;
}

function visiblePrimaryConvictionScore(
  formulaV3: ConvictionFormulaV3Result | null,
  conviction: ExplainableConvictionData | null
) {
  return formulaV3?.finalConvictionScoreV3 ?? conviction?.finalConvictionScore;
}

function buildFormulaValidationSnapshot({
  conviction,
  formulaV2,
  formulaV3,
  tokenData,
}: {
  conviction: ExplainableConvictionData;
  formulaV2: ConvictionFormulaV2Result | null;
  formulaV3: ConvictionFormulaV3Result;
  tokenData: TokenResult;
}): FormulaValidationSnapshot {
  const analyzedAt = new Date().toISOString();

  return {
    id: `${tokenData.chain || "chain"}:${
      tokenData.tokenAddress || tokenData.pairAddress || tokenData.symbol
    }:${Date.now()}`,
    tokenSymbol: tokenData.rawSymbol || tokenData.symbol,
    tokenName: tokenData.name,
    tokenLogo: resolveTokenLogo(tokenData),
    chain: tokenData.chain,
    tokenAddress: tokenData.tokenAddress || "",
    pairAddress: tokenData.pairAddress || "",
    analyzedAt,
    v1Score: Math.round(conviction.finalConvictionScore),
    v2Score:
      typeof formulaV2?.finalConvictionScoreV2 === "number"
        ? formulaV2.finalConvictionScoreV2
        : undefined,
    v3Score: formulaV3.finalConvictionScoreV3,
    holderQualityScore: formulaV3.pillarScores.holderQualityScore,
    structuralSafetyScore: formulaV3.pillarScores.structuralSafetyScore,
    marketIntegrityScore: formulaV3.pillarScores.marketIntegrityScore,
    v3RiskCapsApplied: formulaV3.riskCapsApplied.slice(0, 4),
    v3PositiveDrivers: formulaV3.positiveDrivers.slice(0, 4),
    v3LimitingFactors: formulaV3.limitingFactors.slice(0, 4),
    v3MissingEvidence: formulaV3.missingEvidence.slice(0, 4),
    outcome: "Unknown",
    note: "",
  };
}

function convictionSnapshotSignature(snapshot: ConvictionSnapshot) {
  const scoreKeys = [
    ...convictionHistoryCoreScores.map(([key]) => key),
    ...convictionHistoryRiskScores.map(([key]) => key),
  ];

  return JSON.stringify({
    finalConvictionScore: Math.round(snapshot.finalConvictionScore),
    scores: scoreKeys.map((key) => [
      key,
      typeof snapshot.subScores[key] === "number"
        ? Math.round(snapshot.subScores[key] || 0)
        : null,
    ]),
    confidenceScore:
      typeof snapshot.dataConfidence?.score === "number"
        ? Math.round(snapshot.dataConfidence.score)
        : null,
    confidenceLabel: snapshot.dataConfidence?.label || null,
  });
}

function isRecentConvictionDuplicate(
  previous: ConvictionSnapshot,
  current: ConvictionSnapshot
) {
  const elapsed =
    Date.parse(current.createdAt) - Date.parse(previous.createdAt);

  return (
    convictionHistoryTokenKey(previous.chain, previous.tokenAddress) ===
      convictionHistoryTokenKey(current.chain, current.tokenAddress) &&
    elapsed >= 0 &&
    elapsed < 60_000 &&
    convictionSnapshotSignature(previous) === convictionSnapshotSignature(current)
  );
}

function mergeConvictionSnapshotLists(snapshots: ConvictionSnapshot[]) {
  const ordered = snapshots
    .filter(isStoredConvictionSnapshot)
    .map((snapshot) => createConvictionSnapshot(snapshot))
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
  const merged: ConvictionSnapshot[] = [];

  ordered.forEach((snapshot) => {
    const existingById = merged.find(
      (candidate) => candidate.snapshotId === snapshot.snapshotId
    );
    if (existingById) return;

    const latest = merged[merged.length - 1];
    if (latest && isRecentConvictionDuplicate(latest, snapshot)) return;

    merged.push(snapshot);
  });

  return merged.slice(-CONVICTION_HISTORY_MAX_SNAPSHOTS);
}

function hasCanonicalConvictionPayload(data: ExplainableConvictionData) {
  return Boolean(
    Number.isFinite(data.finalConvictionScore) &&
      data.subScores &&
      data.dataConfidence &&
      typeof data.dataConfidence.score === "number" &&
      data.dataConfidence.label &&
      data.explanation &&
      data.explanation.headline
  );
}

function normalizeWalletReputationAddress(value?: string) {
  return (value || "").trim().toLowerCase();
}

function walletReputationAddress(row: WalletRow) {
  return (
    row.fullAddress ||
    row.walletAddress ||
    row.ownerAddress ||
    row.address ||
    row.wallet
  );
}

function buildWalletReputationResults({
  behaviorProfiles,
  clusterData,
  conviction,
  personalityPreviews,
  walletRows,
}: {
  behaviorProfiles: WalletBehaviorProfile[];
  clusterData: WalletClusterData | null;
  conviction: ExplainableConvictionData | null;
  personalityPreviews: WalletPersonalityPreview[];
  walletRows: WalletRow[];
}) {
  const profileMap = new Map(
    behaviorProfiles.map((profile) => [
      normalizeWalletReputationAddress(profile.walletAddress),
      profile,
    ])
  );
  const personalityMap = new Map(
    personalityPreviews.map((personality) => [
      normalizeWalletReputationAddress(personality.walletAddress),
      personality,
    ])
  );
  const deepMap = new Map(
    (conviction?.deepBehavior?.walletResults || []).map((result) => [
      normalizeWalletReputationAddress(result.walletAddress),
      result,
    ])
  );
  const bundleWallets = new Set(
    (conviction?.bundleDetection?.detectedGroups || []).flatMap((group) =>
      group.wallets.map(normalizeWalletReputationAddress)
    )
  );
  const clusterStats = new Map<
    string,
    { relationshipCount: number; suspiciousClusterOverlap: boolean }
  >();

  clusterData?.clusters.forEach((cluster) => {
    const suspiciousCluster =
      cluster.relationshipType === "Possible Coordination" ||
      cluster.riskLevel === "Elevated";

    cluster.wallets.forEach((wallet) => {
      const key = normalizeWalletReputationAddress(wallet.walletAddress);
      const existing =
        clusterStats.get(key) || {
          relationshipCount: 0,
          suspiciousClusterOverlap: false,
        };
      clusterStats.set(key, {
        relationshipCount:
          existing.relationshipCount +
          (cluster.relationshipType === "Isolated" ? 0 : 1),
        suspiciousClusterOverlap:
          existing.suspiciousClusterOverlap || suspiciousCluster,
      });
    });
  });

  return walletRows.slice(0, 25).map((row) => {
    const address = walletReputationAddress(row);
    const key = normalizeWalletReputationAddress(address);
    const profile = profileMap.get(key);
    const personality = personalityMap.get(key);
    const deep = deepMap.get(key);
    const cluster = clusterStats.get(key);
    const behaviorLabel =
      profile?.behaviorClass || row.estimatedBehavior || row.type || row.label;
    const input: WalletReputationInput = {
      walletAddress: address,
      holderRank: row.rank,
      ownershipPercentage: readPercentage(row.ownershipPercentage),
      balance: row.balance,
      isContract:
        behaviorLabel?.toLowerCase().includes("contract") ||
        row.type?.toLowerCase().includes("contract") ||
        undefined,
      activityScore:
        profile?.activityVelocityScore ??
        profile?.activityScore ??
        personality?.personalityScores.activity ??
        row.score,
      dormancyScore: profile?.dormancyRiskScore,
      concentrationScore:
        profile?.concentrationRiskScore ?? profile?.concentrationScore,
      reliabilityScore:
        profile?.behaviorReliabilityScore ??
        personality?.personalityScores.reliability ??
        profile?.dataConfidence,
      personalityLabel: personality?.personalityType,
      behaviorLabel,
      accumulationPressure: deep?.accumulationPressure,
      distributionPressure: deep?.distributionPressure,
      rotationRisk:
        deep?.rotationBehaviorRisk ?? personality?.personalityScores.rotation,
      freshWalletRisk: conviction?.subScores.freshWalletRisk,
      relationshipCount: cluster?.relationshipCount,
      clusterMembership: Boolean(cluster),
      suspiciousClusterOverlap: cluster?.suspiciousClusterOverlap,
      bundleGroupMembership: bundleWallets.has(key),
      fundingSimilarity: conviction?.bundleDetection?.fundingSimilarityScore,
      lastActivityAgeDays: profile?.daysSinceLastActive ?? undefined,
    };

    return calculateWalletReputation(input);
  });
}

function buildHolderIntelligenceMatrix({
  behaviorProfiles,
  clusterData,
  conviction,
  personalityPreviews,
  tokenData,
  walletReputationResults,
  walletRows,
}: {
  behaviorProfiles: WalletBehaviorProfile[];
  clusterData: WalletClusterData | null;
  conviction: ExplainableConvictionData | null;
  personalityPreviews: WalletPersonalityPreview[];
  tokenData: TokenResult;
  walletReputationResults: WalletReputationResult[];
  walletRows: WalletRow[];
}) {
  const profileMap = new Map(
    behaviorProfiles.map((profile) => [
      normalizeWalletReputationAddress(profile.walletAddress),
      profile,
    ])
  );
  const personalityMap = new Map(
    personalityPreviews.map((personality) => [
      normalizeWalletReputationAddress(personality.walletAddress),
      personality,
    ])
  );
  const deepMap = new Map(
    (conviction?.deepBehavior?.walletResults || []).map((result) => [
      normalizeWalletReputationAddress(result.walletAddress),
      result,
    ])
  );
  const reputationMap = new Map(
    walletReputationResults.map((reputation) => [
      normalizeWalletReputationAddress(reputation.walletAddress),
      reputation,
    ])
  );
  const bundleWallets = new Set(
    (conviction?.bundleDetection?.detectedGroups || []).flatMap((group) =>
      group.wallets.map(normalizeWalletReputationAddress)
    )
  );
  const clusterStats = new Map<
    string,
    {
      relationshipCount: number;
      clusterMembership: boolean;
      clusterLabel?: string;
      clusterConfidence?: "High" | "Medium" | "Low";
    }
  >();

  clusterData?.clusters.forEach((cluster) => {
    cluster.wallets.forEach((wallet) => {
      const key = normalizeWalletReputationAddress(wallet.walletAddress);
      const existing = clusterStats.get(key) || {
        relationshipCount: 0,
        clusterMembership: false,
      };
      const relationshipCount =
        existing.relationshipCount +
        (cluster.relationshipType === "Isolated" ? 0 : 1);

      clusterStats.set(key, {
        relationshipCount,
        clusterMembership: existing.clusterMembership || relationshipCount > 0,
        clusterLabel:
          existing.clusterLabel ||
          (cluster.relationshipType === "Isolated"
            ? undefined
            : cluster.relationshipType),
        clusterConfidence: existing.clusterConfidence || cluster.confidence,
      });
    });
  });

  const inputs: HolderIntelligenceInput[] = walletRows.slice(0, 25).map((row) => {
    const address = walletReputationAddress(row);
    const key = normalizeWalletReputationAddress(address);
    const profile = profileMap.get(key);
    const personality = personalityMap.get(key);
    const deep = deepMap.get(key);
    const reputation = reputationMap.get(key);
    const cluster = clusterStats.get(key);
    const behaviorLabel =
      profile?.behaviorClass || row.estimatedBehavior || row.type || row.label;
    const bundleMember = bundleWallets.has(key);

    return {
      walletAddress: address,
      shortAddress: shortInsiderWalletAddress(address || row.wallet),
      holderRank: row.rank,
      balance: row.balance,
      ownershipPercentage: readPercentage(row.ownershipPercentage),
      isContract:
        behaviorLabel?.toLowerCase().includes("contract") ||
        row.type?.toLowerCase().includes("contract") ||
        undefined,
      isExchange: row.type?.toLowerCase().includes("exchange") || undefined,
      tokenSymbol: tokenData.rawSymbol || tokenData.symbol,
      tokenAddress: tokenData.tokenAddress,
      chain: tokenData.chain,
      activityScore:
        profile?.activityVelocityScore ??
        profile?.activityScore ??
        personality?.personalityScores.activity ??
        row.score,
      dormancyScore: profile?.dormancyRiskScore,
      concentrationScore:
        profile?.concentrationRiskScore ?? profile?.concentrationScore,
      reliabilityScore:
        profile?.behaviorReliabilityScore ??
        personality?.personalityScores.reliability ??
        profile?.dataConfidence,
      behaviorLabel,
      personalityLabel: personality?.personalityType,
      confidenceLabel: profile
        ? profile.dataQuality === "good"
          ? "High"
          : profile.dataQuality === "partial"
            ? "Medium"
            : "Low"
        : personality?.confidenceLabel,
      accumulationPressure: deep?.accumulationPressure,
      distributionPressure: deep?.distributionPressure,
      rotationRisk:
        deep?.rotationBehaviorRisk ?? personality?.personalityScores.rotation,
      averageDistributionPressure:
        conviction?.deepBehavior?.summary.averageDistributionPressure,
      averageAccumulationPressure:
        conviction?.deepBehavior?.summary.averageAccumulationPressure,
      recentActivityScore: profile?.activityVelocityScore,
      hasTokenTransferEvidence: Boolean(deep),
      relationshipCount: cluster?.relationshipCount,
      clusterMembership: cluster?.clusterMembership,
      clusterLabel: cluster?.clusterLabel,
      clusterConfidence: cluster?.clusterConfidence,
      bundleGroupMembership: bundleMember,
      fundingSimilarity: bundleMember
        ? conviction?.bundleDetection?.fundingSimilarityScore
        : undefined,
      sharedCounterpartyEvidence: bundleMember
        ? Boolean(conviction?.bundleDetection?.sharedCounterpartyScore)
        : undefined,
      sameWindowActivityEvidence: bundleMember
        ? Boolean(conviction?.bundleDetection?.sameWindowActivityScore)
        : undefined,
      reputationScore: reputation?.reputationScore,
      reputationQualityTier: reputation?.qualityTier,
      reputationWalletClass: reputation?.walletClass,
      reputationConvictionContribution: reputation?.convictionContribution,
      reputationRiskContribution: reputation?.riskContribution,
      reputationPositives: reputation?.positives,
      reputationNegatives: reputation?.negatives,
      reputationConfidence: reputation?.confidence,
    };
  });

  return calculateHolderIntelligenceMatrix(inputs);
}

function buildWalletFlowV2Results({
  behaviorProfiles,
  conviction,
  holderIntelligenceMatrix,
  walletReputationResults,
  walletRows,
}: {
  behaviorProfiles: WalletBehaviorProfile[];
  conviction: ExplainableConvictionData | null;
  holderIntelligenceMatrix: HolderIntelligenceProfile[];
  walletReputationResults: WalletReputationResult[];
  walletRows: WalletRow[];
}) {
  const profileMap = new Map(
    behaviorProfiles.map((profile) => [
      normalizeWalletReputationAddress(profile.walletAddress),
      profile,
    ])
  );
  const holderMap = new Map(
    holderIntelligenceMatrix.map((holder) => [
      normalizeWalletReputationAddress(holder.walletAddress),
      holder,
    ])
  );
  const reputationMap = new Map(
    walletReputationResults.map((reputation) => [
      normalizeWalletReputationAddress(reputation.walletAddress),
      reputation,
    ])
  );
  const deepMap = new Map(
    (conviction?.deepBehavior?.walletResults || []).map((result) => [
      normalizeWalletReputationAddress(result.walletAddress),
      result,
    ])
  );

  return walletRows.slice(0, 25).map((row) => {
    const address = walletReputationAddress(row);
    const key = normalizeWalletReputationAddress(address);

    return calculateWalletFlowV2({
      walletAddress: address,
      ownershipPercentage: readPercentage(row.ownershipPercentage),
      deepBehavior: deepMap.get(key),
      holderIntelligence: holderMap.get(key),
      walletReputation: reputationMap.get(key),
      walletProfile: profileMap.get(key),
      convictionSubscores: conviction?.subScores,
    });
  });
}

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

function historyConfidenceValue(snapshot: ConvictionSnapshot) {
  if (snapshot.dataConfidence?.score !== undefined) {
    return `${Math.round(snapshot.dataConfidence.score)} · ${
      snapshot.dataConfidence.label || "Unlabeled"
    }`;
  }

  return snapshot.dataConfidence?.label || "Unavailable";
}

function formatSnapshotTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function convictionReplayWindowText(timeframe: ConvictionHistoryTimeframe) {
  if (timeframe === "all") return "Across all stored snapshots";
  return `Over the selected ${timeframe.toUpperCase()} window`;
}

function convictionReplayComparisonSubtitle(
  timeframe: ConvictionHistoryTimeframe
) {
  if (timeframe === "all") {
    return "Comparing the latest snapshot with the earliest stored snapshot.";
  }

  return `Comparing latest snapshot with earliest stored snapshot inside the last ${timeframe.toUpperCase()}.`;
}

function convictionHistoryStatusText({
  latestSnapshot,
  snapshotCount,
  timeframe,
}: {
  latestSnapshot: ConvictionSnapshot | null;
  snapshotCount: number;
  timeframe: ConvictionHistoryTimeframe;
}) {
  const latestText = latestSnapshot
    ? `latest ${formatSnapshotTime(latestSnapshot.createdAt)}`
    : "no local snapshot yet";
  const countText = `${snapshotCount} stored snapshot${
    snapshotCount === 1 ? "" : "s"
  }`;

  return `${countText} · ${latestText} · ${timeframe.toUpperCase()} · Stored locally`;
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
      ? `${label} decreased by ${Math.abs(
          delta
        )} points, reducing measured structural pressure.`
      : `${label} increased by ${Math.abs(
          delta
        )} points, adding measured structural pressure.`;
  }

  return delta > 0
    ? `${label} improved by ${Math.abs(delta)} points.`
    : `${label} weakened by ${Math.abs(delta)} points.`;
}

function buildConvictionReplayExplanation({
  comparison,
  drivers,
  timeframe,
}: {
  comparison: ReturnType<typeof compareConvictionSnapshots>;
  drivers: ConvictionReplayDriver[];
  timeframe: ConvictionHistoryTimeframe;
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
    return `${convictionReplayWindowText(
      timeframe
    )}, conviction remained stable; no major measured driver changed between stored snapshots.`;
  }

  return `${convictionReplayWindowText(timeframe)}, conviction ${direction} from ${
    comparison.previousScore
  } to ${comparison.currentScore}${
    measuredDrivers.length
      ? ` because ${formatMeasuredDriverList(measuredDrivers)}`
      : ""
  }.`;
}

function formatMeasuredDriverList(drivers: string[]) {
  if (drivers.length === 0) return "";
  if (drivers.length === 1) return drivers[0];
  if (drivers.length === 2) return `${drivers[0]} and ${drivers[1]}`;
  return `${drivers.slice(0, -1).join(", ")}, and ${drivers[drivers.length - 1]}`;
}

function ConvictionHistorySection({
  onClearLocalHistory,
  snapshots,
  token,
  tokenAddress,
  tokenData,
}: {
  onClearLocalHistory: () => void;
  snapshots: ConvictionSnapshot[];
  token: string;
  tokenAddress?: string;
  tokenData: TokenResult;
}) {
  const [timeframe, setTimeframe] = useState<ConvictionHistoryTimeframe>(() =>
    snapshots.length > 4 ? "7d" : "all"
  );
  const selection = useMemo(
    () => selectComparisonSnapshots(snapshots, timeframe),
    [snapshots, timeframe]
  );
  const orderedSnapshots = selection.snapshotsInRange;
  const current = selection.currentSnapshot || null;
  const previous = selection.previousSnapshot || null;
  const statusText = convictionHistoryStatusText({
    latestSnapshot: current,
    snapshotCount: snapshots.length,
    timeframe,
  });
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
  const weakestCurrentCore = current
    ? convictionHistoryCoreScores
        .map(([key, label]) => ({
          label,
          value: snapshotScore(current, key),
        }))
        .filter((score) => typeof score.value === "number")
        .sort((left, right) => (left.value || 0) - (right.value || 0))[0]
    : null;
  const highestCurrentRisk = current
    ? convictionHistoryRiskScores
        .map(([key, label]) => ({
          label,
          value: snapshotScore(current, key),
        }))
        .filter((score) => typeof score.value === "number")
        .sort((left, right) => (right.value || 0) - (left.value || 0))[0]
    : null;
  const currentLimiter =
    highestCurrentRisk &&
    (!weakestCurrentCore ||
      highestCurrentRisk.value! > 100 - weakestCurrentCore.value!)
      ? {
          label: highestCurrentRisk.label,
          value: highestCurrentRisk.value,
          type: "risk" as const,
        }
      : weakestCurrentCore
      ? {
          label: weakestCurrentCore.label,
          value: weakestCurrentCore.value,
          type: "core" as const,
        }
      : null;
  const measuredReplayExplanation =
    comparison
      ? buildConvictionReplayExplanation({
          comparison,
          timeframe,
          drivers:
            comparison.direction === "decreased"
              ? allNegativeDrivers
              : allPositiveDrivers,
        })
      : "";
  const confidenceDelta =
    previous?.dataConfidence?.score !== undefined &&
    current?.dataConfidence?.score !== undefined
      ? Math.round(current.dataConfidence.score - previous.dataConfidence.score)
      : null;

  if (!tokenAddress) {
    return (
      <SectionShell
        eyebrow="Conviction History"
        title="Explainable Conviction Replay"
        description="A forensic timeline built only from successful local conviction snapshots."
      >
        <ConvictionHistoryTimeframeTabs
          disabled
          onSelect={setTimeframe}
          selected={timeframe}
        />
        <HistoryEmptyState text="Select a token to begin storing local conviction snapshots. NovaOS memory starts when this token is analyzed." />
      </SectionShell>
    );
  }

  if (!current) {
    return (
      <SectionShell
        eyebrow="Conviction History"
        title={
          <span className="flex items-center gap-3">
            <TokenAvatar
              logoUrl={resolveTokenLogo(tokenData)}
              sizeClass="h-10 w-10"
              token={token}
            />
            <span>{token} Conviction Replay</span>
          </span>
        }
        description="A forensic timeline built only from successful local conviction snapshots."
      >
        <ConvictionHistoryTimeframeTabs
          disabled
          onSelect={setTimeframe}
          selected={timeframe}
        />
        <HistoryLocalStatus text={statusText} />
        <HistoryEmptyState text="Analyze this token to create the first local conviction snapshot. NovaOS memory starts when this token is analyzed." />
      </SectionShell>
    );
  }

  return (
    <SectionShell
      eyebrow="Conviction History"
      title={
        <span className="flex items-center gap-3">
          <TokenAvatar
            logoUrl={current.tokenLogo || resolveTokenLogo(tokenData)}
            sizeClass="h-10 w-10"
            token={token}
          />
          <span>{token} Conviction Replay</span>
        </span>
      }
      description="Local snapshots only. No interpolation, generated events, or speculative narrative."
    >
      <ConvictionHistoryTimeframeTabs
        disabled={snapshots.length === 0}
        onSelect={setTimeframe}
        selected={timeframe}
      />
      <HistoryLocalStatus
        onClear={onClearLocalHistory}
        showClear={snapshots.length > 0}
        text={statusText}
      />

      <div className="grid gap-4 xl:grid-cols-[0.88fr_1.12fr]">
        <section className="rounded-[2rem] border border-cyan-100/10 bg-cyan-100/[0.025] p-5 shadow-[0_0_70px_rgba(34,211,238,0.035)]">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-100/44">
            Conviction Timeline
          </p>
          <p className="mt-2 text-xs text-white/32">
            {selection.rangeLabel} · Comparing real stored snapshots only.
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
              value={historyConfidenceValue(current)}
            />
            <HistoryStat
              label="Confidence Change"
              value={
                comparison && previous
                  ? `${historyConfidenceValue(previous)} › ${historyConfidenceValue(
                      current
                    )}${
                      confidenceDelta !== null
                        ? ` (${signedHistoryDelta(confidenceDelta)})`
                        : ""
                    }`
                  : "Baseline"
              }
            />
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.025] p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-100/44">
            Score Evolution
          </p>
          <div className="mt-4 space-y-2">
            {orderedSnapshots.map((snapshot, snapshotIndex) => {
              const earlierSnapshot =
                snapshotIndex > 0 ? orderedSnapshots[snapshotIndex - 1] : null;
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
        <HistoryTimeframeLockedState
          current={current}
          reason={
            selection.reason ||
            "No earlier stored snapshot inside the selected range."
          }
          snapshotCount={orderedSnapshots.length}
          timeframe={timeframe}
        />
      ) : (
        <>
          <p className="px-2 text-xs leading-relaxed text-white/34">
            {convictionReplayComparisonSubtitle(timeframe)}
          </p>
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
                  items={allPositiveDrivers.map((driver) => driver.reason)}
                />
                <HistoryMeasuredList
                  title="Primary negative drivers"
                  items={allNegativeDrivers.map((driver) => driver.reason)}
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
                  allPositiveDrivers[0]
                    ? `${allPositiveDrivers[0].label} ${signedHistoryDelta(allPositiveDrivers[0].delta)}`
                    : "None"
                }
              />
              <ForensicCard
                label="Largest negative contribution"
                value={
                  allNegativeDrivers[0]
                    ? `${allNegativeDrivers[0].label} ${signedHistoryDelta(allNegativeDrivers[0].delta)}`
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
                    ? `Current limiting factor: ${currentLimiter.label} at ${
                        currentLimiter.value
                      }/100${currentLimiter.type === "risk" ? " risk" : ""}.`
                    : "Unavailable"
                }
              />
            </div>
          </section>
          <p className="px-2 text-xs leading-relaxed text-white/28">
            Conviction History only compares stored local snapshots. No generated
            events or interpolated timeline points.
          </p>
        </>
      )}
    </SectionShell>
  );
}

function HistoryEmptyState({ text }: { text: string }) {
  return (
    <TerminalStatePanel
      title="No replay data available yet."
      detail={`${text} Conviction History never creates synthetic events or interpolated timeline points.`}
    />
  );
}

function HistoryLocalStatus({
  onClear,
  showClear = false,
  text,
}: {
  onClear?: () => void;
  showClear?: boolean;
  text: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-white/8 bg-black/16 px-4 py-3">
      <p className="text-xs text-white/38">{text}</p>
      {showClear && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="rounded-full border border-white/8 bg-white/[0.025] px-3 py-1.5 text-xs text-white/32 transition hover:border-amber-100/16 hover:text-amber-100/58"
        >
          Clear local history for this token
        </button>
      )}
    </div>
  );
}

function ConvictionHistoryTimeframeTabs({
  disabled,
  onSelect,
  selected,
}: {
  disabled: boolean;
  onSelect: (timeframe: ConvictionHistoryTimeframe) => void;
  selected: ConvictionHistoryTimeframe;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] border border-white/10 bg-white/[0.025] px-4 py-3">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-100/42">
          Replay Window
        </p>
        <p className="mt-1 text-xs text-white/30">
          {disabled
            ? "Replay requires at least two real snapshots."
            : "Choose a measured snapshot range."}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {convictionHistoryTimeframes.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(option.value)}
            className={`rounded-full border px-3 py-1.5 text-xs transition ${
              option.value === selected
                ? "border-cyan-100/18 bg-cyan-100/[0.07] text-cyan-50/76"
                : "border-white/8 bg-black/16 text-white/36 hover:border-cyan-100/12 hover:text-white/58"
            } ${disabled ? "cursor-not-allowed opacity-45" : ""}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function HistoryTimeframeLockedState({
  current,
  reason,
  snapshotCount,
  timeframe,
}: {
  current: ConvictionSnapshot;
  reason: string;
  snapshotCount: number;
  timeframe: ConvictionHistoryTimeframe;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="rounded-[2rem] border border-cyan-100/10 bg-cyan-100/[0.025] p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-100/44">
          Baseline Snapshot Stored Locally
        </p>
        <p className="mt-3 text-lg font-semibold text-white/76">
          Current conviction is {current.finalConvictionScore}.
        </p>
        <p className="mt-3 text-sm font-medium text-cyan-50/62">
          {snapshotCount} / 2 snapshots required for replay
        </p>
        <p className="mt-2 text-sm leading-relaxed text-white/48">
          Baseline snapshot stored locally. Run another successful analysis later to unlock measured change analysis.
        </p>
      </div>

      <div className="rounded-[2rem] border border-white/10 bg-white/[0.025] p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-white/38">
          Replay Locked for This Timeframe
        </p>
        <p className="mt-3 text-sm font-medium text-white/62">
          {convictionReplayWindowText(timeframe)}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-white/48">{reason}</p>
        <p className="mt-3 text-xs leading-relaxed text-white/30">
          NovaOS does not borrow snapshots from outside the selected range and never
          generates interpolated history.
        </p>
      </div>
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
        {previousValue ?? "—"} <span className="px-1 text-white/20">›</span>{" "}
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
                  <span className="text-white/20">›</span>{" "}
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
              Nova Conviction
            </p>
          </div>
        </div>

        <p className="mt-2 max-w-[14rem] text-xs font-light leading-relaxed text-white/36">
          {compact
            ? `${confidenceLabel || "Pending"} confidence`
            : `Nova Conviction uses holder quality, structural safety, and market integrity. ${
                confidenceLabel || "Pending"
              } confidence.`}
        </p>
      </div>
    </div>
  );
}

function OverviewScoreStrip({
  conviction,
  formulaV3,
  insiderRiskV2,
  state,
  tokenFlowSummaryV2,
}: {
  conviction: ExplainableConvictionData | null;
  formulaV3: ConvictionFormulaV3Result | null;
  insiderRiskV2: InsiderRiskV2Result;
  state: HolderLoadState;
  tokenFlowSummaryV2: TokenFlowSummaryV2 | null;
}) {
  const walletFlowScore = tokenFlowSummaryV2
    ? overviewWalletFlowScore(tokenFlowSummaryV2)
    : null;
  const items = [
    [
      "Holder Quality",
      formulaV3?.pillarScores.holderQualityScore,
      formulaV3 ? "Nova Conviction holder quality" : "Holder quality unavailable",
    ],
    [
      "Structural Safety",
      formulaV3?.pillarScores.structuralSafetyScore,
      formulaV3 ? "Nova Conviction structural safety" : "Structural safety unavailable",
    ],
    [
      "Market Integrity",
      formulaV3?.pillarScores.marketIntegrityScore,
      formulaV3 ? "Nova Conviction market integrity" : "Market integrity unavailable",
    ],
    [
      "Wallet Flow",
      walletFlowScore,
      tokenFlowSummaryV2
        ? walletFlowOverviewSubtitle(tokenFlowSummaryV2)
        : "Wallet Flow V2 unavailable",
    ],
    [
      "Insider Risk",
      insiderRiskV2.insiderRiskScore,
      "Insider Mathematics V2 risk pressure",
      true,
    ],
    [
      "Data Confidence",
      conviction?.dataConfidence.score,
      conviction
        ? `${conviction.dataConfidence.label} conviction data confidence`
        : "Conviction data confidence unavailable",
    ],
  ] as const;
  const isPending = state === "loading";

  return (
    <div className="grid h-full min-h-[420px] grid-cols-2 grid-rows-3 gap-3">
      {items.map(([title, score, detail, inverseTone]) => (
        <OverviewScoreOrb
          key={title}
          pending={isPending}
          score={typeof score === "number" ? score : null}
          detail={detail}
          inverseTone={Boolean(inverseTone)}
          title={title}
        />
      ))}
    </div>
  );
}

function overviewWalletFlowScore(summary: TokenFlowSummaryV2) {
  const directionalScore =
    summary.dominantFlow === "Accumulation Dominant"
      ? 70 + Math.max(0, summary.netFlowBias) * 0.25
      : summary.dominantFlow === "Stable / Balanced"
      ? 58
      : summary.dominantFlow === "Data Limited"
      ? 42
      : summary.dominantFlow === "Distribution Dominant"
      ? 48 - Math.max(0, -summary.netFlowBias) * 0.2
      : summary.dominantFlow === "Rotation Heavy"
      ? 44
      : 46;

  return normalizeScore(directionalScore * 0.68 + summary.flowConfidence * 0.32);
}

function walletFlowOverviewSubtitle(summary: TokenFlowSummaryV2) {
  if (summary.dominantFlow === "Stable / Balanced") return "Stable flow profile";
  if (summary.dominantFlow === "Data Limited") return "Flow evidence limited";
  if (summary.dominantFlow === "Accumulation Dominant") return "Accumulation-led flow";
  if (summary.dominantFlow === "Distribution Dominant") return "Distribution pressure visible";
  if (summary.dominantFlow === "Rotation Heavy") return "Rotation-heavy flow";
  if (summary.dominantFlow === "Dormancy Heavy") return "Dormancy-heavy flow";
  return `${summary.dominantFlow} · ${formatScoreValue(summary.flowConfidence)}/100 confidence`;
}

function formatScoreValue(value: number | string | null | undefined, fallback = "—") {
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(Math.round(value)) : fallback;
  }
  if (typeof value === "string" && value.trim()) return value;
  return fallback;
}

function OverviewScoreOrb({
  detail,
  inverseTone,
  pending,
  score,
  title,
}: {
  detail?: string;
  inverseTone?: boolean;
  pending?: boolean;
  score: number | null;
  title: string;
}) {
  const displayScore = pending || score === null ? "—" : score;
  const scoreClass =
    inverseTone && score !== null && score >= 65
      ? "text-amber-100/86"
      : "text-white/90";
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
          <p className={`text-2xl font-medium tracking-[-0.06em] drop-shadow-[0_0_16px_rgba(180,240,255,0.24)] ${scoreClass}`}>
            {formatScoreValue(displayScore)}
          </p>
        </div>
      </div>

      <p className="relative z-10 mt-2 max-w-[7.5rem] truncate text-center text-[0.68rem] font-light text-white/62">
        {title}
      </p>
      <p className="relative z-10 mt-1 line-clamp-2 max-w-[8.6rem] text-center text-[0.6rem] leading-snug text-white/30">
        {pending ? "Loading" : detail}
      </p>
    </div>
  );
}

function ExplainableConvictionEnginePanel({
  data,
  error,
  formulaV3,
  holderIntelligenceSummary,
  insiderRiskV2,
  loadState,
  tokenFlowSummaryV2,
  walletReputationSummary,
}: {
  data: ExplainableConvictionData | null;
  error: string;
  formulaV3: ConvictionFormulaV3Result | null;
  holderIntelligenceSummary: HolderIntelligenceSummary | null;
  insiderRiskV2: InsiderRiskV2Result;
  loadState: HolderLoadState;
  tokenFlowSummaryV2: TokenFlowSummaryV2 | null;
  walletReputationSummary: TokenWalletReputationSummary | null;
}) {
  if (loadState === "loaded" && data) {
    return (
      <NovaConvictionModelView
        data={data}
        formulaV3={formulaV3}
        holderIntelligenceSummary={holderIntelligenceSummary}
        insiderRiskV2={insiderRiskV2}
        tokenFlowSummaryV2={tokenFlowSummaryV2}
        walletReputationSummary={walletReputationSummary}
      />
    );
  }

  return (
    <Panel title="Nova Conviction" tag="Nova Conviction Model">
      {loadState === "idle" && (
        <BehaviorPreviewState>
          Select a token to run Nova Conviction.
        </BehaviorPreviewState>
      )}

      {loadState === "loading" && <ExplainableConvictionSkeleton />}

      {loadState === "error" && (
        <BehaviorPreviewState tone="error">
          {error || "Explainable Conviction is unavailable right now."}
        </BehaviorPreviewState>
      )}
    </Panel>
  );
}

function NovaConvictionModelView({
  data,
  formulaV3,
  holderIntelligenceSummary,
  insiderRiskV2,
  tokenFlowSummaryV2,
  walletReputationSummary,
}: {
  data: ExplainableConvictionData;
  formulaV3: ConvictionFormulaV3Result | null;
  holderIntelligenceSummary: HolderIntelligenceSummary | null;
  insiderRiskV2: InsiderRiskV2Result;
  tokenFlowSummaryV2: TokenFlowSummaryV2 | null;
  walletReputationSummary: TokenWalletReputationSummary | null;
}) {
  const finalScore = Math.round(
    formulaV3?.finalConvictionScoreV3 ?? data.finalConvictionScore
  );
  const pillarCards = buildNovaConvictionPillars({ data, formulaV3 });
  const strongestSupport = pillarCards.reduce(
    (best, pillar) => (!best || pillar.score > best.score ? pillar : best),
    pillarCards[0]
  );
  const mainLimiter = pillarCards.reduce(
    (weakest, pillar) =>
      !weakest || pillar.score < weakest.score ? pillar : weakest,
    pillarCards[0]
  );
  const convictionLabel = novaConvictionLabel(finalScore);
  const thesis = buildNovaConvictionThesis({
    finalScore,
    strongestSupport,
    mainLimiter,
  });
  const pillarAnalyses = buildNovaPillarAnalyses({
    data,
    formulaV3,
    holderIntelligenceSummary,
    insiderRiskV2,
    tokenFlowSummaryV2,
    walletReputationSummary,
  });
  const confidenceScore = Math.round(data.dataConfidence.score);
  const confidenceContextLabel =
    data.dataConfidence.label || confidenceScoreLabel(confidenceScore);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-cyan-100/12 bg-cyan-100/[0.025] p-5 shadow-[0_0_40px_rgba(103,232,249,0.06)]">
        <div className="grid gap-6 xl:grid-cols-[0.54fr_1.46fr] xl:items-center">
          <div>
            <p className="text-[0.64rem] uppercase tracking-[0.22em] text-cyan-100/45">
              Nova Conviction Model
            </p>
            <div className="mt-4 flex items-end gap-2">
              <p className="text-7xl font-light tracking-[-0.065em] text-white md:text-8xl">
                {finalScore}
              </p>
              <p className="pb-3 text-sm text-white/35">/100</p>
            </div>
            <p className="mt-3 text-lg font-medium text-cyan-50/78">
              {convictionLabel}
            </p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-cyan-100/70 shadow-[0_0_18px_rgba(180,240,255,0.4)]"
                style={{
                  width: `${normalizeScore(finalScore)}%`,
                }}
              />
            </div>
          </div>
          <div className="max-w-3xl xl:pl-2">
            <p className="text-xs uppercase tracking-[0.18em] text-white/34">
              Conviction Summary
            </p>
            <p className="mt-3 text-lg leading-relaxed text-white/74">
              {thesis}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-white/38">
          Why NovaOS reached this conclusion
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <ConvictionReasonCard
            detail={pillarReasonDetail(strongestSupport.label, "support")}
            label="Strongest Contributor"
            score={strongestSupport.score}
            title={strongestSupport.label}
          />
          <ConvictionReasonCard
            detail={pillarReasonDetail(mainLimiter.label, "limit")}
            label="Main Limiter"
            score={mainLimiter.score}
            title={mainLimiter.label}
            tone="risk"
          />
          <ConvictionReasonCard
            detail={confidenceContextDetail(confidenceContextLabel)}
            label="Confidence Context"
            score={confidenceScore}
            title={confidenceContextLabel}
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {pillarAnalyses.map((pillar) => (
          <NovaConvictionPillarAnalysisCard
            key={pillar.label}
            pillar={pillar}
          />
        ))}
      </div>

      <p className="px-1 text-xs leading-relaxed text-white/30">
        Nova Conviction uses holder quality, structural safety, and market
        integrity. It does not calculate future price, PnL, win rate, average
        entry/exit, wallet identity, or financial advice.
      </p>
    </div>
  );
}

type NovaConvictionPillar = {
  detail: string;
  interpretation: string;
  label: string;
  score: number;
};

function buildNovaConvictionPillars({
  data,
  formulaV3,
}: {
  data: ExplainableConvictionData;
  formulaV3: ConvictionFormulaV3Result | null;
}): NovaConvictionPillar[] {
  if (formulaV3) {
    return [
      {
        label: "Holder Quality",
        score: formulaV3.pillarScores.holderQualityScore,
        detail: "Holder support, reputation, and wallet behavior quality.",
        interpretation: pillarInterpretation(
          "Holder Quality",
          formulaV3.pillarScores.holderQualityScore
        ),
      },
      {
        label: "Structural Safety",
        score: formulaV3.pillarScores.structuralSafetyScore,
        detail: "Concentration, bundle, cluster, and insider risk pressure.",
        interpretation: pillarInterpretation(
          "Structural Safety",
          formulaV3.pillarScores.structuralSafetyScore
        ),
      },
      {
        label: "Market Integrity",
        score: formulaV3.pillarScores.marketIntegrityScore,
        detail: "Liquidity trust, market momentum, and wallet-flow balance.",
        interpretation: pillarInterpretation(
          "Market Integrity",
          formulaV3.pillarScores.marketIntegrityScore
        ),
      },
    ];
  }

  return [
    {
      label: "Holder Quality",
      score: normalizeScore(
        (data.subScores.holderIntegrity +
          data.subScores.walletQuality +
          data.subScores.behaviorStability) /
          3
      ),
      detail: "Holder support, reputation, and wallet behavior quality.",
      interpretation: pillarInterpretation(
        "Holder Quality",
        normalizeScore(
          (data.subScores.holderIntegrity +
            data.subScores.walletQuality +
            data.subScores.behaviorStability) /
            3
        )
      ),
    },
    {
      label: "Structural Safety",
      score: data.subScores.riskProtection,
      detail: "Concentration, bundle, cluster, and insider risk pressure.",
      interpretation: pillarInterpretation(
        "Structural Safety",
        data.subScores.riskProtection
      ),
    },
    {
      label: "Market Integrity",
      score: normalizeScore(
        (data.subScores.liquidityTrust + data.subScores.marketMomentum) / 2
      ),
      detail: "Liquidity trust, market momentum, and wallet-flow balance.",
      interpretation: pillarInterpretation(
        "Market Integrity",
        normalizeScore(
          (data.subScores.liquidityTrust + data.subScores.marketMomentum) / 2
        )
      ),
    },
  ];
}

function novaConvictionLabel(score: number) {
  if (score >= 70) return "High Conviction";
  if (score >= 40) return "Moderate Conviction";
  return "Low Conviction";
}

function buildNovaConvictionThesis({
  finalScore,
  strongestSupport,
  mainLimiter,
}: {
  finalScore: number;
  strongestSupport: NovaConvictionPillar;
  mainLimiter: NovaConvictionPillar;
}) {
  const pillarSentence = `Strongest pillar: ${strongestSupport.label}. Main limiter: ${mainLimiter.label}.`;

  if (finalScore >= 70) {
    return `High conviction profile. Holder quality, structural safety, and market integrity align strongly under currently available evidence. ${pillarSentence}`;
  }
  if (finalScore >= 40) {
    return `Moderate conviction profile. Supportive signals are present, but structural or market limitations prevent a clean high-conviction setup. ${pillarSentence}`;
  }
  return `Low conviction profile. Structural pressure, weak holder quality, or limited market integrity currently outweigh supportive signals. ${pillarSentence}`;
}

function pillarInterpretation(label: string, score: number) {
  const band = score >= 70 ? "high" : score >= 40 ? "moderate" : "low";

  if (label === "Holder Quality") {
    if (band === "high") {
      return "Holder behavior and reputation provide meaningful support.";
    }
    if (band === "moderate") {
      return "Holder quality is mixed, with both support and risk signals.";
    }
    return "Holder evidence is weak or risk-weighted.";
  }

  if (label === "Structural Safety") {
    if (band === "high") {
      return "Structural pressure appears limited under available evidence.";
    }
    if (band === "moderate") {
      return "Some structural pressure exists, but not enough to fully dominate the profile.";
    }
    return "Concentration, cluster, bundle, or contract pressure limits conviction.";
  }

  if (band === "high") {
    return "Liquidity and market-flow conditions are supportive.";
  }
  if (band === "moderate") {
    return "Market structure is usable but not clearly strong.";
  }
  return "Liquidity, rotation, or distribution pressure weakens the setup.";
}

function pillarReasonDetail(
  label: string,
  reasonType: "support" | "limit"
) {
  if (label === "Holder Quality") {
    return reasonType === "support"
      ? "Holder behavior and reputation currently support the conviction profile."
      : "Holder evidence is mixed or risk-weighted under currently loaded data.";
  }

  if (label === "Structural Safety") {
    return reasonType === "support"
      ? "Concentration, contract exposure, and relationship pressure are comparatively contained."
      : "Concentration, contract exposure, or relationship pressure reduce structural confidence.";
  }

  return reasonType === "support"
    ? "Liquidity, market participation, and wallet-flow balance are currently supportive."
    : "Liquidity, rotation, or distribution pressure limits market confidence.";
}

function confidenceContextDetail(label: string) {
  if (label === "High") {
    return "Available data supports a broad conviction reading.";
  }
  if (label === "Medium") {
    return "Available data supports a partial but usable conviction reading.";
  }
  if (label === "Low") {
    return "Available data is limited, so conviction should be treated cautiously.";
  }
  return "Conviction confidence will improve as more token evidence becomes available.";
}

function ConvictionReasonCard({
  detail,
  label,
  score,
  title,
  tone = "default",
}: {
  detail: string;
  label: string;
  score: number;
  title: string;
  tone?: "default" | "risk";
}) {
  const toneClass =
    tone === "risk"
      ? "border-amber-100/12 bg-amber-100/[0.03]"
      : "border-cyan-100/12 bg-cyan-100/[0.03]";

  return (
    <div className={`rounded-2xl border p-3 ${toneClass}`}>
      <p className="text-[0.64rem] uppercase tracking-[0.16em] text-white/34">
        {label}
      </p>
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-white/78">{title}</p>
        <p className="font-mono text-xl font-semibold tabular-nums text-white/82">
          {formatScoreValue(score)}
        </p>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-white/40">{detail}</p>
    </div>
  );
}

type NovaPillarSubScore = {
  label: string;
  note?: string;
  score: number | null;
  tone?: "score" | "pressure";
};

type NovaPillarAnalysis = NovaConvictionPillar & {
  rows: NovaPillarSubScore[];
};

function buildNovaPillarAnalyses({
  data,
  formulaV3,
  holderIntelligenceSummary,
  insiderRiskV2,
  tokenFlowSummaryV2,
  walletReputationSummary,
}: {
  data: ExplainableConvictionData;
  formulaV3: ConvictionFormulaV3Result | null;
  holderIntelligenceSummary: HolderIntelligenceSummary | null;
  insiderRiskV2: InsiderRiskV2Result;
  tokenFlowSummaryV2: TokenFlowSummaryV2 | null;
  walletReputationSummary: TokenWalletReputationSummary | null;
}): NovaPillarAnalysis[] {
  const pillars = buildNovaConvictionPillars({ data, formulaV3 });

  return pillars.map((pillar) => {
    if (pillar.label === "Holder Quality") {
      const supportBalance = holderSupportRiskBalance(holderIntelligenceSummary);
      return {
        ...pillar,
        rows: [
          {
            label: "Holder Integrity",
            score: data.subScores.holderIntegrity,
            note: scoreLabel(data.subScores.holderIntegrity),
          },
          {
            label: "Wallet Quality",
            score: data.subScores.walletQuality,
            note: scoreLabel(data.subScores.walletQuality),
          },
          {
            label: "Behavior Stability",
            score: data.subScores.behaviorStability,
            note: scoreLabel(data.subScores.behaviorStability),
          },
          {
            label: "Wallet Reputation",
            score: walletReputationSummary?.averageReputation ?? null,
            note:
              typeof walletReputationSummary?.averageReputation === "number"
                ? scoreLabel(walletReputationSummary.averageReputation)
                : "Unavailable",
          },
          {
            label: "Holder Support / Risk Balance",
            score: supportBalance,
            note:
              supportBalance !== null
                ? scoreLabel(supportBalance)
                : "Unavailable",
          },
        ],
      };
    }

    if (pillar.label === "Structural Safety") {
      return {
        ...pillar,
        rows: [
          {
            label: "Insider Pressure",
            score: insiderRiskV2.insiderRiskScore,
            note: pressureLabel(insiderRiskV2.insiderRiskScore),
            tone: "pressure",
          },
          {
            label: "Concentration Pressure",
            score: insiderRiskV2.concentrationPressureScore,
            note: pressureLabel(insiderRiskV2.concentrationPressureScore),
            tone: "pressure",
          },
          {
            label: "Cluster Exposure",
            score: insiderRiskV2.clusterExposureScore,
            note: pressureLabel(insiderRiskV2.clusterExposureScore),
            tone: "pressure",
          },
          {
            label: "Bundle Structure",
            score: insiderRiskV2.bundleStructureScore,
            note: pressureLabel(insiderRiskV2.bundleStructureScore),
            tone: "pressure",
          },
          {
            label: "Contract Dominance",
            score: insiderRiskV2.contractDominanceScore,
            note: pressureLabel(insiderRiskV2.contractDominanceScore),
            tone: "pressure",
          },
        ],
      };
    }

    const walletFlowScore = tokenFlowSummaryV2
      ? overviewWalletFlowScore(tokenFlowSummaryV2)
      : null;
    return {
      ...pillar,
      rows: [
        {
          label: "Liquidity Trust",
          score: data.subScores.liquidityTrust,
          note: scoreLabel(data.subScores.liquidityTrust),
        },
        {
          label: "Market Momentum",
          score: data.subScores.marketMomentum,
          note: scoreLabel(data.subScores.marketMomentum),
        },
        {
          label: "Wallet Flow",
          score: walletFlowScore,
          note: walletFlowScore !== null ? scoreLabel(walletFlowScore) : "Unavailable",
        },
        {
          label: "Accumulation Pressure",
          score: tokenFlowSummaryV2?.accumulationPressure ?? null,
          note:
            typeof tokenFlowSummaryV2?.accumulationPressure === "number"
              ? scoreLabel(tokenFlowSummaryV2.accumulationPressure)
              : "Unavailable",
        },
        {
          label: "Distribution Pressure",
          score: tokenFlowSummaryV2?.distributionPressure ?? null,
          note:
            typeof tokenFlowSummaryV2?.distributionPressure === "number"
              ? pressureLabel(tokenFlowSummaryV2.distributionPressure)
              : "Unavailable",
          tone: "pressure",
        },
      ],
    };
  });
}

function holderSupportRiskBalance(
  summary: HolderIntelligenceSummary | null
) {
  if (!summary) return null;
  const support = summary.strongSupportHolders + summary.mildSupportHolders;
  const risk = summary.strongRiskHolders + summary.mildRiskHolders;
  const total = support + risk;
  if (!total) return null;
  return normalizeScore((support / total) * 100);
}

function scoreLabel(score: number) {
  if (score >= 70) return "Strong";
  if (score >= 40) return "Mixed";
  return "Weak";
}

function pressureLabel(score: number) {
  if (score >= 70) return "High Pressure";
  if (score >= 40) return "Moderate Pressure";
  return "Low Pressure";
}

function confidenceScoreLabel(score: number) {
  if (score >= 70) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

function NovaConvictionPillarAnalysisCard({
  pillar,
}: {
  pillar: NovaPillarAnalysis;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-white/38">
            {pillar.label}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-white/38">
            {pillar.detail}
          </p>
        </div>
        <p className="font-mono text-3xl font-semibold tabular-nums tracking-[-0.05em] text-white/84">
          {formatScoreValue(pillar.score)}
        </p>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full rounded-full bg-cyan-100/68 shadow-[0_0_16px_rgba(180,240,255,0.24)]"
          style={{ width: `${normalizeScore(pillar.score)}%` }}
        />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-white/42">
        {pillar.interpretation}
      </p>
      <div className="mt-4 space-y-3">
        {pillar.rows.map((row) => (
          <NovaPillarSubScoreRow key={row.label} row={row} />
        ))}
      </div>
    </div>
  );
}

function NovaPillarSubScoreRow({ row }: { row: NovaPillarSubScore }) {
  const hasScore = typeof row.score === "number" && Number.isFinite(row.score);
  const width = hasScore ? normalizeScore(row.score as number) : 0;
  const barClass =
    row.tone === "pressure"
      ? "bg-amber-100/62 shadow-[0_0_14px_rgba(253,230,138,0.18)]"
      : "bg-cyan-100/62 shadow-[0_0_14px_rgba(180,240,255,0.18)]";

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs text-white/58">{row.label}</p>
          <p className="mt-0.5 text-[0.66rem] text-white/28">
            {row.note || (hasScore ? scoreLabel(row.score as number) : "Unavailable")}
          </p>
        </div>
        <p
          className={`font-mono text-sm tabular-nums ${
            hasScore ? "text-white/66" : "text-white/24"
          }`}
        >
          {hasScore ? formatScoreValue(row.score as number) : "Unavailable"}
        </p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
        <div
          className={`h-full rounded-full ${barClass}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function HolderIntelligenceMatrixPanel({
  compact = false,
  matrix = [],
  summary,
}: {
  compact?: boolean;
  matrix?: HolderIntelligenceProfile[];
  summary: HolderIntelligenceSummary | null;
}) {
  const highestConviction = summary?.highestConvictionHolder;
  const highestRisk = summary?.highestRiskHolder;

  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/44">
            Holder Intelligence Matrix V2
          </p>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-white/36">
            Holder Intelligence uses available holder metadata, profile behavior,
            relationship evidence, deep behavior and wallet reputation. It does
            not calculate PnL, win rate, average entry, average exit, smart money
            identity, insider identity, or unavailable wallet history.
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.025] px-3 py-1 text-xs text-white/42">
          Formula V2 foundation
        </span>
      </div>

      {!summary ? (
        <BehaviorPreviewState>
          Holder Intelligence Matrix appears after holder rows and wallet evidence load.
        </BehaviorPreviewState>
      ) : (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
            <BehaviorMetric
              label="Avg Holder Score"
              value={summary.averageHolderScore}
            />
            <BehaviorMetric
              label="Dominant Class"
              value={summary.dominantHolderClass}
            />
            <BehaviorMetric
              label="Strong Support"
              value={summary.strongSupportHolders}
            />
            <BehaviorMetric
              label="Strong Risk"
              value={summary.strongRiskHolders}
            />
            <BehaviorMetric
              label="Avg Confidence"
              value={summary.averageConfidence}
            />
            <BehaviorMetric
              label="Analyzed"
              value={summary.analyzedHolders}
            />
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-white/36">
                Summary Verdict
              </p>
              <p className="mt-2 text-sm font-medium text-cyan-50/72">
                {summary.summaryVerdict}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-white/34">
                Average conviction contribution is{" "}
                {summary.averageConvictionContribution}/100. Average structural
                risk contribution is {summary.averageRiskContribution}/100.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <HolderIntelligenceMiniCard
                holder={highestConviction}
                label="Highest Conviction Holder"
              />
              <HolderIntelligenceMiniCard
                holder={highestRisk}
                label="Highest Risk Holder"
                tone="risk"
              />
            </div>
          </div>

          {!compact && (
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              <HolderMatrixDriverList
                items={summary.topPositiveDrivers}
                title="Top Positive Drivers"
              />
              <HolderMatrixDriverList
                items={summary.topRiskDrivers}
                title="Top Risk Drivers"
              />
              <HolderMatrixDriverList
                items={summary.missingEvidenceSummary}
                title="Missing Evidence"
              />
            </div>
          )}

          {!compact && matrix.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-white/8 bg-black/18">
              <div className="grid min-w-[880px] grid-cols-[1.05fr_1fr_0.8fr_0.8fr_0.8fr] gap-3 border-b border-white/8 px-4 py-3 text-[10px] uppercase tracking-[0.14em] text-white/34">
                <span>Holder</span>
                <span>Class</span>
                <span className="text-center">Contribution</span>
                <span className="text-center">Risk</span>
                <span className="text-center">Score</span>
              </div>
              {matrix.slice(0, 8).map((holder) => (
                <div
                  key={`${holder.holderRank || "holder"}-${holder.walletAddress}`}
                  className="grid min-h-[56px] min-w-[880px] grid-cols-[1.05fr_1fr_0.8fr_0.8fr_0.8fr] items-center gap-3 border-b border-white/[0.055] px-4 py-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-white/70">
                      {holder.shortAddress}
                    </p>
                    <p className="mt-0.5 text-[11px] text-white/30">
                      {holder.confidenceLabel} confidence
                    </p>
                  </div>
                  <span className="truncate text-white/58">{holder.holderClass}</span>
                  <span className="text-center text-white/58">
                    {holder.contributionTier}
                  </span>
                  <span className="text-center text-white/58">{holder.riskTier}</span>
                  <span className="text-center font-medium tabular-nums text-cyan-100/72">
                    {holder.overallHolderScore}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function HolderIntelligenceMiniCard({
  holder,
  label,
  tone = "support",
}: {
  holder?: HolderIntelligenceProfile;
  label: string;
  tone?: "support" | "risk";
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/18 p-3">
      <p className="text-xs uppercase tracking-[0.18em] text-white/36">{label}</p>
      <p
        className={`mt-2 truncate text-sm font-medium ${
          tone === "risk" ? "text-amber-100/70" : "text-cyan-50/72"
        }`}
      >
        {holder ? holder.shortAddress : "Unavailable"}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-white/34">
        {holder
          ? `${holder.holderClass} · ${holder.overallHolderScore}/100 · ${holder.contributionTier}`
          : "No holder matrix evidence loaded yet."}
      </p>
    </div>
  );
}

function HolderMatrixDriverList({
  items,
  title,
}: {
  items: string[];
  title: string;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/18 p-3">
      <p className="text-xs uppercase tracking-[0.18em] text-white/36">{title}</p>
      <div className="mt-3 space-y-2">
        {items.length ? (
          items.map((item) => (
            <p key={item} className="text-xs leading-relaxed text-white/38">
              {item}
            </p>
          ))
        ) : (
          <p className="text-xs text-white/28">Unavailable</p>
        )}
      </div>
    </div>
  );
}

function InsiderRiskV2Panel({ result }: { result: InsiderRiskV2Result }) {
  const componentScores = [
    ["Concentration", result.concentrationPressureScore],
    ["Cluster Exposure", result.clusterExposureScore],
    ["Bundle Structure", result.bundleStructureScore],
    ["Evidence Confidence", result.evidenceConfidenceScore],
  ] as const;

  return (
    <section className="rounded-[2rem] border border-amber-100/12 bg-amber-100/[0.025] p-5">
      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr] xl:items-start">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-amber-100/44">
            Insider Risk
          </p>
          <div className="mt-4 flex items-end gap-2">
            <p className="text-6xl font-light tracking-[-0.065em] text-white">
              {result.insiderRiskScore}
            </p>
            <p className="pb-2 text-sm text-white/36">/100</p>
          </div>
          <p className="mt-3 text-lg font-medium text-amber-50/78">
            {result.riskTier} structural risk
          </p>
          <p className="mt-3 text-sm leading-relaxed text-white/48">
            {result.verdict}
          </p>
        </div>

        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {componentScores.map(([label, value]) => (
              <BehaviorMetric key={label} label={label} value={value} />
            ))}
          </div>

          <div className="hidden">
            <InsiderV2List title="Detected Patterns" items={result.detectedPatterns.map((pattern) => `${pattern.label} · ${pattern.severity}`)} />
            <InsiderV2List title="Top Risk Holders" items={result.topRiskHolders.map((holder) => `${holder.shortAddress} · ${holder.riskContributionScore}/100`)} />
            <InsiderV2List title="Top Support Holders" items={result.topSupportHolders.map((holder) => `${holder.shortAddress} · ${holder.convictionContributionScore}/100`)} />
          </div>

          <div className="hidden">
            <InsiderV2List title="Positive Evidence" items={result.positives} />
            <InsiderV2List title="Risk Evidence" items={result.negatives} />
            <InsiderV2List title="Missing Evidence" items={result.missingEvidence} />
          </div>
        </div>
      </div>
    </section>
  );
}

function InsiderV2List({ items, title }: { items: string[]; title: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/18 p-3">
      <p className="text-xs uppercase tracking-[0.18em] text-white/36">{title}</p>
      <div className="mt-3 space-y-2">
        {items.length ? (
          items.slice(0, 5).map((item) => (
            <p key={item} className="text-xs leading-relaxed text-white/40">
              {item}
            </p>
          ))
        ) : (
          <p className="text-xs text-white/28">Unavailable</p>
        )}
      </div>
    </div>
  );
}

function WalletReputationMiniCard({
  label,
  tone = "support",
  wallet,
}: {
  label: string;
  tone?: "support" | "risk";
  wallet?: WalletReputationResult;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/18 p-3">
      <p className="text-xs uppercase tracking-[0.18em] text-white/36">{label}</p>
      <p
        className={`mt-2 truncate text-sm font-medium ${
          tone === "risk" ? "text-amber-100/70" : "text-cyan-50/72"
        }`}
      >
        {wallet ? shortInsiderWalletAddress(wallet.walletAddress) : "Unavailable"}
      </p>
      <p className="mt-1 text-xs text-white/34">
        {wallet
          ? `${wallet.walletClass} · ${wallet.reputationScore}/100 · ${wallet.confidence} confidence`
          : "No wallet evidence loaded yet."}
      </p>
    </div>
  );
}

function FormulaValidationLogPanel({
  canSave,
  onClearAll,
  onDeleteSnapshot,
  onSaveCurrent,
  onUpdateSnapshot,
  snapshots,
  status,
}: {
  canSave: boolean;
  onClearAll: () => void;
  onDeleteSnapshot: (id: string) => void;
  onSaveCurrent: () => void;
  onUpdateSnapshot: (
    id: string,
    updates: Partial<Pick<FormulaValidationSnapshot, "note" | "outcome">>
  ) => void;
  snapshots: FormulaValidationSnapshot[];
  status: string;
}) {
  const stats = buildFormulaValidationStats(snapshots);
  const lastSaved = snapshots[0]?.analyzedAt;

  return (
    <details className="rounded-3xl border border-white/10 bg-black/20 p-4">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-white/38">
              Validation lab
            </p>
            <h3 className="mt-2 text-lg font-semibold tracking-[-0.035em] text-white/86">
              Formula Validation Log
            </h3>
            <p className="mt-2 max-w-3xl text-xs leading-relaxed text-white/38">
              Internal local-only testing log for V1, V2 and V3.
            </p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.025] px-3 py-1 text-xs text-white/42">
            {snapshots.length} saved
          </span>
        </div>
      </summary>

      <div className="mt-4 border-t border-white/10 pt-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <p className="max-w-3xl text-xs leading-relaxed text-white/34">
          Outcomes are manually labeled and stored locally. NovaOS does not
          auto-detect future performance or fabricate results.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onSaveCurrent}
            disabled={!canSave}
            className={`rounded-full border px-3 py-1.5 text-xs transition ${
              canSave
                ? "border-cyan-100/14 bg-cyan-100/[0.045] text-cyan-100/70 hover:bg-cyan-100/[0.075]"
                : "cursor-not-allowed border-white/8 bg-white/[0.02] text-white/24"
            }`}
          >
            Save validation snapshot
          </button>
          <button
            type="button"
            onClick={onClearAll}
            disabled={!snapshots.length}
            className={`rounded-full border px-3 py-1.5 text-xs transition ${
              snapshots.length
                ? "border-white/10 bg-white/[0.025] text-white/38 hover:bg-white/[0.05]"
                : "cursor-not-allowed border-white/8 bg-white/[0.02] text-white/22"
            }`}
          >
            Clear all
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        <FormulaValidationStat label="Saved" value={snapshots.length} />
        <FormulaValidationStat
          label="Last Saved"
          value={lastSaved ? formatSnapshotTime(lastSaved) : "None"}
        />
        <FormulaValidationStat label="Known" value={stats.knownOutcomesCount} />
        <FormulaValidationStat label="Pending" value={stats.pendingCount} />
        <FormulaValidationStat label="V1 Aligned" value={stats.v1AlignedCount} />
        <FormulaValidationStat label="V2 Aligned" value={stats.v2AlignedCount} />
        <FormulaValidationStat label="V3 Aligned" value={stats.v3AlignedCount} />
      </div>

      {status && (
        <p className="mt-3 rounded-2xl border border-cyan-100/10 bg-cyan-100/[0.025] px-3 py-2 text-xs text-cyan-100/62">
          {status}
        </p>
      )}

      {!snapshots.length ? (
        <div className="mt-4">
          <TerminalStatePanel
            title="No validation snapshots yet."
            detail="Save a snapshot from a loaded token analysis to start comparing formula behavior manually."
          />
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {snapshots.slice(0, 10).map((snapshot) => (
            <FormulaValidationSnapshotRow
              key={snapshot.id}
              onDeleteSnapshot={onDeleteSnapshot}
              onUpdateSnapshot={onUpdateSnapshot}
              snapshot={snapshot}
            />
          ))}
        </div>
      )}
      </div>
    </details>
  );
}

function FormulaValidationStat({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
      <p className="truncate text-[0.62rem] uppercase tracking-[0.16em] text-white/32">
        {label}
      </p>
      <p className="mt-2 truncate text-lg font-semibold tracking-[-0.045em] text-white/82">
        {formatScoreValue(value)}
      </p>
    </div>
  );
}

function FormulaValidationSnapshotRow({
  onDeleteSnapshot,
  onUpdateSnapshot,
  snapshot,
}: {
  onDeleteSnapshot: (id: string) => void;
  onUpdateSnapshot: (
    id: string,
    updates: Partial<Pick<FormulaValidationSnapshot, "note" | "outcome">>
  ) => void;
  snapshot: FormulaValidationSnapshot;
}) {
  const alignment = formulaValidationAlignment(snapshot);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
      <div className="grid gap-3 xl:grid-cols-[minmax(180px,1fr)_minmax(260px,1.2fr)_minmax(220px,0.9fr)] xl:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <TokenAvatar
            logoUrl={snapshot.tokenLogo}
            sizeClass="h-10 w-10"
            token={snapshot.tokenSymbol}
          />
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p className="truncate font-medium text-white/78">
                {snapshot.tokenSymbol}
              </p>
              <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[0.62rem] text-white/38">
                {chainLabel(snapshot.chain)}
              </span>
            </div>
            <p className="mt-1 truncate text-xs text-white/34">
              {formatSnapshotTime(snapshot.analyzedAt)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          <FormulaValidationTinyMetric label="V1" value={snapshot.v1Score} />
          <FormulaValidationTinyMetric
            label="V2"
            value={snapshot.v2Score ?? "N/A"}
          />
          <FormulaValidationTinyMetric label="V3" value={snapshot.v3Score} />
          <FormulaValidationTinyMetric
            label="Holder"
            value={snapshot.holderQualityScore}
          />
          <FormulaValidationTinyMetric
            label="Safety"
            value={snapshot.structuralSafetyScore}
          />
          <FormulaValidationTinyMetric
            label="Market"
            value={snapshot.marketIntegrityScore}
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-[120px_minmax(150px,1fr)_auto]">
          <select
            value={snapshot.outcome}
            onChange={(event) =>
              onUpdateSnapshot(snapshot.id, {
                outcome: event.target.value as FormulaValidationOutcome,
              })
            }
            className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/70 outline-none transition focus:border-cyan-100/24"
          >
            {formulaValidationOutcomes.map((outcome) => (
              <option key={outcome} value={outcome}>
                {outcome}
              </option>
            ))}
          </select>
          <input
            value={snapshot.note}
            onChange={(event) =>
              onUpdateSnapshot(snapshot.id, { note: event.target.value })
            }
            placeholder="Manual note"
            className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/70 outline-none transition placeholder:text-white/24 focus:border-cyan-100/24"
          />
          <button
            type="button"
            onClick={() => onDeleteSnapshot(snapshot.id)}
            className="rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-white/36 transition hover:bg-white/[0.05]"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full border border-cyan-100/10 bg-cyan-100/[0.025] px-3 py-1 text-cyan-100/58">
          Best aligned: {alignment.bestAligned}
        </span>
        <span className="text-white/30">{alignment.hint}</span>
      </div>
    </div>
  );
}

function FormulaValidationTinyMetric({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/18 px-2 py-2 text-center">
      <p className="text-[0.58rem] uppercase tracking-[0.14em] text-white/30">
        {label}
      </p>
      <p className="mt-1 font-mono text-sm tabular-nums text-white/74">
        {value}
      </p>
    </div>
  );
}

function formulaValidationAlignment(snapshot: FormulaValidationSnapshot) {
  const scores: Array<{ formula: "V1" | "V2" | "V3"; score: number }> = [
    { formula: "V1", score: snapshot.v1Score },
    ...(typeof snapshot.v2Score === "number"
      ? [{ formula: "V2" as const, score: snapshot.v2Score }]
      : []),
    { formula: "V3", score: snapshot.v3Score },
  ];

  if (snapshot.outcome === "Unknown") {
    return {
      bestAligned: "Pending",
      hint: "Pending outcome",
    };
  }

  if (snapshot.outcome === "Rug" || snapshot.outcome === "Failed") {
    const best = [...scores].sort((left, right) => left.score - right.score)[0];
    return {
      bestAligned: best.formula,
      hint: "Lower score formula aligned better with this manual outcome.",
    };
  }

  if (snapshot.outcome === "Neutral") {
    const best = [...scores].sort(
      (left, right) => Math.abs(left.score - 50) - Math.abs(right.score - 50)
    )[0];
    return {
      bestAligned: best.formula,
      hint: "Formula closest to 50 aligned better with this manual outcome.",
    };
  }

  const best = [...scores].sort((left, right) => right.score - left.score)[0];
  return {
    bestAligned: best.formula,
    hint: "Higher score formula aligned better with this manual outcome.",
  };
}

function buildFormulaValidationStats(snapshots: FormulaValidationSnapshot[]) {
  return snapshots.reduce(
    (stats, snapshot) => {
      const alignment = formulaValidationAlignment(snapshot).bestAligned;

      if (alignment === "Pending") {
        stats.pendingCount += 1;
        return stats;
      }

      stats.knownOutcomesCount += 1;
      if (alignment === "V1") stats.v1AlignedCount += 1;
      if (alignment === "V2") stats.v2AlignedCount += 1;
      if (alignment === "V3") stats.v3AlignedCount += 1;

      return stats;
    },
    {
      knownOutcomesCount: 0,
      pendingCount: 0,
      v1AlignedCount: 0,
      v2AlignedCount: 0,
      v3AlignedCount: 0,
    }
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
  const routeStats = Object.values(data?.stats.routes || {}).sort(
    (left, right) =>
      right.estimatedProviderCalls - left.estimatedProviderCalls ||
      right.misses - left.misses
  );

  return (
    <details className="group rounded-2xl border border-white/8 bg-black/10 p-3">
      <summary className="cursor-pointer list-none text-xs uppercase tracking-[0.18em] text-white/34 transition hover:text-white/52">
        Developer diagnostics
        <span className="ml-2 text-white/24 group-open:hidden">Show</span>
        <span className="ml-2 hidden text-white/24 group-open:inline">Hide</span>
      </summary>
      <div className="mt-3 rounded-2xl border border-white/8 bg-black/20 p-3">
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
              <BehaviorMetric
                label="Misses"
                value={data?.stats.totalMisses ?? 0}
              />
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
            {routeStats.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-white/36">
                  Route cache
                </p>
                <div className="mt-3 space-y-2">
                  {routeStats.slice(0, 8).map((route) => (
                    <div
                      key={route.route}
                      className="grid grid-cols-[1.2fr_0.5fr_0.5fr_0.55fr_0.65fr_0.65fr] gap-2 rounded-xl border border-white/8 bg-white/[0.018] px-3 py-2 text-xs text-white/42"
                    >
                      <span className="truncate text-white/62">{route.route}</span>
                      <span>H {route.hits}</span>
                      <span>M {route.misses}</span>
                      <span>{route.hitRate}%</span>
                      <span>D {route.inFlightDedupes}</span>
                      <span>P {route.estimatedProviderCalls}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(data?.stats.recentExpensiveMisses || []).length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-white/36">
                  Recent expensive misses
                </p>
                <div className="mt-3 space-y-2">
                  {(data?.stats.recentExpensiveMisses || [])
                    .slice(0, 5)
                    .map((miss) => (
                      <p
                        key={`${miss.createdAt}-${miss.key}`}
                        className="truncate rounded-xl border border-white/8 bg-white/[0.018] px-3 py-2 text-xs text-white/38"
                      >
                        {miss.route} · {miss.provider} · {miss.key}
                      </p>
                    ))}
                </div>
              </div>
            )}
            <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-xs leading-relaxed text-white/32">
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
      </div>
    </details>
  );
}

type BubbleGraphNode = {
  address: string;
  shortAddress: string;
  activityScore?: number;
  balance: string;
  behaviorClass: string;
  category:
    | "whale"
    | "contract"
    | "fresh"
    | "activity"
    | "rotation"
    | "risk"
    | "unknown";
  clusterCount: number;
  clusterColor: BubbleClusterColorKey;
  clusterLabels: string[];
  clusterMemberships: Array<{
    clusterId: string;
    confidence: "Low" | "Medium" | "High";
    relationshipType: string;
    riskLevel: "Low" | "Medium" | "Elevated";
  }>;
  concentrationScore?: number;
  confidence: string;
  convictionContribution: number;
  dormancyScore?: number;
  influence: number;
  ownership: number;
  ownershipText: string;
  personality?: WalletPersonalityPreview;
  rank: number;
  reliability?: number;
  relationshipGroupIds: string[];
  riskContribution: number;
  row: WalletRow;
  size: number;
  tone: "cyan" | "purple" | "blue" | "amber" | "red" | "gray";
  x: number;
  y: number;
};

type BubbleGraphEdge = {
  id: string;
  colorKey?: BubbleClusterColorKey;
  from: string;
  relationshipType: string;
  riskLevel?: "Low" | "Medium" | "Elevated";
  strength: number;
  to: string;
};

type BubbleGraphCluster = {
  anchorX: number;
  anchorY: number;
  colorKey: BubbleClusterColorKey;
  confidence?: "Low" | "Medium" | "High";
  id: string;
  label: string;
  nodeAddresses: string[];
  riskLevel?: "Low" | "Medium" | "Elevated";
};

type BubbleClusterColorKey =
  | "cyan"
  | "green"
  | "purple"
  | "blue"
  | "amber"
  | "red"
  | "gray";

const BUBBLE_MAP_WIDTH = 1000;
const BUBBLE_MAP_HEIGHT = 680;
const BUBBLE_MAP_CENTER = { x: 500, y: 340 };

function BubbleIntelligenceExperience({
  behaviorPreview,
  clusterData,
  clusterError,
  clusterLoadState,
  conviction,
  personalityPreviews,
  token,
  tokenData,
  walletRows,
}: {
  behaviorPreview: WalletBehaviorPreviewData | null;
  clusterData: WalletClusterData | null;
  clusterError: string;
  clusterLoadState: HolderLoadState;
  conviction: ExplainableConvictionData | null;
  personalityPreviews: WalletPersonalityPreview[];
  token: string;
  tokenData: TokenResult;
  walletRows: WalletRow[];
}) {
  const [selectedNode, setSelectedNode] = useState<BubbleGraphNode | null>(null);
  const graph = useMemo(
    () =>
      buildBubbleGraph({
        behaviorProfiles: behaviorPreview?.profiles || [],
        clusterData,
        conviction,
        personalityPreviews,
        walletRows,
      }),
    [behaviorPreview?.profiles, clusterData, conviction, personalityPreviews, walletRows]
  );
  const activeNode =
    graph.nodes.find((node) => node.address === selectedNode?.address) ||
    null;
  const relationshipsDetected = graph.edges.filter(
    (edge) => edge.from !== "token" && edge.to !== "token"
  ).length;
  const hasRelationships = relationshipsDetected > 0;

  if (!tokenData.tokenAddress) {
    return (
      <InsiderScanEmptyState
        title="Select a token to view Bubble Intelligence."
        detail="NovaOS will visualize the real holder ecosystem behind the selected token when cluster and wallet profile data is available."
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1720px] space-y-5">
      <section className="relative overflow-hidden rounded-[2rem] border border-cyan-100/10 bg-[#05070b]/94 p-6 shadow-[0_28px_120px_rgba(0,0,0,0.36)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_28%_8%,rgba(34,211,238,0.11),transparent_34%),radial-gradient(circle_at_88%_28%,rgba(126,87,194,0.12),transparent_36%)]" />
        <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="text-xs uppercase tracking-[0.34em] text-cyan-100/48">
              Bubble Intelligence
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.07em] text-white/94">
              See Beyond the Chart
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/48">
              Visualize holder concentration, wallet clusters, and relationship
              evidence behind the token.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/24 px-4 py-3">
            <TokenAvatar
              logoUrl={resolveTokenLogo(tokenData)}
              sizeClass="h-11 w-11"
              token={token}
            />
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/34">
                Ecosystem graph
              </p>
              <p className="mt-1 text-sm font-medium text-white/78">
                {token} wallet map
              </p>
            </div>
          </div>
        </div>
      </section>

      <BubbleEcosystemSummary
        averageConfidence={clusterData?.networkSummary.averageClusterConfidence}
        clusterGroups={graph.clusters.length}
        relationshipsDetected={relationshipsDetected}
        walletsAnalyzed={
          clusterData?.networkSummary.totalAnalyzedWallets || graph.nodes.length
        }
      />

      {clusterLoadState === "error" && (
        <div className="rounded-2xl border border-amber-100/12 bg-amber-100/[0.035] px-4 py-3 text-xs leading-relaxed text-amber-100/62">
          {clusterError ||
            "Cluster data is unavailable. The graph can only show available holder/profile evidence."}
        </div>
      )}
      {!hasRelationships && graph.nodes.length > 0 && (
        <div className="rounded-2xl border border-cyan-100/10 bg-cyan-100/[0.025] px-4 py-3 text-xs leading-relaxed text-white/42">
          No high-confidence wallet-to-wallet relationship group detected from
          available data.
        </div>
      )}
      {graph.nodes.length > 0 && graph.nodes.length <= 10 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3 text-xs leading-relaxed text-white/38">
          Limited wallet coverage. The bubble map is based only on currently
          analyzed holders.
        </div>
      )}

      <section
        className={`grid gap-5 ${
          activeNode ? "xl:grid-cols-[minmax(0,2.2fr)_minmax(340px,0.82fr)]" : "xl:grid-cols-[minmax(0,1fr)_minmax(260px,0.24fr)]"
        }`}
      >
        <div className="relative">
          <HolderBubbleMap
            clusters={graph.clusters}
            nodes={graph.nodes}
            onSelectWallet={(node) => setSelectedNode(node as BubbleGraphNode)}
            selectedWallet={selectedNode}
            showLabels={false}
            showLines={hasRelationships}
            tokenLogoUrl={resolveTokenLogo(tokenData)}
            tokenSymbol={token}
          />
          {clusterLoadState === "loading" && graph.nodes.length === 0 && (
            <BubbleGraphSkeleton />
          )}
          {graph.nodes.length === 0 && clusterLoadState !== "loading" && (
            <div className="absolute inset-0 z-30 flex items-center justify-center px-8 text-center">
              <div>
                <p className="text-lg font-medium tracking-[-0.04em] text-white/72">
                  No analyzed holder nodes available yet.
                </p>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-white/38">
                  Bubble Intelligence needs real holder rows and wallet profile
                  data. NovaOS will not generate placeholder wallets.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="min-h-0">
          <BubbleNodeDrawer
            node={activeNode}
          />
        </div>
      </section>

      <p className="text-xs leading-relaxed text-white/30">
        Only observed holders and inferred relationships are shown. NovaOS does
        not invent wallets, ownership, or common-control relationships.
      </p>
    </div>
  );
}

function BubbleNodeDrawer({
  node,
}: {
  node: BubbleGraphNode | null;
}) {
  const [copied, setCopied] = useState(false);
  if (!node) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#06080c]/75 p-5">
        <p className="text-xs uppercase tracking-[0.28em] text-cyan-100/42">
          Wallet Detail
        </p>
        <p className="mt-4 text-sm leading-relaxed text-white/40">
          Select a bubble to inspect factual wallet-level evidence.
        </p>
      </div>
    );
  }

  const activeNode = node;
  const primaryCluster = activeNode.clusterLabels[0];
  function copyAddress() {
    void navigator.clipboard.writeText(activeNode.address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <aside className="max-h-[680px] overflow-y-auto rounded-2xl border border-white/10 bg-[#06080c]/92 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.24)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-100/42">
            Wallet Intelligence
          </p>
          <p className="mt-2 truncate font-mono text-base font-semibold text-white/82">
            {activeNode.shortAddress}
          </p>
          <p className="mt-1 break-all font-mono text-[11px] leading-relaxed text-white/30">
            {activeNode.address}
          </p>
        </div>
        <button
          type="button"
          onClick={copyAddress}
          className="shrink-0 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs text-white/58 transition hover:border-cyan-100/20 hover:text-cyan-100/78"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-xs text-white/55">
          Rank #{activeNode.rank}
        </span>
        {primaryCluster ? (
          <span className="rounded-full border border-cyan-100/14 bg-cyan-100/[0.045] px-3 py-1 text-xs text-cyan-100/64">
            {primaryCluster}
          </span>
        ) : (
          <span className="rounded-full border border-white/10 bg-white/[0.025] px-3 py-1 text-xs text-white/36">
            Isolated holder
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <ForensicFact label="Ownership" value={activeNode.ownershipText} />
        <ForensicFact label="Balance" value={activeNode.balance || "\u2014"} />
        <ForensicFact label="USD value" value={"\u2014"} />
        <ForensicFact label="Behavior" value={activeNode.behaviorClass || "\u2014"} />
        <ForensicFact
          label="Personality"
          value={activeNode.personality?.personalityType || "\u2014"}
        />
        <ForensicFact label="Activity score" value={formatBubbleMetric(activeNode.activityScore)} />
        <ForensicFact label="Concentration score" value={formatBubbleMetric(activeNode.concentrationScore)} />
        <ForensicFact label="Reliability score" value={formatBubbleMetric(activeNode.reliability)} />
        <ForensicFact label="Relationships" value={activeNode.clusterCount} />
        <ForensicFact
          label="Conviction contribution"
          value={formatBubbleMetric(activeNode.convictionContribution)}
        />
        <ForensicFact
          label="Risk contribution"
          value={formatBubbleMetric(activeNode.riskContribution)}
        />
      </div>

      <p className="mt-4 text-xs leading-relaxed text-white/30">
        Relationship counts come from available cluster and bundle inference.
        This does not prove common ownership, identity or profitability.
      </p>
    </aside>
  );
}

function formatBubbleMetric(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${Math.round(value)}/100`
    : "\u2014";
}

function BubbleEcosystemSummary({
  averageConfidence,
  clusterGroups,
  relationshipsDetected,
  walletsAnalyzed,
}: {
  averageConfidence?: number;
  clusterGroups: number;
  relationshipsDetected: number;
  walletsAnalyzed: number;
}) {
  return (
    <section className="mt-3 grid gap-2 sm:grid-cols-2 lg:max-w-3xl lg:grid-cols-4">
      <BubbleSummaryMetric label="Wallets Analyzed" value={walletsAnalyzed} />
      <BubbleSummaryMetric label="Relationships" value={relationshipsDetected} />
      <BubbleSummaryMetric label="Cluster Groups" value={clusterGroups} />
      <BubbleSummaryMetric
        label="Avg Confidence"
        value={typeof averageConfidence === "number" ? averageConfidence : "\u2014"}
      />
    </section>
  );
}

function BubbleSummaryMetric({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/38 px-3 py-2 backdrop-blur-xl">
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/34">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold tracking-[-0.035em] text-white/72">
        {value}
      </p>
    </div>
  );
}

function BubbleGraphSkeleton() {
  return (
    <div className="relative z-10 min-h-[560px]">
      <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-100/10 bg-cyan-100/[0.04]" />
      {Array.from({ length: 16 }).map((_, index) => (
        <SkeletonLine
          key={index}
          className="absolute h-6 w-6 rounded-full"
        />
      ))}
    </div>
  );
}

function normalizeWalletAddress(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function walletAddressCandidate(
  source: Partial<Record<"fullAddress" | "walletAddress" | "ownerAddress" | "address" | "wallet", string | undefined>>
) {
  return normalizeWalletAddress(
    source.fullAddress ||
      source.walletAddress ||
      source.ownerAddress ||
      source.address ||
      source.wallet
  );
}

function holderRowAddress(row: WalletRow) {
  return walletAddressCandidate(row);
}

function buildBubbleGraph({
  behaviorProfiles,
  clusterData,
  conviction,
  personalityPreviews,
  walletRows,
}: {
  behaviorProfiles: WalletBehaviorProfile[];
  clusterData: WalletClusterData | null;
  conviction: ExplainableConvictionData | null;
  personalityPreviews: WalletPersonalityPreview[];
  walletRows: WalletRow[];
}) {
  const profileByAddress = new Map(
    behaviorProfiles.flatMap((profile) => {
      const address = walletAddressCandidate(profile);
      return address ? [[address, profile] as const] : [];
    })
  );
  const personalityByAddress = new Map(
    personalityPreviews.flatMap((personality) => {
      const address = walletAddressCandidate(personality);
      return address ? [[address, personality] as const] : [];
    })
  );
  const convictionByAddress = new Map(
    (conviction?.walletBreakdowns || []).flatMap((breakdown) => {
      const address = walletAddressCandidate(breakdown);
      return address ? [[address, breakdown] as const] : [];
    })
  );
  const clusterByAddress = new Map<string, WalletClusterData["clusters"]>();
  clusterData?.clusters
    .filter((cluster) => cluster.relationshipType !== "Isolated")
    .forEach((cluster) => {
      cluster.wallets.forEach((wallet) => {
        const key = walletAddressCandidate(wallet);
        if (!key) return;
        clusterByAddress.set(key, [...(clusterByAddress.get(key) || []), cluster]);
      });
    });

  const bundleGroups = conviction?.bundleDetection?.detectedGroups || [];
  const bundleByAddress = new Map<
    string,
    NonNullable<ExplainableConvictionData["bundleDetection"]>["detectedGroups"]
  >();
  bundleGroups.forEach((group) => {
    group.wallets.forEach((wallet) => {
      const key = normalizeWalletAddress(wallet);
      if (!key) return;
      bundleByAddress.set(key, [...(bundleByAddress.get(key) || []), group]);
    });
  });

  const rows = walletRows
    .filter((row) => holderRowAddress(row))
    .slice(0, 30);
  const clusterAnchors = buildClusterAnchors(clusterData, bundleGroups);
  const rawNodes = rows.map((row, index) => {
    const address = holderRowAddress(row);
    const profile = profileByAddress.get(address);
    const personality = personalityByAddress.get(address);
    const convictionBreakdown = convictionByAddress.get(address);
    const clusters = clusterByAddress.get(address) || [];
    const bundles = bundleByAddress.get(address) || [];
    const ownership = readPercentage(row.ownershipPercentage);
    const activity = profile?.activityVelocityScore ?? 0;
    const concentration =
      profile?.concentrationRiskScore ??
      convictionBreakdown?.scores.concentrationRisk ??
      ownership * 12;
    const reliability = profile?.behaviorReliabilityScore ?? profile?.dataConfidence;
    const clusterImportance = Math.min(100, clusters.length * 18 + bundles.length * 18);
    const influence = clampNumber(
      ownership * 12 + activity * 0.18 + concentration * 0.16 + clusterImportance + Math.max(0, 7 - row.rank) * 4,
      8,
      100
    );
    const riskContribution = convictionBreakdown
      ? clampNumber(
          (convictionBreakdown.scores.dormancyRisk || 0) * 0.2 +
            (convictionBreakdown.scores.botActivityRisk || 0) * 0.2 +
            (convictionBreakdown.scores.rotationRisk || 0) * 0.2 +
            (convictionBreakdown.scores.concentrationRisk || 0) * 0.4,
          0,
          100
        )
      : clampNumber(
          (profile?.dormancyRiskScore || 0) * 0.25 +
            concentration * 0.55 +
            clusterImportance * 0.5,
          0,
          100
        );
    const convictionContribution =
      typeof convictionBreakdown?.scores.convictionBehavior === "number"
        ? clampNumber(convictionBreakdown.scores.convictionBehavior, 0, 100)
        : clampNumber(
            (reliability || 35) * 0.32 +
              activity * 0.24 +
              Math.max(0, 100 - riskContribution) * 0.28 +
              ownership * 3,
            0,
            100
          );
    const primaryClusterId = clusters[0]?.clusterId || bundles[0]?.groupId;
    const primaryClusterAnchor = primaryClusterId
      ? clusterAnchors.get(primaryClusterId)
      : undefined;
    const position = getOrganicNodePosition({
      address,
      clusterAnchor: primaryClusterAnchor,
      index,
      influence,
      rank: row.rank,
      total: rows.length,
    });
    const clusterLabels: string[] = clusters
      .map((cluster) => deriveClusterLabel(cluster, profile, row))
      .filter(Boolean);
    bundles.forEach((group) => {
      clusterLabels.push(riskGroupLabel(group.reason));
    });
    const clusterMemberships = clusters.map((cluster) => ({
      clusterId: cluster.clusterId,
      confidence: cluster.confidence,
      relationshipType: cluster.relationshipType,
      riskLevel: cluster.riskLevel,
    }));
    const relationshipGroupIds = [
      ...clusters.map((cluster) => cluster.clusterId),
      ...bundles.map((group) => group.groupId),
    ];

    return {
      address,
      activityScore:
        profile?.activityVelocityScore ?? convictionBreakdown?.scores.activity,
      balance: row.balance,
      behaviorClass:
        profile?.behaviorClass ||
        convictionBreakdown?.labels.behaviorClass ||
        row.status ||
        "Unavailable",
      category: getBubbleNodeCategory({
        bundles,
        personality,
        profile,
        rank: row.rank,
        riskContribution,
        ownership,
      }),
      clusterCount: relationshipGroupIds.length,
      clusterColor: primaryClusterAnchor?.colorKey || "gray",
      clusterLabels: Array.from(new Set(clusterLabels)),
      clusterMemberships,
      concentrationScore:
        profile?.concentrationRiskScore ?? convictionBreakdown?.scores.concentrationRisk,
      confidence: confidenceLabel(profile),
      convictionContribution,
      dormancyScore:
        profile?.dormancyRiskScore ?? convictionBreakdown?.scores.dormancyRisk,
      influence,
      ownership,
      ownershipText: row.ownershipPercentage,
      personality,
      rank: row.rank,
      reliability: reliability ?? convictionBreakdown?.scores.walletQuality,
      relationshipGroupIds,
      riskContribution,
      row,
      shortAddress: shortInsiderWalletAddress(address),
      size: getBubbleNodeSize({ activity, concentration, ownership, rank: row.rank }),
      tone: bubbleNodeTone(profile, personality, riskContribution),
      x: position.x,
      y: position.y,
    } satisfies BubbleGraphNode;
  });

  const nodes = resolveBubbleCollisions(rawNodes.sort((a, b) => b.influence - a.influence));
  const nodeAddresses = new Set(nodes.map((node) => node.address));
  const edges: BubbleGraphEdge[] = [];

  clusterData?.clusters
    .filter((cluster) => cluster.relationshipType !== "Isolated")
    .forEach((cluster) => {
      const wallets = cluster.wallets
        .map((wallet) => normalizeWalletAddress(wallet.walletAddress))
        .filter((wallet) => nodeAddresses.has(wallet));
      wallets.slice(1).forEach((wallet, index) => {
        const from = wallets[0];
        if (!from || from === wallet) return;
        edges.push({
          id: `${cluster.clusterId}-${from}-${wallet}-${index}`,
          from,
          colorKey: clusterAnchors.get(cluster.clusterId)?.colorKey,
          relationshipType: cluster.relationshipType,
          riskLevel: cluster.riskLevel,
          strength: clusterRelationshipStrength(cluster),
          to: wallet,
        });
      });
    });
  bundleGroups.forEach((group) => {
    const wallets = group.wallets
      .map((wallet) => normalizeWalletAddress(wallet))
      .filter((wallet) => nodeAddresses.has(wallet));
    wallets.slice(1).forEach((wallet, index) => {
      const from = wallets[0];
      if (!from || from === wallet) return;
      edges.push({
        id: `${group.groupId}-${from}-${wallet}-${index}`,
        from,
        colorKey: clusterAnchors.get(group.groupId)?.colorKey,
        relationshipType: riskGroupLabel(group.reason),
        riskLevel: group.riskScore >= 70 ? "Elevated" : group.riskScore >= 45 ? "Medium" : "Low",
        strength: clampNumber(group.riskScore / 100, 0.28, 0.86),
        to: wallet,
      });
    });
  });
  const isolatedNodes = nodes.filter((node) => node.relationshipGroupIds.length === 0);
  const clusters: BubbleGraphCluster[] = Array.from(clusterAnchors.entries()).map(
    ([id, anchor]) => {
      const matchingNodes = nodes.filter((node) =>
        node.relationshipGroupIds.includes(id)
      );
      return {
        anchorX: anchor.x,
        anchorY: anchor.y,
        colorKey: anchor.colorKey,
        confidence: anchor.confidence,
        id,
        label: anchor.label,
        nodeAddresses: matchingNodes.map((node) => node.address),
        riskLevel: anchor.riskLevel,
      };
    }
  ).filter((cluster) => cluster.nodeAddresses.length > 0);
  if (isolatedNodes.length > 0) {
    clusters.push({
      anchorX: BUBBLE_MAP_CENTER.x,
      anchorY: BUBBLE_MAP_HEIGHT - 56,
      colorKey: "gray",
      id: "isolated-holders",
      label: "Isolated Holders",
      nodeAddresses: isolatedNodes.map((node) => node.address),
      riskLevel: "Low",
    });
  }

  return {
    clusterLabels: Array.from(
      new Set(
        nodes.flatMap((node) => node.clusterLabels)
      )
    ).slice(0, 6),
    clusters,
    edges,
    nodes,
  };
}

function buildClusterAnchors(
  clusterData: WalletClusterData | null,
  bundleGroups: NonNullable<ExplainableConvictionData["bundleDetection"]>["detectedGroups"]
) {
  const anchors = new Map<
    string,
    {
      colorKey: BubbleClusterColorKey;
      confidence?: "Low" | "Medium" | "High";
      label: string;
      riskLevel?: "Low" | "Medium" | "Elevated";
      x: number;
      y: number;
    }
  >();
  const sourceClusters =
    clusterData?.clusters.filter((cluster) => cluster.relationshipType !== "Isolated") ||
    [];
  const total = sourceClusters.length + bundleGroups.length;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const baseRadius = total <= 2 ? 215 : total <= 5 ? 248 : 282;

  sourceClusters.forEach((cluster, index) => {
    const angle =
      index * goldenAngle +
      0.72 +
      ((hashWalletToNumber(cluster.clusterId) % 38) - 19) * 0.012;
    const label = deriveClusterLabel(cluster);
    const radius = baseRadius + ((hashWalletToNumber(cluster.clusterId) % 76) - 30);
    anchors.set(cluster.clusterId, {
      colorKey: clusterColorForLabel(label, cluster.riskLevel, index),
      confidence: cluster.confidence,
      label,
      riskLevel: cluster.riskLevel,
      x: clampNumber(BUBBLE_MAP_CENTER.x + Math.cos(angle) * radius, 110, 890),
      y: clampNumber(BUBBLE_MAP_CENTER.y + Math.sin(angle) * radius * 0.7, 92, 588),
    });
  });

  bundleGroups.forEach((group, bundleIndex) => {
    const index = sourceClusters.length + bundleIndex;
    const angle =
      index * goldenAngle +
      0.72 +
      ((hashWalletToNumber(group.groupId) % 38) - 19) * 0.012;
    const radius = baseRadius + ((hashWalletToNumber(group.groupId) % 76) - 30);
    const riskLevel =
      group.riskScore >= 70 ? "Elevated" : group.riskScore >= 45 ? "Medium" : "Low";
    const label = riskGroupLabel(group.reason);
    anchors.set(group.groupId, {
      colorKey: clusterColorForLabel(label, riskLevel, index),
      confidence: group.confidence,
      label,
      riskLevel,
      x: clampNumber(BUBBLE_MAP_CENTER.x + Math.cos(angle) * radius, 110, 890),
      y: clampNumber(BUBBLE_MAP_CENTER.y + Math.sin(angle) * radius * 0.7, 92, 588),
    });
  });

  return anchors;
}

function getOrganicNodePosition({
  address,
  clusterAnchor,
  index,
  influence,
  rank,
  total,
}: {
  address: string;
  clusterAnchor?: { x: number; y: number };
  index: number;
  influence: number;
  rank: number;
  total: number;
}) {
  const hash = hashWalletToNumber(address);
  const jitterRadius = 14 + ((hash >> 4) % 34);

  if (clusterAnchor) {
    const clusterOrbitAngle =
      index * Math.PI * (3 - Math.sqrt(5)) + ((hash >> 6) % 50) * 0.018;
    const localRadius = clampNumber(
      rank <= 3 ? 34 + jitterRadius * 0.35 : 102 - influence * 0.55 + jitterRadius * 0.18,
      34,
      96
    );
    return {
      x: clampNumber(
        clusterAnchor.x +
          Math.cos(clusterOrbitAngle) * localRadius +
          (((hash >> 8) % 25) - 12),
        64,
        936
      ),
      y: clampNumber(
        clusterAnchor.y +
          Math.sin(clusterOrbitAngle) * localRadius * 0.78 +
          (((hash >> 12) % 21) - 10),
        64,
        616
      ),
    };
  }

  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const angle = index * goldenAngle + ((hash % 96) - 48) * 0.012;
  const phyllotaxisRadius = 96 + Math.sqrt(index + 1) * (total <= 12 ? 72 : 60);
  const rankPull = rank <= 3 ? 34 : rank <= 10 ? 12 : 0;
  const rankBand = phyllotaxisRadius - rankPull + ((hash >> 5) % 58) - 20;
  const radius = clampNumber(
    rankBand - influence * 0.08 + jitterRadius * 0.32,
    112,
    total <= 12 ? 382 : 430
  );
  return {
    x: clampNumber(BUBBLE_MAP_CENTER.x + Math.cos(angle) * radius, 50, 950),
    y: clampNumber(BUBBLE_MAP_CENTER.y + Math.sin(angle) * radius * 0.72, 50, 630),
  };
}

function resolveBubbleCollisions(nodes: BubbleGraphNode[]) {
  const resolved = nodes.map((node) => ({ ...node }));
  for (let pass = 0; pass < 14; pass += 1) {
    for (let index = 0; index < resolved.length; index += 1) {
      for (let nextIndex = index + 1; nextIndex < resolved.length; nextIndex += 1) {
        const a = resolved[index];
        const b = resolved[nextIndex];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 0.1;
        const minDistance = (a.size + b.size) / 2 + 7;
        if (distance >= minDistance) continue;
        const push = (minDistance - distance) * 0.5;
        const nx = dx / distance;
        const ny = dy / distance;
        const aRadius = a.size / 2;
        const bRadius = b.size / 2;
        a.x = clampNumber(a.x - nx * push, 44 + aRadius, BUBBLE_MAP_WIDTH - 44 - aRadius);
        a.y = clampNumber(a.y - ny * push, 44 + aRadius, BUBBLE_MAP_HEIGHT - 44 - aRadius);
        b.x = clampNumber(b.x + nx * push, 44 + bRadius, BUBBLE_MAP_WIDTH - 44 - bRadius);
        b.y = clampNumber(b.y + ny * push, 44 + bRadius, BUBBLE_MAP_HEIGHT - 44 - bRadius);
      }
      const node = resolved[index];
      const centerDx = node.x - BUBBLE_MAP_CENTER.x;
      const centerDy = node.y - BUBBLE_MAP_CENTER.y;
      const centerDistance = Math.sqrt(centerDx * centerDx + centerDy * centerDy) || 0.1;
      const protectedDistance = 96 + node.size / 2;
      if (centerDistance < protectedDistance) {
        const push = protectedDistance - centerDistance;
        node.x = clampNumber(
          node.x + (centerDx / centerDistance) * push,
          44 + node.size / 2,
          BUBBLE_MAP_WIDTH - 44 - node.size / 2
        );
        node.y = clampNumber(
          node.y + (centerDy / centerDistance) * push,
          44 + node.size / 2,
          BUBBLE_MAP_HEIGHT - 44 - node.size / 2
        );
      }
    }
  }
  return resolved;
}

function hashWalletToNumber(address: string) {
  let hash = 2166136261;
  for (let index = 0; index < address.length; index += 1) {
    hash ^= address.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function clusterColorForLabel(
  label: string,
  riskLevel: "Low" | "Medium" | "Elevated" | undefined,
  index: number
): BubbleClusterColorKey {
  const value = label.toLowerCase();
  if (riskLevel === "Elevated" || value.includes("risk") || value.includes("bundle")) {
    return "red";
  }
  if (value.includes("rotation")) return "amber";
  if (value.includes("fresh")) return "blue";
  if (value.includes("activity")) return "cyan";
  if (value.includes("accumulation")) return "green";
  if (value.includes("whale")) return "purple";
  const fallback: BubbleClusterColorKey[] = ["cyan", "purple", "blue", "green", "amber"];
  return fallback[index % fallback.length];
}

function getBubbleNodeCategory({
  bundles,
  personality,
  profile,
  rank,
  riskContribution,
  ownership,
}: {
  bundles: NonNullable<ExplainableConvictionData["bundleDetection"]>["detectedGroups"];
  personality?: WalletPersonalityPreview;
  profile?: WalletBehaviorProfile;
  rank: number;
  riskContribution: number;
  ownership: number;
}): BubbleGraphNode["category"] {
  if (profile?.behaviorClass === "contract/system") return "contract";
  if (riskContribution >= 70 || bundles.length > 0 || (profile?.concentrationRiskScore || 0) >= 75) {
    return "risk";
  }
  if (ownership >= 1 || rank <= 5) return "whale";
  if (
    personality?.personalityType === "Fresh Wallet" ||
    (profile?.walletAgeDays ?? 999) <= 30
  ) {
    return "fresh";
  }
  if (
    personality?.personalityType === "Rotation Hunter" ||
    (profile?.dormancyRiskScore || 0) >= 65
  ) {
    return "rotation";
  }
  if ((profile?.activityVelocityScore || 0) >= 65) return "activity";
  return "unknown";
}

function getBubbleNodeSize({
  activity,
  concentration,
  ownership,
  rank,
}: {
  activity: number;
  concentration: number;
  ownership: number;
  rank: number;
}) {
  const base = rank <= 10 ? 21 : 16;
  const rankBoost = rank <= 3 ? 25 : rank <= 5 ? 18 : rank <= 10 ? 11 : rank <= 25 ? 5 : 0;
  const ownershipWeight = Math.min(34, Math.sqrt(Math.max(0, ownership)) * 17);
  const activityWeight = activity >= 70 ? 5 : activity * 0.025;
  const concentrationWeight = Math.min(10, Math.sqrt(Math.max(0, concentration)) * 1.25);
  const max = ownership >= 1 || rank <= 3 ? 72 : rank <= 10 ? 58 : 44;
  return clampNumber(base + rankBoost + ownershipWeight + activityWeight + concentrationWeight, 15, max);
}

function bubbleNodeTone(
  profile: WalletBehaviorProfile | undefined,
  personality: WalletPersonalityPreview | undefined,
  riskContribution: number
): BubbleGraphNode["tone"] {
  if (riskContribution >= 70 || (profile?.concentrationRiskScore || 0) >= 75) {
    return "red";
  }
  if (
    personality?.personalityType === "Rotation Hunter" ||
    (profile?.dormancyRiskScore || 0) >= 65
  ) {
    return "amber";
  }
  if (personality?.personalityType === "Conviction Accumulator") {
    return "purple";
  }
  if (profile?.behaviorClass === "active accumulator") return "cyan";
  if ((profile?.activityVelocityScore || 0) >= 65) return "blue";
  return "gray";
}

function clusterRelationshipStrength(
  cluster: WalletClusterData["clusters"][number]
) {
  const confidence =
    cluster.confidence === "High" ? 0.85 : cluster.confidence === "Medium" ? 0.58 : 0.34;
  const risk =
    cluster.riskLevel === "Elevated" ? 0.18 : cluster.riskLevel === "Medium" ? 0.1 : 0;
  return clampNumber(confidence + risk, 0.2, 1);
}

function deriveClusterLabel(
  cluster: WalletClusterData["clusters"][number],
  profile?: WalletBehaviorProfile,
  row?: WalletRow
) {
  if (profile?.behaviorClass === "active accumulator") return "Accumulation Cluster";
  if ((profile?.activityVelocityScore || 0) >= 70) return "High Activity Cluster";
  if ((profile?.walletAgeDays ?? 999) <= 30) return "Fresh Wallet Cluster";
  if (row && readPercentage(row.ownershipPercentage) >= 5) return "Whale Cluster";
  if (cluster.relationshipType === "Possible Coordination") {
    return "Relationship Watch Cluster";
  }
  if (cluster.relationshipType === "Activity Overlap") return "High Activity Cluster";
  if (cluster.relationshipType === "Passive Similarity") return "Passive Holder Cluster";
  return "";
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function AIHumanArenaMvpSection({
  behaviorPreview,
  conviction,
  convictionError,
  convictionLoadState,
  formulaV3,
  holderLoadState,
  personalities,
  tokenData,
  tokenIntelligence,
  unifiedAnalysis,
  walletRows,
}: {
  behaviorPreview: WalletBehaviorPreviewData | null;
  behaviorPreviewError: string;
  conviction: ExplainableConvictionData | null;
  convictionError: string;
  convictionLoadState: HolderLoadState;
  formulaV3: ConvictionFormulaV3Result | null;
  holderError: string;
  holderLoadState: HolderLoadState;
  personalities: WalletPersonalityPreview[];
  tokenData: TokenResult;
  tokenIntelligence: TokenIntelligenceData | null;
  unifiedAnalysis: UnifiedTokenAnalysisData | null;
  walletRows: WalletRow[];
}) {
  const tokenKey = arenaTokenStorageKey(tokenData);
  const [arenaRevision, setArenaRevision] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [selectedTimeframe, setSelectedTimeframe] =
    useState<NovaArenaTimeframe>("24H");
  const [pendingVote, setPendingVote] = useState<{
    arenaWindowId: string;
    tokenKey: string;
    timeframe: NovaArenaTimeframe;
    vote: ArenaVote;
  } | null>(null);
  const hasToken = Boolean(tokenData.tokenAddress);
  const selectedWindow =
    selectedTimeframe === "24H" ? getDailyArenaWindow(now) : getWeeklyArenaWindow(now);
  const progress = getArenaProgress(selectedWindow, now);
  const timeRemaining = getTimeRemaining(selectedWindow, now);
  const entries = readArenaEntries();
  void arenaRevision;
  const tokenEntries = tokenKey
    ? entries.filter(
        (entry) =>
          arenaEntryTokenKey(entry) === tokenKey &&
          entry.timeframe === selectedTimeframe
      )
    : [];
  const currentWindowEntries = tokenEntries.filter(
    (entry) => entry.arenaWindowId === selectedWindow.arenaWindowId
  );
  const currentUserEntry = currentWindowEntries[0] || null;
  const activePendingVote =
    pendingVote?.tokenKey === tokenKey &&
    pendingVote.timeframe === selectedTimeframe &&
    pendingVote.arenaWindowId === selectedWindow.arenaWindowId
      ? pendingVote.vote
      : null;
  const aiConvictionScore =
    conviction
      ? Math.round(formulaV3?.finalConvictionScoreV3 ?? conviction.finalConvictionScore)
      : null;
  const flowModel = conviction
    ? buildWalletFlowModel({
        behaviorPreview,
        conviction,
        holderLoadState,
        personalities,
        tokenIntelligence,
        unifiedAnalysis,
        walletRows,
      })
    : null;
  const novaStance = conviction
    ? deriveNovaArenaStance({
        convictionScore: aiConvictionScore,
        dataConfidence: conviction.dataConfidence.score,
        holderQuality: conviction.subScores.walletQuality,
        insiderRisk: conviction.subScores.insiderRisk,
        marketIntegrity: averageDefined([
          conviction.subScores.liquidityTrust,
          conviction.subScores.marketMomentum,
        ]),
        structuralSafety: conviction.subScores.riskProtection,
        walletFlow: flowModel?.dominantFlow,
      })
    : ({
        stance: "Pending",
        reason: "Conviction score is unavailable.",
      } satisfies NovaArenaStanceResult);
  const publishedCurrentEntry = currentWindowEntries.find(
    (entry) => entry.aiPublishedStance
  );
  const voteDistribution = buildArenaVoteDistribution(currentWindowEntries);
  const latestResolvedEntry = tokenEntries
    .filter((entry) => entry.resultStatus === "Resolved" && entry.winner)
    .sort(
      (a, b) =>
        Date.parse(b.resolvedAt || b.submittedAt) -
        Date.parse(a.resolvedAt || a.submittedAt)
    )[0];

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!tokenKey || !conviction || aiConvictionScore === null) return;

    const published = publishClosedArenaEntries({
      entryKey: tokenKey,
      score: aiConvictionScore,
      stance: novaStance.stance,
      timestamp: now.toISOString(),
    });

    if (published) {
      window.setTimeout(() => setArenaRevision((value) => value + 1), 0);
    }
  }, [aiConvictionScore, conviction, novaStance.stance, now, tokenKey]);

  function selectPendingVote(vote: ArenaVote) {
    if (!tokenKey || currentUserEntry || !progress.votingOpen) return;

    setPendingVote({
      arenaWindowId: selectedWindow.arenaWindowId,
      tokenKey,
      timeframe: selectedTimeframe,
      vote,
    });
  }

  function submitVote() {
    if (
      !tokenKey ||
      !tokenData.tokenAddress ||
      !progress.votingOpen ||
      currentUserEntry ||
      !activePendingVote
    ) {
      return;
    }

    const allEntries = readArenaEntries();
    const existing = allEntries.find(
      (entry) =>
        arenaEntryTokenKey(entry) === tokenKey &&
        entry.timeframe === selectedTimeframe &&
        entry.arenaWindowId === selectedWindow.arenaWindowId
    );
    if (existing) return;

    const submittedAt = new Date().toISOString();
    const nextEntry: ArenaVoteEntry = {
      id: `${tokenKey}:${selectedTimeframe}:${selectedWindow.arenaWindowId}`,
      tokenAddress: tokenData.tokenAddress,
      tokenSymbol: tokenData.symbol,
      chain: tokenData.chain,
      timeframe: selectedTimeframe,
      arenaWindowId: selectedWindow.arenaWindowId,
      humanVote: activePendingVote,
      submittedAt,
      resultStatus: "Pending",
    };
    writeArenaEntries([...allEntries, nextEntry]);
    setPendingVote(null);
    setArenaRevision((value) => value + 1);
  }

  if (!hasToken) {
    return (
      <SectionShell
        title="AI vs Human Arena"
        description="Challenge NovaOS with daily and weekly conviction calls."
      >
        <ArenaEmptyState>
          Select a token to enter the conviction arena.
        </ArenaEmptyState>
      </SectionShell>
    );
  }

  return (
    <SectionShell
      title="AI vs Human Arena"
      description="Challenge NovaOS with daily and weekly conviction calls."
    >
      <section className="grid gap-4 xl:grid-cols-[0.78fr_1.22fr]">
        <div className={terminalSurfaceClass + " p-5"}>
          <ArenaSectionTitle title="Arena" />
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {(["24H", "7D"] as const).map((timeframe) => (
              <button
                key={timeframe}
                type="button"
                onClick={() => setSelectedTimeframe(timeframe)}
                className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                  selectedTimeframe === timeframe
                    ? "border-cyan-100/24 bg-cyan-100/[0.08] text-cyan-50/82 shadow-[0_0_24px_rgba(103,232,249,0.12)]"
                    : "border-white/10 bg-black/20 text-white/44 hover:text-white/68"
                }`}
              >
                {timeframe} Arena
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-white/42">
            Each token has separate daily and weekly arenas. Human votes are
            collected before the UTC close. NovaOS locks its stance at the close
            time. Outcomes remain pending until reliable resolution data is available.
          </p>
        </div>

        <ArenaCountdownCard
          progressPercent={progress.progressPercent}
          timeRemainingLabel={timeRemaining.timeRemainingLabel}
          window={selectedWindow}
        />
      </section>

      {convictionLoadState === "loading" && (
        <ArenaEmptyState>Analyze a token first to generate AI conviction.</ArenaEmptyState>
      )}

      {convictionLoadState === "error" && !conviction && (
        <ArenaEmptyState tone="error">
          {convictionError || "AI conviction is unavailable for this token."}
        </ArenaEmptyState>
      )}

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className={terminalSurfaceClass + " p-5"}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ArenaSectionTitle title="Human Vote" />
            <ArenaChip>
              {currentUserEntry
                ? "Vote locked"
                : activePendingVote
                  ? "Ready to submit"
                : progress.votingOpen
                  ? "Voting open"
                  : "Voting closed"}
            </ArenaChip>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {(["Bullish", "Accumulate", "Bearish"] as const).map((vote) => (
              <button
                key={vote}
                type="button"
                disabled={!progress.votingOpen || Boolean(currentUserEntry)}
                onClick={() => selectPendingVote(vote)}
                className={`rounded-2xl border px-3 py-3 text-sm font-medium transition ${arenaVoteButtonClass(
                  vote,
                  (currentUserEntry?.humanVote || activePendingVote) === vote
                )} disabled:cursor-not-allowed disabled:border-white/8 disabled:bg-white/[0.02] disabled:text-white/24`}
              >
                {vote}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-white/42">
            {currentUserEntry
              ? "Vote locked for this arena window."
              : !progress.votingOpen
                ? "Voting closed for this arena window."
                : activePendingVote
                  ? `Ready to submit: ${activePendingVote}.`
                  : "Choose your stance for this arena window."}
          </p>
          <button
            type="button"
            disabled={!activePendingVote || Boolean(currentUserEntry) || !progress.votingOpen}
            onClick={submitVote}
            className="mt-4 rounded-full border border-cyan-100/18 bg-cyan-100/[0.08] px-4 py-2 text-xs font-medium text-cyan-50/78 transition hover:bg-cyan-100/[0.12] disabled:cursor-not-allowed disabled:border-white/8 disabled:bg-white/[0.02] disabled:text-white/28"
          >
            Submit Vote
          </button>
        </div>

        <div className={terminalSurfaceClass + " p-5"}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ArenaSectionTitle title="Vote Distribution" />
            <ArenaChip>{voteDistribution.totalLabel}</ArenaChip>
          </div>
          <div className="mt-4 space-y-3">
            {(["Bullish", "Accumulate", "Bearish"] as const).map((vote) => (
              <ArenaDistributionBar
                key={vote}
                label={vote}
                percent={voteDistribution.percentages[vote]}
                tone={vote}
              />
            ))}
          </div>
          {voteDistribution.totalVotes === 0 && (
            <p className="mt-3 text-xs text-white/34">No local votes yet.</p>
          )}
          <div className="mt-4">
            <ArenaFact label="Human consensus" value={voteDistribution.consensus} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className={terminalSurfaceClass + " p-5"}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ArenaSectionTitle title="NovaOS Stance" />
            <ArenaChip>
              {publishedCurrentEntry
                ? "Locked"
                : `Locks at ${formatUtcTime(selectedWindow.closesAt)}`}
            </ArenaChip>
          </div>
          <div
            className={`mt-4 rounded-2xl border p-4 ${arenaPublishedSurfaceClass(
              publishedCurrentEntry?.aiPublishedStance || novaStance.stance
            )}`}
          >
            <p className="text-xs uppercase tracking-[0.16em] text-white/34">
              {publishedCurrentEntry ? "Published stance" : "Current model lean"}
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white/90">
              {publishedCurrentEntry?.aiPublishedStance || novaStance.stance}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-white/46">
              {publishedCurrentEntry
                ? "Local lock recorded after the UTC close."
                : "Indicative, not locked."}
            </p>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-white/50">
            {novaStance.reason}
          </p>
        </div>

        <div className={terminalSurfaceClass + " p-5"}>
          <ArenaSectionTitle title="Latest Result" />
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-white/34">
              Settlement
            </p>
            <p className="mt-2 text-xl font-semibold tracking-[-0.04em] text-white/86">
              {latestResolvedEntry?.winner
                ? `Latest winner: ${latestResolvedEntry.winner}`
                : "Awaiting first settlement."}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-white/42">
              Outcomes remain pending until reliable resolution data is available.
            </p>
          </div>
        </div>
      </section>
    </SectionShell>
  );
}

function arenaTokenStorageKey(tokenData: TokenResult) {
  if (!tokenData.tokenAddress) return "";

  return [
    tokenData.chain,
    tokenData.tokenAddress,
  ]
    .join(":")
    .toLowerCase();
}

function arenaEntryTokenKey(entry: ArenaVoteEntry) {
  return [entry.chain, entry.tokenAddress].join(":").toLowerCase();
}

function readArenaEntries(): ArenaVoteEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(AI_HUMAN_ARENA_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isArenaVoteEntry);
  } catch {
    return [];
  }
}

function writeArenaEntries(entries: ArenaVoteEntry[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      AI_HUMAN_ARENA_STORAGE_KEY,
      JSON.stringify(entries)
    );
  } catch {
    // Local storage can fail in private or restricted browser contexts.
  }
}

function isArenaVoteEntry(value: unknown): value is ArenaVoteEntry {
  const entry = value as Partial<ArenaVoteEntry>;

  return Boolean(
    entry &&
      typeof entry.id === "string" &&
      typeof entry.tokenAddress === "string" &&
      typeof entry.tokenSymbol === "string" &&
      typeof entry.chain === "string" &&
      (entry.timeframe === "24H" || entry.timeframe === "7D") &&
      typeof entry.arenaWindowId === "string" &&
      isArenaVote(entry.humanVote) &&
      typeof entry.submittedAt === "string" &&
      isArenaResultStatus(entry.resultStatus)
  );
}

function isArenaVote(value: unknown): value is ArenaVote {
  return value === "Bullish" || value === "Accumulate" || value === "Bearish";
}

function isArenaResultStatus(value: unknown): value is ArenaResultStatus {
  return value === "Pending" || value === "Awaiting Settlement" || value === "Resolved";
}

function publishClosedArenaEntries({
  entryKey,
  score,
  stance,
  timestamp,
}: {
  entryKey: string;
  score: number;
  stance: NovaArenaStance;
  timestamp: string;
}) {
  const allEntries = readArenaEntries();
  let published = false;
  const nextEntries = allEntries.map((entry) => {
    if (
      arenaEntryTokenKey(entry) !== entryKey ||
      entry.aiPublishedStance ||
      Date.now() < arenaWindowCloseMs(entry.arenaWindowId)
    ) {
      return entry;
    }

    published = true;
    return {
      ...entry,
      aiPublishedAt: timestamp,
      aiPublishedScore: score,
      aiPublishedStance: stance,
      resultStatus:
        entry.resultStatus === "Pending" ? "Awaiting Settlement" : entry.resultStatus,
    };
  });

  if (published) {
    writeArenaEntries(nextEntries);
  }

  return published;
}

function arenaWindowCloseMs(arenaWindowId: string) {
  const [, rawId] = arenaWindowId.split(":");
  const dateId = rawId?.replace("week-", "");
  if (!dateId) return Number.POSITIVE_INFINITY;

  const [year, month, day] = dateId.split("-").map(Number);
  if (!year || !month || !day) return Number.POSITIVE_INFINITY;

  return Date.UTC(year, month - 1, day, 23, 59, 0, 0);
}

function formatUtcTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "23:59 UTC";
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(
    date.getUTCMinutes()
  ).padStart(2, "0")} UTC`;
}

function formatUtcDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";
  return `${date.toUTCString().replace(":00 GMT", " UTC")}`;
}

function averageDefined(values: Array<number | null | undefined>) {
  const defined = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value)
  );
  if (defined.length === 0) return null;
  return defined.reduce((total, value) => total + value, 0) / defined.length;
}

function buildArenaVoteDistribution(entries: ArenaVoteEntry[]) {
  const counts: Record<ArenaVote, number> = {
    Bullish: 0,
    Accumulate: 0,
    Bearish: 0,
  };

  entries.forEach((entry) => {
    counts[entry.humanVote] += 1;
  });

  const totalVotes = entries.length;
  const percentages: Record<ArenaVote, number> = {
    Bullish: totalVotes ? Math.round((counts.Bullish / totalVotes) * 100) : 0,
    Accumulate: totalVotes ? Math.round((counts.Accumulate / totalVotes) * 100) : 0,
    Bearish: totalVotes ? Math.round((counts.Bearish / totalVotes) * 100) : 0,
  };
  const maxVotes = Math.max(counts.Bullish, counts.Accumulate, counts.Bearish);
  const leaders = (["Bullish", "Accumulate", "Bearish"] as const).filter(
    (vote) => counts[vote] === maxVotes && maxVotes > 0
  );
  const consensus =
    totalVotes === 0 ? "Pending" : leaders.length === 1 ? leaders[0] : "Mixed";

  return {
    consensus,
    percentages,
    totalLabel: totalVotes === 1 ? "1 local vote" : `${totalVotes} local votes`,
    totalVotes,
  };
}

function arenaVoteButtonClass(vote: ArenaVote, active: boolean) {
  if (!active) return "border-white/10 bg-black/20 text-white/42 hover:text-white/64";
  return `${arenaPublishedSurfaceClass(vote)} shadow-[0_0_26px_rgba(103,232,249,0.12)]`;
}

function arenaPublishedSurfaceClass(stance: NovaArenaStance | ArenaVote) {
  if (stance === "Bullish") {
    return "border-cyan-100/20 bg-cyan-100/[0.07] text-cyan-50/78";
  }
  if (stance === "Bearish") {
    return "border-amber-100/20 bg-amber-100/[0.06] text-amber-50/76";
  }
  return "border-purple-100/18 bg-purple-100/[0.06] text-purple-50/76";
}

function ArenaEmptyState({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "error";
}) {
  return (
    <div className={`${terminalSurfaceClass} p-8 text-center`}>
      <p className={tone === "error" ? "text-sm text-red-100/60" : "text-sm text-white/42"}>
        {children}
      </p>
    </div>
  );
}

function ArenaSectionTitle({ title }: { title: string }) {
  return (
    <p className="text-xs uppercase tracking-[0.18em] text-white/38">
      {title}
    </p>
  );
}

function ArenaFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <p className="text-xs text-white/34">{label}</p>
      <p className="mt-1 text-sm font-medium text-white/74">{value}</p>
    </div>
  );
}

function ArenaChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-xs font-medium text-white/54">
      {children}
    </span>
  );
}

function ArenaCountdownCard({
  progressPercent,
  timeRemainingLabel,
  window,
}: {
  progressPercent: number;
  timeRemainingLabel: string;
  window: ArenaWindow;
}) {
  return (
    <div className={terminalSurfaceClass + " p-5"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ArenaSectionTitle title="Voting Window" />
        <ArenaChip>{window.votingOpen ? "Voting open" : "Voting closed"}</ArenaChip>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-white/90">
        {timeRemainingLabel}
      </p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-cyan-100/65 shadow-[0_0_18px_rgba(103,232,249,0.24)] transition-all"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <ArenaFact label="Close" value={formatUtcDateTime(window.closesAt)} />
        <ArenaFact label="Settlement" value={formatUtcDateTime(window.resolvesAt)} />
      </div>
    </div>
  );
}

function ArenaDistributionBar({
  label,
  percent,
  tone,
}: {
  label: ArenaVote;
  percent: number;
  tone: ArenaVote;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-white/62">{label}</span>
        <span className="font-mono text-white/46">{percent}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.055]">
        <div
          className={`h-full rounded-full transition-all ${arenaDistributionFillClass(tone)}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function arenaDistributionFillClass(vote: ArenaVote) {
  if (vote === "Bullish") {
    return "bg-cyan-100/70 shadow-[0_0_16px_rgba(103,232,249,0.2)]";
  }
  if (vote === "Bearish") {
    return "bg-amber-100/68 shadow-[0_0_16px_rgba(253,230,138,0.16)]";
  }
  return "bg-purple-100/68 shadow-[0_0_16px_rgba(216,180,254,0.16)]";
}

type FlowLabel = WalletFlowV2Result["flowDirection"];

type WalletFlowContributor = {
  address: string;
  displayAddress: string;
  ownership: string;
  accumulationPressure?: number;
  distributionPressure?: number;
  rotationRisk?: number;
  netFlowBiasScore?: number;
  confidenceScore?: number;
  flowLabel: FlowLabel;
  pressureScore: number;
  dataQuality?: string;
};

type WalletFlowInsight = {
  detail?: string;
  title: string;
  value: string;
};

type WalletFlowModel = {
  accumulationPressure?: number;
  distributionPressure?: number;
  rotationRisk?: number;
  dormancyPressure?: number;
  netFlowBias?: number;
  confidenceScore?: number;
  confidenceLabel: string;
  dominantFlow?: string;
  contributors: WalletFlowContributor[];
  insights: WalletFlowInsight[];
  hasDeepBehavior: boolean;
  hasPartialInput: boolean;
};

function WalletFlowsMvpSection({
  behaviorPreview,
  behaviorPreviewError,
  behaviorPreviewState,
  conviction,
  convictionError,
  convictionLoadState,
  holderError,
  holderLoadState,
  personalities,
  personalityError,
  tokenData,
  tokenFlowSummaryV2,
  tokenIntelligence,
  unifiedAnalysis,
  walletFlowV2Results,
  walletRows,
}: {
  behaviorPreview: WalletBehaviorPreviewData | null;
  behaviorPreviewError: string;
  behaviorPreviewState: HolderLoadState;
  conviction: ExplainableConvictionData | null;
  convictionError: string;
  convictionLoadState: HolderLoadState;
  holderError: string;
  holderLoadState: HolderLoadState;
  personalities: WalletPersonalityPreview[];
  personalityError: string;
  tokenData: TokenResult;
  tokenFlowSummaryV2: TokenFlowSummaryV2 | null;
  tokenIntelligence: TokenIntelligenceData | null;
  unifiedAnalysis: UnifiedTokenAnalysisData | null;
  walletFlowV2Results: WalletFlowV2Result[];
  walletRows: WalletRow[];
}) {
  const flowModel = buildWalletFlowModel({
    behaviorPreview,
    conviction,
    holderLoadState,
    personalities,
    tokenFlowSummaryV2,
    tokenIntelligence,
    unifiedAnalysis,
    walletFlowV2Results,
    walletRows,
  });
  const providerLimitReached = [
    behaviorPreviewError,
    convictionError,
    holderError,
    personalityError,
    ...(conviction?.warnings || []),
    ...(conviction?.mapperWarnings || []),
    ...(conviction?.deepBehavior?.warnings || []),
    ...(unifiedAnalysis?.warnings || []),
  ].some(isProviderLimitMessage);
  const isLoading =
    holderLoadState === "loading" ||
    behaviorPreviewState === "loading" ||
    convictionLoadState === "loading";
  const hasToken = Boolean(tokenData.tokenAddress);

  if (!hasToken) {
    return (
      <WalletFlowStateCard
        title="Select a token to inspect wallet flows."
        detail="Wallet Flows will use loaded holder rows, wallet profiles, conviction data, personalities and transfer behavior when a token analysis is available."
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1680px] space-y-4">
      <TerminalSectionHeader
        badge="Behavioral inference only"
        subtitle="Wallet Flows tracks how major holders are behaving based on observed ownership, activity and holder intelligence signals."
        title="Wallet Flows"
      >
          <div className="grid gap-2 rounded-2xl border border-white/10 bg-black/22 p-3 text-xs text-white/36 sm:grid-cols-2 lg:min-w-[360px]">
            <FlowTinyFact label="Token" value={tokenData.symbol} />
            <FlowTinyFact label="Chain" value={chainLabel(tokenData.chain)} />
            <FlowTinyFact label="Holder rows" value={walletRows.length || "Pending"} />
            <FlowTinyFact
              label="Deep behavior"
              value={flowModel.hasDeepBehavior ? "Available" : "Unavailable"}
            />
          </div>
      </TerminalSectionHeader>

      {(providerLimitReached || flowModel.hasPartialInput || !flowModel.hasDeepBehavior) && (
        <div className="grid gap-3 lg:grid-cols-3">
          {!flowModel.hasDeepBehavior && (
            <WalletFlowNotice
              title="No deep behavior available"
              detail="Transfer-derived accumulation and distribution pressure can only be shown when deep wallet behavior is loaded."
            />
          )}
          {providerLimitReached && (
            <WalletFlowNotice
              title="Provider limit reached"
              detail="One or more providers reported a limit or rate restriction. The page is using the partial state already loaded."
              tone="warning"
            />
          )}
          {flowModel.hasPartialInput && (
            <WalletFlowNotice
              title="Partial input"
              detail="Some wallet sources are missing or incomplete, so confidence and labels are conservative."
            />
          )}
        </div>
      )}

      {isLoading && walletRows.length === 0 && !conviction && (
        <WalletFlowStateCard
          title="Loading wallet flow inputs."
          detail="NovaOS is waiting for holder rows, wallet profiles and conviction transfer behavior already requested for this token."
          pulse
        />
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
        <WalletFlowSummaryCard
          label="Accumulation Pressure"
          value={formatFlowScore(flowModel.accumulationPressure)}
          detail="Ownership-weighted accumulation pressure."
        />
        <WalletFlowSummaryCard
          label="Distribution Pressure"
          value={formatFlowScore(flowModel.distributionPressure)}
          detail="Ownership-weighted distribution pressure."
        />
        <WalletFlowSummaryCard
          label="Rotation Pressure"
          value={formatFlowScore(flowModel.rotationRisk)}
          detail="Rotation exposure from behavior and holder inputs."
        />
        <WalletFlowSummaryCard
          label="Dormancy Pressure"
          value={formatFlowScore(flowModel.dormancyPressure)}
          detail="Inactive ownership pressure from available profiles."
        />
        <WalletFlowSummaryCard
          label="Net Flow Bias"
          value={formatFlowBias(flowModel.netFlowBias)}
          detail="Positive means accumulation, negative means distribution."
        />
        <WalletFlowSummaryCard
          label="Flow Confidence"
          value={
            typeof flowModel.confidenceScore === "number"
              ? `${flowModel.confidenceScore}/100`
              : flowModel.confidenceLabel
          }
          detail={`${flowModel.confidenceLabel} confidence from available coverage.`}
        />
        <WalletFlowSummaryCard
          label="Dominant Flow"
          value={flowModel.dominantFlow || "N/A"}
          detail="Dominant regime from V2 rules."
        />
      </div>

      <section className="grid gap-3 lg:grid-cols-4">
        {flowModel.insights.map((insight) => (
          <WalletFlowInsightCard key={insight.title} insight={insight} />
        ))}
      </section>

      <TopFlowContributorsTable contributors={flowModel.contributors} />
    </div>
  );
}

function buildWalletFlowModel({
  behaviorPreview,
  conviction,
  holderLoadState,
  personalities,
  tokenFlowSummaryV2,
  tokenIntelligence,
  unifiedAnalysis,
  walletFlowV2Results,
  walletRows,
}: {
  behaviorPreview: WalletBehaviorPreviewData | null;
  conviction: ExplainableConvictionData | null;
  holderLoadState: HolderLoadState;
  personalities: WalletPersonalityPreview[];
  tokenFlowSummaryV2?: TokenFlowSummaryV2 | null;
  tokenIntelligence: TokenIntelligenceData | null;
  unifiedAnalysis: UnifiedTokenAnalysisData | null;
  walletFlowV2Results?: WalletFlowV2Result[];
  walletRows: WalletRow[];
}): WalletFlowModel {
  const deep = conviction?.deepBehavior;
  const deepSummary = deep?.summary;
  const hasDeepBehavior = Boolean(deep?.enabled && deep.walletResults.length > 0);
  const hasPartialInput =
    holderLoadState === "error" ||
    conviction?.status === "partial" ||
    Boolean(unifiedAnalysis?.modules && Object.values(unifiedAnalysis.modules).some(
      (module) => module?.status === "failed" || module?.status === "skipped"
    )) ||
    Boolean(conviction?.mapperWarnings.length);

  if (tokenFlowSummaryV2 && (walletFlowV2Results?.length || 0) > 0) {
    const contributors = (walletFlowV2Results || [])
      .map((result) => ({
        address: result.walletAddress,
        displayAddress: shortInsiderWalletAddress(result.walletAddress),
        ownership: `${result.ownershipPercentage.toFixed(2)}%`,
        accumulationPressure: result.accumulationScore,
        distributionPressure: result.distributionScore,
        rotationRisk: result.rotationScore,
        netFlowBiasScore: result.netFlowBiasScore,
        confidenceScore: result.flowConfidenceScore,
        flowLabel: result.flowDirection,
        pressureScore: Math.max(
          result.weightedAccumulationImpact,
          result.weightedDistributionImpact,
          result.weightedRotationImpact,
          result.weightedDormancyImpact
        ),
        dataQuality:
          result.missingEvidence.length > 0
            ? `${result.flowConfidenceScore}/100 confidence`
            : "Complete V2 inputs",
      }))
      .sort((a, b) => b.pressureScore - a.pressureScore)
      .slice(0, 10);
    return {
      accumulationPressure: tokenFlowSummaryV2.accumulationPressure,
      distributionPressure: tokenFlowSummaryV2.distributionPressure,
      rotationRisk: tokenFlowSummaryV2.rotationPressure,
      dormancyPressure: tokenFlowSummaryV2.dormancyPressure,
      netFlowBias: tokenFlowSummaryV2.netFlowBias,
      confidenceScore: tokenFlowSummaryV2.flowConfidence,
      confidenceLabel: scoreToConfidenceLabel(tokenFlowSummaryV2.flowConfidence),
      dominantFlow: tokenFlowSummaryV2.dominantFlow,
      contributors,
      insights: buildWalletFlowInsights({
        analyzedWallets: tokenFlowSummaryV2.analyzedWallets,
        contributors,
        dominantFlow: tokenFlowSummaryV2.dominantFlow,
        netFlowBias: tokenFlowSummaryV2.netFlowBias,
      }),
      hasDeepBehavior,
      hasPartialInput,
    };
  }
  const profileMap = new Map(
    (behaviorPreview?.profiles || []).map((profile) => [
      normalizeFlowAddress(profile.walletAddress || profile.address || profile.ownerAddress),
      profile,
    ])
  );
  const personalityMap = new Map(
    personalities.map((personality) => [
      normalizeFlowAddress(personality.walletAddress),
      personality,
    ])
  );
  const deepMap = new Map(
    (deep?.walletResults || []).map((result) => [
      normalizeFlowAddress(result.walletAddress),
      result,
    ])
  );
  const convictionBreakdownMap = new Map(
    (conviction?.walletBreakdowns || []).map((breakdown) => [
      normalizeFlowAddress(breakdown.address),
      breakdown,
    ])
  );

  const contributors = walletRows.slice(0, 25).map((row) => {
    const address = walletFlowAddress(row);
    const key = normalizeFlowAddress(address);
    const profile = profileMap.get(key);
    const personality = personalityMap.get(key);
    const deepResult = deepMap.get(key);
    const breakdown = convictionBreakdownMap.get(key);
    const activityScore =
      profile?.activityVelocityScore ??
      profile?.activityScore ??
      personality?.personalityScores.activity ??
      breakdown?.scores.activity;
    const rotationRisk =
      deepResult?.rotationBehaviorRisk ??
      personality?.personalityScores.rotation ??
      breakdown?.scores.rotationRisk;
    const accumulationPressure = deepResult?.accumulationPressure;
    const distributionPressure = deepResult?.distributionPressure;
    const ownership = readPercentage(row.ownershipPercentage);
    const label = deriveWalletFlowLabel({
      activityScore,
      accumulationPressure,
      distributionPressure,
      profile,
      rotationRisk,
    });
    const pressureScore =
      Math.max(
        accumulationPressure ?? 0,
        distributionPressure ?? 0,
        rotationRisk ?? 0,
        activityScore ?? 0,
        profile?.dormancyRiskScore ?? 0
      ) + ownership * 2;

    return {
      address,
      displayAddress: shortInsiderWalletAddress(address || row.wallet),
      ownership: row.ownershipPercentage || "N/A",
      accumulationPressure,
      distributionPressure,
      rotationRisk,
      activityScore,
      flowLabel: label,
      pressureScore,
      dataQuality: deepResult?.dataQuality.label || profile?.dataQuality,
    };
  });

  const confidenceScore =
    deep?.walletResults.length
      ? Math.round(
          averageNumbers([
            conviction?.dataConfidence.score,
            behaviorPreview?.summary.averageDataConfidence,
            behaviorPreview?.summary.reliabilityAverage,
            ...deep.walletResults.map((result) => result.dataQuality.score),
          ])
        )
      : conviction?.dataConfidence.score ??
        tokenIntelligence?.scores.reliabilityScore ??
        behaviorPreview?.summary.averageDataConfidence;
  const confidenceLabel =
    conviction?.dataConfidence.label ||
    tokenIntelligence?.thesis.confidenceLabel ||
    scoreToConfidenceLabel(confidenceScore);
  const accumulationPressure = deepSummary?.averageAccumulationPressure;
  const distributionPressure = deepSummary?.averageDistributionPressure;
  const rotationRisk =
    deepSummary?.averageRotationBehaviorRisk ?? conviction?.subScores.rotationRisk;
  const verdict = deriveWalletFlowVerdict({
    accumulationPressure,
    distributionPressure,
    hasDeepBehavior,
    rotationRisk,
  });
  return {
    accumulationPressure,
    distributionPressure,
    rotationRisk,
    dormancyPressure: behaviorPreview?.summary.averageDormancyRisk,
    netFlowBias:
      typeof accumulationPressure === "number" && typeof distributionPressure === "number"
        ? Math.round(accumulationPressure - distributionPressure)
        : undefined,
    confidenceScore:
      typeof confidenceScore === "number" && Number.isFinite(confidenceScore)
        ? Math.round(confidenceScore)
        : undefined,
    confidenceLabel,
    dominantFlow: hasDeepBehavior ? verdict.title : undefined,
    contributors: contributors
      .sort((a, b) => b.pressureScore - a.pressureScore)
      .slice(0, 10),
    insights: buildWalletFlowInsights({
      analyzedWallets: walletRows.length || deepSummary?.analyzedWallets,
      contributors,
      dominantFlow: hasDeepBehavior ? verdict.title : undefined,
      netFlowBias:
        typeof accumulationPressure === "number" && typeof distributionPressure === "number"
          ? Math.round(accumulationPressure - distributionPressure)
          : undefined,
    }),
    hasDeepBehavior,
    hasPartialInput,
  };
}

function deriveWalletFlowVerdict({
  accumulationPressure,
  distributionPressure,
  hasDeepBehavior,
  rotationRisk,
}: {
  accumulationPressure?: number;
  distributionPressure?: number;
  hasDeepBehavior: boolean;
  rotationRisk?: number;
}) {
  if (!hasDeepBehavior) {
    return {
      title: "Insufficient flow data",
      copy: "Transfer-derived wallet flow data is not available for this token, so NovaOS is not inferring accumulation or distribution pressure.",
    };
  }

  const accumulation = accumulationPressure ?? 0;
  const distribution = distributionPressure ?? 0;
  const rotation = rotationRisk ?? 0;
  const spread = Math.abs(accumulation - distribution);

  if (rotation >= 70 && rotation >= Math.max(accumulation, distribution) - 5) {
    return {
      title: "Rotation-heavy",
      copy: "Rotation risk is elevated across analyzed wallets, so current movement looks more rotation-heavy than stable.",
    };
  }
  if (spread < 12) {
    return {
      title: "Mixed flow",
      copy: "Flow is mixed because accumulation and distribution signals are close in the available wallet-transfer data.",
    };
  }
  if (accumulation > distribution) {
    return {
      title: "Accumulation dominant",
      copy: "Available wallet behavior suggests accumulation pressure is stronger than distribution pressure.",
    };
  }
  return {
    title: "Distribution dominant",
    copy: "Available wallet behavior suggests distribution pressure is stronger than accumulation pressure.",
  };
}

function deriveWalletFlowLabel({
  activityScore,
  accumulationPressure,
  distributionPressure,
  profile,
  rotationRisk,
}: {
  activityScore?: number;
  accumulationPressure?: number;
  distributionPressure?: number;
  profile?: WalletBehaviorProfile;
  rotationRisk?: number;
}): FlowLabel {
  const hasTransferPressure =
    typeof accumulationPressure === "number" ||
    typeof distributionPressure === "number";

  if ((profile?.dormancyRiskScore ?? 0) >= 70 || profile?.behaviorClass === "dormant whale") {
    return "Dormant";
  }
  if ((rotationRisk ?? 0) >= 70) return "Rotating";
  if (hasTransferPressure && (accumulationPressure ?? 0) >= (distributionPressure ?? 0) + 15) {
    return "Accumulating";
  }
  if (hasTransferPressure && (distributionPressure ?? 0) >= (accumulationPressure ?? 0) + 15) {
    return "Distributing";
  }
  if ((activityScore ?? 0) >= 70) return "Stable Holder";
  return "Unknown";
}

function buildWalletFlowInsights({
  analyzedWallets,
  contributors,
  dominantFlow,
  netFlowBias,
}: {
  analyzedWallets?: number;
  contributors: WalletFlowContributor[];
  dominantFlow?: string;
  netFlowBias?: number;
}): WalletFlowInsight[] {
  const largestContributor = contributors[0];
  const holderCount =
    typeof analyzedWallets === "number" && Number.isFinite(analyzedWallets) && analyzedWallets > 0
      ? analyzedWallets
      : undefined;
  const marketPosture =
    typeof netFlowBias === "number" && Number.isFinite(netFlowBias)
      ? netFlowBias > 0
        ? "Accumulation-biased"
        : netFlowBias < 0
        ? "Distribution-biased"
        : "Balanced"
      : undefined;

  return [
    {
      title: "Dominant Behavior",
      value: dominantFlow || "Unavailable",
      detail: dominantFlow ? "Derived from loaded wallet-flow signals." : undefined,
    },
    {
      title: "Largest Influence",
      value: largestContributor?.displayAddress || "Unavailable",
      detail: largestContributor
        ? `${largestContributor.ownership} ownership - ${largestContributor.flowLabel}`
        : undefined,
    },
    {
      title: "Holder Participation",
      value: holderCount ? `${holderCount} holder${holderCount === 1 ? "" : "s"}` : "Unavailable",
      detail: holderCount ? "Observed in the loaded holder-flow sample." : undefined,
    },
    {
      title: "Market Posture",
      value: marketPosture || "Unavailable",
      detail:
        typeof netFlowBias === "number" && Number.isFinite(netFlowBias)
          ? `Net bias ${formatFlowBias(netFlowBias)}`
          : undefined,
    },
  ];
}

function TopFlowContributorsTable({
  contributors,
}: {
  contributors: WalletFlowContributor[];
}) {
  const gridClass =
    "grid-cols-[minmax(220px,1.55fr)_minmax(110px,0.72fr)_minmax(150px,0.9fr)_minmax(120px,0.72fr)]";

  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] backdrop-blur-2xl">
      <div className="flex flex-col gap-2 border-b border-white/[0.07] p-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-100/42">
            Top Flow Contributors
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.045em] text-white/86">
            Wallets contributing most to flow pressure
          </h2>
        </div>
        <p className="text-xs text-white/30">Top {contributors.length || 0} by weighted pressure</p>
      </div>

      {contributors.length === 0 ? (
        <WalletFlowStateCard
          title="No holder rows loaded."
          detail="The contributors table appears after holder rows are available for the selected token."
        />
      ) : (
        <div className="overflow-x-auto">
        <div className={`grid min-w-[720px] ${gridClass} gap-3 ${terminalTableHeaderClass}`}>
            <span>Wallet</span>
            <span className="text-center">Ownership</span>
            <span className="text-center">Direction</span>
            <span className="text-center">Net Bias</span>
          </div>
          <div>
            {contributors.map((contributor) => (
              <div
                key={contributor.address || contributor.displayAddress}
                className={`grid min-h-[58px] min-w-[720px] ${gridClass} items-center gap-3 ${terminalRowClass}`}
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-white/74">
                    {contributor.displayAddress}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-white/30">
                    {contributor.dataQuality ? `${contributor.dataQuality} data` : "Loaded holder row"}
                  </p>
                </div>
                <span className="text-center tabular-nums text-cyan-100/66">
                  {contributor.ownership}
                </span>
                <div className="flex justify-center">
                  <WalletFlowLabelBadge label={contributor.flowLabel} />
                </div>
                <span className="text-center text-sm font-medium tabular-nums text-white/64">
                  {formatFlowBias(contributor.netFlowBiasScore)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function WalletFlowSummaryCard({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-h-[126px] rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-[10px] uppercase tracking-[0.16em] text-white/32">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-[-0.055em] text-white/86">
        {value}
      </p>
      <p className="mt-3 text-xs leading-relaxed text-white/34">{detail}</p>
    </div>
  );
}

function WalletFlowInsightCard({ insight }: { insight: WalletFlowInsight }) {
  return (
    <div className="min-h-[128px] rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-[10px] uppercase tracking-[0.16em] text-white/32">
        {insight.title}
      </p>
      <p className="mt-3 truncate text-xl font-semibold tracking-[-0.045em] text-white/84">
        {insight.value}
      </p>
      {insight.detail && (
        <p className="mt-3 text-xs leading-relaxed text-white/34">{insight.detail}</p>
      )}
    </div>
  );
}

function WalletFlowNotice({
  detail,
  title,
  tone = "default",
}: {
  detail: string;
  title: string;
  tone?: "default" | "warning";
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        tone === "warning"
          ? "border-amber-100/14 bg-amber-100/[0.035]"
          : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <p className="text-sm font-medium text-white/76">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-white/34">{detail}</p>
    </div>
  );
}

function WalletFlowStateCard({
  detail,
  pulse = false,
  title,
}: {
  detail: string;
  pulse?: boolean;
  title: string;
}) {
  return (
    <TerminalStatePanel detail={detail} pulse={pulse} title={title} />
  );
}

function FlowTinyFact({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2">
      <p className="text-[9px] uppercase tracking-[0.14em] text-white/28">{label}</p>
      <p className="mt-1 truncate text-xs font-medium text-white/68">{value}</p>
    </div>
  );
}

function WalletFlowLabelBadge({ label }: { label: FlowLabel }) {
  const className =
    label === "Accumulating"
      ? "border-emerald-100/15 bg-emerald-100/[0.05] text-emerald-100/68"
      : label === "Distributing"
      ? "border-red-100/15 bg-red-100/[0.045] text-red-100/62"
      : label === "Rotating"
      ? "border-amber-100/15 bg-amber-100/[0.05] text-amber-100/66"
      : label === "Dormant"
      ? "border-white/10 bg-white/[0.035] text-white/46"
      : label === "Stable Holder"
      ? "border-cyan-100/12 bg-cyan-100/[0.045] text-cyan-100/70"
      : "border-white/10 bg-white/[0.025] text-white/38";

  return (
    <span className={`inline-flex max-w-full justify-center rounded-full border px-3 py-1 text-xs ${className}`}>
      <span className="truncate">{label}</span>
    </span>
  );
}

function formatFlowScore(value?: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${Math.round(value)}/100`
    : "N/A";
}

function formatFlowBias(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "N/A";
  const rounded = Math.round(value);
  return rounded > 0 ? `+${rounded}` : String(rounded);
}

function scoreToConfidenceLabel(score?: number) {
  if (typeof score !== "number" || !Number.isFinite(score)) return "Low";
  if (score >= 75) return "High";
  if (score >= 45) return "Medium";
  return "Low";
}

function averageNumbers(values: Array<number | undefined>) {
  const safeValues = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value)
  );
  if (safeValues.length === 0) return 0;
  return safeValues.reduce((sum, value) => sum + value, 0) / safeValues.length;
}

function walletFlowAddress(row: WalletRow) {
  return (
    row.fullAddress ||
    row.walletAddress ||
    row.ownerAddress ||
    row.address ||
    row.wallet ||
    ""
  );
}

function normalizeFlowAddress(value?: string) {
  return (value || "").trim().toLowerCase();
}

function isProviderLimitMessage(value: string) {
  const lower = value.toLowerCase();
  return (
    lower.includes("limit") ||
    lower.includes("rate") ||
    lower.includes("429") ||
    lower.includes("quota")
  );
}

function InsiderScanDashboard({
  behaviorPreview,
  clusterData,
  conviction,
  convictionError,
  convictionLoadState,
  holderIntelligenceMatrix,
  holderError,
  holderLoadState,
  insiderRiskV2,
  onSelectWallet,
  token,
  tokenData,
  tokenIntelligence,
  walletRows,
}: {
  behaviorPreview: WalletBehaviorPreviewData | null;
  clusterData: WalletClusterData | null;
  conviction: ExplainableConvictionData | null;
  convictionError: string;
  convictionLoadState: HolderLoadState;
  holderIntelligenceMatrix: HolderIntelligenceProfile[];
  holderError: string;
  holderLoadState: HolderLoadState;
  insiderRiskV2: InsiderRiskV2Result;
  onSelectWallet: (row: WalletRow, profile?: WalletBehaviorProfile) => void;
  token: string;
  tokenData: TokenResult;
  tokenIntelligence: TokenIntelligenceData | null;
  walletRows: WalletRow[];
}) {
  const bundleDetection = conviction?.bundleDetection;
  const isLoading =
    convictionLoadState === "loading" || holderLoadState === "loading";
  const hasToken = Boolean(tokenData.tokenAddress);
  const hasRiskData = Boolean(conviction);
  const isPartial =
    conviction?.status === "partial" ||
    Boolean(convictionError) ||
    Boolean(holderError);

  if (!hasToken) {
    return (
      <InsiderScanEmptyState
        title="Select a token to run Insider Scan."
        detail="NovaOS will review holder concentration, bundle-like behavior, cluster overlap and wallet-risk evidence after a token analysis succeeds."
      />
    );
  }

  if (isLoading && !hasRiskData) {
    return <InsiderScanSkeleton token={token} tokenData={tokenData} />;
  }

  return (
    <div className="mx-auto max-w-[1680px] space-y-4">
      <TerminalSectionHeader
        badge="Behavioral inference only"
        eyebrow="Insider Scan"
        subtitle="A simplified read on holder concentration, coordination pressure and evidence quality from loaded NovaOS intelligence."
        title="Holder base structural safety"
      >
          <div className="flex items-center gap-3 self-center rounded-2xl border border-white/10 bg-black/25 px-4 py-3 lg:min-w-[248px]">
            <TokenAvatar
              logoUrl={resolveTokenLogo(tokenData)}
              sizeClass="h-11 w-11"
              token={token}
            />
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/32">
                Token review
              </p>
              <p className="mt-1 text-sm font-medium text-white/78">
                {token} Structural Risk Review
              </p>
            </div>
          </div>
      </TerminalSectionHeader>

      {isPartial && (
        <div className="rounded-2xl border border-amber-100/12 bg-amber-100/[0.035] px-4 py-3 text-xs leading-relaxed text-amber-100/62">
          Provider limit reached or live data unavailable. Cached or partial
          analysis may be shown.
        </div>
      )}

      {!conviction ? (
        <InsiderScanEmptyState
          title="Insider Scan requires holder and conviction data."
          detail="Analyze this token successfully to surface structural risk evidence. Holder facts may remain visible below when available."
        />
      ) : (
        <>
          <InsiderRiskV2Panel result={insiderRiskV2} />

          <section>
            <ForensicSectionHeading
              eyebrow="Evidence Review"
              title="Why This Risk Level"
              description="Only loaded holder, relationship, cluster and behavior evidence is shown."
            />
            <div className="mt-3 grid gap-3 xl:grid-cols-3">
              <EvidenceCard
                label="Concentration Evidence"
                rows={buildConcentrationEvidence(
                  walletRows,
                  tokenIntelligence,
                  behaviorPreview
                )}
              />
              <EvidenceCard
                label="Coordination Evidence"
                rows={buildCoordinationEvidence(conviction, clusterData)}
              />
              <EvidenceCard
                label="Behavior Evidence"
                rows={buildBehaviorEvidence(conviction, behaviorPreview)}
              />
            </div>
          </section>

          <DetectedRiskGroups
            bundleGroups={bundleDetection?.detectedGroups || []}
            patterns={insiderRiskV2.detectedPatterns}
          />
        </>
      )}

      <StableWalletIntelligenceTable
        walletRows={walletRows}
        behaviorProfiles={behaviorPreview?.profiles || []}
        holderIntelligenceMatrix={holderIntelligenceMatrix}
        loadState={holderLoadState}
        error={holderError}
        onSelectWallet={onSelectWallet}
      />
    </div>
  );
}

function EvidenceCard({ label, rows }: { label: string; rows: string[] }) {
  return (
    <div className="min-h-[184px] rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/52">{label}</p>
      <div className="mt-4 space-y-2.5">
        {(rows.length
          ? rows
          : ["Insufficient evidence."]
        ).map((row) => (
          <div key={row} className="flex gap-2 text-xs leading-relaxed text-white/48">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-cyan-100/42" />
            <span>{row}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetectedRiskGroups({
  bundleGroups,
  patterns,
}: {
  bundleGroups: NonNullable<ExplainableConvictionData["bundleDetection"]>["detectedGroups"];
  patterns: InsiderRiskV2Result["detectedPatterns"];
}) {
  const groups = [
    ...bundleGroups.filter((group) => group.wallets.length > 0),
    ...patterns
      .filter((pattern) => pattern.severity !== "Low" && pattern.affectedWallets.length > 0)
      .map((pattern) => ({
        confidence: pattern.confidence,
        groupId: `pattern-${pattern.label}`,
        reason: `${pattern.label}: ${pattern.evidence}`,
        riskScore:
          pattern.severity === "Critical"
            ? 90
            : pattern.severity === "Elevated"
              ? 75
              : 55,
        wallets: pattern.affectedWallets,
      })),
  ];

  return (
    <section>
      <ForensicSectionHeading
        eyebrow="Relationship Review"
        title="Detected Risk Groups"
        description="Wallets are grouped by behavioral similarity only. These inferences do not prove common ownership."
      />
      <div className="mt-3 grid max-w-[1180px] gap-3 lg:grid-cols-2">
        {groups.length === 0 ? (
          <div className="rounded-2xl border border-cyan-100/10 bg-cyan-100/[0.025] p-4 text-sm text-white/42 lg:col-span-2">
            No significant risk groups detected.
          </div>
        ) : (
          groups.slice(0, 6).map((group) => (
            <div
              key={group.groupId}
              className="min-h-[164px] rounded-2xl border border-white/10 bg-black/20 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-white/74">
                    {riskGroupLabel(group.reason)}
                  </p>
                  <p className="mt-1 text-xs text-white/32">
                    {group.wallets.length} wallets grouped by behavioral similarity
                  </p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.14em] ${riskScorePillClass(group.riskScore)}`}>
                  {group.confidence} confidence · {group.riskScore}/100
                </span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-white/42">
                {group.reason}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {group.wallets.slice(0, 4).map((wallet) => (
                  <span
                    key={wallet}
                    className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 font-mono text-[11px] text-white/48"
                  >
                    {shortInsiderWalletAddress(wallet)}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function InsiderHolderRiskPreview({
  behaviorProfiles,
  bundleGroups,
  holderLoadState,
  onSelectWallet,
  personalityError,
  personalityLoadState,
  personalityPreviews,
  walletRows,
}: {
  behaviorProfiles: WalletBehaviorProfile[];
  bundleGroups: NonNullable<ExplainableConvictionData["bundleDetection"]>["detectedGroups"];
  holderLoadState: HolderLoadState;
  onSelectWallet: (row: WalletRow, profile?: WalletBehaviorProfile) => void;
  personalityError: string;
  personalityLoadState: HolderLoadState;
  personalityPreviews: WalletPersonalityPreview[];
  walletRows: WalletRow[];
}) {
  const [copiedWallet, setCopiedWallet] = useState("");
  const topRows = walletRows.slice(0, 10);
  const profileByAddress = useMemo(
    () =>
      new Map(
        behaviorProfiles.map((profile) => [
          profile.walletAddress.toLowerCase(),
          profile,
        ])
      ),
    [behaviorProfiles]
  );
  const personalityByAddress = useMemo(
    () =>
      new Map(
        personalityPreviews.map((personality) => [
          personality.walletAddress.toLowerCase(),
          personality,
        ])
      ),
    [personalityPreviews]
  );
  const groupedWallets = useMemo(
    () =>
      new Set(
        bundleGroups.flatMap((group) =>
          group.wallets.map((wallet) => wallet.toLowerCase())
        )
      ),
    [bundleGroups]
  );

  function copyWalletAddress(address?: string) {
    if (!address) return;
    void navigator.clipboard.writeText(address);
    setCopiedWallet(address);
    window.setTimeout(() => setCopiedWallet(""), 1400);
  }

  return (
    <section>
      <ForensicSectionHeading
        eyebrow="Holder Review"
        title="Top Holder Risk Preview"
        description="A concise review of the highest-ranked holders before the complete holder matrix."
      />
      <div className="mt-3 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#06080c]/88">
        <div className="w-full overflow-x-auto">
          <div className={`grid min-h-[42px] w-full min-w-[920px] ${insiderPreviewGridClass} items-center gap-3 border-b border-white/10 bg-black/30 px-4 py-3 text-[10px] uppercase tracking-[0.12em] text-white/42`}>
            <span>Wallet</span>
            <span className="text-center">Ownership</span>
            <span className="text-center">Behavior</span>
            <span className="text-center">Personality</span>
            <span className="text-center">Concentration</span>
            <span className="text-center">Activity</span>
            <span className="text-center">Risk Hint</span>
          </div>
          {holderLoadState === "loading" && <InsiderPreviewSkeleton />}
          {holderLoadState === "loaded" && topRows.length === 0 && (
            <CompactHolderState>No holder rows were returned for this token.</CompactHolderState>
          )}
          {topRows.map((row) => {
            const address = row.fullAddress?.toLowerCase();
            const profile = address ? profileByAddress.get(address) : undefined;
            const personality = address
              ? personalityByAddress.get(address)
              : undefined;
            return (
              <button
                key={`${row.rank}-${row.fullAddress || row.wallet}-risk-preview`}
                type="button"
                onClick={() => onSelectWallet(row, profile)}
                className={`grid min-h-[60px] w-full min-w-[920px] ${insiderPreviewGridClass} items-center gap-3 border-b border-white/[0.055] px-4 py-3 text-left text-xs transition hover:bg-cyan-100/[0.035] focus:outline-none focus:ring-1 focus:ring-inset focus:ring-cyan-100/20`}
              >
                <WalletAddressCopy
                  address={row.fullAddress}
                  copied={copiedWallet === row.fullAddress}
                  fallback={row.wallet}
                  formatAddress={shortInsiderWalletAddress}
                  onCopy={copyWalletAddress}
                />
                <span className="text-center font-medium tabular-nums text-cyan-100/72">
                  {row.ownershipPercentage}
                </span>
                <div className="flex justify-center">
                  <V2BehaviorBadge profile={profile} />
                </div>
                <div className="flex justify-center">
                  <PersonalityTableCell
                    isLoading={personalityLoadState === "loading" && row.rank <= 5}
                    isUnavailable={Boolean(personalityError)}
                    personality={personality}
                  />
                </div>
                <ScoreCell centered value={profile?.concentrationRiskScore} />
                <ScoreCell centered value={profile?.activityVelocityScore} />
                <span className="truncate whitespace-nowrap text-center text-white/56">
                  {holderRiskHint(row, profile, Boolean(address && groupedWallets.has(address)))}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function InsiderPreviewSkeleton() {
  return (
    <div>
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className={`grid min-h-[60px] w-full min-w-[920px] ${insiderPreviewGridClass} items-center gap-3 border-b border-white/[0.055] px-4 py-3`}
        >
          <SkeletonLine className="h-3 w-28" />
          <SkeletonLine className="h-3 w-14" />
          <SkeletonLine className="mx-auto h-6 w-24" />
          <SkeletonLine className="mx-auto h-6 w-28" />
          <SkeletonLine className="mx-auto h-3 w-8" />
          <SkeletonLine className="mx-auto h-3 w-8" />
          <SkeletonLine className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

function InsiderScanMethodology({
  conviction,
  tokenIntelligence,
}: {
  conviction: ExplainableConvictionData;
  tokenIntelligence: TokenIntelligenceData | null;
}) {
  return (
    <section className={terminalMethodologyClass}>
      <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-100/48">
            Methodology
          </p>
          <p className="mt-3 max-w-4xl text-sm leading-relaxed text-white/45">
            Insider Scan combines holder distribution, wallet metadata, cluster
            overlap, bundle-like timing, funding similarity and token-transfer
            behavior where available. It is inference-based and does not prove
            insider identity, common ownership, profitability or future price
            movement.
          </p>
        </div>
        <div className="grid min-w-[250px] grid-cols-2 gap-2 text-xs">
          <ForensicFact label="Data confidence" value={conviction.dataConfidence.label} />
          <ForensicFact
            label="Wallets analyzed"
            value={conviction.mapperCoverage.holderCount || tokenIntelligence?.analyzedWallets || "Unavailable"}
          />
          <ForensicFact
            label="Deep behavior"
            value={conviction.deepBehavior ? `${conviction.deepBehavior.analyzedWallets} wallets` : "Unavailable"}
          />
          <ForensicFact
            label="Bundle detection"
            value={conviction.bundleDetection ? `${conviction.bundleDetection.riskLevel} risk` : "Unavailable"}
          />
        </div>
      </div>
    </section>
  );
}

const INSIDER_SCAN_REMOVED_SECTIONS = [
  HolderIntelligenceMatrixPanel,
  WalletReputationMiniCard,
  InsiderHolderRiskPreview,
  InsiderScanMethodology,
];
void INSIDER_SCAN_REMOVED_SECTIONS;

function InsiderScanEmptyState({
  detail,
  title,
}: {
  detail: string;
  title: string;
}) {
  return (
    <TerminalStatePanel detail={detail} title={title} />
  );
}

function InsiderScanSkeleton({
  token,
  tokenData,
}: {
  token: string;
  tokenData: TokenResult;
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-[2rem] border border-white/10 bg-[#06080c]/90 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <SkeletonLine className="h-3 w-28" />
            <SkeletonLine className="mt-4 h-7 w-72" />
            <SkeletonLine className="mt-3 h-3 w-96 max-w-full" />
          </div>
          <div className="flex items-center gap-3">
            <TokenAvatar
              logoUrl={resolveTokenLogo(tokenData)}
              sizeClass="h-11 w-11"
              token={token}
            />
            <SkeletonLine className="h-4 w-36" />
          </div>
        </div>
      </section>
      <section className="rounded-[2rem] border border-white/10 bg-[#06080c]/90 p-5">
        <SkeletonLine className="h-3 w-40" />
        <SkeletonLine className="mt-4 h-8 w-64" />
        <SkeletonLine className="mt-4 h-3 w-full max-w-2xl" />
      </section>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <SkeletonLine className="h-3 w-28" />
            <SkeletonLine className="mt-5 h-7 w-14" />
            <SkeletonLine className="mt-5 h-3 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ForensicSectionHeading({
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
      <p className="text-xs uppercase tracking-[0.3em] text-cyan-100/42">{eyebrow}</p>
      <h2 className="mt-2 text-xl font-semibold tracking-[-0.045em] text-white/84">
        {title}
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-white/35">{description}</p>
    </div>
  );
}

function ForensicFact({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-black/24 px-3 py-2.5">
      <p className="text-[9px] uppercase tracking-[0.16em] text-white/30">{label}</p>
      <p className="mt-1 truncate text-sm font-medium tabular-nums text-white/70" title={String(value)}>
        {value}
      </p>
    </div>
  );
}

function buildConcentrationEvidence(
  walletRows: WalletRow[],
  tokenIntelligence: TokenIntelligenceData | null,
  behaviorPreview: WalletBehaviorPreviewData | null
) {
  const rows: string[] = [];
  const topHolder = walletRows[0];
  const top10 = tokenIntelligence?.holderSummary.top10Ownership;
  if (top10) rows.push(`Top 10 holders control ${top10} of observed supply.`);
  if (topHolder) {
    rows.push(
      `The largest observed holder controls ${topHolder.ownershipPercentage} of supply.`
    );
  }
  if (typeof tokenIntelligence?.holderSummary.whaleCount === "number") {
    rows.push(`${tokenIntelligence.holderSummary.whaleCount} whale-level holders are surfaced in the live summary.`);
  }
  if (typeof behaviorPreview?.summary.highestConcentrationRisk === "number") {
    rows.push(`Highest profiled concentration risk is ${behaviorPreview.summary.highestConcentrationRisk}/100.`);
  }
  return rows;
}

function buildCoordinationEvidence(
  conviction: ExplainableConvictionData,
  clusterData: WalletClusterData | null
) {
  const rows: string[] = [];
  const bundle = conviction.bundleDetection;
  if (bundle) {
    rows.push(`Bundle risk is ${bundle.bundleRiskScore}/100 with ${bundle.riskLevel.toLowerCase()} inferred risk.`);
    rows.push(`Funding similarity is ${bundle.fundingSimilarityScore}/100 when available evidence is considered.`);
    rows.push(`${bundle.detectedGroups.length} bundle-like behavioral groups are surfaced for review.`);
  }
  if (clusterData) {
    rows.push(`Cluster analysis reviewed ${clusterData.networkSummary.totalAnalyzedWallets} wallets; the dominant relationship type is ${clusterData.networkSummary.dominantRelationshipType}.`);
  }
  return rows;
}

function buildBehaviorEvidence(
  conviction: ExplainableConvictionData,
  behaviorPreview: WalletBehaviorPreviewData | null
) {
  const rows: string[] = [];
  const deep = conviction.deepBehavior?.summary;
  if (deep) {
    rows.push(`Deep behavior analyzed ${deep.analyzedWallets} wallets with ${Math.round(deep.averageAccumulationPressure)}/100 average accumulation pressure.`);
    rows.push(`Average distribution pressure is ${Math.round(deep.averageDistributionPressure)}/100 and bot-like activity risk is ${Math.round(deep.averageBotLikeActivityRisk)}/100.`);
  }
  rows.push(`Rotation risk is ${Math.round(conviction.subScores.rotationRisk)}/100 from current behavioral inputs.`);
  if (behaviorPreview?.summary.dominantBehaviorClass) {
    rows.push(`Dominant profiled behavior class is ${behaviorPreview.summary.dominantBehaviorClass}.`);
  }
  return rows;
}

function holderRiskHint(
  row: WalletRow,
  profile: WalletBehaviorProfile | undefined,
  belongsToBundleGroup: boolean
) {
  if (belongsToBundleGroup) return "Bundle watch";
  if (profile?.behaviorClass === "contract/system") return "Contract holder";
  if ((profile?.walletAgeDays ?? 999) <= 30) return "Fresh wallet";
  if (
    (profile?.concentrationRiskScore ?? 0) >= 70 ||
    readPercentage(row.ownershipPercentage) >= 5
  ) {
    return "High ownership";
  }
  if ((profile?.dormancyRiskScore ?? 0) >= 70) return "Dormant watch";
  if ((profile?.activityVelocityScore ?? 0) >= 70) return "High activity";
  return "Low concern";
}

function readPercentage(value: string) {
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function shortInsiderWalletAddress(value: string) {
  if (value.length < 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function riskGroupLabel(reason: string) {
  const value = reason.toLowerCase();
  if (value.includes("fund")) return "Shared Funding Pattern";
  if (value.includes("window") || value.includes("tim")) return "Same Activity Window";
  if (value.includes("fresh")) return "Fresh High-Ownership Wallets";
  if (value.includes("counterpart")) return "Shared Counterparty Pattern";
  if (value.includes("decentral")) return "Fake Decentralization Pattern";
  return "Bundle-Like Cluster";
}

function riskScorePillClass(score: number) {
  if (score >= 75) return "border-red-100/14 bg-red-100/[0.045] text-red-100/66";
  if (score >= 45) return "border-amber-100/14 bg-amber-100/[0.045] text-amber-100/66";
  return "border-cyan-100/12 bg-cyan-100/[0.045] text-cyan-100/66";
}

type SignalCategory =
  | "Supportive"
  | "Warning"
  | "Neutral"
  | "Insufficient data";

type SignalSeverity = "Low" | "Medium" | "High";

type NovaSignal = {
  id: string;
  title: string;
  category: SignalCategory;
  severity: SignalSeverity;
  confidence: string;
  explanation: string;
  inputs: Array<{ label: string; value: string | number }>;
  strength: number;
};

type SignalBoardModel = {
  signals: NovaSignal[];
  counts: Record<SignalCategory, number>;
  verdict: string;
  verdictCopy: string;
  strongestSignal?: NovaSignal;
  strongestWarning?: NovaSignal;
  providerLimitReached: boolean;
  isPartial: boolean;
  coverage: {
    dataConfidence: string;
    deepBehavior: string;
    holderCoverage: string | number;
    marketCoverage: string;
    providerWarnings: string;
    cacheState: string;
  };
};

function SignalsMvpSection({
  behaviorPreview,
  behaviorPreviewError,
  conviction,
  convictionError,
  convictionLoadState,
  holderError,
  holderLoadState,
  tokenData,
  tokenFlowSummaryV2,
  tokenIntelligence,
  unifiedAnalysis,
  walletRows,
}: {
  behaviorPreview: WalletBehaviorPreviewData | null;
  behaviorPreviewError: string;
  conviction: ExplainableConvictionData | null;
  convictionError: string;
  convictionLoadState: HolderLoadState;
  holderError: string;
  holderLoadState: HolderLoadState;
  tokenData: TokenResult;
  tokenFlowSummaryV2: TokenFlowSummaryV2 | null;
  tokenIntelligence: TokenIntelligenceData | null;
  unifiedAnalysis: UnifiedTokenAnalysisData | null;
  walletRows: WalletRow[];
}) {
  const hasToken = Boolean(tokenData.tokenAddress);
  const isLoading = convictionLoadState === "loading" || holderLoadState === "loading";
  const signalBoard = buildSignalBoardModel({
    behaviorPreview,
    behaviorPreviewError,
    conviction,
    convictionError,
    holderError,
    holderLoadState,
    tokenFlowSummaryV2,
    tokenIntelligence,
    unifiedAnalysis,
    walletRows,
  });

  if (!hasToken) {
    return (
      <SignalStateCard
        title="Select a token to generate signals."
        detail="Signals will summarize conviction, wallet behavior, structural risk and data coverage after a token analysis is available."
      />
    );
  }

  if (isLoading && !conviction) {
    return (
      <SignalStateCard
        title="Generating signal board."
        detail="NovaOS is waiting for conviction, holder and wallet-behavior inputs already requested for this token."
        pulse
      />
    );
  }

  if (!conviction) {
    return (
      <SignalStateCard
        title="Analyze a token first to generate conviction-based signals."
        detail="Signals are derived from the Conviction Engine, wallet behavior and structural-risk inputs. No fallback trading signal is generated without those inputs."
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1680px] space-y-4">
      <TerminalSectionHeader
        badge="Not financial advice"
        badgeTone="purple"
        subtitle="Actionable on-chain intelligence derived from conviction, wallet behavior, and structural risk."
        title="Signals"
      >
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/24 px-4 py-3 lg:min-w-[260px]">
            <TokenAvatar
              logoUrl={resolveTokenLogo(tokenData)}
              sizeClass="h-11 w-11"
              token={tokenData.symbol}
            />
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.18em] text-white/32">
                Signal board
              </p>
              <p className="mt-1 truncate text-sm font-medium text-white/78">
                {tokenData.symbol} signal board
              </p>
            </div>
          </div>
      </TerminalSectionHeader>

      {(signalBoard.providerLimitReached || signalBoard.isPartial) && (
        <div className="grid gap-3 lg:grid-cols-2">
          {signalBoard.providerLimitReached && (
            <SignalNotice
              title="Provider limit surfaced"
              detail="One or more providers reported a limit or rate restriction. Signals are generated only from state already loaded."
              tone="warning"
            />
          )}
          {signalBoard.isPartial && (
            <SignalNotice
              title="Partial signal coverage"
              detail="Some inputs are missing or partial, so NovaOS marks coverage conservatively and keeps insufficient-data signals visible."
            />
          )}
        </div>
      )}

      <SignalSummaryPanel model={signalBoard} />

      <section>
        <SignalSectionHeading
          eyebrow="Signal Cards"
          title="What matters right now"
          description="Each card is generated deterministically from measured NovaOS inputs. No buy, sell or price target language is used."
        />
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {signalBoard.signals.map((signal) => (
            <SignalCard key={signal.id} signal={signal} />
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <SignalListPanel
          emptyCopy="No major warning signal surfaced from available data."
          signals={signalBoard.signals.filter(
            (signal) => signal.category === "Warning"
          )}
          title="Risk Alerts"
        />
        <SignalListPanel
          emptyCopy="No strong supportive signal surfaced from available data."
          signals={signalBoard.signals.filter(
            (signal) => signal.category === "Supportive"
          )}
          title="Opportunity Signals"
        />
      </section>

      <SignalCoveragePanel model={signalBoard} />

      <section className={terminalMethodologyClass}>
        Signals convert existing NovaOS conviction, wallet behavior, wallet flow,
        structural-risk and coverage inputs into conservative intelligence cards.
        They do not calculate PnL, win rate, smart-money identity, insider
        identity, buy or sell instructions, or future price movement.
      </section>
    </div>
  );
}

function buildSignalBoardModel({
  behaviorPreview,
  behaviorPreviewError,
  conviction,
  convictionError,
  holderError,
  holderLoadState,
  tokenFlowSummaryV2,
  tokenIntelligence,
  unifiedAnalysis,
  walletRows,
}: {
  behaviorPreview: WalletBehaviorPreviewData | null;
  behaviorPreviewError: string;
  conviction: ExplainableConvictionData | null;
  convictionError: string;
  holderError: string;
  holderLoadState: HolderLoadState;
  tokenFlowSummaryV2?: TokenFlowSummaryV2 | null;
  tokenIntelligence: TokenIntelligenceData | null;
  unifiedAnalysis: UnifiedTokenAnalysisData | null;
  walletRows: WalletRow[];
}): SignalBoardModel {
  const warnings = [
    convictionError,
    holderError,
    behaviorPreviewError,
    ...(conviction?.warnings || []),
    ...(conviction?.mapperWarnings || []),
    ...(conviction?.dataConfidence.warnings || []),
    ...(conviction?.deepBehavior?.warnings || []),
    ...(tokenIntelligence?.warnings || []),
    ...(unifiedAnalysis?.warnings || []),
  ].filter(Boolean);
  const providerLimitReached = warnings.some(isProviderLimitMessage);
  const modules = unifiedAnalysis?.modules ? Object.values(unifiedAnalysis.modules) : [];
  const isPartial =
    holderLoadState === "error" ||
    conviction?.status === "partial" ||
    modules.some((module) => module?.status === "failed" || module?.status === "skipped") ||
    warnings.length > 0;
  const signals = conviction
    ? generateNovaSignals({
        conviction,
        isPartial,
        providerLimitReached,
        tokenFlowSummaryV2,
        tokenIntelligence,
      })
    : [];
  const counts = countSignals(signals);
  const strongestSignal = [...signals]
    .filter((signal) => signal.category === "Supportive")
    .sort(compareSignalStrength)[0];
  const strongestWarning = [...signals]
    .filter((signal) => signal.category === "Warning")
    .sort(compareSignalStrength)[0];
  const verdict = deriveSignalSummaryVerdict({
    counts,
    isPartial,
    strongestWarning,
  });

  return {
    signals,
    counts,
    verdict: verdict.title,
    verdictCopy: verdict.copy,
    strongestSignal,
    strongestWarning,
    providerLimitReached,
    isPartial,
    coverage: {
      dataConfidence: conviction
        ? `${conviction.dataConfidence.label} (${Math.round(conviction.dataConfidence.score)}/100)`
        : "Unavailable",
      deepBehavior: conviction?.deepBehavior?.enabled
        ? `${conviction.deepBehavior.analyzedWallets} wallets`
        : "Missing",
      holderCoverage:
        `${conviction?.mapperCoverage.holderCount ||
          tokenIntelligence?.analyzedWallets ||
          walletRows.length ||
          "Unavailable"} holders / ${
          behaviorPreview?.summary.profiledWallets ?? 0
        } profiles`,
      marketCoverage: conviction?.mapperCoverage.hasMarketData
        ? "Available"
        : "Missing or partial",
      providerWarnings: providerLimitReached
        ? "Provider limit or rate warning"
        : warnings.length
        ? `${warnings.length} warning(s)`
        : "None surfaced",
      cacheState: unifiedAnalysis?.cache?.hit
        ? "Cache hit"
        : unifiedAnalysis
        ? "Live or refreshed"
        : "Unavailable",
    },
  };
}

function generateNovaSignals({
  conviction,
  isPartial,
  providerLimitReached,
  tokenFlowSummaryV2,
  tokenIntelligence,
}: {
  conviction: ExplainableConvictionData;
  isPartial: boolean;
  providerLimitReached: boolean;
  tokenFlowSummaryV2?: TokenFlowSummaryV2 | null;
  tokenIntelligence: TokenIntelligenceData | null;
}): NovaSignal[] {
  const confidence = conviction.dataConfidence.label;
  const deepSummary = conviction.deepBehavior?.summary;
  const bundle = conviction.bundleDetection;
  const signals: NovaSignal[] = [];

  signals.push(buildConvictionSignal(conviction, confidence));
  signals.push(buildRiskProtectionSignal(conviction, confidence));
  signals.push(buildWalletFlowSignal(conviction, confidence, tokenFlowSummaryV2));
  signals.push(buildHolderQualitySignal(conviction, confidence));
  signals.push(buildLiquiditySignal(conviction, confidence));
  signals.push(buildBundleInsiderSignal(conviction, confidence));
  signals.push(
    buildDataConfidenceSignal({
      conviction,
      isPartial,
      providerLimitReached,
      tokenIntelligence,
    })
  );

  if (deepSummary?.averageDistributionPressure && deepSummary.averageDistributionPressure >= 70) {
    signals.push({
      id: "distribution-pressure",
      title: "Distribution Pressure Elevated",
      category: "Warning",
      severity: deepSummary.averageDistributionPressure >= 82 ? "High" : "Medium",
      confidence,
      explanation: `Average distribution pressure is ${Math.round(deepSummary.averageDistributionPressure)}/100 across analyzed wallets.`,
      inputs: [
        { label: "Distribution Pressure", value: formatSignalScore(deepSummary.averageDistributionPressure) },
        { label: "Accumulation Pressure", value: formatSignalScore(deepSummary.averageAccumulationPressure) },
      ],
      strength: deepSummary.averageDistributionPressure,
    });
  }

  if (typeof bundle?.bundleRiskScore === "number" && bundle.bundleRiskScore >= 70) {
    signals.push({
      id: "bundle-risk-alert",
      title: "Bundle Risk Elevated",
      category: "Warning",
      severity: bundle.bundleRiskScore >= 85 ? "High" : "Medium",
      confidence,
      explanation: `Bundle risk is ${bundle.bundleRiskScore}/100, so bundle-like holder structure is materially affecting the token profile.`,
      inputs: [
        { label: "Bundle Risk", value: formatSignalScore(bundle.bundleRiskScore) },
        { label: "Fake Decentralization", value: formatSignalScore(bundle.fakeDecentralizationRisk) },
        { label: "Detected Groups", value: bundle.detectedGroups.length },
      ],
      strength: bundle.bundleRiskScore,
    });
  }

  return signals;
}

function buildConvictionSignal(
  conviction: ExplainableConvictionData,
  confidence: string
): NovaSignal {
  const score = conviction.finalConvictionScore;
  const category: SignalCategory =
    score >= 75 ? "Supportive" : score >= 55 ? "Neutral" : score >= 35 ? "Neutral" : "Warning";
  const title =
    score >= 75
      ? "Supportive Conviction Structure"
      : score >= 55
      ? "Mixed Conviction Structure"
      : score >= 35
      ? "Weak/Mixed Conviction"
      : "Low Conviction Structure";

  return {
    id: "conviction",
    title,
    category,
    severity: score < 35 ? "High" : score < 55 ? "Medium" : "Low",
    confidence,
    explanation: `Final conviction is ${Math.round(score)}/100 based on current holder, wallet, liquidity and risk inputs.`,
    inputs: [
      { label: "Final Conviction", value: formatSignalScore(score) },
      { label: "Data Confidence", value: confidence },
    ],
    strength: category === "Warning" ? 100 - score : score,
  };
}

function buildRiskProtectionSignal(
  conviction: ExplainableConvictionData,
  confidence: string
): NovaSignal {
  const riskProtection = conviction.subScores.riskProtection;
  const insiderRisk = conviction.subScores.insiderRisk;
  const bundleRisk = conviction.bundleDetection?.bundleRiskScore;
  const clusterRisk = conviction.subScores.clusterRisk;
  const majorRisk = Math.max(insiderRisk, bundleRisk ?? 0, clusterRisk);
  const category: SignalCategory =
    riskProtection >= 65 && majorRisk < 45
      ? "Supportive"
      : riskProtection < 45 || insiderRisk >= 70 || (bundleRisk ?? 0) >= 70
      ? "Warning"
      : "Neutral";

  return {
    id: "risk-protection",
    title:
      category === "Supportive"
        ? "Risk Protection Holding"
        : category === "Warning"
        ? "Risk Protection Pressure"
        : "Mixed Risk Protection",
    category,
    severity: category === "Warning" && (riskProtection < 35 || majorRisk >= 80) ? "High" : category === "Neutral" ? "Low" : "Medium",
    confidence,
    explanation:
      category === "Warning"
        ? `Risk protection is ${Math.round(riskProtection)}/100 while major structural risk reaches ${Math.round(majorRisk)}/100.`
        : `Risk protection is ${Math.round(riskProtection)}/100 against the currently measured structural risk inputs.`,
    inputs: [
      { label: "Risk Protection", value: formatSignalScore(riskProtection) },
      { label: "Insider Risk", value: formatSignalScore(insiderRisk) },
      { label: "Bundle Risk", value: formatOptionalSignalScore(bundleRisk) },
      { label: "Cluster Risk", value: formatSignalScore(clusterRisk) },
    ],
    strength: category === "Warning" ? Math.max(100 - riskProtection, majorRisk) : riskProtection,
  };
}

function buildWalletFlowSignal(
  conviction: ExplainableConvictionData,
  confidence: string,
  tokenFlowSummaryV2?: TokenFlowSummaryV2 | null
): NovaSignal {
  if (tokenFlowSummaryV2) {
    const summary = tokenFlowSummaryV2;
    const warningDominant =
      summary.dominantFlow === "Distribution Dominant" ||
      summary.dominantFlow === "Rotation Heavy";
    const category: SignalCategory =
      summary.dominantFlow === "Data Limited"
        ? "Insufficient data"
        : summary.dominantFlow === "Accumulation Dominant"
        ? "Supportive"
        : warningDominant
        ? "Warning"
        : "Neutral";

    return {
      id: "wallet-flow",
      title:
        summary.dominantFlow === "Data Limited"
          ? "Wallet Flow V2 Data Limited"
          : summary.dominantFlow,
      category,
      severity:
        category === "Warning" && Math.max(summary.distributionPressure, summary.rotationPressure) >= 80
          ? "High"
          : Math.abs(summary.netFlowBias) >= 20 || summary.rotationPressure >= 70
          ? "Medium"
          : "Low",
      confidence,
      explanation: summary.verdict,
      inputs: [
        { label: "Accumulation", value: formatSignalScore(summary.accumulationPressure) },
        { label: "Distribution", value: formatSignalScore(summary.distributionPressure) },
        { label: "Rotation", value: formatSignalScore(summary.rotationPressure) },
        { label: "Dormancy", value: formatSignalScore(summary.dormancyPressure) },
      ],
      strength: Math.max(
        summary.accumulationPressure,
        summary.distributionPressure,
        summary.rotationPressure,
        summary.dormancyPressure
      ),
    };
  }

  const deep = conviction.deepBehavior?.summary;
  const rotationRisk = deep?.averageRotationBehaviorRisk ?? conviction.subScores.rotationRisk;

  if (!deep) {
    return {
      id: "wallet-flow",
      title: "Wallet Flow Data Missing",
      category: "Insufficient data",
      severity: "Low",
      confidence,
      explanation: "Deep wallet behavior is not loaded, so NovaOS is not inferring accumulation or distribution pressure.",
      inputs: [
        { label: "Deep Behavior", value: "Missing" },
        { label: "Rotation Risk", value: formatSignalScore(rotationRisk) },
      ],
      strength: 30,
    };
  }

  const accumulation = deep.averageAccumulationPressure;
  const distribution = deep.averageDistributionPressure;
  const spread = Math.abs(accumulation - distribution);
  const category: SignalCategory =
    rotationRisk >= 70
      ? "Warning"
      : accumulation >= distribution + 12
      ? "Supportive"
      : distribution >= accumulation + 12
      ? "Warning"
      : "Neutral";

  return {
    id: "wallet-flow",
    title:
      category === "Supportive"
        ? "Accumulation Dominant"
        : rotationRisk >= 70
        ? "Rotation Risk Elevated"
        : category === "Warning"
        ? "Distribution Pressure Leading"
        : "Mixed Wallet Flow",
    category,
    severity: category === "Warning" && Math.max(rotationRisk, distribution) >= 80 ? "High" : spread >= 20 ? "Medium" : "Low",
    confidence,
    explanation:
      rotationRisk >= 70
        ? `Rotation risk is ${Math.round(rotationRisk)}/100 across analyzed wallet-flow inputs.`
        : `Accumulation is ${Math.round(accumulation)}/100 and distribution is ${Math.round(distribution)}/100 in deep behavior.`,
    inputs: [
      { label: "Accumulation", value: formatSignalScore(accumulation) },
      { label: "Distribution", value: formatSignalScore(distribution) },
      { label: "Rotation Risk", value: formatSignalScore(rotationRisk) },
    ],
    strength: Math.max(accumulation, distribution, rotationRisk),
  };
}

function buildHolderQualitySignal(
  conviction: ExplainableConvictionData,
  confidence: string
): NovaSignal {
  const holderIntegrity = conviction.subScores.holderIntegrity;
  const walletQuality = conviction.subScores.walletQuality;
  const category: SignalCategory =
    holderIntegrity >= 65 && walletQuality >= 65
      ? "Supportive"
      : holderIntegrity < 45 || walletQuality < 45
      ? "Warning"
      : "Neutral";

  return {
    id: "holder-quality",
    title:
      category === "Supportive"
        ? "Holder Quality Supportive"
        : category === "Warning"
        ? "Weak Wallet Quality"
        : "Mixed Holder Quality",
    category,
    severity: category === "Warning" && Math.min(holderIntegrity, walletQuality) < 35 ? "High" : category === "Warning" ? "Medium" : "Low",
    confidence,
    explanation: `Holder integrity is ${Math.round(holderIntegrity)}/100 and wallet quality is ${Math.round(walletQuality)}/100.`,
    inputs: [
      { label: "Holder Integrity", value: formatSignalScore(holderIntegrity) },
      { label: "Wallet Quality", value: formatSignalScore(walletQuality) },
    ],
    strength: category === "Warning" ? 100 - Math.min(holderIntegrity, walletQuality) : Math.max(holderIntegrity, walletQuality),
  };
}

function buildLiquiditySignal(
  conviction: ExplainableConvictionData,
  confidence: string
): NovaSignal {
  const liquidityTrust = conviction.subScores.liquidityTrust;
  const hasMarketData = conviction.mapperCoverage.hasMarketData;
  const category: SignalCategory = !hasMarketData
    ? "Insufficient data"
    : liquidityTrust >= 65
    ? "Supportive"
    : liquidityTrust < 45
    ? "Warning"
    : "Neutral";

  return {
    id: "liquidity-trust",
    title:
      category === "Supportive"
        ? "Strong Liquidity Trust"
        : category === "Warning"
        ? "Weak Liquidity Trust"
        : category === "Insufficient data"
        ? "Liquidity Coverage Missing"
        : "Mixed Liquidity Trust",
    category,
    severity: category === "Warning" && liquidityTrust < 35 ? "High" : category === "Warning" ? "Medium" : "Low",
    confidence,
    explanation: hasMarketData
      ? `Liquidity trust is ${Math.round(liquidityTrust)}/100 from available market coverage.`
      : "Market coverage is missing or partial, so liquidity trust is marked data-limited.",
    inputs: [
      { label: "Liquidity Trust", value: formatSignalScore(liquidityTrust) },
      { label: "Market Coverage", value: hasMarketData ? "Available" : "Missing" },
    ],
    strength: category === "Warning" ? 100 - liquidityTrust : liquidityTrust,
  };
}

function buildBundleInsiderSignal(
  conviction: ExplainableConvictionData,
  confidence: string
): NovaSignal {
  const insiderRisk = conviction.subScores.insiderRisk;
  const bundleRisk = conviction.bundleDetection?.bundleRiskScore;
  const fakeDecentralization = conviction.bundleDetection?.fakeDecentralizationRisk;
  const maxRisk = Math.max(insiderRisk, bundleRisk ?? 0, fakeDecentralization ?? 0);
  const category: SignalCategory =
    maxRisk >= 65 ? "Warning" : maxRisk <= 35 ? "Supportive" : "Neutral";

  return {
    id: "bundle-insider",
    title:
      category === "Warning"
        ? "Elevated Insider or Bundle Risk"
        : category === "Supportive"
        ? "Low Structural Concentration Risk"
        : "Mixed Structural Risk",
    category,
    severity: maxRisk >= 85 ? "High" : maxRisk >= 65 ? "Medium" : "Low",
    confidence,
    explanation:
      category === "Warning"
        ? `The strongest structural risk input is ${Math.round(maxRisk)}/100, so concentration or coordination-sensitive patterns matter right now.`
        : `Insider, bundle and fake-decentralization inputs do not show a dominant high-risk reading from available data.`,
    inputs: [
      { label: "Insider Risk", value: formatSignalScore(insiderRisk) },
      { label: "Bundle Risk", value: formatOptionalSignalScore(bundleRisk) },
      { label: "Fake Decentralization", value: formatOptionalSignalScore(fakeDecentralization) },
    ],
    strength: category === "Warning" ? maxRisk : 100 - maxRisk,
  };
}

function buildDataConfidenceSignal({
  conviction,
  isPartial,
  providerLimitReached,
  tokenIntelligence,
}: {
  conviction: ExplainableConvictionData;
  isPartial: boolean;
  providerLimitReached: boolean;
  tokenIntelligence: TokenIntelligenceData | null;
}): NovaSignal {
  const confidenceScore = conviction.dataConfidence.score;
  const confidenceLabel = conviction.dataConfidence.label;
  const category: SignalCategory =
    providerLimitReached || confidenceLabel === "Low"
      ? "Insufficient data"
      : isPartial
      ? "Neutral"
      : confidenceLabel === "High"
      ? "Supportive"
      : "Neutral";

  return {
    id: "data-confidence",
    title:
      category === "Supportive"
        ? "High Signal Confidence"
        : category === "Insufficient data"
        ? "Low or Limited Data Confidence"
        : "Medium Signal Confidence",
    category,
    severity: category === "Insufficient data" ? "Medium" : "Low",
    confidence: confidenceLabel,
    explanation: `Signals are only as strong as available coverage. Current data confidence is ${confidenceLabel.toLowerCase()} at ${Math.round(confidenceScore)}/100.`,
    inputs: [
      { label: "Data Confidence", value: formatSignalScore(confidenceScore) },
      { label: "Holder Coverage", value: conviction.mapperCoverage.holderCount },
      { label: "Token Intelligence", value: tokenIntelligence ? "Available" : "Missing" },
      { label: "Partial State", value: isPartial ? "Yes" : "No" },
    ],
    strength: category === "Insufficient data" ? 100 - confidenceScore : confidenceScore,
  };
}

function countSignals(signals: NovaSignal[]): Record<SignalCategory, number> {
  return {
    Supportive: signals.filter((signal) => signal.category === "Supportive").length,
    Warning: signals.filter((signal) => signal.category === "Warning").length,
    Neutral: signals.filter((signal) => signal.category === "Neutral").length,
    "Insufficient data": signals.filter(
      (signal) => signal.category === "Insufficient data"
    ).length,
  };
}

function compareSignalStrength(a: NovaSignal, b: NovaSignal) {
  const severityWeight = { High: 300, Medium: 200, Low: 100 };
  return severityWeight[b.severity] + b.strength - (severityWeight[a.severity] + a.strength);
}

function deriveSignalSummaryVerdict({
  counts,
  isPartial,
  strongestWarning,
}: {
  counts: Record<SignalCategory, number>;
  isPartial: boolean;
  strongestWarning?: NovaSignal;
}) {
  if (counts["Insufficient data"] >= 3 || (isPartial && counts.Supportive <= 1)) {
    return {
      title: "Data-limited profile",
      copy: "Several signal inputs are unavailable or partial, so NovaOS keeps the signal board conservative.",
    };
  }
  if (counts.Warning >= 3 || strongestWarning?.severity === "High") {
    return {
      title: "Risk-dominant profile",
      copy: "Warning signals are currently more important than supportive signals in the available analysis.",
    };
  }
  if (counts.Supportive > 0 && counts.Warning > 0) {
    return {
      title: counts.Supportive >= counts.Warning ? "Supportive but risky" : "Mixed signal profile",
      copy: "Supportive and warning inputs are both present, so attention should stay on the highest-severity risks.",
    };
  }
  if (counts.Supportive > counts.Warning) {
    return {
      title: "Supportive profile",
      copy: "Supportive signals dominate the available inputs, with no major warning signal leading the board.",
    };
  }
  return {
    title: "Mixed signal profile",
    copy: "No single signal direction dominates the current NovaOS analysis.",
  };
}

function SignalSummaryPanel({ model }: { model: SignalBoardModel }) {
  return (
    <section className="grid gap-4 xl:grid-cols-[0.78fr_1.22fr]">
      <div className="rounded-[2rem] border border-cyan-100/10 bg-cyan-100/[0.025] p-5">
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-100/42">
          Signal Summary
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.055em] text-white/88">
          {model.verdict}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-white/42">
          {model.verdictCopy}
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <FlowTinyFact
            label="Strongest signal"
            value={model.strongestSignal?.title || "None surfaced"}
          />
          <FlowTinyFact
            label="Strongest warning"
            value={model.strongestWarning?.title || "None surfaced"}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SignalCountCard label="Total" value={model.signals.length} />
        <SignalCountCard label="Supportive" value={model.counts.Supportive} />
        <SignalCountCard label="Warning" value={model.counts.Warning} />
        <SignalCountCard label="Neutral" value={model.counts.Neutral} />
        <SignalCountCard
          label="Insufficient"
          value={model.counts["Insufficient data"]}
        />
      </div>
    </section>
  );
}

function SignalCard({ signal }: { signal: NovaSignal }) {
  return (
    <article className={`min-h-[220px] rounded-[1.5rem] border p-4 ${signalCardSurfaceClass(signal.category)}`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold tracking-[-0.035em] text-white/84">
          {signal.title}
        </h3>
        <SignalCategoryPill category={signal.category} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] text-white/42">
          Severity {signal.severity}
        </span>
        <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] text-white/42">
          {signal.confidence} confidence
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-white/42">
        {signal.explanation}
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {signal.inputs.map((input) => (
          <FlowTinyFact key={`${signal.id}-${input.label}`} label={input.label} value={input.value} />
        ))}
      </div>
    </article>
  );
}

function SignalListPanel({
  emptyCopy,
  signals,
  title,
}: {
  emptyCopy: string;
  signals: NovaSignal[];
  title: string;
}) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-2xl">
      <h2 className="text-xl font-semibold tracking-[-0.045em] text-white/86">
        {title}
      </h2>
      <div className="mt-3 space-y-2">
        {signals.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-white/36">
            {emptyCopy}
          </p>
        ) : (
          signals.map((signal) => (
            <div
              key={`${title}-${signal.id}`}
              className="rounded-2xl border border-white/[0.08] bg-black/22 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-white/76">{signal.title}</p>
                <span className="text-xs text-white/34">{signal.severity}</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-white/35">
                {signal.explanation}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function SignalCoveragePanel({ model }: { model: SignalBoardModel }) {
  const coverageRows = [
    ["Data confidence", model.coverage.dataConfidence],
    ["Deep behavior", model.coverage.deepBehavior],
    ["Holder coverage", model.coverage.holderCoverage],
    ["Market coverage", model.coverage.marketCoverage],
    ["Provider warnings", model.coverage.providerWarnings],
    ["Cache / partial state", model.coverage.cacheState],
  ] as const;

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-2xl">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-100/42">
            Confidence / Coverage
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.045em] text-white/86">
            Signal Confidence
          </h2>
        </div>
        <p className="max-w-xl text-xs leading-relaxed text-white/34">
          Signals are only as strong as the available data coverage.
        </p>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-3">
        {coverageRows.map(([label, value]) => (
          <FlowTinyFact key={label} label={label} value={value} />
        ))}
      </div>
    </section>
  );
}

function SignalSectionHeading({
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
      <p className="text-xs uppercase tracking-[0.3em] text-cyan-100/42">{eyebrow}</p>
      <h2 className="mt-2 text-xl font-semibold tracking-[-0.045em] text-white/84">
        {title}
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-white/35">{description}</p>
    </div>
  );
}

function SignalCountCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-[10px] uppercase tracking-[0.16em] text-white/32">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-[-0.055em] text-white/86">
        {value}
      </p>
    </div>
  );
}

function SignalCategoryPill({ category }: { category: SignalCategory }) {
  return (
    <span className={`shrink-0 rounded-full border px-3 py-1 text-[11px] ${signalCategoryClass(category)}`}>
      {category}
    </span>
  );
}

function SignalNotice({
  detail,
  title,
  tone = "default",
}: {
  detail: string;
  title: string;
  tone?: "default" | "warning";
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        tone === "warning"
          ? "border-amber-100/14 bg-amber-100/[0.035]"
          : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <p className="text-sm font-medium text-white/76">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-white/34">{detail}</p>
    </div>
  );
}

function SignalStateCard({
  detail,
  pulse = false,
  title,
}: {
  detail: string;
  pulse?: boolean;
  title: string;
}) {
  return (
    <TerminalStatePanel detail={detail} pulse={pulse} title={title} />
  );
}

function formatSignalScore(value: number) {
  return `${Math.round(value)}/100`;
}

function formatOptionalSignalScore(value?: number) {
  return typeof value === "number" ? formatSignalScore(value) : "Unavailable";
}

function signalCategoryClass(category: SignalCategory) {
  if (category === "Supportive") {
    return "border-emerald-100/15 bg-emerald-100/[0.05] text-emerald-100/68";
  }
  if (category === "Warning") {
    return "border-amber-100/15 bg-amber-100/[0.05] text-amber-100/66";
  }
  if (category === "Insufficient data") {
    return "border-white/10 bg-white/[0.035] text-white/42";
  }
  return "border-cyan-100/12 bg-cyan-100/[0.045] text-cyan-100/68";
}

function signalCardSurfaceClass(category: SignalCategory) {
  if (category === "Supportive") return "border-emerald-100/12 bg-emerald-100/[0.035]";
  if (category === "Warning") return "border-amber-100/14 bg-amber-100/[0.035]";
  if (category === "Insufficient data") return "border-white/10 bg-white/[0.025]";
  return "border-cyan-100/10 bg-cyan-100/[0.025]";
}

type WatchlistSortMode =
  | "recent"
  | "conviction"
  | "risk"
  | "liquidity";

type WatchlistFilterMode = "All" | "Supportive" | "Warning" | "Unknown";

function WatchlistMvpSection({
  currentTokenData,
  items,
  onAddCurrent,
  onOpenItem,
  onRemoveItem,
  status,
}: {
  currentTokenData: TokenResult;
  items: WatchlistItem[];
  onAddCurrent: () => void;
  onOpenItem: (item: WatchlistItem) => void;
  onRemoveItem: (id: string) => void;
  status: string;
}) {
  const [sortMode, setSortMode] = useState<WatchlistSortMode>("recent");
  const [filterMode, setFilterMode] = useState<WatchlistFilterMode>("All");
  const [selectedId, setSelectedId] = useState<string>("");
  const summary = buildWatchlistSummary(items);
  const filteredItems = filterWatchlistItems(items, filterMode);
  const sortedItems = sortWatchlistItems(filteredItems, sortMode);
  const selectedItem =
    items.find((item) => item.id === selectedId) || sortedItems[0] || null;

  return (
    <div className="mx-auto max-w-[1680px] space-y-4">
      <TerminalSectionHeader
        badge="Local MVP"
        subtitle="Track token conviction, structural risk, and signal snapshots locally."
        title="Watchlist"
      >
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onAddCurrent}
              className="rounded-full border border-purple-100/12 bg-purple-100/[0.045] px-4 py-2 text-xs text-purple-100/68 transition hover:bg-purple-100/[0.075]"
            >
              {status || "Add current token"}
            </button>
          </div>
      </TerminalSectionHeader>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <WatchlistSummaryCard label="Tracked Tokens" value={items.length} />
        <WatchlistSummaryCard
          label="Average Conviction"
          value={summary.averageConviction}
        />
        <WatchlistSummaryCard
          label="Highest Conviction"
          value={summary.highestConviction}
        />
        <WatchlistSummaryCard label="Highest Risk" value={summary.highestRisk} />
        <WatchlistSummaryCard
          label="Recently Updated"
          value={summary.recentlyUpdated}
        />
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-4 backdrop-blur-2xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-100/42">
              Local Snapshots
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.045em] text-white/86">
              Watchlist Items
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ["recent", "Recently updated"],
              ["conviction", "Conviction high"],
              ["risk", "Risk high"],
              ["liquidity", "Liquidity high"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setSortMode(value as WatchlistSortMode)}
                className={`rounded-full border px-3 py-2 text-xs transition ${
                  sortMode === value
                    ? "border-cyan-100/16 bg-cyan-100/[0.06] text-cyan-100/72"
                    : "border-white/10 bg-white/[0.025] text-white/38 hover:bg-white/[0.045]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {(["All", "Supportive", "Warning", "Unknown"] as WatchlistFilterMode[]).map(
            (filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setFilterMode(filter)}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  filterMode === filter
                    ? "border-purple-100/16 bg-purple-100/[0.055] text-purple-100/70"
                    : "border-white/10 bg-white/[0.025] text-white/38 hover:bg-white/[0.045]"
                }`}
              >
                {filter}
              </button>
            )
          )}
        </div>

        {items.length === 0 ? (
          <div className="mt-4">
            <TerminalStatePanel
              title="Your watchlist is empty."
              detail="Analyze a token and add it to your watchlist to track conviction snapshots locally."
            />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-[1.35rem] border border-white/10">
            <div className={`grid min-w-[1120px] grid-cols-[minmax(220px,1.35fr)_minmax(120px,0.8fr)_minmax(100px,0.7fr)_minmax(110px,0.7fr)_minmax(110px,0.7fr)_minmax(92px,0.55fr)_minmax(110px,0.7fr)_minmax(155px,0.95fr)_minmax(130px,0.75fr)_minmax(230px,1.15fr)] gap-3 ${terminalTableHeaderClass}`}>
              <span>Token</span>
              <span>Chain / Dex</span>
              <span>Price</span>
              <span>Market Cap</span>
              <span>Liquidity</span>
              <span>Conviction</span>
              <span>Confidence</span>
              <span>Risk</span>
              <span>Updated</span>
              <span>Actions</span>
            </div>
            <div>
              {sortedItems.map((item) => (
                <WatchlistRow
                  currentTokenData={currentTokenData}
                  isSelected={selectedItem?.id === item.id}
                  item={item}
                  key={item.id}
                  onOpenItem={onOpenItem}
                  onRemoveItem={onRemoveItem}
                  onSelectItem={setSelectedId}
                  onUpdateCurrent={onAddCurrent}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      <WatchlistDetailPanel item={selectedItem} />

      <section className={terminalMethodologyClass}>
        Watchlist MVP stores local snapshots in your browser. Values do not
        auto-refresh yet. Re-analyze a token to update its latest snapshot.
      </section>
    </div>
  );
}

function WatchlistRow({
  currentTokenData,
  isSelected,
  item,
  onOpenItem,
  onRemoveItem,
  onSelectItem,
  onUpdateCurrent,
}: {
  currentTokenData: TokenResult;
  isSelected: boolean;
  item: WatchlistItem;
  onOpenItem: (item: WatchlistItem) => void;
  onRemoveItem: (id: string) => void;
  onSelectItem: (id: string) => void;
  onUpdateCurrent: () => void;
}) {
  const canUpdate = sameWatchlistToken(item, currentTokenData);
  const risk = watchlistRiskLevel(item);

  return (
    <div
      className={`grid min-h-[72px] min-w-[1120px] grid-cols-[minmax(220px,1.35fr)_minmax(120px,0.8fr)_minmax(100px,0.7fr)_minmax(110px,0.7fr)_minmax(110px,0.7fr)_minmax(92px,0.55fr)_minmax(110px,0.7fr)_minmax(155px,0.95fr)_minmax(130px,0.75fr)_minmax(230px,1.15fr)] items-center gap-3 ${terminalRowClass} ${
        isSelected ? "bg-cyan-100/[0.035]" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => onSelectItem(item.id)}
        className="flex min-w-0 items-center gap-3 text-left"
      >
        <TokenAvatar
          logoUrl={item.tokenLogo}
          sizeClass="h-10 w-10"
          token={item.tokenSymbol}
        />
        <div className="min-w-0">
          <p className="truncate font-medium text-white/78">{item.tokenSymbol}</p>
          <p className="mt-0.5 truncate text-xs text-white/32">{item.tokenName}</p>
        </div>
      </button>
      <span className="truncate text-white/46">
        {chainLabel(item.chain)} / {item.dex}
      </span>
      <span className="truncate tabular-nums text-white/58">{item.price}</span>
      <span className="truncate tabular-nums text-white/58">{item.marketCap}</span>
      <span className="truncate tabular-nums text-white/58">{item.liquidity}</span>
      <span className="tabular-nums text-cyan-100/70">
        {formatWatchlistScore(item.finalConviction)}
      </span>
      <span className="truncate text-white/48">{item.dataConfidence || "Unknown"}</span>
      <span className={`w-fit rounded-full border px-3 py-1 text-xs ${watchlistRiskClass(risk)}`}>
        {risk}
      </span>
      <span className="truncate text-xs text-white/35">
        {formatWatchlistTime(item.lastUpdatedAt)}
      </span>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onOpenItem(item)}
          className="rounded-full border border-cyan-100/12 bg-cyan-100/[0.04] px-3 py-1.5 text-xs text-cyan-100/64 transition hover:bg-cyan-100/[0.07]"
        >
          Analyze/Open
        </button>
        <button
          type="button"
          onClick={onUpdateCurrent}
          disabled={!canUpdate}
          className={`rounded-full border px-3 py-1.5 text-xs transition ${
            canUpdate
              ? "border-purple-100/12 bg-purple-100/[0.04] text-purple-100/64 hover:bg-purple-100/[0.07]"
              : "cursor-not-allowed border-white/8 bg-white/[0.02] text-white/24"
          }`}
        >
          Update
        </button>
        <button
          type="button"
          onClick={() => onRemoveItem(item.id)}
          className="rounded-full border border-white/10 bg-white/[0.025] px-3 py-1.5 text-xs text-white/42 transition hover:bg-white/[0.05]"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function WatchlistDetailPanel({ item }: { item: WatchlistItem | null }) {
  if (!item) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 text-sm text-white/36">
        Selected token snapshot detail will appear after a token is added.
      </section>
    );
  }

  const facts = [
    ["Final Conviction", formatWatchlistScore(item.finalConviction)],
    ["Holder Integrity", formatWatchlistScore(item.holderIntegrity)],
    ["Wallet Quality", formatWatchlistScore(item.walletQuality)],
    ["Risk Protection", formatWatchlistScore(item.riskProtection)],
    ["Insider Risk", formatWatchlistScore(item.insiderRisk)],
    ["Bundle Risk", formatWatchlistScore(item.bundleRisk)],
    ["Cluster Risk", formatWatchlistScore(item.clusterRisk)],
    ["Latest Signal Verdict", item.latestSignalVerdict || "Unavailable"],
  ] as const;

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-2xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <TokenAvatar
            logoUrl={item.tokenLogo}
            sizeClass="h-11 w-11"
            token={item.tokenSymbol}
          />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-100/42">
              Selected Snapshot
            </p>
            <h2 className="mt-1 truncate text-xl font-semibold tracking-[-0.045em] text-white/86">
              {item.tokenSymbol} local snapshot
            </h2>
          </div>
        </div>
        <span className={`w-fit rounded-full border px-3 py-1 text-xs ${watchlistRiskClass(watchlistRiskLevel(item))}`}>
          {watchlistRiskLevel(item)}
        </span>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-4">
        {facts.map(([label, value]) => (
          <FlowTinyFact key={label} label={label} value={value} />
        ))}
      </div>
    </section>
  );
}

function WatchlistSummaryCard({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-[10px] uppercase tracking-[0.16em] text-white/32">{label}</p>
      <p className="mt-3 truncate text-lg font-semibold tracking-[-0.045em] text-white/86">
        {value}
      </p>
    </div>
  );
}

function buildWatchlistSummary(items: WatchlistItem[]) {
  const convictionItems = items.filter(
    (item) => typeof item.finalConviction === "number"
  );
  const averageConviction = convictionItems.length
    ? `${Math.round(
        convictionItems.reduce(
          (sum, item) => sum + (item.finalConviction || 0),
          0
        ) / convictionItems.length
      )}/100`
    : "0";
  const highestConviction = [...convictionItems].sort(
    (a, b) => (b.finalConviction || 0) - (a.finalConviction || 0)
  )[0];
  const highestRisk = [...items].sort(
    (a, b) => watchlistRiskScore(b) - watchlistRiskScore(a)
  )[0];
  const recentlyUpdated = [...items].sort(
    (a, b) => Date.parse(b.lastUpdatedAt) - Date.parse(a.lastUpdatedAt)
  )[0];

  return {
    averageConviction,
    highestConviction: highestConviction
      ? `${highestConviction.tokenSymbol} ${formatWatchlistScore(
          highestConviction.finalConviction
        )}`
      : "None",
    highestRisk: highestRisk ? `${highestRisk.tokenSymbol} ${watchlistRiskLevel(highestRisk)}` : "None",
    recentlyUpdated: recentlyUpdated ? recentlyUpdated.tokenSymbol : "None",
  };
}

function filterWatchlistItems(
  items: WatchlistItem[],
  filterMode: WatchlistFilterMode
) {
  if (filterMode === "All") return items;
  if (filterMode === "Unknown") {
    return items.filter((item) => !item.latestSignalVerdict);
  }
  return items.filter((item) =>
    (item.latestSignalVerdict || "").toLowerCase().includes(filterMode.toLowerCase())
  );
}

function sortWatchlistItems(items: WatchlistItem[], sortMode: WatchlistSortMode) {
  return [...items].sort((a, b) => {
    if (sortMode === "conviction") {
      return (b.finalConviction ?? -1) - (a.finalConviction ?? -1);
    }
    if (sortMode === "risk") return watchlistRiskScore(b) - watchlistRiskScore(a);
    if (sortMode === "liquidity") {
      return parseMoneyValue(b.liquidity) - parseMoneyValue(a.liquidity);
    }
    return Date.parse(b.lastUpdatedAt) - Date.parse(a.lastUpdatedAt);
  });
}

function watchlistRiskLevel(item: WatchlistItem) {
  const insiderRisk = item.insiderRisk;
  const bundleRisk = item.bundleRisk;
  const clusterRisk = item.clusterRisk;
  const risks = [insiderRisk, bundleRisk, clusterRisk].filter(
    (risk): risk is number => typeof risk === "number" && Number.isFinite(risk)
  );

  if (risks.length === 0) return "Unknown";
  if ((insiderRisk ?? 0) >= 90 || (bundleRisk ?? 0) >= 90) return "Critical risk";
  if (
    (insiderRisk ?? 0) >= 75 ||
    (clusterRisk ?? 0) >= 70 ||
    (bundleRisk ?? 0) >= 70
  ) {
    return "Elevated risk";
  }
  if (risks.some((risk) => risk >= 45)) return "Moderate risk";
  return "Low risk";
}

function watchlistRiskScore(item: WatchlistItem) {
  return Math.max(item.insiderRisk ?? 0, item.bundleRisk ?? 0, item.clusterRisk ?? 0);
}

function watchlistRiskClass(risk: string) {
  if (risk === "Critical risk") return "border-red-100/16 bg-red-100/[0.05] text-red-100/68";
  if (risk === "Elevated risk") return "border-amber-100/16 bg-amber-100/[0.05] text-amber-100/68";
  if (risk === "Moderate risk") return "border-cyan-100/12 bg-cyan-100/[0.045] text-cyan-100/66";
  if (risk === "Low risk") return "border-emerald-100/14 bg-emerald-100/[0.045] text-emerald-100/66";
  return "border-white/10 bg-white/[0.035] text-white/42";
}

function formatWatchlistScore(value?: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${Math.round(value)}/100`
    : "N/A";
}

function formatWatchlistTime(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "Unknown";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(parsed));
}

function parseMoneyValue(value: string) {
  const normalized = value.replace(/[$,\s]/g, "").toLowerCase();
  const multiplier = normalized.endsWith("b")
    ? 1_000_000_000
    : normalized.endsWith("m")
    ? 1_000_000
    : normalized.endsWith("k")
    ? 1_000
    : 1;
  const parsed = Number(normalized.replace(/[bmk]$/, ""));
  return Number.isFinite(parsed) ? parsed * multiplier : 0;
}

function sameWatchlistToken(item: WatchlistItem, tokenData: TokenResult) {
  return (
    item.chain.toLowerCase() === tokenData.chain.toLowerCase() &&
    Boolean(item.tokenAddress) &&
    item.tokenAddress.toLowerCase() === (tokenData.tokenAddress || "").toLowerCase()
  );
}

function readStoredWatchlistItems() {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(isWatchlistItem) : [];
  } catch {
    return [];
  }
}

function isWatchlistItem(value: unknown): value is WatchlistItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<WatchlistItem>;
  return Boolean(
    item.id &&
      item.tokenSymbol &&
      item.chain &&
      item.tokenAddress &&
      item.addedAt &&
      item.lastUpdatedAt
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
  formatAddress = shortWalletAddress,
  fallback,
  onCopy,
}: {
  address?: string;
  copied: boolean;
  formatAddress?: (address: string) => string;
  fallback: string;
  onCopy: (address?: string) => void;
}) {
  const displayAddress = address ? formatAddress(address) : fallback;

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
        {formatScoreValue(value, "N/A")}
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
    <div className={`relative overflow-hidden p-4 ${terminalSurfaceClass}`}>
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
  holderIntelligenceMatrix,
  loadState,
  error,
  onSelectWallet,
}: {
  walletRows: WalletRow[];
  behaviorProfiles: WalletBehaviorProfile[];
  holderIntelligenceMatrix: HolderIntelligenceProfile[];
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
  const holderProfileByAddress = useMemo(() => {
    return new Map(
      holderIntelligenceMatrix.map((holder) => [
        holder.walletAddress.toLowerCase(),
        holder,
      ])
    );
  }, [holderIntelligenceMatrix]);

  return (
    <section className="rounded-[2rem] border border-white/10 bg-[#06080c]/90 p-5 shadow-[0_30px_120px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-100/40">
            Holder Intelligence
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-semibold tracking-[-0.05em]">
              Top Holder Intelligence
            </h2>
            <span className="rounded-full border border-cyan-100/10 bg-cyan-100/[0.045] px-3 py-1 text-xs text-cyan-100/60">
              Top holders
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/35">
            A clean holder-level read from loaded ownership and Holder
            Intelligence evidence.
          </p>
        </div>

      </div>

      <div className="w-full overflow-x-auto rounded-[1.4rem] border border-white/10">
        <div className={`grid min-h-[42px] w-full min-w-[760px] ${fullHolderGridClass} items-center gap-3 ${terminalTableHeaderClass}`}>
          <span>Wallet</span>
          <span className="text-center">Ownership</span>
          <span className="text-center">Behavior</span>
          <span className="text-center">Risk</span>
          <span className="text-center">Score</span>
        </div>

        <div className="max-h-[680px] w-full min-w-[760px] overflow-y-auto overflow-x-hidden pr-1 [scrollbar-gutter:stable]">
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
            const matchedHolderProfile = row.fullAddress
              ? holderProfileByAddress.get(row.fullAddress.toLowerCase())
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
              className={`group grid min-h-[60px] w-full ${fullHolderGridClass} items-center gap-3 text-left text-[13px] focus:outline-none focus:ring-1 focus:ring-inset focus:ring-cyan-100/20 ${terminalRowClass}`}
            >
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
                  <p className="truncate font-mono font-medium text-white/78">
                    {row.fullAddress ? shortInsiderWalletAddress(row.fullAddress) : row.wallet}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-white/32">
                    #{row.rank} {row.label || "Holder wallet"}
                  </p>
                </div>
              </div>

              <span className="text-center font-medium tabular-nums text-cyan-100/72">
                {row.ownershipPercentage}
              </span>
              <span className="truncate text-center text-white/58">
                {matchedHolderProfile?.holderClass ||
                  (matchedProfile ? behaviorBadgeLabel(matchedProfile) : "Insufficient evidence.")}
              </span>
              <span className="truncate text-center text-white/58">
                {matchedHolderProfile?.riskTier ||
                  (matchedProfile ? holderRiskHint(row, matchedProfile, false) : "Insufficient evidence.")}
              </span>
              <span className="text-center font-medium tabular-nums text-cyan-100/72">
                {typeof matchedHolderProfile?.overallHolderScore === "number"
                  ? matchedHolderProfile.overallHolderScore
                  : "Insufficient evidence."}
              </span>
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
          className={`grid min-h-[60px] w-full min-w-[760px] ${fullHolderGridClass} items-center gap-3 border-b border-white/[0.055] px-4 py-3`}
        >
          <div className="flex items-center gap-3">
            <SkeletonLine className="h-2 w-2 rounded-full" />
            <div className="min-w-0 flex-1">
              <SkeletonLine className="h-3 w-28" />
              <SkeletonLine className="mt-2 h-2 w-20" />
            </div>
          </div>
          <SkeletonLine className="h-3 w-16" />
          <SkeletonLine className="mx-auto h-6 w-24 rounded-full" />
          <SkeletonLine className="mx-auto h-3 w-20" />
          <SkeletonLine className="mx-auto h-3 w-12" />
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
      <span className="inline-flex max-w-full justify-center rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-center text-xs text-white/45">
        Pending V2
      </span>
    );
  }

  return (
    <span
      title={profile.behaviorExplanation}
      className={`inline-flex max-w-full justify-center rounded-full border px-3 py-1 text-center text-xs ${behaviorBadgeClass(profile)}`}
    >
      <span className="truncate">{behaviorBadgeLabel(profile)}</span>
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
      <span className="inline-flex max-w-full justify-center rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-center text-xs text-white/40">
        {isUnavailable ? "Pending" : "Open drawer"}
      </span>
    );
  }

  return (
    <div className="min-w-0 text-center">
      <span
        title={personality.personalitySubtitle}
        className={`inline-flex max-w-full justify-center rounded-full border px-3 py-1 text-xs ${personalityBadgeClass(
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
