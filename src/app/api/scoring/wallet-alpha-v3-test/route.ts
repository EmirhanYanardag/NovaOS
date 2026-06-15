import { NextResponse } from "next/server";
import {
  computeWalletAlphaV3,
  type WalletAlphaV3Options,
} from "@/lib/wallet-alpha-v3-engine";

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

type KlineInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

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

export async function GET(request: Request) {
  if (!process.env.GMGN_API_KEY) {
    return errorResponse(
      "Missing GMGN_API_KEY in server environment. Add it to .env.local or .env in the project root, then restart the Next.js server.",
      500
    );
  }

  const { searchParams } = new URL(request.url);
  const chain = searchParams.get("chain")?.toLowerCase() || "";
  const wallet = searchParams.get("wallet")?.trim() || "";
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

  if (!wallet) return errorResponse("Missing wallet parameter.");
  if (!isValidAddress(chain, wallet)) {
    return errorResponse("wallet must be a valid address for the requested chain.");
  }

  if (walletMaxPages === null) return errorResponse("walletMaxPages must be an integer from 1 to 50.");
  if (walletMaxActivities === null) {
    return errorResponse("walletMaxActivities must be an integer from 1 to 5000.");
  }
  if (maxTokens === null) return errorResponse("maxTokens must be an integer from 1 to 100.");
  if (concurrency === null) return errorResponse("concurrency must be an integer from 1 to 5.");
  if (!INTERVALS.has(interval)) return errorResponse("interval must be one of 1m, 5m, 15m, 1h, 4h, or 1d.");

  try {
    const options: WalletAlphaV3Options = {
      walletMaxPages,
      walletMaxActivities,
      maxTokens,
      interval: interval as KlineInterval,
      concurrency,
    };
    const result = await computeWalletAlphaV3({
      chain,
      wallet,
      options,
    });

    return NextResponse.json({
      success: true,
      chain,
      forceRefresh,
      ...result,
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Wallet Alpha V3 test request failed.",
      500
    );
  }
}
