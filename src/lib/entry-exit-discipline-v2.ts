import type { GMGNActivity, GMGNHolder } from "@/lib/gmgn";
import {
  computeMarketCapFromPrice,
  getKlinePeakAfterTimestamp,
  getNearestCandleAtOrBefore,
  type TokenKlineCandle,
} from "@/lib/gmgn-token-kline";

type UnknownRecord = Record<string, unknown>;

type NormalizedTokenActivity = {
  wallet: string;
  tokenAddress: string | null;
  tokenSymbol: string | null;
  eventType: "buy" | "sell" | "transfer" | "unknown";
  txHash: string | null;
  timestampUnix: number | null;
  timestamp: string | null;
  priceUsd: number | null;
  tokenAmount: number | null;
  costUsd: number | null;
};

type OpenLot = NormalizedTokenActivity & {
  remainingAmount: number | null;
};

export type TradePairV2 = {
  wallet: string;
  tokenAddress: string;
  tokenSymbol: string | null;
  buyTxHash: string | null;
  sellTxHash: string | null;
  klineEarliestTimestampUnix: number | null;
  klineLatestTimestampUnix: number | null;
  buyTimestampUnix: number | null;
  buyTimestamp: string | null;
  sellTimestampUnix: number | null;
  sellTimestamp: string | null;
  buyPriceUsd: number | null;
  sellPriceUsd: number | null;
  buyCostUsd: number | null;
  buyMarketCap: number | null;
  sellMarketCap: number | null;
  postEntryPeakPrice: number | null;
  postEntryPeakMarketCap: number | null;
  postExitPeakPrice: number | null;
  postExitPeakMarketCap: number | null;
  realizedMultiple: number | null;
  entryToPeakRatio: number | null;
  exitToEntryMultiple: number | null;
  peakCaptureRatio: number | null;
  missedUpsideRatio: number | null;
  holdSeconds: number | null;
  isKlineCovered: boolean;
  coverageDecision: {
    covered: boolean;
    reason: string;
  };
  entryScore: number | null;
  exitScore: number | null;
  notes: string[];
};

export type WalletEntryExitDisciplineV2 = {
  wallet: string;
  tokenAddress: string;
  completedTradeCount: number;
  coveredTradeCount: number;
  uncoveredTradeCount: number;
  coverageRate: number | null;
  skippedBecauseKlineCoverage: number;
  skippedTradeCount: number;
  entryDisciplineV2: number | null;
  exitDisciplineV2: number | null;
  medianEntryScore: number | null;
  medianExitScore: number | null;
  earlyEntryRate: number | null;
  lateEntryRate: number | null;
  strongExitRate: number | null;
  poorExitRate: number | null;
  averageRealizedMultiple: number | null;
  medianRealizedMultiple: number | null;
  averageEntryToPeakRatio: number | null;
  averagePeakCaptureRatio: number | null;
  averageMissedUpsideRatio: number | null;
  averageHoldSeconds: number | null;
  medianHoldSeconds: number | null;
  dataConfidence: "low" | "medium" | "high";
  warnings: string[];
  explanations: string[];
  tradePairsSample: TradePairV2[];
  weight: number;
};

export type EntryExitDisciplineAggregateV2 = {
  averageEntryDisciplineV2: number | null;
  averageExitDisciplineV2: number | null;
  weightedEntryDisciplineV2: number | null;
  weightedExitDisciplineV2: number | null;
  analyzedWalletCount: number;
  walletsWithCompletedTrades: number;
  totalCompletedTrades: number;
  averageCompletedTradesPerWallet: number | null;
  highConfidenceWalletCount: number;
  mediumConfidenceWalletCount: number;
  lowConfidenceWalletCount: number;
};

export type EntryExitRelevantActivityRange = {
  earliestRelevantBuyTimestamp: number | null;
  latestRelevantSellTimestamp: number | null;
  latestRelevantActivityTimestamp: number | null;
};

