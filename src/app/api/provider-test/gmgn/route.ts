import { NextResponse } from "next/server";
import { GMGNProviderPrimary } from "@/lib/token-data-provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORTED_CHAINS = new Set(["eth", "base", "bsc", "sol", "mantle"]);
const SUPPORTED_MODES = new Set(["holders", "activity", "snapshot"]);
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 100;
const DEFAULT_CONCURRENCY = 3;
const MAX_CONCURRENCY = 5;
const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const SOL_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SAFE_CURSOR_PATTERN = /^[A-Za-z0-9._:+=/-]{1,512}$/;

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
  const mode = searchParams.get("mode")?.toLowerCase() || "";
  const chain = searchParams.get("chain")?.toLowerCase() || "";
  const address = searchParams.get("address")?.trim() || "";
  const wallet = searchParams.get("wallet")?.trim() || "";
  const cursor = searchParams.get("cursor")?.trim() || undefined;
  const limit = parseBoundedInteger(searchParams.get("limit"), DEFAULT_LIMIT, MAX_LIMIT);
  const concurrency = parseBoundedInteger(
    searchParams.get("concurrency"),
    DEFAULT_CONCURRENCY,
    MAX_CONCURRENCY
  );

  if (!mode) return errorResponse("Missing mode parameter.");
  if (!SUPPORTED_MODES.has(mode)) {
    return errorResponse("Unsupported mode. Use holders, activity, or snapshot.");
  }

  if (!chain) return errorResponse("Missing chain parameter.");
  if (!SUPPORTED_CHAINS.has(chain)) {
    return errorResponse("Unsupported chain. Use eth, base, bsc, sol, or mantle.");
  }

  if (limit === null) return errorResponse("limit must be an integer from 1 to 100.");
  if (concurrency === null) {
    return errorResponse("concurrency must be an integer from 1 to 5.");
  }

  if (cursor && !SAFE_CURSOR_PATTERN.test(cursor)) {
    return errorResponse("cursor contains unsupported characters.");
  }

  try {
    if (mode === "activity") {
      if (!wallet) return errorResponse("wallet is required for activity mode.");
      if (!isValidAddress(chain, wallet)) {
        return errorResponse("wallet must be a valid address for the requested chain.");
      }

      const result = await GMGNProviderPrimary.getWalletActivity(chain, wallet, {
        limit,
        cursor,
      });

      return NextResponse.json({
        success: true,
        mode,
        chain,
        wallet,
        ...result,
      });
    }

    if (!address) return errorResponse("address is required for this mode.");
    if (!isValidAddress(chain, address)) {
      return errorResponse("address must be a valid token address for the requested chain.");
    }

    if (mode === "holders") {
      const result = await GMGNProviderPrimary.getTopHolders(chain, address, limit);

      return NextResponse.json({
        success: true,
        mode,
        chain,
        address,
        ...result,
      });
    }

    const result = await GMGNProviderPrimary.getTop100DeepSnapshot(chain, address, {
      limit,
      activityLimit: limit,
      concurrency,
    });

    return NextResponse.json({
      success: true,
      mode,
      chain,
      address,
      ...result,
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "GMGN provider test request failed.",
      500
    );
  }
}
