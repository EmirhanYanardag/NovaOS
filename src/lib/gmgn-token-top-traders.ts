import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type UnknownRecord = Record<string, unknown>;

export type TokenTopTrader = {
  chain: string;
  tokenAddress: string;
  wallet: string | null;
  rank: number | null;
  buyVolumeUsd: number | null;
  sellVolumeUsd: number | null;
  netFlowUsd: number | null;
  buyTxCount: number | null;
  sellTxCount: number | null;
  totalTxCount: number | null;
  realizedProfitUsd: number | null;
  unrealizedProfitUsd: number | null;
  totalProfitUsd: number | null;
  realizedPnlPct: number | null;
  unrealizedPnlPct: number | null;
  avgBuyCostUsd: number | null;
  avgSoldUsd: number | null;
  currentHoldingUsd: number | null;
  currentHoldingAmount: number | null;
  ownershipPercentage: number | null;
  isNewWallet: boolean | null;
  isSuspicious: boolean | null;
  walletTag: string | null;
  tags: string[];
  makerTokenTags: string[];
  lastActiveTimestampUnix: number | null;
  lastActiveTimestamp: string | null;
  createdAtTimestampUnix: number | null;
  createdAtTimestamp: string | null;
};

export type FetchGmgnTokenTopTradersOptions = {
  limit?: number;
  includeRaw?: boolean;
};

export type TokenTopTradersSummary = {
  traderCount: number;
  profitableTraderCount: number;
  losingTraderCount: number;
  suspiciousTraderCount: number;
  newWalletCount: number;
  totalBuyVolumeUsd: number;
  totalSellVolumeUsd: number;
  netFlowUsd: number;
  totalRealizedProfitUsd: number;
  totalUnrealizedProfitUsd: number;
  totalProfitUsd: number;
  avgRealizedPnlPct: number | null;
  avgUnrealizedPnlPct: number | null;
  buySellRatio: number | null;
  profitableTraderRate: number | null;
  suspiciousTraderRate: number | null;
  newWalletRate: number | null;
  topProfitableTraders: TokenTopTrader[];
  topLosingTraders: TokenTopTrader[];
  topNetBuyers: TokenTopTrader[];
  topNetSellers: TokenTopTrader[];
};

export type GmgnTokenTopTradersResult = {
  chain: string;
  address: string;
  count: number;
  summary: TokenTopTradersSummary;
  traders: TokenTopTrader[];
  warnings: string[];
  raw?: unknown;
};

const SUPPORTED_CHAINS = ["sol", "bsc", "base", "eth"] as const;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 100;
const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const SOL_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown) {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function asBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1") return true;
  if (value === 0 || value === "0") return false;
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (normalized === "true" || normalized === "yes") return true;
    if (normalized === "false" || normalized === "no") return false;
  }

  return null;
}

function round(value: number, decimals = 4) {
  return Number(value.toFixed(decimals));
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
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
    throw new Error("limit must be an integer from 1 to 100.");
  }

  return Math.min(limit, MAX_LIMIT);
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

function firstBoolean(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = asBoolean(record[key]);
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

function nestedArray(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value;
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

function ratioToPercentage(value: unknown) {
  const numeric = asNumber(value);
  if (numeric === null) return null;
  return round(numeric <= 1 ? numeric * 100 : numeric);
}

function extractTraderArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];

  const candidates = [
    payload.list,
    payload.data,
    payload.items,
    payload.result,
    payload.rows,
    payload.traders,
    payload.top_traders,
    payload.topTraders,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  for (const candidate of candidates) {
    if (isRecord(candidate)) {
      const nested = extractTraderArray(candidate);
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
        throw new Error("GMGN token traders returned non-JSON output.");
      }
    }

    throw new Error("GMGN token traders returned non-JSON output.");
  }
}

function stringArrayFrom(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => asString(item)).filter((item): item is string => Boolean(item));
  }

  const single = asString(value);
  if (!single) return [];

  return single
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function tagsFrom(record: UnknownRecord, makerInfo: UnknownRecord | null) {
  const directTags = nestedArray(record, ["tags", "wallet_tags", "walletTags"]);
  const makerTags = makerInfo ? nestedArray(makerInfo, ["tags", "wallet_tags", "walletTags"]) : null;
  const fallback = record.tag ?? record.wallet_tag ?? record.walletTag;

  return stringArrayFrom(directTags ?? makerTags ?? fallback);
}