export type AnalyzeWalletEntryExitInput = {
  chain: string;
  tokenAddress: string;
  wallet: string;
  activities: GMGNActivity[];
  candles: TokenKlineCandle[];
  totalSupply: number | null;
  coverageGraceSeconds?: number;
  holder?: GMGNHolder | null;
  includeRaw?: boolean;
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function round(value: number, decimals = 4) {
  return Number(value.toFixed(decimals));
}

function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function clampScore(value: number) {
  return Math.round(clamp(value));
}

function timestampParts(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 9_999_999_999 ? value : value * 1000;
    return {
      timestampUnix: Math.trunc(ms / 1000),
      timestamp: new Date(ms).toISOString(),
    };
  }

  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    const parsed = Number.isFinite(numeric)
      ? numeric > 9_999_999_999
        ? numeric
        : numeric * 1000
      : Date.parse(value);

    if (Number.isFinite(parsed)) {
      return {
        timestampUnix: Math.trunc(parsed / 1000),
        timestamp: new Date(parsed).toISOString(),
      };
    }
  }

  return {
    timestampUnix: null,
    timestamp: null,
  };
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

function eventType(activity: GMGNActivity, raw: UnknownRecord) {
  const value = (
    firstString(raw, ["event_type", "eventType", "side", "type", "event"]) ||
    activity.type ||
    ""
  ).toLowerCase();

  if (value === "buy" || value.includes("buy")) return "buy";
  if (value === "sell" || value.includes("sell")) return "sell";
  if (value === "transfer" || value.includes("transfer")) return "transfer";
  return "unknown";
}

function normalizedTokenAddress(activity: GMGNActivity, raw: UnknownRecord) {
  return (
    firstNestedString(raw, [["token", "address"], ["base_token", "address"]]) ||
    firstString(raw, [
      "token_address",
      "tokenAddress",
      "base_address",
      "baseAddress",
      "contract_address",
    ]) ||
    activity.tokenAddress
  );
}

function normalizeActivity({
  activity,
  wallet,
  candles,
}: {
  activity: GMGNActivity;
  wallet: string;
  candles: TokenKlineCandle[];
}): NormalizedTokenActivity {
  const raw = isRecord(activity.raw) ? activity.raw : {};
  const timestamp = timestampParts(
    activity.timestamp ||
      raw.timestamp ||
      raw.timestamp_unix ||
      raw.timestampUnix ||
      raw.time ||
      raw.block_time ||
      raw.blockTime
  );
  const tokenAmountValue =
    firstNumber(raw, ["token_amount", "tokenAmount", "amount", "base_amount", "baseAmount"]) ??
    asNumber(activity.amount);
  const costUsd =
    firstNumber(raw, ["cost_usd", "costUsd", "amount_usd", "amountUsd", "value_usd", "valueUsd", "usd"]) ??
    activity.valueUsd;
  const rawPrice =
    firstNumber(raw, ["price_usd", "priceUsd", "usd_price", "usdPrice", "price"]) ??
      firstNestedNumber(raw, [["token", "price_usd"], ["base_token", "price_usd"]]);
  const candle = timestamp.timestampUnix === null
    ? null
    : getNearestCandleAtOrBefore(candles, timestamp.timestampUnix);
  const derivedPrice =
    rawPrice ??
    candle?.close ??
    (costUsd !== null && tokenAmountValue !== null && tokenAmountValue > 0
      ? costUsd / tokenAmountValue
      : null);

  return {
    wallet,
    tokenAddress: normalizedTokenAddress(activity, raw),
    tokenSymbol:
      firstNestedString(raw, [["token", "symbol"], ["base_token", "symbol"]]) ||
      firstString(raw, ["token_symbol", "tokenSymbol", "symbol"]) ||
      activity.tokenSymbol,
    eventType: eventType(activity, raw),
    txHash: firstString(raw, ["tx_hash", "txHash", "hash", "transaction_hash"]) || activity.txHash,
    timestampUnix: timestamp.timestampUnix,
    timestamp: timestamp.timestamp,
    priceUsd: derivedPrice === null ? null : round(derivedPrice, 12),
    tokenAmount: tokenAmountValue,
    costUsd,
  };
}

