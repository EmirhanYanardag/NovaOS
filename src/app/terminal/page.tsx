"use client";

import { motion } from "framer-motion";
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

type AnalysisStage = {
  label: string;
  progress: number;
};

type AnalysisDepthMode = "fast" | "balanced" | "deep";
type SelectedAnalysisDepthMode = AnalysisDepthMode | null;

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
  | "Insider Scan";

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

type NovaAnalysisMode = "fast" | "balanced" | "deep";
type NovaSupportedChain = "eth" | "sol" | "bsc" | "base";

type ActiveNovaScan = {
  runId: string;
  chain: NovaSupportedChain;
  address: string;
  symbol?: string;
  analysisMode: NovaAnalysisMode;
  startedAt: number;
  expectedDurationLabel: string;
};

type NovaConvictionResult = {
  success: boolean;
  version: string;
  requestRunId?: string | null;
  chain: string;
  address: string;
  analysisMode: NovaAnalysisMode;
  runtimeMs?: number;
  novaConvictionScore: number | null;
  convictionTier: string | null;
  scores: {
    holderAlpha: number | null;
    smartMoneyFlow: number | null;
    structuralSafety: number | null;
    riskPressure: number | null;
    liquidityHealth: number | null;
    dataConfidence: number | null;
  };
  risk: {
    riskScore: number | null;
    riskTier: string | null;
    riskDrivers?: string[];
  };
  thesis: {
    summary?: string;
    bullishPoints?: string[];
    bearishPoints?: string[];
    neutralPoints?: string[];
    finalInterpretation?: string;
  };
  scoreBreakdown?: unknown;
  moduleSummaries?: Record<string, unknown>;
  holderAlphaDepth?: unknown;
  debug?: Record<string, unknown>;
  warnings?: string[];
};

class NovaAnalysisRequestError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "NovaAnalysisRequestError";
    this.status = status;
    this.data = data;
  }
}

const COMPLETED_NOVA_ANALYSIS_STORAGE_KEY = "novaos.completedNovaV3Analysis.v1";
const LAST_TOKEN_STORAGE_KEY = "novaos:lastToken";
const LAST_ANALYSIS_MODE_STORAGE_KEY = "novaos:lastAnalysisMode";
const LAST_NOVA_RESPONSE_STORAGE_KEY = "novaos:lastNovaConvictionResponse";
const LAST_ANALYSIS_TIMESTAMP_STORAGE_KEY = "novaos:lastAnalysisTimestamp";
const STORED_NOVA_ANALYSIS_FRESH_MS = 10 * 60_000;

type CompletedNovaAnalysisSnapshot = {
  token: TokenResult;
  analysisMode: AnalysisDepthMode;
  novaConviction: NovaConvictionResult;
  timestamp: string;
};

type StoredNovaAnalysisPayload = {
  tokenAddress: string;
  chain: NovaSupportedChain;
  analysisMode: AnalysisDepthMode;
  runId: string;
  timestamp: number;
  response: NovaConvictionResult;
};

type HolderAlphaDepthSnapshot = {
  analysisMode: unknown;
  holderCount: number;
  analyzedWalletCount: number;
  failedWalletCount: number;
  deepHolderLimit: number;
  lightHolderLimit: number;
  deepAnalyzedWalletCount: number;
  lightAnalyzedWalletCount: number;
  realLightWalletCount: number;
  fallbackLightWalletCount: number;
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

const DEV_CACHE_PANEL = process.env.NODE_ENV !== "production";
const SHOW_INTERNAL_FORMULA_VALIDATION_TOOLS = false;
const SHOW_INTERNAL_DEVELOPER_DIAGNOSTICS = false;
const CONVICTION_HISTORY_STORAGE_KEY = "novaos.convictionHistory.v2";
const CONVICTION_HISTORY_MAX_SNAPSHOTS = 100;
const FORMULA_VALIDATION_STORAGE_KEY = "novaos.formulaValidation.v1";
const FORMULA_VALIDATION_MAX_SNAPSHOTS = 200;
const AI_HUMAN_ARENA_STORAGE_KEY = "novaos.aiHumanArena.v1";
const terminalSections: TerminalSection[] = [
  "Overview",
  "Conviction Engine",
  "AI vs Human",
  "Wallet Flows",
  "Insider Scan",
];

const overviewHolderGridClass =
  "grid-cols-[0.45fr_1.65fr_0.9fr_0.9fr_1.1fr_1.2fr_0.75fr_0.75fr_0.9fr_0.9fr]";
const insiderPreviewGridClass =
  "grid-cols-[minmax(150px,1.35fr)_minmax(90px,0.75fr)_minmax(120px,1fr)_minmax(150px,1.15fr)_minmax(95px,0.7fr)_minmax(85px,0.65fr)_minmax(130px,1fr)]";
const fullHolderGridClass =
  "grid-cols-[minmax(150px,1.35fr)_minmax(90px,0.75fr)_minmax(130px,1fr)_minmax(110px,0.8fr)_minmax(80px,0.55fr)]";
const terminalSurfaceClass =
  "nova-card nova-glass-hover rounded-[1.95rem]";
const terminalHeaderSurfaceClass =
  "nova-card-strong relative overflow-hidden rounded-[2rem] p-5";
const terminalEyebrowClass =
  "nova-tech text-xs text-[color:var(--nova-accent-soft)]";
const terminalTitleClass =
  "nova-display text-3xl text-[color:var(--nova-text)]";
const terminalSubtitleClass = "nova-copy text-sm leading-relaxed text-[color:var(--nova-text-soft)]";
const terminalMethodologyClass =
  "nova-card rounded-[1.95rem] p-5 text-sm leading-relaxed text-[color:var(--nova-text-soft)]";
const terminalGlassCardClass =
  "nova-card-inner";
const overviewScoreCardSurfaceClass =
  "border border-[rgba(178,190,181,0.09)] bg-[linear-gradient(135deg,rgba(10,10,10,0.58),rgba(16,18,19,0.74),rgba(83,104,120,0.06))] shadow-[0_18px_54px_rgba(0,0,0,0.22)]";
const terminalTableHeaderClass =
  "border-b border-[color:var(--nova-border)] bg-[rgba(10,10,10,0.62)] px-4 py-3 text-[10px] uppercase tracking-[0.16em] text-[color:var(--nova-text-muted)] backdrop-blur-2xl";
const terminalRowClass =
  "border-b border-[color:var(--nova-border)] px-4 py-3 text-sm transition duration-300 last:border-b-0 hover:rounded-2xl hover:bg-[rgba(83,104,120,0.42)] hover:shadow-[inset_0_1px_0_rgba(229,228,226,0.055)]";

const novaScanMessages = [
  "Building Conviction Model",
  "Evaluating Holder Quality",
  "Processing Wallet Intelligence",
  "Mapping Smart Capital",
  "Measuring Structural Risk",
];

type TerminalBadgeTone =
  | "cyan"
  | "purple"
  | "warning"
  | "danger"
  | "success"
  | "muted";

function chainLabel(chain: string) {
  const key = chain.toLowerCase();
  if (key === "eth") return "ETH";
  if (key === "ethereum") return "ETH";
  if (key === "base") return "BASE";
  if (key === "mantle") return "MANTLE";
  if (key === "sol") return "SOL";
  if (key === "solana") return "SOL";
  if (key === "bsc") return "BSC";
  if (key === "bnb") return "BSC";
  return chain.toUpperCase();
}

function chainName(chain: string) {
  const key = chain.toLowerCase();
  if (key === "eth") return "Ethereum";
  if (key === "ethereum") return "Ethereum";
  if (key === "base") return "Base";
  if (key === "mantle") return "Mantle";
  if (key === "sol") return "Solana";
  if (key === "solana") return "Solana";
  if (key === "bsc") return "BNB Chain";
  if (key === "bnb") return "BNB Chain";
  return chain;
}

function normalizeChainForNova(chain?: string): NovaSupportedChain {
  const value = String(chain || "").toLowerCase().trim();

  if (["eth", "ethereum", "ether", "erc20"].includes(value)) return "eth";
  if (["sol", "solana"].includes(value)) return "sol";
  if (["bsc", "bnb", "binance", "binance-smart-chain"].includes(value)) {
    return "bsc";
  }
  if (["base", "basechain"].includes(value)) return "base";

  return "eth";
}

function normalizeTokenResultForNova(result: TokenResult): TokenResult {
  return {
    ...result,
    chain: normalizeChainForNova(result.chain),
  };
}

function clearStoredNovaAnalysis() {
  if (typeof window === "undefined") return;

  window.sessionStorage.removeItem(LAST_TOKEN_STORAGE_KEY);
  window.sessionStorage.removeItem(LAST_ANALYSIS_MODE_STORAGE_KEY);
  window.sessionStorage.removeItem(LAST_NOVA_RESPONSE_STORAGE_KEY);
  window.sessionStorage.removeItem(LAST_ANALYSIS_TIMESTAMP_STORAGE_KEY);
  window.sessionStorage.removeItem(COMPLETED_NOVA_ANALYSIS_STORAGE_KEY);
}

function createNovaRunId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readNumericDepthField(value: unknown) {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
      ? Number(value)
      : 0;

  return Number.isFinite(numeric) ? numeric : Number.NaN;
}

function extractHolderAlphaDepth(data: unknown): HolderAlphaDepthSnapshot | null {
  const response = readRecord(data);
  const debug = readRecord(response?.debug);
  const moduleSummaries = readRecord(response?.moduleSummaries);
  const holderAlpha = readRecord(moduleSummaries?.holderAlpha);
  const candidates = [
    response?.holderAlphaDepth,
    debug?.holderAlphaDepth,
    holderAlpha?.holderAlphaDepth,
    holderAlpha,
  ];

  for (const candidate of candidates) {
    const record = readRecord(candidate);
    if (!record) continue;

    const depth = {
      analysisMode: record.analysisMode,
      holderCount: readNumericDepthField(record.holderCount),
      analyzedWalletCount: readNumericDepthField(record.analyzedWalletCount),
      failedWalletCount: readNumericDepthField(record.failedWalletCount),
      deepHolderLimit: readNumericDepthField(record.deepHolderLimit),
      lightHolderLimit: readNumericDepthField(record.lightHolderLimit),
      deepAnalyzedWalletCount: readNumericDepthField(
        record.deepAnalyzedWalletCount
      ),
      lightAnalyzedWalletCount: readNumericDepthField(
        record.lightAnalyzedWalletCount
      ),
      realLightWalletCount: readNumericDepthField(record.realLightWalletCount),
      fallbackLightWalletCount: readNumericDepthField(
        record.fallbackLightWalletCount
      ),
    };

    if (
      Number.isFinite(depth.deepAnalyzedWalletCount) &&
      Number.isFinite(depth.lightAnalyzedWalletCount) &&
      depth.analysisMode
    ) {
      return depth;
    }
  }

  return null;
}

function holderAlphaDepthError(
  data: NovaConvictionResult,
  requestedMode: NovaAnalysisMode
) {
  if (data.success !== true || data.version !== "nova-conviction-v3") {
    return "Analysis response was not a valid Nova Conviction V3 result.";
  }

  const holderAlpha = readRecord(data.moduleSummaries?.holderAlpha);
  if (!holderAlpha) {
    return "Holder intelligence depth did not execute correctly. Please retry after a short cooldown.";
  }

  const extractedDepth = extractHolderAlphaDepth(data);
  const returnedMode = String(extractedDepth?.analysisMode || "")
    .toLowerCase()
    .trim();
  const normalizedRequestedMode = String(requestedMode).toLowerCase().trim();

  if (!extractedDepth) {
    return "Holder intelligence depth did not execute correctly. Please retry after a short cooldown.";
  }

  if (returnedMode !== normalizedRequestedMode) {
    return "Analysis response did not match the requested analysis mode.";
  }

  if (normalizedRequestedMode === "fast") {
    if (
      extractedDepth.deepAnalyzedWalletCount < 1 ||
      extractedDepth.lightAnalyzedWalletCount < 1
    ) {
      return "Holder intelligence depth did not execute correctly. Please retry after a short cooldown.";
    }
  }

  if (normalizedRequestedMode === "balanced") {
    if (
      extractedDepth.deepAnalyzedWalletCount < 1 ||
      extractedDepth.lightAnalyzedWalletCount < 1
    ) {
      return "Holder intelligence depth did not execute correctly. Please retry after a short cooldown.";
    }
  }

  if (normalizedRequestedMode === "deep") {
    if (
      extractedDepth.deepAnalyzedWalletCount < 1 ||
      extractedDepth.lightAnalyzedWalletCount !== 0
    ) {
      return "Holder intelligence depth did not execute correctly. Please retry after a short cooldown.";
    }
  }

  return "";
}

function logHolderDepthValidationFailure({
  data,
  extractedDepth,
  requestedMode,
}: {
  data: unknown;
  extractedDepth: HolderAlphaDepthSnapshot | null;
  requestedMode: NovaAnalysisMode;
}) {
  if (process.env.NODE_ENV === "production") return;

  const response = readRecord(data);
  const moduleSummaries = readRecord(response?.moduleSummaries);
  const holderAlpha = readRecord(moduleSummaries?.holderAlpha);
  const debug = readRecord(response?.debug);

  console.error("[NovaOS] Holder depth validation failed", {
    requestedMode,
    dataSuccess: response?.success,
    version: response?.version,
    extractedDepth,
    holderAlphaKeys: Object.keys(holderAlpha ?? {}),
    topLevelKeys: Object.keys(response ?? {}),
    debugDepth: debug?.holderAlphaDepth,
    topLevelDepth: response?.holderAlphaDepth,
  });
}

function isMantleChain(chain: string) {
  const key = chain.toLowerCase();
  return key === "mantle" || key === "0x1388";
}

function changeClass(value?: number) {
  if (!value) return "text-[color:var(--nova-text-muted)]";
  return value >= 0 ? "text-[color:var(--nova-success)]" : "text-[color:var(--nova-danger)]";
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

function novaModeExpectedDurationLabel(mode: AnalysisDepthMode) {
  if (mode === "fast") return "4-7 minutes";
  if (mode === "deep") return "35-50 minutes";
  return "10-18 minutes";
}

const ANALYSIS_MODE_COPY: Record<
  AnalysisDepthMode,
  { label: string; detail: string }
> = {
  fast: {
    label: "Fast",
    detail: "Top holders are checked with a lighter research pass for quicker results.",
  },
  balanced: {
    label: "Balanced",
    detail: "A wider holder sample is reviewed for stronger conviction context.",
  },
  deep: {
    label: "Deep",
    detail: "More holder behavior is evaluated for a deeper research profile.",
  },
};

function novaModeProgressDurationMs(mode: AnalysisDepthMode) {
  if (mode === "fast") return 5 * 60_000;
  if (mode === "deep") return 40 * 60_000;
  return 15 * 60_000;
}

function isGmgnRateLimitText(value: unknown) {
  const text = JSON.stringify(value ?? "").toLowerCase();
  return (
    text.includes("http 429") ||
    text.includes("rate_limit") ||
    text.includes("rate limit") ||
    text.includes("temporarily banned") ||
    text.includes("rate limit resets")
  );
}

function isGmgnRateLimitError(error: unknown) {
  if (error instanceof NovaAnalysisRequestError) {
    const record = readRecord(error.data);
    return (
      error.status === 429 ||
      record?.errorCode === "GMGN_RATE_LIMIT" ||
      isGmgnRateLimitText(error.message) ||
      isGmgnRateLimitText(error.data)
    );
  }

  return error instanceof Error
    ? isGmgnRateLimitText(error.message)
    : isGmgnRateLimitText(error);
}

function gmgnRateLimitMessage() {
  return "GMGN rate limit reached. Please wait a few minutes before starting another scan.";
}

function gmgnRateLimitTip() {
  return "Tip: Do not run Fast, Balanced, and Deep at the same time. Run one scan at a time.";
}

function parseRateLimitCooldownMs(error: unknown) {
  const source =
    error instanceof NovaAnalysisRequestError
      ? `${error.message} ${JSON.stringify(error.data ?? {})}`
      : error instanceof Error
      ? error.message
      : String(error ?? "");
  const minuteMatch = source.match(/(\d+)\s*(?:minute|min|m)\b/i);
  if (minuteMatch) return Math.min(Number(minuteMatch[1]) * 60_000, 10 * 60_000);
  const secondMatch = source.match(/(\d+)\s*(?:second|sec|s)\b/i);
  if (secondMatch) return Math.min(Number(secondMatch[1]) * 1000, 10 * 60_000);
  return 3 * 60_000;
}

function formatCooldown(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function novaScore(value: number | null | undefined, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value)
    ? clampNumber(value, 0, 100)
    : fallback;
}

function novaConfidenceLabel(score: number | null | undefined) {
  if (typeof score !== "number" || !Number.isFinite(score)) return "Low";
  if (score >= 75) return "High";
  if (score >= 55) return "Medium";
  return "Low";
}

async function fetchNovaConvictionAnalysis({
  chain,
  address,
  analysisMode,
  forceRefresh,
  runId,
  signal,
}: {
  chain: NovaSupportedChain;
  address: string;
  analysisMode: NovaAnalysisMode;
  forceRefresh: boolean;
  runId: string;
  signal?: AbortSignal;
}): Promise<NovaConvictionResult> {
  const normalizedChain = normalizeChainForNova(chain);
  const params = new URLSearchParams({
    chain: normalizedChain,
    address,
    analysisMode,
    forceRefresh: String(forceRefresh),
    runId,
  });

  const response = await fetch(
    `/api/scoring/nova-conviction-v3-test?${params.toString()}`,
    {
      method: "GET",
      cache: "no-store",
      signal,
    }
  );
  const data = (await response.json()) as NovaConvictionResult & {
    error?: unknown;
  };

  if (!response.ok || data.success === false) {
    throw new NovaAnalysisRequestError(
      apiErrorMessage(data.error, `Nova Conviction request failed: ${response.status}`),
      response.status,
      data
    );
  }

  return data;
}

function buildTokenIntelligenceFromNova(
  nova: NovaConvictionResult
): TokenIntelligenceData {
  const holderAlphaSummary = readRecord(nova.moduleSummaries?.holderAlpha);
  const holderCount =
    readFiniteNumber(holderAlphaSummary?.holderCount) ??
    readFiniteNumber(holderAlphaSummary?.analyzedWalletCount) ??
    readFiniteNumber(holderAlphaSummary?.deepAnalyzedWalletCount) ??
    0;
  const warningCount = nova.warnings?.length || 0;
  const bullishPoints = safeStringArray(nova.thesis?.bullishPoints);
  const bearishPoints = safeStringArray(nova.thesis?.bearishPoints);
  const neutralPoints = safeStringArray(nova.thesis?.neutralPoints);
  const riskNotes = [
    ...bearishPoints,
    ...(warningCount
      ? [`Analysis completed with ${warningCount} backend warning(s).`]
      : []),
  ];

  return {
    analyzedWallets: holderCount,
    holderSummary: {
      holderCount,
      top10Ownership: "N/A",
      top25Ownership: "N/A",
      whaleCount: readFiniteNumber(holderAlphaSummary?.whaleLikeHolderCount) ?? 0,
      contractCount: 0,
      exchangeCount: 0,
    },
    behaviorSummary: {
      dominantBehaviorClass: nova.convictionTier || "Nova Conviction V3",
      averageActivityVelocity: novaScore(nova.scores.smartMoneyFlow, 50),
      averageDormancyRisk: novaScore(nova.risk.riskScore, 50),
      highestConcentrationRisk:
        nova.scores.structuralSafety === null
          ? 50
          : 100 - novaScore(nova.scores.structuralSafety, 50),
      reliabilityAverage: novaScore(nova.scores.dataConfidence, 0),
    },
    scores: {
      convictionScore: novaScore(nova.novaConvictionScore, 0),
      insiderRiskScore: novaScore(nova.risk.riskScore, 0),
      holderQualityScore: novaScore(nova.scores.holderAlpha, 0),
      activityScore: novaScore(nova.scores.smartMoneyFlow, 0),
      reliabilityScore: novaScore(nova.scores.dataConfidence, 0),
    },
    thesis: {
      headline:
        nova.thesis.summary ||
        nova.thesis.finalInterpretation ||
        "Nova Conviction V3 analysis completed.",
      bullets: [...bullishPoints, ...neutralPoints].slice(0, 5),
      riskNotes: riskNotes.slice(0, 5),
      confidenceLabel: novaConfidenceLabel(nova.scores.dataConfidence),
    },
    warnings: nova.warnings || [],
  };
}

function buildExplainableConvictionFromNova(
  nova: NovaConvictionResult,
  tokenData: TokenResult
): ExplainableConvictionData {
  const holderAlpha = novaScore(nova.scores.holderAlpha, 50);
  const smartMoneyFlow = novaScore(nova.scores.smartMoneyFlow, 50);
  const structuralSafety = novaScore(nova.scores.structuralSafety, 50);
  const riskPressure = novaScore(nova.scores.riskPressure, 50);
  const liquidityHealth = novaScore(nova.scores.liquidityHealth, 50);
  const dataConfidence = novaScore(nova.scores.dataConfidence, 0);
  const riskScore = novaScore(nova.risk.riskScore, riskPressure);
  const warningCount = nova.warnings?.length || 0;
  const positives = safeStringArray(nova.thesis?.bullishPoints);
  const negatives = safeStringArray(nova.thesis?.bearishPoints);
  const neutral = safeStringArray(nova.thesis?.neutralPoints);

  return {
    finalConvictionScore: novaScore(nova.novaConvictionScore, 0),
    subScores: {
      holderIntegrity: holderAlpha,
      walletQuality: holderAlpha,
      behaviorStability: smartMoneyFlow,
      liquidityTrust: liquidityHealth,
      marketMomentum: smartMoneyFlow,
      riskProtection: 100 - riskPressure,
      insiderRisk: riskScore,
      clusterRisk: 100 - structuralSafety,
      botActivityRisk: riskScore,
      rotationRisk: riskScore,
      freshWalletRisk: riskScore,
    },
    aggregation: {
      weightedWalletQuality: holderAlpha,
      averageBotRisk: riskScore,
      averageRotationRisk: riskScore,
      averageConcentrationRisk: 100 - structuralSafety,
      averageDormancyRisk: riskScore,
      dataCoverage: dataConfidence,
    },
    explanation: {
      headline:
        nova.thesis.summary ||
        nova.thesis.finalInterpretation ||
        "Nova Conviction V3 analysis completed.",
      positives,
      negatives,
      riskNotes: [
        ...neutral,
        ...(warningCount
          ? [`Analysis completed with ${warningCount} backend warning(s).`]
          : []),
      ],
      methodology:
        "Nova Conviction V3 combines Holder Alpha V3.2, Smart Money Flow when available, Structural Safety, inverted Risk Pressure, Liquidity Health, and data confidence.",
    },
    dataConfidence: {
      score: dataConfidence,
      label: novaConfidenceLabel(dataConfidence),
      warnings: nova.warnings || [],
    },
    walletBreakdowns: [],
    mapperCoverage: {
      holderCount:
        readFiniteNumber(readRecord(nova.moduleSummaries?.holderAlpha)?.holderCount) ??
        0,
      walletProfileCount: 0,
      hasMarketData: nova.scores.liquidityHealth !== null,
      hasClusterData: nova.scores.structuralSafety !== null,
      hasTokenTransferData: nova.scores.smartMoneyFlow !== null,
    },
    mapperWarnings: [],
    warnings: nova.warnings || [],
    status: "live",
    chain: nova.chain,
    tokenAddress: nova.address,
    tokenSymbol: tokenData.rawSymbol || tokenData.symbol,
    cache: {
      generatedAt: new Date().toISOString(),
    },
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
  const placeholder = "Search token...";
  const [activeSection, setActiveSection] =
    useState<TerminalSection>(initialSection);
  const [token, setToken] = useState("$NOVA");
  const [query, setQuery] = useState("");
  const [analysisMode, setAnalysisMode] =
    useState<SelectedAnalysisDepthMode>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [results, setResults] = useState<TokenResult[]>([]);
  const [mantleModeEnabled, setMantleModeEnabled] = useState(false);
  const [hasTokenSelection, setHasTokenSelection] = useState(false);
  const [terminalRevealed, setTerminalRevealed] = useState(false);
  const [analysisVisualProgress, setAnalysisVisualProgress] = useState(0);
  const [activeNovaScan, setActiveNovaScan] =
    useState<ActiveNovaScan | null>(null);
  const [scanNotice, setScanNotice] = useState("");
  const [rateLimitCooldownUntil, setRateLimitCooldownUntil] = useState(0);
  const [cooldownNow, setCooldownNow] = useState(() => Date.now());

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

  const [tokenIntelligence, setTokenIntelligence] =
    useState<TokenIntelligenceData | null>(null);
  const [tokenIntelligenceState, setTokenIntelligenceState] =
    useState<HolderLoadState>("idle");
  const [, setTokenIntelligenceError] = useState("");
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
  const [novaConviction, setNovaConviction] =
    useState<NovaConvictionResult | null>(null);
  const [novaConvictionState, setNovaConvictionState] =
    useState<HolderLoadState>("idle");
  const [novaConvictionError, setNovaConvictionError] = useState("");
  const [cacheStatus, setCacheStatus] = useState<CacheStatusData | null>(null);
  const [cacheStatusState, setCacheStatusState] =
    useState<HolderLoadState>("idle");
  const [cacheStatusError, setCacheStatusError] = useState("");
  const [formulaValidationSnapshots, setFormulaValidationSnapshots] = useState<
    FormulaValidationSnapshot[]
  >(() => readStoredFormulaValidationSnapshots());
  const [formulaValidationStatus, setFormulaValidationStatus] = useState("");
  const activeAnalysisKeyRef = useRef("");
  const activeNovaScanRef = useRef<ActiveNovaScan | null>(null);
  const activeNovaScanControllerRef = useRef<AbortController | null>(null);

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
  const analysisStage = useMemo(
    () =>
      deriveAnalysisStage({
        analysisMode: analysisMode ?? "balanced",
        behaviorPreviewState,
        clusterLoadState,
        explainableConvictionState,
        hasTokenSelection,
        holderLoadState,
        tokenData,
        tokenIntelligenceState,
        walletPersonalityPreviewState,
      }),
    [
      analysisMode,
      behaviorPreviewState,
      clusterLoadState,
      explainableConvictionState,
      hasTokenSelection,
      holderLoadState,
      tokenData,
      tokenIntelligenceState,
      walletPersonalityPreviewState,
    ]
  );
  const analysisComplete =
    hasTokenSelection &&
    novaConvictionState === "loaded" &&
    tokenIntelligenceState === "loaded" &&
    explainableConvictionState === "loaded";
  const cooldownRemainingMs = Math.max(0, rateLimitCooldownUntil - cooldownNow);
  const cooldownLabel = cooldownRemainingMs
    ? `Cooling down GMGN requests: ${formatCooldown(cooldownRemainingMs)}`
    : "";
  const activeScanMessage = activeNovaScan
    ? "Analysis already running. Please wait for this scan to finish."
    : "";
  const scanDisabledReason = activeScanMessage || cooldownLabel;

  useEffect(() => {
    if (!analysisComplete || terminalRevealed) return;

    const revealTimer = window.setTimeout(() => {
      setTerminalRevealed(true);
    }, 700);

    return () => clearTimeout(revealTimer);
  }, [analysisComplete, terminalRevealed]);

  useEffect(() => {
    if (!rateLimitCooldownUntil) return;

    const remainingMs = rateLimitCooldownUntil - Date.now();
    let frame = 0;
    let clearTimer = 0;

    if (remainingMs <= 0) {
      frame = window.requestAnimationFrame(() => {
        setRateLimitCooldownUntil(0);
        setCooldownNow(Date.now());
      });
      return () => window.cancelAnimationFrame(frame);
    }

    const interval = window.setInterval(() => {
      setCooldownNow(Date.now());
    }, 1000);
    clearTimer = window.setTimeout(() => {
      setRateLimitCooldownUntil(0);
      setCooldownNow(Date.now());
    }, remainingMs);
    frame = window.requestAnimationFrame(() => setCooldownNow(Date.now()));

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(interval);
      window.clearTimeout(clearTimer);
    };
  }, [rateLimitCooldownUntil]);

  useEffect(() => {
    let frame = 0;
    let interval = 0;

    if (!hasTokenSelection) {
      frame = window.requestAnimationFrame(() => setAnalysisVisualProgress(0));
      return () => window.cancelAnimationFrame(frame);
    }

    if (novaConvictionState === "loading") {
      const startedAt = activeNovaScan?.startedAt ?? Date.now();
      const progressDurationMs = novaModeProgressDurationMs(
        activeNovaScan?.analysisMode ?? analysisMode ?? "balanced"
      );
      const updateProgress = () => {
        const elapsed = Date.now() - startedAt;
        const target = 8 + (elapsed / progressDurationMs) * 86;
        const cappedTarget = Math.max(8, Math.min(94, target));
        setAnalysisVisualProgress((value) => {
          if (value >= 100) return value;
          return Math.max(value, cappedTarget);
        });
      };
      frame = window.requestAnimationFrame(updateProgress);
      interval = window.setInterval(updateProgress, 1000);

      return () => {
        window.cancelAnimationFrame(frame);
        window.clearInterval(interval);
      };
    }

    if (novaConvictionState === "loaded") {
      frame = window.requestAnimationFrame(() => setAnalysisVisualProgress(100));
      return () => window.cancelAnimationFrame(frame);
    }

    if (novaConvictionState === "error") {
      frame = window.requestAnimationFrame(() =>
        setAnalysisVisualProgress((value) => Math.max(8, Math.min(value, 88)))
      );
      return () => window.cancelAnimationFrame(frame);
    }
  }, [activeNovaScan, analysisMode, hasTokenSelection, novaConvictionState]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let hydrateFrame = 0;
    const lastToken = window.sessionStorage.getItem(LAST_TOKEN_STORAGE_KEY);
    const lastMode = window.sessionStorage.getItem(LAST_ANALYSIS_MODE_STORAGE_KEY);
    const lastResponse = window.sessionStorage.getItem(LAST_NOVA_RESPONSE_STORAGE_KEY);
    const lastTimestamp = window.sessionStorage.getItem(
      LAST_ANALYSIS_TIMESTAMP_STORAGE_KEY
    );
    if (!lastToken || !lastResponse || !lastTimestamp) return;

    try {
      const token = JSON.parse(lastToken) as TokenResult;
      const storedPayload = JSON.parse(lastResponse) as
        | StoredNovaAnalysisPayload
        | NovaConvictionResult;
      const payload =
        "response" in storedPayload
          ? storedPayload
          : ({
              tokenAddress: token.tokenAddress || "",
              chain: normalizeChainForNova(token.chain),
              analysisMode: (lastMode || "balanced") as AnalysisDepthMode,
              runId: "",
              timestamp: Number(lastTimestamp),
              response: storedPayload,
            } satisfies StoredNovaAnalysisPayload);
      const snapshot: CompletedNovaAnalysisSnapshot = {
        token,
        analysisMode: payload.analysisMode,
        novaConviction: payload.response,
        timestamp: String(payload.timestamp),
      };
      if (!snapshot?.token?.tokenAddress || !snapshot.novaConviction) return;
      const hydrationValidationError = holderAlphaDepthError(
        snapshot.novaConviction,
        snapshot.analysisMode
      );
      if (hydrationValidationError) {
        logHolderDepthValidationFailure({
          data: snapshot.novaConviction,
          extractedDepth: extractHolderAlphaDepth(snapshot.novaConviction),
          requestedMode: snapshot.analysisMode,
        });
        clearStoredNovaAnalysis();
        return;
      }
      const timestampMs = Number(snapshot.timestamp);
      const normalizedSnapshotChain = normalizeChainForNova(snapshot.token.chain);
      if (
        !Number.isFinite(timestampMs) ||
        Date.now() - timestampMs > STORED_NOVA_ANALYSIS_FRESH_MS ||
        payload.tokenAddress.toLowerCase() !==
          snapshot.token.tokenAddress.toLowerCase() ||
        payload.chain !== normalizedSnapshotChain ||
        payload.analysisMode !== snapshot.analysisMode
      ) {
        return;
      }

      const restoredToken = normalizeTokenResultForNova({
        ...snapshot.token,
        pairAddress: snapshot.token.pairAddress || "",
        tokenAddress: snapshot.token.tokenAddress || "",
        shortTokenAddress: snapshot.token.shortTokenAddress || "",
        imageUrl: snapshot.token.imageUrl || "",
        url: snapshot.token.url || "",
      });
      const restoredTokenAddress = restoredToken.tokenAddress || "";
      if (restoredToken.chain !== payload.chain) return;
      const tokenIntelligenceData = buildTokenIntelligenceFromNova(
        snapshot.novaConviction
      );
      const convictionData = buildExplainableConvictionFromNova(
        snapshot.novaConviction,
        restoredToken
      );
      const unifiedData: UnifiedTokenAnalysisData = {
        generatedAt: new Date(timestampMs).toISOString(),
        tokenIntelligence: tokenIntelligenceData,
        conviction: convictionData,
        modules: {
          holders: { status: "skipped" },
          walletProfiles: { status: "skipped" },
          clusters: { status: "skipped" },
          tokenIntelligence: { status: "loaded" },
          conviction: { status: "loaded" },
          walletPersonalities: { status: "skipped" },
        },
        warnings: snapshot.novaConviction.warnings || [],
      };

      hydrateFrame = window.requestAnimationFrame(() => {
        activeAnalysisKeyRef.current = tokenAnalysisKey(
          restoredToken.chain,
          restoredTokenAddress
        );
        setAnalysisMode(snapshot.analysisMode || "balanced");
        setHasTokenSelection(true);
        setTerminalRevealed(true);
        setActiveSection("Overview");
        setToken(restoredToken.symbol);
        setTokenData(restoredToken);
        setResults([]);
        setQuery("");
        setNovaConviction(snapshot.novaConviction);
        setNovaConvictionState("loaded");
        setNovaConvictionError("");
        setUnifiedAnalysis(unifiedData);
        setUnifiedAnalysisState("loaded");
        setUnifiedAnalysisError("");
        setTokenIntelligence(tokenIntelligenceData);
        setTokenIntelligenceState("loaded");
        setTokenIntelligenceError("");
        setExplainableConviction(convictionData);
        setExplainableConvictionState("loaded");
        setExplainableConvictionError("");
        setWalletRows([]);
        setHolderLoadState("loaded");
        setHolderError("");
        setBehaviorPreview(null);
        setBehaviorPreviewState("loaded");
        setBehaviorPreviewError("");
        setClusterData(null);
        setClusterLoadState("loaded");
        setClusterError("");
        setWalletPersonalityPreviews([]);
        setWalletPersonalityPreviewState("loaded");
        setWalletPersonalityPreviewError("");
        setConvictionSnapshots(
          getMergedConvictionSnapshots(restoredToken.chain, restoredTokenAddress)
        );
      });
    } catch {
      clearStoredNovaAnalysis();
    }

    return () => {
      if (hydrateFrame) window.cancelAnimationFrame(hydrateFrame);
    };
  }, []);

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

  function applyCompletedNovaAnalysis(
    data: NovaConvictionResult,
    result: TokenResult
  ) {
    const tokenIntelligenceData = buildTokenIntelligenceFromNova(data);
    const convictionData = buildExplainableConvictionFromNova(data, result);
    const unifiedData: UnifiedTokenAnalysisData = {
      generatedAt: new Date().toISOString(),
      tokenIntelligence: tokenIntelligenceData,
      conviction: convictionData,
      modules: {
        holders: { status: "skipped" },
        walletProfiles: { status: "skipped" },
        clusters: { status: "skipped" },
        tokenIntelligence: { status: "loaded" },
        conviction: { status: "loaded" },
        walletPersonalities: { status: "skipped" },
      },
      warnings: data.warnings || [],
    };

    setNovaConviction(data);
    setNovaConvictionState("loaded");
    setNovaConvictionError("");
    setUnifiedAnalysis(unifiedData);
    setUnifiedAnalysisState("loaded");
    setUnifiedAnalysisError("");
    setTokenIntelligence(tokenIntelligenceData);
    setTokenIntelligenceState("loaded");
    setTokenIntelligenceError("");
    setExplainableConviction(convictionData);
    setExplainableConvictionState("loaded");
    setExplainableConvictionError("");
    recordConvictionSnapshot(result, convictionData);
    setWalletRows([]);
    setHolderLoadState("loaded");
    setHolderError("");
    setBehaviorPreview(null);
    setBehaviorPreviewState("loaded");
    setBehaviorPreviewError("");
    setClusterData(null);
    setClusterLoadState("loaded");
    setClusterError("");
    setWalletPersonalityPreviews([]);
    setWalletPersonalityPreviewState("loaded");
    setWalletPersonalityPreviewError("");
  }

  function runNewIntelligenceScan() {
    if (activeNovaScanRef.current || activeNovaScanControllerRef.current) {
      setScanNotice("Analysis already running. Please wait for this scan to finish.");
      return;
    }
    activeAnalysisKeyRef.current = "";
    setHasTokenSelection(false);
    setTerminalRevealed(false);
    setActiveSection("Overview");
    setQuery("");
    setResults([]);
    setIsScanning(false);
    setNovaConvictionError("");
    setScanNotice("");
  }

  async function selectToken(result: TokenResult) {
    if (activeNovaScanRef.current || activeNovaScanControllerRef.current) {
      setScanNotice("Analysis already running. Please wait for this scan to finish.");
      return;
    }
    const remainingCooldownMs = Math.max(0, rateLimitCooldownUntil - Date.now());
    if (remainingCooldownMs > 0) {
      setCooldownNow(Date.now());
      setScanNotice(`Cooling down GMGN requests: ${formatCooldown(remainingCooldownMs)}`);
      return;
    }
    if (!analysisMode) {
      setScanNotice("Choose an intelligence depth first.");
      return;
    }
    const normalizedResult = normalizeTokenResultForNova(result);

    activeAnalysisKeyRef.current = normalizedResult.tokenAddress
      ? tokenAnalysisKey(normalizedResult.chain, normalizedResult.tokenAddress)
      : "";
    setHasTokenSelection(true);
    setTerminalRevealed(false);
    setActiveSection("Overview");
    setToken(normalizedResult.symbol);
    setTokenData({
      ...normalizedResult,
      pairAddress: normalizedResult.pairAddress || "",
      tokenAddress: normalizedResult.tokenAddress || "",
      shortTokenAddress: normalizedResult.shortTokenAddress || "",
      imageUrl: normalizedResult.imageUrl || "",
      url: normalizedResult.url || "",
    });
    setResults([]);
    setQuery("");
    setScanNotice("");
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
    setExplainableConvictionState(normalizedResult.tokenAddress ? "loading" : "idle");
    setUnifiedAnalysis(null);
    setUnifiedAnalysisError("");
    setUnifiedAnalysisState(normalizedResult.tokenAddress ? "loading" : "idle");
    setNovaConviction(null);
    setNovaConvictionError("");
    setNovaConvictionState(normalizedResult.tokenAddress ? "loading" : "idle");
    setConvictionSnapshots(
      normalizedResult.tokenAddress
        ? getMergedConvictionSnapshots(
            normalizedResult.chain,
            normalizedResult.tokenAddress
          )
        : []
    );
    setHolderLoadState(normalizedResult.tokenAddress ? "loading" : "idle");
    setBehaviorPreviewState(normalizedResult.tokenAddress ? "loading" : "idle");
    setTokenIntelligenceState(normalizedResult.tokenAddress ? "loading" : "idle");
    setClusterLoadState(normalizedResult.tokenAddress ? "loading" : "idle");
    setWalletPersonalityPreviewState(
      normalizedResult.tokenAddress ? "loading" : "idle"
    );

    if (!normalizedResult.tokenAddress) {
      setHolderLoadState("error");
      setBehaviorPreviewState("error");
      setTokenIntelligenceState("error");
      setClusterLoadState("error");
      setWalletPersonalityPreviewState("error");
      setExplainableConvictionState("error");
      setUnifiedAnalysisState("error");
      setNovaConvictionState("error");
      setHolderError("Selected pair does not include a token contract address.");
      setBehaviorPreviewError("Selected pair does not include a token contract address.");
      setTokenIntelligenceError("Selected pair does not include a token contract address.");
      setClusterError("Selected pair does not include a token contract address.");
      setWalletPersonalityPreviewError("Selected pair does not include a token contract address.");
      setExplainableConvictionError("Selected pair does not include a token contract address.");
      setUnifiedAnalysisError("Selected pair does not include a token contract address.");
      setNovaConvictionError("Selected pair does not include a token contract address.");
      return;
    }

    void loadNovaConvictionAnalysis(normalizedResult);
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

  async function loadNovaConvictionAnalysis(result: TokenResult) {
    if (!result.tokenAddress) return;
    if (!analysisMode) {
      setScanNotice("Choose an intelligence depth first.");
      return;
    }
    if (activeNovaScanRef.current || activeNovaScanControllerRef.current) {
      setScanNotice("Analysis already running. Please wait for this scan to finish.");
      return;
    }
    const remainingCooldownMs = Math.max(0, rateLimitCooldownUntil - Date.now());
    if (remainingCooldownMs > 0) {
      setCooldownNow(Date.now());
      setScanNotice(`Cooling down GMGN requests: ${formatCooldown(remainingCooldownMs)}`);
      return;
    }
    const normalizedChain = normalizeChainForNova(result.chain);
    const normalizedResult = normalizeTokenResultForNova(result);
    const requestKey = tokenAnalysisKey(normalizedChain, result.tokenAddress);
    const selectedMode: NovaAnalysisMode = analysisMode;
    const runId = createNovaRunId();
    const requestStartedAt = Date.now();
    const controller = new AbortController();
    const scan: ActiveNovaScan = {
      runId,
      chain: normalizedChain,
      address: result.tokenAddress,
      symbol: normalizedResult.symbol,
      analysisMode: selectedMode,
      startedAt: requestStartedAt,
      expectedDurationLabel: novaModeExpectedDurationLabel(selectedMode),
    };
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, novaAnalysisTimeoutMs(selectedMode));
    activeAnalysisKeyRef.current = requestKey;
    activeNovaScanRef.current = scan;
    activeNovaScanControllerRef.current = controller;
    setActiveNovaScan(scan);

    clearStoredNovaAnalysis();
    setScanNotice("");
    setTokenData((current) => ({
      ...current,
      chain: normalizedChain,
    }));
    setUnifiedAnalysisState("loading");
    setUnifiedAnalysis(null);
    setUnifiedAnalysisError("");
    setNovaConvictionState("loading");
    setNovaConviction(null);
    setNovaConvictionError("");
    setHolderLoadState("loading");
    setBehaviorPreviewState("loading");
    setTokenIntelligenceState("loading");
    setClusterLoadState("loading");
    setExplainableConvictionState("loading");
    setWalletPersonalityPreviewState("loading");

    try {
      if (process.env.NODE_ENV !== "production") {
        console.debug("[NovaOS] Starting Nova V3 scan", {
          chain: normalizedChain,
          address: result.tokenAddress,
          analysisMode: selectedMode,
          runId,
        });
      }

      const data = await fetchNovaConvictionAnalysis({
        chain: normalizedChain,
        address: result.tokenAddress,
        analysisMode: selectedMode,
        forceRefresh: true,
        runId,
        signal: controller.signal,
      });
      if (!isActiveAnalysis(requestKey)) return;
      const currentScan = activeNovaScanRef.current;
      if (
        !currentScan ||
        currentScan.runId !== runId ||
        (data.requestRunId && data.requestRunId !== runId) ||
        currentScan.chain !== normalizedChain ||
        currentScan.analysisMode !== selectedMode ||
        currentScan.address.toLowerCase() !== result.tokenAddress.toLowerCase()
      ) {
        throw new Error("Analysis response did not match the active scan.");
      }
      const responseError = holderAlphaDepthError(data, selectedMode);
      if (responseError) {
        logHolderDepthValidationFailure({
          data,
          extractedDepth: extractHolderAlphaDepth(data),
          requestedMode: selectedMode,
        });
        throw new Error(responseError);
      }

      if (process.env.NODE_ENV !== "production") {
        const depth = extractHolderAlphaDepth(data);
        console.debug("[NovaOS] Nova V3 validated", {
          mode: selectedMode,
          deepAnalyzedWalletCount: depth?.deepAnalyzedWalletCount,
          lightAnalyzedWalletCount: depth?.lightAnalyzedWalletCount,
          realLightWalletCount: depth?.realLightWalletCount,
          fallbackLightWalletCount: depth?.fallbackLightWalletCount,
          runtimeMs: data.runtimeMs,
        });
        console.debug("[NovaOS] Nova V3 completed", {
          requestedMode: selectedMode,
          runtimeMs: data.runtimeMs,
          runId,
          backendRunId: data.requestRunId,
          holderAlpha: data.scores?.holderAlpha,
          novaConvictionScore: data.novaConvictionScore,
          deepAnalyzedWalletCount: depth?.deepAnalyzedWalletCount,
          lightAnalyzedWalletCount: depth?.lightAnalyzedWalletCount,
          realLightWalletCount: depth?.realLightWalletCount,
          fallbackLightWalletCount: depth?.fallbackLightWalletCount,
        });
        console.debug("[NovaOS Scan Completed]", {
          runId,
          analysisMode: selectedMode,
          runtimeMs: data.runtimeMs,
          holderAlphaDepth: depth,
          novaConvictionScore: data.novaConvictionScore,
          riskScore: data.risk?.riskScore,
          warningCount: data.warnings?.length || 0,
        });
        if (selectedMode === "fast" && Date.now() - requestStartedAt < 20_000) {
          console.warn(
            "[NovaOS] Very fast Nova V3 response; verify backend did not reuse cache.",
            data
          );
        }
      }

      applyCompletedNovaAnalysis(data, normalizedResult);
      if (typeof window !== "undefined") {
        const timestamp = Date.now();
        const payload: StoredNovaAnalysisPayload = {
          tokenAddress: result.tokenAddress,
          chain: normalizedChain,
          analysisMode: selectedMode,
          runId,
          timestamp,
          response: data,
        };
        const snapshot: CompletedNovaAnalysisSnapshot = {
          token: normalizedResult,
          analysisMode: selectedMode,
          novaConviction: data,
          timestamp: String(timestamp),
        };
        window.sessionStorage.setItem(
          LAST_TOKEN_STORAGE_KEY,
          JSON.stringify(normalizedResult)
        );
        window.sessionStorage.setItem(
          LAST_ANALYSIS_MODE_STORAGE_KEY,
          selectedMode
        );
        window.sessionStorage.setItem(
          LAST_NOVA_RESPONSE_STORAGE_KEY,
          JSON.stringify(payload)
        );
        window.sessionStorage.setItem(
          LAST_ANALYSIS_TIMESTAMP_STORAGE_KEY,
          String(timestamp)
        );
        window.sessionStorage.setItem(
          COMPLETED_NOVA_ANALYSIS_STORAGE_KEY,
          JSON.stringify(snapshot)
        );
      }
    } catch (error) {
      if (!isActiveAnalysis(requestKey)) return;
      const isRateLimit = isGmgnRateLimitError(error);
      const message =
        timedOut || (error instanceof Error && error.name === "AbortError")
          ? "Analysis timed out. Try Fast mode or retry in a moment."
          : isRateLimit
          ? gmgnRateLimitMessage()
          : error instanceof Error
          ? error.message
          : "Nova Conviction analysis failed. Please try again.";
      if (isRateLimit) {
        setRateLimitCooldownUntil(Date.now() + parseRateLimitCooldownMs(error));
        setCooldownNow(Date.now());
        setScanNotice(gmgnRateLimitTip());
      }
      if (process.env.NODE_ENV !== "production") {
        console.error("Nova Conviction analysis failed.", error);
      }
      setNovaConviction(null);
      setNovaConvictionState("error");
      setNovaConvictionError(message);
      setUnifiedAnalysis(null);
      setUnifiedAnalysisState("error");
      setUnifiedAnalysisError(message);
      setTokenIntelligence(null);
      setTokenIntelligenceState("error");
      setTokenIntelligenceError(message);
      setExplainableConviction(null);
      setExplainableConvictionState("error");
      setExplainableConvictionError(message);
      setWalletRows([]);
      setHolderLoadState("error");
      setHolderError(message);
      setBehaviorPreview(null);
      setBehaviorPreviewState("error");
      setBehaviorPreviewError(message);
      setClusterData(null);
      setClusterLoadState("error");
      setClusterError(message);
      setWalletPersonalityPreviews([]);
      setWalletPersonalityPreviewState("error");
      setWalletPersonalityPreviewError(message);
    } finally {
      window.clearTimeout(timeoutId);
      activeNovaScanRef.current = null;
      activeNovaScanControllerRef.current = null;
      setActiveNovaScan(null);
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
  void openWalletDrawer;

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
    <main className="nova-terminal-root relative h-screen overflow-hidden bg-[var(--nova-bg)] text-[color:var(--nova-text)]">
      {!hasTokenSelection && (
        <TerminalIdleState
          disabledReason={scanDisabledReason}
          isScanning={isScanning}
          isScanLocked={Boolean(activeNovaScan)}
          notice={scanNotice}
          analysisMode={analysisMode}
          onAnalysisModeChange={(mode) => {
            setAnalysisMode(mode);
            if (scanNotice === "Choose an intelligence depth first.") {
              setScanNotice("");
            }
          }}
          onSearchFocusChange={() => undefined}
          placeholder={placeholder}
          query={query}
          results={results}
          selectToken={selectToken}
          setQuery={setQuery}
        />
      )}

      {hasTokenSelection && !terminalRevealed && (
        <IntelligenceAnalysisMode
          activeScan={activeNovaScan}
          analysisMode={analysisMode}
          cooldownLabel={cooldownLabel}
          error={novaConvictionState === "error" ? novaConvictionError : ""}
          notice={scanNotice}
          onBackToSearch={runNewIntelligenceScan}
          onRetry={() => void loadNovaConvictionAnalysis(tokenData)}
          progress={analysisVisualProgress}
          status={
            novaConvictionState === "loaded"
              ? "Preparing terminal..."
              : analysisStage.label
          }
          tokenData={tokenData}
        />
      )}

      {hasTokenSelection && terminalRevealed && (
      <div className="nova-terminal-shell relative z-[3] flex h-screen bg-[var(--nova-bg)]">
        <div className="hidden lg:block">
          <Sidebar
            activeSection={activeSection}
            onSelectSection={setActiveSection}
          />
        </div>

        <section className="nova-terminal-main relative h-screen flex-1 overflow-y-auto overflow-x-hidden p-4 pb-8 lg:p-5 lg:pb-8">
          <Header
            activeSection={activeSection}
            onNewScan={runNewIntelligenceScan}
          />

          <SectionTabs
            activeSection={activeSection}
            onSelectSection={setActiveSection}
          />

          {activeSection === "Overview" && (
            <>
              <section className="space-y-4">
                <div>
                  <TokenHeader
                    mantleContext={mantleContext}
                    token={token}
                    tokenData={tokenData}
                    marketCards={marketCards}
                    onToggleMantleMode={() =>
                      setMantleModeEnabled((enabled) => !enabled)
                    }
                  />
                </div>

                <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,65fr)_minmax(360px,35fr)]">
                  <div className="min-w-0">
                    <NovaChart
                      token={token}
                      price={tokenData.price}
                      marketCap={tokenData.marketCap}
                      liquidity={tokenData.liquidity}
                      volume24h={tokenData.volume24h}
                      chain={tokenData.chain}
                      pairAddress={tokenData.pairAddress}
                      chartHeight={560}
                    />
                  </div>

                  <div className="min-w-0">
                    <OverviewExecutiveSummary
                      conviction={explainableConviction}
                      formulaV3={convictionFormulaV3}
                      insiderRiskV2={insiderRiskV2}
                      novaConviction={novaConviction}
                      state={explainableConvictionState}
                      tokenFlowSummaryV2={tokenFlowSummaryV2}
                    />
                  </div>
                </div>

                <OverviewTop10HolderIntelligence
                  novaConviction={novaConviction}
                  state={novaConvictionState}
                />
              </section>

              {novaConvictionState === "loaded" &&
                (novaConviction?.warnings?.length || 0) > 0 && (
                  <p className="mt-3 text-xs text-[color:var(--nova-warning)]">
                    Analysis completed with {novaConviction?.warnings?.length} backend warning(s).
                  </p>
                )}

              {novaConvictionState === "error" && novaConvictionError && (
                <p className="mt-3 text-xs text-[color:var(--nova-danger)]">
                  {novaConvictionError}
                </p>
              )}

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
            </>
          )}

          {activeSection === "Conviction Engine" && (
            <section className="space-y-4">
              <ExplainableConvictionEnginePanel
                data={explainableConviction}
                error={explainableConvictionError}
                formulaV3={convictionFormulaV3}
                insiderRiskV2={insiderRiskV2}
                loadState={explainableConvictionState}
                novaConviction={novaConviction}
                token={token}
                tokenData={tokenData}
                tokenFlowSummaryV2={tokenFlowSummaryV2}
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
              personalities={walletPersonalityPreviews}
              tokenData={tokenData}
              tokenIntelligence={tokenIntelligence}
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
              holderIntelligenceMatrix={holderIntelligenceMatrix}
              holderIntelligenceSummary={holderIntelligenceSummary}
              holderError={holderError}
              holderLoadState={holderLoadState}
              novaConviction={novaConviction}
              personalityError={walletPersonalityPreviewError}
              tokenData={tokenData}
              tokenIntelligence={tokenIntelligence}
              unifiedAnalysis={unifiedAnalysis}
              walletRows={walletRows}
            />
          )}

          {activeSection === "Insider Scan" && (
            <InsiderScanDashboard
              conviction={explainableConviction}
              convictionError={explainableConvictionError}
              convictionLoadState={explainableConvictionState}
              holderError={holderError}
              holderLoadState={holderLoadState}
              novaConviction={novaConviction}
              token={token}
              tokenData={tokenData}
              walletRows={walletRows}
            />
          )}

        </section>
      </div>
      )}

      {hasTokenSelection && (
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
      )}
    </main>
  );
}

