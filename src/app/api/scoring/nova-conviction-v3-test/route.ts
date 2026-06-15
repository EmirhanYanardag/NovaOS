import { NextResponse } from "next/server";
import { GmgnDirectNonJsonError } from "@/lib/gmgn";
import { fetchGmgnRiskStats, type GmgnRiskStats } from "@/lib/gmgn-risk-stats";
import { fetchGmgnSmartMoneyTrades } from "@/lib/gmgn-smart-money-trades";
import { computeNovaConvictionV3 } from "@/lib/nova-conviction-v3-engine";
import { loadPrecomputedNovaV3Scan } from "@/lib/precomputed-scans";
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
const IS_VERCEL_RUNTIME = Boolean(process.env.VERCEL);
const CHILD_PROCESS_USED = !IS_VERCEL_RUNTIME && process.env.GMGN_DIRECT_HTTP !== "true";
const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const SOL_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const GMGN_PRODUCTION_BLOCKED_REASON = "GMGN production HTTP blocked by Cloudflare";

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

function sanitizeError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error ?? "unknown error");
  return raw
    .replace(process.env.GMGN_API_KEY || "__NO_KEY__", "[redacted]")
    .replace(/https?:\/\/[^\s)]+/g, (url) => {
      try {
        const parsed = new URL(url);
        return `${parsed.origin}${parsed.pathname}`;
      } catch {
        return "[url]";
      }
    })
    .slice(0, 500);
}

function shouldExposeDebug(searchParams: URLSearchParams) {
  return searchParams.get("debug") === "true" && process.env.NODE_ENV !== "production";
}

function productionLog(
  event: string,
  payload: Record<string, unknown>
) {
  console.log(`[Nova V3] ${event}`, {
    hasGMGNKey: Boolean(process.env.GMGN_API_KEY),
    holderAlphaSource: IS_VERCEL_RUNTIME || process.env.GMGN_DIRECT_HTTP === "true"
      ? "direct-http"
      : "local-cli-fallback",
    childProcessUsed: CHILD_PROCESS_USED,
    ...payload,
  });
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
  exposeDebug,
  runtimeMs,
  requestRunId,
}: {
  address: string;
  analysisMode: AnalysisMode;
  chain: string;
  error: unknown;
  exposeDebug: boolean;
  runtimeMs: number;
  requestRunId: string | null;
}) {
  const sanitizedError = sanitizeError(error);
  const debug = {
    hasGMGNKey: Boolean(process.env.GMGN_API_KEY),
    failingStep: "holder-alpha-execution",
    sanitizedError,
    holderAlphaSource: IS_VERCEL_RUNTIME || process.env.GMGN_DIRECT_HTTP === "true"
      ? "direct-http"
      : "local-cli-fallback",
    runtimeMs,
    walletIndex: null,
    childProcessUsed: CHILD_PROCESS_USED,
    chain,
    address,
    analysisMode,
    runId: requestRunId,
  };

  productionLog("Holder Alpha execution failed", debug);

  return NextResponse.json(
    {
      success: false,
      error: "Holder Alpha source unavailable. Nova Conviction V3 could not start holder analysis.",
      errorCode: "HOLDER_ALPHA_SOURCE_UNAVAILABLE",
      requestRunId,
      ...(exposeDebug ? { debug } : {}),
    },
    { status: 502, headers: noStoreHeaders }
  );
}

function gmgnTopHoldersNonJsonResponse({
  error,
  requestRunId,
  runtimeMs,
}: {
  error: GmgnDirectNonJsonError;
  requestRunId: string | null;
  runtimeMs: number;
}) {
  const diagnostic = error.diagnostics;
  const sanitizedDiagnostics = {
    baseUsed: diagnostic.baseUsed,
    endpointPath: diagnostic.endpointPath,
    status: diagnostic.status,
    contentType: diagnostic.contentType,
    responsePreview: diagnostic.responsePreview,
    hasGMGNKey: diagnostic.hasGMGNKey,
  };

  productionLog("GMGN top holders returned non-json", {
    failingStep: diagnostic.failingStep,
    sanitizedError: diagnostic.responseClassification,
    runtimeMs,
    walletIndex: null,
    baseUsed: diagnostic.baseUsed,
    endpointPath: diagnostic.endpointPath,
    status: diagnostic.status,
    contentType: diagnostic.contentType,
    responsePreview: diagnostic.responsePreview,
    requestHeaders: diagnostic.requestHeaders,
    responseClassification: diagnostic.responseClassification,
    runId: requestRunId,
  });

  return NextResponse.json(
    {
      success: false,
      error: "GMGN top holders returned a non-JSON response.",
      errorCode: "GMGN_TOP_HOLDERS_NON_JSON",
      requestRunId,
      diagnostics: sanitizedDiagnostics,
    },
    { status: 502, headers: noStoreHeaders }
  );
}