export function getRelevantEntryExitActivityRange({
  activities,
  wallet,
  tokenAddress,
}: {
  activities: GMGNActivity[];
  wallet: string;
  tokenAddress: string;
}): EntryExitRelevantActivityRange {
  const normalizedAddress = tokenAddress.toLowerCase();
  const tokenActivities = activities
    .map((activity) => normalizeActivity({ activity, wallet, candles: [] }))
    .filter((activity) => activity.tokenAddress?.toLowerCase() === normalizedAddress)
    .filter((activity) => activity.eventType === "buy" || activity.eventType === "sell");
  const buyTimestamps = tokenActivities
    .filter((activity) => activity.eventType === "buy")
    .map((activity) => activity.timestampUnix)
    .filter((timestamp): timestamp is number => timestamp !== null);
  const sellTimestamps = tokenActivities
    .filter((activity) => activity.eventType === "sell")
    .map((activity) => activity.timestampUnix)
    .filter((timestamp): timestamp is number => timestamp !== null);
  const activityTimestamps = tokenActivities
    .map((activity) => activity.timestampUnix)
    .filter((timestamp): timestamp is number => timestamp !== null);

  return {
    earliestRelevantBuyTimestamp:
      buyTimestamps.length > 0 ? Math.min(...buyTimestamps) : null,
    latestRelevantSellTimestamp:
      sellTimestamps.length > 0 ? Math.max(...sellTimestamps) : null,
    latestRelevantActivityTimestamp:
      activityTimestamps.length > 0 ? Math.max(...activityTimestamps) : null,
  };
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? round(sorted[midpoint])
    : round((sorted[midpoint - 1] + sorted[midpoint]) / 2);
}

function rate(count: number, total: number) {
  return total > 0 ? round((count / total) * 100, 2) : null;
}

function weightedAverage(items: Array<{ value: number | null; weight: number }>) {
  const scoredItems = items.filter((item): item is { value: number; weight: number } => item.value !== null);
  const totalWeight = scoredItems.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return null;
  return round(scoredItems.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight);
}

function klineBounds(candles: TokenKlineCandle[]) {
  const timestamps = candles
    .map((candle) => candle.timestampUnix)
    .map((timestamp) =>
      timestamp !== null && timestamp > 9_999_999_999
        ? Math.trunc(timestamp / 1000)
        : timestamp
    )
    .filter((timestamp): timestamp is number => timestamp !== null);
  if (timestamps.length === 0) {
    return {
      earliest: null,
      latest: null,
    };
  }

  return {
    earliest: Math.min(...timestamps),
    latest: Math.max(...timestamps),
  };
}

function tradePairKlineCovered({
  candles,
  buyTimestampUnix,
  sellTimestampUnix,
  coverageGraceSeconds = 0,
}: {
  candles: TokenKlineCandle[];
  buyTimestampUnix: number | null;
  sellTimestampUnix: number | null;
  coverageGraceSeconds?: number;
}) {
  if (buyTimestampUnix === null || sellTimestampUnix === null) {
    return {
      covered: false,
      reason: "missing-buy-or-sell-timestamp",
      klineEarliestTimestampUnix: null,
      klineLatestTimestampUnix: null,
    };
  }
  const bounds = klineBounds(candles);
  if (bounds.earliest === null || bounds.latest === null) {
    return {
      covered: false,
      reason: "missing-kline-bounds",
      klineEarliestTimestampUnix: bounds.earliest,
      klineLatestTimestampUnix: bounds.latest,
    };
  }

  if (bounds.earliest > buyTimestampUnix + coverageGraceSeconds) {
    return {
      covered: false,
      reason: "kline-starts-after-buy",
      klineEarliestTimestampUnix: bounds.earliest,
      klineLatestTimestampUnix: bounds.latest,
    };
  }

  if (bounds.latest + coverageGraceSeconds < sellTimestampUnix) {
    return {
      covered: false,
      reason: "kline-ends-before-sell",
      klineEarliestTimestampUnix: bounds.earliest,
      klineLatestTimestampUnix: bounds.latest,
    };
  }

  return {
    covered: true,
    reason: "kline-covers-buy-sell-window",
    klineEarliestTimestampUnix: bounds.earliest,
    klineLatestTimestampUnix: bounds.latest,
  };
}

function nullableAverage(values: Array<number | null>) {
  return average(values.filter((value): value is number => value !== null));
}

function nullableMedian(values: Array<number | null>) {
  return median(values.filter((value): value is number => value !== null));
}

