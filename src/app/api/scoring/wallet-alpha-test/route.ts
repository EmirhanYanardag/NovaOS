import { NextResponse } from "next/server";
import { GMGNProviderPrimary } from "@/lib/token-data-provider";
import { computeWalletAlphaBatchV1 } from "@/lib/wallet-alpha-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORTED_CHAINS = new Set(["eth", "base", "bsc", "sol", "mantle"]);
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 100;
const DEFAULT_CONCURRENCY = 3;
const MAX_CONCURRENCY = 5;
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
  const concurrency = parseBoundedInteger(
    searchParams.get("concurrency"),
    DEFAULT_CONCURRENCY,
    MAX_CONCURRENCY
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
    return errorResponse("concurrency must be an integer from 1 to 5.");
  }

  try {
    const providerResult = await GMGNProviderPrimary.getTop100DeepSnapshot(
      chain,
      address,
      {
        limit: holderLimit,
        activityLimit,
        concurrency,
        includeRaw: false,
        debug: false,
      }
    );
    const wallets = computeWalletAlphaBatchV1(providerResult.data.holders);
    const highConfidenceCount = wallets.filter(
      (wallet) => wallet.confidenceLevel === "high"
    ).length;
    const mediumConfidenceCount = wallets.filter(
      (wallet) => wallet.confidenceLevel === "medium"
    ).length;
    const lowConfidenceCount = wallets.filter(
      (wallet) => wallet.confidenceLevel === "low"
    ).length;

    return NextResponse.json({
      success: true,
      chain,
      address,
      forceRefresh,
      providerStatus: providerResult.status,
      providerWarnings: providerResult.warnings,
      walletCount: wallets.length,
      averageWalletAlpha: average(wallets.map((wallet) => wallet.scores.walletAlpha)),
      highConfidenceCount,
      mediumConfidenceCount,
      lowConfidenceCount,
      topWalletsByAlpha: [...wallets]
        .sort((a, b) => b.scores.walletAlpha - a.scores.walletAlpha)
        .slice(0, 10),
      wallets,
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Wallet Alpha test request failed.",
      500
    );
  }
}