export default function TerminalPage() {
  return <TerminalExperience />;
}

function deriveAnalysisStage({
  analysisMode,
  behaviorPreviewState,
  clusterLoadState,
  explainableConvictionState,
  hasTokenSelection,
  holderLoadState,
  tokenData,
  tokenIntelligenceState,
  walletPersonalityPreviewState,
}: {
  analysisMode: AnalysisDepthMode;
  behaviorPreviewState: HolderLoadState;
  clusterLoadState: HolderLoadState;
  explainableConvictionState: HolderLoadState;
  hasTokenSelection: boolean;
  holderLoadState: HolderLoadState;
  tokenData: TokenResult;
  tokenIntelligenceState: HolderLoadState;
  walletPersonalityPreviewState: HolderLoadState;
}): AnalysisStage {
  if (!hasTokenSelection) {
    return { label: "Initializing intelligence engine...", progress: 0 };
  }

  const modeText = novaModeLoadingText(analysisMode);
  const metadataLoaded = Boolean(tokenData.tokenAddress || tokenData.pairAddress);
  const holderReady = analysisStateDone(holderLoadState);
  const relationshipReady =
    analysisStateDone(behaviorPreviewState) && analysisStateDone(clusterLoadState);
  const convictionReady = analysisStateDone(explainableConvictionState);
  const walletIntelligenceReady =
    relationshipReady && analysisStateDone(walletPersonalityPreviewState);
  const thesisReady = analysisStateDone(tokenIntelligenceState);

  if (metadataLoaded && holderReady && walletIntelligenceReady && convictionReady && thesisReady) {
    return { label: "Preparing terminal...", progress: 100 };
  }

  if (metadataLoaded && holderReady && walletIntelligenceReady && convictionReady) {
    return { label: "Generating thesis...", progress: 85 };
  }

  if (metadataLoaded && holderReady && relationshipReady && convictionReady) {
    return { label: "Building wallet intelligence...", progress: 65 };
  }

  if (metadataLoaded && holderReady && relationshipReady) {
    return { label: "Analyzing conviction patterns...", progress: 65 };
  }

  if (metadataLoaded && holderReady) {
    return { label: "Mapping wallet relationships...", progress: 45 };
  }

  if (metadataLoaded) {
    return { label: modeText, progress: 20 };
  }

  return { label: "Initializing intelligence engine...", progress: 0 };
}

function novaModeLoadingText(mode: AnalysisDepthMode) {
  if (mode === "fast") {
    return "Calibrating intelligence engine...";
  }
  if (mode === "deep") {
    return "Calculating conviction field...";
  }

  return "Synchronizing intelligence layers...";
}

function novaAnalysisTimeoutMs(mode: NovaAnalysisMode) {
  if (mode === "fast") return 8 * 60_000;
  if (mode === "balanced") return 20 * 60_000;
  return 50 * 60_000;
}

function analysisStateDone(state: HolderLoadState) {
  return state === "loaded";
}

function TerminalIdleState({
  analysisMode,
  disabledReason,
  isScanning,
  isScanLocked,
  notice,
  onAnalysisModeChange,
  onSearchFocusChange,
  placeholder,
  query,
  results,
  selectToken,
  setQuery,
}: {
  analysisMode: SelectedAnalysisDepthMode;
  disabledReason?: string;
  isScanning: boolean;
  isScanLocked: boolean;
  notice?: string;
  onAnalysisModeChange: (mode: AnalysisDepthMode) => void;
  onSearchFocusChange: (focused: boolean) => void;
  placeholder: string;
  query: string;
  results: TokenResult[];
  selectToken: (result: TokenResult) => void;
  setQuery: (value: string) => void;
}) {
  const titleWords = ["See", "Beyond", "The", "Chart"];

  return (
    <motion.section
      initial={{ opacity: 0, y: 18, scale: 0.965, filter: "blur(18px)" }}
      animate={{
        opacity: 1,
        y: 0,
        scale: query ? 1.002 : 1,
        filter: query ? "blur(0px) saturate(1.08)" : "blur(0px)",
      }}
      exit={{ opacity: 0, y: -10, scale: 0.985, filter: "blur(18px)" }}
      transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
      className="relative z-[4] flex h-screen items-center justify-center overflow-hidden px-5"
    >
      <div className="relative z-10 flex w-full max-w-[1120px] flex-col items-center text-center">
        <motion.h1
          aria-label="See Beyond The Chart"
          className="nova-display nova-terminal-idle-title mx-auto flex max-w-[1120px] flex-nowrap justify-center gap-x-3 whitespace-nowrap text-4xl leading-[1.01] text-[color:var(--nova-text)] [text-shadow:0_0_34px_rgba(157,190,205,0.12),0_12px_42px_rgba(0,0,0,0.56)] sm:gap-x-4 sm:text-6xl lg:text-[4.6rem] xl:text-[5rem]"
        >
          {titleWords.map((word, index) => (
            <motion.span
              key={word}
              initial={{ opacity: 0, y: 18, scale: 0.965, filter: "blur(18px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              transition={{
                duration: 2,
                delay: index * 0.32,
                ease: [0.16, 1, 0.3, 1],
              }}
              className={`inline-block ${word === "Chart" ? "gradient-word" : ""}`}
            >
              {word}
            </motion.span>
          ))}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 1.15, delay: 1.18, ease: [0.16, 1, 0.3, 1] }}
          className="entry-subtitle-glow relative mt-7 text-[10px] font-light uppercase tracking-[0.42em] sm:text-xs"
        >
          AI-NATIVE CONVICTION INTELLIGENCE
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 1.1, delay: 1.68, ease: [0.16, 1, 0.3, 1] }}
          className="mt-12 w-full"
        >
          <TerminalSearchBox
            analysisMode={analysisMode}
            disabledReason={disabledReason}
            isScanning={isScanning}
            isScanLocked={isScanLocked}
            notice={notice}
            onAnalysisModeChange={onAnalysisModeChange}
            onFocusChange={onSearchFocusChange}
            placeholder={placeholder}
            query={query}
            results={results}
            selectToken={selectToken}
            setQuery={setQuery}
            variant="idle"
          />
        </motion.div>
      </div>
    </motion.section>
  );
}

function IntelligenceAnalysisMode({
  activeScan,
  analysisMode,
  cooldownLabel,
  error,
  notice,
  onBackToSearch,
  onRetry,
}: {
  activeScan: ActiveNovaScan | null;
  analysisMode: SelectedAnalysisDepthMode;
  cooldownLabel: string;
  error: string;
  notice: string;
  onBackToSearch: () => void;
  onRetry: () => void;
  progress: number;
  status: string;
  tokenData: TokenResult;
}) {
  const displayMode = activeScan?.analysisMode ?? analysisMode ?? "balanced";
  const estimatedDurationLabel = novaModeExpectedDurationLabel(displayMode)
    .replace("-", "–")
    .replace(" minutes", " MIN");

  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.988, filter: "blur(18px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, scale: 0.992, filter: "blur(18px)" }}
      transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
      className="absolute inset-0 z-[4] flex h-screen items-center justify-center overflow-hidden bg-[#000000] px-5"
    >
      <style jsx>{`
        .nova-loading-visual {
          display: flex;
          align-items: center;
          justify-content: center;
          width: clamp(26.25rem, 42vw, 32.5rem);
          max-width: 100%;
          background: transparent;
          overflow: visible;
        }

        .nova-loading-gif {
          display: block;
          width: 100%;
          height: auto;
          object-fit: contain;
          opacity: 0.9;
          mix-blend-mode: screen;
          filter: contrast(1.1) brightness(0.76);
          mask-image: radial-gradient(ellipse at center, #000 0%, #000 42%, rgba(0,0,0,0.54) 58%, transparent 80%);
          -webkit-mask-image: radial-gradient(ellipse at center, #000 0%, #000 42%, rgba(0,0,0,0.54) 58%, transparent 80%);
        }

        .nova-scan-message {
          position: absolute;
          inset: 0;
          opacity: 0;
          animation: novaScanMessage 25s ease-in-out infinite;
          white-space: nowrap;
        }

        .nova-scan-word {
          display: inline-block;
          opacity: 0;
          transform: translateY(8px);
          filter: blur(7px);
          animation-duration: 25s;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }

        .nova-scan-word-1 {
          animation-name: novaScanWordOne;
        }

        .nova-scan-word-2 {
          animation-name: novaScanWordTwo;
        }

        .nova-scan-word-3 {
          animation-name: novaScanWordThree;
        }

        @keyframes novaScanMessage {
          0%, 13% { opacity: 1; }
          14%, 100% { opacity: 0; }
        }

        @keyframes novaScanWordOne {
          0% {
            opacity: 0;
            transform: translateY(8px);
            filter: blur(7px);
          }
          1%, 13% {
            opacity: 1;
            transform: translateY(0);
            filter: blur(0px);
          }
          14%, 100% {
            opacity: 0;
            transform: translateY(-7px);
            filter: blur(7px);
          }
        }

        @keyframes novaScanWordTwo {
          0%, 1% {
            opacity: 0;
            transform: translateY(8px);
            filter: blur(7px);
          }
          2%, 13% {
            opacity: 1;
            transform: translateY(0);
            filter: blur(0px);
          }
          14%, 100% {
            opacity: 0;
            transform: translateY(-7px);
            filter: blur(7px);
          }
        }

        @keyframes novaScanWordThree {
          0%, 2% {
            opacity: 0;
            transform: translateY(8px);
            filter: blur(7px);
          }
          3%, 13% {
            opacity: 1;
            transform: translateY(0);
            filter: blur(0px);
          }
          14%, 100% {
            opacity: 0;
            transform: translateY(-7px);
            filter: blur(7px);
          }
        }

        @media (max-width: 640px) {
          .nova-loading-visual {
            width: min(88vw, 25rem);
          }
        }
      `}</style>

      <div className="relative z-10 flex min-h-[560px] w-full max-w-3xl flex-col items-center justify-center text-center">
        <p className="text-[10px] font-light uppercase tracking-[0.56em] text-[color:rgba(178,190,181,0.40)] sm:text-xs">
          Analyzing
        </p>

        <div
          aria-label={`Nova intelligence scan in progress (${displayMode})`}
          className="mt-10 flex items-center justify-center"
        >
          <div className="nova-loading-visual">
            {/* eslint-disable-next-line @next/next/no-img-element -- The loading reference is an animated GIF that must render directly as an img asset. */}
            <img
              src="/nova-loading-network.gif"
              alt=""
              aria-hidden="true"
              className="nova-loading-gif"
            />
          </div>
        </div>

        <div className="relative mt-10 h-7 w-full max-w-xl overflow-hidden">
          {novaScanMessages.map((message, index) => (
            <p
              key={message}
              className="nova-scan-message text-[10px] font-light uppercase tracking-[0.38em] text-[color:rgba(229,228,226,0.54)] sm:text-xs"
              style={{ animationDelay: `${index * 5}s` }}
            >
              {message.split(" ").map((word, wordIndex) => (
                <span
                  key={`${message}-${word}-${wordIndex}`}
                  className={`nova-scan-word nova-scan-word-${wordIndex + 1}`}
                  style={{ animationDelay: `${index * 5}s` }}
                >
                  {word}
                  {wordIndex < message.split(" ").length - 1 ? "\u00a0" : ""}
                </span>
              ))}
            </p>
          ))}
        </div>

        <p className="mt-4 text-[9px] font-light uppercase tracking-[0.34em] text-[color:rgba(178,190,181,0.32)] sm:text-[10px]">
          Estimated duration · {estimatedDurationLabel}
        </p>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="mt-8 flex max-w-md flex-col items-center"
          >
            <p className="text-sm text-[color:var(--nova-danger)]">
              Analysis could not be completed.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-[color:rgba(178,190,181,0.35)]">{error}</p>
            {(notice || cooldownLabel) && (
              <p className="mt-2 text-xs text-[color:rgba(178,190,181,0.35)]">{cooldownLabel || notice}</p>
            )}
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onRetry}
                disabled={Boolean(cooldownLabel)}
                className="rounded-md border border-[color:rgba(178,190,181,0.15)] nova-card-inner px-5 py-3 text-[10px] font-medium uppercase tracking-[0.24em] text-[color:rgba(229,228,226,0.65)] transition hover:border-[color:rgba(178,190,181,0.25)] hover:bg-[rgba(83,104,120,0.18)] disabled:cursor-not-allowed disabled:opacity-45"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={onBackToSearch}
                className="rounded-md border border-[color:rgba(178,190,181,0.10)] bg-transparent px-5 py-3 text-[10px] font-medium uppercase tracking-[0.24em] text-[color:rgba(229,228,226,0.45)] transition hover:border-[color:rgba(178,190,181,0.20)] hover:text-[color:rgba(229,228,226,0.65)]"
              >
                Back
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </motion.section>
  );
}