function holderWeight(holder?: GMGNHolder | null) {
  if (holder?.amountPercentage !== null && holder?.amountPercentage !== undefined && holder.amountPercentage > 0) {
    return Math.sqrt(holder.amountPercentage);
  }

  if (holder?.usdValue !== null && holder?.usdValue !== undefined && holder.usdValue > 0) {
    return Math.sqrt(holder.usdValue);
  }

  return 1;
}

function marketCapBucketAdjustment(buyMarketCap: number | null, notes: string[]) {
  if (buyMarketCap === null) return 0;
  if (buyMarketCap < 100_000) {
    notes.push("Very early entry below 100k market cap; high-risk early entry boost applied.");
    return 8;
  }
  if (buyMarketCap < 500_000) return 10;
  if (buyMarketCap < 2_000_000) return 5;
  if (buyMarketCap < 10_000_000) return 0;
  if (buyMarketCap < 50_000_000) return -8;
  return -15;
}

function scoreEntry(entryToPeakRatio: number | null, buyMarketCap: number | null, notes: string[]) {
  if (entryToPeakRatio === null) {
    notes.push("No post-entry peak available; entry score is neutral.");
    return 50;
  }

  const base = 100 * (1 - Math.sqrt(clamp(entryToPeakRatio, 0, 1)));
  return clampScore(base + marketCapBucketAdjustment(buyMarketCap, notes));
}

function realizedMultipleScore(realizedMultiple: number | null) {
  if (realizedMultiple === null) return 50;
  if (realizedMultiple < 0.5) return 5;
  if (realizedMultiple < 0.8) return 20;
  if (realizedMultiple < 1) return 35;
  if (realizedMultiple < 1.25) return 50;
  if (realizedMultiple < 2) return 65;
  if (realizedMultiple < 5) return 80;
  return 95;
}

function peakCaptureScore(peakCaptureRatio: number | null) {
  if (peakCaptureRatio === null) return 50;
  if (peakCaptureRatio >= 0.8) return 95;
  if (peakCaptureRatio >= 0.6) return 80;
  if (peakCaptureRatio >= 0.4) return 65;
  if (peakCaptureRatio >= 0.2) return 45;
  if (peakCaptureRatio >= 0.1) return 25;
  return 10;
}

function missedUpsidePenalty(missedUpsideRatio: number | null, realizedMultiple: number | null) {
  if (missedUpsideRatio === null || missedUpsideRatio <= 1.2) return 0;

  let penalty = missedUpsideRatio < 2 ? -5 : missedUpsideRatio < 5 ? -15 : missedUpsideRatio < 10 ? -25 : -35;

  if (realizedMultiple !== null && realizedMultiple >= 10) penalty = Math.max(penalty, -8);
  else if (realizedMultiple !== null && realizedMultiple >= 5) penalty = Math.max(penalty, -15);

  return penalty;
}

function lossControlScore(realizedMultiple: number | null) {
  if (realizedMultiple === null) return 50;
  if (realizedMultiple >= 1) return 70;
  if (realizedMultiple >= 0.9) return 60;
  if (realizedMultiple >= 0.75) return 45;
  if (realizedMultiple >= 0.5) return 25;
  return 10;
}

function holdContextScore(realizedMultiple: number | null, holdSeconds: number | null) {
  if (realizedMultiple === null || holdSeconds === null) return 50;
  if (realizedMultiple >= 2 && holdSeconds < 21_600) return 75;
  if (realizedMultiple >= 2 && holdSeconds >= 21_600) return 70;
  if (realizedMultiple < 1 && holdSeconds > 604_800) return 25;
  return 50;
}

function scoreExit({
  realizedMultiple,
  peakCaptureRatio,
  missedUpsideRatio,
  holdSeconds,
  notes,
}: {
  realizedMultiple: number | null;
  peakCaptureRatio: number | null;
  missedUpsideRatio: number | null;
  holdSeconds: number | null;
  notes: string[];
}) {
  if (realizedMultiple === null) {
    notes.push("Sell or buy price missing; exit score is neutral.");
    return 50;
  }

  const score =
    realizedMultipleScore(realizedMultiple) * 0.45 +
    peakCaptureScore(peakCaptureRatio) * 0.3 +
    lossControlScore(realizedMultiple) * 0.15 +
    holdContextScore(realizedMultiple, holdSeconds) * 0.1 +
    missedUpsidePenalty(missedUpsideRatio, realizedMultiple);

  return clampScore(score);
}

