import {
  normalizeGmgnActivityResponse,
  normalizeGmgnTopHoldersResponse,
  runGmgnTopHolders,
  runGmgnWalletActivity,
  type GMGNActivity,
  type GMGNHolder,
} from "@/lib/gmgn";
import { fetchGmgnWalletActivityPaginated } from "@/lib/gmgn-wallet-activity";
import type { GmgnWalletHistoryMode } from "@/lib/gmgn-wallet-activity";
import type {
  DataConfidenceLevel,
  MissingWalletProfileData,
  TokenHolderSnapshot,
  WalletTrade,
  WalletTradeEventType,
} from "@/lib/novaos-data-layer";

type UnknownRecord = Record<string, unknown>;

const DEFAULT_WALLET_MAX_PAGES = 3;
const HARD_WALLET_MAX_PAGES = 10;
const DEFAULT_WALLET_MAX_ACTIVITIES = 200;
const HARD_WALLET_MAX_ACTIVITIES = 500;
const DEFAULT_FULL_HARD_MAX_PAGES = 50;
const HARD_FULL_MAX_PAGES = 100;
const DEFAULT_FULL_MAX_ACTIVITIES = 2000;
const HARD_FULL_MAX_ACTIVITIES = 5000;

export type GmgnSnapshotActivity = WalletTrade & {
  raw?: unknown;
};

export type GmgnHolderSnapshot = {
  wallet: string | null;
  holderRank: number;
  ownershipPercentage: number | null;
  tokenAmount: string | number | null;
  usdValue: number | null;
  activityCount: number;
  hasNext: boolean;
  oldestTimestamp: string | null;
  newestTimestamp: string | null;
  buyCount: number;
  sellCount: number;
  transferCount: number;
  uniqueTokensTraded: number;
  totalBuyUsd: number | null;
  totalSellUsd: number | null;
  realizedPnlUsdApprox: number | null;
  winCount: number | null;
  lossCount: number | null;
  winRate: number | null;
  avgTradeUsd: number | null;
  avgBuyUsd: number | null;
  avgSellUsd: number | null;
  avgHoldTimeSecondsApprox: number | null;
  dataConfidence: DataConfidenceLevel;
  missingData: MissingWalletProfileData;
  activities?: GmgnSnapshotActivity[];
  debugFirstNormalizedActivity?: GmgnSnapshotActivity | null;
  historyMode?: GmgnWalletHistoryMode;
  pagesFetched?: number;
  hasMoreHistory?: boolean;
  stoppedByPageLimit?: boolean;
  stoppedByActivityLimit?: boolean;
  stoppedByTimeout?: boolean;
  reachedEndOfHistory?: boolean;
  error?: string;
};

export type GmgnTop100DeepSnapshot = {
  success: true;
  chain: string;
  address: string;
  config: {
    holderLimit: number;
    activityLimit: number;
    concurrency: number;
    includeRaw: boolean;
    debug: boolean;
    deepHistory: boolean;
    historyMode: GmgnWalletHistoryMode;
    walletMaxPages: number;
    hardMaxPages: number;
    walletMaxActivities: number;
  };
  topHoldersCount: number;
  holdersAnalyzed: number;
  holdersWithActivity: number;
  holdersWithNextCursor: number;
  totalActivities: number;
  deepHistoryEnabled: boolean;
  historyMode: GmgnWalletHistoryMode;
  walletMaxPages: number;
  hardMaxPages: number;
  walletMaxActivities: number;
  totalPagesFetched: number;
  averagePagesPerWallet: number | null;
  walletsReachedEndOfHistory: number;
  walletsWithFullHistory: number;
  walletsStoppedByPageLimit: number;
  walletsStoppedByActivityLimit: number;
  walletsStoppedByTimeout: number;
  oldestTimestampOverall: string | null;
  newestTimestampOverall: string | null;
  avgWinRate: number | null;
  avgTradeUsd: number | null;
  avgHoldTimeSecondsApprox: number | null;
  totalApproxRealizedPnlUsd: number | null;
  dataCoverageScore: number;
  holdersFailed: number;
  holderErrors: { wallet: string | null; holderRank: number; error: string }[];
  holders: GmgnHolderSnapshot[];
};