async function gmgnBlockedWithPrecomputedFallbackResponse({
  address,
  analysisMode,
  chain,
  error,
  requestRunId,
  runtimeMs,
}: {
  address: string;
  analysisMode: AnalysisMode;
  chain: string;
  error: GmgnDirectNonJsonError;
  requestRunId: string | null;
  runtimeMs: number;
}) {
  const diagnostic = error.diagnostics;

  productionLog("GMGN production blocked; checking precomputed scan cache", {
    failingStep: diagnostic.failingStep,
    sanitizedError: diagnostic.responseClassification,
    runtimeMs,
    walletIndex: null,
    baseUsed: diagnostic.baseUsed,
    endpointPath: diagnostic.endpointPath,
    status: diagnostic.status,
    contentType: diagnostic.contentType,
    responsePreview: diagnostic.responsePreview,
    chain,
    address,
    analysisMode,
    runId: requestRunId,
  });

  const cachedScan = await loadPrecomputedNovaV3Scan({
    address,
    analysisMode,
    chain,
    fallbackReason: GMGN_PRODUCTION_BLOCKED_REASON,
    requestRunId,
  });

  if (cachedScan) {
    productionLog("Serving precomputed real Nova V3 scan", {
      failingStep: null,
      runtimeMs,
      walletIndex: null,
      chain,
      address,
      analysisMode,
      dataSource: "precomputed-real-scan",
      productionFallback: true,
      runId: requestRunId,
    });

    return NextResponse.json(cachedScan, { headers: noStoreHeaders });
  }

  productionLog("GMGN production blocked and no precomputed scan exists", {
    failingStep: diagnostic.failingStep,
    sanitizedError: diagnostic.responseClassification,
    runtimeMs,
    walletIndex: null,
    chain,
    address,
    analysisMode,
    baseUsed: diagnostic.baseUsed,
    endpointPath: diagnostic.endpointPath,
    status: diagnostic.status,
    contentType: diagnostic.contentType,
    runId: requestRunId,
  });

  return NextResponse.json(
    {
      success: false,
      errorCode: "GMGN_PRODUCTION_BLOCKED_NO_CACHE",
      message: "GMGN production HTTP is blocked and no real precomputed scan exists for this token.",
      error: "GMGN production HTTP is blocked and no real precomputed scan exists for this token.",
      requestRunId,
    },
    { status: 502, headers: noStoreHeaders }
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
  const exposeDebug = shouldExposeDebug(searchParams);

  if (!process.env.GMGN_API_KEY) {
    const debug = {
      hasGMGNKey: false,
      failingStep: "env-validation",
      sanitizedError: "Missing GMGN_API_KEY",
      holderAlphaSource: IS_VERCEL_RUNTIME ? "direct-http" : "local-cli-fallback",
      runtimeMs: Date.now() - startedAt,
      walletIndex: null,
      childProcessUsed: CHILD_PROCESS_USED,
    };
    productionLog("Missing GMGN_API_KEY", debug);

    return NextResponse.json(
      {
        success: false,
        error: "GMGN provider credentials are not configured in production.",
        errorCode: "GMGN_MISSING_API_KEY",
        requestRunId: runId,
        ...(exposeDebug ? { debug } : {}),
      },
      { status: 500, headers: noStoreHeaders }
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

  productionLog("Starting Holder Alpha", {
    chain,
    address: normalizedAddress,
    analysisMode,
    forceRefresh,
    failingStep: "holder-alpha-start",
    runtimeMs: Date.now() - startedAt,
    runId,
  });
  productionLog("Holder Alpha input config", {
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
    failingStep: "holder-alpha-config",
    runtimeMs: Date.now() - startedAt,
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
    if (error instanceof GmgnDirectNonJsonError) {
      if (IS_VERCEL_RUNTIME) {
        return gmgnBlockedWithPrecomputedFallbackResponse({
          address: normalizedAddress,
          analysisMode,
          chain,
          error,
          requestRunId: runId,
          runtimeMs: Date.now() - holderAlphaStartedAt,
        });
      }

      return gmgnTopHoldersNonJsonResponse({
        error,
        requestRunId: runId,
        runtimeMs: Date.now() - holderAlphaStartedAt,
      });
    }

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
      const debug = {
        hasGMGNKey: Boolean(process.env.GMGN_API_KEY),
        failingStep: "top-holders-fetch",
        sanitizedError: sanitizeError(error),
        holderAlphaSource: IS_VERCEL_RUNTIME || process.env.GMGN_DIRECT_HTTP === "true"
          ? "direct-http"
          : "local-cli-fallback",
        runtimeMs: Date.now() - holderAlphaStartedAt,
        walletIndex: null,
        childProcessUsed: CHILD_PROCESS_USED,
        sourceDebug: error.debug,
      };
      productionLog("Top holders fetched zero rows", debug);

      return NextResponse.json(
        {
          success: false,
          error: "Top100 Holder Alpha fetched zero holders.",
          errorCode: "HOLDER_ALPHA_ZERO_HOLDERS",
          requestRunId: runId,
          ...(exposeDebug ? { debug } : {}),
        },
        { status: 502, headers: noStoreHeaders }
      );
    }

    return holderAlphaExecutionErrorResponse({
      address: normalizedAddress,
      analysisMode,
      chain,
      error,
      exposeDebug,
      runtimeMs: Date.now() - holderAlphaStartedAt,
      requestRunId: runId,
    });
  }

  productionLog("Holder Alpha completed", {
    runtimeMs: Date.now() - holderAlphaStartedAt,
    failingStep: null,
    holderCount: holderAlpha?.holderCount,
    analyzedWalletCount: holderAlpha?.analyzedWalletCount,
    failedWalletCount: holderAlpha?.failedWalletCount,
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
    const depthWarning = `Holder Alpha depth validation warning: ${holderDepthInvariantError}. Continuing with ${holderAlphaDepth.analyzedWalletCount} analyzed wallet(s).`;
    warnings.push(depthWarning);
    productionLog("Holder Alpha depth validation warning", {
      failingStep: "holder-alpha-depth-validation",
      sanitizedError: holderDepthInvariantError,
      runtimeMs: Date.now() - startedAt,
      walletIndex: null,
      holderAlphaDepth,
      holderAlphaExposedRows,
      warnings: warnings.slice(-5),
    });

    if (holderAlphaDepth.analyzedWalletCount <= 0) {
      return holderDepthErrorResponse({
        requestRunId: runId,
        holderAlphaDepth,
        debug: {
          failingStep: "holder-alpha-depth-validation",
          sanitizedError: holderDepthInvariantError,
          analysisMode,
          chain,
          address: normalizedAddress,
          holderAlphaResultKeys: Object.keys(holderAlpha ?? {}),
          holderAlphaVersion: holderAlpha?.version ?? null,
          holderAlphaWarnings: holderAlpha?.warnings?.slice?.(0, 10) ?? [],
          warnings,
          holderAlphaAvailable: Boolean(holderAlpha),
          runtimeMs: Date.now() - startedAt,
          childProcessUsed: CHILD_PROCESS_USED,
        },
      });
    }
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
      hasGMGNKey: Boolean(process.env.GMGN_API_KEY),
      holderAlphaSource: IS_VERCEL_RUNTIME || process.env.GMGN_DIRECT_HTTP === "true"
        ? "direct-http"
        : "local-cli-fallback",
      childProcessUsed: CHILD_PROCESS_USED,
      runtimeMs: Date.now() - startedAt,
    },
    warnings: conviction.warnings,
  }, { headers: noStoreHeaders });
}
