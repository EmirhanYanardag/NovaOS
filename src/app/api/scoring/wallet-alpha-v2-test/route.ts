import { NextResponse } from "next/server";
import { GMGNProviderPrimary } from "@/lib/token-data-provider";
import { computeWalletAlphaBatchV2 } from "@/lib/wallet-alpha-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORTED_CHAINS = new Set(["eth", "base", "bsc", "sol", "mantle"]);
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 100;
const DEFAULT_CONCURRENCY = 3;
const MAX_CONCURRENCY = 5;
const DEFAULT_FULL_CONCURRENCY = 2;
const MAX_FULL_CONCURRENCY = 3;
const DEFAULT_WALLET_MAX_PAGES = 3;
const MAX_WALLET_MAX_PAGES = 10;
const DEFAULT_WALLET_MAX_ACTIVITIES = 200;
const MAX_WALLET_MAX_ACTIVITIES = 500;
const DEFAULT_FULL_HARD_MAX_PAGES = 50;
const MAX_FULL_HARD_MAX_PAGES = 100;
const DEFAULT_FULL_MAX_ACTIVITIES = 2000;
const MAX_FULL_MAX_ACTIVITIES = 5000;
const HISTORY_MODES = new Set(["firstPage", "bounded", "full"]);
const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const SOL_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function errorResponse(error: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    { status }
  );
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
  if (!value) return "bounded";
  if (!HISTORY_MODES.has(value)) return null;
  return value as "firstPage" | "bounded" | "full";
}

function isValidAddress(chain: string, address: string) {
  return chain === "sol"
    ? SOL_ADDRESS_PATTERN.test(address)
    : EVM_ADDRESS_PATTERN.test(address);
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
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
    DEFAULT_LIMIT,
    MAX_LIMIT
  );
  const activityLimit = parseBoundedInteger(
    searchParams.get("activityLimit"),
    DEFAULT_LIMIT,
    MAX_LIMIT
  );
  const deepHistory = parseBoolean(searchParams.get("deepHistory"));
  const historyMode = parseHistoryMode(searchParams.get("historyMode"));
  const isFullHistoryMode = historyMode === "full";
  const concurrency = parseBoundedInteger(
    searchParams.get("concurrency"),
    isFullHistoryMode ? DEFAULT_FULL_CONCURRENCY : DEFAULT_CONCURRENCY,
    isFullHistoryMode ? MAX_FULL_CONCURRENCY : MAX_CONCURRENCY
  );
  const forceRefresh = parseBoolean(searchParams.get("forceRefresh"));
  const walletMaxPages = parseBoundedInteger(
    searchParams.get("walletMaxPages"),
    DEFAULT_WALLET_MAX_PAGES,
    MAX_WALLET_MAX_PAGES
  );
  const hardMaxPages = parseBoundedInteger(
    searchParams.get("hardMaxPages"),
    DEFAULT_FULL_HARD_MAX_PAGES,
    MAX_FULL_HARD_MAX_PAGES
  );
  const walletMaxActivities = parseBoundedInteger(
    searchParams.get("walletMaxActivities"),
    isFullHistoryMode ? DEFAULT_FULL_MAX_ACTIVITIES : DEFAULT_WALLET_MAX_ACTIVITIES,
    isFullHistoryMode ? MAX_FULL_MAX_ACTIVITIES : MAX_WALLET_MAX_ACTIVITIES
  );

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
    return errorResponse(
      isFullHistoryMode
        ? "concurrency must be an integer from 1 to 3 for full history mode."
        : "concurrency must be an integer from 1 to 5."
    );
  }

  if (historyMode === null) {
    return errorResponse("historyMode must be firstPage, bounded, or full.");
  }

  if (walletMaxPages === null) {
    return errorResponse("walletMaxPages must be an integer from 1 to 10.");
  }

  if (hardMaxPages === null) {
    return errorResponse("hardMaxPages must be an integer from 1 to 100.");
  }

  if (walletMaxActivities === null) {
    return errorResponse(
      isFullHistoryMode
        ? "walletMaxActivities must be an integer from 1 to 5000 for full history mode."
        : "walletMaxActivities must be an integer from 1 to 500."
    );
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
        deepHistory,
        historyMode,
        walletMaxPages,
        hardMaxPages,
        walletMaxActivities,
      }
    );
    const wallets = computeWalletAlphaBatchV2(providerResult.data.holders);
    const highConfidenceCount = wallets.filter(
      (wallet) => wallet.confidenceLevel === "high"
    ).length;
    const mediumConfidenceCount = wallets.filter(
      (wallet) => wallet.confidenceLevel === "medium"
    ).length;
    const lowConfidenceCount = wallets.filter(
      (wallet) => wallet.confidenceLevel === "low"
    ).length;
    const sortedWallets = [...wallets].sort(
      (a, b) => b.scores.walletAlphaV2 - a.scores.walletAlphaV2
    );

    return NextResponse.json({
      success: true,
      chain,
      address,
      forceRefresh,
      providerStatus: providerResult.status,
      providerWarnings: providerResult.warnings,
      historyMode: providerResult.data.historyMode,
      deepHistoryEnabled: providerResult.data.deepHistoryEnabled,
      walletMaxPages: providerResult.data.walletMaxPages,
      hardMaxPages: providerResult.data.hardMaxPages,
      walletMaxActivities: providerResult.data.walletMaxActivities,
      totalPagesFetched: providerResult.data.totalPagesFetched,
      averagePagesPerWallet: providerResult.data.averagePagesPerWallet,
      walletsReachedEndOfHistory: providerResult.data.walletsReachedEndOfHistory,
      totalActivitiesUsed: providerResult.data.totalActivities,
      averageActivitiesPerWallet: average(
        providerResult.data.holders.map((holder) => holder.activityCount)
      ),
      walletsWithFullHistory: providerResult.data.walletsWithFullHistory,
      walletsStoppedByPageLimit: providerResult.data.walletsStoppedByPageLimit,
      walletsStoppedByActivityLimit:
        providerResult.data.walletsStoppedByActivityLimit,
      walletsStoppedByTimeout: providerResult.data.walletsStoppedByTimeout,
      walletCount: wallets.length,
      averageWalletAlphaV2: average(
        wallets.map((wallet) => wallet.scores.walletAlphaV2)
      ),
      highConfidenceCount,
      mediumConfidenceCount,
      lowConfidenceCount,
      topWalletsByAlpha: sortedWallets.slice(0, 10),
      bottomWalletsByAlpha: sortedWallets.slice(-10).reverse(),
      wallets,
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Wallet Alpha V2 test request failed.",
      500
    );
  }
}