export type BuildGmgnTop100DeepSnapshotInput = {
  chain: string;
  address: string;
  holderLimit: number;
  activityLimit: number;
  concurrency: number;
  includeRaw?: boolean;
  debug?: boolean;
  deepHistory?: boolean;
  historyMode?: GmgnWalletHistoryMode;
  walletMaxPages?: number;
  hardMaxPages?: number;
  walletMaxActivities?: number;
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function holderAddress(holder: GMGNHolder) {
  return holder.wallet || holder.address;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function firstString(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = asString(record[key]);
    if (value) return value;
  }

  return null;
}

function firstNumber(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = asNumber(record[key]);
    if (value !== null) return value;
  }

  return null;
}

function firstValue(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value !== null && value !== undefined && value !== "") return value;
  }

  return null;
}

function nestedRecord(record: UnknownRecord, key: string) {
  const value = record[key];
  return isRecord(value) ? value : null;
}

function firstNestedString(record: UnknownRecord, paths: [string, string][]) {
  for (const [parentKey, childKey] of paths) {
    const parent = nestedRecord(record, parentKey);
    if (!parent) continue;

    const value = asString(parent[childKey]);
    if (value) return value;
  }

  return null;
}

function firstNestedNumber(record: UnknownRecord, paths: [string, string][]) {
  for (const [parentKey, childKey] of paths) {
    const parent = nestedRecord(record, parentKey);
    if (!parent) continue;

    const value = asNumber(parent[childKey]);
    if (value !== null) return value;
  }

  return null;
}

function firstNestedValue(record: UnknownRecord, paths: [string, string][]) {
  for (const [parentKey, childKey] of paths) {
    const parent = nestedRecord(record, parentKey);
    if (!parent) continue;

    const value = parent[childKey];
    if (value !== null && value !== undefined && value !== "") return value;
  }

  return null;
}

function asStringOrNumber(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? value : null;
}

function timestampMs(value: string | null) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function classifyEventType(activity: GMGNActivity, raw: UnknownRecord): WalletTradeEventType {
  const value = (
    firstString(raw, ["eventType", "event_type", "side", "type", "event"]) ||
    activity.type ||
    ""
  ).toLowerCase();

  if (value === "buy" || value.includes("buy")) return "buy";
  if (value === "sell" || value.includes("sell")) return "sell";
  if (value === "transfer" || value.includes("transfer")) return "transfer";

  return "unknown";
}

export function normalizeGmgnActivityToWalletTrade({
  activity,
  wallet,
  chain,
  includeRaw = false,
}: {
  activity: GMGNActivity;
  wallet: string;
  chain: string;
  includeRaw?: boolean;
}): GmgnSnapshotActivity {
  const raw = isRecord(activity.raw) ? activity.raw : {};
  const tokenAddress =
    firstNestedString(raw, [["token", "address"]]) ||
    firstString(raw, ["tokenAddress", "token_address", "token_address_str"]) ||
    activity.tokenAddress;
  const tokenSymbol =
    firstNestedString(raw, [["token", "symbol"]]) ||
    firstString(raw, ["tokenSymbol", "token_symbol", "symbol"]) ||
    activity.tokenSymbol;

  return {
    wallet,
    chain,
    txHash: activity.txHash || firstString(raw, ["txHash", "tx_hash", "hash"]),
    timestamp:
      activity.timestamp || firstString(raw, ["timestamp", "time", "block_timestamp"]),
    eventType: classifyEventType(activity, raw),
    tokenAddress,
    tokenSymbol,
    tokenTotalSupply: asStringOrNumber(
      firstNestedValue(raw, [["token", "total_supply"]]) ??
        firstValue(raw, [
          "tokenTotalSupply",
          "token_total_supply",
          "totalSupply",
          "total_supply",
        ])
    ),
    tokenAmount:
      asStringOrNumber(
        firstValue(raw, [
          "token_amount",
          "tokenAmount",
          "amount",
          "baseAmount",
          "base_amount",
        ])
      ) ?? activity.amount,
    costUsd:
      firstNumber(raw, [
        "cost_usd",
        "costUsd",
        "valueUsd",
        "value_usd",
        "usdValue",
        "usd_value",
        "usd",
      ]) ?? activity.valueUsd,
    buyCostUsd: firstNumber(raw, ["buy_cost_usd", "buyCostUsd", "buy_cost"]),
    priceUsd:
      firstNumber(raw, ["price_usd", "priceUsd", "price"]) ??
      firstNestedNumber(raw, [["token", "price_usd"]]),
    quoteAmount: asStringOrNumber(
      firstValue(raw, [
        "quoteAmount",
        "quote_amount",
        "quoteTokenAmount",
        "quote_token_amount",
      ])
    ),
    quoteSymbol: firstString(raw, [
      "quoteSymbol",
      "quote_symbol",
      "quoteTokenSymbol",
      "quote_token_symbol",
    ]),
    gasUsd: firstNumber(raw, ["gasUsd", "gas_usd", "gasFeeUsd", "gas_fee_usd"]),
    dexUsd: firstNumber(raw, ["dexUsd", "dex_usd", "dexValueUsd", "dex_value_usd"]),
    launchpad: firstValue(raw, ["launchpad", "launchpadName", "launchpad_name"]) as
      | string
      | boolean
      | null,
    ...(includeRaw ? { raw: activity.raw } : {}),
  };
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4));
}