function peakValues(candle: TokenKlineCandle | null) {
  return {
    price: candle?.high ?? null,
    marketCap: candle?.marketCapHigh ?? null,
  };
}

function ratio(numerator: number | null, denominator: number | null) {
  if (numerator === null || denominator === null || denominator <= 0) return null;
  return round(numerator / denominator, 8);
}

function peakRatio({
  numerator,
  peak,
}: {
  numerator: number | null;
  peak: number | null;
}) {
  if (numerator === null || peak === null || peak <= 0) return null;
  if (peak < numerator) return null;
  return ratio(numerator, peak);
}

function clampedPeakCaptureRatio(value: number | null) {
  if (value === null) return null;
  return round(clamp(value, 0, 1), 8);
}

function missedUpsideRatioValue({
  peak,
  exit,
}: {
  peak: number | null;
  exit: number | null;
}) {
  const value = ratio(peak, exit);
  if (value === null || value < 1) return null;
  return value;
}

function buildTradePair({
  wallet,
  tokenAddress,
  buy,
  sell,
  candles,
  totalSupply,
  coverageGraceSeconds,
}: {
  wallet: string;
  tokenAddress: string;
  buy: NormalizedTokenActivity;
  sell: NormalizedTokenActivity;
  candles: TokenKlineCandle[];
  totalSupply: number | null;
  coverageGraceSeconds: number;
}): TradePairV2 {
  const notes: string[] = [];
  const coverageDecision = tradePairKlineCovered({
    candles,
    buyTimestampUnix: buy.timestampUnix,
    sellTimestampUnix: sell.timestampUnix,
    coverageGraceSeconds,
  });
  const isKlineCovered = coverageDecision.covered;
  const buyMarketCap = computeMarketCapFromPrice(buy.priceUsd, totalSupply);
  const sellMarketCap = computeMarketCapFromPrice(sell.priceUsd, totalSupply);
  const postEntryPeak =
    isKlineCovered && buy.timestampUnix !== null
      ? getKlinePeakAfterTimestamp(candles, buy.timestampUnix)
      : null;
  const postExitPeak =
    isKlineCovered && sell.timestampUnix !== null
      ? getKlinePeakAfterTimestamp(candles, sell.timestampUnix)
      : null;
  const postEntryPeakValues = peakValues(postEntryPeak);
  const postExitPeakValues = peakValues(postExitPeak);
  const entryToPeakRatio =
    peakRatio({ numerator: buyMarketCap, peak: postEntryPeakValues.marketCap }) ??
    peakRatio({ numerator: buy.priceUsd, peak: postEntryPeakValues.price });
  const peakCaptureRatio =
    clampedPeakCaptureRatio(
      ratio(sellMarketCap, postEntryPeakValues.marketCap) ??
        ratio(sell.priceUsd, postEntryPeakValues.price)
    );
  const missedUpsideRatio =
    missedUpsideRatioValue({ peak: postExitPeakValues.marketCap, exit: sellMarketCap }) ??
    missedUpsideRatioValue({ peak: postExitPeakValues.price, exit: sell.priceUsd });
  const realizedMultiple = ratio(sell.priceUsd, buy.priceUsd);
  const holdSeconds =
    buy.timestampUnix !== null && sell.timestampUnix !== null
      ? Math.max(0, sell.timestampUnix - buy.timestampUnix)
      : null;

  if (totalSupply === null) {
    notes.push("Total supply unavailable; price-based scoring fallback used.");
  }

  if (!isKlineCovered) {
    notes.push("Trade skipped because kline coverage does not include buy/sell window.");
  }

  if (postExitPeak === null) {
    notes.push("No post-exit peak available in kline range.");
  }

  return {
    wallet,
    tokenAddress,
    tokenSymbol: buy.tokenSymbol || sell.tokenSymbol,
    buyTxHash: buy.txHash,
    sellTxHash: sell.txHash,
    klineEarliestTimestampUnix: coverageDecision.klineEarliestTimestampUnix,
    klineLatestTimestampUnix: coverageDecision.klineLatestTimestampUnix,
    buyTimestampUnix: buy.timestampUnix,
    buyTimestamp: buy.timestamp,
    sellTimestampUnix: sell.timestampUnix,
    sellTimestamp: sell.timestamp,
    buyPriceUsd: buy.priceUsd,
    sellPriceUsd: sell.priceUsd,
    buyCostUsd: buy.costUsd,
    buyMarketCap,
    sellMarketCap,
    postEntryPeakPrice: postEntryPeakValues.price,
    postEntryPeakMarketCap: postEntryPeakValues.marketCap,
    postExitPeakPrice: postExitPeakValues.price,
    postExitPeakMarketCap: postExitPeakValues.marketCap,
    realizedMultiple,
    entryToPeakRatio,
    exitToEntryMultiple: realizedMultiple,
    peakCaptureRatio,
    missedUpsideRatio,
    holdSeconds,
    isKlineCovered,
    coverageDecision: {
      covered: coverageDecision.covered,
      reason: coverageDecision.reason,
    },
    entryScore: isKlineCovered ? scoreEntry(entryToPeakRatio, buyMarketCap, notes) : null,
    exitScore: isKlineCovered
      ? scoreExit({
          realizedMultiple,
          peakCaptureRatio,
          missedUpsideRatio,
          holdSeconds,
          notes,
        })
      : null,
    notes,
  };
}