function makerTokenTagsFrom(record: UnknownRecord, makerInfo: UnknownRecord | null) {
  const directTags = nestedArray(record, [
    "maker_token_tags",
    "makerTokenTags",
    "token_tags",
    "tokenTags",
  ]);
  const makerTags = makerInfo
    ? nestedArray(makerInfo, ["maker_token_tags", "makerTokenTags", "token_tags", "tokenTags"])
    : null;

  return stringArrayFrom(directTags ?? makerTags);
}

function normalizeTrader({
  chain,
  address,
  item,
  rankFallback,
}: {
  chain: string;
  address: string;
  item: unknown;
  rankFallback: number;
}): TokenTopTrader {
  const record = isRecord(item) ? item : {};
  const makerInfo = nestedRecord(record, ["maker_info", "makerInfo", "wallet_info", "walletInfo"]);
  const buyVolumeUsd = firstNumber(record, [
    "buy_volume_usd",
    "buyVolumeUsd",
    "buy_volume_cur",
    "buyVolumeCur",
    "buy_volume",
    "buyVolume",
  ]);
  const sellVolumeUsd = firstNumber(record, [
    "sell_volume_usd",
    "sellVolumeUsd",
    "sell_volume_cur",
    "sellVolumeCur",
    "sell_volume",
    "sellVolume",
  ]);
  const realizedProfitUsd = firstNumber(record, [
    "realized_profit_usd",
    "realizedProfitUsd",
    "realized_profit",
    "realizedProfit",
    "profit",
  ]);
  const unrealizedProfitUsd = firstNumber(record, [
    "unrealized_profit_usd",
    "unrealizedProfitUsd",
    "unrealized_profit",
    "unrealizedProfit",
  ]);
  const explicitTotalProfitUsd = firstNumber(record, [
    "total_profit_usd",
    "totalProfitUsd",
    "total_profit",
    "totalProfit",
    "pnl_usd",
    "pnlUsd",
  ]);
  const buyTxCount = firstNumber(record, [
    "buy_tx_count",
    "buyTxCount",
    "buy_count",
    "buyCount",
    "buy_times",
    "buyTimes",
  ]);
  const sellTxCount = firstNumber(record, [
    "sell_tx_count",
    "sellTxCount",
    "sell_count",
    "sellCount",
    "sell_times",
    "sellTimes",
  ]);
  const explicitTotalTxCount = firstNumber(record, [
    "total_tx_count",
    "totalTxCount",
    "tx_count",
    "txCount",
    "trade_count",
    "tradeCount",
    "swap_count",
    "swapCount",
  ]);
  const lastActive = timestampParts(
    record.last_active_timestamp ??
      record.lastActiveTimestamp ??
      record.last_active_time ??
      record.lastActiveTime ??
      record.last_trade_time ??
      record.lastTradeTime ??
      record.updated_at
  );
  const createdAt = timestampParts(
    record.created_at_timestamp ??
      record.createdAtTimestamp ??
      record.created_at ??
      record.createdAt ??
      record.first_trade_time ??
      record.firstTradeTime
  );
  const tags = tagsFrom(record, makerInfo);

  return {
    chain,
    tokenAddress: address,
    wallet:
      firstString(record, ["wallet", "address", "maker", "wallet_address", "walletAddress"]) ??
      (makerInfo
        ? firstString(makerInfo, ["address", "wallet", "wallet_address", "walletAddress"])
        : null),
    rank: firstNumber(record, ["rank", "index", "no"]) ?? rankFallback,
    buyVolumeUsd,
    sellVolumeUsd,
    netFlowUsd:
      buyVolumeUsd !== null || sellVolumeUsd !== null
        ? round((buyVolumeUsd ?? 0) - (sellVolumeUsd ?? 0))
        : null,
    buyTxCount,
    sellTxCount,
    totalTxCount:
      explicitTotalTxCount ??
      (buyTxCount !== null || sellTxCount !== null ? (buyTxCount ?? 0) + (sellTxCount ?? 0) : null),
    realizedProfitUsd,
    unrealizedProfitUsd,
    totalProfitUsd:
      explicitTotalProfitUsd ??
      (realizedProfitUsd !== null || unrealizedProfitUsd !== null
        ? round((realizedProfitUsd ?? 0) + (unrealizedProfitUsd ?? 0))
        : null),
    realizedPnlPct: ratioToPercentage(
      record.realized_pnl_pct ??
        record.realizedPnlPct ??
        record.realized_pnl_percentage ??
        record.realizedPnlPercentage ??
        record.profit_rate ??
        record.profitRate
    ),
    unrealizedPnlPct: ratioToPercentage(
      record.unrealized_pnl_pct ??
        record.unrealizedPnlPct ??
        record.unrealized_pnl_percentage ??
        record.unrealizedPnlPercentage
    ),
    avgBuyCostUsd: firstNumber(record, [
      "avg_buy_cost_usd",
      "avgBuyCostUsd",
      "avg_buy_cost",
      "avgBuyCost",
      "average_buy_cost",
      "averageBuyCost",
    ]),
    avgSoldUsd: firstNumber(record, [
      "avg_sold_usd",
      "avgSoldUsd",
      "avg_sell_usd",
      "avgSellUsd",
      "average_sold",
      "averageSold",
    ]),
    currentHoldingUsd: firstNumber(record, [
      "current_holding_usd",
      "currentHoldingUsd",
      "holding_value_usd",
      "holdingValueUsd",
      "holding_value",
      "holdingValue",
      "usd_value",
      "usdValue",
    ]),
    currentHoldingAmount: firstNumber(record, [
      "current_holding_amount",
      "currentHoldingAmount",
      "holding_amount",
      "holdingAmount",
      "amount",
      "balance",
    ]),
    ownershipPercentage: ratioToPercentage(
      record.ownership_percentage ??
        record.ownershipPercentage ??
        record.amount_percentage ??
        record.amountPercentage ??
        record.holding_percentage ??
        record.holdingPercentage ??
        record.hold_rate ??
        record.holdRate
    ),
    isNewWallet: firstBoolean(record, [
      "is_new_wallet",
      "isNewWallet",
      "new_wallet",
      "newWallet",
      "fresh_wallet",
      "freshWallet",
    ]),
    isSuspicious:
      firstBoolean(record, [
        "is_suspicious",
        "isSuspicious",
        "suspicious",
        "is_risk",
        "isRisk",
      ]) ?? (tags.some((tag) => ["rat_trader", "bundler", "sniper", "dex_bot"].includes(tag)) ? true : null),
    walletTag:
      firstString(record, ["wallet_tag", "walletTag", "tag"]) ??
      (makerInfo ? firstString(makerInfo, ["wallet_tag", "walletTag", "tag"]) : null),
    tags,
    makerTokenTags: makerTokenTagsFrom(record, makerInfo),
    lastActiveTimestampUnix: lastActive.timestampUnix,
    lastActiveTimestamp: lastActive.timestamp,
    createdAtTimestampUnix: createdAt.timestampUnix,
    createdAtTimestamp: createdAt.timestamp,
  };
}