function capInteger(value: number | undefined, defaultValue: number, max: number) {
  if (!value || !Number.isInteger(value) || value < 1) return defaultValue;
  return Math.min(value, max);
}

function sumOrNull(values: number[]) {
  if (values.length === 0) return null;
  return Number(values.reduce((sum, value) => sum + value, 0).toFixed(4));
}

function sellPnlComparison(activity: GmgnSnapshotActivity) {
  if (
    activity.eventType !== "sell" ||
    activity.costUsd === null ||
    activity.buyCostUsd === null
  ) {
    return null;
  }

  return activity.costUsd - activity.buyCostUsd;
}

function estimateAverageHoldTimeSeconds(activities: GmgnSnapshotActivity[]) {
  const sorted = activities
    .filter((activity) => activity.timestamp && activity.tokenAddress)
    .sort((a, b) => (timestampMs(a.timestamp) || 0) - (timestampMs(b.timestamp) || 0));
  const buysByToken = new Map<string, number[]>();
  const holdTimes: number[] = [];

  for (const activity of sorted) {
    const token = activity.tokenAddress;
    const time = timestampMs(activity.timestamp);
    if (!token || time === null) continue;

    if (activity.eventType === "buy") {
      buysByToken.set(token, [...(buysByToken.get(token) || []), time]);
    }

    if (activity.eventType === "sell") {
      const buys = buysByToken.get(token) || [];
      const buyTime = buys.shift();
      if (buyTime !== undefined && time >= buyTime) {
        holdTimes.push((time - buyTime) / 1000);
      }
      buysByToken.set(token, buys);
    }
  }

  return average(holdTimes);
}

function dataConfidence({
  activityCount,
  hasTokenIdentity,
  hasUsdValues,
  hasPnlComparisons,
  missingData,
}: {
  activityCount: number;
  hasTokenIdentity: boolean;
  hasUsdValues: boolean;
  hasPnlComparisons: boolean;
  missingData: MissingWalletProfileData;
}): DataConfidenceLevel {
  if (activityCount > 0 && hasTokenIdentity && hasUsdValues && hasPnlComparisons) {
    return "high";
  }

  if (activityCount > 0 && hasUsdValues) return "medium";
  if (activityCount > 0 && Object.values(missingData).some((missing) => !missing)) {
    return "medium";
  }

  return "low";
}