function buildTradePairs({
  wallet,
  tokenAddress,
  activities,
  candles,
  totalSupply,
  coverageGraceSeconds,
}: {
  wallet: string;
  tokenAddress: string;
  activities: NormalizedTokenActivity[];
  candles: TokenKlineCandle[];
  totalSupply: number | null;
  coverageGraceSeconds: number;
}) {
  const warnings: string[] = [];
  const pairs: TradePairV2[] = [];
  const openLots: OpenLot[] = [];
  let skippedTradeCount = 0;

  const sorted = [...activities]
    .filter((activity) => activity.timestampUnix !== null)
    .sort((a, b) => (a.timestampUnix ?? 0) - (b.timestampUnix ?? 0));

  for (const activity of sorted) {
    if (activity.eventType === "buy") {
      openLots.push({
        ...activity,
        remainingAmount: activity.tokenAmount,
      });
      continue;
    }

    if (activity.eventType !== "sell") continue;

    let remainingSellAmount = activity.tokenAmount;
    while (openLots.length > 0 && (remainingSellAmount === null || remainingSellAmount > 0)) {
      const lot = openLots[0];
      pairs.push(
        buildTradePair({
          wallet,
          tokenAddress,
          buy: lot,
          sell: activity,
          candles,
          totalSupply,
          coverageGraceSeconds,
        })
      );

      if (remainingSellAmount === null || lot.remainingAmount === null) {
        openLots.shift();
        break;
      }

      const matched = Math.min(lot.remainingAmount, remainingSellAmount);
      lot.remainingAmount -= matched;
      remainingSellAmount -= matched;

      if (lot.remainingAmount <= 0) openLots.shift();
    }

    if (openLots.length === 0 && remainingSellAmount !== null && remainingSellAmount > 0) {
      skippedTradeCount += 1;
    }
  }

  if (pairs.some((pair) => pair.buyTxHash === null || pair.sellTxHash === null)) {
    warnings.push("Some trade pairs are missing transaction hashes.");
  }

  if (pairs.length > 0 && activities.some((activity) => activity.tokenAmount === null)) {
    warnings.push("Some token amounts are missing; FIFO pairing is approximate for those events.");
  }

  return {
    pairs,
    skippedTradeCount,
    warnings,
  };
}