function dedupeByWallet(traders: TokenTopTrader[]) {
  const seen = new Set<string>();
  const deduped: TokenTopTrader[] = [];

  for (const trader of traders) {
    if (!trader.wallet) {
      deduped.push(trader);
      continue;
    }

    const key = trader.wallet.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(trader);
  }

  return deduped;
}

function sortTraders(traders: TokenTopTrader[]) {
  if (traders.some((trader) => trader.totalProfitUsd !== null)) {
    return [...traders].sort((a, b) => (b.totalProfitUsd ?? Number.NEGATIVE_INFINITY) - (a.totalProfitUsd ?? Number.NEGATIVE_INFINITY));
  }

  return traders;
}

function compactTopTraders(traders: TokenTopTrader[]) {
  return traders.slice(0, 10);
}

function numericValues<T>(items: T[], selector: (item: T) => number | null) {
  return items.map(selector).filter((value): value is number => value !== null);
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return round(sum(values) / values.length);
}

function rate(count: number, total: number) {
  return total > 0 ? round((count / total) * 100, 2) : null;
}

export function summarizeTokenTopTraders(traders: TokenTopTrader[]): TokenTopTradersSummary {
  const traderCount = traders.length;
  const profitableTraderCount = traders.filter((trader) => (trader.totalProfitUsd ?? 0) > 0).length;
  const losingTraderCount = traders.filter((trader) => (trader.totalProfitUsd ?? 0) < 0).length;
  const suspiciousTraderCount = traders.filter((trader) => trader.isSuspicious).length;
  const newWalletCount = traders.filter((trader) => trader.isNewWallet).length;
  const totalBuyVolumeUsd = round(sum(numericValues(traders, (trader) => trader.buyVolumeUsd)));
  const totalSellVolumeUsd = round(sum(numericValues(traders, (trader) => trader.sellVolumeUsd)));
  const totalRealizedProfitUsd = round(sum(numericValues(traders, (trader) => trader.realizedProfitUsd)));
  const totalUnrealizedProfitUsd = round(sum(numericValues(traders, (trader) => trader.unrealizedProfitUsd)));
  const totalProfitUsd = round(sum(numericValues(traders, (trader) => trader.totalProfitUsd)));

  return {
    traderCount,
    profitableTraderCount,
    losingTraderCount,
    suspiciousTraderCount,
    newWalletCount,
    totalBuyVolumeUsd,
    totalSellVolumeUsd,
    netFlowUsd: round(totalBuyVolumeUsd - totalSellVolumeUsd),
    totalRealizedProfitUsd,
    totalUnrealizedProfitUsd,
    totalProfitUsd,
    avgRealizedPnlPct: average(numericValues(traders, (trader) => trader.realizedPnlPct)),
    avgUnrealizedPnlPct: average(numericValues(traders, (trader) => trader.unrealizedPnlPct)),
    buySellRatio: totalSellVolumeUsd > 0 ? round(totalBuyVolumeUsd / totalSellVolumeUsd) : null,
    profitableTraderRate: rate(profitableTraderCount, traderCount),
    suspiciousTraderRate: rate(suspiciousTraderCount, traderCount),
    newWalletRate: rate(newWalletCount, traderCount),
    topProfitableTraders: compactTopTraders(
      [...traders]
        .filter((trader) => trader.totalProfitUsd !== null)
        .sort((a, b) => (b.totalProfitUsd ?? 0) - (a.totalProfitUsd ?? 0))
    ),
    topLosingTraders: compactTopTraders(
      [...traders]
        .filter((trader) => trader.totalProfitUsd !== null)
        .sort((a, b) => (a.totalProfitUsd ?? 0) - (b.totalProfitUsd ?? 0))
    ),
    topNetBuyers: compactTopTraders(
      [...traders]
        .filter((trader) => trader.netFlowUsd !== null)
        .sort((a, b) => (b.netFlowUsd ?? 0) - (a.netFlowUsd ?? 0))
    ),
    topNetSellers: compactTopTraders(
      [...traders]
        .filter((trader) => trader.netFlowUsd !== null)
        .sort((a, b) => (a.netFlowUsd ?? 0) - (b.netFlowUsd ?? 0))
    ),
  };
}

