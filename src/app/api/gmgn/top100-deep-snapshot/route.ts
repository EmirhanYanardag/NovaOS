import { NextResponse } from "next/server";
import {
  buildGmgnTop100DeepSnapshot,
  type GmgnTop100DeepSnapshot,
} from "@/lib/gmgn-top100-snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORTED_CHAINS = new Set(["eth", "base", "bsc", "sol", "mantle"]);
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 100;
const DEFAULT_CONCURRENCY = 3;
const MAX_CONCURRENCY = 5;
const CACHE_TTL_MS = 15 * 60 * 1000;
const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const SOL_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

type CacheStatus = "hit" | "miss" | "refresh";
type SnapshotRouteResponse = GmgnTop100DeepSnapshot & {
  cacheStatus: CacheStatus;
};

const snapshotCache = new Map<
  string,
  {
    expiresAt: number;
    value: GmgnTop100DeepSnapshot;
  }
>();

function hasGmgnApiKey() {
  const exists = Boolean(process.env.GMGN_API_KEY);
  console.info("[gmgn-top100-deep-snapshot] GMGN_API_KEY loaded:", exists);
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
  if (!hasGmgnApiKey()) {
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
  const includeRaw = parseBoolean(searchParams.get("includeRaw"));
  const debug = parseBoolean(searchParams.get("debug"));

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

  const cacheKey = `gmgn:top100-deep-snapshot:${chain}:${address.toLowerCase()}`;
  const cached = snapshotCache.get(cacheKey);
  const canUseCache = !forceRefresh && !includeRaw && !debug;

  if (canUseCache && cached && cached.expiresAt > Date.now()) {
    const response: SnapshotRouteResponse = {
      ...cached.value,
      cacheStatus: "hit",
    };
    return NextResponse.json(response);
  }

  try {
    const value = await buildGmgnTop100DeepSnapshot({
      chain,
      address,
      holderLimit,
      activityLimit,
      concurrency,
      includeRaw,
      debug,
    });

    if (!includeRaw && !debug) {
      snapshotCache.set(cacheKey, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        value,
      });
    }

    const response: SnapshotRouteResponse = {
      ...value,
      cacheStatus: forceRefresh ? "refresh" : "miss",
    };

    return NextResponse.json(response);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "GMGN Top100 Deep snapshot failed.",
      500
    );
  }
}