/* Page-level cinematic background removed: terminal background is intentionally flat #0A0A0A. */

function Sidebar({
  activeSection,
  onSelectSection,
}: {
  activeSection: TerminalSection;
  onSelectSection: (section: TerminalSection) => void;
}) {
  return (
    <aside className="nova-card hidden h-screen w-72 shrink-0 border-r border-[color:var(--nova-border)] p-5 lg:block">
      <div className="mb-7 flex items-center gap-3">
        <Image
          src="/novaicon.png"
          alt="NovaOS"
          width={36}
          height={36}
          unoptimized
          className="h-9 w-9 object-contain"
        />
        <span className="font-semibold tracking-[-0.03em]">NovaOS</span>
      </div>

      <nav className="space-y-2 text-sm text-[color:var(--nova-text-soft)]">
        {terminalSections.map((item) => {
          const isActive = item === activeSection;

          return (
          <button
            key={item}
            type="button"
            onClick={() => onSelectSection(item)}
            className={`group flex w-full items-center rounded-[1.15rem] px-4 py-3 text-left transition duration-300 ${
              isActive
                ? "border border-[color:var(--nova-border-strong)] bg-[rgba(178,190,181,0.08)] text-[color:var(--nova-accent-soft)] shadow-[inset_0_1px_0_rgba(229,228,226,0.08),0_0_30px_rgba(178,190,181,0.06)]"
                : "hover:scale-[1.01] hover:bg-[rgba(83,104,120,0.36)] hover:text-[color:var(--nova-text)]"
            }`}
          >
            <span
              className={`mr-3 h-1.5 w-1.5 rounded-full ${
                isActive ? "bg-[var(--nova-accent)]" : "bg-[rgba(83,104,120,0.18)]"
              }`}
            />
            {item}
          </button>
        )})}
      </nav>

      <div className="nova-card-inner mt-7 rounded-[1.6rem] p-4">
        <p className="text-xs uppercase tracking-[0.25em] text-[color:var(--nova-accent-soft)]">
          System Status
        </p>
        <p className="mt-3 text-sm text-[color:var(--nova-text-soft)]">Conviction Engine active</p>
        <p className="mt-1 text-xs text-[color:var(--nova-text-muted)]">
          Monitoring Ethereum, Base, Mantle and Solana.
        </p>
      </div>
    </aside>
  );
}

function Header({
  activeSection,
  onNewScan,
}: {
  activeSection: TerminalSection;
  onNewScan: () => void;
}) {
  return (
    <header className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div>
        <p className="nova-tech text-xs text-[color:var(--nova-accent-soft)]">
          Intelligence Terminal
        </p>
        <h1 className="nova-display mt-1 text-3xl">
          <DisplayTitleText title={activeSection} />
        </h1>
      </div>

      <button
        type="button"
        onClick={onNewScan}
        className="nova-card-inner group relative inline-flex w-full items-center justify-center overflow-hidden rounded-full px-5 py-3 text-xs font-medium uppercase tracking-[0.24em] text-[color:var(--nova-accent-soft)] transition duration-300 hover:scale-[1.01] hover:border-[color:var(--nova-border-strong)] hover:text-[color:var(--nova-text)] xl:w-auto"
      >
        <span className="absolute inset-y-1 left-0 w-12 -translate-x-full bg-gradient-to-r from-transparent via-[rgba(229,228,226,0.16)] to-transparent blur-sm transition duration-700 group-hover:translate-x-[18rem]" />
        <span className="relative">New Intelligence Scan</span>
      </button>
    </header>
  );
}

function TerminalSearchBox({
  analysisMode,
  disabledReason,
  isScanning,
  isScanLocked,
  notice,
  onAnalysisModeChange,
  onFocusChange,
  placeholder,
  query,
  results,
  selectToken,
  setQuery,
  variant = "compact",
}: {
  analysisMode: SelectedAnalysisDepthMode;
  disabledReason?: string;
  isScanning: boolean;
  isScanLocked: boolean;
  notice?: string;
  onAnalysisModeChange: (mode: AnalysisDepthMode) => void;
  onFocusChange: (focused: boolean) => void;
  placeholder: string;
  query: string;
  results: TokenResult[];
  selectToken: (result: TokenResult) => void;
  setQuery: (value: string) => void;
  variant?: "compact" | "idle";
}) {
  const idle = variant === "idle";
  const [isFocused, setIsFocused] = useState(false);
  const [depthHintPulse, setDepthHintPulse] = useState(false);
  const [depthHintPulseKey, setDepthHintPulseKey] = useState(0);
  const depthHintTimeoutRef = useRef<number | null>(null);
  const showPlaceholder = !query && !isFocused && placeholder;
  const selectedModeCopy = analysisMode ? ANALYSIS_MODE_COPY[analysisMode] : null;
  const inputDisabled = idle && !analysisMode;
  const modePrompt =
    inputDisabled
      ? "Select an intelligence depth to begin."
      : notice || "";
  const modes = (["fast", "balanced", "deep"] as const).map((value) => ({
    value,
    ...ANALYSIS_MODE_COPY[value],
  }));

  useEffect(() => {
    return () => {
      if (depthHintTimeoutRef.current) {
        window.clearTimeout(depthHintTimeoutRef.current);
        depthHintTimeoutRef.current = null;
      }
    };
  }, [analysisMode]);

  function emphasizeDepthHint() {
    if (!inputDisabled) return;
    setDepthHintPulse(true);
    setDepthHintPulseKey((value) => value + 1);
    if (depthHintTimeoutRef.current) {
      window.clearTimeout(depthHintTimeoutRef.current);
    }
    depthHintTimeoutRef.current = window.setTimeout(() => {
      setDepthHintPulse(false);
      depthHintTimeoutRef.current = null;
    }, 1000);
  }

  function selectAnalysisMode(mode: AnalysisDepthMode) {
    setDepthHintPulse(false);
    if (depthHintTimeoutRef.current) {
      window.clearTimeout(depthHintTimeoutRef.current);
      depthHintTimeoutRef.current = null;
    }
    onAnalysisModeChange(mode);
  }

  return (
    <div className="group relative w-full">
      <div
        className="relative"
        onMouseDown={(event) => {
          if (!inputDisabled) return;
          event.preventDefault();
          emphasizeDepthHint();
        }}
      >
      <input
        value={query}
        disabled={inputDisabled}
        onBlur={() => {
          setIsFocused(false);
          onFocusChange(false);
        }}
        onFocus={() => {
          if (inputDisabled) return;
          setIsFocused(true);
          onFocusChange(true);
        }}
        onChange={(event) => {
          if (!inputDisabled) setQuery(event.target.value);
        }}
        className={`relative z-10 w-full rounded-[2rem] border text-[color:var(--nova-text)] outline-none backdrop-blur-[30px] transition duration-[420ms] placeholder:text-transparent disabled:cursor-text disabled:opacity-100 ${
          inputDisabled
            ? "border-[color:var(--nova-border)] nova-card-inner px-8 py-5 text-base shadow-[inset_0_0_34px_rgba(0,0,0,0.34)]"
            : idle
            ? "border-[color:var(--nova-border)] nova-card-inner px-8 py-5 text-base shadow-[inset_0_0_34px_rgba(0,0,0,0.34)] hover:border-[color:var(--nova-border-strong)] hover:bg-[rgba(10,10,10,0.68)] focus:border-[color:var(--nova-border-strong)] focus:bg-[rgba(10,10,10,0.72)] focus:shadow-[inset_0_0_32px_rgba(0,0,0,0.28),0_0_28px_rgba(178,190,181,0.06)]"
            : "border-[color:var(--nova-border)] nova-card-inner px-6 py-3.5 text-sm hover:border-[color:var(--nova-border-strong)] focus:border-[color:var(--nova-border-strong)] focus:bg-[rgba(10,10,10,0.72)]"
        }`}
      />

      {showPlaceholder && (
        <div
          className={`pointer-events-none absolute left-8 top-1/2 z-20 flex -translate-y-1/2 font-light transition duration-500 group-focus-within:text-[color:var(--nova-text-soft)] ${
            inputDisabled
              ? "text-base text-[color:var(--nova-text-muted)]"
              : idle
              ? "text-base text-[color:var(--nova-text-muted)]"
              : "text-sm text-[color:var(--nova-text-muted)]"
          }`}
        >
          {placeholder}
        </div>
      )}
      </div>

      {query && (
        <div className="nova-card-strong relative z-[60] mt-4 max-h-[520px] w-full overflow-y-auto rounded-[1.7rem] p-2">
          {isScanning && (
            <div className="px-4 py-5 text-sm text-[color:var(--nova-text-muted)]">
              Searching token pairs...
            </div>
          )}

          {!isScanning && results.length === 0 && (
            <div className="px-4 py-5 text-sm text-[color:var(--nova-text-muted)]">
              No token pairs found.
            </div>
          )}

          {results.map((result) => (
            <button
              key={`${result.chain}-${result.dex}-${result.pairAddress}`}
              disabled={isScanLocked || Boolean(disabledReason)}
              onClick={() => selectToken(result)}
              className="flex w-full items-center justify-between gap-4 rounded-2xl px-4 py-3 text-left transition duration-300 hover:bg-[rgba(83,104,120,0.34)] hover:text-[color:var(--nova-text)] focus:outline-none focus:ring-1 focus:ring-[rgba(178,190,181,0.16)] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <div className="flex min-w-0 items-center gap-3">
                {result.imageUrl ? (
                  <Image
                    src={result.imageUrl}
                    alt={result.symbol}
                    width={36}
                    height={36}
                    unoptimized
                    className="h-9 w-9 rounded-full border border-[color:var(--nova-border)] object-cover"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full nova-card-inner text-xs text-[color:var(--nova-accent-soft)]">
                    {result.rawSymbol?.slice(0, 2) || "?"}
                  </div>
                )}

                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[color:var(--nova-text)]">
                    {result.symbol}{" "}
                    <span className="text-[color:var(--nova-text-muted)]">{result.name}</span>
                  </p>
                  <p className="mt-1 truncate text-xs text-[color:var(--nova-text-muted)]">
                    {chainLabel(result.chain)} / {result.dex} /{" "}
                    {result.shortTokenAddress || "contract"}
                  </p>
                </div>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-sm text-[color:var(--nova-accent)]">{result.price}</p>
                <p className="mt-1 text-xs text-[color:var(--nova-text-muted)]">
                  MC {result.marketCap} / Vol {result.volume24h}
                </p>
                {result.searchQuality && result.searchQuality !== "strong" && (
                  <span className="mt-2 inline-flex rounded-full nova-card-inner px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[color:var(--nova-warning)]">
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

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {modes.map((mode) => {
          const isActive = analysisMode === mode.value;

          return (
            <button
              key={mode.value}
              type="button"
              onClick={() => {
                if (!isScanLocked) selectAnalysisMode(mode.value);
              }}
              disabled={isScanLocked}
              className={`group/mode relative h-12 min-w-[132px] overflow-hidden rounded-full border px-8 text-center backdrop-blur-[34px] transition duration-300 sm:h-[3.25rem] sm:min-w-[148px] sm:px-10 ${
                isActive
                  ? "border-[color:var(--nova-border-strong)] bg-[rgba(178,190,181,0.10)] text-[color:var(--nova-text)] shadow-[0_0_26px_rgba(178,190,181,0.07),inset_0_-18px_34px_rgba(0,0,0,0.3)]"
                  : "border-[color:var(--nova-border)] nova-card-inner text-[color:var(--nova-text-soft)] hover:scale-[1.015] hover:border-[color:var(--nova-border-strong)] hover:bg-[rgba(83,104,120,0.34)] hover:text-[color:var(--nova-text)] hover:shadow-[0_0_22px_rgba(178,190,181,0.045)]"
              } disabled:opacity-50`}
              title={mode.detail}
            >
              <span className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-[rgba(178,190,181,0.04)] blur-2xl opacity-0 transition duration-300 group-hover/mode:opacity-100" />
              <span className="relative flex h-full items-center justify-center text-[11px] font-semibold uppercase tracking-[0.26em]">
                {mode.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 min-h-6 text-center">
        {disabledReason ? (
          <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--nova-text-muted)]">
            {disabledReason}
          </p>
        ) : selectedModeCopy ? (
          <motion.p
            key={analysisMode}
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: {
                transition: {
                  staggerChildren: 0.045,
                },
              },
            }}
            className="text-[11px] font-light uppercase leading-relaxed tracking-[0.2em] text-[color:var(--nova-text-soft)]"
          >
            {selectedModeCopy.detail.split(" ").map((word, index) => (
              <motion.span
                key={`${analysisMode}-${word}-${index}`}
                variants={{
                  hidden: { opacity: 0, y: 7, filter: "blur(6px)" },
                  visible: { opacity: 1, y: 0, filter: "blur(0px)" },
                }}
                transition={{ duration: 0.46, ease: [0.16, 1, 0.3, 1] }}
                className="inline-block"
              >
                {word}
                {index < selectedModeCopy.detail.split(" ").length - 1 ? "\u00A0" : ""}
              </motion.span>
            ))}
          </motion.p>
        ) : (
          <motion.p
            key={`${modePrompt}-${depthHintPulseKey}`}
            initial={
              depthHintPulse
                ? { opacity: 0.38, filter: "blur(2px)", textShadow: "0 0 0 rgba(181, 231, 238, 0)" }
                : false
            }
            animate={
              depthHintPulse
                ? {
                    opacity: [0.5, 0.9, 0.5],
                    filter: ["blur(1px)", "blur(0px)", "blur(0px)"],
                    textShadow: [
                      "0 0 0 rgba(181, 231, 238, 0)",
                      "0 0 20px rgba(181, 231, 238, 0.22)",
                      "0 0 0 rgba(181, 231, 238, 0)",
                    ],
                  }
                : { opacity: 1, filter: "blur(0px)" }
            }
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className={`text-[10px] font-light uppercase tracking-[0.28em] ${
              depthHintPulse ? "text-[color:var(--nova-text)]" : "text-[color:var(--nova-text-muted)]"
            }`}
          >
            {modePrompt}
          </motion.p>
        )}
      </div>

      {false && query && (
        <div
          className={`absolute right-0 z-50 max-h-[520px] w-full overflow-y-auto rounded-[1.5rem] nova-card-inner p-2 shadow-[0_30px_100px_rgba(0,0,0,0.65)] backdrop-blur-2xl ${
            idle ? "top-[4.8rem]" : "top-14"
          }`}
        >
          {isScanning && (
            <div className="px-4 py-5 text-sm text-[color:var(--nova-text-muted)]">
              Searching token pairs...
            </div>
          )}

          {!isScanning && results.length === 0 && (
            <div className="px-4 py-5 text-sm text-[color:var(--nova-text-muted)]">
              No token pairs found.
            </div>
          )}

          {results.map((result) => (
            <button
              key={`${result.chain}-${result.dex}-${result.pairAddress}`}
              disabled={isScanLocked || Boolean(disabledReason)}
              onClick={() => selectToken(result)}
              className="flex w-full items-center justify-between gap-4 rounded-2xl px-4 py-3 text-left transition duration-300 hover:nova-card-inner hover:text-[color:var(--nova-text)] focus:outline-none focus:ring-1 focus:ring-[rgba(178,190,181,0.14)] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <div className="flex min-w-0 items-center gap-3">
                {result.imageUrl ? (
                  <Image
                    src={result.imageUrl}
                    alt={result.symbol}
                    width={36}
                    height={36}
                    unoptimized
                    className="h-9 w-9 rounded-full border border-[color:var(--nova-border)] object-cover"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full nova-card-inner text-xs text-[color:var(--nova-accent-soft)]">
                    {result.rawSymbol?.slice(0, 2) || "?"}
                  </div>
                )}

                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[color:var(--nova-text)]">
                    {result.symbol}{" "}
                    <span className="text-[color:var(--nova-text-muted)]">{result.name}</span>
                  </p>
                  <p className="mt-1 truncate text-xs text-[color:var(--nova-text-muted)]">
                    {chainLabel(result.chain)} / {result.dex} /{" "}
                    {result.shortTokenAddress || "contract"}
                  </p>
                </div>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-sm text-[color:var(--nova-accent)]">{result.price}</p>
                <p className="mt-1 text-xs text-[color:var(--nova-text-muted)]">
                  MC {result.marketCap} / Vol {result.volume24h}
                </p>
                {result.searchQuality && result.searchQuality !== "strong" && (
                  <span className="mt-2 inline-flex rounded-full nova-card-inner px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[color:var(--nova-warning)]">
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
    <details className="nova-mobile-section-menu mb-4 lg:hidden">
      <summary className="nova-card-inner flex min-h-11 cursor-pointer list-none items-center justify-between rounded-full px-4 py-2 text-xs uppercase tracking-[0.18em] text-[color:var(--nova-accent-soft)] [&::-webkit-details-marker]:hidden">
        <span className="truncate">{activeSection}</span>
        <span className="text-[color:var(--nova-text-muted)]">Menu</span>
      </summary>
      <div className="mt-2 grid gap-2 rounded-[1.4rem] nova-card p-2">
        {terminalSections.map((section) => {
          const isActive = section === activeSection;

          return (
            <button
              key={section}
              type="button"
              onClick={(event) => {
                onSelectSection(section);
                event.currentTarget.closest("details")?.removeAttribute("open");
              }}
              className={`min-h-11 rounded-full border px-4 py-2 text-left text-xs backdrop-blur-2xl transition duration-300 ${
                isActive
                  ? "border-[color:rgba(178,190,181,0.14)] bg-[rgba(83,104,120,0.12)] text-[color:var(--nova-accent-soft)] shadow-[0_0_24px_rgba(83,104,120,0.07)]"
                  : "border-[color:rgba(178,190,181,0.08)] nova-card-inner text-[color:var(--nova-text-muted)]"
              }`}
            >
              {section}
            </button>
          );
        })}
      </div>
    </details>
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
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_76%_0%,rgba(83,104,120,0.12),transparent_44%),linear-gradient(135deg,rgba(178,190,181,0.045),transparent_28%)]" />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              {eyebrow && <p className={terminalEyebrowClass}>{eyebrow}</p>}
              <h1 className={terminalTitleClass}>
                <DisplayTitleText title={title} />
              </h1>
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

function DisplayTitleText({ title }: { title: string }) {
  const words = title.trim().split(/\s+/);
  const finalWord = words.pop();

  if (!finalWord) return null;

  return (
    <>
      {words.length > 0 && <>{words.join(" ")} </>}
      <span className="gradient-word">{finalWord}</span>
    </>
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
  if (tone === "purple") return "border-[color:var(--nova-border)] bg-[rgba(94,114,107,0.09)] text-[color:var(--nova-accent-soft)]";
  if (tone === "warning") return "border-[color:var(--nova-border)] nova-card-inner text-[color:var(--nova-warning)]";
  if (tone === "danger") return "border-[color:var(--nova-border)] nova-card-inner text-[color:var(--nova-danger)]";
  if (tone === "success") return "border-[color:var(--nova-border)] nova-card-inner text-[color:var(--nova-success)]";
  if (tone === "muted") return "border-[color:var(--nova-border)] nova-card-inner text-[color:var(--nova-text-soft)]";
  return "border-[color:var(--nova-border)] nova-card-inner text-[color:var(--nova-accent)]";
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
          className="mx-auto mb-4 h-1.5 w-24 rounded-full bg-[rgba(83,104,120,0.28)]"
        />
      )}
      <p className={`text-sm font-medium ${tone === "error" ? "text-[color:var(--nova-text-soft)]" : "text-[color:var(--nova-text-soft)]"}`}>
        {title}
      </p>
      <p className="mx-auto mt-2 max-w-2xl text-xs leading-relaxed text-[color:var(--nova-text-muted)]">
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
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[color:var(--nova-border)] bg-[rgba(83,104,120,0.1)] shadow-[0_0_28px_rgba(83,104,120,0.13)] ${sizeClass}`}
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
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(127,144,150,0.22),transparent_45%),linear-gradient(135deg,rgba(83,104,120,0.12),rgba(94,114,107,0.1))]" />
          <span className="relative text-lg font-semibold text-[color:var(--nova-text)]">
            {tokenInitial(token)}
          </span>
        </>
      )}
    </div>
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

  return (
    <div className="relative overflow-hidden rounded-[2rem] nova-card-inner p-4 backdrop-blur-2xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(94,114,107,0.14),transparent_55%)]" />

      <div className="relative flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <TokenAvatar logoUrl={logoUrl} token={token} />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--nova-text-muted)]">
              Analyzing
            </p>
            <h2 className="mt-1 truncate text-3xl font-semibold tracking-[-0.05em]">
              {token}
            </h2>
            <p className="mt-1 truncate text-sm text-[color:var(--nova-text-muted)]">
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
                className="flex h-9 items-center justify-center text-[color:var(--nova-text-soft)] opacity-75 drop-shadow-none transition duration-200 hover:-translate-y-px hover:text-[color:var(--nova-text)] hover:opacity-100 hover:drop-shadow-[0_0_10px_rgba(83,104,120,0.28)]"
              >
                <Icon size={17} strokeWidth={1.75} />
              </a>
            ))}
            <div className="rounded-full nova-card-inner px-4 py-2 text-sm text-[color:var(--nova-accent)]">
              {chainLabel(tokenData.chain)}
            </div>
            <button
              type="button"
              onClick={onToggleMantleMode}
              className={`rounded-full border px-4 py-2 text-xs transition ${
                mantleContext.mantleModeActive
                  ? "border-[color:var(--nova-border)] nova-card-inner text-[color:var(--nova-accent)]"
                  : "border-[color:var(--nova-border)] nova-card-inner text-[color:var(--nova-text-soft)] hover:nova-card-inner"
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
            className="rounded-2xl nova-card-inner p-3"
          >
            <p className="text-xs text-[color:var(--nova-text-muted)]">{card.label}</p>
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
  if (delta === null || delta === 0) return "text-[color:var(--nova-text-soft)]";
  const favorable = invert ? delta < 0 : delta > 0;
  return favorable ? "text-[color:var(--nova-accent)]" : "text-[color:var(--nova-warning)]";
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
        <section className="rounded-[2rem] nova-card-inner p-5 shadow-[0_0_70px_rgba(83,104,120,0.035)]">
          <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--nova-accent)]">
            Conviction Timeline
          </p>
          <p className="mt-2 text-xs text-[color:var(--nova-text-muted)]">
            {selection.rangeLabel} · Comparing real stored snapshots only.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <HistoryStat label="Current Conviction" value={current.finalConvictionScore} />
            <HistoryStat
              label="Change"
              value={comparison ? signedHistoryDelta(comparison.scoreDelta) : "Baseline"}
              tone={comparison ? historyDeltaClass(comparison.scoreDelta) : "text-[color:var(--nova-text-soft)]"}
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

        <section className="rounded-[2rem] nova-card-inner p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--nova-accent)]">
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
                className="flex items-center justify-between rounded-2xl border border-[color:rgba(83,104,120,0.14)] nova-card-inner px-4 py-3"
              >
                <div>
                  <p className="text-sm text-[color:var(--nova-text-soft)]">
                    {formatSnapshotTime(snapshot.createdAt)}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--nova-text-muted)]">
                    {snapshot.dataConfidence?.label || "Confidence unavailable"} confidence
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-semibold tabular-nums text-[color:var(--nova-text)]">
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
          <p className="px-2 text-xs leading-relaxed text-[color:var(--nova-text-muted)]">
            {convictionReplayComparisonSubtitle(timeframe)}
          </p>
          <section className="rounded-[2rem] nova-card-inner p-5">
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
            <section className="rounded-[2rem] nova-card-inner p-5">
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

            <section className="rounded-[2rem] nova-card-inner p-5">
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

          <section className="rounded-[2rem] nova-card-inner p-5">
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

          <section className="rounded-[2rem] nova-card-inner p-5 shadow-[0_0_80px_rgba(83,104,120,0.04)]">
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
          <p className="px-2 text-xs leading-relaxed text-[color:var(--nova-text-muted)]">
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
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-[color:rgba(83,104,120,0.14)] nova-card-inner px-4 py-3">
      <p className="text-xs text-[color:var(--nova-text-muted)]">{text}</p>
      {showClear && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="rounded-full border border-[color:rgba(83,104,120,0.14)] nova-card-inner px-3 py-1.5 text-xs text-[color:var(--nova-text-muted)] transition hover:border-[color:var(--nova-border)] hover:text-[color:var(--nova-warning)]"
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
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] nova-card-inner px-4 py-3">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--nova-accent-soft)]">
          Replay Window
        </p>
        <p className="mt-1 text-xs text-[color:var(--nova-text-muted)]">
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
                ? "border-[color:var(--nova-border-strong)] bg-[rgba(83,104,120,0.1)] text-[color:var(--nova-text)]"
                : "border-[color:rgba(83,104,120,0.14)] nova-card-inner text-[color:var(--nova-text-muted)] hover:border-[color:var(--nova-border)] hover:text-[color:var(--nova-text-soft)]"
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
      <div className="rounded-[2rem] nova-card-inner p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--nova-accent)]">
          Baseline Snapshot Stored Locally
        </p>
        <p className="mt-3 text-lg font-semibold text-[color:var(--nova-text)]">
          Current conviction is {current.finalConvictionScore}.
        </p>
        <p className="mt-3 text-sm font-medium text-[color:var(--nova-text)]">
          {snapshotCount} / 2 snapshots required for replay
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[color:var(--nova-text-soft)]">
          Baseline snapshot stored locally. Run another successful analysis later to unlock measured change analysis.
        </p>
      </div>

      <div className="rounded-[2rem] nova-card-inner p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--nova-text-muted)]">
          Replay Locked for This Timeframe
        </p>
        <p className="mt-3 text-sm font-medium text-[color:var(--nova-text-soft)]">
          {convictionReplayWindowText(timeframe)}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[color:var(--nova-text-soft)]">{reason}</p>
        <p className="mt-3 text-xs leading-relaxed text-[color:var(--nova-text-muted)]">
          NovaOS does not borrow snapshots from outside the selected range and never
          generates interpolated history.
        </p>
      </div>
    </div>
  );
}

function HistoryStat({
  label,
  tone = "text-[color:var(--nova-text)]",
  value,
}: {
  label: string;
  tone?: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-[color:rgba(83,104,120,0.14)] nova-card-inner p-3">
      <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--nova-text-muted)]">{label}</p>
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
      <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--nova-accent)]">{eyebrow}</p>
      <h3 className="mt-2 text-lg font-semibold tracking-[-0.035em] text-[color:var(--nova-text)]">
        {title}
      </h3>
      <p className="mt-2 text-xs leading-relaxed text-[color:var(--nova-text-muted)]">{description}</p>
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
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-2xl border border-[color:rgba(83,104,120,0.14)] nova-card-inner px-4 py-3">
      <p className="text-sm text-[color:var(--nova-text-soft)]">{label}</p>
      <p className="text-sm tabular-nums text-[color:var(--nova-text-soft)]">
        {previousValue ?? "—"} <span className="px-1 text-[color:var(--nova-text-muted)]">›</span>{" "}
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
    <div className="rounded-2xl border border-[color:rgba(83,104,120,0.14)] nova-card-inner p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--nova-text-muted)]">{title}</p>
      <div className="mt-3 space-y-2">
        {items.length ? (
          items.slice(0, 4).map((item) => (
            <div key={`${item.kind}-${item.label}`} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-[color:var(--nova-text-soft)]">{item.label}</span>
                <span className={historyDeltaClass(item.delta, item.kind === "risk")}>
                  {item.previousValue ?? "—"}{" "}
                  <span className="text-[color:var(--nova-text-muted)]">›</span>{" "}
                  {item.currentValue ?? "—"}{" "}
                  <span className="ml-1 tabular-nums">
                    ({signedHistoryDelta(item.delta)})
                  </span>
                </span>
              </div>
              <p className="text-xs leading-relaxed text-[color:var(--nova-text-muted)]">{item.reason}</p>
            </div>
          ))
        ) : (
          <p className="text-xs text-[color:var(--nova-text-muted)]">None measured in this replay interval.</p>
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
    <div className={`rounded-2xl border border-[color:rgba(83,104,120,0.14)] nova-card-inner p-4 ${className}`}>
      <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--nova-text-muted)]">{title}</p>
      <div className="mt-3 space-y-2">
        {items.length ? (
          items.slice(0, 4).map((item) => (
            <p key={item} className="text-sm leading-relaxed text-[color:var(--nova-text-soft)]">
              {item}
            </p>
          ))
        ) : (
          <p className="text-xs text-[color:var(--nova-text-muted)]">None measured in this replay interval.</p>
        )}
      </div>
    </div>
  );
}

function ForensicCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[color:rgba(83,104,120,0.14)] nova-card-inner p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--nova-text-muted)]">{label}</p>
      <p className="mt-3 text-sm font-medium text-[color:var(--nova-text-soft)]">{value}</p>
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
    <div className="relative overflow-hidden rounded-[2rem] border border-[color:var(--nova-border)] bg-[rgba(83,104,120,0.04)] p-4 shadow-[0_0_80px_rgba(83,104,120,0.045)] backdrop-blur-2xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(127,144,150,0.09),transparent_42%)]" />

      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--nova-accent-soft)]">
              Explainable Intelligence
            </p>
            <p className="mt-1 text-xs text-[color:var(--nova-text-muted)]">Token thesis report</p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs ${thesisConfidenceClass(confidence)}`}>
            {confidence} confidence
          </span>
        </div>

        {loadState === "idle" && (
          <div className="mt-4 rounded-2xl nova-card-inner p-4">
            <p className="text-sm font-medium text-[color:var(--nova-text-soft)]">
              Select a token to generate an explainable intelligence report.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-[color:var(--nova-text-muted)]">
              NovaOS will summarize holder distribution, wallet metadata and
              recent activity signals without claiming PnL, win rate or smart
              money identity.
            </p>
          </div>
        )}

        {loadState === "loading" && <ThesisReportSkeleton />}

        {loadState === "error" && (
          <div className="mt-4 rounded-2xl nova-card-inner p-4">
            <p className="text-sm font-medium text-[color:var(--nova-text-soft)]">
              Token intelligence report unavailable.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-[color:var(--nova-text-soft)]">
              {error || "Token intelligence summary could not be loaded."}
            </p>
          </div>
        )}

        {loadState === "loaded" && (data || report.thesisHeadline) && (
          <>
            <div className="mt-4 rounded-2xl border border-[color:var(--nova-border)] nova-card-inner p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[rgba(83,104,120,0.70)] shadow-[0_0_12px_rgba(83,104,120,0.36)]" />
                <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--nova-text-muted)]">
                  Thesis headline
                </p>
              </div>
              <p className="min-h-[44px] text-sm leading-relaxed text-[color:var(--nova-text-soft)]">
                {typedThesis}
                <motion.span
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="ml-1 text-[color:var(--nova-accent)]"
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
          <div className="mb-2 flex items-center justify-between text-xs text-[color:var(--nova-text-muted)]">
            <span>Methodology</span>
            <span>Explainable V2</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full nova-card-inner">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#536878] via-[rgba(83,104,120,0.58)] to-[#0A0A0A]"
              style={{
                width: `${Math.max(
                  8,
                  report.metrics.reliability ?? data?.scores.reliabilityScore ?? 18
                )}%`,
              }}
            />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[color:var(--nova-text-muted)]">
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
    <section className="mt-4 overflow-hidden rounded-[2rem] nova-card-inner p-4 shadow-[0_0_80px_rgba(83,104,120,0.045)] backdrop-blur-2xl">
      <div className="pointer-events-none absolute inset-0" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--nova-accent-soft)]">
              Mantle Mode
            </p>
            <span className="rounded-full nova-card-inner px-3 py-1 text-xs text-[color:var(--nova-accent-soft)]">
              {mantleContext.isMantleAsset
                ? "Active Mantle asset"
                : "Manual preview"}
            </span>
          </div>
          <h3 className="mt-3 text-xl font-semibold tracking-[-0.05em] text-[color:var(--nova-text)]">
            Mantle-native analysis layer
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-[color:var(--nova-text-soft)]">
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
    <div className="rounded-2xl nova-card-inner p-3">
      <p className="text-xs text-[color:var(--nova-text-muted)]">{title}</p>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-2 text-xs text-[color:var(--nova-text-soft)]">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgba(83,104,120,0.55)] shadow-[0_0_10px_rgba(83,104,120,0.28)]" />
            <span>
              {item}
              {isPlanned && (
                <span className="ml-2 text-[color:var(--nova-accent-soft)]">planned</span>
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
    <section className="mt-4 overflow-hidden rounded-[2rem] nova-card-inner p-4 backdrop-blur-2xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--nova-accent-soft)]">
              Verified on Mantle
            </p>
            <span className="rounded-full nova-card-inner px-3 py-1 text-xs text-[color:var(--nova-warning)]">
              Local preview
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[color:var(--nova-text-soft)]">
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
            className="rounded-full nova-card-inner px-4 py-2 text-xs text-[color:var(--nova-accent-soft)] transition hover:nova-card-inner disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loadState === "loading" ? "Creating preview..." : "Create snapshot"}
          </button>
          <span className="text-xs text-[color:var(--nova-text-muted)]">
            {hasTokenIntelligence
              ? "On-chain verification planned"
              : "Token intelligence required"}
          </span>
        </div>
      </div>

      {(decisionSnapshot || loadState === "error") && (
        <div className="mt-4 rounded-2xl nova-card-inner p-3">
          {loadState === "error" && (
            <p className="text-xs leading-relaxed text-[color:var(--nova-danger)]">
              {error || "Decision snapshot could not be created."}
            </p>
          )}

          {decisionSnapshot && (
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="font-mono text-sm text-[color:var(--nova-accent)]">
                  {shortHash(decisionSnapshot.snapshotHash)}
                </p>
                <p className="mt-1 text-xs text-[color:var(--nova-text-muted)]">
                  Snapshot status: local preview · Verification: not submitted
                  on-chain yet
                </p>
              </div>
              <div className="rounded-full nova-card-inner px-3 py-1 text-xs text-[color:var(--nova-text-soft)]">
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
    <div className="rounded-2xl nova-card-inner p-3">
      <p className="text-xs text-[color:var(--nova-text-muted)]">{title}</p>
      <ul className="mt-2 space-y-2 text-xs leading-relaxed text-[color:var(--nova-text-soft)]">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span
              className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                tone === "cyan"
                  ? "bg-[var(--nova-slate)] shadow-[0_0_10px_rgba(127,144,150,0.34)]"
                  : "bg-[rgba(83,104,120,0.42)] shadow-[0_0_10px_rgba(83,104,120,0.22)]"
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
      <div className="rounded-2xl border border-[color:var(--nova-border)] nova-card-inner p-4">
        <SkeletonLine className="h-3 w-36" />
        <SkeletonLine className="mt-4 h-2 w-full" />
        <SkeletonLine className="mt-2 h-2 w-5/6" />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl nova-card-inner p-3"
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
    <div className="rounded-2xl nova-card-inner p-3">
      <p className="text-xs text-[color:var(--nova-text-muted)]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[color:var(--nova-text)]">{value}</p>
    </div>
  );
}

function thesisConfidenceClass(confidence: string) {
  if (confidence === "High") {
    return "border-[color:var(--nova-border)] nova-card-inner text-[color:var(--nova-success)]";
  }

  if (confidence === "Medium") {
    return "border-[color:var(--nova-border)] nova-card-inner text-[color:var(--nova-accent-soft)]";
  }

  if (confidence === "Low") {
    return "border-[color:var(--nova-border)] nova-card-inner text-[color:var(--nova-warning)]";
  }

  return "border-[color:var(--nova-border)] nova-card-inner text-[color:var(--nova-text-soft)]";
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
    ? "relative overflow-hidden rounded-[2rem] nova-card-inner p-4 shadow-[0_0_80px_rgba(83,104,120,0.045)] backdrop-blur-2xl"
    : "relative overflow-hidden rounded-[2rem] nova-card-inner p-4 backdrop-blur-2xl";

  return (
    <div className={cardClass}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_44%,rgba(16,18,19,0.68),transparent_62%)]" />
      <div className={`relative flex h-full ${cardMinHeight} flex-col items-center justify-center text-center`}>
        <div className={`relative flex ${ringSize} items-center justify-center`}>
          <div className="absolute -inset-10 rounded-full bg-[rgba(178,190,181,0.12)] blur-[70px]" />
          <div className="absolute inset-0 rounded-full border border-[color:var(--nova-border)] bg-[radial-gradient(circle_at_34%_28%,rgba(127,144,150,0.15),rgba(16,18,19,0.68)_42%,rgba(10,10,10,0.94)_76%)] shadow-[0_0_90px_rgba(83,104,120,0.14)]" />

          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: compact ? 28 : 22, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 rounded-full"
          >
            <div className="absolute inset-4 rounded-full border border-[color:var(--nova-border)]" />
            <div className="absolute inset-10 rounded-full border border-[color:rgba(83,104,120,0.14)]" />
            <div className="absolute left-1/2 top-1/2 h-[1px] w-[135%] -translate-x-1/2 -translate-y-1/2 rotate-12 bg-gradient-to-r from-transparent via-[rgba(83,104,120,0.2)] to-transparent" />
            <div className="absolute left-1/2 top-1/2 h-[1px] w-[128%] -translate-x-1/2 -translate-y-1/2 -rotate-12 bg-gradient-to-r from-transparent via-[rgba(94,114,107,0.16)] to-transparent" />
          </motion.div>

          <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 176 176">
            <circle
              cx="88"
              cy="88"
              r="72"
              stroke="rgba(83,104,120,0.12)"
              strokeWidth="6"
              fill="transparent"
            />
            {isLoaded ? (
              <motion.circle
                cx="88"
                cy="88"
                r="72"
                stroke="rgba(127,144,150,0.92)"
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
                stroke="rgba(127,144,150,0.22)"
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
          <p className="mt-1 text-xs uppercase tracking-[0.3em] text-[color:var(--nova-accent-soft)]">
              Nova Conviction
            </p>
          </div>
        </div>

        <p className="mt-2 max-w-[14rem] text-xs font-light leading-relaxed text-[color:var(--nova-text-muted)]">
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

function OverviewExecutiveSummary({
  conviction,
  formulaV3,
  insiderRiskV2,
  novaConviction,
  state,
  tokenFlowSummaryV2,
}: {
  conviction: ExplainableConvictionData | null;
  formulaV3: ConvictionFormulaV3Result | null;
  insiderRiskV2: InsiderRiskV2Result;
  novaConviction: NovaConvictionResult | null;
  state: HolderLoadState;
  tokenFlowSummaryV2: TokenFlowSummaryV2 | null;
}) {
  const walletFlowScore = tokenFlowSummaryV2
    ? overviewWalletFlowScore(tokenFlowSummaryV2)
    : null;
  const isPending = state === "loading";
  const primaryItems: Array<{
    inverseTone?: boolean;
    label: string;
    score: number | null | undefined;
  }> = [
    {
      label: "Nova Conviction",
      score:
        novaConviction?.novaConvictionScore ??
        formulaV3?.finalConvictionScoreV3 ??
        conviction?.finalConvictionScore ??
        null,
    },
    {
      label: "Risk Score",
      score: novaConviction?.risk.riskScore ?? insiderRiskV2.insiderRiskScore ?? null,
      inverseTone: true,
    },
  ];
  const secondaryItems: Array<{
    inverseTone?: boolean;
    label: string;
    score: number | null | undefined;
  }> = [
    {
      label: "Holder Quality",
      score:
        novaConviction?.scores.holderAlpha ??
        formulaV3?.pillarScores.holderQualityScore ??
        null,
    },
    {
      label: "Smart Money",
      score: novaConviction?.scores.smartMoneyFlow ?? walletFlowScore,
    },
    {
      label: "Liquidity Health",
      score:
        novaConviction?.scores.liquidityHealth ??
        conviction?.subScores.liquidityTrust ??
        null,
    },
    {
      label: "Data Confidence",
      score: novaConviction?.scores.dataConfidence ?? conviction?.dataConfidence.score ?? null,
    },
  ];
  const scoreItems = [...primaryItems, ...secondaryItems];

  return (
    <div className="nova-overview-summary flex min-h-[640px] flex-col">
      <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
        {scoreItems.map((item) => (
          <OverviewExecutiveScoreCard
            key={item.label}
            inverseTone={item.inverseTone}
            label={item.label}
            pending={isPending}
            score={typeof item.score === "number" ? item.score : null}
          />
        ))}
      </div>
    </div>
  );
}

function OverviewTop10HolderIntelligence({
  novaConviction,
  state,
}: {
  novaConviction: NovaConvictionResult | null;
  state: HolderLoadState;
}) {
  const rows = buildOverviewTop10HolderRows(novaConviction);
  const isLoading = state === "loading";

  return (
    <section className="nova-terminal-card overflow-hidden rounded-[2rem]">
      <div className="flex flex-col gap-2 border-b border-[color:var(--nova-border)] p-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-[color:var(--nova-accent-soft)]">
            Holder Intelligence
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-[-0.045em] text-[color:var(--nova-text)]">
            Top 10 Holder Intelligence
          </h2>
        </div>
        <span className="w-fit rounded-full nova-card-inner px-3 py-1 text-xs text-[color:var(--nova-text-soft)]">
          {rows.length ? `${rows.length} shown` : "Pending"}
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className={`grid min-w-[820px] grid-cols-[minmax(160px,1.25fr)_72px_120px_90px_150px_100px] gap-3 ${terminalTableHeaderClass}`}>
          <span>Wallet</span>
          <span className="text-center">Rank</span>
          <span className="text-center">Ownership</span>
          <span className="text-center">Score</span>
          <span className="text-center">Behavior</span>
          <span className="text-center">Analysis</span>
        </div>

        {isLoading ? (
          <div className="p-4">
            <SkeletonLine className="h-3 w-48" />
            <SkeletonLine className="mt-3 h-3 w-72" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4 text-sm text-[color:var(--nova-text-muted)]">
            Holder intelligence will appear after analysis completes.
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={`${row.rank ?? "unranked"}-${row.wallet}-overview-v3`}
              className={`grid min-h-[48px] min-w-[820px] grid-cols-[minmax(160px,1.25fr)_72px_120px_90px_150px_100px] items-center gap-3 text-[13px] ${terminalRowClass}`}
            >
              <span
                className="truncate font-mono text-[color:var(--nova-text-soft)]"
                title={row.wallet}
              >
                {shortInsiderWalletAddress(row.wallet)}
              </span>
              <span className="text-center font-mono text-[color:var(--nova-text-muted)]">
                {row.rank === null ? "N/A" : `#${row.rank}`}
              </span>
              <span className="text-center font-medium tabular-nums text-[color:var(--nova-accent-soft)]">
                {formatInsiderPercent(row.ownershipPercent)}
              </span>
              <span className="text-center font-mono tabular-nums text-[color:var(--nova-text)]">
                {formatInsiderScore(row.score)}
              </span>
              <span className="truncate text-center text-[color:var(--nova-text-soft)]">
                {row.behaviorLabel}
              </span>
              <span className="text-center text-[color:var(--nova-text-muted)]">
                {row.analysisType}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function buildOverviewTop10HolderRows(novaConviction: NovaConvictionResult | null) {
  const holderAlpha = readRecord(novaConviction?.moduleSummaries?.holderAlpha);
  const allWalletsByAlphaV3 = readRecordArray(holderAlpha?.allWalletsByAlphaV3);
  const sourceRows = allWalletsByAlphaV3.length
    ? allWalletsByAlphaV3
    : readRecordArray(holderAlpha?.topWalletsByAlphaV3);

  return sourceRows
    .map((wallet) => {
      const address = insiderWalletAddress(wallet);
      const score =
        numberField(wallet, "walletAlphaV3") ??
        numberField(wallet, "walletAlphaScore");
      if (!address || score === null) return null;
      return {
        analysisType: insiderAnalysisType(wallet) === "Deep" ? "Deep" : "Light",
        behaviorLabel: holderAlphaBehaviorLabel(score),
        rank: numberField(wallet, "holderRank") ?? numberField(wallet, "rank"),
        score,
        wallet: address,
        ownershipPercent:
          numberField(wallet, "ownershipPercent") ??
          numberField(wallet, "ownershipPercentage"),
      };
    })
    .filter((row): row is {
      analysisType: string;
      behaviorLabel: string;
      rank: number | null;
      score: number;
      wallet: string;
      ownershipPercent: number | null;
    } => Boolean(row))
    .sort((left, right) => right.score - left.score)
    .slice(0, 10);
}

function OverviewExecutiveScoreCard({
  inverseTone = false,
  label,
  pending,
  score,
}: {
  inverseTone?: boolean;
  label: string;
  pending: boolean;
  score: number | null;
}) {
  const displayScore = pending ? "—" : score === null ? "N/A" : formatScoreValue(score);
  const scoreClass =
    inverseTone && score !== null && score >= 65
      ? "text-[color:var(--nova-warning)]"
      : "text-[color:var(--nova-text)]";
  const energy = pending || score === null ? 0.34 : Math.max(0.18, Math.min(1, score / 100));
  const isPrimaryScore = label === "Nova Conviction" || label === "Risk Score";
  const coreSizeClass = isPrimaryScore ? "h-[5.9rem] w-[5.9rem]" : "h-[4.75rem] w-[4.75rem]";

  return (
    <div
      className={`nova-overview-score-card relative overflow-hidden rounded-[1.8rem] ${
        isPrimaryScore
          ? `min-h-[102px] ${overviewScoreCardSurfaceClass}`
          : `min-h-[86px] ${overviewScoreCardSurfaceClass}`
      } px-4 py-3 backdrop-blur-2xl`}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle_at_20%_50%,rgba(83,104,120,0.14),rgba(94,114,107,0.05)_34%,transparent_68%)]"
        style={{
          animation: `novaScoreCoreBreath ${isPrimaryScore ? 6.6 : 7.6}s ease-in-out infinite`,
          opacity: isPrimaryScore ? 0.34 : 0.22,
        }}
      />
      <div
        className="pointer-events-none absolute left-[28%] top-1/2 h-[82%] w-[58%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(83,104,120,0.08),rgba(94,114,107,0.035)_34%,transparent_70%)] blur-2xl"
        style={{ opacity: isPrimaryScore ? 0.58 : 0.34 }}
      />
      <div
        className={`nova-score-core pointer-events-none absolute left-[4.4rem] top-1/2 rounded-full ${coreSizeClass}`}
        style={{
          filter: `drop-shadow(0 0 ${isPrimaryScore ? 22 : 15}px rgba(83,104,120,${0.04 + energy * 0.1}))`,
          opacity: 0.76 + energy * 0.2,
          transform: "translate(-50%, -50%)",
        }}
      >
        <div
          className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_48%,rgba(237,245,242,0.09),rgba(83,104,120,0.13)_18%,rgba(94,114,107,0.16)_38%,rgba(16,18,19,0.34)_58%,transparent_76%)]"
          style={{ opacity: 0.42 + energy * 0.28 }}
        />
        <div className="absolute -inset-[7%] rounded-full border border-[color:rgba(127,144,150,0.08)]" />
        <div className="absolute inset-0 rounded-full border border-[color:rgba(237,245,242,0.11)]" />
        <div className="absolute inset-[32%] rounded-full border border-[color:rgba(237,245,242,0.1)] bg-[rgba(10,10,10,0.42)]" />
        <div
          className="absolute inset-[13%] animate-[novaScoreSymbolRotate_38s_linear_infinite] rounded-full border border-dashed border-[color:rgba(127,144,150,0.13)]"
          style={{ opacity: 0.42 + energy * 0.28 }}
        />
        <div className="absolute inset-[3%] animate-[novaScoreSymbolRotate_52s_linear_infinite_reverse] rounded-full">
          <div
            className="absolute left-1/2 top-0 h-1 w-1 -translate-x-1/2 rounded-full bg-[rgba(237,245,242,0.32)] shadow-[0_0_12px_rgba(127,144,150,0.18)]"
            style={{ opacity: 0.22 + energy * 0.24 }}
          />
          <div className="absolute bottom-4 right-4 h-0.5 w-0.5 rounded-full bg-[rgba(127,144,150,0.24)]" />
        </div>
        <div
          className="absolute inset-[31%] rounded-full bg-[radial-gradient(circle,rgba(237,245,242,0.18),rgba(83,104,120,0.14)_42%,transparent_72%)] blur-[1px]"
          style={{ opacity: 0.24 + energy * 0.46 }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <p className={`relative z-10 font-light tabular-nums tracking-[-0.07em] ${scoreClass} ${isPrimaryScore ? "text-3xl" : "text-2xl"}`}>
            {displayScore}
          </p>
        </div>
      </div>
      <div className="nova-score-label relative flex h-full min-h-[inherit] flex-col justify-center pl-[8.6rem] pr-2 text-left">
        <p className="text-[0.72rem] uppercase tracking-[0.18em] text-[color:var(--nova-text-soft)]">
          {label}
        </p>
      </div>
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
  const displayScore = pending ? "—" : score === null ? "N/A" : score;
  const scoreClass =
    inverseTone && score !== null && score >= 65
      ? "text-[color:var(--nova-warning)]"
      : "text-[color:var(--nova-text)]";
  return (
    <div className="relative flex min-h-[130px] flex-col items-center justify-center overflow-hidden rounded-[1.5rem] nova-card-inner p-3 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(94,114,107,0.13),transparent_64%)]" />
      <div className="pointer-events-none absolute h-20 w-20 rounded-full bg-[rgba(83,104,120,0.1)] blur-3xl" />

      <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-[color:var(--nova-border)] bg-[radial-gradient(circle_at_34%_28%,rgba(127,144,150,0.12),rgba(16,18,19,0.68)_42%,rgba(10,10,10,0.94)_76%)] shadow-[0_0_48px_rgba(83,104,120,0.1)]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 rounded-full"
        >
          <div className="absolute inset-3 rounded-full border border-[color:var(--nova-border)]" />
          <div className="absolute left-1/2 top-1/2 h-[1px] w-[130%] -translate-x-1/2 -translate-y-1/2 rotate-12 bg-gradient-to-r from-transparent via-[rgba(83,104,120,0.16)] to-transparent" />
        </motion.div>

        <div className="relative z-10 text-center">
          <p className={`text-2xl font-medium tracking-[-0.06em] drop-shadow-[0_0_16px_rgba(83,104,120,0.22)] ${scoreClass}`}>
            {formatScoreValue(displayScore)}
          </p>
        </div>
      </div>

      <p className="relative z-10 mt-2 max-w-[7.5rem] truncate text-center text-[0.68rem] font-light text-[color:var(--nova-text-soft)]">
        {title}
      </p>
      <p className="relative z-10 mt-1 line-clamp-2 max-w-[8.6rem] text-center text-[0.6rem] leading-snug text-[color:var(--nova-text-muted)]">
        {pending ? "Loading" : detail}
      </p>
    </div>
  );
}

