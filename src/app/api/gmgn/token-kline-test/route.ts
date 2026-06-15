import { NextResponse } from "next/server";
import { fetchGmgnTokenKline } from "@/lib/gmgn-token-kline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORTED_CHAINS = new Set(["sol", "bsc", "base", "eth"]);
const INTERVALS = new Set(["1m", "5m", "15m", "1h", "4h", "1d"]);
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 1000;
const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const SOL_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function errorResponse(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

function parseLimit(value: string | null) {
  if (!value) return DEFAULT_LIMIT;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return null;

  return Math.min(parsed, MAX_LIMIT);
}

function parseBoolean(value: string | null) {
  return value === "true" || value === "1";
}

function parseOptionalUnixSeconds(value: string | null) {
  if (!value) return undefined;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return null;

  return parsed;
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
  const interval = searchParams.get("interval") || "";
  const limit = parseLimit(searchParams.get("limit"));
  const from = parseOptionalUnixSeconds(searchParams.get("from"));
  const to = parseOptionalUnixSeconds(searchParams.get("to"));
  const includeRaw = parseBoolean(searchParams.get("includeRaw"));

  if (!chain) return errorResponse("Missing chain parameter.");
  if (!SUPPORTED_CHAINS.has(chain)) {
    return errorResponse("Unsupported chain. Use sol, bsc, base, or eth.");
  }

  if (!address) return errorResponse("Missing address parameter.");
  if (!isValidAddress(chain, address)) {
    return errorResponse("address must be a valid token address for the requested chain.");
  }

  if (!interval) return errorResponse("Missing interval parameter.");
  if (!INTERVALS.has(interval)) {
    return errorResponse("interval must be one of 1m, 5m, 15m, 1h, 4h, or 1d.");
  }

  if (limit === null) {
    return errorResponse("limit must be an integer from 1 to 1000.");
  }

  if (from === null) {
    return errorResponse("from must be a positive Unix timestamp in seconds.");
  }

  if (to === null) {
    return errorResponse("to must be a positive Unix timestamp in seconds.");
  }

  try {
    const result = await fetchGmgnTokenKline(chain, address, {
      interval: interval as "1m" | "5m" | "15m" | "1h" | "4h" | "1d",
      limit,
      from,
      to,
      includeRaw,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "GMGN token kline request failed.",
      500
    );
  }
}
