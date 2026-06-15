import { NextResponse } from "next/server";
import { fetchGmgnRiskStats, type GmgnRiskStats } from "@/lib/gmgn-risk-stats";
import { fetchGmgnSmartMoneyTrades } from "@/lib/gmgn-smart-money-trades";
import { computeNovaConvictionV3 } from "@/lib/nova-conviction-v3-engine";
import {
  computeRiskPressureV1,
  type RiskPressureHolderAlphaContext,
  type RiskPressureResultV1,
} from "@/lib/risk-pressure-engine";
import { computeSmartMoneyFlowV1, type SmartMoneyFlowResultV1 } from "@/lib/smart-money-flow-engine";
import {
  type AnalysisMode,
  type Top100HolderAlphaV3Result,
} from "@/lib/top100-holder-alpha-v3-engine";
import {
  getTop100HolderAlphaModeConfig,
  normalizeTop100HolderAlphaAddress,
  runTop100HolderAlphaV3FromRequestConfig,
  Top100HolderAlphaZeroHoldersError,
  type KlineInterval,
  type Top100HolderAlphaModeConfig,
} from "@/lib/run-top100-holder-alpha-v3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

const SUPPORTED_CHAINS = new Set(["sol", "bsc", "base", "eth"]);
const INTERVALS = new Set(["1m", "5m", "15m", "1h", "4h", "1d"]);
const DEFAULT_WALLET_MAX_PAGES = 25;
const MAX_WALLET_MAX_PAGES = 50;
const DEFAULT_WALLET_MAX_ACTIVITIES = 5000;
const MAX_WALLET_MAX_ACTIVITIES = 5000;
const DEFAULT_MAX_TOKENS = 50;
const MAX_TOKENS = 100;
const DEFAULT_CONCURRENCY = 2;
const MAX_CONCURRENCY = 5;
const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const SOL_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

type HolderAlphaDepth = {
  analysisMode: AnalysisMode;
  holderCount: number;
  analyzedWalletCount: number;
  failedWalletCount: number;
  deepHolderLimit: number;
  lightHolderLimit: number;
  deepAnalyzedWalletCount: number;
  lightAnalyzedWalletCount: number;
  realLightWalletCount: number;
  fallbackLightWalletCount: number;
  effectiveModeConfig: Top100HolderAlphaModeConfig;
};

function parseAnalysisMode(value: string | null): {
  analysisMode: AnalysisMode;
  warning: string | null;
} {
  if (!value || value === "balanced") return { analysisMode: "balanced", warning: null };
  if (value === "fast" || value === "deep") return { analysisMode: value, warning: null };
  return {
    analysisMode: "balanced",
    warning: `Invalid analysisMode "${value}" normalized to balanced.`,
  };
}

function errorResponse(error: string, status = 400, requestRunId: string | null = null) {
  return NextResponse.json(
    { success: false, error, requestRunId },
    { status, headers: noStoreHeaders }
  );
}

function isGmgnRateLimitText(value: unknown) {
  const text = String(value ?? "").toLowerCase();
  return (
    text.includes("http 429") ||
    text.includes("rate_limit") ||
    text.includes("rate limit") ||
    text.includes("temporarily banned") ||
    text.includes("rate limit resets")
  );
}

function isGmgnRateLimitError(error: unknown) {
  if (error instanceof Error) {
    return isGmgnRateLimitText(error.message) || isGmgnRateLimitText(error.stack);
  }

  return isGmgnRateLimitText(error);
}

function gmgnRateLimitResponse({
  address,
  analysisMode,
  chain,
  error,
  requestRunId,
  stage,
}: {
  address: string;
  analysisMode: AnalysisMode;
  chain: string;
  error: unknown;
  requestRunId: string | null;
  stage: string;
}) {
  console.error("[Nova V3] GMGN rate limit", {
    stage,
    chain,
    address,
    analysisMode,
    runId: requestRunId,
    details: error instanceof Error ? error.message : String(error),
  });

  return NextResponse.json(
    {
      success: false,
      error: "GMGN rate limit reached. Please wait before starting another scan.",
      errorCode: "GMGN_RATE_LIMIT",
      retryable: true,
      requestRunId,
      debug: {
        stage,
        analysisMode,
        chain,
        address,
      },
    },
    { status: 429, headers: noStoreHeaders }
  );
}

