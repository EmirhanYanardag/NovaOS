import { NextResponse } from "next/server";
import {
  normalizeGmgnActivityResponse,
  normalizeGmgnTopHoldersResponse,
  runGmgnTopHolders,
  runGmgnWalletActivity,
  type GMGNActivity,
  type GMGNHolder,
} from "@/lib/gmgn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORTED_CHAINS = new Set(["eth", "base", "bsc", "sol", "mantle"]);
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 100;
const DEFAULT_CONCURRENCY = 3;
const MAX_CONCURRENCY = 5;
const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const SOL_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

type HolderStressSummary = {
  wallet: string | null;
  activityCount: number;
  oldestTimestamp: string | null;
  newestTimestamp: string | null;
  hasNext: boolean;
  error?: string;
  rawActivities?: GMGNActivity[];
};

function hasGmgnApiKey() {
  const exists = Boolean(process.env.GMGN_API_KEY);
  console.info("[gmgn-top100-deep-test] GMGN_API_KEY loaded:", exists);
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

function isValidAddress(chain: string, address: string) {
  return chain === "sol"
    ? SOL_ADDRESS_PATTERN.test(address)
    : EVM_ADDRESS_PATTERN.test(address);
}

function holderAddress(holder: GMGNHolder) {
  return holder.wallet || holder.address;
}

function timestampMs(value: string | null) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function mapWithConcurrency<T, R>({
  items,
  concurrency,
  mapper,
}: {
  items: T[];
  concurrency: number;
  mapper: (item: T, index: number) => Promise<R>;
}) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  );

  await Promise.all(workers);
  return results;
}

export async function GET(request: Request) {
  if (!hasGmgnApiKey()) {
    return errorResponse(
      "Missing GMGN_API_KEY in server environment. Add it to .env.local or .env in the project root, then restart the Next.js server.",
      500
    );
  }

  const startedAt = Date.now();
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
  const maxHolders = parseBoundedInteger(
    searchParams.get("maxHolders"),
    DEFAULT_LIMIT,
    MAX_LIMIT
  );
  const concurrency = parseBoundedInteger(
    searchParams.get("concurrency"),
    DEFAULT_CONCURRENCY,
    MAX_CONCURRENCY
  );
  const includeRaw = searchParams.get("includeRaw") === "true";

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

  if (maxHolders === null) {
    return errorResponse("maxHolders must be an integer from 1 to 100.");
  }

  if (concurrency === null) {
    return errorResponse("concurrency must be an integer from 1 to 5.");
  }

  try {
    const rawTopHolders = await runGmgnTopHolders({
      chain,
      address,
      limit: holderLimit,
      orderBy: "amount_percentage",
      direction: "desc",
    });
    const topHolders = normalizeGmgnTopHoldersResponse(
      rawTopHolders,
      holderLimit
    );
    const holdersToTest = topHolders.holders
      .filter((holder) => Boolean(holderAddress(holder)))
      .slice(0, maxHolders);

    const holders = await mapWithConcurrency({
      items: holdersToTest,
      concurrency,
      mapper: async (holder, index): Promise<HolderStressSummary> => {
        const wallet = holderAddress(holder);

        if (!wallet) {
          return {
            wallet: null,
            activityCount: 0,
            oldestTimestamp: null,
            newestTimestamp: null,
            hasNext: false,
            error: "Holder wallet address is unavailable.",
          };
        }

        try {
          const rawActivity = await runGmgnWalletActivity({
            chain,
            wallet,
            limit: activityLimit,
          });
          const normalizedActivity = normalizeGmgnActivityResponse(rawActivity);

          return {
            wallet,
            activityCount: normalizedActivity.count,
            oldestTimestamp: normalizedActivity.oldestTimestamp,
            newestTimestamp: normalizedActivity.newestTimestamp,
            hasNext: Boolean(normalizedActivity.next),
            ...(includeRaw && index < 3
              ? { rawActivities: normalizedActivity.activities }
              : {}),
          };
        } catch (error) {
          return {
            wallet,
            activityCount: 0,
            oldestTimestamp: null,
            newestTimestamp: null,
            hasNext: false,
            error:
              error instanceof Error
                ? error.message
                : "GMGN holder activity request failed.",
          };
        }
      },
    });

    const succeeded = holders.filter((holder) => !holder.error);
    const failed = holders.length - succeeded.length;
    const totalActivities = succeeded.reduce(
      (sum, holder) => sum + holder.activityCount,
      0
    );
    const oldestTimestamps = succeeded
      .map((holder) => timestampMs(holder.oldestTimestamp))
      .filter((value): value is number => value !== null);
    const newestTimestamps = succeeded
      .map((holder) => timestampMs(holder.newestTimestamp))
      .filter((value): value is number => value !== null);
    const holdersWithNextCursor = succeeded.filter((holder) => holder.hasNext).length;

    return NextResponse.json({
      success: true,
      chain,
      address,
      config: {
        holderLimit,
        activityLimit,
        maxHolders,
        concurrency,
        includeRaw,
      },
      topHoldersCount: topHolders.count,
      totalDurationMs: Date.now() - startedAt,
      summary: {
        holdersRequested: holders.length,
        holdersSucceeded: succeeded.length,
        holdersFailed: failed,
        totalActivities,
        averageActivitiesPerHolder:
          succeeded.length > 0
            ? Number((totalActivities / succeeded.length).toFixed(2))
            : 0,
        holdersWithNextCursor,
        oldestTimestampOverall:
          oldestTimestamps.length > 0
            ? new Date(Math.min(...oldestTimestamps)).toISOString()
            : null,
        newestTimestampOverall:
          newestTimestamps.length > 0
            ? new Date(Math.max(...newestTimestamps)).toISOString()
            : null,
      },
      holders,
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "GMGN Top100 Deep stress test failed.",
      500
    );
  }
}
