import { NextResponse } from "next/server";
import { fetchGmgnSmartMoneyTrades } from "@/lib/gmgn-smart-money-trades";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORTED_CHAINS = new Set(["sol", "bsc", "base", "eth"]);
const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 100;

function errorResponse(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

function parseLimit(value: string | null) {
  if (!value) return DEFAULT_LIMIT;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return null;

  return Math.min(parsed, MAX_LIMIT);
}

function parseSide(value: string | null) {
  if (!value) return undefined;
  if (value !== "buy" && value !== "sell") return null;
  return value;
}

function parseBoolean(value: string | null) {
  return value === "true" || value === "1";
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
  const side = parseSide(searchParams.get("side")?.toLowerCase() || null);
  const limit = parseLimit(searchParams.get("limit"));
  const includeRaw = parseBoolean(searchParams.get("includeRaw"));

  if (!chain) return errorResponse("Missing chain parameter.");
  if (!SUPPORTED_CHAINS.has(chain)) {
    return errorResponse("Unsupported chain. Use sol, bsc, base, or eth.");
  }

  if (side === null) {
    return errorResponse("side must be buy or sell when provided.");
  }

  if (limit === null) {
    return errorResponse("limit must be an integer from 1 to 200.");
  }

  try {
    const result = await fetchGmgnSmartMoneyTrades(chain, {
      side,
      limit,
      includeRaw,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error
        ? error.message
        : "GMGN smart money trades request failed.",
      500
    );
  }
}