function ExplainableConvictionEnginePanel({
  data,
  error,
  formulaV3,
  insiderRiskV2,
  loadState,
  novaConviction,
  token,
  tokenData,
  tokenFlowSummaryV2,
}: {
  data: ExplainableConvictionData | null;
  error: string;
  formulaV3: ConvictionFormulaV3Result | null;
  insiderRiskV2: InsiderRiskV2Result;
  loadState: HolderLoadState;
  novaConviction: NovaConvictionResult | null;
  token: string;
  tokenData: TokenResult;
  tokenFlowSummaryV2: TokenFlowSummaryV2 | null;
}) {
  if (loadState === "loaded" && data) {
    return (
      <NovaConvictionModelView
        data={data}
        formulaV3={formulaV3}
        insiderRiskV2={insiderRiskV2}
        novaConviction={novaConviction}
        token={token}
        tokenData={tokenData}
        tokenFlowSummaryV2={tokenFlowSummaryV2}
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
  insiderRiskV2,
  novaConviction,
  token,
  tokenData,
  tokenFlowSummaryV2,
}: {
  data: ExplainableConvictionData;
  formulaV3: ConvictionFormulaV3Result | null;
  insiderRiskV2: InsiderRiskV2Result;
  novaConviction: NovaConvictionResult | null;
  token: string;
  tokenData: TokenResult;
  tokenFlowSummaryV2: TokenFlowSummaryV2 | null;
}) {
  const finalScore = Math.round(
    novaConviction?.novaConvictionScore ??
      formulaV3?.finalConvictionScoreV3 ??
      data.finalConvictionScore
  );
  const convictionLabel = novaConvictionLabel(finalScore);
  const fallbackPillars = buildNovaConvictionPillars({ data, formulaV3 });
  const fallbackStrongest = fallbackPillars.reduce(
    (best, pillar) => (!best || pillar.score > best.score ? pillar : best),
    fallbackPillars[0]
  );
  const fallbackLimiter = fallbackPillars.reduce(
    (weakest, pillar) =>
      !weakest || pillar.score < weakest.score ? pillar : weakest,
    fallbackPillars[0]
  );
  const thesis =
    novaConviction?.thesis.summary ||
    novaConviction?.thesis.finalInterpretation ||
    buildNovaConvictionThesis({
    finalScore,
      strongestSupport: fallbackStrongest,
      mainLimiter: fallbackLimiter,
    });
  const researchSections = buildNovaResearchSections({
    data,
    formulaV3,
    insiderRiskV2,
    novaConviction,
    tokenFlowSummaryV2,
  });
  const pillarSections = buildNovaTerminalPillars(researchSections);
  const contributorLists = buildNovaContributorLists({
    formulaV3,
    novaConviction,
    sections: pillarSections,
  });
  const strongestSupport = contributorLists.positive[0] ?? {
    label: fallbackStrongest.label,
    score: fallbackStrongest.score,
    note: fallbackStrongest.detail,
  };
  const mainLimiter = contributorLists.negative[0] ?? {
    label: fallbackLimiter.label,
    score: fallbackLimiter.score,
    note: fallbackLimiter.detail,
  };
  const confidenceScore = Math.round(
    novaConviction?.scores.dataConfidence ?? data.dataConfidence.score
  );
  const confidenceContextLabel =
    novaConfidenceLabel(confidenceScore) || data.dataConfidence.label || confidenceScoreLabel(confidenceScore);
  const tokenLabel = tokenData.symbol || token;

  return (
    <div className="space-y-4">
      <div className={`rounded-3xl p-5 ${terminalGlassCardClass}`}>
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center">
          <div className="min-w-[240px] flex-1">
            <p className="text-[0.64rem] uppercase tracking-[0.22em] text-[color:var(--nova-accent-soft)]">
              Nova Conviction Model
            </p>
            <div className="mt-4 flex items-end gap-2">
              <p className="text-7xl font-light tracking-[-0.065em] text-[color:var(--nova-text)] md:text-8xl">
                {finalScore}
              </p>
              <p className="pb-3 text-sm text-[color:var(--nova-text-muted)]">/100</p>
            </div>
            <p className="mt-3 text-lg font-medium text-[color:var(--nova-text)]">
              {convictionLabel}
            </p>
            <div className="mt-4 h-2 overflow-hidden rounded-full nova-card-inner">
              <div
                className="h-full rounded-full bg-[rgba(83,104,120,0.70)] shadow-[0_0_18px_rgba(83,104,120,0.3)]"
                style={{
                  width: `${normalizeScore(finalScore)}%`,
                }}
              />
            </div>
          </div>
          <div className="min-w-0 flex-[1.65] xl:px-2">
            <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--nova-text-muted)]">
              Conviction Summary
            </p>
            <p className="mt-3 text-lg leading-relaxed text-[color:var(--nova-text-soft)]">
              {thesis}
            </p>
          </div>
          <div className="flex shrink-0 items-center justify-start xl:w-28 xl:justify-end">
            <TokenAvatar
              logoUrl={resolveTokenLogo(tokenData)}
              sizeClass="h-20 w-20 md:h-24 md:w-24"
              token={tokenLabel}
            />
            <div className="ml-3 xl:hidden">
              <p className="truncate text-sm font-medium text-[color:var(--nova-text)]">
                {tokenLabel}
              </p>
              <p className="mt-0.5 text-xs text-[color:var(--nova-text-muted)]">
                {chainName(tokenData.chain)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className={`rounded-3xl p-4 ${terminalGlassCardClass}`}>
        <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--nova-text-muted)]">
          Why NovaOS reached this conclusion
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <ConvictionReasonCard
            detail={strongestSupport.note}
            label="Strongest Contributor"
            score={strongestSupport.score}
            title={strongestSupport.label}
          />
          <ConvictionReasonCard
            detail={mainLimiter.note}
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

      <div className="grid gap-3 xl:grid-cols-3">
        {pillarSections.map((section) => (
          <NovaConvictionPillarPanel key={section.title} section={section} />
        ))}
      </div>

      <p className="px-1 text-xs leading-relaxed text-[color:var(--nova-text-muted)]">
        Nova Conviction explains available evidence only. Unavailable module
        values are hidden rather than inferred. It does not calculate future
        price, PnL, win rate, average entry/exit, wallet identity, or financial
        advice.
      </p>
    </div>
  );
}

type NovaResearchMetric = {
  barValue?: number | null;
  label: string;
  note?: string;
  tone?: "score" | "risk" | "money" | "count" | "text";
  value: number | string;
};

type NovaResearchSection = {
  description: string;
  emptyLabel?: string;
  rows: NovaResearchMetric[];
  score?: number | null;
  title: string;
};

type NovaContributor = {
  label: string;
  note: string;
  score: number;
};