function holderAlphaExecutionErrorResponse({
  address,
  analysisMode,
  chain,
  error,
  requestRunId,
}: {
  address: string;
  analysisMode: AnalysisMode;
  chain: string;
  error: unknown;
  requestRunId: string | null;
}) {
  return NextResponse.json(
    {
      success: false,
      error: "Holder Alpha execution failed inside Nova Conviction V3 route.",
      details: error instanceof Error ? error.message : String(error),
      requestRunId,
      debug: {
        stage: "holder-alpha-execution",
        chain,
        address,
        analysisMode,
        runId: requestRunId,
      },
    },
    { status: 500, headers: noStoreHeaders }
  );
}

function holderDepthErrorResponse({
  debug,
  holderAlphaDepth,
  requestRunId,
}: {
  debug: Record<string, unknown>;
  holderAlphaDepth: HolderAlphaDepth;
  requestRunId: string | null;
}) {
  return NextResponse.json(
    {
      success: false,
      error: "Holder intelligence depth did not execute correctly.",
      requestRunId,
      holderAlphaDepth,
      debug,
    },
    { status: 500, headers: noStoreHeaders }
  );
}

function parseBoolean(value: string | null) {
  return value === "true" || value === "1";
}

function parseBoundedInteger(value: string | null, defaultValue: number, max: number) {
  if (!value) return defaultValue;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return null;

  return Math.min(parsed, max);
}

function isValidAddress(chain: string, address: string) {
  return chain === "sol"
    ? SOL_ADDRESS_PATTERN.test(address)
    : EVM_ADDRESS_PATTERN.test(address);
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "unknown error";
}

function buildHolderAlphaDepth(
  holderAlpha: Top100HolderAlphaV3Result | null,
  effectiveModeConfig: Top100HolderAlphaModeConfig
): HolderAlphaDepth {
  return {
    analysisMode: holderAlpha?.analysisMode ?? effectiveModeConfig.analysisMode,
    holderCount: Number(holderAlpha?.holderCount ?? 0),
    analyzedWalletCount: Number(holderAlpha?.analyzedWalletCount ?? 0),
    failedWalletCount: Number(holderAlpha?.failedWalletCount ?? 0),
    deepHolderLimit: Number(
      holderAlpha?.deepHolderLimit ?? effectiveModeConfig.deepHolderLimit ?? 0
    ),
    lightHolderLimit: Number(
      holderAlpha?.lightHolderLimit ?? effectiveModeConfig.lightHolderLimit ?? 0
    ),
    deepAnalyzedWalletCount: Number(holderAlpha?.deepAnalyzedWalletCount ?? 0),
    lightAnalyzedWalletCount: Number(holderAlpha?.lightAnalyzedWalletCount ?? 0),
    realLightWalletCount: Number(holderAlpha?.realLightWalletCount ?? 0),
    fallbackLightWalletCount: Number(holderAlpha?.fallbackLightWalletCount ?? 0),
    effectiveModeConfig,
  };
}

function holderAlphaDepthInvariantError(depth: HolderAlphaDepth) {
  if (depth.analysisMode === "fast") {
    if (depth.deepAnalyzedWalletCount <= 0 || depth.lightAnalyzedWalletCount <= 0) {
      return "fast-depth-missing";
    }
  }

  if (depth.analysisMode === "balanced") {
    if (depth.deepAnalyzedWalletCount <= 0 || depth.lightAnalyzedWalletCount <= 0) {
      return "balanced-depth-missing";
    }
  }

  if (depth.analysisMode === "deep") {
    if (depth.deepAnalyzedWalletCount <= 0 || depth.lightAnalyzedWalletCount !== 0) {
      return "deep-depth-invalid";
    }
  }

  return "";
}

