import { NextResponse } from "next/server";
import {
  getTop100HolderAlphaModeConfig,
  runTop100HolderAlphaV3FromRequestConfig,
  Top100HolderAlphaZeroHoldersError,
  type KlineInterval,
} from "@/lib/run-top100-holder-alpha-v3";
import type { AnalysisMode } from "@/lib/top100-holder-alpha-v3-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function errorResponse(error: string, status = 400, debug?: unknown) {
  return NextResponse.json({ success: false, error, debug }, { status });
}

function parseBoundedInteger(value: string | null, defaultValue: number, max: number) {
  if (!value) return defaultValue;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return null;

  return Math.min(parsed, max);
}

function parseBoolean(value: string | null) {
  return value === "true" || value === "1";
}

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

function isValidAddress(chain: string, address: string) {
  return chain === "sol"
    ? SOL_ADDRESS_PATTERN.test(address)
    : EVM_ADDRESS_PATTERN.test(address);
}

export async function GET(request: Request) {
  const startedAt = Date.now();

  if (!process.env.GMGN_API_KEY) {
    return errorResponse(
      "Missing GMGN_API_KEY in server environment. Add it to .env.local or .env in the project root, then restart the Next.js server.",
      500
    );
  }

  const { searchParams } = new URL(request.url);
  const chain = searchParams.get("chain")?.toLowerCase() || "";
  const address = searchParams.get("address")?.trim() || "";
  const parsedMode = parseAnalysisMode(searchParams.get("analysisMode"));
  const analysisMode = parsedMode.analysisMode;
  const modeConfig = getTop100HolderAlphaModeConfig(analysisMode);
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
  const forceRefresh = parseBoolean(searchParams.get("forceRefresh"));

  if (!chain) return errorResponse("Missing chain parameter.");
  if (!SUPPORTED_CHAINS.has(chain)) {
    return errorResponse("Unsupported chain. Use sol, bsc, base, or eth.");
  }
  if (!address) return errorResponse("Missing address parameter.");
  if (!isValidAddress(chain, address)) {
    return errorResponse("address must be a valid token address for the requested chain.");
  }
  if (walletMaxPages === null) return errorResponse("walletMaxPages must be an integer from 1 to 50.");
  if (walletMaxActivities === null) {
    return errorResponse("walletMaxActivities must be an integer from 1 to 5000.");
  }
  if (maxTokens === null) return errorResponse("maxTokens must be an integer from 1 to 100.");
  if (concurrency === null) return errorResponse("concurrency must be an integer from 1 to 5.");
  if (!INTERVALS.has(interval)) return errorResponse("interval must be one of 1m, 5m, 15m, 1h, 4h, or 1d.");

  try {
    const routeWarnings: string[] = [];
    if (parsedMode.warning) routeWarnings.push(parsedMode.warning);
    if (searchParams.has("holderLimit")) {
      routeWarnings.push("holderLimit is controlled by analysisMode and was ignored.");
    }

    const { holderAlpha, normalizedAddress } =
      await runTop100HolderAlphaV3FromRequestConfig({
        chain,
        address,
        analysisMode,
        walletMaxPages,
        walletMaxActivities,
        maxTokens,
        interval: interval as KlineInterval,
        concurrency,
        forceRefresh,
        routeWarnings,
      });

    return NextResponse.json({
      success: true,
      chain,
      address: normalizedAddress,
      runtimeMs: Date.now() - startedAt,
      forceRefresh,
      config: {
        analysisMode,
        effectiveModeConfig: modeConfig,
        holderLimit: modeConfig.holderLimit,
        deepHolderLimit: modeConfig.deepHolderLimit,
        lightHolderLimit: modeConfig.lightHolderLimit,
        estimatedCostLevel: modeConfig.estimatedCostLevel,
        walletMaxPages,
        walletMaxActivities,
        maxTokens,
        interval,
        concurrency,
      },
      ...holderAlpha,
      analysisMode,
      effectiveModeConfig: modeConfig,
      holderLimit: modeConfig.holderLimit,
      deepHolderLimit: modeConfig.deepHolderLimit,
      lightHolderLimit: modeConfig.lightHolderLimit,
      deepAnalyzedWalletCount: holderAlpha.deepAnalyzedWalletCount,
      lightAnalyzedWalletCount: holderAlpha.lightAnalyzedWalletCount,
      realLightWalletCount: holderAlpha.realLightWalletCount,
      fallbackLightWalletCount: holderAlpha.fallbackLightWalletCount,
      failedWalletCount: holderAlpha.failedWalletCount,
      estimatedCostLevel: holderAlpha.estimatedCostLevel,
    });
  } catch (error) {
    if (error instanceof Top100HolderAlphaZeroHoldersError) {
      return errorResponse(error.message, 500, error.debug);
    }

    return errorResponse(
      error instanceof Error
        ? error.message
        : "Top100 Holder Alpha V3 test request failed.",
      500
    );
  }
}