export function normalizeGmgnTokenTopTradersResponse(
  raw: unknown,
  {
    chain,
    address,
    limit = DEFAULT_LIMIT,
  }: {
    chain: string;
    address: string;
    limit?: number;
  }
) {
  const rows = extractTraderArray(raw);
  const normalized = rows.map((item, index) =>
    normalizeTrader({
      chain,
      address,
      item,
      rankFallback: index + 1,
    })
  );

  return sortTraders(dedupeByWallet(normalized)).slice(0, limit);
}

async function runGmgnTokenTopTraders({
  chain,
  address,
  limit,
}: {
  chain: string;
  address: string;
  limit: number;
}) {
  const args = [
    "token",
    "traders",
    "--chain",
    chain,
    "--address",
    address,
    "--limit",
    String(limit),
    "--raw",
  ];
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

export async function fetchGmgnTokenTopTraders(
  chain: string,
  address: string,
  options: FetchGmgnTokenTopTradersOptions = {}
): Promise<GmgnTokenTopTradersResult> {
  const normalizedChain = chain.toLowerCase();
  const normalizedAddress = address.trim();
  const limit = normalizeLimit(options.limit);
  const warnings: string[] = [];

  validateChain(normalizedChain);
  validateAddress(normalizedChain, normalizedAddress);

  const raw = await runGmgnTokenTopTraders({
    chain: normalizedChain,
    address: normalizedAddress,
    limit,
  });
  const rawRows = extractTraderArray(raw);
  const traders = normalizeGmgnTokenTopTradersResponse(raw, {
    chain: normalizedChain,
    address: normalizedAddress,
    limit,
  });

  if (rawRows.length === 0) {
    warnings.push("GMGN token traders returned no trader rows.");
  }

  if (rawRows.length > traders.length) {
    warnings.push(`${rawRows.length - traders.length} duplicate or over-limit trader row(s) were removed.`);
  }

  return {
    chain: normalizedChain,
    address: normalizedAddress,
    count: traders.length,
    summary: summarizeTokenTopTraders(traders),
    traders,
    warnings,
    ...(options.includeRaw ? { raw } : {}),
  };
}