function buildHolderAlphaRiskContext(
  holderAlpha: Top100HolderAlphaV3Result | null
): RiskPressureHolderAlphaContext | null {
  if (!holderAlpha) return null;

  return {
    holderAlphaScore: holderAlpha.holderAlphaV3Score,
    weightedWalletAlphaV3: holderAlpha.weightedWalletAlphaV3,
    simpleAverageWalletAlphaV3: holderAlpha.simpleAverageWalletAlphaV3,
    holderCompositionScore: holderAlpha.holderCompositionScore,
    confidenceScore: holderAlpha.confidenceScore,
    walletDataConfidenceScore: holderAlpha.walletDataConfidenceScore,
    holderSetCoverageScore: holderAlpha.holderSetCoverageScore,
    totalAnalyzedOwnershipPercent: holderAlpha.totalAnalyzedOwnershipPercent,
    eliteWalletCount: holderAlpha.eliteWalletCount,
    strongWalletCount: holderAlpha.strongWalletCount,
    goodWalletCount: holderAlpha.goodWalletCount,
    averageWalletCount: holderAlpha.averageWalletCount,
    weakWalletCount: holderAlpha.weakWalletCount,
    toxicWalletCount: holderAlpha.toxicWalletCount,
    eliteOwnershipPercent: holderAlpha.eliteOwnershipPercent,
    strongOwnershipPercent: holderAlpha.strongOwnershipPercent,
    goodOwnershipPercent: holderAlpha.goodOwnershipPercent,
    averageOwnershipPercent: holderAlpha.averageOwnershipPercent,
    weakOwnershipPercent: holderAlpha.weakOwnershipPercent,
    toxicOwnershipPercent: holderAlpha.toxicOwnershipPercent,
    goodOrBetterOwnershipPercent: holderAlpha.goodOrBetterOwnershipPercent,
    weakOrToxicOwnershipPercent: holderAlpha.weakOrToxicOwnershipPercent,
    smartLikeOwnershipPercent: holderAlpha.smartLikeOwnershipPercent,
    sniperLikeOwnershipPercent: holderAlpha.sniperLikeOwnershipPercent,
    bundlerLikeOwnershipPercent: holderAlpha.bundlerLikeOwnershipPercent,
    suspiciousLikeOwnershipPercent: holderAlpha.suspiciousLikeOwnershipPercent,
    freshLikeOwnershipPercent: holderAlpha.freshLikeOwnershipPercent,
    whaleLikeOwnershipPercent: holderAlpha.whaleLikeOwnershipPercent,
    analysisMode: holderAlpha.analysisMode,
    deepAnalyzedWalletCount: holderAlpha.deepAnalyzedWalletCount,
    lightAnalyzedWalletCount: holderAlpha.lightAnalyzedWalletCount,
    realLightWalletCount: holderAlpha.realLightWalletCount,
    fallbackLightWalletCount: holderAlpha.fallbackLightWalletCount,
  };
}

async function computeSmartMoneyFlow({
  chain,
  address,
}: {
  chain: string;
  address: string;
}) {
  const feed = await fetchGmgnSmartMoneyTrades(chain, { limit: 200 });
  const normalizedAddress = address.toLowerCase();
  const matchedTrades = feed.trades.filter(
    (trade) => trade.tokenAddress?.toLowerCase() === normalizedAddress
  );
  const flow = computeSmartMoneyFlowV1({ trades: matchedTrades, limit: 200 });

  return {
    flow,
    warnings: [...feed.warnings, ...flow.warnings],
  };
}

