import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fetchGmgnRiskStats } from "@/lib/gmgn-risk-stats";

const execFileAsync = promisify(execFile);

type UnknownRecord = Record<string, unknown>;

export type TokenKlineInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

export type TokenKlineCandle = {
  chain: string;
  tokenAddress: string;
  timestampUnix: number | null;
  timestamp: string | null;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volumeUsd: number | null;
  marketCapOpen: number | null;
  marketCapHigh: number | null;
  marketCapLow: number | null;
  marketCapClose: number | null;
  totalSupply: number | null;
};

export type FetchGmgnTokenKlineOptions = {
  interval: TokenKlineInterval;
  limit?: number;
  from?: number;
  to?: number;
  includeRaw?: boolean;
};

export type GmgnTokenKlineResult = {
  chain: string;
  address: string;
  interval: TokenKlineInterval;
  limit: number;
  count: number;
  earliestTimestamp: string | null;
  latestTimestamp: string | null;
  totalSupply: number | null;
  priceLow: number | null;
  priceHigh: number | null;
  marketCapLow: number | null;
  marketCapHigh: number | null;
  sourceCommand: string | null;
  candles: TokenKlineCandle[];
  warnings: string[];
  raw?: unknown;
};

const SUPPORTED_CHAINS = ["sol", "bsc", "base", "eth"] as const;
const INTERVALS: TokenKlineInterval[] = ["1m", "5m", "15m", "1h", "4h", "1d"];
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 1000;
const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const SOL_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

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
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function round(value: number, decimals = 8) {
  return Number(value.toFixed(decimals));
}

function validateChain(chain: string) {
  if (!SUPPORTED_CHAINS.includes(chain as (typeof SUPPORTED_CHAINS)[number])) {
    throw new Error("Unsupported chain. Use sol, bsc, base, or eth.");
  }
}

function validateAddress(chain: string, address: string) {
  const valid = chain === "sol" ? SOL_ADDRESS_PATTERN.test(address) : EVM_ADDRESS_PATTERN.test(address);
  if (!valid) {
    throw new Error("address must be a valid token address for the requested chain.");
  }
}

function normalizeLimit(limit: number | undefined) {
  if (limit === undefined) return DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("limit must be an integer from 1 to 1000.");
  }

  return Math.min(limit, MAX_LIMIT);
}

