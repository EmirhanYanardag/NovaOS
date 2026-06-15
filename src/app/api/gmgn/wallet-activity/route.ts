import { NextResponse } from "next/server";
import {
  normalizeGmgnActivityResponse,
  runGmgnWalletActivity,
} from "@/lib/gmgn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORTED_CHAINS = new Set(["eth", "base", "bsc", "sol", "mantle"]);
const SUPPORTED_TYPES = new Set(["buy", "sell", "transfer"]);
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 100;
const EVM_WALLET_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const SOL_WALLET_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SAFE_CURSOR_PATTERN = /^[A-Za-z0-9._:+=/-]{1,512}$/;

function hasGmgnApiKey() {
  const exists = Boolean(process.env.GMGN_API_KEY);
  console.info("[gmgn-wallet-activity] GMGN_API_KEY loaded:", exists);
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

function isValidWallet(chain: string, wallet: string) {
  return chain === "sol"
    ? SOL_WALLET_PATTERN.test(wallet)
    : EVM_WALLET_PATTERN.test(wallet);
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
  const wallet = searchParams.get("wallet")?.trim() || "";
  const cursor = searchParams.get("cursor")?.trim() || undefined;
  const limit = parseLimit(searchParams.get("limit"));
  const typeParam = searchParams.get("type")?.toLowerCase() || undefined;

  if (!chain) return errorResponse("Missing chain parameter.");
  if (!SUPPORTED_CHAINS.has(chain)) {
    return errorResponse("Unsupported chain. Use eth, base, bsc, sol, or mantle.");
  }

  if (!wallet) return errorResponse("Missing wallet parameter.");
  if (!isValidWallet(chain, wallet)) {
    return errorResponse("wallet must be a valid address for the requested chain.");
  }

  if (cursor && !SAFE_CURSOR_PATTERN.test(cursor)) {
    return errorResponse("cursor contains unsupported characters.");
  }

  if (limit === null) return errorResponse("limit must be an integer from 1 to 100.");

  if (typeParam && !SUPPORTED_TYPES.has(typeParam)) {
    return errorResponse("Unsupported type. Use buy, sell, or transfer.");
  }

  try {
    const rawResponse = await runGmgnWalletActivity({
      chain,
      wallet,
      limit,
      cursor,
      type: typeParam as "buy" | "sell" | "transfer" | undefined,
    });
    const normalized = normalizeGmgnActivityResponse(rawResponse);

    return NextResponse.json({
      success: true,
      chain,
      wallet,
      activities: normalized.activities,
      next: normalized.next,
      count: normalized.count,
      oldestTimestamp: normalized.oldestTimestamp,
      newestTimestamp: normalized.newestTimestamp,
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "GMGN wallet activity request failed.",
      500
    );
  }
}
