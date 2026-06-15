import { NextResponse } from "next/server";
import { computeBehavioralConvictionV1 } from "@/lib/behavioral-conviction-engine";
import type { BehavioralConvictionResultV1 } from "@/lib/behavioral-conviction-engine";
import { fetchGmgnRiskStats } from "@/lib/gmgn-risk-stats";
import type { GmgnRiskStats } from "@/lib/gmgn-risk-stats";
import { computeRiskPressureV1 } from "@/lib/risk-pressure-engine";
import { computeStructuralSafetyV1 } from "@/lib/structural-safety-engine";
import type { StructuralSafetyResultV1 } from "@/lib/structural-safety-engine";
import { GMGNProviderPrimary } from "@/lib/token-data-provider";
import { computeTop100HolderAlphaV1 } from "@/lib/top100-holder-alpha-engine";
import type { Top100HolderAlphaResultV1 } from "@/lib/top100-holder-alpha-engine";
import { computeWalletAlphaBatchV2, type WalletAlphaResultV2 } from "@/lib/wallet-alpha-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORTED_CHAINS = new Set(["eth", "base", "bsc", "sol", "mantle"]);
const DEFAULT_HOLDER_LIMIT = 100;
const MAX_HOLDER_LIMIT = 100;
const DEFAULT_ACTIVITY_LIMIT = 100;
const DEFAULT_CONCURRENCY = 2;
const MAX_CONCURRENCY = 3;
const DEFAULT_HARD_MAX_PAGES = 50;
const MAX_HARD_MAX_PAGES = 100;
const DEFAULT_WALLET_MAX_ACTIVITIES = 2000;
const MAX_WALLET_MAX_ACTIVITIES = 5000;
const HISTORY_MODES = new Set(["firstPage", "bounded", "full"]);
const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const SOL_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function errorResponse(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
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

function parseHistoryMode(value: string | null) {
  if (!value) return "full";
  if (!HISTORY_MODES.has(value)) return null;
  return value as "firstPage" | "bounded" | "full";
}

function isValidAddress(chain: string, address: string) {
  return chain === "sol"
    ? SOL_ADDRESS_PATTERN.test(address)
    : EVM_ADDRESS_PATTERN.test(address);
}

function messageFromError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function countConfidence(walletAlphaBatch: WalletAlphaResultV2[]) {
  return {
    highConfidenceCount: walletAlphaBatch.filter(
      (wallet) => wallet.confidenceLevel === "high"
    ).length,
    mediumConfidenceCount: walletAlphaBatch.filter(
      (wallet) => wallet.confidenceLevel === "medium"
    ).length,
    lowConfidenceCount: walletAlphaBatch.filter(
      (wallet) => wallet.confidenceLevel === "low"
    ).length,
  };
}

export async function GET(request: Request) {
  if (!process.env.GMGN_API_KEY) {
    return errorResponse(
      "Missing GMGN_API_KEY in server environment. Add it to .env.local or .env in the project root, then restart the Next.js server.",
      500
    );
  }

  const { searchParams } = new URL(request.url);
  const chain = searchParams.get("chain")?.toLowerCase() || "";
  const address = searchParams.get("address")?.trim() || "";
  const holderLimit = parseBoundedInteger(
    searchParams.get("holderLimit"),
    DEFAULT_HOLDER_LIMIT,
    MAX_HOLDER_LIMIT
  );
  const concurrency = parseBoundedInteger(
    searchParams.get("concurrency"),
    DEFAULT_CONCURRENCY,
    MAX_CONCURRENCY
  );
  const historyMode = parseHistoryMode(searchParams.get("historyMode"));
  const hardMaxPages = parseBoundedInteger(
    searchParams.get("hardMaxPages"),
    DEFAULT_HARD_MAX_PAGES,
    MAX_HARD_MAX_PAGES
  );
  const walletMaxActivities = parseBoundedInteger(
    searchParams.get("walletMaxActivities"),
    DEFAULT_WALLET_MAX_ACTIVITIES,
    MAX_WALLET_MAX_ACTIVITIES
  );
  const forceRefresh = parseBoolean(searchParams.get("forceRefresh"));

  if (!chain) return errorResponse("Missing chain parameter.");
  if (!SUPPORTED_CHAINS.has(chain)) {
    return errorResponse("Unsupported chain. Use eth, base, bsc, sol, or mantle.");
  }

  if (!address) return errorResponse("Missing address parameter.");
  if (!isValidAddress(chain, address)) {
    return errorResponse("address must be a valid token address for the requested chain.");
  }

  if (holderLimit === null) {
    return errorResponse("holderLimit must be an integer from 1 to 100.");
  }

  if (concurrency === null) {
    return errorResponse("concurrency must be an integer from 1 to 3.");
  }

  if (historyMode === null) {
    return errorResponse("historyMode must be firstPage, bounded, or full.");
  }

  if (hardMaxPages === null) {
    return errorResponse("hardMaxPages must be an integer from 1 to 100.");
  }

  if (walletMaxActivities === null) {
    return errorResponse("walletMaxActivities must be an integer from 1 to 5000.");
  }

  const warnings: string[] = [];
  let riskStats: GmgnRiskStats | null = null;
  let holderAlpha: Top100HolderAlphaResultV1 | null = null;
  let behavioralConviction: BehavioralConvictionResultV1 | null = null;
  let structuralSafety: StructuralSafetyResultV1 | null = null;
  let coverage: {
    walletCount: number | null;
    walletsReachedEndOfHistory: number | null;
    walletsStoppedByPageLimit: number | null;
    walletsStoppedByActivityLimit: number | null;
    averageActivitiesPerWallet: number | null;
    highConfidenceCount: number | null;
    mediumConfidenceCount: number | null;
    lowConfidenceCount: number | null;
  } | null = null;

  try {
    riskStats = await fetchGmgnRiskStats({ chain, address });
    warnings.push(...riskStats.warnings);
  } catch (error) {
    warnings.push(`GMGN Risk Stats failed: ${messageFromError(error, "unknown error")}`);
  }

  try {
    const providerResult = await GMGNProviderPrimary.getTop100DeepSnapshot(
      chain,
      address,
      {
        limit: holderLimit,
        activityLimit: DEFAULT_ACTIVITY_LIMIT,
        concurrency,
        includeRaw: true,
        debug: false,
        historyMode,
        hardMaxPages,
        walletMaxActivities,
      }
    );
    warnings.push(...providerResult.warnings);

    const walletAlphaBatch = computeWalletAlphaBatchV2(providerResult.data.holders);
    const confidenceCounts = countConfidence(walletAlphaBatch);

    coverage = {
      walletCount: walletAlphaBatch.length,
      walletsReachedEndOfHistory: providerResult.data.walletsReachedEndOfHistory,
      walletsStoppedByPageLimit: providerResult.data.walletsStoppedByPageLimit,
      walletsStoppedByActivityLimit: providerResult.data.walletsStoppedByActivityLimit,
      averageActivitiesPerWallet: providerResult.data.holdersAnalyzed
        ? Number(
            (
              providerResult.data.totalActivities / providerResult.data.holdersAnalyzed
            ).toFixed(2)
          )
        : null,
      ...confidenceCounts,
    };

    try {
      holderAlpha = computeTop100HolderAlphaV1(walletAlphaBatch);
    } catch (error) {
      warnings.push(`Top100 Holder Alpha module failed: ${messageFromError(error, "unknown error")}`);
    }

    try {
      behavioralConviction = computeBehavioralConvictionV1(providerResult.data.holders);
    } catch (error) {
      warnings.push(`Behavioral Conviction module failed: ${messageFromError(error, "unknown error")}`);
    }

    try {
      structuralSafety = computeStructuralSafetyV1(walletAlphaBatch);
    } catch (error) {
      warnings.push(`Structural Safety module failed: ${messageFromError(error, "unknown error")}`);
    }
  } catch (error) {
    warnings.push(`GMGN Top100 snapshot failed: ${messageFromError(error, "unknown error")}`);
  }

  const riskPressure = computeRiskPressureV1({
    riskStats,
    holderAlpha,
    behavioralConviction,
    structuralSafety,
    coverage,
    warnings,
  });

  return NextResponse.json({
    success: true,
    chain,
    address,
    historyMode,
    forceRefresh,
    ...riskPressure,
  });
}