function buildHolderSnapshot({
  holder,
  holderRank,
  wallet,
  chain,
  normalizedActivity,
  includeRaw,
  debug,
  historyMode,
  pagesFetched,
  hasMoreHistory,
  stoppedByPageLimit,
  stoppedByActivityLimit,
  stoppedByTimeout,
  reachedEndOfHistory,
}: {
  holder: GMGNHolder;
  holderRank: number;
  wallet: string;
  chain: string;
  normalizedActivity: ReturnType<typeof normalizeGmgnActivityResponse>;
  includeRaw: boolean;
  debug: boolean;
  historyMode?: GmgnWalletHistoryMode;
  pagesFetched?: number;
  hasMoreHistory?: boolean;
  stoppedByPageLimit?: boolean;
  stoppedByActivityLimit?: boolean;
  stoppedByTimeout?: boolean;
  reachedEndOfHistory?: boolean;
}): GmgnHolderSnapshot {
  const activities = normalizedActivity.activities.map((activity) =>
    normalizeGmgnActivityToWalletTrade({ activity, wallet, chain, includeRaw })
  );
  const buyActivities = activities.filter((activity) => activity.eventType === "buy");
  const sellActivities = activities.filter((activity) => activity.eventType === "sell");
  const transferActivities = activities.filter(
    (activity) => activity.eventType === "transfer"
  );
  const uniqueTokens = new Set(
    activities
      .map((activity) => activity.tokenAddress)
      .filter((token): token is string => Boolean(token))
  );
  const buyUsd = buyActivities
    .map((activity) => activity.costUsd)
    .filter((value): value is number => value !== null);
  const sellUsd = sellActivities
    .map((activity) => activity.costUsd)
    .filter((value): value is number => value !== null);
  const tradeUsd = activities
    .map((activity) => activity.costUsd)
    .filter((value): value is number => value !== null);
  const pnlValues = sellActivities
    .map(sellPnlComparison)
    .filter((value): value is number => value !== null);
  const winCount = pnlValues.length > 0 ? pnlValues.filter((value) => value > 0).length : null;
  const lossCount =
    pnlValues.length > 0 ? pnlValues.filter((value) => value < 0).length : null;
  const winLossTotal = (winCount ?? 0) + (lossCount ?? 0);
  const avgHoldTimeSecondsApprox = estimateAverageHoldTimeSeconds(activities);
  const hasTokenIdentity = activities.some((activity) => Boolean(activity.tokenAddress));
  const hasUsdValues = activities.some((activity) => activity.costUsd !== null);
  const missingData = {
    walletAge: normalizedActivity.oldestTimestamp === null,
    tradeHistory: activities.length === 0,
    timestamps:
      activities.length === 0 ||
      activities.every((activity) => activity.timestamp === null),
    pnl: pnlValues.length === 0,
    holdings: false,
    tokenIdentity: !hasTokenIdentity,
    usdValues: !hasUsdValues,
    holdTimePairs: avgHoldTimeSecondsApprox === null,
  };

  return {
    wallet,
    holderRank,
    ownershipPercentage: holder.amountPercentage,
    tokenAmount: holder.amount,
    usdValue: holder.usdValue,
    activityCount: normalizedActivity.count,
    hasNext: Boolean(normalizedActivity.next),
    oldestTimestamp: normalizedActivity.oldestTimestamp,
    newestTimestamp: normalizedActivity.newestTimestamp,
    buyCount: buyActivities.length,
    sellCount: sellActivities.length,
    transferCount: transferActivities.length,
    uniqueTokensTraded: uniqueTokens.size,
    totalBuyUsd: sumOrNull(buyUsd),
    totalSellUsd: sumOrNull(sellUsd),
    realizedPnlUsdApprox: sumOrNull(pnlValues),
    winCount,
    lossCount,
    winRate:
      winLossTotal > 0
        ? Number((((winCount || 0) / winLossTotal) * 100).toFixed(2))
        : null,
    avgTradeUsd: average(tradeUsd),
    avgBuyUsd: average(buyUsd),
    avgSellUsd: average(sellUsd),
    avgHoldTimeSecondsApprox,
    dataConfidence: dataConfidence({
      activityCount: activities.length,
      hasTokenIdentity,
      hasUsdValues,
      hasPnlComparisons: pnlValues.length > 0,
      missingData,
    }),
    missingData,
    ...(includeRaw ? { activities } : {}),
    ...(debug && holderRank <= 3
      ? { debugFirstNormalizedActivity: activities[0] || null }
      : {}),
    ...(historyMode !== undefined ? { historyMode } : {}),
    ...(pagesFetched !== undefined ? { pagesFetched } : {}),
    ...(hasMoreHistory !== undefined ? { hasMoreHistory } : {}),
    ...(stoppedByPageLimit !== undefined ? { stoppedByPageLimit } : {}),
    ...(stoppedByActivityLimit !== undefined ? { stoppedByActivityLimit } : {}),
    ...(stoppedByTimeout !== undefined ? { stoppedByTimeout } : {}),
    ...(reachedEndOfHistory !== undefined ? { reachedEndOfHistory } : {}),
  };
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

function buildCoverageScore({
  holdersAnalyzed,
  holdersFailed,
  holdersWithActivity,
  holdersWithNextCursor,
  totalActivities,
}: {
  holdersAnalyzed: number;
  holdersFailed: number;
  holdersWithActivity: number;
  holdersWithNextCursor: number;
  totalActivities: number;
}) {
  if (holdersAnalyzed === 0) return 0;

  const successRatio = (holdersAnalyzed - holdersFailed) / holdersAnalyzed;
  const activityRatio = holdersWithActivity / holdersAnalyzed;
  const depthRatio = Math.min(1, totalActivities / Math.max(1, holdersAnalyzed * 20));
  const paginationPenalty = Math.min(0.15, holdersWithNextCursor / holdersAnalyzed / 5);

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (successRatio * 45 + activityRatio * 35 + depthRatio * 20) *
          (1 - paginationPenalty)
      )
    )
  );
}