function klineCoverage({
  candles,
  activities,
  coverageGraceSeconds = 0,
}: {
  candles: TokenKlineCandle[];
  activities: NormalizedTokenActivity[];
  coverageGraceSeconds?: number;
}) {
  const candleTimes = candles
    .map((candle) => candle.timestampUnix)
    .filter((time): time is number => time !== null);
  const activityTimes = activities
    .map((activity) => activity.timestampUnix)
    .filter((time): time is number => time !== null);
  const buyTimes = activities
    .filter((activity) => activity.eventType === "buy")
    .map((activity) => activity.timestampUnix)
    .filter((time): time is number => time !== null);

  if (candleTimes.length === 0 || activityTimes.length === 0) {
    return {
      good: false,
      warnings: ["Kline or wallet activity timestamps are unavailable; coverage is limited."],
    };
  }

  const earliestCandle = Math.min(...candleTimes);
  const latestCandle = Math.max(...candleTimes);
  const earliestBuy = buyTimes.length > 0 ? Math.min(...buyTimes) : Math.min(...activityTimes);
  const latestActivity = Math.max(...activityTimes);
  const warnings: string[] = [];

  if (earliestCandle > earliestBuy + coverageGraceSeconds) {
    warnings.push("Kline history starts after earliest wallet buy; early trades may be under-scored.");
  }

  if (latestCandle + coverageGraceSeconds < latestActivity) {
    warnings.push("Kline history ends before latest wallet activity; exit and missed-upside scoring may be incomplete.");
  }

  return {
    good: warnings.length === 0,
    warnings,
  };
}

function confidence(completedTradeCount: number, coverageGood: boolean) {
  if (completedTradeCount >= 10 && coverageGood) return "high";
  if (completedTradeCount >= 3) return "medium";
  return "low";
}

function explanations(wallet: string, pairs: TradePairV2[]) {
  const rows: string[] = [
    "Entry Discipline V2 uses kline-supported post-entry peak comparisons.",
  ];
  const coveredPairs = pairs.filter((pair) => pair.isKlineCovered);
  const earlyRate = rate(
    coveredPairs.filter((pair) => (pair.entryScore ?? 0) >= 70).length,
    coveredPairs.length
  );

  if (earlyRate !== null) {
    rows.push(`Wallet ${wallet} entered early on ${earlyRate}% of completed trades.`);
  }

  if (pairs.some((pair) => (pair.missedUpsideRatio ?? 0) >= 2)) {
    rows.push("Exit Discipline is limited because some exits occurred before later upside.");
  }

  if (pairs.some((pair) => pair.realizedMultiple !== null && pair.realizedMultiple < 1)) {
    rows.push("Some completed trades realized losses, so loss-control context affects Exit Discipline.");
  }

  if (pairs.some((pair) => !pair.isKlineCovered)) {
    rows.push("Some completed trades were skipped because kline coverage did not include their buy/sell window.");
  }

  return rows;
}