function buildNovaResearchSections({
  data,
  formulaV3,
  insiderRiskV2,
  novaConviction,
  tokenFlowSummaryV2,
}: {
  data: ExplainableConvictionData;
  formulaV3: ConvictionFormulaV3Result | null;
  insiderRiskV2: InsiderRiskV2Result;
  novaConviction: NovaConvictionResult | null;
  tokenFlowSummaryV2: TokenFlowSummaryV2 | null;
}): NovaResearchSection[] {
  const holderAlpha = readRecord(novaConviction?.moduleSummaries?.holderAlpha);
  const smartMoneyFlow = readRecord(novaConviction?.moduleSummaries?.smartMoneyFlow);
  const riskPressure = readRecord(novaConviction?.moduleSummaries?.riskPressure);
  const riskStats = readRecord(novaConviction?.moduleSummaries?.riskStats);
  const scoreBreakdown = readRecord(novaConviction?.scoreBreakdown);
  const dataConfidenceBreakdown = readRecord(scoreBreakdown?.dataConfidence);
  const confidenceComponents = readRecord(dataConfidenceBreakdown?.components);
  const novaBreakdown = readRecord(scoreBreakdown?.novaConviction);
  const riskSubScores = readRecord(riskPressure?.subScores);
  const riskMetrics = readRecord(riskPressure?.metrics);
  const topWallets = readRecordArray(holderAlpha?.topWalletsByAlphaV3);
  const bottomWallets = readRecordArray(holderAlpha?.bottomWalletsByAlphaV3);
  const holderWallets = [...topWallets, ...bottomWallets];

  return [
    {
      title: "Holder Quality",
      description:
        "How Holder Quality was built from Holder Alpha V3 wallet evidence and ownership composition.",
      score:
        novaConviction?.scores.holderAlpha ??
        formulaV3?.pillarScores.holderQualityScore ??
        null,
      rows: cleanResearchRows([
        metricFromAverage("Entry Discipline", holderWallets, "entryDisciplineV3"),
        metricFromAverage("Exit Discipline", holderWallets, "exitDisciplineV3"),
        metricFromAverage("Consistency", holderWallets, "consistencyV3"),
        metricFromAverage("Win Rate Quality", holderWallets, "winRateQualityV3"),
        metricFromAverage("Rotation Quality", holderWallets, "rotationQualityV3"),
        metricFromAverage("Risk Hygiene", holderWallets, "riskHygieneV3"),
        metricFromNumber("Wallet Quality", numberField(holderAlpha, "weightedWalletAlphaV3")),
        metricFromNumber("Holder Composition", numberField(holderAlpha, "holderCompositionScore")),
        metricFromNumber("Good Ownership %", numberField(holderAlpha, "goodOrBetterOwnershipPercent"), "percent"),
        metricFromNumber("Weak Ownership %", numberField(holderAlpha, "weakOrToxicOwnershipPercent"), "percent", "risk"),
        metricFromNumber("Smart Ownership %", numberField(holderAlpha, "smartLikeOwnershipPercent"), "percent"),
        metricFromNumber("Data Confidence", numberField(holderAlpha, "confidenceScore")),
      ]),
    },
    {
      title: "Smart Money",
      description:
        "Recent smart-wallet flow and matched wallet participation when the Smart Money module is available.",
      score: novaConviction?.scores.smartMoneyFlow ?? null,
      emptyLabel: "Smart Money Flow is unavailable for this scan.",
      rows: cleanResearchRows([
        metricFromNumber("Smart Money Score", numberField(smartMoneyFlow, "smartMoneyFlowScore")),
        metricFromNumber("Recent Smart Wallet Activity", numberField(smartMoneyFlow, "matchedTradeCount"), "count"),
        metricFromNumber("Buy Pressure", numberField(smartMoneyFlow, "smartMoneyBuyPressure")),
        metricFromNumber("Sell Pressure", numberField(smartMoneyFlow, "smartMoneySellPressure"), "score", "risk"),
        metricFromNumber("Net Flow", numberField(smartMoneyFlow, "smartMoneyNetFlowUsd"), "money", "money"),
        metricFromNumber("Matched Wallet Count", numberField(smartMoneyFlow, "uniqueSmartWallets"), "count"),
        metricFromSmartWallets(smartMoneyFlow),
        metricFromNumber("Wallet Flow", tokenFlowSummaryV2 ? overviewWalletFlowScore(tokenFlowSummaryV2) : null),
      ]),
    },
    {
      title: "Risk Analysis",
      description:
        "Risk internals from Risk Pressure, ownership exposure, market pressure, and behavioral uncertainty.",
      score: novaConviction?.risk.riskScore ?? insiderRiskV2.insiderRiskScore,
      rows: cleanResearchRows([
        metricFromNumber("Risk Pressure", novaConviction?.scores.riskPressure ?? numberField(riskPressure, "riskPressureScore"), "score", "risk"),
        metricFromNumber("Weak Holder Pressure", numberField(riskSubScores, "weakHolderRiskScore"), "score", "risk"),
        metricFromNumber("Concentration Risk", numberField(riskSubScores, "top10ConcentrationRiskScore") ?? insiderRiskV2.concentrationPressureScore, "score", "risk"),
        metricFromNumber("Phishing Exposure", numberField(riskSubScores, "phishingRiskScore"), "score", "risk"),
        metricFromNumber("Bundler Exposure", numberField(riskSubScores, "bundlerRiskScore") ?? insiderRiskV2.bundleStructureScore, "score", "risk"),
        metricFromNumber("Sniper Exposure", numberField(riskSubScores, "sniperRiskScore"), "score", "risk"),
        metricFromNumber("Fresh Wallet Exposure", numberField(riskSubScores, "freshWalletRiskScore"), "score", "risk"),
        metricFromNumber("Market Pressure", numberField(riskPressure, "marketRiskScore"), "score", "risk"),
        metricFromNumber("Sell Pressure", numberField(riskSubScores, "sellPressureRiskScore") ?? numberField(riskMetrics, "sellPressure"), "score", "risk"),
        metricFromNumber("Behavioral Risk", numberField(riskPressure, "behavioralRiskScore"), "score", "risk"),
        metricFromNumber("Data Uncertainty", numberField(riskPressure, "confidenceRiskScore"), "score", "risk"),
      ]),
    },
    {
      title: "Liquidity Health",
      description:
        "Liquidity, volume, market size, and trading activity inputs used to judge market durability.",
      score: novaConviction?.scores.liquidityHealth ?? data.subScores.liquidityTrust,
      rows: cleanResearchRows([
        metricFromNumber("Liquidity Health", novaConviction?.scores.liquidityHealth ?? data.subScores.liquidityTrust),
        metricFromNumber("Liquidity", numberField(riskStats, "liquidityUsd") ?? numberField(riskMetrics, "liquidityUsd"), "money", "money"),
        metricFromNumber("Volume", numberField(riskStats, "volume24h") ?? numberField(riskMetrics, "volume24h"), "money", "money"),
        metricFromNumber("Volume / Liquidity Ratio", numberField(riskMetrics, "volumeLiquidityRatio"), "ratio"),
        metricFromNumber("Market Cap", numberField(riskStats, "marketCap") ?? numberField(riskMetrics, "marketCapApprox"), "money", "money"),
        metricFromNumber("Trading Activity", data.subScores.marketMomentum),
        metricFromNumber("Liquidity Trust", data.subScores.liquidityTrust),
      ]),
    },
    {
      title: "Data Confidence",
      description:
        "Coverage, wallet depth, failed wallet count, and confidence modifiers behind the final confidence reading.",
      score: novaConviction?.scores.dataConfidence ?? data.dataConfidence.score,
      rows: cleanResearchRows([
        metricFromNumber("Coverage", numberField(confidenceComponents, "coverage") ?? data.aggregation.dataCoverage),
        metricFromNumber("Wallet Coverage", numberField(confidenceComponents, "holderAlpha") ?? numberField(holderAlpha, "holderSetCoverageScore")),
        metricFromNumber("Deep Wallet Count", numberField(holderAlpha, "deepAnalyzedWalletCount"), "count"),
        metricFromNumber("Light Wallet Count", numberField(holderAlpha, "lightAnalyzedWalletCount"), "count"),
        metricFromNumber("Failed Wallet Count", numberField(holderAlpha, "failedWalletCount"), "count", "risk"),
        metricFromNumber("Confidence Modifier", numberField(novaBreakdown, "confidenceModifier"), "ratio"),
        metricFromNumber("Final Data Confidence", novaConviction?.scores.dataConfidence ?? data.dataConfidence.score),
        metricFromText("Confidence Label", novaConfidenceLabel(novaConviction?.scores.dataConfidence ?? data.dataConfidence.score)),
      ]),
    },
  ];
}

function buildNovaTerminalPillars(sections: NovaResearchSection[]) {
  const holder = sections.find((section) => section.title === "Holder Quality");
  const risk = sections.find((section) => section.title === "Risk Analysis");
  const liquidity = sections.find((section) => section.title === "Liquidity Health");
  const confidence = sections.find((section) => section.title === "Data Confidence");

  return [
    {
      title: "Holder Quality",
      description: "Holder Alpha V3 quality and ownership composition.",
      score: holder?.score ?? null,
      rows: holder?.rows ?? [],
    },
    {
      title: "Risk Analysis",
      description: "Risk pressure, exposure, concentration, and uncertainty.",
      score: risk?.score ?? null,
      rows:
        risk?.rows.filter((row) =>
          [
            "Weak Holder Pressure",
            "Phishing Exposure",
            "Bundler Exposure",
            "Sniper Exposure",
            "Fresh Wallet Exposure",
            "Market Pressure",
            "Sell Pressure",
            "Behavioral Risk",
            "Data Uncertainty",
            "Concentration Risk",
          ].includes(row.label)
        ) ?? [],
    },
    {
      title: "Market Health",
      description: "Liquidity health, market activity, and usable data coverage.",
      score: liquidity?.score ?? null,
      rows: [
        ...(liquidity?.rows.filter((row) =>
          [
            "Liquidity",
            "Volume",
            "Volume / Liquidity Ratio",
            "Trading Activity",
            "Market Cap",
            "Liquidity Trust",
          ].includes(row.label)
        ) ?? []),
        ...(confidence?.rows.filter((row) =>
          [
            "Final Data Confidence",
            "Coverage",
            "Wallet Coverage",
            "Confidence Modifier",
          ].includes(row.label)
        ).map((row) =>
          row.label === "Final Data Confidence"
            ? { ...row, label: "Data Confidence" }
            : row
        ) ?? []),
      ],
    },
  ] satisfies NovaResearchSection[];
}

function cleanResearchRows(rows: Array<NovaResearchMetric | null>) {
  return rows.filter((row): row is NovaResearchMetric => Boolean(row));
}

function readRecordArray(value: unknown) {
  return Array.isArray(value)
    ? value.map(readRecord).filter((item): item is Record<string, unknown> => Boolean(item))
    : [];
}

function numberField(record: Record<string, unknown> | null | undefined, key: string) {
  return readFiniteNumber(record?.[key]);
}

function metricFromNumber(
  label: string,
  value: number | null | undefined,
  format: "score" | "percent" | "money" | "count" | "ratio" = "score",
  tone: NovaResearchMetric["tone"] = format === "money" ? "money" : "score"
): NovaResearchMetric | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const display =
    format === "money"
      ? formatUsd(value)
      : format === "percent"
      ? `${Number(value.toFixed(2))}%`
      : format === "ratio"
      ? Number(value.toFixed(3)).toString()
      : format === "count"
      ? String(Math.round(value))
      : formatScoreValue(value);
  return {
    barValue: metricBarValue(value, format),
    label,
    tone,
    value: display,
  };
}

function metricBarValue(
  value: number,
  format: "score" | "percent" | "money" | "count" | "ratio"
) {
  if (!Number.isFinite(value)) return null;
  if (format === "money") {
    return Math.max(0, Math.min(100, Math.log10(Math.max(value, 0) + 1) * 10));
  }
  if (format === "ratio") {
    return Math.max(0, Math.min(100, value * 100));
  }
  return Math.max(0, Math.min(100, value));
}

function metricFromText(label: string, value: string | null | undefined): NovaResearchMetric | null {
  return value ? { label, tone: "text", value } : null;
}

function metricFromAverage(
  label: string,
  rows: Array<Record<string, unknown>>,
  key: string
): NovaResearchMetric | null {
  const values = rows
    .map((row) => numberField(row, key))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!values.length) return null;
  const average = values.reduce((total, value) => total + value, 0) / values.length;
  return metricFromNumber(label, average);
}

function metricFromSmartWallets(record: Record<string, unknown> | null): NovaResearchMetric | null {
  const wallets = readRecordArray(record?.topSmartWallets);
  if (!wallets.length) return null;
  const labels = wallets
    .slice(0, 3)
    .map((wallet) =>
      String(wallet.walletName || wallet.twitterUsername || wallet.wallet || "Smart wallet")
    );
  return { label: "Recent Smart Wallets", tone: "text", value: labels.join(", ") };
}

function NovaConvictionPillarPanel({ section }: { section: NovaResearchSection }) {
  const score = typeof section.score === "number" && Number.isFinite(section.score)
    ? normalizeScore(section.score)
    : null;

  return (
    <section className={`flex min-h-[520px] flex-col rounded-3xl p-4 ${terminalGlassCardClass}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--nova-accent-soft)]">
            {section.title}
          </p>
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[color:var(--nova-text-muted)]">
            {section.description}
          </p>
        </div>
        <p className="font-mono text-5xl font-semibold tabular-nums tracking-[-0.07em] text-[color:var(--nova-text)]">
          {score === null ? "N/A" : score}
        </p>
      </div>

      <MetricBar value={score} className="mt-4 h-2" tone={section.title === "Risk Analysis" ? "risk" : "score"} />

      <div className="mt-4 flex-1 space-y-2.5">
        {section.rows.length ? (
          section.rows.map((row) => (
            <NovaPillarMetricRow
              key={`${section.title}-${row.label}`}
              row={row}
              tone={section.title === "Risk Analysis" ? "risk" : row.tone}
            />
          ))
        ) : (
          <div className={`flex h-full min-h-[220px] items-center justify-center rounded-2xl px-5 text-center text-xs text-[color:var(--nova-text-muted)] ${terminalGlassCardClass}`}>
            No supported metrics returned for this pillar.
          </div>
        )}
      </div>
    </section>
  );
}

function NovaPillarMetricRow({
  row,
  tone,
}: {
  row: NovaResearchMetric;
  tone?: NovaResearchMetric["tone"];
}) {
  const barValue =
    typeof row.barValue === "number" && Number.isFinite(row.barValue)
      ? row.barValue
      : typeof row.value === "number"
      ? row.value
      : null;
  const valueClass =
    tone === "risk" || row.tone === "risk"
      ? "text-[color:var(--nova-warning)]"
      : "text-[color:var(--nova-text-soft)]";

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-xs text-[color:var(--nova-text-soft)]">{row.label}</p>
        <p className={`shrink-0 font-mono text-xs tabular-nums ${valueClass}`}>{row.value}</p>
      </div>
      <MetricBar value={barValue} className="mt-1.5 h-1" tone={tone === "risk" || row.tone === "risk" ? "risk" : "score"} />
    </div>
  );
}

function MetricBar({
  className = "",
  tone = "score",
  value,
}: {
  className?: string;
  tone?: "score" | "risk";
  value: number | null;
}) {
  const width = typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, value))
    : 0;

  return (
    <div className={`overflow-hidden rounded-full bg-[rgba(83,104,120,0.1)] ${className}`}>
      <div
        className={`h-full rounded-full ${
          tone === "risk"
            ? "bg-[var(--nova-slate)] shadow-[0_0_14px_rgba(83,104,120,0.16)]"
            : "bg-[rgba(127,144,150,0.72)] shadow-[0_0_14px_rgba(83,104,120,0.18)]"
        }`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function buildNovaContributorLists({
  formulaV3,
  novaConviction,
  sections,
}: {
  formulaV3: ConvictionFormulaV3Result | null;
  novaConviction: NovaConvictionResult | null;
  sections: NovaResearchSection[];
}) {
  const positive: NovaContributor[] = [];
  const negative: NovaContributor[] = [];

  for (const section of sections) {
    if (typeof section.score !== "number" || !Number.isFinite(section.score)) continue;
    if (section.score >= 58) {
      positive.push({
        label: section.title,
        note: `${section.title} is supportive at ${formatScoreValue(section.score)}/100.`,
        score: section.score,
      });
    }
    if (section.title === "Risk Analysis" || section.score < 50) {
      negative.push({
        label: section.title === "Risk Analysis" ? "Risk Pressure" : section.title,
        note:
          section.title === "Risk Analysis"
            ? `Risk score is ${formatScoreValue(section.score)}/100.`
            : `${section.title} limits conviction at ${formatScoreValue(section.score)}/100.`,
        score: section.title === "Risk Analysis" ? section.score : 100 - section.score,
      });
    }
  }

  for (const item of formulaV3?.positiveDrivers ?? []) {
    positive.push({ label: item, note: "Formula V3 positive driver.", score: 60 });
  }
  for (const item of novaConviction?.thesis.bullishPoints ?? []) {
    positive.push({ label: item, note: "Nova thesis positive driver.", score: 60 });
  }
  for (const item of formulaV3?.negativeDrivers ?? []) {
    negative.push({ label: item, note: "Formula V3 negative driver.", score: 60 });
  }
  for (const item of novaConviction?.risk.riskDrivers ?? []) {
    negative.push({ label: item, note: "Nova risk driver.", score: 70 });
  }
  for (const item of novaConviction?.thesis.bearishPoints ?? []) {
    negative.push({ label: item, note: "Nova thesis negative driver.", score: 60 });
  }

  return {
    positive: uniqueContributors(positive).sort((a, b) => b.score - a.score).slice(0, 6),
    negative: uniqueContributors(negative).sort((a, b) => b.score - a.score).slice(0, 6),
  };
}

function uniqueContributors(items: NovaContributor[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function NovaResearchSectionCard({ section }: { section: NovaResearchSection }) {
  return (
    <section className={`rounded-3xl p-4 ${terminalGlassCardClass}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--nova-text-muted)]">
            {section.title}
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[color:var(--nova-text-soft)]">
            {section.description}
          </p>
        </div>
        {typeof section.score === "number" && Number.isFinite(section.score) && (
          <div className="text-right">
            <p className="font-mono text-4xl font-semibold tabular-nums tracking-[-0.06em] text-[color:var(--nova-text)]">
              {formatScoreValue(section.score)}
            </p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--nova-text-muted)]">
              Score
            </p>
          </div>
        )}
      </div>

      {section.rows.length ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {section.rows.map((row) => (
            <NovaResearchMetricCard key={row.label} row={row} />
          ))}
        </div>
      ) : (
        <TerminalStatePanel
          detail={section.emptyLabel || "This module did not return supported fields for this scan."}
          title="Unavailable"
        />
      )}
    </section>
  );
}

function NovaResearchMetricCard({ row }: { row: NovaResearchMetric }) {
  const toneClass =
    row.tone === "risk"
      ? "text-[color:var(--nova-warning)]"
      : row.tone === "money"
      ? "text-[color:var(--nova-accent-soft)]"
      : "text-[color:var(--nova-text)]";

  return (
    <div className={`rounded-2xl p-3 ${terminalGlassCardClass}`}>
      <p className="text-[0.62rem] uppercase tracking-[0.16em] text-[color:var(--nova-text-muted)]">
        {row.label}
      </p>
      <p className={`mt-2 truncate font-mono text-lg font-semibold tabular-nums ${toneClass}`}>
        {row.value}
      </p>
      {row.note && (
        <p className="mt-1 text-xs leading-relaxed text-[color:var(--nova-text-muted)]">{row.note}</p>
      )}
    </div>
  );
}

function NovaTopContributorsPanel({
  lists,
}: {
  lists: { positive: NovaContributor[]; negative: NovaContributor[] };
}) {
  return (
    <section className={`rounded-3xl p-4 ${terminalGlassCardClass}`}>
      <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--nova-text-muted)]">
        Top Contributors
      </p>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <NovaContributorList title="Most Positive Drivers" items={lists.positive} />
        <NovaContributorList title="Most Negative Drivers" items={lists.negative} tone="risk" />
      </div>
    </section>
  );
}

