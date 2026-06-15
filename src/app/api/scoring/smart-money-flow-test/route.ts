import { NextResponse } from "next/server";
import { fetchGmgnSmartMoneyTrades } from "@/lib/gmgn-smart-money-trades";
import { computeSmartMoneyFlowV1 } from "@/lib/smart-money-flow-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORTED_CHAINS = new Set(["sol", "bsc", "base", "eth"]);
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 200;
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
  const limit = parseLimit(searchParams.get("limit"));

  if (!chain) return errorResponse("Missing chain parameter.");
  if (!SUPPORTED_CHAINS.has(chain)) {
    return errorResponse("Unsupported chain. Use sol, bsc, base, or eth.");
  }

  if (!address) return errorResponse("Missing address parameter.");
  if (!isValidAddress(chain, address)) {
    return errorResponse("address must be a valid token address for the requested chain.");
  }

  if (limit === null) {
    return errorResponse("limit must be an integer from 1 to 200.");
  }

  try {
    const feed = await fetchGmgnSmartMoneyTrades(chain, { limit });
    const normalizedAddress = address.toLowerCase();
    const matchedTrades = feed.trades.filter(
      (trade) => trade.tokenAddress?.toLowerCase() === normalizedAddress
    );
    const flow = computeSmartMoneyFlowV1({
      trades: matchedTrades,
      limit,
    });

    return NextResponse.json({
      success: true,
      chain,
      address,
      ...flow,
      warnings: [...feed.warnings, ...flow.warnings],
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error
        ? error.message
        : "Smart Money Flow test request failed.",
      500
    );
  }
}