export function toTokenHolderSnapshot({
  holder,
  chain,
  tokenAddress,
  holderRank,
}: {
  holder: GMGNHolder;
  chain: string;
  tokenAddress: string;
  holderRank: number;
}): TokenHolderSnapshot {
  return {
    chain,
    tokenAddress,
    holderRank,
    wallet: holder.wallet || holder.address,
    tokenAmount: holder.amount,
    ownershipPercentage: holder.amountPercentage,
    usdValue: holder.usdValue,
    label: holder.label || holder.tag,
    walletProfile: null,
    missingData: {
      walletAge: true,
      tradeHistory: true,
      timestamps: true,
      pnl: true,
      holdings: false,
      tokenIdentity: false,
      usdValues: holder.usdValue === null,
      holdTimePairs: true,
    },
  };
}

export async function buildGmgnTop100DeepSnapshot({
  chain,
  address,
  holderLimit,
  activityLimit,
  concurrency,
  includeRaw = false,
  debug = false,
  deepHistory = false,
  historyMode,
  walletMaxPages,
  hardMaxPages,
  walletMaxActivities,
}: BuildGmgnTop100DeepSnapshotInput): Promise<GmgnTop100DeepSnapshot> {
  const resolvedHistoryMode: GmgnWalletHistoryMode =
    historyMode || (deepHistory ? "bounded" : "firstPage");
  const cappedWalletMaxPages = capInteger(
    walletMaxPages,
    DEFAULT_WALLET_MAX_PAGES,
    HARD_WALLET_MAX_PAGES
  );
  const cappedHardMaxPages = capInteger(
    hardMaxPages ?? walletMaxPages,
    DEFAULT_FULL_HARD_MAX_PAGES,
    HARD_FULL_MAX_PAGES
  );
  const cappedWalletMaxActivities = capInteger(
    walletMaxActivities,
    resolvedHistoryMode === "full"
      ? DEFAULT_FULL_MAX_ACTIVITIES
      : DEFAULT_WALLET_MAX_ACTIVITIES,
    resolvedHistoryMode === "full"
      ? HARD_FULL_MAX_ACTIVITIES
      : HARD_WALLET_MAX_ACTIVITIES
  );
  const rawTopHolders = await runGmgnTopHolders({
    chain,
    address,
    limit: holderLimit,
    orderBy: "amount_percentage",
    direction: "desc",
  });
  const topHolders = normalizeGmgnTopHoldersResponse(rawTopHolders, holderLimit);
  const holdersToAnalyze = topHolders.holders.slice(0, holderLimit);

  const holders = await mapWithConcurrency({
    items: holdersToAnalyze,
    concurrency,
    mapper: async (holder, index): Promise<GmgnHolderSnapshot> => {
      const wallet = holderAddress(holder);
      const holderRank = index + 1;

      if (!wallet) {
        return {
          wallet: null,
          holderRank,
          ownershipPercentage: holder.amountPercentage,
          tokenAmount: holder.amount,
          usdValue: holder.usdValue,
          activityCount: 0,
          hasNext: false,
          oldestTimestamp: null,
          newestTimestamp: null,
          buyCount: 0,
          sellCount: 0,
          transferCount: 0,
          uniqueTokensTraded: 0,
          totalBuyUsd: null,
          totalSellUsd: null,
          realizedPnlUsdApprox: null,
          winCount: null,
          lossCount: null,
          winRate: null,
          avgTradeUsd: null,
          avgBuyUsd: null,
          avgSellUsd: null,
          avgHoldTimeSecondsApprox: null,
          dataConfidence: "low",
          missingData: {
            walletAge: true,
            tradeHistory: true,
            timestamps: true,
            pnl: true,
            holdings: false,
            tokenIdentity: true,
            usdValues: true,
            holdTimePairs: true,
          },
          historyMode: resolvedHistoryMode,
          pagesFetched: 0,
          hasMoreHistory: false,
          stoppedByPageLimit: false,
          stoppedByActivityLimit: false,
          stoppedByTimeout: false,
          reachedEndOfHistory: false,
          error: "Holder wallet address is unavailable.",
        };
      }

      try {
        const normalizedActivity = resolvedHistoryMode !== "firstPage"
          ? await fetchGmgnWalletActivityPaginated({
              chain,
              wallet,
              limitPerPage: activityLimit,
              historyMode: resolvedHistoryMode,
              maxPages: cappedWalletMaxPages,
              hardMaxPages: cappedHardMaxPages,
              maxActivities: cappedWalletMaxActivities,
            })
          : normalizeGmgnActivityResponse(
              await runGmgnWalletActivity({
                chain,
                wallet,
                limit: activityLimit,
              })
            );
        const paginationMeta = normalizedActivity as Partial<{
          pagesFetched: number;
          hasMoreHistory: boolean;
          stoppedByPageLimit: boolean;
          stoppedByActivityLimit: boolean;
          stoppedByTimeout: boolean;
          reachedEndOfHistory: boolean;
        }>;

        return buildHolderSnapshot({
          holder,
          holderRank,
          wallet,
          chain,
          normalizedActivity,
          includeRaw,
          debug,
          historyMode: resolvedHistoryMode,
          pagesFetched:
            resolvedHistoryMode !== "firstPage" ? paginationMeta.pagesFetched : 1,
          hasMoreHistory:
            resolvedHistoryMode !== "firstPage"
              ? paginationMeta.hasMoreHistory
              : Boolean(normalizedActivity.next),
          stoppedByPageLimit: resolvedHistoryMode !== "firstPage"
            ? paginationMeta.stoppedByPageLimit
            : Boolean(normalizedActivity.next),
          stoppedByActivityLimit: resolvedHistoryMode !== "firstPage"
            ? paginationMeta.stoppedByActivityLimit
            : false,
          stoppedByTimeout:
            resolvedHistoryMode !== "firstPage"
              ? paginationMeta.stoppedByTimeout
              : false,
          reachedEndOfHistory:
            resolvedHistoryMode !== "firstPage"
              ? paginationMeta.reachedEndOfHistory
              : !normalizedActivity.next,
        });
      } catch (error) {
        return {
          wallet,
          holderRank,
          ownershipPercentage: holder.amountPercentage,
          tokenAmount: holder.amount,
          usdValue: holder.usdValue,
          activityCount: 0,
          hasNext: false,
          oldestTimestamp: null,
          newestTimestamp: null,
          buyCount: 0,
          sellCount: 0,
          transferCount: 0,
          uniqueTokensTraded: 0,
          totalBuyUsd: null,
          totalSellUsd: null,
          realizedPnlUsdApprox: null,
          winCount: null,
          lossCount: null,
          winRate: null,
          avgTradeUsd: null,
          avgBuyUsd: null,
          avgSellUsd: null,
          avgHoldTimeSecondsApprox: null,
          dataConfidence: "low",
          missingData: {
            walletAge: true,
            tradeHistory: true,
            timestamps: true,
            pnl: true,
            holdings: false,
            tokenIdentity: true,
            usdValues: true,
            holdTimePairs: true,
          },
          historyMode: resolvedHistoryMode,
          pagesFetched: 0,
          hasMoreHistory: false,
          stoppedByPageLimit: false,
          stoppedByActivityLimit: false,
          stoppedByTimeout: false,
          reachedEndOfHistory: false,
          error:
            error instanceof Error
              ? error.message
              : "GMGN holder activity request failed.",
        };
      }
    },
  });

  const holderErrors = holders
    .filter((holder) => holder.error)
    .map((holder) => ({
      wallet: holder.wallet,
      holderRank: holder.holderRank,
      error: holder.error || "Unknown holder error.",
    }));
  const successfulHolders = holders.filter((holder) => !holder.error);
  const holdersWithActivity = successfulHolders.filter(
    (holder) => holder.activityCount > 0
  ).length;
  const holdersWithNextCursor = successfulHolders.filter((holder) => holder.hasNext).length;
  const totalPagesFetched = successfulHolders.reduce(
    (sum, holder) => sum + (holder.pagesFetched || 0),
    0
  );
  const averagePagesPerWallet = average(
    successfulHolders
      .map((holder) => holder.pagesFetched)
      .filter((value): value is number => value !== undefined)
  );
  const walletsReachedEndOfHistory = successfulHolders.filter(
    (holder) => holder.reachedEndOfHistory
  ).length;
  const walletsStoppedByPageLimit = successfulHolders.filter(
    (holder) => holder.stoppedByPageLimit
  ).length;
  const walletsStoppedByActivityLimit = successfulHolders.filter(
    (holder) => holder.stoppedByActivityLimit
  ).length;
  const walletsStoppedByTimeout = successfulHolders.filter(
    (holder) => holder.stoppedByTimeout
  ).length;
  const walletsWithFullHistory = successfulHolders.filter(
    (holder) => holder.activityCount > 0 && holder.reachedEndOfHistory
  ).length;
  const totalActivities = successfulHolders.reduce(
    (sum, holder) => sum + holder.activityCount,
    0
  );
  const oldestTimestamps = successfulHolders
    .map((holder) => timestampMs(holder.oldestTimestamp))
    .filter((value): value is number => value !== null);
  const newestTimestamps = successfulHolders
    .map((holder) => timestampMs(holder.newestTimestamp))
    .filter((value): value is number => value !== null);
  const winRates = successfulHolders
    .map((holder) => holder.winRate)
    .filter((value): value is number => value !== null);
  const tradeValues = successfulHolders
    .map((holder) => holder.avgTradeUsd)
    .filter((value): value is number => value !== null);
  const holdTimes = successfulHolders
    .map((holder) => holder.avgHoldTimeSecondsApprox)
    .filter((value): value is number => value !== null);
  const realizedPnlValues = successfulHolders
    .map((holder) => holder.realizedPnlUsdApprox)
    .filter((value): value is number => value !== null);

  return {
    success: true,
    chain,
    address,
    config: {
      holderLimit,
      activityLimit,
      concurrency,
      includeRaw,
      debug,
      deepHistory: resolvedHistoryMode !== "firstPage",
      historyMode: resolvedHistoryMode,
      walletMaxPages: cappedWalletMaxPages,
      hardMaxPages: cappedHardMaxPages,
      walletMaxActivities: cappedWalletMaxActivities,
    },
    topHoldersCount: topHolders.count,
    holdersAnalyzed: holders.length,
    holdersWithActivity,
    holdersWithNextCursor,
    totalActivities,
    deepHistoryEnabled: resolvedHistoryMode !== "firstPage",
    historyMode: resolvedHistoryMode,
    walletMaxPages: cappedWalletMaxPages,
    hardMaxPages: cappedHardMaxPages,
    walletMaxActivities: cappedWalletMaxActivities,
    totalPagesFetched,
    averagePagesPerWallet,
    walletsReachedEndOfHistory,
    walletsWithFullHistory,
    walletsStoppedByPageLimit,
    walletsStoppedByActivityLimit,
    walletsStoppedByTimeout,
    oldestTimestampOverall:
      oldestTimestamps.length > 0
        ? new Date(Math.min(...oldestTimestamps)).toISOString()
        : null,
    newestTimestampOverall:
      newestTimestamps.length > 0
        ? new Date(Math.max(...newestTimestamps)).toISOString()
        : null,
    avgWinRate: average(winRates),
    avgTradeUsd: average(tradeValues),
    avgHoldTimeSecondsApprox: average(holdTimes),
    totalApproxRealizedPnlUsd: sumOrNull(realizedPnlValues),
    dataCoverageScore: buildCoverageScore({
      holdersAnalyzed: holders.length,
      holdersFailed: holderErrors.length,
      holdersWithActivity,
      holdersWithNextCursor,
      totalActivities,
    }),
    holdersFailed: holderErrors.length,
    holderErrors,
    holders,
  };
}