function NovaContributorList({
  items,
  title,
  tone = "default",
}: {
  items: NovaContributor[];
  title: string;
  tone?: "default" | "risk";
}) {
  return (
    <div className={`rounded-2xl p-3 ${terminalGlassCardClass}`}>
      <p className="text-[0.62rem] uppercase tracking-[0.16em] text-[color:var(--nova-text-muted)]">
        {title}
      </p>
      <div className="mt-3 space-y-2">
        {items.length ? (
          items.map((item, index) => (
            <div key={`${item.label}-${index}`} className="flex gap-3">
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                  tone === "risk"
                    ? "border-[color:var(--nova-border)] text-[color:var(--nova-warning)]"
                    : "border-[color:var(--nova-border)] text-[color:var(--nova-accent-soft)]"
                }`}
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[color:var(--nova-text-soft)]">{item.label}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[color:var(--nova-text-muted)]">{item.note}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-xs text-[color:var(--nova-text-muted)]">Unavailable</p>
        )}
      </div>
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
      ? terminalGlassCardClass
      : terminalGlassCardClass;

  return (
    <div className={`rounded-2xl p-3 ${toneClass}`}>
      <p className="text-[0.64rem] uppercase tracking-[0.16em] text-[color:var(--nova-text-muted)]">
        {label}
      </p>
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-[color:var(--nova-text)]">{title}</p>
        <p className="font-mono text-xl font-semibold tabular-nums text-[color:var(--nova-text)]">
          {formatScoreValue(score)}
        </p>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-[color:var(--nova-text-soft)]">{detail}</p>
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
          label: "Holder Support",
          score: tokenFlowSummaryV2?.accumulationPressure ?? null,
          note:
            typeof tokenFlowSummaryV2?.accumulationPressure === "number"
              ? scoreLabel(tokenFlowSummaryV2.accumulationPressure)
              : "Unavailable",
        },
        {
          label: "Holder Risk",
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
    <div className="rounded-3xl nova-card-inner p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--nova-text-muted)]">
            {pillar.label}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-[color:var(--nova-text-muted)]">
            {pillar.detail}
          </p>
        </div>
        <p className="font-mono text-3xl font-semibold tabular-nums tracking-[-0.05em] text-[color:var(--nova-text)]">
          {formatScoreValue(pillar.score)}
        </p>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full nova-card-inner">
        <div
          className="h-full rounded-full bg-[rgba(83,104,120,0.68)] shadow-[0_0_16px_rgba(83,104,120,0.22)]"
          style={{ width: `${normalizeScore(pillar.score)}%` }}
        />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-[color:var(--nova-text-soft)]">
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
      ? "bg-[rgba(83,104,120,0.48)] shadow-[0_0_14px_rgba(83,104,120,0.18)]"
      : "bg-[rgba(83,104,120,0.62)] shadow-[0_0_14px_rgba(83,104,120,0.18)]";

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs text-[color:var(--nova-text-soft)]">{row.label}</p>
          <p className="mt-0.5 text-[0.66rem] text-[color:var(--nova-text-muted)]">
            {row.note || (hasScore ? scoreLabel(row.score as number) : "Unavailable")}
          </p>
        </div>
        <p
          className={`font-mono text-sm tabular-nums ${
            hasScore ? "text-[color:var(--nova-text-soft)]" : "text-[color:var(--nova-text-muted)]"
          }`}
        >
          {hasScore ? formatScoreValue(row.score as number) : "Unavailable"}
        </p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full nova-card-inner">
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
    <div className="rounded-3xl nova-card-inner p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--nova-accent)]">
            Holder Intelligence Matrix V2
          </p>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-[color:var(--nova-text-muted)]">
            Holder Intelligence uses available holder metadata, profile behavior,
            relationship evidence, deep behavior and wallet reputation. It does
            not calculate PnL, win rate, average entry, average exit, smart money
            identity, insider identity, or unavailable wallet history.
          </p>
        </div>
        <span className="rounded-full nova-card-inner px-3 py-1 text-xs text-[color:var(--nova-text-soft)]">
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
            <div className="rounded-2xl border border-[color:rgba(83,104,120,0.14)] nova-card-inner p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--nova-text-muted)]">
                Summary Verdict
              </p>
              <p className="mt-2 text-sm font-medium text-[color:var(--nova-text)]">
                {summary.summaryVerdict}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-[color:var(--nova-text-muted)]">
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
            <div className="mt-4 overflow-x-auto rounded-2xl border border-[color:rgba(83,104,120,0.14)] nova-card-inner">
              <div className="grid min-w-[880px] grid-cols-[1.05fr_1fr_0.8fr_0.8fr_0.8fr] gap-3 border-b border-[color:rgba(83,104,120,0.14)] px-4 py-3 text-[10px] uppercase tracking-[0.14em] text-[color:var(--nova-text-muted)]">
                <span>Holder</span>
                <span>Class</span>
                <span className="text-center">Contribution</span>
                <span className="text-center">Risk</span>
                <span className="text-center">Score</span>
              </div>
              {matrix.slice(0, 8).map((holder) => (
                <div
                  key={`${holder.holderRank || "holder"}-${holder.walletAddress}`}
                  className="grid min-h-[56px] min-w-[880px] grid-cols-[1.05fr_1fr_0.8fr_0.8fr_0.8fr] items-center gap-3 border-b border-[color:rgba(83,104,120,0.12)] px-4 py-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[color:var(--nova-text-soft)]">
                      {holder.shortAddress}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[color:var(--nova-text-muted)]">
                      {holder.confidenceLabel} confidence
                    </p>
                  </div>
                  <span className="truncate text-[color:var(--nova-text-soft)]">{holder.holderClass}</span>
                  <span className="text-center text-[color:var(--nova-text-soft)]">
                    {holder.contributionTier}
                  </span>
                  <span className="text-center text-[color:var(--nova-text-soft)]">{holder.riskTier}</span>
                  <span className="text-center font-medium tabular-nums text-[color:var(--nova-accent)]">
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
    <div className="rounded-2xl border border-[color:rgba(83,104,120,0.14)] nova-card-inner p-3">
      <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--nova-text-muted)]">{label}</p>
      <p
        className={`mt-2 truncate text-sm font-medium ${
          tone === "risk" ? "text-[color:var(--nova-warning)]" : "text-[color:var(--nova-text)]"
        }`}
      >
        {holder ? holder.shortAddress : "Unavailable"}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-[color:var(--nova-text-muted)]">
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
    <div className="rounded-2xl border border-[color:rgba(83,104,120,0.14)] nova-card-inner p-3">
      <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--nova-text-muted)]">{title}</p>
      <div className="mt-3 space-y-2">
        {items.length ? (
          items.map((item) => (
            <p key={item} className="text-xs leading-relaxed text-[color:var(--nova-text-muted)]">
              {item}
            </p>
          ))
        ) : (
          <p className="text-xs text-[color:var(--nova-text-muted)]">Unavailable</p>
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
    <section className="rounded-[2rem] border border-[color:var(--nova-border)] bg-[rgba(83,104,120,0.05)] p-5">
      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr] xl:items-start">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-[color:var(--nova-warning)]">
            Insider Risk
          </p>
          <div className="mt-4 flex items-end gap-2">
            <p className="text-6xl font-light tracking-[-0.065em] text-[color:var(--nova-text)]">
              {result.insiderRiskScore}
            </p>
            <p className="pb-2 text-sm text-[color:var(--nova-text-muted)]">/100</p>
          </div>
          <p className="mt-3 text-lg font-medium text-[color:var(--nova-warning)]">
            {result.riskTier} structural risk
          </p>
          <p className="mt-3 text-sm leading-relaxed text-[color:var(--nova-text-soft)]">
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
    <div className="rounded-2xl border border-[color:rgba(83,104,120,0.14)] nova-card-inner p-3">
      <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--nova-text-muted)]">{title}</p>
      <div className="mt-3 space-y-2">
        {items.length ? (
          items.slice(0, 5).map((item) => (
            <p key={item} className="text-xs leading-relaxed text-[color:var(--nova-text-soft)]">
              {item}
            </p>
          ))
        ) : (
          <p className="text-xs text-[color:var(--nova-text-muted)]">Unavailable</p>
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
    <div className="rounded-2xl border border-[color:rgba(83,104,120,0.14)] nova-card-inner p-3">
      <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--nova-text-muted)]">{label}</p>
      <p
        className={`mt-2 truncate text-sm font-medium ${
          tone === "risk" ? "text-[color:var(--nova-warning)]" : "text-[color:var(--nova-text)]"
        }`}
      >
        {wallet ? shortInsiderWalletAddress(wallet.walletAddress) : "Unavailable"}
      </p>
      <p className="mt-1 text-xs text-[color:var(--nova-text-muted)]">
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
    <details className="rounded-3xl nova-card-inner p-4">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--nova-text-muted)]">
              Validation lab
            </p>
            <h3 className="mt-2 text-lg font-semibold tracking-[-0.035em] text-[color:var(--nova-text)]">
              Formula Validation Log
            </h3>
            <p className="mt-2 max-w-3xl text-xs leading-relaxed text-[color:var(--nova-text-muted)]">
              Internal local-only testing log for V1, V2 and V3.
            </p>
          </div>
          <span className="rounded-full nova-card-inner px-3 py-1 text-xs text-[color:var(--nova-text-soft)]">
            {snapshots.length} saved
          </span>
        </div>
      </summary>

      <div className="mt-4 border-t border-[color:var(--nova-border)] pt-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <p className="max-w-3xl text-xs leading-relaxed text-[color:var(--nova-text-muted)]">
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
                ? "border-[color:var(--nova-border)] nova-card-inner text-[color:var(--nova-accent)] hover:nova-card-inner"
                : "cursor-not-allowed border-[color:rgba(83,104,120,0.14)] nova-card-inner text-[color:var(--nova-text-muted)]"
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
                ? "border-[color:var(--nova-border)] nova-card-inner text-[color:var(--nova-text-muted)] hover:nova-card-inner"
                : "cursor-not-allowed border-[color:rgba(83,104,120,0.14)] nova-card-inner text-[color:var(--nova-text-muted)]"
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
        <p className="mt-3 rounded-2xl nova-card-inner px-3 py-2 text-xs text-[color:var(--nova-accent-soft)]">
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
    <div className="rounded-2xl nova-card-inner p-3">
      <p className="truncate text-[0.62rem] uppercase tracking-[0.16em] text-[color:var(--nova-text-muted)]">
        {label}
      </p>
      <p className="mt-2 truncate text-lg font-semibold tracking-[-0.045em] text-[color:var(--nova-text)]">
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
    <div className="rounded-2xl nova-card-inner p-3">
      <div className="grid gap-3 xl:grid-cols-[minmax(180px,1fr)_minmax(260px,1.2fr)_minmax(220px,0.9fr)] xl:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <TokenAvatar
            logoUrl={snapshot.tokenLogo}
            sizeClass="h-10 w-10"
            token={snapshot.tokenSymbol}
          />
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p className="truncate font-medium text-[color:var(--nova-text)]">
                {snapshot.tokenSymbol}
              </p>
              <span className="rounded-full nova-card-inner px-2 py-0.5 text-[0.62rem] text-[color:var(--nova-text-muted)]">
                {chainLabel(snapshot.chain)}
              </span>
            </div>
            <p className="mt-1 truncate text-xs text-[color:var(--nova-text-muted)]">
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
            className="rounded-2xl nova-card-inner px-3 py-2 text-xs text-[color:var(--nova-text-soft)] outline-none transition focus:border-[color:var(--nova-border-strong)]"
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
            className="rounded-2xl nova-card-inner px-3 py-2 text-xs text-[color:var(--nova-text-soft)] outline-none transition placeholder:text-[color:var(--nova-text-muted)] focus:border-[color:var(--nova-border-strong)]"
          />
          <button
            type="button"
            onClick={() => onDeleteSnapshot(snapshot.id)}
            className="rounded-2xl nova-card-inner px-3 py-2 text-xs text-[color:var(--nova-text-muted)] transition hover:nova-card-inner"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full nova-card-inner px-3 py-1 text-[color:var(--nova-accent-soft)]">
          Best aligned: {alignment.bestAligned}
        </span>
        <span className="text-[color:var(--nova-text-muted)]">{alignment.hint}</span>
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
    <div className="rounded-xl nova-card-inner px-2 py-2 text-center">
      <p className="text-[0.58rem] uppercase tracking-[0.14em] text-[color:var(--nova-text-muted)]">
        {label}
      </p>
      <p className="mt-1 font-mono text-sm tabular-nums text-[color:var(--nova-text-soft)]">
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
        <div className="rounded-3xl nova-card-inner p-4">
          <SkeletonLine className="h-2 w-28" />
          <SkeletonLine className="mt-6 h-14 w-32" />
          <SkeletonLine className="mt-5 h-2 w-full" />
          <SkeletonLine className="mt-5 h-16 w-full" />
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {[0, 1].map((item) => (
            <div
              key={item}
              className="rounded-3xl nova-card-inner p-4"
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
    <details className="group rounded-2xl border border-[color:rgba(83,104,120,0.14)] nova-card-inner p-3">
      <summary className="cursor-pointer list-none text-xs uppercase tracking-[0.18em] text-[color:var(--nova-text-muted)] transition hover:text-[color:var(--nova-text-soft)]">
        Developer diagnostics
        <span className="ml-2 text-[color:var(--nova-text-muted)] group-open:hidden">Show</span>
        <span className="ml-2 hidden text-[color:var(--nova-text-muted)] group-open:inline">Hide</span>
      </summary>
      <div className="mt-3 rounded-2xl border border-[color:rgba(83,104,120,0.14)] nova-card-inner p-3">
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
              <div className="rounded-2xl nova-card-inner p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--nova-text-muted)]">
                  Route cache
                </p>
                <div className="mt-3 space-y-2">
                  {routeStats.slice(0, 8).map((route) => (
                    <div
                      key={route.route}
                      className="grid grid-cols-[1.2fr_0.5fr_0.5fr_0.55fr_0.65fr_0.65fr] gap-2 rounded-xl border border-[color:rgba(83,104,120,0.14)] nova-card-inner px-3 py-2 text-xs text-[color:var(--nova-text-soft)]"
                    >
                      <span className="truncate text-[color:var(--nova-text-soft)]">{route.route}</span>
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
              <div className="rounded-2xl nova-card-inner p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--nova-text-muted)]">
                  Recent expensive misses
                </p>
                <div className="mt-3 space-y-2">
                  {(data?.stats.recentExpensiveMisses || [])
                    .slice(0, 5)
                    .map((miss) => (
                      <p
                        key={`${miss.createdAt}-${miss.key}`}
                        className="truncate rounded-xl border border-[color:rgba(83,104,120,0.14)] nova-card-inner px-3 py-2 text-xs text-[color:var(--nova-text-muted)]"
                      >
                        {miss.route} · {miss.provider} · {miss.key}
                      </p>
                    ))}
                </div>
              </div>
            )}
            <p className="rounded-2xl nova-card-inner p-3 text-xs leading-relaxed text-[color:var(--nova-text-muted)]">
              Developer-only cache observability. Generated{" "}
              {data?.generatedAt
                ? new Date(data.generatedAt).toLocaleTimeString()
                : "pending"}
              . No secrets or full wallet addresses are exposed.
            </p>
            <div className="rounded-2xl nova-card-inner p-3 text-xs leading-relaxed text-[color:var(--nova-text-muted)]">
              <span className="text-[color:var(--nova-text-soft)]">Unified analysis:</span>{" "}
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
                <span className="text-[color:var(--nova-warning)]"> · {unifiedAnalysisError}</span>
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
      <section className="relative overflow-hidden rounded-[2rem] nova-card-inner p-6 shadow-[0_28px_120px_rgba(0,0,0,0.36)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_28%_8%,rgba(83,104,120,0.11),transparent_34%),radial-gradient(circle_at_88%_28%,rgba(94,114,107,0.12),transparent_36%)]" />
        <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="text-xs uppercase tracking-[0.34em] text-[color:var(--nova-accent-soft)]">
              Bubble Intelligence
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.07em] text-[color:var(--nova-text)]">
              See Beyond the Chart
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[color:var(--nova-text-soft)]">
              Visualize holder concentration, wallet clusters, and relationship
              evidence behind the token.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--nova-border)] nova-card-inner px-4 py-3">
            <TokenAvatar
              logoUrl={resolveTokenLogo(tokenData)}
              sizeClass="h-11 w-11"
              token={token}
            />
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--nova-text-muted)]">
                Ecosystem graph
              </p>
              <p className="mt-1 text-sm font-medium text-[color:var(--nova-text)]">
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
        <div className="rounded-2xl border border-[color:var(--nova-border)] bg-[rgba(83,104,120,0.065)] px-4 py-3 text-xs leading-relaxed text-[color:var(--nova-warning)]">
          {clusterError ||
            "Cluster data is unavailable. The graph can only show available holder/profile evidence."}
        </div>
      )}
      {!hasRelationships && graph.nodes.length > 0 && (
        <div className="rounded-2xl nova-card-inner px-4 py-3 text-xs leading-relaxed text-[color:var(--nova-text-soft)]">
          No high-confidence wallet-to-wallet relationship group detected from
          available data.
        </div>
      )}
      {graph.nodes.length > 0 && graph.nodes.length <= 10 && (
        <div className="rounded-2xl nova-card-inner px-4 py-3 text-xs leading-relaxed text-[color:var(--nova-text-muted)]">
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
                <p className="text-lg font-medium tracking-[-0.04em] text-[color:var(--nova-text-soft)]">
                  No analyzed holder nodes available yet.
                </p>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-[color:var(--nova-text-muted)]">
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

      <p className="text-xs leading-relaxed text-[color:var(--nova-text-muted)]">
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
      <div className="rounded-2xl nova-card-inner p-5">
        <p className="text-xs uppercase tracking-[0.28em] text-[color:var(--nova-accent-soft)]">
          Wallet Detail
        </p>
        <p className="mt-4 text-sm leading-relaxed text-[color:var(--nova-text-soft)]">
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
    <aside className="max-h-[680px] overflow-y-auto rounded-2xl nova-card-inner p-5 shadow-[0_24px_90px_rgba(0,0,0,0.24)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.24em] text-[color:var(--nova-accent-soft)]">
            Wallet Intelligence
          </p>
          <p className="mt-2 truncate font-mono text-base font-semibold text-[color:var(--nova-text)]">
            {activeNode.shortAddress}
          </p>
          <p className="mt-1 break-all font-mono text-[11px] leading-relaxed text-[color:var(--nova-text-muted)]">
            {activeNode.address}
          </p>
        </div>
        <button
          type="button"
          onClick={copyAddress}
          className="shrink-0 rounded-xl nova-card-inner px-3 py-2 text-xs text-[color:var(--nova-text-soft)] transition hover:border-[color:var(--nova-border-strong)] hover:text-[color:var(--nova-accent)]"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full nova-card-inner px-3 py-1 text-xs text-[color:var(--nova-text-soft)]">
          Rank #{activeNode.rank}
        </span>
        {primaryCluster ? (
          <span className="rounded-full nova-card-inner px-3 py-1 text-xs text-[color:var(--nova-accent)]">
            {primaryCluster}
          </span>
        ) : (
          <span className="rounded-full nova-card-inner px-3 py-1 text-xs text-[color:var(--nova-text-muted)]">
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

      <p className="mt-4 text-xs leading-relaxed text-[color:var(--nova-text-muted)]">
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
    <div className="rounded-xl border border-[color:var(--nova-border)] nova-card-inner px-3 py-2 backdrop-blur-xl">
      <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--nova-text-muted)]">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold tracking-[-0.035em] text-[color:var(--nova-text-soft)]">
        {value}
      </p>
    </div>
  );
}

function BubbleGraphSkeleton() {
  return (
    <div className="relative z-10 min-h-[560px]">
      <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full nova-card-inner" />
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

function deriveArenaHolderBehaviorPosture({
  behaviorPreview,
  personalities,
  tokenIntelligence,
  walletRows,
}: {
  behaviorPreview: WalletBehaviorPreviewData | null;
  personalities: WalletPersonalityPreview[];
  tokenIntelligence: TokenIntelligenceData | null;
  walletRows: WalletRow[];
}) {
  const personalityCounts = personalities.reduce<Record<string, number>>((counts, personality) => {
    counts[personality.personalityType] = (counts[personality.personalityType] ?? 0) + 1;
    return counts;
  }, {});
  const strongest = Object.entries(personalityCounts).sort((left, right) => right[1] - left[1])[0];
  if (strongest?.[0]) return strongest[0];
  if (behaviorPreview?.summary.dominantBehaviorClass) {
    return behaviorPreview.summary.dominantBehaviorClass;
  }
  if (tokenIntelligence?.behaviorSummary.dominantBehaviorClass) {
    return tokenIntelligence.behaviorSummary.dominantBehaviorClass;
  }
  return walletRows.length ? "Mixed Holder Base" : undefined;
}

function AIHumanArenaMvpSection({
  behaviorPreview,
  conviction,
  convictionError,
  convictionLoadState,
  formulaV3,
  personalities,
  tokenData,
  tokenIntelligence,
  walletRows,
}: {
  behaviorPreview: WalletBehaviorPreviewData | null;
  behaviorPreviewError: string;
  conviction: ExplainableConvictionData | null;
  convictionError: string;
  convictionLoadState: HolderLoadState;
  formulaV3: ConvictionFormulaV3Result | null;
  holderError: string;
  personalities: WalletPersonalityPreview[];
  tokenData: TokenResult;
  tokenIntelligence: TokenIntelligenceData | null;
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
  const holderBehaviorPosture = conviction
    ? deriveArenaHolderBehaviorPosture({
        behaviorPreview,
        personalities,
        tokenIntelligence,
        walletRows,
      })
    : undefined;
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
        walletFlow: holderBehaviorPosture,
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
                    ? "border-[color:var(--nova-border-strong)] bg-[rgba(178,190,181,0.12)] text-[color:var(--nova-text)] shadow-[0_0_24px_rgba(83,104,120,0.12)]"
                    : "border-[color:var(--nova-border)] nova-card-inner text-[color:var(--nova-text-soft)] hover:text-[color:var(--nova-text-soft)]"
                }`}
              >
                {timeframe} Arena
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-[color:var(--nova-text-soft)]">
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
                )} disabled:cursor-not-allowed disabled:border-[color:rgba(83,104,120,0.14)] disabled:nova-card-inner disabled:text-[color:var(--nova-text-muted)]`}
              >
                {vote}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-[color:var(--nova-text-soft)]">
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
            className="mt-4 rounded-full border border-[color:var(--nova-border-strong)] bg-[rgba(178,190,181,0.12)] px-4 py-2 text-xs font-medium text-[color:var(--nova-text)] transition hover:bg-[rgba(83,104,120,0.16)] disabled:cursor-not-allowed disabled:border-[color:rgba(83,104,120,0.14)] disabled:nova-card-inner disabled:text-[color:var(--nova-text-muted)]"
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
            <p className="mt-3 text-xs text-[color:var(--nova-text-muted)]">No local votes yet.</p>
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
            <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--nova-text-muted)]">
              {publishedCurrentEntry ? "Published stance" : "Current model lean"}
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--nova-text)]">
              {publishedCurrentEntry?.aiPublishedStance || novaStance.stance}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-[color:var(--nova-text-soft)]">
              {publishedCurrentEntry
                ? "Local lock recorded after the UTC close."
                : "Indicative, not locked."}
            </p>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-[color:var(--nova-text-soft)]">
            {novaStance.reason}
          </p>
        </div>

        <div className={terminalSurfaceClass + " p-5"}>
          <ArenaSectionTitle title="Latest Result" />
          <div className="mt-4 rounded-2xl nova-card-inner p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--nova-text-muted)]">
              Settlement
            </p>
            <p className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[color:var(--nova-text)]">
              {latestResolvedEntry?.winner
                ? `Latest winner: ${latestResolvedEntry.winner}`
                : "Awaiting first settlement."}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-[color:var(--nova-text-soft)]">
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
  if (!active) return "border-[color:var(--nova-border)] nova-card-inner text-[color:var(--nova-text-soft)] hover:text-[color:var(--nova-text)]";
  return `${arenaPublishedSurfaceClass(vote)} shadow-[0_0_26px_rgba(83,104,120,0.12)]`;
}

function arenaPublishedSurfaceClass(stance: NovaArenaStance | ArenaVote) {
  if (stance === "Bullish") {
    return "border-[color:var(--nova-border-strong)] bg-[rgba(83,104,120,0.1)] text-[color:var(--nova-text)]";
  }
  if (stance === "Bearish") {
      return "border-[color:var(--nova-border)] nova-card-inner text-[color:var(--nova-warning)]";
  }
  return "border-[color:var(--nova-border)] bg-[rgba(94,114,107,0.1)] text-[color:var(--nova-accent-soft)]";
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
      <p className={tone === "error" ? "text-sm text-[color:var(--nova-danger)]" : "text-sm text-[color:var(--nova-text-soft)]"}>
        {children}
      </p>
    </div>
  );
}

function ArenaSectionTitle({ title }: { title: string }) {
  return (
    <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--nova-text-muted)]">
      {title}
    </p>
  );
}

function ArenaFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl nova-card-inner p-3">
      <p className="text-xs text-[color:var(--nova-text-muted)]">{label}</p>
      <p className="mt-1 text-sm font-medium text-[color:var(--nova-text-soft)]">{value}</p>
    </div>
  );
}

function ArenaChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full nova-card-inner px-3 py-1 text-xs font-medium text-[color:var(--nova-text-soft)]">
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
      <p className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-[color:var(--nova-text)]">
        {timeRemainingLabel}
      </p>
      <div className="mt-4 h-2 overflow-hidden rounded-full nova-card-inner">
        <div
          className="h-full rounded-full bg-[rgba(83,104,120,0.65)] shadow-[0_0_18px_rgba(83,104,120,0.24)] transition-all"
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
        <span className="font-medium text-[color:var(--nova-text-soft)]">{label}</span>
        <span className="font-mono text-[color:var(--nova-text-soft)]">{percent}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full nova-card-inner">
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
    return "bg-[rgba(83,104,120,0.70)] shadow-[0_0_16px_rgba(83,104,120,0.2)]";
  }
  if (vote === "Bearish") {
    return "bg-[rgba(83,104,120,0.52)] shadow-[0_0_16px_rgba(83,104,120,0.16)]";
  }
  return "bg-[rgba(127,144,150,0.58)] shadow-[0_0_16px_rgba(83,104,120,0.16)]";
}

function WalletFlowsMvpSection({
  behaviorPreview,
  behaviorPreviewError,
  behaviorPreviewState,
  conviction,
  convictionError,
  convictionLoadState,
  holderIntelligenceMatrix,
  holderIntelligenceSummary,
  holderError,
  holderLoadState,
  novaConviction,
  personalityError,
  tokenData,
  tokenIntelligence,
  unifiedAnalysis,
  walletRows,
}: {
  behaviorPreview: WalletBehaviorPreviewData | null;
  behaviorPreviewError: string;
  behaviorPreviewState: HolderLoadState;
  conviction: ExplainableConvictionData | null;
  convictionError: string;
  convictionLoadState: HolderLoadState;
  holderIntelligenceMatrix: HolderIntelligenceProfile[];
  holderIntelligenceSummary: HolderIntelligenceSummary | null;
  holderError: string;
  holderLoadState: HolderLoadState;
  novaConviction: NovaConvictionResult | null;
  personalityError: string;
  tokenData: TokenResult;
  tokenIntelligence: TokenIntelligenceData | null;
  unifiedAnalysis: UnifiedTokenAnalysisData | null;
  walletRows: WalletRow[];
}) {
  const behaviorModel = buildHolderBehaviorModel({
    behaviorPreview,
    conviction,
    holderIntelligenceMatrix,
    holderIntelligenceSummary,
    novaConviction,
    tokenIntelligence,
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
      <HolderBehaviorStateCard
        title="Select a token to inspect holder behavior."
        detail="Holder Behavior Intelligence appears after analyzed holder evidence is available for the selected token."
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1680px] space-y-3">
      <TerminalSectionHeader
        badge="Holder Behavior Intelligence"
        subtitle="Behavioral intelligence derived from analyzed holders. Nova evaluates wallet quality, discipline, ownership structure and conviction patterns."
        title="Wallet Flows"
      >
        <div className="grid gap-2 rounded-2xl nova-card-inner p-3 text-xs text-[color:var(--nova-text-muted)] sm:grid-cols-3 lg:min-w-[420px]">
          <BehaviorTinyFact label="Token" value={cleanTokenSymbol(tokenData.symbol)} />
          <BehaviorTinyFact label="Chain" value={chainLabel(tokenData.chain)} />
          <BehaviorTinyFact
            label="Analyzed Holders"
            value={behaviorModel.analyzedHolders || "Pending"}
          />
        </div>
      </TerminalSectionHeader>

      {(providerLimitReached || behaviorModel.hasPartialInput) && (
        <div className="grid gap-3 lg:grid-cols-3">
          {providerLimitReached && (
            <HolderBehaviorNotice
              title="Provider limit reached"
              detail="One or more providers reported a limit or rate restriction. The page is using the partial state already loaded."
              tone="warning"
            />
          )}
          {behaviorModel.hasPartialInput && (
            <HolderBehaviorNotice
              title="Partial input"
              detail="Some wallet sources are missing or incomplete, so confidence and labels are conservative."
            />
          )}
        </div>
      )}

      {isLoading && walletRows.length === 0 && !conviction && (
        <HolderBehaviorStateCard
          title="Loading holder behavior inputs."
          detail="NovaOS is waiting for holder rows, wallet profiles and conviction evidence already requested for this token."
          pulse
        />
      )}

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {behaviorModel.primaryScores.map((score) => (
          <BehaviorScoreCard key={score.label} score={score} />
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-[1fr_1fr_1.05fr]">
        <BehaviorProfilePanel metrics={behaviorModel.profileMetrics} />
        <BehaviorDistributionPanel rows={behaviorModel.distributionRows} />
        <section className="grid gap-3">
          <DominantBehaviorCard model={behaviorModel} />
          <BehaviorSummaryCard summary={behaviorModel.summary} />
        </section>
      </div>

      <TopConvictionContributorsTable contributors={behaviorModel.contributors} />
    </div>
  );
}

type HolderBehaviorScore = {
  detail: string;
  label: string;
  value: number | null;
};

type HolderBehaviorMetric = {
  label: string;
  value: number | null;
};

type HolderBehaviorContributor = {
  address: string;
  behaviorLabel: string;
  contribution: number;
  displayAddress: string;
  note: string;
  quality: number;
};

type HolderBehaviorModel = {
  analyzedHolders: number | null;
  contributors: HolderBehaviorContributor[];
  distributionRows: HolderBehaviorMetric[];
  dominantBehavior: string;
  hasPartialInput: boolean;
  primaryScores: HolderBehaviorScore[];
  profileMetrics: HolderBehaviorMetric[];
  summary: string;
};

function buildHolderBehaviorModel({
  behaviorPreview,
  conviction,
  holderIntelligenceMatrix,
  holderIntelligenceSummary,
  novaConviction,
  tokenIntelligence,
  walletRows,
}: {
  behaviorPreview: WalletBehaviorPreviewData | null;
  conviction: ExplainableConvictionData | null;
  holderIntelligenceMatrix: HolderIntelligenceProfile[];
  holderIntelligenceSummary: HolderIntelligenceSummary | null;
  novaConviction: NovaConvictionResult | null;
  tokenIntelligence: TokenIntelligenceData | null;
  walletRows: WalletRow[];
}): HolderBehaviorModel {
  const holderAlpha = readRecord(novaConviction?.moduleSummaries?.holderAlpha);
  const topWallets = readRecordArray(holderAlpha?.topWalletsByAlphaV3);
  const bottomWallets = readRecordArray(holderAlpha?.bottomWalletsByAlphaV3);
  const holderWallets = [...topWallets, ...bottomWallets];
  const analyzedHolders =
    holderIntelligenceSummary?.analyzedHolders ||
    numberField(holderAlpha, "analyzedWalletCount") ||
    tokenIntelligence?.analyzedWallets ||
    walletRows.length ||
    null;
  const holderQuality =
    novaConviction?.scores.holderAlpha ??
    numberField(holderAlpha, "score") ??
    holderIntelligenceSummary?.averageHolderScore ??
    tokenIntelligence?.scores.holderQualityScore ??
    null;
  const entryDiscipline = averageRecordNumbers(holderWallets, "entryDisciplineV3");
  const exitDiscipline = averageRecordNumbers(holderWallets, "exitDisciplineV3");
  const consistency = averageRecordNumbers(holderWallets, "consistencyV3");
  const rotationQuality = averageRecordNumbers(holderWallets, "rotationQualityV3");
  const behaviorConfidence =
    numberField(holderAlpha, "confidenceScore") ??
    holderIntelligenceSummary?.averageConfidence ??
    conviction?.dataConfidence.score ??
    null;
  const contributors = buildHolderBehaviorContributors({
    holderWallets,
  });
  const profileMetrics = buildHolderBehaviorProfileMetrics({
    contributors,
    holderAlpha,
    holderIntelligenceMatrix,
  });
  const distributionRows = buildHolderBehaviorDistribution(profileMetrics);
  const dominantBehavior = deriveHolderDominantBehavior(distributionRows);

  return {
    analyzedHolders,
    contributors,
    distributionRows,
    dominantBehavior,
    hasPartialInput:
      Boolean(conviction?.mapperWarnings.length) ||
      Boolean(conviction?.warnings.length) ||
      Boolean(behaviorPreview?.summary.unavailableProfiles),
    primaryScores: [
      {
        detail: "Measures overall quality of analyzed holders.",
        label: "Holder Quality",
        value: holderQuality,
      },
      {
        detail: "How intelligently holders entered positions.",
        label: "Entry Discipline",
        value: entryDiscipline,
      },
      {
        detail: "How intelligently holders realize profits.",
        label: "Exit Discipline",
        value: exitDiscipline,
      },
      {
        detail: "Measures excessive rotation versus conviction.",
        label: "Rotation Quality",
        value: rotationQuality,
      },
      {
        detail: "Behavior stability across wallets.",
        label: "Consistency",
        value: consistency,
      },
      {
        detail: "Confidence in behavioral observations.",
        label: "Behavior Confidence",
        value: behaviorConfidence,
      },
    ],
    profileMetrics,
    summary: buildHolderBehaviorSummary({
      consistency,
      dominantBehavior,
      holderQuality,
      profileMetrics,
      rotationQuality,
    }),
  };
}

function averageRecordNumbers(rows: Array<Record<string, unknown>>, key: string) {
  const values = rows
    .map((row) => numberField(row, key))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!values.length) return null;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function buildHolderBehaviorContributors({
  holderWallets,
}: {
  holderWallets: Array<Record<string, unknown>>;
}) {
  return holderWallets
    .map((wallet) => {
      const address = String(wallet.wallet || "");
      const walletAlphaScore = numberField(wallet, "walletAlphaScore");
      const ownershipPercent = numberField(wallet, "ownershipPercent");
      if (!address || walletAlphaScore === null || ownershipPercent === null) {
        return null;
      }

      return {
        address,
        behaviorLabel: holderAlphaBehaviorLabel(walletAlphaScore),
        contribution: ((walletAlphaScore - 50) * ownershipPercent) / 10,
        displayAddress: shortInsiderWalletAddress(address),
        note: holderAlphaContributorNote(wallet),
        quality: walletAlphaScore,
      };
    })
    .filter((row): row is HolderBehaviorContributor => Boolean(row))
    .sort((left, right) => Math.abs(right.contribution) - Math.abs(left.contribution))
    .slice(0, 10);
}

function holderAlphaBehaviorLabel(score: number) {
  if (score >= 70) return "Conviction Holder";
  if (score >= 60) return "Strong Holder";
  if (score >= 50) return "Neutral Holder";
  if (score >= 40) return "Weak Holder";
  return "High Risk Holder";
}

function holderAlphaContributorNote(wallet: Record<string, unknown>) {
  if (wallet.isFallback === true) return "Fallback";
  if (wallet.analysisDepth === "deep") return "Deep analysis";
  return "Light analysis";
}

function buildHolderBehaviorProfileMetrics({
  contributors,
  holderAlpha,
  holderIntelligenceMatrix,
}: {
  contributors: HolderBehaviorContributor[];
  holderAlpha: Record<string, unknown> | null;
  holderIntelligenceMatrix: HolderIntelligenceProfile[];
}): HolderBehaviorMetric[] {
  const total = holderIntelligenceMatrix.length || contributors.length;
  const percentFromCount = (count: number) =>
    total ? Math.round((count / total) * 100) : null;
  const countByLabel = (labels: string[]) =>
    contributors.filter((contributor) => labels.includes(contributor.behaviorLabel)).length;

  return [
    {
      label: "Conviction Holders",
      value:
        numberField(holderAlpha, "goodOrBetterOwnershipPercent") ??
        percentFromCount(countByLabel(["Conviction Holder"])),
    },
    {
      label: "Weak Holders",
      value:
        numberField(holderAlpha, "weakOrToxicOwnershipPercent") ??
        percentFromCount(countByLabel(["Weak Holder"])),
    },
    {
      label: "Smart Holders",
      value:
        numberField(holderAlpha, "smartLikeOwnershipPercent") ??
        percentFromCount(countByLabel(["Smart Holder"])),
    },
    {
      label: "Fresh Wallets",
      value:
        numberField(holderAlpha, "freshLikeOwnershipPercent") ??
        percentFromCount(
          holderIntelligenceMatrix.filter((holder) =>
            holder.holderClass === "Fresh High-Ownership Wallet"
          ).length
        ),
    },
    {
      label: "Legacy Wallets",
      value: percentFromCount(
        holderIntelligenceMatrix.filter((holder) =>
          ["Core Conviction Holder", "Dormant Holder", "Concentrated Whale"].includes(holder.holderClass)
        ).length
      ),
    },
  ].filter((metric) => metric.value !== null);
}

function buildHolderBehaviorDistribution(profileMetrics: HolderBehaviorMetric[]) {
  const metricValue = (label: string) =>
    profileMetrics.find((metric) => metric.label === label)?.value ?? null;
  const conviction = metricValue("Conviction Holders");
  const smart = metricValue("Smart Holders");
  const weak = metricValue("Weak Holders");
  const fresh = metricValue("Fresh Wallets");
  const speculative =
    typeof fresh === "number" && typeof weak === "number"
      ? Math.max(0, Math.min(100, Math.round((fresh + weak) * 0.35)))
      : null;
  const known = [conviction, smart, weak, speculative].reduce<number>(
    (total, value) => total + (typeof value === "number" ? value : 0),
    0
  );
  const neutral = Math.max(0, Math.min(100, 100 - known));

  return [
    { label: "Conviction", value: conviction },
    { label: "Smart", value: smart },
    { label: "Neutral", value: Number.isFinite(neutral) ? neutral : null },
    { label: "Weak", value: weak },
    { label: "Speculative", value: speculative },
  ].filter((metric) => metric.value !== null);
}

function deriveHolderDominantBehavior(rows: HolderBehaviorMetric[]) {
  const sorted = [...rows]
    .filter((row) => typeof row.value === "number")
    .sort((left, right) => (right.value ?? 0) - (left.value ?? 0));
  const dominant = sorted[0];
  if (!dominant) return "Mixed Holder Base";
  if (dominant.label === "Conviction") return "Conviction Dominated";
  if (dominant.label === "Weak") return "Weak Holder Dominated";
  if (dominant.label === "Speculative") return "Speculative Rotation";
  if (dominant.label === "Smart") return "Smart Money Presence";
  return "Mixed Holder Base";
}

function buildHolderBehaviorSummary({
  consistency,
  dominantBehavior,
  holderQuality,
  profileMetrics,
  rotationQuality,
}: {
  consistency: number | null;
  dominantBehavior: string;
  holderQuality: number | null;
  profileMetrics: HolderBehaviorMetric[];
  rotationQuality: number | null;
}) {
  const weak = profileMetrics.find((metric) => metric.label === "Weak Holders")?.value;
  const conviction = profileMetrics.find((metric) => metric.label === "Conviction Holders")?.value;
  const qualityText =
    typeof holderQuality === "number" && holderQuality >= 60
      ? "Holder quality is supportive"
      : "Wallet quality remains the primary limiter of conviction";
  const consistencyText =
    typeof consistency === "number" && consistency >= 55
      ? "behavior is relatively stable"
      : "behavior stability remains limited";
  const rotationText =
    typeof rotationQuality === "number" && rotationQuality >= 55
      ? "rotation quality is acceptable"
      : "rotation behavior remains elevated";

  return `${dominantBehavior}. ${qualityText}; ${consistencyText} and ${rotationText}. Conviction holders represent ${formatPercentValue(conviction)} while weak holders represent ${formatPercentValue(weak)} of observed behavior.`;
}

function BehaviorScoreCard({ score }: { score: HolderBehaviorScore }) {
  return (
    <div className="min-h-[132px] rounded-2xl nova-card-inner p-4">
      <p className="text-3xl font-semibold tracking-[-0.06em] text-[color:var(--nova-text)]">
        {formatNullableScore(score.value)}
      </p>
      <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-[color:var(--nova-text-soft)]">
        {score.label}
      </p>
      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[color:var(--nova-text-muted)]">
        {score.detail}
      </p>
    </div>
  );
}

function BehaviorProfilePanel({ metrics }: { metrics: HolderBehaviorMetric[] }) {
  return (
    <BehaviorPanel title="Behavior Profile">
      <div className="space-y-3">
        {metrics.map((metric) => (
          <BehaviorBarRow key={metric.label} metric={metric} />
        ))}
      </div>
    </BehaviorPanel>
  );
}

function BehaviorDistributionPanel({ rows }: { rows: HolderBehaviorMetric[] }) {
  return (
    <BehaviorPanel title="Behavior Distribution">
      <div className="space-y-3">
        {rows.map((metric) => (
          <BehaviorBarRow key={metric.label} metric={metric} />
        ))}
      </div>
    </BehaviorPanel>
  );
}

function BehaviorPanel({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-[2rem] nova-card-inner p-4">
      <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--nova-accent-soft)]">
        {title}
      </p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function BehaviorBarRow({ metric }: { metric: HolderBehaviorMetric }) {
  const value =
    typeof metric.value === "number" && Number.isFinite(metric.value)
      ? Math.max(0, Math.min(100, metric.value))
      : null;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-[color:var(--nova-text-soft)]">{metric.label}</span>
        <span className="font-mono text-[color:var(--nova-text-soft)]">
          {value === null ? "N/A" : `${Math.round(value)}%`}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full nova-card-inner">
        <div
          className="h-full rounded-full bg-[rgba(127,144,150,0.68)] shadow-[0_0_12px_rgba(83,104,120,0.18)]"
          style={{ width: `${value ?? 0}%` }}
        />
      </div>
    </div>
  );
}

function DominantBehaviorCard({ model }: { model: HolderBehaviorModel }) {
  return (
    <section className="rounded-[2rem] nova-card-inner p-4">
      <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--nova-accent-soft)]">
        Dominant Behavior
      </p>
      <p className="mt-4 text-2xl font-semibold tracking-[-0.055em] text-[color:var(--nova-text)]">
        {model.dominantBehavior}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-[color:var(--nova-text-muted)]">
        Derived from analyzed holder classes and contribution quality.
      </p>
    </section>
  );
}

function BehaviorSummaryCard({ summary }: { summary: string }) {
  return (
    <section className="rounded-[2rem] nova-card-inner p-4">
      <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--nova-accent-soft)]">
        Behavior Summary
      </p>
      <p className="mt-4 text-sm leading-relaxed text-[color:var(--nova-text-soft)]">
        {summary}
      </p>
    </section>
  );
}

function TopConvictionContributorsTable({
  contributors,
}: {
  contributors: HolderBehaviorContributor[];
}) {
  const gridClass =
    "grid-cols-[minmax(170px,1.2fr)_minmax(150px,0.9fr)_minmax(110px,0.65fr)_minmax(90px,0.55fr)_minmax(220px,1.35fr)]";

  return (
    <section className="overflow-hidden rounded-[2rem] nova-card-inner backdrop-blur-2xl">
      <div className="flex flex-col gap-2 border-b border-[color:var(--nova-border)] p-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--nova-accent-soft)]">
            Top Conviction Contributors
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.045em] text-[color:var(--nova-text)]">
            Holders contributing most to the final conviction reading.
          </h2>
        </div>
        <p className="text-xs text-[color:var(--nova-text-muted)]">
          Top {contributors.length || 0}
        </p>
      </div>

      {contributors.length === 0 ? (
        <HolderBehaviorStateCard
          title="No holder contributors loaded."
          detail="Contributor rows appear after holder behavior evidence is available for the selected token."
        />
      ) : (
        <div className="overflow-x-auto">
          <div className={`grid min-w-[920px] ${gridClass} gap-3 ${terminalTableHeaderClass}`}>
            <span>Wallet</span>
            <span>Behavior Label</span>
            <span className="text-center">Contribution</span>
            <span className="text-center">Quality</span>
            <span>Notes</span>
          </div>
          <div>
            {contributors.map((contributor) => (
              <div
                key={contributor.address || contributor.displayAddress}
                className={`grid min-h-[52px] min-w-[920px] ${gridClass} items-center gap-3 ${terminalRowClass}`}
              >
                <p className="truncate font-mono text-[color:var(--nova-text-soft)]">
                  {contributor.displayAddress}
                </p>
                <span className="truncate text-[color:var(--nova-text-soft)]">
                  {contributor.behaviorLabel}
                </span>
                <span
                  className={`text-center font-mono text-sm tabular-nums ${
                    contributor.contribution >= 0
                      ? "text-[color:var(--nova-success)]"
                      : "text-[color:var(--nova-warning)]"
                  }`}
                >
                  {formatContribution(contributor.contribution)}
                </span>
                <span className="text-center font-mono text-sm tabular-nums text-[color:var(--nova-text-soft)]">
                  {formatNullableScore(contributor.quality)}
                </span>
                <p className="truncate text-xs text-[color:var(--nova-text-muted)]">
                  {contributor.note}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function HolderBehaviorNotice({
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
          ? "border-[color:var(--nova-border)] bg-[rgba(83,104,120,0.065)]"
          : "border-[color:var(--nova-border)] nova-card-inner"
      }`}
    >
      <p className="text-sm font-medium text-[color:var(--nova-text)]">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-[color:var(--nova-text-muted)]">{detail}</p>
    </div>
  );
}

function HolderBehaviorStateCard({
  detail,
  pulse = false,
  title,
}: {
  detail: string;
  pulse?: boolean;
  title: string;
}) {
  return <TerminalStatePanel detail={detail} pulse={pulse} title={title} />;
}

function BehaviorTinyFact({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-xl nova-card-inner px-3 py-2">
      <p className="text-[9px] uppercase tracking-[0.14em] text-[color:var(--nova-text-muted)]">{label}</p>
      <p className="mt-1 truncate text-xs font-medium text-[color:var(--nova-text-soft)]">{value}</p>
    </div>
  );
}

function formatNullableScore(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? String(Math.round(value))
    : "N/A";
}

