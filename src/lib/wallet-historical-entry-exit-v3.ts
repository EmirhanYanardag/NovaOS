import {
  analyzeWalletEntryExitDisciplineV2,
  getRelevantEntryExitActivityRange,
  type WalletEntryExitDisciplineV2,
} from "@/lib/entry-exit-discipline-v2";
import type { GMGNActivity } from "@/lib/gmgn";
import { fetchGmgnTokenKline, type GmgnTokenKlineResult } from "@/lib/gmgn-token-kline";
import { fetchGmgnWalletActivityPaginated } from "@/lib/gmgn-wallet-activity";

type UnknownRecord = Record<string, unknown>;
type KlineInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

type DiscoveredToken = {
  tokenAddress: string;
  tokenSymbol: string | null;
  activityCount: number;
  buyCount: number;
  sellCount: number;
};

type KlineRetryAttempt = {
  interval: KlineInterval;
  count: number;
  earliest: number | null;
  latest: number | null;
  covered: boolean;
};

export type WalletHistoricalEntryExitV3Options = {
  maxTokens?: number;
  walletMaxPages?: number;
  walletMaxActivities?: number;
  interval?: KlineInterval;
  concurrency?: number;
};

export type HistoricalTokenEntryExitBreakdownV3 = {
  tokenAddress: string;
  tokenSymbol: string | null;
  completedTrades: number;
  totalCompletedTrades: number;
  coveredTrades: number;
  entryDiscipline: number | null;
  exitDiscipline: number | null;
  medianEntryScore: number | null;
  medianExitScore: number | null;
  averageRealizedMultiple: number | null;
  averagePeakCaptureRatio: number | null;
  averageMissedUpsideRatio: number | null;
  averageHoldSeconds: number | null;
  coverageRate: number | null;
  weight: number;
  effectiveInterval: KlineInterval | null;
  klineCoverageStrategy: string;
  klineRetryAttempts: KlineRetryAttempt[];
  warnings: string[];
};

export type WalletHistoricalEntryExitV3Result = {
  wallet: string;
  historicalEntryDiscipline: number | null;
  historicalExitDiscipline: number | null;
  historicalTradeCount: number;
  historicalTokenCount: number;
  historicalAverageHold: number | null;
  historicalRealizedMultiple: number | null;
  historicalPeakCapture: number | null;
  historicalMissedUpside: number | null;
  confidence: "low" | "medium" | "high";
  tokenBreakdown: HistoricalTokenEntryExitBreakdownV3[];
  explanations: string[];
  warnings: string[];
};

export const EXCLUDED_HISTORICAL_ENTRY_EXIT_SYMBOLS = new Set([
  "ETH",
  "WETH",
  "BTC",
  "WBTC",
  "USDT",
  "USDC",
  "DAI",
  "BUSD",
  "USDE",
  "FDUSD",
  "TUSD",
  "SOL",
  "WSOL",
  "BNB",
  "WBNB",
]);

const DEFAULT_MAX_TOKENS = 50;
const DEFAULT_WALLET_MAX_PAGES = 25;
const DEFAULT_WALLET_MAX_ACTIVITIES = 5000;
const DEFAULT_INTERVAL: KlineInterval = "1h";
const DEFAULT_CONCURRENCY = 2;
const KLINE_LIMIT = 500;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function round(value: number, decimals = 4) {
  return Number(value.toFixed(decimals));
}

function capInteger(value: number | undefined, defaultValue: number, max: number) {
  if (!value || !Number.isInteger(value) || value < 1) return defaultValue;
  return Math.min(value, max);
}