export function analyzeWalletEntryExitDisciplineV2({
  tokenAddress,
  wallet,
  activities,
  candles,
  totalSupply,
  coverageGraceSeconds = 0,
  holder,
}: AnalyzeWalletEntryExitInput): WalletEntryExitDisciplineV2 {
  const normalizedAddress = tokenAddress.toLowerCase();
  const tokenActivities = activities
    .map((activity) => normalizeActivity({ activity, wallet, candles }))
    .filter((activity) => activity.tokenAddress?.toLowerCase() === normalizedAddress)
    .filter((activity) => activity.eventType === "buy" || activity.eventType === "sell");
  const coverage = klineCoverage({ candles, activities: tokenActivities, coverageGraceSeconds });
  const { pairs, skippedTradeCount, warnings: pairWarnings } = buildTradePairs({
    wallet,
    tokenAddress,
    activities: tokenActivities,
    candles,
    totalSupply,
    coverageGraceSeconds,
  });
  const coveredPairs = pairs.filter((pair) => pair.isKlineCovered);
  const uncoveredTradeCount = pairs.length - coveredPairs.length;
  const tradeWeights = coveredPairs.map((pair) => ({
    entry: pair.entryScore,
    exit: pair.exitScore,
    weight:
      pair.buyCostUsd !== null && pair.buyCostUsd > 0
        ? Math.sqrt(pair.buyCostUsd)
        : 1,
  }));
  const entryScores = coveredPairs.map((pair) => pair.entryScore);
  const exitScores = coveredPairs.map((pair) => pair.exitScore);
  const warnings = [...coverage.warnings, ...pairWarnings];

  if (totalSupply === null) {
    warnings.push("Total supply missing; market cap fields are null and price-based scoring fallback is used.");
  }

  if (tokenActivities.length === 0) {
    warnings.push("No wallet buy/sell activity matched the analyzed token.");
  }

  if (pairs.length > 0 && coveredPairs.length === 0) {
    warnings.push("No completed trade pairs had sufficient kline coverage.");
  }

  return {
    wallet,
    tokenAddress,
    completedTradeCount: pairs.length,
    coveredTradeCount: coveredPairs.length,
    uncoveredTradeCount,
    coverageRate: rate(coveredPairs.length, pairs.length),
    skippedBecauseKlineCoverage: uncoveredTradeCount,
    skippedTradeCount: skippedTradeCount + uncoveredTradeCount,
    entryDisciplineV2:
      weightedAverage(tradeWeights.map((item) => ({ value: item.entry, weight: item.weight }))),
    exitDisciplineV2:
      weightedAverage(tradeWeights.map((item) => ({ value: item.exit, weight: item.weight }))),
    medianEntryScore: nullableMedian(entryScores),
    medianExitScore: nullableMedian(exitScores),
    earlyEntryRate: rate(coveredPairs.filter((pair) => (pair.entryScore ?? 0) >= 70).length, coveredPairs.length),
    lateEntryRate: rate(coveredPairs.filter((pair) => (pair.entryScore ?? 100) <= 35).length, coveredPairs.length),
    strongExitRate: rate(coveredPairs.filter((pair) => (pair.exitScore ?? 0) >= 70).length, coveredPairs.length),
    poorExitRate: rate(coveredPairs.filter((pair) => (pair.exitScore ?? 100) <= 35).length, coveredPairs.length),
    averageRealizedMultiple: nullableAverage(coveredPairs.map((pair) => pair.realizedMultiple)),
    medianRealizedMultiple: nullableMedian(coveredPairs.map((pair) => pair.realizedMultiple)),
    averageEntryToPeakRatio: nullableAverage(coveredPairs.map((pair) => pair.entryToPeakRatio)),
    averagePeakCaptureRatio: nullableAverage(coveredPairs.map((pair) => pair.peakCaptureRatio)),
    averageMissedUpsideRatio: nullableAverage(coveredPairs.map((pair) => pair.missedUpsideRatio)),
    averageHoldSeconds: nullableAverage(coveredPairs.map((pair) => pair.holdSeconds)),
    medianHoldSeconds: nullableMedian(coveredPairs.map((pair) => pair.holdSeconds)),
    dataConfidence: confidence(coveredPairs.length, coverage.good),
    warnings: Array.from(new Set(warnings)),
    explanations: explanations(wallet, pairs),
    tradePairsSample: pairs.slice(0, 20),
    weight: holderWeight(holder),
  };
}

export function aggregateEntryExitDisciplineV2(
  wallets: WalletEntryExitDisciplineV2[]
): EntryExitDisciplineAggregateV2 {
  const walletsWithTrades = wallets.filter((wallet) => wallet.coveredTradeCount > 0);
  const totalCompletedTrades = wallets.reduce(
    (total, wallet) => total + wallet.completedTradeCount,
    0
  );

  return {
    averageEntryDisciplineV2: nullableAverage(walletsWithTrades.map((wallet) => wallet.entryDisciplineV2)),
    averageExitDisciplineV2: nullableAverage(walletsWithTrades.map((wallet) => wallet.exitDisciplineV2)),
    weightedEntryDisciplineV2: weightedAverage(
      walletsWithTrades.map((wallet) => ({
        value: wallet.entryDisciplineV2,
        weight: wallet.weight,
      }))
    ),
    weightedExitDisciplineV2: weightedAverage(
      walletsWithTrades.map((wallet) => ({
        value: wallet.exitDisciplineV2,
        weight: wallet.weight,
      }))
    ),
    analyzedWalletCount: wallets.length,
    walletsWithCompletedTrades: walletsWithTrades.length,
    totalCompletedTrades,
    averageCompletedTradesPerWallet:
      wallets.length > 0 ? round(totalCompletedTrades / wallets.length) : null,
    highConfidenceWalletCount: wallets.filter((wallet) => wallet.dataConfidence === "high").length,
    mediumConfidenceWalletCount: wallets.filter((wallet) => wallet.dataConfidence === "medium").length,
    lowConfidenceWalletCount: wallets.filter((wallet) => wallet.dataConfidence === "low").length,
  };
}