function formatPercentValue(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${Math.round(value)}%`
    : "N/A";
}

function formatContribution(value: number) {
  const rounded = Number(value.toFixed(1));
  return rounded > 0 ? `+${rounded}` : String(rounded);
}

function cleanTokenSymbol(value: string) {
  return value.replace(/^\$/, "") || "N/A";
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
  conviction,
  convictionError,
  convictionLoadState,
  holderError,
  holderLoadState,
  novaConviction,
  token,
  tokenData,
  walletRows,
}: {
  conviction: ExplainableConvictionData | null;
  convictionError: string;
  convictionLoadState: HolderLoadState;
  holderError: string;
  holderLoadState: HolderLoadState;
  novaConviction: NovaConvictionResult | null;
  token: string;
  tokenData: TokenResult;
  walletRows: WalletRow[];
}) {
  const moduleSummaries = readRecord(novaConviction?.moduleSummaries);
  const riskStats = readRecord(moduleSummaries?.riskStats);
  const riskPressure = readRecord(moduleSummaries?.riskPressure);
  const riskSubScores = readRecord(riskPressure?.subScores);
  const holderAlpha = readRecord(moduleSummaries?.holderAlpha);
  const holderAlphaDepth =
    readRecord(novaConviction?.holderAlphaDepth) ??
    readRecord(holderAlpha?.holderAlphaDepth);
  const holderRowsV3 = buildInsiderHolderRows(novaConviction, walletRows);
  const riskGroups = buildInsiderRiskGroups({
    holderAlpha,
    riskStats,
  });
  const hasNovaRiskData = Boolean(novaConviction || riskStats || riskPressure || holderAlpha);
  const riskModel = buildInsiderRiskModel({
    novaConviction,
    riskPressure,
    riskStats,
  });
  const isLoading =
    convictionLoadState === "loading" || holderLoadState === "loading";
  const hasToken = Boolean(tokenData.tokenAddress);
  const hasRiskData = hasNovaRiskData || Boolean(conviction);
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
        eyebrow="Insider Scan"
        subtitle="Loaded holder, ownership, and GMGN risk evidence summarized into structural risk signals."
        title="Structural Holder Intelligence"
      >
        <div className="flex items-center gap-3 self-center rounded-2xl nova-card-inner px-4 py-3 lg:min-w-[330px]">
          <TokenAvatar
            logoUrl={resolveTokenLogo(tokenData)}
            sizeClass="h-12 w-12"
            token={token}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-sm font-medium text-[color:var(--nova-text)]">
                ${cleanTokenSymbol(tokenData.symbol || token)}
              </p>
              <span className="rounded-full nova-card-inner px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[color:var(--nova-text-soft)]">
                {formatInsiderMode(novaConviction?.analysisMode ?? String(holderAlpha?.analysisMode || ""))}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-[color:var(--nova-text-muted)]">
              <span>Chain: {chainLabel(tokenData.chain)}</span>
              <span>
                Analyzed:{" "}
                {formatInsiderCount(
                  numberField(holderAlphaDepth, "analyzedWalletCount") ??
                    numberField(holderAlpha, "analyzedWalletCount")
                )}
              </span>
            </div>
          </div>
        </div>
      </TerminalSectionHeader>

      {isPartial && (
        <div className="rounded-2xl border border-[color:var(--nova-border)] bg-[rgba(83,104,120,0.065)] px-4 py-3 text-xs leading-relaxed text-[color:var(--nova-warning)]">
          Provider limit reached or live data unavailable. Cached or partial
          analysis may be shown.
        </div>
      )}

      {!hasNovaRiskData ? (
        <InsiderScanEmptyState
          title="Insider Scan requires loaded evidence."
          detail="Analyze this token successfully to surface structural holder and risk pressure intelligence."
        />
      ) : (
        <>
          <InsiderV3RiskPanel model={riskModel} />

          <section>
            <ForensicSectionHeading
              eyebrow="Evidence Review"
              title="Loaded Evidence"
              description="A compact read of concentration, tagged risk, and holder quality."
            />
            <div className="mt-3 grid gap-3 xl:grid-cols-3">
              {buildInsiderEvidenceCards({
                holderAlpha,
                riskStats,
                riskSubScores,
              }).map((card) => (
                <InsiderEvidenceCard
                  key={card.label}
                  label={card.label}
                  rows={card.rows}
                />
              ))}
            </div>
          </section>

          <InsiderRiskGroupGrid groups={riskGroups} />
        </>
      )}

      <InsiderHolderDepthStats
        holderAlpha={holderAlpha}
        holderAlphaDepth={holderAlphaDepth}
      />

      <InsiderV3HolderTable
        error={holderError}
        loadState={holderLoadState}
        rows={holderRowsV3}
      />
    </div>
  );
}

type InsiderRiskMetric = {
  barValue: number | null;
  label: string;
  value: string;
};

type InsiderRiskModel = {
  cleanBadges: string[];
  label: string;
  metrics: InsiderRiskMetric[];
  score: number | null;
};

type InsiderEvidenceModel = {
  label: string;
  rows: string[];
};

type InsiderRiskGroupModel = {
  exposure: string;
  level: string;
  text: string;
  title: string;
};

type InsiderHolderRowV3 = {
  analysisType: string;
  behaviorLabel: string;
  confidenceLevel: string;
  explanations: string[];
  labels: string[];
  rank: number | null;
  rawWallet: Record<string, unknown>;
  rawMetrics: Record<string, unknown> | null;
  score: number | null;
  usdValue: number | null;
  wallet: string;
  ownershipPercent: number | null;
};

type InsiderWalletScoreMetric = {
  barValue: number | null;
  label: string;
  value: string;
};

function buildInsiderRiskModel({
  novaConviction,
  riskPressure,
  riskStats,
}: {
  novaConviction: NovaConvictionResult | null;
  riskPressure: Record<string, unknown> | null;
  riskStats: Record<string, unknown> | null;
}): InsiderRiskModel {
  const score =
    numberField(riskPressure, "structuralRiskScore") ??
    numberField(riskPressure, "riskPressureScore") ??
    novaConviction?.risk.riskScore ??
    null;
  const insiderPercentage = numberField(riskStats, "insiderPercentage");
  const insiderWalletCount = numberField(riskStats, "insiderWalletCount");
  const bundlerPercentage = numberField(riskStats, "bundlerPercentage");
  const bundlerWalletCount = numberField(riskStats, "bundlerWalletCount");
  const top70SniperHoldPercentage = numberField(riskStats, "top70SniperHoldPercentage");
  const sniperWalletCount = numberField(riskStats, "sniperWalletCount");
  const freshWalletPercentage = numberField(riskStats, "freshWalletPercentage");
  const phishingPercentage = numberField(riskStats, "phishingPercentage");
  const top10HolderPercentage = numberField(riskStats, "top10HolderPercentage");
  const holderCount = numberField(riskStats, "holderCount");
  const devCreatorHold = maxFinite([
    numberField(riskStats, "devTeamHoldPercentage"),
    numberField(riskStats, "creatorHoldPercentage"),
    numberField(riskStats, "privateVaultHoldPercentage"),
  ]);
  const metrics: InsiderRiskMetric[] = [];

  if (positiveEvidence(insiderPercentage) || positiveEvidence(insiderWalletCount)) {
    metrics.push(percentRiskMetric("Insider Exposure", insiderPercentage));
  }
  if (positiveEvidence(bundlerPercentage) || positiveEvidence(bundlerWalletCount)) {
    metrics.push(percentRiskMetric("Bundler Exposure", bundlerPercentage));
  }
  if (positiveEvidence(top70SniperHoldPercentage) || positiveEvidence(sniperWalletCount)) {
    metrics.push(percentRiskMetric("Sniper Exposure", top70SniperHoldPercentage));
  }
  if (positiveEvidence(freshWalletPercentage)) {
    metrics.push(percentRiskMetric("Fresh Wallet Exposure", freshWalletPercentage));
  }
  if (positiveEvidence(phishingPercentage)) {
    metrics.push(percentRiskMetric("Phishing Exposure", phishingPercentage));
  }
  if (top10HolderPercentage !== null) {
    metrics.push(percentRiskMetric("Top 10 Concentration", top10HolderPercentage));
  }
  if (positiveEvidence(devCreatorHold)) {
    metrics.push(percentRiskMetric("Dev/Creator Hold", devCreatorHold));
  }
  if (holderCount !== null) {
    metrics.push(countRiskMetric("Holder Count", holderCount));
  }

  return {
    cleanBadges:
      insiderPercentage === 0 && (insiderWalletCount === 0 || insiderWalletCount === null)
        ? ["No insider exposure detected"]
        : [],
    label: structuralRiskLabel(score),
    metrics,
    score,
  };
}

function InsiderV3RiskPanel({ model }: { model: InsiderRiskModel }) {
  return (
    <section className={`rounded-[2rem] p-5 ${terminalGlassCardClass}`}>
      <div className="grid gap-5 xl:grid-cols-[0.72fr_1.28fr] xl:items-start">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-[color:var(--nova-accent-soft)]">
            Structural Risk
          </p>
          <div className="mt-4 flex items-end gap-2">
            <p className="text-6xl font-light tracking-[-0.065em] text-[color:var(--nova-text)]">
              {formatInsiderScore(model.score)}
            </p>
            {model.score !== null && (
              <p className="pb-2 text-sm text-[color:var(--nova-text-muted)]">/100</p>
            )}
          </div>
          <p className="mt-3 text-lg font-medium text-[color:var(--nova-text-soft)]">
            {model.label}
          </p>
          {model.cleanBadges.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {model.cleanBadges.map((badge) => (
                <span
                  key={badge}
                  className="rounded-full nova-card-inner px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-[color:var(--nova-success)]"
                >
                  {badge}
                </span>
              ))}
            </div>
          )}
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[rgba(170,183,196,0.08)]">
            <div
              className="h-full rounded-full bg-[color:var(--nova-accent)] shadow-[0_0_18px_rgba(83,104,120,0.26)]"
              style={{ width: `${model.score === null ? 0 : normalizeScore(model.score)}%` }}
            />
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {model.metrics.map((metric) => (
            <InsiderRiskMetricBox key={metric.label} metric={metric} />
          ))}
        </div>
      </div>
    </section>
  );
}

function InsiderRiskMetricBox({ metric }: { metric: InsiderRiskMetric }) {
  return (
    <div className={`rounded-2xl p-3 ${terminalGlassCardClass}`}>
      <p className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--nova-text-muted)]">
        {metric.label}
      </p>
      <p className="mt-2 text-lg font-medium tabular-nums text-[color:var(--nova-text)]">
        {metric.value}
      </p>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-[rgba(170,183,196,0.08)]">
        <div
          className="h-full rounded-full bg-[rgba(170,183,196,0.58)]"
          style={{ width: `${metric.barValue === null ? 0 : normalizeScore(metric.barValue)}%` }}
        />
      </div>
    </div>
  );
}

function InsiderEvidenceCard({ label, rows }: InsiderEvidenceModel) {
  return (
    <div className={`min-h-[184px] rounded-2xl p-4 ${terminalGlassCardClass}`}>
      <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--nova-accent-soft)]">{label}</p>
      <div className="mt-4 space-y-2.5">
        {rows.map((row) => (
          <div key={row} className="flex gap-2 text-xs leading-relaxed text-[color:var(--nova-text-soft)]">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[rgba(170,183,196,0.36)]" />
            <span>{row}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InsiderRiskGroupGrid({ groups }: { groups: InsiderRiskGroupModel[] }) {
  return (
    <section>
      <ForensicSectionHeading
        eyebrow="Structural Tags"
        title="Detected Risk Groups"
        description="Risk groups are rendered only when currently loaded Nova evidence contains the corresponding signal."
      />
      <div className="mt-3 grid w-full auto-rows-fr gap-3 md:grid-cols-2 xl:grid-cols-3">
        {groups.length === 0 ? (
          <div className={`rounded-2xl p-4 text-sm text-[color:var(--nova-text-soft)] md:col-span-2 xl:col-span-3 ${terminalGlassCardClass}`}>
            No material risk groups detected from currently loaded evidence.
          </div>
        ) : (
          groups.map((group) => (
            <div
              key={group.title}
              className={`flex h-full min-h-[168px] flex-col rounded-2xl p-4 ${terminalGlassCardClass}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[color:var(--nova-text-soft)]">
                    {group.title}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--nova-text-muted)]">
                    {group.exposure}
                  </p>
                </div>
                <span className={`whitespace-nowrap rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.14em] ${riskGroupLevelClass(group.level)}`}>
                  {group.level}
                </span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-[color:var(--nova-text-soft)]">
                {group.text}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function InsiderHolderDepthStats({
  holderAlpha,
  holderAlphaDepth,
}: {
  holderAlpha: Record<string, unknown> | null;
  holderAlphaDepth: Record<string, unknown> | null;
}) {
  const stats = [
    {
      label: "Analyzed Holders",
      value:
        numberField(holderAlphaDepth, "analyzedWalletCount") ??
        numberField(holderAlpha, "analyzedWalletCount"),
    },
    {
      label: "Deep Analyzed",
      value:
        numberField(holderAlphaDepth, "deepAnalyzedWalletCount") ??
        numberField(holderAlpha, "deepAnalyzedWalletCount"),
    },
    {
      label: "Light Analyzed",
      value:
        numberField(holderAlphaDepth, "lightAnalyzedWalletCount") ??
        numberField(holderAlpha, "lightAnalyzedWalletCount"),
    },
  ];

  return (
    <div className="grid gap-2 md:grid-cols-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={`rounded-2xl p-3 ${terminalGlassCardClass}`}
        >
          <p className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--nova-text-muted)]">
            {stat.label}
          </p>
          <p className="mt-2 text-xl font-medium tabular-nums text-[color:var(--nova-text)]">
            {formatInsiderCount(stat.value)}
          </p>
        </div>
      ))}
    </div>
  );
}

