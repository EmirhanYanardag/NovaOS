import {
  normalizeGmgnActivityResponse,
  runGmgnWalletActivity,
  type GMGNActivity,
} from "@/lib/gmgn";

type GmgnActivityType = "buy" | "sell" | "transfer";
export type GmgnWalletHistoryMode = "firstPage" | "bounded" | "full";

export type FetchGmgnWalletActivityPaginatedInput = {
  chain: string;
  wallet: string;
  limitPerPage: number;
  historyMode?: GmgnWalletHistoryMode;
  maxPages?: number;
  hardMaxPages?: number;
  maxActivities?: number;
  timeoutMs?: number;
  type?: GmgnActivityType;
};

export type PaginatedGmgnWalletActivityResponse = {
  activities: GMGNActivity[];
  next: string | null;
  count: number;
  oldestTimestamp: string | null;
  newestTimestamp: string | null;
  pagesFetched: number;
  hasMoreHistory: boolean;
  stoppedByPageLimit: boolean;
  stoppedByActivityLimit: boolean;
  stoppedByTimeout: boolean;
  reachedEndOfHistory: boolean;
};

const EVM_WALLET_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const SOL_WALLET_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SUPPORTED_GMGN_CHAINS = ["eth", "base", "bsc", "sol", "mantle"] as const;
const DEFAULT_MAX_PAGES = 3;
const HARD_MAX_PAGES = 10;
const DEFAULT_MAX_ACTIVITIES = 200;
const HARD_MAX_ACTIVITIES = 500;
const DEFAULT_FULL_HARD_MAX_PAGES = 50;
const HARD_FULL_MAX_PAGES = 100;
const DEFAULT_FULL_MAX_ACTIVITIES = 2000;
const HARD_FULL_MAX_ACTIVITIES = 5000;
const MAX_LIMIT_PER_PAGE = 100;
const DEFAULT_WALLET_TIMEOUT_MS = 120_000;
const HARD_WALLET_TIMEOUT_MS = 300_000;

function validateChain(chain: string) {
  if (!SUPPORTED_GMGN_CHAINS.includes(chain as (typeof SUPPORTED_GMGN_CHAINS)[number])) {
    throw new Error("Unsupported GMGN chain.");
  }
}

function isValidAddressForChain(chain: string, address: string) {
  return chain === "sol"
    ? SOL_WALLET_PATTERN.test(address)
    : EVM_WALLET_PATTERN.test(address);
}

function capInteger(value: number | undefined, defaultValue: number, max: number) {
  if (!value || !Number.isInteger(value) || value < 1) return defaultValue;
  return Math.min(value, max);
}

function activityKey(activity: GMGNActivity) {
  return [
    activity.txHash || "",
    activity.type || "",
    activity.tokenAddress || "",
    activity.timestamp || "",
  ].join(":");
}

function summarizeActivities(
  activities: GMGNActivity[],
  next: string | null,
  pagesFetched: number,
  stoppedByPageLimit: boolean,
  stoppedByActivityLimit: boolean,
  stoppedByTimeout: boolean
): PaginatedGmgnWalletActivityResponse {
  const timestamps = activities
    .map((activity) =>
      activity.timestamp ? Date.parse(activity.timestamp) : Number.NaN
    )
    .filter((timestamp) => Number.isFinite(timestamp));

  return {
    activities,
    next,
    count: activities.length,
    oldestTimestamp:
      timestamps.length > 0 ? new Date(Math.min(...timestamps)).toISOString() : null,
    newestTimestamp:
      timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : null,
    pagesFetched,
    hasMoreHistory: Boolean(next),
    stoppedByPageLimit,
    stoppedByActivityLimit,
    stoppedByTimeout,
    reachedEndOfHistory: !next && !stoppedByTimeout,
  };
}

export async function fetchGmgnWalletActivityPaginated({
  chain,
  wallet,
  limitPerPage,
  historyMode = "bounded",
  maxPages,
  hardMaxPages,
  maxActivities,
  timeoutMs,
  type,
}: FetchGmgnWalletActivityPaginatedInput): Promise<PaginatedGmgnWalletActivityResponse> {
  validateChain(chain);

  if (!isValidAddressForChain(chain, wallet)) {
    throw new Error("wallet must be a valid address for the requested chain.");
  }

  if (!Number.isInteger(limitPerPage) || limitPerPage < 1 || limitPerPage > MAX_LIMIT_PER_PAGE) {
    throw new Error("limitPerPage must be an integer from 1 to 100.");
  }

  if (type && !["buy", "sell", "transfer"].includes(type)) {
    throw new Error("Unsupported GMGN activity type.");
  }

  const cappedMaxPages =
    historyMode === "full"
      ? capInteger(hardMaxPages ?? maxPages, DEFAULT_FULL_HARD_MAX_PAGES, HARD_FULL_MAX_PAGES)
      : historyMode === "firstPage"
      ? 1
      : capInteger(maxPages, DEFAULT_MAX_PAGES, HARD_MAX_PAGES);
  const cappedMaxActivities = capInteger(
    maxActivities,
    historyMode === "full" ? DEFAULT_FULL_MAX_ACTIVITIES : DEFAULT_MAX_ACTIVITIES,
    historyMode === "full" ? HARD_FULL_MAX_ACTIVITIES : HARD_MAX_ACTIVITIES
  );
  const cappedTimeoutMs = capInteger(
    timeoutMs,
    DEFAULT_WALLET_TIMEOUT_MS,
    HARD_WALLET_TIMEOUT_MS
  );
  const activities: GMGNActivity[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  let next: string | null = null;
  let pagesFetched = 0;
  let stoppedByActivityLimit = false;
  let stoppedByTimeout = false;
  const startedAt = Date.now();

  while (pagesFetched < cappedMaxPages && activities.length < cappedMaxActivities) {
    if (Date.now() - startedAt >= cappedTimeoutMs) {
      stoppedByTimeout = true;
      break;
    }

    const raw = await runGmgnWalletActivity({
      chain,
      wallet,
      limit: limitPerPage,
      cursor,
      type,
    });
    const normalized = normalizeGmgnActivityResponse(raw);
    pagesFetched += 1;
    next = normalized.next;

    if (Date.now() - startedAt >= cappedTimeoutMs) {
      stoppedByTimeout = true;
    }

    for (const activity of normalized.activities) {
      const key = activityKey(activity);
      if (seen.has(key)) continue;

      seen.add(key);
      activities.push(activity);

      if (activities.length >= cappedMaxActivities) {
        stoppedByActivityLimit = true;
        break;
      }
    }

    if (!next || stoppedByActivityLimit || stoppedByTimeout) break;
    cursor = next;
  }

  const stoppedByPageLimit =
    Boolean(next) &&
    pagesFetched >= cappedMaxPages &&
    !stoppedByActivityLimit &&
    !stoppedByTimeout;

  return summarizeActivities(
    activities,
    next,
    pagesFetched,
    stoppedByPageLimit,
    stoppedByActivityLimit,
    stoppedByTimeout
  );
}