function normalizeOptionalUnixSeconds(value: number | undefined, fieldName: string) {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${fieldName} must be a positive Unix timestamp in seconds.`);
  }

  return value;
}

function normalizeInterval(interval: string) {
  if (!INTERVALS.includes(interval as TokenKlineInterval)) {
    throw new Error("interval must be one of 1m, 5m, 15m, 1h, 4h, or 1d.");
  }

  return interval as TokenKlineInterval;
}

function firstNumber(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = asNumber(record[key]);
    if (value !== null) return value;
  }

  return null;
}

function nestedRecord(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (isRecord(value)) return value;
  }

  return null;
}

function firstNestedNumber(record: UnknownRecord, paths: [string, string][]) {
  for (const [parentKey, childKey] of paths) {
    const parent = record[parentKey];
    if (!isRecord(parent)) continue;

    const value = asNumber(parent[childKey]);
    if (value !== null) return value;
  }

  return null;
}

function timestampParts(value: unknown) {
  const numeric = asNumber(value);
  if (numeric !== null) {
    const ms = numeric > 9_999_999_999 ? numeric : numeric * 1000;
    const parsed = new Date(ms);
    if (!Number.isNaN(parsed.getTime())) {
      return {
        timestampUnix: Math.trunc(ms / 1000),
        timestamp: parsed.toISOString(),
      };
    }
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
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

function unixSecondsForComparison(value: number | null) {
  if (value === null) return null;
  return value > 9_999_999_999 ? Math.trunc(value / 1000) : value;
}

function extractCandleArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];

  const candidates = [
    payload.data,
    payload.list,
    payload.items,
    payload.result,
    payload.candles,
    payload.klines,
    payload.kline,
    payload.rows,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  for (const candidate of candidates) {
    if (isRecord(candidate)) {
      const nested = extractCandleArray(candidate);
      if (nested.length > 0) return nested;
    }
  }

  return [];
}

function parseJsonOutput(stdout: string) {
  try {
    return JSON.parse(stdout) as unknown;
  } catch {
    const firstBrace = stdout.indexOf("{");
    const firstBracket = stdout.indexOf("[");
    const startCandidates = [firstBrace, firstBracket].filter((index) => index >= 0);
    const start = startCandidates.length ? Math.min(...startCandidates) : -1;

    if (start >= 0) {
      try {
        return JSON.parse(stdout.slice(start)) as unknown;
      } catch {
        throw new Error("GMGN token kline command returned non-JSON output.");
      }
    }

    throw new Error("GMGN token kline command returned non-JSON output.");
  }
}

export function computeMarketCapFromPrice(price: number | null, totalSupply: number | null) {
  if (price === null || totalSupply === null) return null;
  return round(price * totalSupply, 4);
}

function totalSupplyFromPayload(payload: unknown) {
  if (Array.isArray(payload)) return null;
  if (!isRecord(payload)) return null;

  return (
    firstNumber(payload, ["total_supply", "totalSupply", "token_total_supply", "tokenTotalSupply"]) ??
    firstNestedNumber(payload, [
      ["data", "total_supply"],
      ["data", "totalSupply"],
      ["token", "total_supply"],
      ["token", "totalSupply"],
      ["token_info", "total_supply"],
      ["tokenInfo", "totalSupply"],
    ])
  );
}

function normalizeArrayCandle({
  chain,
  address,
  item,
  fallbackTotalSupply,
}: {
  chain: string;
  address: string;
  item: unknown[];
  fallbackTotalSupply: number | null;
}): TokenKlineCandle {
  const timestamp = timestampParts(item[0]);
  const open = asNumber(item[1]);
  const high = asNumber(item[2]);
  const low = asNumber(item[3]);
  const close = asNumber(item[4]);
  const volumeUsd = asNumber(item[5]);

  return {
    chain,
    tokenAddress: address,
    timestampUnix: timestamp.timestampUnix,
    timestamp: timestamp.timestamp,
    open,
    high,
    low,
    close,
    volumeUsd,
    marketCapOpen: computeMarketCapFromPrice(open, fallbackTotalSupply),
    marketCapHigh: computeMarketCapFromPrice(high, fallbackTotalSupply),
    marketCapLow: computeMarketCapFromPrice(low, fallbackTotalSupply),
    marketCapClose: computeMarketCapFromPrice(close, fallbackTotalSupply),
    totalSupply: fallbackTotalSupply,
  };
}

function normalizeRecordCandle({
  chain,
  address,
  item,
  fallbackTotalSupply,
}: {
  chain: string;
  address: string;
  item: UnknownRecord;
  fallbackTotalSupply: number | null;
}): TokenKlineCandle {
  const token = nestedRecord(item, ["token", "token_info", "tokenInfo"]) ?? {};
  const timestamp = timestampParts(
    item.timestamp ??
      item.timestamp_unix ??
      item.timestampUnix ??
      item.time ??
      item.t ??
      item.open_time ??
      item.openTime ??
      item.start_time ??
      item.startTime
  );
  const totalSupply =
    firstNumber(item, ["total_supply", "totalSupply", "token_total_supply", "tokenTotalSupply"]) ??
    firstNumber(token, ["total_supply", "totalSupply", "token_total_supply"]) ??
    fallbackTotalSupply;
  const open = firstNumber(item, ["open", "o", "open_price", "openPrice"]);
  const high = firstNumber(item, ["high", "h", "high_price", "highPrice"]);
  const low = firstNumber(item, ["low", "l", "low_price", "lowPrice"]);
  const close = firstNumber(item, ["close", "c", "close_price", "closePrice", "price"]);

  return {
    chain,
    tokenAddress:
      asString(item.tokenAddress) ??
      asString(item.token_address) ??
      asString(item.address) ??
      address,
    timestampUnix: timestamp.timestampUnix,
    timestamp: timestamp.timestamp,
    open,
    high,
    low,
    close,
    volumeUsd: firstNumber(item, [
      "volume_usd",
      "volumeUsd",
      "usd_volume",
      "usdVolume",
      "volume",
    ]),
    marketCapOpen:
      firstNumber(item, ["market_cap_open", "marketCapOpen", "open_market_cap"]) ??
      computeMarketCapFromPrice(open, totalSupply),
    marketCapHigh:
      firstNumber(item, ["market_cap_high", "marketCapHigh", "high_market_cap"]) ??
      computeMarketCapFromPrice(high, totalSupply),
    marketCapLow:
      firstNumber(item, ["market_cap_low", "marketCapLow", "low_market_cap"]) ??
      computeMarketCapFromPrice(low, totalSupply),
    marketCapClose:
      firstNumber(item, [
        "market_cap_close",
        "marketCapClose",
        "close_market_cap",
        "market_cap",
        "marketCap",
      ]) ?? computeMarketCapFromPrice(close, totalSupply),
    totalSupply,
  };
}

function normalizeCandle({
  chain,
  address,
  item,
  fallbackTotalSupply,
}: {
  chain: string;
  address: string;
  item: unknown;
  fallbackTotalSupply: number | null;
}) {
  return Array.isArray(item)
    ? normalizeArrayCandle({ chain, address, item, fallbackTotalSupply })
    : normalizeRecordCandle({
        chain,
        address,
        item: isRecord(item) ? item : {},
        fallbackTotalSupply,
      });
}

function sortedCandles(candles: TokenKlineCandle[]) {
  return [...candles].sort(
    (a, b) =>
      (unixSecondsForComparison(a.timestampUnix) ?? 0) -
      (unixSecondsForComparison(b.timestampUnix) ?? 0)
  );
}

function minNumber(values: Array<number | null>) {
  const numeric = values.filter((value): value is number => value !== null);
  return numeric.length > 0 ? Math.min(...numeric) : null;
}

function maxNumber(values: Array<number | null>) {
  const numeric = values.filter((value): value is number => value !== null);
  return numeric.length > 0 ? Math.max(...numeric) : null;
}

async function runGmgnTokenKline({
  chain,
  address,
  interval,
  from,
  to,
}: {
  chain: string;
  address: string;
  interval: TokenKlineInterval;
  from?: number;
  to?: number;
}) {
  const args = [
    "market",
    "kline",
    "--chain",
    chain,
    "--address",
    address,
    "--resolution",
    interval,
    "--raw",
  ];

  if (from !== undefined) {
    args.push("--from", String(from));
  }

  if (to !== undefined) {
    args.push("--to", String(to));
  }

  const execOptions = {
    env: {
      ...process.env,
      GMGN_API_KEY: process.env.GMGN_API_KEY,
    },
    maxBuffer: 1024 * 1024 * 10,
    timeout: 45_000,
    windowsHide: true,
  };
  const { stdout } =
    process.platform === "win32"
      ? await execFileAsync("cmd.exe", ["/d", "/c", ["gmgn-cli", ...args].join(" ")], execOptions)
      : await execFileAsync("gmgn-cli", args, execOptions);

  return parseJsonOutput(stdout);
}

async function fetchTokenInfoTotalSupply({
  chain,
  address,
  warnings,
}: {
  chain: string;
  address: string;
  warnings: string[];
}) {
  try {
    const stats = await fetchGmgnRiskStats({ chain, address });
    if (stats.totalSupply !== null) return stats.totalSupply;
    warnings.push("GMGN token info did not provide totalSupply for market-cap derivation.");
  } catch (error) {
    warnings.push(
      `Could not fetch GMGN token info totalSupply fallback: ${
        error instanceof Error ? error.message : "unknown error"
      }`
    );
  }

  return null;
}

export function getNearestCandleAtOrBefore(
  candles: TokenKlineCandle[],
  timestampUnix: number
) {
  const sorted = sortedCandles(candles);
  let nearest: TokenKlineCandle | null = null;

  for (const candle of sorted) {
    const candleTimestampUnix = unixSecondsForComparison(candle.timestampUnix);
    if (candleTimestampUnix === null) continue;
    if (candleTimestampUnix > timestampUnix) break;
    nearest = candle;
  }

  return nearest;
}

export function getKlinePeakAfterTimestamp(
  candles: TokenKlineCandle[],
  timestampUnix: number
) {
  const futureCandles = candles.filter(
    (candle) => {
      const candleTimestampUnix = unixSecondsForComparison(candle.timestampUnix);
      return candleTimestampUnix !== null && candleTimestampUnix >= timestampUnix;
    }
  );

  if (futureCandles.length === 0) return null;

  return futureCandles.reduce<TokenKlineCandle | null>((peak, candle) => {
    if (!peak) return candle;

    const peakValue = peak.marketCapHigh ?? peak.high ?? Number.NEGATIVE_INFINITY;
    const candleValue = candle.marketCapHigh ?? candle.high ?? Number.NEGATIVE_INFINITY;
    return candleValue > peakValue ? candle : peak;
  }, null);
}

export async function fetchGmgnTokenKline(
  chain: string,
  address: string,
  options: FetchGmgnTokenKlineOptions
): Promise<GmgnTokenKlineResult> {
  const normalizedChain = chain.toLowerCase();
  const normalizedAddress = address.trim();
  const interval = normalizeInterval(options.interval);
  const limit = normalizeLimit(options.limit);
  const from = normalizeOptionalUnixSeconds(options.from, "from");
  const to = normalizeOptionalUnixSeconds(options.to, "to");
  const warnings: string[] = [];

  validateChain(normalizedChain);
  validateAddress(normalizedChain, normalizedAddress);

  const raw = await runGmgnTokenKline({
    chain: normalizedChain,
    address: normalizedAddress,
    interval,
    from,
    to,
  });

  const rawTotalSupply = totalSupplyFromPayload(raw);
  const totalSupply =
    rawTotalSupply ?? (await fetchTokenInfoTotalSupply({ chain: normalizedChain, address: normalizedAddress, warnings }));
  const rawCandles = extractCandleArray(raw);
  const candles = sortedCandles(
    rawCandles.map((item) =>
      normalizeCandle({
        chain: normalizedChain,
        address: normalizedAddress,
        item,
        fallbackTotalSupply: totalSupply,
      })
    )
  ).slice(-limit);

  if (rawCandles.length === 0) {
    warnings.push("GMGN token kline response returned no candle rows.");
  }

  if (totalSupply === null) {
    warnings.push("Total supply unavailable; market-cap fields remain null unless GMGN returned market-cap candles directly.");
  }

  const prices = candles.flatMap((candle) => [candle.open, candle.high, candle.low, candle.close]);
  const marketCaps = candles.flatMap((candle) => [
    candle.marketCapOpen,
    candle.marketCapHigh,
    candle.marketCapLow,
    candle.marketCapClose,
  ]);

  return {
    chain: normalizedChain,
    address: normalizedAddress,
    interval,
    limit,
    count: candles.length,
    earliestTimestamp: candles[0]?.timestamp ?? null,
    latestTimestamp: candles[candles.length - 1]?.timestamp ?? null,
    totalSupply,
    priceLow: minNumber(prices),
    priceHigh: maxNumber(prices),
    marketCapLow: minNumber(marketCaps),
    marketCapHigh: maxNumber(marketCaps),
    sourceCommand: "gmgn-cli market kline",
    candles,
    warnings,
    ...(options.includeRaw ? { raw } : {}),
  };
}