function firstString(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = asString(record[key]);
    if (value) return value;
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

function activityEventType(activity: GMGNActivity) {
  const raw = isRecord(activity.raw) ? activity.raw : {};
  const value = (
    firstString(raw, ["event_type", "eventType", "side", "type", "event"]) ||
    activity.type ||
    ""
  ).toLowerCase();

  if (value === "buy" || value.includes("buy")) return "buy";
  if (value === "sell" || value.includes("sell")) return "sell";
  return "other";
}

function activityToken(activity: GMGNActivity) {
  const raw = isRecord(activity.raw) ? activity.raw : {};
  const tokenAddress =
    firstNestedString(raw, [["token", "address"], ["base_token", "address"]]) ||
    firstString(raw, [
      "token_address",
      "tokenAddress",
      "base_address",
      "baseAddress",
      "contract_address",
    ]) ||
    activity.tokenAddress;
  const tokenSymbol =
    firstNestedString(raw, [["token", "symbol"], ["base_token", "symbol"]]) ||
    firstString(raw, ["token_symbol", "tokenSymbol", "symbol"]) ||
    activity.tokenSymbol;

  return {
    tokenAddress,
    tokenSymbol,
  };
}

function isExcludedToken(token: { tokenAddress: string | null; tokenSymbol: string | null }) {
  if (!token.tokenAddress) return true;
  const symbol = token.tokenSymbol?.toUpperCase();
  return Boolean(symbol && EXCLUDED_HISTORICAL_ENTRY_EXIT_SYMBOLS.has(symbol));
}

function discoverTradedTokens(activities: GMGNActivity[], maxTokens: number) {
  const tokens = new Map<string, DiscoveredToken>();

  for (const activity of activities) {
    const eventType = activityEventType(activity);
    if (eventType !== "buy" && eventType !== "sell") continue;

    const token = activityToken(activity);
    if (isExcludedToken(token)) continue;

    const tokenAddress = token.tokenAddress as string;
    const key = tokenAddress.toLowerCase();
    const current =
      tokens.get(key) ??
      {
        tokenAddress,
        tokenSymbol: token.tokenSymbol,
        activityCount: 0,
        buyCount: 0,
        sellCount: 0,
      };

    current.activityCount += 1;
    if (eventType === "buy") current.buyCount += 1;
    if (eventType === "sell") current.sellCount += 1;
    if (!current.tokenSymbol && token.tokenSymbol) current.tokenSymbol = token.tokenSymbol;
    tokens.set(key, current);
  }

  return [...tokens.values()]
    .filter((token) => token.buyCount > 0 && token.sellCount > 0)
    .sort((a, b) => b.activityCount - a.activityCount)
    .slice(0, maxTokens);
}

function unixSeconds(value: number | null) {
  if (value === null) return null;
  return value > 9_999_999_999 ? Math.trunc(value / 1000) : value;
}

function klineBounds(kline: GmgnTokenKlineResult) {
  const timestamps = kline.candles
    .map((candle) => unixSeconds(candle.timestampUnix))
    .filter((timestamp): timestamp is number => timestamp !== null);

  return {
    earliest: timestamps.length > 0 ? Math.min(...timestamps) : null,
    latest: timestamps.length > 0 ? Math.max(...timestamps) : null,
  };
}

function klineCoversWindow({
  earliest,
  latest,
  targetEarliest,
  targetLatest,
  coverageGraceSeconds,
}: {
  earliest: number | null;
  latest: number | null;
  targetEarliest: number | null;
  targetLatest: number | null;
  coverageGraceSeconds: number;
}) {
  if (targetEarliest === null || targetLatest === null) return false;
  if (earliest === null || latest === null) return false;
  return earliest <= targetEarliest + coverageGraceSeconds && latest + coverageGraceSeconds >= targetLatest;
}

function klineRetryOrder(requestedInterval: KlineInterval) {
  return Array.from(new Set<KlineInterval>([requestedInterval, "4h", "1d"]));
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

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );

  return results;
}

function weightedAverage(items: Array<{ value: number | null; weight: number }>) {
  const scored = items.filter((item): item is { value: number; weight: number } => item.value !== null);
  const totalWeight = scored.reduce((total, item) => total + item.weight, 0);
  if (totalWeight <= 0) return null;
  return round(scored.reduce((total, item) => total + item.value * item.weight, 0) / totalWeight);
}

function confidence({ tokenCount, tradeCount, coverageRate }: {
  tokenCount: number;
  tradeCount: number;
  coverageRate: number;
}): "low" | "medium" | "high" {
  if (tradeCount >= 50 && tokenCount >= 20 && coverageRate >= 70) return "high";
  if (tradeCount >= 10 && tokenCount >= 3 && coverageRate >= 40) return "medium";
  return "low";
}

function explanations(result: {
  historicalTradeCount: number;
  historicalTokenCount: number;
  historicalEntryDiscipline: number | null;
  historicalExitDiscipline: number | null;
}) {
  const rows = [
    "Wallet Historical Entry/Exit Discipline V3 measures behavior across all discovered traded tokens, not only the currently analyzed token.",
    "Per-token scoring reuses Entry/Exit Discipline V2 trade pairing, peak capture, missed upside, and score formulas.",
  ];

  if (result.historicalTradeCount === 0) {
    rows.push("No covered completed historical trades were available after exclusions and kline coverage checks.");
  }

  if (result.historicalEntryDiscipline !== null) {
    rows.push(`Historical Entry Discipline is ${result.historicalEntryDiscipline}/100 across ${result.historicalTokenCount} token(s).`);
  }

  if (result.historicalExitDiscipline !== null) {
    rows.push(`Historical Exit Discipline is ${result.historicalExitDiscipline}/100 across ${result.historicalTradeCount} completed covered trade(s).`);
  }

  return rows;
}

