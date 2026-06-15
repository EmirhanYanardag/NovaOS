import { NextResponse } from "next/server";
import { computeStructuralSafetyV1 } from "@/lib/structural-safety-engine";
import { GMGNProviderPrimary } from "@/lib/token-data-provider";
import { computeWalletAlphaBatchV2 } from "@/lib/wallet-alpha-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORTED_CHAINS = new Set(["eth", "base", "bsc", "sol", "mantle"]);
const DEFAULT_HOLDER_LIMIT = 100;
const MAX_HOLDER_LIMIT = 100;
const DEFAULT_ACTIVITY_LIMIT = 100;
const MAX_ACTIVITY_LIMIT = 100;
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
  const activityLimit = parseBoundedInteger(
    searchParams.get("activityLimit"),
    DEFAULT_ACTIVITY_LIMIT,
    MAX_ACTIVITY_LIMIT
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

  if (activityLimit === null) {
    return errorResponse("activityLimit must be an integer from 1 to 100.");
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

  try {
    const providerResult = await GMGNProviderPrimary.getTop100DeepSnapshot(
      chain,
      address,
      {
        limit: holderLimit,
        activityLimit,
        concurrency,
        includeRaw: true,
        debug: false,
        historyMode,
        hardMaxPages,
        walletMaxActivities,
      }
    );
    const walletAlphaBatch = computeWalletAlphaBatchV2(providerResult.data.holders);
    const structuralSafety = computeStructuralSafetyV1(walletAlphaBatch);

    return NextResponse.json({
      success: true,
      chain,
      address,
      historyMode: providerResult.data.historyMode,
      forceRefresh,
      ...structuralSafety,
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error
        ? error.message
        : "Structural Safety test request failed.",
      500
    );
  }
}
