import { NextResponse } from "next/server";
import {
  normalizeGmgnTopHoldersResponse,
  runGmgnTopHolders,
} from "@/lib/gmgn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORTED_CHAINS = new Set(["eth", "base", "bsc", "sol", "mantle"]);
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 100;
const DEFAULT_ORDER_BY = "amount_percentage";
const DEFAULT_DIRECTION = "desc";
const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const SOL_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SAFE_ORDER_BY_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function hasGmgnApiKey() {
  const exists = Boolean(process.env.GMGN_API_KEY);
  console.info("[gmgn-top-holders] GMGN_API_KEY loaded:", exists);
  return exists;
}

function errorResponse(error: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    { status }
  );
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
  if (!hasGmgnApiKey()) {
    return errorResponse(
      "Missing GMGN_API_KEY in server environment. Add it to .env.local or .env in the project root, then restart the Next.js server.",
      500
    );
  }

  const { searchParams } = new URL(request.url);
  const chain = searchParams.get("chain")?.toLowerCase() || "";
  const address = searchParams.get("address")?.trim() || "";
  const limit = parseLimit(searchParams.get("limit"));
  const orderBy = searchParams.get("orderBy")?.trim() || DEFAULT_ORDER_BY;
  const direction =
    searchParams.get("direction")?.toLowerCase() || DEFAULT_DIRECTION;

  if (!chain) return errorResponse("Missing chain parameter.");
  if (!SUPPORTED_CHAINS.has(chain)) {
    return errorResponse("Unsupported chain. Use eth, base, bsc, sol, or mantle.");
  }

  if (!address) return errorResponse("Missing address parameter.");
  if (!isValidAddress(chain, address)) {
    return errorResponse("address must be a valid token address for the requested chain.");
  }

  if (limit === null) return errorResponse("limit must be an integer from 1 to 100.");

  if (!SAFE_ORDER_BY_PATTERN.test(orderBy)) {
    return errorResponse("orderBy contains unsupported characters.");
  }

  if (direction !== "asc" && direction !== "desc") {
    return errorResponse("direction must be asc or desc.");
  }

  try {
    const rawResponse = await runGmgnTopHolders({
      chain,
      address,
      limit,
      orderBy,
      direction,
    });
    const normalized = normalizeGmgnTopHoldersResponse(rawResponse, limit);

    return NextResponse.json({
      success: true,
      chain,
      address,
      holders: normalized.holders,
      count: normalized.count,
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "GMGN top holders request failed.",
      500
    );
  }
}