async function fetchCoveredKline({
  chain,
  tokenAddress,
  requestedInterval,
  from,
  to,
}: {
  chain: string;
  tokenAddress: string;
  requestedInterval: KlineInterval;
  from?: number;
  to?: number;
}) {
  const attempts: KlineRetryAttempt[] = [];
  const results: GmgnTokenKlineResult[] = [];
  const targetEarliest = from === undefined ? null : from + 3600;
  const targetLatest = to ?? null;

  for (const interval of klineRetryOrder(requestedInterval)) {
    const kline = await fetchGmgnTokenKline(chain, tokenAddress, {
      interval,
      limit: KLINE_LIMIT,
      from,
      to,
    });
    const bounds = klineBounds(kline);
    const coverageGraceSeconds = interval === "1d" ? 86_400 : 0;
    const covered = klineCoversWindow({
      earliest: bounds.earliest,
      latest: bounds.latest,
      targetEarliest,
      targetLatest,
      coverageGraceSeconds,
    });

    attempts.push({
      interval,
      count: kline.count,
      earliest: bounds.earliest,
      latest: bounds.latest,
      covered,
    });
    results.push(kline);

    if (covered) break;
  }

  const coveredIndex = attempts.findIndex((attempt) => attempt.covered);
  const selectedIndex = coveredIndex >= 0 ? coveredIndex : Math.max(0, results.length - 1);
  const effectiveInterval = attempts[selectedIndex]?.interval ?? null;

  return {
    kline: results[selectedIndex] ?? null,
    effectiveInterval,
    strategy:
      coveredIndex === 0
        ? "requested-interval-covered"
        : coveredIndex > 0
          ? "widened-interval-covered"
          : "no-interval-covered",
    attempts,
    coverageGraceSeconds: effectiveInterval === "1d" ? 86_400 : 0,
  };
}

function tokenBreakdownFromAnalysis({
  token,
  analysis,
  effectiveInterval,
  strategy,
  attempts,
}: {
  token: DiscoveredToken;
  analysis: WalletEntryExitDisciplineV2;
  effectiveInterval: KlineInterval | null;
  strategy: string;
  attempts: KlineRetryAttempt[];
}): HistoricalTokenEntryExitBreakdownV3 {
  return {
    tokenAddress: token.tokenAddress,
    tokenSymbol: token.tokenSymbol,
    completedTrades: analysis.coveredTradeCount,
    totalCompletedTrades: analysis.completedTradeCount,
    coveredTrades: analysis.coveredTradeCount,
    entryDiscipline: analysis.entryDisciplineV2,
    exitDiscipline: analysis.exitDisciplineV2,
    medianEntryScore: analysis.medianEntryScore,
    medianExitScore: analysis.medianExitScore,
    averageRealizedMultiple: analysis.averageRealizedMultiple,
    averagePeakCaptureRatio: analysis.averagePeakCaptureRatio,
    averageMissedUpsideRatio: analysis.averageMissedUpsideRatio,
    averageHoldSeconds: analysis.averageHoldSeconds,
    coverageRate: analysis.coverageRate,
    weight: analysis.coveredTradeCount,
    effectiveInterval,
    klineCoverageStrategy: strategy,
    klineRetryAttempts: attempts,
    warnings: analysis.warnings,
  };
}