/*
Route examples:
/api/scoring/nova-conviction-v3-test?chain=eth&address=<token>&analysisMode=fast&forceRefresh=true&runId=<run>
/api/scoring/nova-conviction-v3-test?chain=eth&address=<token>&analysisMode=balanced&forceRefresh=true&runId=<run>
/api/scoring/nova-conviction-v3-test?chain=eth&address=<token>&analysisMode=deep&forceRefresh=true&runId=<run>
*/
export async function GET(request: Request) {
  const startedAt = Date.now();
  const { searchParams } = new URL(request.url);
  const runId = searchParams.get("runId")?.trim() || null;

  if (!process.env.GMGN_API_KEY) {
    return errorResponse(
      "Missing GMGN_API_KEY in server environment. Add it to .env.local or .env in the project root, then restart the Next.js server.",
      500,
      runId
    );
  }

  const chain = searchParams.get("chain")?.toLowerCase() || "";
  const address = searchParams.get("address")?.trim() || "";
  const parsedMode = parseAnalysisMode(searchParams.get("analysisMode"));
  const analysisMode = parsedMode.analysisMode;
  const effectiveModeConfig = getTop100HolderAlphaModeConfig(analysisMode);
  const forceRefresh = parseBoolean(searchParams.get("forceRefresh"));
  const walletMaxPages = parseBoundedInteger(
    searchParams.get("walletMaxPages"),
    DEFAULT_WALLET_MAX_PAGES,
    MAX_WALLET_MAX_PAGES
  );
  const walletMaxActivities = parseBoundedInteger(
    searchParams.get("walletMaxActivities"),
    DEFAULT_WALLET_MAX_ACTIVITIES,
    MAX_WALLET_MAX_ACTIVITIES
  );
  const maxTokens = parseBoundedInteger(
    searchParams.get("maxTokens"),
    DEFAULT_MAX_TOKENS,
    MAX_TOKENS
  );
  const concurrency = parseBoundedInteger(
    searchParams.get("concurrency"),
    DEFAULT_CONCURRENCY,
    MAX_CONCURRENCY
  );
  const interval = searchParams.get("interval") || "1h";

  if (!chain) return errorResponse("Missing chain parameter.", 400, runId);
  if (!SUPPORTED_CHAINS.has(chain)) return errorResponse("Unsupported chain. Use sol, bsc, base, or eth.", 400, runId);
  if (!address) return errorResponse("Missing address parameter.", 400, runId);
  if (!isValidAddress(chain, address)) return errorResponse("address must be a valid token address for the requested chain.", 400, runId);
  if (walletMaxPages === null) return errorResponse("walletMaxPages must be an integer from 1 to 50.", 400, runId);
  if (walletMaxActivities === null) return errorResponse("walletMaxActivities must be an integer from 1 to 5000.", 400, runId);
  if (maxTokens === null) return errorResponse("maxTokens must be an integer from 1 to 100.", 400, runId);
  if (concurrency === null) return errorResponse("concurrency must be an integer from 1 to 5.", 400, runId);
  if (!INTERVALS.has(interval)) return errorResponse("interval must be one of 1m, 5m, 15m, 1h, 4h, or 1d.", 400, runId);

  const warnings: string[] = [];
  if (parsedMode.warning) warnings.push(parsedMode.warning);
  const normalizedAddress = normalizeTop100HolderAlphaAddress(chain, address);

  let holderAlpha: Top100HolderAlphaV3Result | null = null;
  let smartMoneyFlow: SmartMoneyFlowResultV1 | null = null;
  let riskStats: GmgnRiskStats | null = null;
  let riskPressure: RiskPressureResultV1 | null = null;
  const structuralSafety = null;

  console.log("[Nova V3] Starting Holder Alpha", {
    chain,
    address: normalizedAddress,
    analysisMode,
    forceRefresh,
    runId,
  });
  console.log("[Nova V3] Holder Alpha input config", {
    chain,
    address: normalizedAddress,
    analysisMode,
    holderLimit: effectiveModeConfig.holderLimit,
    deepHolderLimit: effectiveModeConfig.deepHolderLimit,
    lightHolderLimit: effectiveModeConfig.lightHolderLimit,
    walletMaxPages,
    walletMaxActivities,
    maxTokens,
    interval,
    concurrency,
    forceRefresh,
    runId,
  });

  const holderAlphaStartedAt = Date.now();
  try {
    const holderAlphaRun = await runTop100HolderAlphaV3FromRequestConfig({
      chain,
      address: normalizedAddress,
      analysisMode,
      walletMaxActivities,
      walletMaxPages,
      maxTokens,
      interval: interval as KlineInterval,
      concurrency,
      forceRefresh,
      routeWarnings: warnings,
    });
    holderAlpha = holderAlphaRun.holderAlpha;
    warnings.push(...holderAlpha.warnings);
  } catch (error) {
    if (isGmgnRateLimitError(error)) {
      return gmgnRateLimitResponse({
        address: normalizedAddress,
        analysisMode,
        chain,
        error,
        requestRunId: runId,
        stage: "holder-alpha-execution",
      });
    }

    if (error instanceof Top100HolderAlphaZeroHoldersError) {
      return NextResponse.json(
        {
          success: false,
          error: "Top100 Holder Alpha fetched zero holders.",
          debug: error.debug,
        },
        { status: 500, headers: noStoreHeaders }
      );
    }

    return holderAlphaExecutionErrorResponse({
      address: normalizedAddress,
      analysisMode,
      chain,
      error,
      requestRunId: runId,
    });
  }

  console.log("[Nova V3] Holder Alpha completed", {
    runtimeMs: Date.now() - holderAlphaStartedAt,
    holderCount: holderAlpha?.holderCount,
    analyzedWalletCount: holderAlpha?.analyzedWalletCount,
    deepAnalyzedWalletCount: holderAlpha?.deepAnalyzedWalletCount,
    lightAnalyzedWalletCount: holderAlpha?.lightAnalyzedWalletCount,
    realLightWalletCount: holderAlpha?.realLightWalletCount,
    fallbackLightWalletCount: holderAlpha?.fallbackLightWalletCount,
    version: holderAlpha?.version,
  });

  const holderAlphaRateLimitWarning = holderAlpha?.warnings?.find(
    isGmgnRateLimitText
  );
  if (holderAlphaRateLimitWarning) {
    return gmgnRateLimitResponse({
      address: normalizedAddress,
      analysisMode,
      chain,
      error: holderAlphaRateLimitWarning,
      requestRunId: runId,
      stage: "holder-alpha-execution",
    });
  }

  try {
    riskStats = await fetchGmgnRiskStats({ chain, address: normalizedAddress });
    warnings.push(...riskStats.warnings);
    const riskStatsRateLimitWarning = riskStats.warnings.find(isGmgnRateLimitText);
    if (riskStatsRateLimitWarning) {
      return gmgnRateLimitResponse({
        address: normalizedAddress,
        analysisMode,
        chain,
        error: riskStatsRateLimitWarning,
        requestRunId: runId,
        stage: "risk-stats",
      });
    }
  } catch (error) {
    if (isGmgnRateLimitError(error)) {
      return gmgnRateLimitResponse({
        address: normalizedAddress,
        analysisMode,
        chain,
        error,
        requestRunId: runId,
        stage: "risk-stats",
      });
    }

    warnings.push(`GMGN Risk Stats failed: ${messageFromError(error)}`);
  }

  try {
    const smartMoney = await computeSmartMoneyFlow({
      chain,
      address: normalizedAddress,
    });
    smartMoneyFlow = smartMoney.flow;
    warnings.push(...smartMoney.warnings);
    const smartMoneyRateLimitWarning = smartMoney.warnings.find(isGmgnRateLimitText);
    if (smartMoneyRateLimitWarning) {
      return gmgnRateLimitResponse({
        address: normalizedAddress,
        analysisMode,
        chain,
        error: smartMoneyRateLimitWarning,
        requestRunId: runId,
        stage: "smart-money-flow",
      });
    }
  } catch (error) {
    if (isGmgnRateLimitError(error)) {
      return gmgnRateLimitResponse({
        address: normalizedAddress,
        analysisMode,
        chain,
        error,
        requestRunId: runId,
        stage: "smart-money-flow",
      });
    }

    warnings.push(`Smart Money Flow failed: ${messageFromError(error)}`);
  }

  try {
    riskPressure = computeRiskPressureV1({
      riskStats,
      holderAlpha: null,
      holderAlphaContext: buildHolderAlphaRiskContext(holderAlpha),
      behavioralConviction: null,
      structuralSafety,
      coverage: holderAlpha
        ? {
            walletCount: holderAlpha.analyzedWalletCount,
            walletsReachedEndOfHistory: null,
            walletsStoppedByPageLimit: null,
            walletsStoppedByActivityLimit: null,
            averageActivitiesPerWallet: null,
            highConfidenceCount: null,
            mediumConfidenceCount: null,
            lowConfidenceCount: null,
          }
        : null,
      warnings,
    });
    warnings.push(...riskPressure.warnings);
  } catch (error) {
    warnings.push(`Risk Pressure failed: ${messageFromError(error)}`);
  }

  const holderAlphaDepth = buildHolderAlphaDepth(
    holderAlpha,
    effectiveModeConfig
  );
  const holderDepthInvariantError = holderAlphaDepthInvariantError(holderAlphaDepth);
  const holderAlphaExposedRows = holderAlpha
    ? {
        allWalletsByHolderRank: holderAlpha.allWalletsByHolderRank.length,
        allWalletsByAlphaV3: holderAlpha.allWalletsByAlphaV3.length,
        topWalletsByAlphaV3: holderAlpha.topWalletsByAlphaV3.length,
        bottomWalletsByAlphaV3: holderAlpha.bottomWalletsByAlphaV3.length,
        expectedAnalyzedWalletCount: holderAlphaDepth.analyzedWalletCount,
      }
    : {
        allWalletsByHolderRank: 0,
        allWalletsByAlphaV3: 0,
        topWalletsByAlphaV3: 0,
        bottomWalletsByAlphaV3: 0,
        expectedAnalyzedWalletCount: holderAlphaDepth.analyzedWalletCount,
      };

  if (
    holderAlpha &&
    holderAlpha.allWalletsByHolderRank.length < holderAlphaDepth.analyzedWalletCount
  ) {
    console.warn("[Nova V3] Holder Alpha exposed fewer rows than analyzed.", {
      holderAlphaExposedRows,
      analysisMode,
      chain,
      address: normalizedAddress,
      runId,
    });
  }

  if (holderDepthInvariantError) {
    return holderDepthErrorResponse({
      requestRunId: runId,
      holderAlphaDepth,
      debug: {
        stage: "holder-alpha-depth-validation",
        reason: holderDepthInvariantError,
        analysisMode,
        chain,
        address: normalizedAddress,
        holderAlphaResultKeys: Object.keys(holderAlpha ?? {}),
        holderAlphaVersion: holderAlpha?.version ?? null,
        holderAlphaWarnings: holderAlpha?.warnings?.slice?.(0, 10) ?? [],
        warnings,
        holderAlphaAvailable: Boolean(holderAlpha),
      },
    });
  }

  warnings.push("Structural Safety engine was not computed in Nova Conviction V3 MVP route; its Conviction weight is redistributed.");

  const conviction = computeNovaConvictionV3({
    holderAlpha,
    smartMoneyFlow,
    structuralSafety,
    riskPressure,
    riskStats,
    warnings,
  });

  return NextResponse.json({
    success: true,
    version: conviction.version,
    requestRunId: runId,
    chain,
    address: normalizedAddress,
    analysisMode,
    runtimeMs: Date.now() - startedAt,
    forceRefresh,
    novaConvictionScore: conviction.novaConvictionScore,
    convictionTier: conviction.convictionTier,
    scores: conviction.scores,
    risk: conviction.risk,
    thesis: conviction.thesis,
    scoreBreakdown: conviction.scoreBreakdown,
    moduleSummaries: {
      holderAlpha: holderAlpha
        ? {
            score: holderAlpha.holderAlphaV3Score,
            weightedWalletAlphaV3: holderAlpha.weightedWalletAlphaV3,
            simpleAverageWalletAlphaV3: holderAlpha.simpleAverageWalletAlphaV3,
            holderCompositionScore: holderAlpha.holderCompositionScore,
            confidenceScore: holderAlpha.confidenceScore,
            holderSetCoverageScore: holderAlpha.holderSetCoverageScore,
            goodOrBetterOwnershipPercent: holderAlpha.goodOrBetterOwnershipPercent,
            weakOrToxicOwnershipPercent: holderAlpha.weakOrToxicOwnershipPercent,
            smartLikeOwnershipPercent: holderAlpha.smartLikeOwnershipPercent,
            sniperLikeOwnershipPercent: holderAlpha.sniperLikeOwnershipPercent,
            bundlerLikeOwnershipPercent: holderAlpha.bundlerLikeOwnershipPercent,
            suspiciousLikeOwnershipPercent: holderAlpha.suspiciousLikeOwnershipPercent,
            freshLikeOwnershipPercent: holderAlpha.freshLikeOwnershipPercent,
            whaleLikeOwnershipPercent: holderAlpha.whaleLikeOwnershipPercent,
            holderCompositionThesis: holderAlpha.holderCompositionThesis,
            topWalletsByAlphaV3: holderAlpha.topWalletsByAlphaV3,
            bottomWalletsByAlphaV3: holderAlpha.bottomWalletsByAlphaV3,
            allWalletsByHolderRank: holderAlpha.allWalletsByHolderRank,
            allWalletsByAlphaV3: holderAlpha.allWalletsByAlphaV3,
            analysisMode: holderAlphaDepth.analysisMode,
            deepAnalyzedWalletCount: holderAlphaDepth.deepAnalyzedWalletCount,
            lightAnalyzedWalletCount: holderAlphaDepth.lightAnalyzedWalletCount,
            realLightWalletCount: holderAlphaDepth.realLightWalletCount,
            fallbackLightWalletCount: holderAlphaDepth.fallbackLightWalletCount,
            deepHolderLimit: holderAlphaDepth.deepHolderLimit,
            lightHolderLimit: holderAlphaDepth.lightHolderLimit,
            holderCount: holderAlphaDepth.holderCount,
            analyzedWalletCount: holderAlphaDepth.analyzedWalletCount,
            failedWalletCount: holderAlphaDepth.failedWalletCount,
            holderAlphaDepth,
          }
        : null,
      smartMoneyFlow,
      riskPressure,
      riskStats,
      structuralSafety,
    },
    holderAlphaDepth,
    debug: {
      holderAlphaDepth,
      holderAlphaExposedRows,
    },
    warnings: conviction.warnings,
  }, { headers: noStoreHeaders });
}