function InsiderV3HolderTable({
  error,
  loadState,
  rows,
}: {
  error: string;
  loadState: HolderLoadState;
  rows: InsiderHolderRowV3[];
}) {
  const [expandedWallet, setExpandedWallet] = useState("");
  const isLoading = loadState === "loading";
  const isError = loadState === "error";
  const isIdle = loadState === "idle";
  const isEmptyLoaded = loadState === "loaded" && rows.length === 0;
  const gridClass =
    "grid-cols-[64px_minmax(180px,1.25fr)_120px_150px_170px_110px]";

  return (
    <section className={`rounded-[2rem] p-5 ${terminalGlassCardClass}`}>
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--nova-accent-soft)]">
            Holder Intelligence
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-[color:var(--nova-text)]">
            Top Holder Intelligence
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[color:var(--nova-text-muted)]">
            Analyzed holders ranked by ownership, wallet quality, and behavioral intelligence.
          </p>
        </div>
        <span className="self-start rounded-full nova-card-inner px-3 py-1 text-xs text-[color:var(--nova-accent-soft)] sm:self-auto">
          {rows.length} loaded
        </span>
      </div>

      <div className={`w-full overflow-x-auto rounded-[1.4rem] ${terminalGlassCardClass}`}>
        <div className={`grid min-h-[42px] w-full min-w-[980px] ${gridClass} items-center gap-3 ${terminalTableHeaderClass}`}>
          <span>Rank</span>
          <span>Wallet</span>
          <span className="text-center">Ownership</span>
          <span className="text-center">Wallet Score</span>
          <span className="text-center">Behavior</span>
          <span className="text-center">Analysis</span>
        </div>

        <div className="w-full min-w-[980px]">
          {isIdle && (
            <HolderStateMessage
              title="Select a token to activate holder intelligence."
              detail="NovaOS will render analyzed holder intelligence once scan evidence is available."
            />
          )}

          {isLoading && <HolderTableSkeleton />}

          {isError && (
            <HolderStateMessage
              title="Holder intelligence could not be loaded."
              detail={error || "The loaded holder evidence returned an unexpected error."}
              tone="error"
            />
          )}

          {isEmptyLoaded && (
            <HolderStateMessage
              title="No analyzed holder wallets are available."
              detail="Holder intelligence will appear after analysis completes."
            />
          )}

          {rows.map((row) => (
            <div key={`${row.rank ?? "unranked"}-${row.wallet}`}>
              <button
                type="button"
                onClick={() =>
                  setExpandedWallet((current) =>
                    current === row.wallet ? "" : row.wallet
                  )
                }
                className={`grid min-h-[52px] w-full ${gridClass} items-center gap-3 text-left text-[13px] focus:outline-none focus:ring-1 focus:ring-inset focus:ring-[rgba(83,104,120,0.24)] ${terminalRowClass}`}
              >
                <span className="font-mono text-[color:var(--nova-text-muted)]">
                  {row.rank === null ? "N/A" : `#${row.rank}`}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-mono font-medium text-[color:var(--nova-text)]">
                    {shortInsiderWalletAddress(row.wallet)}
                  </p>
                </div>
                <span className="text-center font-medium tabular-nums text-[color:var(--nova-accent-soft)]">
                  {formatInsiderPercent(row.ownershipPercent)}
                </span>
                <div>
                  <p className="text-center font-medium tabular-nums text-[color:var(--nova-text)]">
                    {formatInsiderScore(row.score)}
                  </p>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[rgba(170,183,196,0.08)]">
                    <div
                      className="h-full rounded-full bg-[rgba(170,183,196,0.58)]"
                      style={{ width: `${row.score === null ? 0 : normalizeScore(row.score)}%` }}
                    />
                  </div>
                </div>
                <span className="truncate text-center text-[color:var(--nova-text-soft)]">
                  {row.behaviorLabel}
                </span>
                <span className="text-center text-[color:var(--nova-text-soft)]">
                  {row.analysisType}
                </span>
              </button>
              {expandedWallet === row.wallet && (
                <InsiderWalletExpandedPanel row={row} />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function InsiderWalletExpandedPanel({ row }: { row: InsiderHolderRowV3 }) {
  const scoreMetrics = buildInsiderWalletScoreMetrics(row);

  return (
    <div className="border-b border-[color:rgba(83,104,120,0.12)] bg-[rgba(8,37,51,0.16)] px-4 py-4">
      <div className={`rounded-2xl p-4 ${terminalGlassCardClass}`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="break-all font-mono text-xs text-[color:var(--nova-text)]">
              {row.wallet}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <InsiderMiniPill value="Wallet" />
              <InsiderMiniPill value={row.rank === null ? "Rank unavailable" : `#${row.rank}`} />
              <InsiderMiniPill value={formatInsiderPercent(row.ownershipPercent)} />
              <InsiderMiniPill value={`${row.analysisType} analysis`} />
              <InsiderMiniPill value={`${formatInsiderScore(row.score)} score`} />
              <InsiderMiniPill value={row.behaviorLabel} />
              <InsiderMiniPill value={row.confidenceLevel || "Unavailable"} />
            </div>
          </div>
        </div>

        {scoreMetrics.length > 0 && (
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {scoreMetrics.map((metric) => (
              <InsiderWalletScoreBar key={metric.label} metric={metric} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InsiderMiniPill({ value }: { value: string }) {
  return (
    <span className="rounded-full nova-card-inner px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-[color:var(--nova-text-soft)]">
      {value}
    </span>
  );
}

function InsiderWalletScoreBar({ metric }: { metric: InsiderWalletScoreMetric }) {
  return (
    <div className={`rounded-xl p-3 ${terminalGlassCardClass}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-[10px] uppercase tracking-[0.14em] text-[color:var(--nova-text-muted)]">
          {metric.label}
        </p>
        <p className="shrink-0 text-xs font-medium tabular-nums text-[color:var(--nova-text-soft)]">
          {metric.value}
        </p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[rgba(170,183,196,0.08)]">
        <div
          className="h-full rounded-full bg-[rgba(170,183,196,0.58)]"
          style={{ width: `${metric.barValue === null ? 0 : normalizeScore(metric.barValue)}%` }}
        />
      </div>
    </div>
  );
}

function buildInsiderEvidenceCards({
  holderAlpha,
  riskStats,
  riskSubScores,
}: {
  holderAlpha: Record<string, unknown> | null;
  riskStats: Record<string, unknown> | null;
  riskSubScores: Record<string, unknown> | null;
}): InsiderEvidenceModel[] {
  const top10HolderPercentage = numberField(riskStats, "top10HolderPercentage");
  const holderCount = numberField(riskStats, "holderCount");
  const analyzedOwnership = numberField(holderAlpha, "totalAnalyzedOwnershipPercent");
  const taggedRiskRows = [
    positiveEvidence(numberField(riskStats, "bundlerPercentage"))
      ? `Bundler exposure is ${formatInsiderPercent(numberField(riskStats, "bundlerPercentage"))}.`
      : null,
    positiveEvidence(numberField(riskStats, "phishingPercentage"))
      ? `Phishing exposure is ${formatInsiderPercent(numberField(riskStats, "phishingPercentage"))}.`
      : null,
    positiveEvidence(numberField(riskStats, "freshWalletPercentage"))
      ? `Fresh-wallet exposure is ${formatInsiderPercent(numberField(riskStats, "freshWalletPercentage"))}.`
      : null,
    positiveEvidence(numberField(riskStats, "top70SniperHoldPercentage"))
      ? `Sniper holder exposure is ${formatInsiderPercent(numberField(riskStats, "top70SniperHoldPercentage"))}.`
      : null,
  ].filter((row): row is string => Boolean(row));
  const weakOwnership = numberField(holderAlpha, "weakOrToxicOwnershipPercent");
  const goodOwnership = numberField(holderAlpha, "goodOrBetterOwnershipPercent");
  const weakHolderRiskScore = numberField(riskSubScores, "weakHolderRiskScore");

  return [
    {
      label: "Concentration",
      rows: [
        top10HolderPercentage !== null
          ? `Top 10 holders control ${formatInsiderPercent(top10HolderPercentage)} of supply.`
          : null,
        holderCount !== null && analyzedOwnership !== null
          ? `Nova analyzed ${formatInsiderCount(holderCount)} holders covering ${formatInsiderPercent(analyzedOwnership)} ownership.`
          : holderCount !== null
            ? `GMGN reports ${formatInsiderCount(holderCount)} holders.`
            : null,
      ].filter((row): row is string => Boolean(row)).slice(0, 2),
    },
    {
      label: "Tagged Risk",
      rows: taggedRiskRows.length ? taggedRiskRows.slice(0, 2) : ["No tagged exposure detected."],
    },
    {
      label: "Holder Quality",
      rows: [
        weakOwnership !== null && goodOwnership !== null
          ? `Weak/toxic ownership is ${formatInsiderPercent(weakOwnership)} vs ${formatInsiderPercent(goodOwnership)} good+ ownership.`
          : null,
        weakHolderRiskScore !== null
          ? `Weak holder pressure is ${formatInsiderScore(weakHolderRiskScore)}/100.`
          : null,
      ].filter((row): row is string => Boolean(row)).slice(0, 2),
    },
  ];
}

function buildInsiderRiskGroups({
  holderAlpha,
  riskStats,
}: {
  holderAlpha: Record<string, unknown> | null;
  riskStats: Record<string, unknown> | null;
}): InsiderRiskGroupModel[] {
  const groups: InsiderRiskGroupModel[] = [];
  const insiderPercentage = numberField(riskStats, "insiderPercentage");
  const insiderWalletCount = numberField(riskStats, "insiderWalletCount");
  const bundlerPercentage = numberField(riskStats, "bundlerPercentage");
  const bundlerWalletCount = numberField(riskStats, "bundlerWalletCount");
  const sniperWalletCount = numberField(riskStats, "sniperWalletCount");
  const top70SniperHoldPercentage = numberField(riskStats, "top70SniperHoldPercentage");
  const freshWalletPercentage = numberField(riskStats, "freshWalletPercentage");
  const freshWalletCount = numberField(riskStats, "freshWalletCount");
  const phishingPercentage = numberField(riskStats, "phishingPercentage");
  const weakOwnership = numberField(holderAlpha, "weakOrToxicOwnershipPercent");
  const goodOwnership = numberField(holderAlpha, "goodOrBetterOwnershipPercent");
  const hasSniperLikeHolder = [
    ...readRecordArray(holderAlpha?.allWalletsByHolderRank),
    ...readRecordArray(holderAlpha?.allWalletsByAlphaV3),
    ...readRecordArray(holderAlpha?.topWalletsByAlphaV3),
    ...readRecordArray(holderAlpha?.bottomWalletsByAlphaV3),
    ...readRecordArray(holderAlpha?.holders),
    ...readRecordArray(holderAlpha?.wallets),
    ...readRecordArray(holderAlpha?.holderResults),
  ].some((wallet) => wallet.isSniperLikeHolder === true);

  if (positiveEvidence(insiderPercentage)) {
    groups.push({
      exposure: `${formatInsiderPercent(insiderPercentage)} exposure · ${formatInsiderCount(insiderWalletCount)} wallets`,
      level: riskLevelFromPercent(insiderPercentage),
      text: "GMGN identifies insider-tagged holder exposure in the loaded token risk statistics.",
      title: "Insider Group",
    });
  }

  if (positiveEvidence(bundlerPercentage)) {
    groups.push({
      exposure: `${formatInsiderPercent(bundlerPercentage)} exposure · ${formatInsiderCount(bundlerWalletCount)} wallets`,
      level: riskLevelFromPercent(bundlerPercentage),
      text: "Bundler-tagged wallets are present in the structural risk evidence.",
      title: "Bundler Group",
    });
  }

  if (positiveEvidence(top70SniperHoldPercentage) || hasSniperLikeHolder) {
    groups.push({
      exposure: positiveEvidence(top70SniperHoldPercentage)
        ? `${formatInsiderPercent(top70SniperHoldPercentage)} exposure · ${formatInsiderCount(sniperWalletCount)} wallets`
        : "Sniper-like holder detected",
      level: riskLevelFromPercent(top70SniperHoldPercentage),
      text: "Sniper pressure is detected through tagged sniper wallets or top-holder sniper ownership.",
      title: "Sniper Group",
    });
  }

  if (positiveEvidence(freshWalletPercentage)) {
    groups.push({
      exposure: `${formatInsiderPercent(freshWalletPercentage)} exposure · ${formatInsiderCount(freshWalletCount)} wallets`,
      level: riskLevelFromPercent(freshWalletPercentage),
      text: "Fresh-wallet concentration is present in the loaded risk pressure evidence.",
      title: "Fresh Wallet Group",
    });
  }

  if (positiveEvidence(phishingPercentage)) {
    groups.push({
      exposure: `${formatInsiderPercent(phishingPercentage)} exposure`,
      level: riskLevelFromPercent(phishingPercentage),
      text: "Phishing-tagged holder exposure is visible in the structural risk evidence.",
      title: "Phishing Group",
    });
  }

  if (
    weakOwnership !== null &&
    goodOwnership !== null &&
    weakOwnership > goodOwnership
  ) {
    groups.push({
      exposure: `${formatInsiderPercent(weakOwnership)} weak/toxic vs ${formatInsiderPercent(goodOwnership)} good+ ownership`,
      level: riskLevelFromPercent(weakOwnership),
      text: "Weak or toxic analyzed ownership outweighs good-or-better holder ownership.",
      title: "Weak Holder Group",
    });
  }

  return groups;
}

function buildInsiderHolderRows(
  novaResponse: NovaConvictionResult | null,
  fallbackWalletRows: WalletRow[] = []
): InsiderHolderRowV3[] {
  const modules = readRecord(novaResponse?.moduleSummaries);
  const holderAlpha = readRecord(modules?.holderAlpha);
  const holderAlphaDepth =
    readRecord(novaResponse?.holderAlphaDepth) ??
    readRecord(holderAlpha?.holderAlphaDepth);
  const expectedCount =
    numberField(holderAlphaDepth, "analyzedWalletCount") ??
    numberField(holderAlpha, "analyzedWalletCount") ??
    expectedInsiderHolderCount(novaResponse?.analysisMode);
  const holderCandidates = [
    ...readRecordArray(holderAlpha?.allWalletsByHolderRank),
    ...readRecordArray(holderAlpha?.allWalletsByAlphaV3),
    ...readRecordArray(holderAlpha?.topWalletsByAlphaV3),
    ...readRecordArray(holderAlpha?.bottomWalletsByAlphaV3),
    ...readRecordArray(holderAlpha?.holders),
    ...readRecordArray(holderAlpha?.wallets),
    ...readRecordArray(holderAlpha?.holderResults),
    ...fallbackWalletRows.map(insiderFallbackWalletRowToRecord),
  ];
  const seen = new Set<string>();
  const rows = holderCandidates
    .map((wallet) => {
      const address = insiderWalletAddress(wallet);
      if (!address) return null;
      const key = address.toLowerCase();
      if (seen.has(key)) return null;
      seen.add(key);
      const score =
        numberField(wallet, "walletAlphaScore") ??
        numberField(wallet, "walletAlphaV3") ??
        numberField(wallet, "score");
      const ownershipPercent =
        numberField(wallet, "ownershipPercent") ??
        numberField(wallet, "ownershipPercentage");
      return {
        analysisType: insiderAnalysisType(wallet),
        behaviorLabel: score === null ? "Unavailable" : holderAlphaBehaviorLabel(score),
        confidenceLevel: String(wallet.confidenceLevel || "Unavailable"),
        explanations: safeStringArray(wallet.explanations),
        labels: [
          ...safeStringArray(wallet.holderLabels),
          ...safeStringArray(wallet.labels),
        ],
        rank: numberField(wallet, "holderRank") ?? numberField(wallet, "rank"),
        rawWallet: wallet,
        rawMetrics: readRecord(wallet.rawMetrics),
        score,
        usdValue:
          numberField(wallet, "usdValue") ??
          numberField(wallet, "valueUsd") ??
          numberField(wallet, "usd"),
        wallet: address,
        ownershipPercent,
      };
    })
    .filter((row): row is InsiderHolderRowV3 => Boolean(row))
    .sort((left, right) => {
      if (left.rank === null && right.rank === null) return 0;
      if (left.rank === null) return 1;
      if (right.rank === null) return -1;
      return left.rank - right.rank;
    });

  if (
    process.env.NODE_ENV !== "production" &&
    rows.length === 20 &&
    expectedCount !== null &&
    expectedCount > 20
  ) {
    console.warn(
      `[NovaOS] Insider Scan received only 20 holder rows although holder depth expected ${Math.round(expectedCount)}. Backend response may not expose all analyzed holders.`
    );
  }

  return rows.slice(0, expectedCount ?? rows.length);
}

function insiderWalletAddress(wallet: Record<string, unknown>) {
  const value =
    wallet.wallet ??
    wallet.address ??
    wallet.fullAddress ??
    wallet.ownerAddress ??
    wallet.walletAddress;
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function insiderFallbackWalletRowToRecord(row: WalletRow): Record<string, unknown> {
  return {
    wallet: row.fullAddress || row.wallet || row.address,
    holderRank: row.rank,
    ownershipPercent: parseInsiderPercentText(row.ownershipPercentage),
    walletAlphaScore: row.score,
    analysisDepth: "light",
  };
}

function parseInsiderPercentText(value: string | undefined) {
  if (!value) return null;
  const numeric = Number(value.replace("%", "").trim());
  return Number.isFinite(numeric) ? numeric : null;
}

function expectedInsiderHolderCount(mode: NovaAnalysisMode | null | undefined) {
  if (mode === "fast") return 50;
  if (mode === "balanced" || mode === "deep") return 100;
  return null;
}

function buildInsiderWalletScoreMetrics(row: InsiderHolderRowV3): InsiderWalletScoreMetric[] {
  const rawMetrics = row.rawMetrics;
  const lightBreakdown = readRecord(row.rawWallet.lightScoreBreakdown);
  const walletAlphaScore =
    numberField(row.rawWallet, "walletAlphaScore") ??
    numberField(row.rawWallet, "walletAlphaV3") ??
    row.score;

  const metrics =
    row.analysisType === "Deep"
      ? [
          scoreBarMetric("Wallet Score", walletAlphaScore),
          scoreBarMetric("Entry Discipline", numberField(row.rawWallet, "entryDisciplineV3")),
          scoreBarMetric("Exit Discipline", numberField(row.rawWallet, "exitDisciplineV3")),
          scoreBarMetric("Consistency", numberField(row.rawWallet, "consistencyV3")),
          scoreBarMetric("Win Rate Quality", numberField(row.rawWallet, "winRateQualityV3")),
          scoreBarMetric("Rotation Quality", numberField(row.rawWallet, "rotationQualityV3")),
          scoreBarMetric("Risk Hygiene", numberField(row.rawWallet, "riskHygieneV3")),
          scoreBarMetric("Confidence", numberField(row.rawWallet, "dataConfidenceV3")),
        ]
      : [
          scoreBarMetric("Wallet Score", walletAlphaScore),
          scoreBarMetric("PnL Efficiency", numberField(lightBreakdown, "pnlEfficiencyQuality")),
          scoreBarMetric("Trade Depth", numberField(lightBreakdown, "tradeDepthQuality")),
          scoreBarMetric("Risk Control", numberField(lightBreakdown, "riskControlQuality")),
          scoreBarMetric("Activity Quality", numberField(lightBreakdown, "activityQuality")),
          scoreBarMetric("Data Completeness", numberField(lightBreakdown, "dataCompletenessQuality")),
          rawBarMetric(
            "Realized PnL %",
            numberField(rawMetrics, "realizedPnlPercent"),
            (value) => clampNumber(50 + value / 2, 0, 100),
            (value) => `${Number(value.toFixed(2))}%`
          ),
          rawBarMetric(
            "PnL Multiplier",
            numberField(rawMetrics, "pnlMultiplier"),
            (value) => clampNumber(value * 50, 0, 100),
            (value) => `${Number(value.toFixed(2))}x`
          ),
        ];

  return metrics.filter((metric): metric is InsiderWalletScoreMetric => Boolean(metric));
}

function scoreBarMetric(label: string, value: number | null): InsiderWalletScoreMetric | null {
  if (value === null) return null;
  return {
    barValue: value,
    label,
    value: formatInsiderScore(value),
  };
}

function rawBarMetric(
  label: string,
  value: number | null,
  normalize: (value: number) => number,
  format: (value: number) => string
): InsiderWalletScoreMetric | null {
  if (value === null) return null;
  return {
    barValue: normalize(value),
    label,
    value: format(value),
  };
}

function percentRiskMetric(label: string, value: number | null): InsiderRiskMetric {
  return {
    barValue: value,
    label,
    value: formatInsiderPercent(value),
  };
}

function countRiskMetric(label: string, value: number | null): InsiderRiskMetric {
  return {
    barValue: value === null ? null : Math.min(100, Math.log10(Math.max(value, 0) + 1) * 20),
    label,
    value: formatInsiderCount(value),
  };
}

function structuralRiskLabel(score: number | null) {
  if (score === null) return "Unavailable";
  if (score <= 20) return "Low structural risk";
  if (score <= 40) return "Controlled structural risk";
  if (score <= 60) return "Moderate structural risk";
  if (score <= 80) return "Elevated structural risk";
  return "Critical structural risk";
}

function formatInsiderPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Unavailable";
  return `${Number(value.toFixed(value >= 10 ? 1 : 2))}%`;
}

function formatInsiderScore(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Unavailable";
  return String(Math.round(value));
}

function formatInsiderCount(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Unavailable";
  return String(Math.round(value));
}

function formatInsiderMode(value: string | null | undefined) {
  if (!value) return "Unavailable";
  const normalized = value.toLowerCase();
  if (normalized === "fast") return "Fast";
  if (normalized === "balanced") return "Balanced";
  if (normalized === "deep") return "Deep";
  return value;
}

function maxFinite(values: Array<number | null | undefined>) {
  const finite = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return finite.length ? Math.max(...finite) : null;
}

function positiveEvidence(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function riskLevelFromPercent(value: number | null) {
  if (value === null) return "Observed";
  if (value >= 30) return "Critical";
  if (value >= 15) return "Elevated";
  if (value > 0) return "Moderate";
  return "Low";
}

function riskGroupLevelClass(level: string) {
  if (level === "Critical" || level === "Elevated") {
    return "border-[color:rgba(83,104,120,0.32)] bg-[rgba(83,104,120,0.1)] text-[color:var(--nova-danger)]";
  }
  if (level === "Moderate") {
    return "border-[color:var(--nova-border)] nova-card-inner text-[color:var(--nova-warning)]";
  }
  return "border-[color:var(--nova-border)] nova-card-inner text-[color:var(--nova-text-soft)]";
}

function insiderAnalysisType(wallet: Record<string, unknown>) {
  if (wallet.analysisDepth === "deep") return "Deep";
  if (wallet.analysisDepth === "light") return "Light";
  return "Unknown";
}

function EvidenceCard({ label, rows }: { label: string; rows: string[] }) {
  return (
    <div className={`min-h-[184px] rounded-2xl p-4 ${terminalGlassCardClass}`}>
      <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--nova-accent)]">{label}</p>
      <div className="mt-4 space-y-2.5">
        {(rows.length
          ? rows
          : ["Insufficient evidence."]
        ).map((row) => (
          <div key={row} className="flex gap-2 text-xs leading-relaxed text-[color:var(--nova-text-soft)]">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[rgba(83,104,120,0.42)]" />
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
      <div className="mt-3 grid w-full auto-rows-fr gap-3 md:grid-cols-2 xl:grid-cols-3">
        {groups.length === 0 ? (
          <div className={`rounded-2xl p-4 text-sm text-[color:var(--nova-text-soft)] md:col-span-2 xl:col-span-3 ${terminalGlassCardClass}`}>
            No material risk groups detected from currently loaded evidence.
          </div>
        ) : (
          groups.slice(0, 6).map((group) => (
            <div
              key={group.groupId}
              className={`flex h-full min-h-[190px] flex-col rounded-2xl p-4 ${terminalGlassCardClass}`}
            >
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[color:var(--nova-text-soft)]">
                    {riskGroupLabel(group.reason)}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--nova-text-muted)]">
                    {group.wallets.length} wallets grouped by behavioral similarity
                  </p>
                </div>
                <span className={`justify-self-start whitespace-nowrap rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.14em] sm:justify-self-end ${riskScorePillClass(group.riskScore)}`}>
                  {group.confidence} confidence · {group.riskScore}/100
                </span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-[color:var(--nova-text-soft)]">
                {group.reason}
              </p>
              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                {group.wallets.slice(0, 4).map((wallet) => (
                  <span
                    key={wallet}
                    className="rounded-full border border-[color:rgba(120,170,185,0.10)] bg-[rgba(8,37,51,0.24)] px-2.5 py-1 font-mono text-[11px] text-[color:var(--nova-text-soft)]"
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
      <div className="mt-3 w-full overflow-hidden rounded-2xl nova-card-inner">
        <div className="w-full overflow-x-auto">
          <div className={`grid min-h-[42px] w-full min-w-[920px] ${insiderPreviewGridClass} items-center gap-3 border-b border-[color:var(--nova-border)] nova-card-inner px-4 py-3 text-[10px] uppercase tracking-[0.12em] text-[color:var(--nova-text-soft)]`}>
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
                className={`grid min-h-[60px] w-full min-w-[920px] ${insiderPreviewGridClass} items-center gap-3 border-b border-[color:rgba(83,104,120,0.12)] px-4 py-3 text-left text-xs transition hover:nova-card-inner focus:outline-none focus:ring-1 focus:ring-inset focus:ring-[rgba(83,104,120,0.2)]`}
              >
                <WalletAddressCopy
                  address={row.fullAddress}
                  copied={copiedWallet === row.fullAddress}
                  fallback={row.wallet}
                  formatAddress={shortInsiderWalletAddress}
                  onCopy={copyWalletAddress}
                />
                <span className="text-center font-medium tabular-nums text-[color:var(--nova-accent)]">
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
                <span className="truncate whitespace-nowrap text-center text-[color:var(--nova-text-soft)]">
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
          className={`grid min-h-[60px] w-full min-w-[920px] ${insiderPreviewGridClass} items-center gap-3 border-b border-[color:rgba(83,104,120,0.12)] px-4 py-3`}
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
          <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--nova-accent-soft)]">
            Methodology
          </p>
          <p className="mt-3 max-w-4xl text-sm leading-relaxed text-[color:var(--nova-text-soft)]">
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
  InsiderRiskV2Panel,
  EvidenceCard,
  DetectedRiskGroups,
  InsiderHolderRiskPreview,
  InsiderScanMethodology,
  buildConcentrationEvidence,
  buildCoordinationEvidence,
  buildBehaviorEvidence,
  StableWalletIntelligenceTable,
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
      <section className="rounded-[2rem] nova-card-inner p-5">
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
      <section className="rounded-[2rem] nova-card-inner p-5">
        <SkeletonLine className="h-3 w-40" />
        <SkeletonLine className="mt-4 h-8 w-64" />
        <SkeletonLine className="mt-4 h-3 w-full max-w-2xl" />
      </section>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="rounded-2xl nova-card-inner p-4">
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
      <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--nova-accent-soft)]">{eyebrow}</p>
      <h2 className="mt-2 text-xl font-semibold tracking-[-0.045em] text-[color:var(--nova-text)]">
        {title}
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-[color:var(--nova-text-muted)]">{description}</p>
    </div>
  );
}

function ForensicFact({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 rounded-xl border border-[color:var(--nova-border)] nova-card-inner px-3 py-2.5">
      <p className="text-[9px] uppercase tracking-[0.16em] text-[color:var(--nova-text-muted)]">{label}</p>
      <p className="mt-1 truncate text-sm font-medium tabular-nums text-[color:var(--nova-text-soft)]" title={String(value)}>
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
  if (score >= 75) return "border-[color:var(--nova-border)] nova-card-inner text-[color:var(--nova-text-soft)]";
  if (score >= 45) return "border-[color:var(--nova-border)] nova-card-inner text-[color:var(--nova-warning)]";
  return "border-[color:var(--nova-border)] nova-card-inner text-[color:var(--nova-accent-soft)]";
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
    <section className="mt-4 overflow-hidden rounded-[2rem] nova-card-inner p-4 shadow-[0_26px_90px_rgba(0,0,0,0.24)] backdrop-blur-2xl">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-[color:var(--nova-accent-soft)]">
            Holder Intelligence
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-[-0.05em] text-[color:var(--nova-text)]">
            Top 10 Holders
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-[color:var(--nova-text-muted)]">
            Live holder facts with V2 behavior shown only where profiled.
          </p>
        </div>
        <button
          type="button"
          onClick={onViewFull}
          className="w-fit rounded-full nova-card-inner px-4 py-2 text-xs text-[color:var(--nova-accent-soft)] transition hover:nova-card-inner"
        >
          View full Top 100
        </button>
      </div>

      <div className="overflow-hidden rounded-[1.35rem] border border-[color:var(--nova-border)]">
        <div className={`grid ${overviewHolderGridClass} gap-3 border-b border-[color:var(--nova-border)] nova-card-inner px-4 py-3 text-[10px] uppercase tracking-[0.1em] text-[color:var(--nova-text-muted)]`}>
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
                className={`group grid ${overviewHolderGridClass} cursor-pointer items-center gap-3 border-b border-[color:rgba(83,104,120,0.12)] px-4 py-2.5 text-left text-[13px] transition hover:nova-card-inner focus:outline-none focus:ring-1 focus:ring-inset focus:ring-[rgba(83,104,120,0.2)]`}
              >
                <span className="text-[color:var(--nova-text-muted)]">{row.rank}</span>
                <div className="min-w-0">
                  <WalletAddressCopy
                    address={row.fullAddress}
                    copied={copiedWallet === row.fullAddress}
                    fallback={row.wallet}
                    onCopy={copyWalletAddress}
                  />
                </div>
                <span className="truncate text-[color:var(--nova-text-soft)]">{row.balance}</span>
                <span className="font-medium text-[color:var(--nova-accent)]">
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
          className={`grid ${overviewHolderGridClass} items-center gap-2 border-b border-[color:rgba(83,104,120,0.12)] px-4 py-2.5`}
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

const OVERVIEW_IA_REMOVED_SECTIONS = [
  AIThesis,
  ConvictionRing,
  OverviewScoreOrb,
  OverviewTopHoldersTable,
  buildExplainableIntelligenceReport,
  visiblePrimaryConvictionScore,
  NovaResearchSectionCard,
  NovaTopContributorsPanel,
  walletFlowOverviewSubtitle,
  pillarReasonDetail,
  buildNovaPillarAnalyses,
  NovaConvictionPillarAnalysisCard,
];
void OVERVIEW_IA_REMOVED_SECTIONS;

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
        className="pointer-events-none absolute -top-4 left-0 rounded-full nova-card-inner px-2 py-0.5 text-[9px] uppercase tracking-[0.16em] text-[color:var(--nova-accent-soft)] shadow-[0_0_18px_rgba(83,104,120,0.08)]"
      >
        Copied
      </motion.span>
      <span className="block truncate font-mono text-[13px] font-medium text-[color:var(--nova-text)] transition group-hover/address:text-[color:var(--nova-accent)]">
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
      <p className={tone === "error" ? "text-sm text-[color:var(--nova-danger)]" : "text-sm text-[color:var(--nova-text-muted)]"}>
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
    <div className="rounded-2xl nova-card-inner px-3 py-2.5">
      <p className="text-xs text-[color:var(--nova-text-muted)]">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-[-0.05em] text-[color:var(--nova-text)]">
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
            className="rounded-2xl nova-card-inner px-3 py-2.5"
          >
            <SkeletonLine className="h-2 w-20" />
            <SkeletonLine className="mt-3 h-5 w-14" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl nova-card-inner p-3">
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
    <div className="rounded-2xl nova-card-inner p-3 text-xs leading-relaxed">
      {pulse && (
        <motion.div
          animate={{ opacity: [0.35, 1, 0.35] }}
          transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
          className="mb-3 h-1.5 w-20 rounded-full bg-[rgba(83,104,120,0.28)]"
        />
      )}
      <p className={tone === "error" ? "text-[color:var(--nova-danger)]" : "text-[color:var(--nova-text-muted)]"}>
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
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(83,104,120,0.08),transparent_60%)]" />
      <div className="relative">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-medium">{title}</p>
          {tag && (
            <span className="rounded-full nova-card-inner px-3 py-1 text-xs text-[color:var(--nova-accent-soft)]">
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
    <section className="rounded-[2rem] nova-card-inner p-5 shadow-[0_30px_120px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--nova-accent-soft)]">
            Holder Intelligence
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-semibold tracking-[-0.05em]">
              Top Holder Intelligence
            </h2>
            <span className="rounded-full nova-card-inner px-3 py-1 text-xs text-[color:var(--nova-accent-soft)]">
              Top holders
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[color:var(--nova-text-muted)]">
            A clean holder-level read from loaded ownership and Holder
            Intelligence evidence.
          </p>
        </div>

      </div>

      <div className="w-full overflow-x-auto rounded-[1.4rem] border border-[color:var(--nova-border)]">
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
              title="No analyzed holder wallets are available."
              detail="Holder intelligence will appear after analysis completes."
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
              className={`group grid min-h-[60px] w-full ${fullHolderGridClass} items-center gap-3 text-left text-[13px] focus:outline-none focus:ring-1 focus:ring-inset focus:ring-[rgba(83,104,120,0.2)] ${terminalRowClass}`}
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
                      ? "bg-[var(--nova-danger)] shadow-[0_0_14px_rgba(83,104,120,0.34)]"
                      : row.color === "amber"
                      ? "bg-[var(--nova-warning)] shadow-[0_0_14px_rgba(83,104,120,0.28)]"
                      : row.color === "purple"
                      ? "bg-[var(--nova-accent-soft)] shadow-[0_0_14px_rgba(83,104,120,0.28)]"
                      : "bg-[var(--nova-accent)] shadow-[0_0_14px_rgba(83,104,120,0.3)]"
                  }`}
                />

                <div className="min-w-0">
                  <p className="truncate font-mono font-medium text-[color:var(--nova-text)]">
                    {row.fullAddress ? shortInsiderWalletAddress(row.fullAddress) : row.wallet}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-[color:var(--nova-text-muted)]">
                    #{row.rank} {row.label || "Holder wallet"}
                  </p>
                </div>
              </div>

              <span className="text-center font-medium tabular-nums text-[color:var(--nova-accent)]">
                {row.ownershipPercentage}
              </span>
              <span className="truncate text-center text-[color:var(--nova-text-soft)]">
                {matchedHolderProfile?.holderClass ||
                  (matchedProfile ? behaviorBadgeLabel(matchedProfile) : "Insufficient evidence.")}
              </span>
              <span className="truncate text-center text-[color:var(--nova-text-soft)]">
                {matchedHolderProfile?.riskTier ||
                  (matchedProfile ? holderRiskHint(row, matchedProfile, false) : "Insufficient evidence.")}
              </span>
              <span className="text-center font-medium tabular-nums text-[color:var(--nova-accent)]">
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
        <p className={`text-sm ${tone === "error" ? "text-[color:var(--nova-danger)]" : "text-[color:var(--nova-text-soft)]"}`}>
          {title}
        </p>
        <p className="mt-2 max-w-xl text-xs text-[color:var(--nova-text-muted)]">{detail}</p>
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
          className={`grid min-h-[60px] w-full min-w-[760px] ${fullHolderGridClass} items-center gap-3 border-b border-[color:rgba(83,104,120,0.12)] px-4 py-3`}
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
      <p className="px-4 py-4 text-xs text-[color:var(--nova-text-muted)]">
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
      <span className="inline-flex max-w-full justify-center rounded-full nova-card-inner px-3 py-1 text-center text-xs text-[color:var(--nova-text-soft)]">
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
      <span className="inline-flex max-w-full justify-center rounded-full nova-card-inner px-3 py-1 text-center text-xs text-[color:var(--nova-text-soft)]">
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
      <p className="mt-1 text-[11px] text-[color:var(--nova-text-muted)]">
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
    return "border-[color:var(--nova-border)] nova-card-inner text-[color:var(--nova-warning)]";
  }

  if (personalityType === "Conviction Accumulator") {
    return "border-[color:var(--nova-border)] nova-card-inner text-[color:var(--nova-success)]";
  }

  if (personalityType === "Contract/System Wallet") {
    return "border-[color:var(--nova-border)] bg-[rgba(94,114,107,0.08)] text-[color:var(--nova-accent-soft)]";
  }

  if (personalityType === "Insufficient Data") {
    return "border-[color:var(--nova-border)] nova-card-inner text-[color:var(--nova-text-soft)]";
  }

  return "border-[color:var(--nova-border)] nova-card-inner text-[color:var(--nova-accent)]";
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
    return "border-[color:var(--nova-border)] bg-[rgba(94,114,107,0.08)] text-[color:var(--nova-accent-soft)]";
  }

  if (label === "Dormant") {
    return "border-[color:var(--nova-border)] nova-card-inner text-[color:var(--nova-warning)]";
  }

  if (label === "Concentrated") {
    return "border-[color:var(--nova-border)] nova-card-inner text-[color:var(--nova-danger)]";
  }

  if (label === "High Activity") {
    return "border-[color:var(--nova-border)] nova-card-inner text-[color:var(--nova-success)]";
  }

  return "border-[color:var(--nova-border)] nova-card-inner text-[color:var(--nova-accent)]";
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
      <span className={`font-medium tabular-nums text-[color:var(--nova-accent)] ${centered ? "text-center" : ""}`}>
        {value}
      </span>
    );
  }

  return (
    <span className={`truncate text-xs text-[color:var(--nova-text-muted)] ${centered ? "text-center" : ""}`}>
      {fallback || "—"}
    </span>
  );
}

function WalletDetailDrawer({
  selected,
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
  useEffect(() => {
    if (!selected) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, selected]);

  if (!selected) return null;

  const isPersonalityUnavailable =
    walletPersonalityLoadState === "error" ||
    (walletPersonalityLoadState === "loaded" && !walletPersonality);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close wallet detail drawer"
        className="absolute inset-0 bg-[rgba(10,10,10,0.55)] backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.aside
        initial={{ x: 36, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 36, opacity: 0 }}
        className="relative z-10 h-full w-full max-w-xl overflow-y-auto border-l border-[color:var(--nova-border)] nova-card-inner p-5 shadow-[0_0_90px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
      >
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full nova-card-inner px-3 py-1.5 text-xs text-[color:var(--nova-text-soft)] transition hover:nova-card-inner"
          >
            Close
          </button>
        </div>

        {isPersonalityUnavailable ? (
          <div className="rounded-[1.5rem] nova-card-inner p-4 text-sm text-[color:var(--nova-text-soft)]">
            Wallet personality is unavailable for this wallet.
          </div>
        ) : (
          <WalletPersonalitySection
            data={walletPersonality}
            error={walletPersonalityError}
            loadState={walletPersonalityLoadState}
          />
        )}
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
    <div className="mt-4 rounded-[1.5rem] nova-card-inner p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-[color:var(--nova-accent-soft)]">
            Transaction Intelligence
          </p>
          <p className="mt-2 text-sm text-[color:var(--nova-text-soft)]">
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
        <div className="mt-4 rounded-2xl nova-card-inner p-3">
          <p className="text-xs leading-relaxed text-[color:var(--nova-danger)]">
            {error || "Transaction intelligence could not be loaded."}
          </p>
        </div>
      )}

      {loadState === "loaded" && data && (
        <>
          <p className="mt-3 text-xs leading-relaxed text-[color:var(--nova-text-muted)]">
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
              <p className="text-xs text-[color:var(--nova-text-muted)]">Recent transfers</p>
              <p className="text-xs text-[color:var(--nova-text-muted)]">Latest 5</p>
            </div>

            {transactions.length === 0 ? (
              <div className="rounded-2xl nova-card-inner p-3 text-xs text-[color:var(--nova-text-muted)]">
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
        <div className="mt-4 rounded-2xl nova-card-inner p-3 text-xs text-[color:var(--nova-text-muted)]">
          Select a wallet to load transfer intelligence.
        </div>
      )}

      <p className="mt-4 rounded-2xl nova-card-inner p-3 text-xs leading-relaxed text-[color:var(--nova-text-muted)]">
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
  return (
    <div className="mt-4 overflow-hidden rounded-[1.5rem] nova-card-inner p-4 shadow-[0_0_60px_rgba(83,104,120,0.045)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-[color:var(--nova-accent-soft)]">
            Wallet Personality
          </p>
          <p className="mt-2 text-xl font-semibold tracking-[-0.05em] text-[color:var(--nova-text)]">
            {data?.personalityType || "Personality pending"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[color:var(--nova-text-muted)]">
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
        <div className="mt-4 rounded-2xl nova-card-inner p-3">
          <p className="text-xs leading-relaxed text-[color:var(--nova-danger)]">
            {error || "Wallet personality could not be loaded."}
          </p>
        </div>
      )}

      {loadState === "idle" && (
        <div className="mt-4 rounded-2xl nova-card-inner p-3 text-xs text-[color:var(--nova-text-muted)]">
          Select a wallet to load personality inference.
        </div>
      )}

      {loadState === "loaded" && !data && (
        <div className="mt-4 rounded-2xl nova-card-inner p-3 text-xs text-[color:var(--nova-text-muted)]">
          Wallet personality is unavailable for this wallet.
        </div>
      )}

      {loadState === "loaded" && data && (
        <>
          <div className="mt-4 space-y-2 rounded-2xl nova-card-inner p-3">
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

          <ShareCardPreview data={data} />

          <p className="mt-4 rounded-2xl nova-card-inner p-3 text-xs leading-relaxed text-[color:var(--nova-text-muted)]">
            {data.methodologyNote}
          </p>
        </>
      )}

      <p className="mt-4 rounded-2xl nova-card-inner p-3 text-xs leading-relaxed text-[color:var(--nova-text-muted)]">
        Behavior-inference only. No PnL, win rate, smart money identity or
        insider identity is calculated.
      </p>
    </div>
  );
}

function ShareCardPreview({
  data,
}: {
  data: WalletPersonalityData;
}) {
  const topScores = Object.entries(data.personalityScores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  return (
    <div className="mt-4">
      <div className="mb-2">
        <p className="text-xs text-[color:var(--nova-text-muted)]">Share Card Preview</p>
      </div>

      <div className="relative overflow-hidden rounded-[1.6rem] border border-[color:var(--nova-border)] nova-card-inner p-4 shadow-[0_0_70px_rgba(83,104,120,0.07)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(83,104,120,0.12),transparent_48%),radial-gradient(circle_at_90%_85%,rgba(94,114,107,0.12),transparent_42%)]" />

        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[var(--nova-accent)] shadow-[0_0_16px_rgba(127,144,150,0.58)]" />
                <p className="text-xs font-semibold tracking-[0.28em] text-[color:var(--nova-accent)]">
                  NovaOS
                </p>
              </div>
              <p className="mt-2 font-mono text-xs text-[color:var(--nova-text-muted)]">
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
            <p className="text-2xl font-semibold tracking-[-0.06em] text-[color:var(--nova-text)]">
              {data.personalityType}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-[color:var(--nova-text-soft)]">
              {data.shareCardText}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {topScores.map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl nova-card-inner p-2.5"
              >
                <p className="truncate text-[10px] uppercase tracking-[0.16em] text-[color:var(--nova-text-muted)]">
                  {formatScoreLabel(label)}
                </p>
                <p className="mt-1 text-lg font-semibold text-[color:var(--nova-accent)]">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {data.traits.slice(0, 3).map((trait) => (
              <span
                key={trait}
                className="rounded-full nova-card-inner px-2.5 py-1 text-[11px] text-[color:var(--nova-accent-soft)]"
              >
                {trait}
              </span>
            ))}
          </div>

          <p className="mt-5 border-t border-[color:var(--nova-border)] pt-3 text-[11px] text-[color:var(--nova-text-muted)]">
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
        <span className="text-[color:var(--nova-text-muted)]">{label}</span>
        <span className="font-medium tabular-nums text-[color:var(--nova-accent-soft)]">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full nova-card-inner">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#536878] via-[rgba(83,104,120,0.58)] to-[rgba(10,10,10,0.72)]"
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
      <p className="mb-2 text-xs text-[color:var(--nova-text-muted)]">{title}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item}
            className={`rounded-full border px-2.5 py-1 text-[11px] ${
              tone === "amber"
                ? "border-[color:var(--nova-border)] nova-card-inner text-[color:var(--nova-warning)]"
                : "border-[color:var(--nova-border)] nova-card-inner text-[color:var(--nova-accent-soft)]"
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
      <div className="rounded-2xl nova-card-inner p-3">
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
      <div className="rounded-2xl nova-card-inner p-3">
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
    <div className="mt-4 rounded-[1.5rem] nova-card-inner p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-[color:var(--nova-accent-soft)]">
            Wallet Memory
          </p>
          <p className="mt-2 text-sm text-[color:var(--nova-text-soft)]">
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
        <div className="mt-4 rounded-2xl nova-card-inner p-3">
          <p className="text-xs leading-relaxed text-[color:var(--nova-danger)]">
            {error || "Wallet memory could not be loaded."}
          </p>
        </div>
      )}

      {loadState === "idle" && (
        <div className="mt-4 rounded-2xl nova-card-inner p-3 text-xs text-[color:var(--nova-text-muted)]">
          Select a wallet to load runtime memory.
        </div>
      )}

      {loadState === "loaded" && !data && (
        <div className="mt-4 rounded-2xl nova-card-inner p-3 text-xs text-[color:var(--nova-text-muted)]">
          Wallet memory is unavailable for this wallet.
        </div>
      )}

      {loadState === "loaded" && data && (
        <>
          <p className="mt-3 text-xs leading-relaxed text-[color:var(--nova-text-muted)]">
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

          <div className="mt-4 rounded-2xl nova-card-inner p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-[color:var(--nova-text-muted)]">Recurring cluster appearance</p>
              <span className="text-xs font-medium text-[color:var(--nova-accent-soft)]">
                {data.recurringClusterAppearance.detected ? "Detected" : "Not detected"}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[color:var(--nova-text-muted)]">
              {data.recurringClusterAppearance.explanation}
            </p>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs text-[color:var(--nova-text-muted)]">Repeated behavior flags</p>
            <div className="flex flex-wrap gap-2">
              {data.repeatedBehaviorFlags.map((flag) => (
                <span
                  key={flag}
                  className="rounded-full nova-card-inner px-2.5 py-1 text-[11px] text-[color:var(--nova-accent-soft)]"
                >
                  {formatMemoryFlag(flag)}
                </span>
              ))}
            </div>
          </div>
        </>
      )}

      <p className="mt-4 rounded-2xl nova-card-inner p-3 text-xs leading-relaxed text-[color:var(--nova-text-muted)]">
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
            className="rounded-2xl nova-card-inner p-3"
          >
            <SkeletonLine className="h-2 w-20" />
            <SkeletonLine className="mt-3 h-5 w-12" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl nova-card-inner p-3">
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
    return "border-[color:var(--nova-border)] nova-card-inner text-[color:var(--nova-success)]";
  }

  if (confidence === "Medium") {
    return "border-[color:var(--nova-border)] nova-card-inner text-[color:var(--nova-accent-soft)]";
  }

  return "border-[color:var(--nova-border)] nova-card-inner text-[color:var(--nova-warning)]";
}

function TransactionRow({
  transaction,
}: {
  transaction: WalletTransaction;
}) {
  return (
    <div className="rounded-2xl nova-card-inner p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`rounded-full border px-2.5 py-1 text-[11px] ${directionBadgeClass(
              transaction.direction
            )}`}
          >
            {formatDirection(transaction.direction)}
          </span>
          <p className="truncate text-xs text-[color:var(--nova-text-soft)]">
            {transaction.tokenSymbol || "Token"}
          </p>
        </div>
        <p className="shrink-0 text-xs text-[color:var(--nova-text-muted)]">
          {formatTransferTime(transaction.timestamp)}
        </p>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div className="min-w-0">
          <p className="text-[color:var(--nova-text-muted)]">Amount</p>
          <p className="mt-0.5 truncate text-[color:var(--nova-text-soft)]">
            {transaction.amount || "N/A"}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[color:var(--nova-text-muted)]">Value</p>
          <p className="mt-0.5 truncate text-[color:var(--nova-text-soft)]">
            {formatUsd(transaction.valueUsd)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[color:var(--nova-text-muted)]">Tx</p>
          <p className="mt-0.5 truncate font-mono text-[color:var(--nova-text-soft)]">
            {shortHash(transaction.txHash)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[color:var(--nova-text-muted)]">Counterparty</p>
          <p className="mt-0.5 truncate font-mono text-[color:var(--nova-text-soft)]">
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
            className="rounded-2xl nova-card-inner p-3"
          >
            <SkeletonLine className="h-2 w-20" />
            <SkeletonLine className="mt-3 h-5 w-12" />
          </div>
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="rounded-2xl nova-card-inner p-3"
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
    return "border-[color:var(--nova-border)] nova-card-inner text-[color:var(--nova-success)]";
  }

  if (direction === "sell") {
    return "border-[color:var(--nova-border)] nova-card-inner text-[color:var(--nova-danger)]";
  }

  return "border-[color:var(--nova-border)] nova-card-inner text-[color:var(--nova-warning)]";
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
    <div className="rounded-2xl nova-card-inner p-3">
      <p className="text-xs text-[color:var(--nova-text-muted)]">{label}</p>
      <p className="mt-1 truncate text-base font-semibold text-[color:var(--nova-text)]">
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
          className="rounded-2xl nova-card-inner p-3"
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

const LEGACY_WALLET_DRAWER_SECTIONS = [
  TransactionIntelligenceSection,
  WalletMemorySection,
  WalletDrawerSkeleton,
  explorerUrl,
];
void LEGACY_WALLET_DRAWER_SECTIONS;

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
    return "border-[color:var(--nova-border)] nova-card-inner text-[color:var(--nova-success)]";
  }

  if (confidence === "Medium confidence") {
    return "border-[color:var(--nova-border)] nova-card-inner text-[color:var(--nova-accent-soft)]";
  }

  return "border-[color:var(--nova-border)] nova-card-inner text-[color:var(--nova-warning)]";
}

function SkeletonLine({ className = "" }: { className?: string }) {
  return (
    <motion.span
      animate={{ opacity: [0.24, 0.58, 0.24] }}
      transition={{ duration: 1.35, repeat: Infinity, ease: "easeInOut" }}
      className={`block rounded-full bg-[rgba(178,190,181,0.12)] ${className}`}
    />
  );
}