export async function analyzeWalletHistoricalEntryExitV3({
  chain,
  wallet,
  options = {},
}: {
  chain: string;
  wallet: string;
  options?: WalletHistoricalEntryExitV3Options;
}): Promise<WalletHistoricalEntryExitV3Result> {
  const maxTokens = capInteger(options.maxTokens, DEFAULT_MAX_TOKENS, 100);
  const walletMaxPages = capInteger(options.walletMaxPages, DEFAULT_WALLET_MAX_PAGES, 50);
  const walletMaxActivities = capInteger(options.walletMaxActivities, DEFAULT_WALLET_MAX_ACTIVITIES, 5000);
  const interval = options.interval ?? DEFAULT_INTERVAL;
  const concurrency = capInteger(options.concurrency, DEFAULT_CONCURRENCY, 5);
  const warnings: string[] = [];
  const activity = await fetchGmgnWalletActivityPaginated({
    chain,
    wallet,
    limitPerPage: 100,
    historyMode: "full",
    hardMaxPages: walletMaxPages,
    maxActivities: walletMaxActivities,
  });

  if (activity.stoppedByPageLimit) warnings.push("Wallet activity stopped by page limit.");
  if (activity.stoppedByActivityLimit) warnings.push("Wallet activity stopped by activity limit.");
  if (activity.stoppedByTimeout) warnings.push("Wallet activity stopped by timeout.");

  const tokens = discoverTradedTokens(activity.activities, maxTokens);
  if (tokens.length === 0) {
    warnings.push("No eligible non-stable traded tokens with both buys and sells were discovered.");
  }

  const tokenResults = await mapWithConcurrency({
    items: tokens,
    concurrency,
    mapper: async (token) => {
      try {
        const range = getRelevantEntryExitActivityRange({
          activities: activity.activities,
          wallet,
          tokenAddress: token.tokenAddress,
        });
        const from =
          range.earliestRelevantBuyTimestamp === null
            ? undefined
            : Math.max(0, range.earliestRelevantBuyTimestamp - 3600);
        const to =
          range.latestRelevantSellTimestamp ??
          range.latestRelevantActivityTimestamp ??
          undefined;
        const klineResult = await fetchCoveredKline({
          chain,
          tokenAddress: token.tokenAddress,
          requestedInterval: interval,
          from,
          to,
        });

        if (!klineResult.kline) {
          return {
            token,
            error: "No kline result returned.",
          };
        }

        const analysis = analyzeWalletEntryExitDisciplineV2({
          chain,
          tokenAddress: token.tokenAddress,
          wallet,
          activities: activity.activities,
          candles: klineResult.kline.candles,
          totalSupply: klineResult.kline.totalSupply,
          coverageGraceSeconds: klineResult.coverageGraceSeconds,
        });
        const tokenWarnings = [...klineResult.kline.warnings, ...analysis.warnings];
        if (klineResult.effectiveInterval === "1d") {
          tokenWarnings.push("Daily kline resolution was used; Entry/Exit V3 is approximate for this token.");
        }

        return {
          token,
          breakdown: tokenBreakdownFromAnalysis({
            token,
            analysis: {
              ...analysis,
              warnings: Array.from(new Set(tokenWarnings)),
            },
            effectiveInterval: klineResult.effectiveInterval,
            strategy: klineResult.strategy,
            attempts: klineResult.attempts,
          }),
        };
      } catch (error) {
        return {
          token,
          error: error instanceof Error ? error.message : "Unknown token analysis error.",
        };
      }
    },
  });
  const tokenBreakdown = tokenResults
    .map((result) => "breakdown" in result ? result.breakdown : null)
    .filter((result): result is HistoricalTokenEntryExitBreakdownV3 => result !== null);

  for (const result of tokenResults) {
    if ("error" in result) {
      warnings.push(`Token ${result.token.tokenSymbol ?? result.token.tokenAddress} analysis failed: ${result.error}`);
    }
  }

  const historicalTradeCount = tokenBreakdown.reduce(
    (total, token) => total + token.completedTrades,
    0
  );
  const totalCompletedTradePairs = tokenBreakdown.reduce(
    (total, token) => total + token.totalCompletedTrades,
    0
  );
  const coverageRate =
    totalCompletedTradePairs > 0
      ? (historicalTradeCount / totalCompletedTradePairs) * 100
      : 0;
  const historicalEntryDiscipline = weightedAverage(
    tokenBreakdown.map((token) => ({
      value: token.entryDiscipline,
      weight: token.weight,
    }))
  );
  const historicalExitDiscipline = weightedAverage(
    tokenBreakdown.map((token) => ({
      value: token.exitDiscipline,
      weight: token.weight,
    }))
  );
  const historicalRealizedMultiple = weightedAverage(
    tokenBreakdown.map((token) => ({
      value: token.averageRealizedMultiple,
      weight: token.weight,
    }))
  );
  const historicalPeakCapture = weightedAverage(
    tokenBreakdown.map((token) => ({
      value: token.averagePeakCaptureRatio,
      weight: token.weight,
    }))
  );
  const historicalMissedUpside = weightedAverage(
    tokenBreakdown.map((token) => ({
      value: token.averageMissedUpsideRatio,
      weight: token.weight,
    }))
  );
  const historicalAverageHold = weightedAverage(
    tokenBreakdown.map((token) => ({
      value: token.averageHoldSeconds,
      weight: token.weight,
    }))
  );
  const result = {
    wallet,
    historicalEntryDiscipline,
    historicalExitDiscipline,
    historicalTradeCount,
    historicalTokenCount: tokenBreakdown.filter((token) => token.completedTrades > 0).length,
    historicalAverageHold,
    historicalRealizedMultiple,
    historicalPeakCapture,
    historicalMissedUpside,
    confidence: confidence({
      tokenCount: tokenBreakdown.filter((token) => token.completedTrades > 0).length,
      tradeCount: historicalTradeCount,
      coverageRate,
    }),
    tokenBreakdown,
    explanations: [] as string[],
    warnings: Array.from(new Set(warnings)),
  };

  result.explanations = explanations(result);

  return result;
}
