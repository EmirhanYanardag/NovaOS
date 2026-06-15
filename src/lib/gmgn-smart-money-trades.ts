import { fetchGmgnOpenApiJson } from "@/lib/gmgn-openapi";

type UnknownRecord = Record<string, unknown>;

export type SmartMoneyTradeSide = "buy" | "sell" | "unknown";

export type SmartMoneyTrade = {
  chain: string;
  txHash: string | null;
  wallet: string | null;
  tokenAddress: string | null;
  tokenSymbol: string | null;
  tokenLogo: string | null;
  tokenTotalSupply: string | null;
  launchpad: string | null;
  side: SmartMoneyTradeSide;
  timestamp: string | null;
  timestampUnix: number | null;
  tokenAmount: number | null;
  quoteAmount: number | null;
  amountUsd: number | null;
  priceUsd: number | null;
  priceNative: number | null;
  buyCostUsd: number | null;
  isOpenOrClose: number | null;
  walletTags: string[];
  walletName: string | null;
  twitterUsername: string | null;
};

export type FetchGmgnSmartMoneyTradesOptions = {
  limit?: number;
  side?: "buy" | "sell";
  includeRaw?: boolean;
};

export type SmartMoneyTradeSummary = {
  buyCount: number;
  sellCount: number;
  totalBuyUsd: number;
  totalSellUsd: number;
  netFlowUsd: number;
  uniqueWallets: number;
  uniqueTokens: number;
  topTokensBySmartMoneyVolume: Array<{
    tokenAddress: string | null;
    tokenSymbol: string | null;
    volumeUsd: number;
    tradeCount: number;
  }>;
  topWalletTags: Array<{
    tag: string;
    count: number;
  }>;
};

export type GmgnSmartMoneyTradesResult = {
  chain: string;
  side: "buy" | "sell" | null;
  limit: number;
  count: number;
  trades: SmartMoneyTrade[];
  summary: SmartMoneyTradeSummary;
  warnings: string[];
  raw?: unknown;
};

const SUPPORTED_SMART_MONEY_CHAINS = ["sol", "bsc", "base", "eth"] as const;
const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 100;
const IS_VERCEL_RUNTIME = Boolean(process.env.VERCEL);

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

function asInteger(value: unknown) {
  const numeric = asNumber(value);
  return numeric === null ? null : Math.trunc(numeric);
}

function round(value: number, decimals = 4) {
  return Number(value.toFixed(decimals));
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function validateChain(chain: string) {
  if (!SUPPORTED_SMART_MONEY_CHAINS.includes(chain as (typeof SUPPORTED_SMART_MONEY_CHAINS)[number])) {
    throw new Error("Unsupported chain. Use sol, bsc, base, or eth.");
  }
}

function normalizeLimit(limit: number | undefined) {
  if (limit === undefined) return DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("limit must be an integer from 1 to 200.");
  }

  return Math.min(limit, MAX_LIMIT);
}

function validateSide(side: string | undefined) {
  if (side === undefined) return undefined;
  if (side !== "buy" && side !== "sell") {
    throw new Error("side must be buy or sell.");
  }

  return side;
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

function firstInteger(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = asInteger(record[key]);
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
        timestamp: parsed.toISOString(),
        timestampUnix: Math.trunc(ms / 1000),
      };
    }
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return {
        timestamp: new Date(parsed).toISOString(),
        timestampUnix: Math.trunc(parsed / 1000),
      };
    }
  }

  return {
    timestamp: null,
    timestampUnix: null,
  };
}

function extractTradeArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];

  const candidates = [
    payload.list,
    payload.data,
    payload.items,
    payload.trades,
    payload.result,
    payload.rows,
    payload.activities,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  for (const candidate of candidates) {
    if (isRecord(candidate)) {
      const nested = extractTradeArray(candidate);
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
        throw new Error("GMGN smart money trades returned non-JSON output.");
      }
    }

    throw new Error("GMGN smart money trades returned non-JSON output.");
  }
}

function classifySide(record: UnknownRecord): SmartMoneyTradeSide {
  const value = (
    firstString(record, ["side", "event_type", "eventType", "type", "action"]) || ""
  ).toLowerCase();

  if (value === "buy" || value.includes("buy")) return "buy";
  if (value === "sell" || value.includes("sell")) return "sell";

  const isBuy = record.is_buy ?? record.isBuy;
  if (isBuy === true || isBuy === 1 || isBuy === "1" || isBuy === "true") return "buy";
  if (isBuy === false || isBuy === 0 || isBuy === "0" || isBuy === "false") return "sell";

  return "unknown";
}

function extractTags(record: UnknownRecord, makerInfo: UnknownRecord | null) {
  const directTags = nestedArray(record, ["tags", "wallet_tags", "walletTags"]);
  const makerTags = makerInfo ? nestedArray(makerInfo, ["tags", "wallet_tags", "walletTags"]) : null;
  const rawTags = directTags ?? makerTags ?? [];

  return rawTags
    .map((tag) => asString(tag))
    .filter((tag): tag is string => Boolean(tag));
}

function normalizeTrade(chain: string, item: unknown): SmartMoneyTrade {
  const record = isRecord(item) ? item : {};
  const makerInfo = nestedRecord(record, ["maker_info", "makerInfo", "wallet_info", "walletInfo"]);
  const token =
    nestedRecord(record, ["token", "base_token", "baseToken", "token_info", "tokenInfo"]) ?? {};
  const timestamp = timestampParts(
    record.timestamp ??
      record.timestamp_unix ??
      record.timestampUnix ??
      record.time ??
      record.block_time ??
      record.blockTime ??
      record.created_at
  );

  return {
    chain,
    txHash: firstString(record, [
      "tx_hash",
      "txHash",
      "hash",
      "transaction_hash",
      "transactionHash",
      "tx",
    ]),
    wallet:
      firstString(record, ["wallet", "wallet_address", "walletAddress", "maker", "address"]) ??
      (makerInfo
        ? firstString(makerInfo, ["address", "wallet", "wallet_address", "walletAddress"])
        : null),
    tokenAddress:
      firstString(record, [
        "base_address",
        "baseAddress",
        "token_address",
        "tokenAddress",
        "address",
        "contract_address",
      ]) ??
      firstString(token, ["address", "token_address", "tokenAddress", "contract_address"]),
    tokenSymbol:
      firstString(record, ["token_symbol", "tokenSymbol", "symbol"]) ??
      firstString(token, ["symbol", "token_symbol", "tokenSymbol"]),
    tokenLogo:
      firstString(record, ["token_logo", "tokenLogo", "logo", "logo_url"]) ??
      firstString(token, ["logo", "logo_url", "token_logo", "tokenLogo"]),
    tokenTotalSupply:
      firstString(record, ["token_total_supply", "tokenTotalSupply", "total_supply", "totalSupply"]) ??
      firstString(token, ["total_supply", "totalSupply", "token_total_supply"]),
    launchpad:
      firstString(record, ["launchpad", "launchpad_name", "launchpadName"]) ??
      firstString(token, ["launchpad", "launchpad_name", "launchpadName"]),
    side: classifySide(record),
    timestamp: timestamp.timestamp,
    timestampUnix: timestamp.timestampUnix,
    tokenAmount:
      firstNumber(record, ["token_amount", "tokenAmount", "amount", "base_amount", "baseAmount"]) ??
      firstNestedNumber(record, [["token", "amount"], ["base_token", "amount"]]),
    quoteAmount: firstNumber(record, [
      "quote_amount",
      "quoteAmount",
      "quote_token_amount",
      "quoteTokenAmount",
    ]),
    amountUsd: firstNumber(record, [
      "amount_usd",
      "amountUsd",
      "cost_usd",
      "costUsd",
      "value_usd",
      "valueUsd",
      "volume_usd",
      "volumeUsd",
      "usd",
    ]),
    priceUsd: firstNumber(record, ["price_usd", "priceUsd", "usd_price", "usdPrice"]) ??
      firstNestedNumber(record, [["token", "price_usd"], ["base_token", "price_usd"]]),
    priceNative: firstNumber(record, [
      "price_native",
      "priceNative",
      "native_price",
      "nativePrice",
    ]),
    buyCostUsd: firstNumber(record, ["buy_cost_usd", "buyCostUsd", "buy_cost", "buyCost"]),
    isOpenOrClose: firstInteger(record, [
      "is_open_or_close",
      "isOpenOrClose",
      "open_or_close",
      "openOrClose",
    ]),
    walletTags: extractTags(record, makerInfo),
    walletName:
      (makerInfo ? firstString(makerInfo, ["name", "wallet_name", "walletName"]) : null) ??
      firstString(record, ["wallet_name", "walletName", "name"]),
    twitterUsername:
      (makerInfo
        ? firstString(makerInfo, ["twitter_username", "twitterUsername", "twitter", "x"])
        : null) ??
      firstString(record, ["twitter_username", "twitterUsername", "twitter", "x"]),
  };
}

function dedupeTrades(trades: SmartMoneyTrade[]) {
  const seenHashes = new Set<string>();
  const deduped: SmartMoneyTrade[] = [];

  for (const trade of trades) {
    if (trade.txHash) {
      const key = trade.txHash.toLowerCase();
      if (seenHashes.has(key)) continue;
      seenHashes.add(key);
    }

    deduped.push(trade);
  }

  return deduped;
}

function buildSummary(trades: SmartMoneyTrade[]): SmartMoneyTradeSummary {
  const buyTrades = trades.filter((trade) => trade.side === "buy");
  const sellTrades = trades.filter((trade) => trade.side === "sell");
  const totalBuyUsd = round(
    sum(buyTrades.map((trade) => trade.amountUsd).filter((value): value is number => value !== null))
  );
  const totalSellUsd = round(
    sum(sellTrades.map((trade) => trade.amountUsd).filter((value): value is number => value !== null))
  );
  const wallets = new Set(
    trades.map((trade) => trade.wallet).filter((wallet): wallet is string => Boolean(wallet))
  );
  const tokens = new Set(
    trades
      .map((trade) => trade.tokenAddress || trade.tokenSymbol)
      .filter((token): token is string => Boolean(token))
  );
  const tokenVolume = new Map<
    string,
    { tokenAddress: string | null; tokenSymbol: string | null; volumeUsd: number; tradeCount: number }
  >();
  const tagCounts = new Map<string, number>();

  for (const trade of trades) {
    const tokenKey = trade.tokenAddress || trade.tokenSymbol || "unknown";
    const current =
      tokenVolume.get(tokenKey) ?? {
        tokenAddress: trade.tokenAddress,
        tokenSymbol: trade.tokenSymbol,
        volumeUsd: 0,
        tradeCount: 0,
      };
    current.volumeUsd += trade.amountUsd ?? 0;
    current.tradeCount += 1;
    tokenVolume.set(tokenKey, current);

    for (const tag of trade.walletTags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  return {
    buyCount: buyTrades.length,
    sellCount: sellTrades.length,
    totalBuyUsd,
    totalSellUsd,
    netFlowUsd: round(totalBuyUsd - totalSellUsd),
    uniqueWallets: wallets.size,
    uniqueTokens: tokens.size,
    topTokensBySmartMoneyVolume: [...tokenVolume.values()]
      .map((token) => ({
        ...token,
        volumeUsd: round(token.volumeUsd),
      }))
      .sort((a, b) => b.volumeUsd - a.volumeUsd)
      .slice(0, 10),
    topWalletTags: [...tagCounts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20),
  };
}

async function runGmgnSmartMoneyTrades({
  chain,
  side,
  limit,
}: {
  chain: string;
  side?: "buy" | "sell";
  limit: number;
}) {
  if (IS_VERCEL_RUNTIME) {
    throw new Error("gmgn-cli execution is disabled in Vercel serverless runtime.");
  }

  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);
  const args = ["track", "smartmoney", "--chain", chain, "--limit", String(limit), "--raw"];
  if (side) {
    args.splice(4, 0, "--side", side);
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

async function fetchGmgnSmartMoneyTradesDirect({
  chain,
  limit,
}: {
  chain: string;
  side?: "buy" | "sell";
  limit: number;
}) {
  return fetchGmgnOpenApiJson({
    failingStep: "smart-money",
    path: "/v1/user/smartmoney",
    query: {
      chain,
      limit,
    },
    source: "GMGN smart money",
  });
}

export async function fetchGmgnSmartMoneyTrades(
  chain: string,
  options: FetchGmgnSmartMoneyTradesOptions = {}
): Promise<GmgnSmartMoneyTradesResult> {
  const normalizedChain = chain.toLowerCase();
  validateChain(normalizedChain);
  const limit = normalizeLimit(options.limit);
  const side = validateSide(options.side);
  const raw = IS_VERCEL_RUNTIME || process.env.GMGN_DIRECT_HTTP === "true"
    ? await fetchGmgnSmartMoneyTradesDirect({ chain: normalizedChain, side, limit })
    : await runGmgnSmartMoneyTrades({
        chain: normalizedChain,
        side,
        limit,
      }).catch((error) => {
        if (process.env.GMGN_CLI_ONLY === "true") throw error;
        return fetchGmgnSmartMoneyTradesDirect({ chain: normalizedChain, side, limit });
      });
  const rawItems = extractTradeArray(raw);
  const warnings: string[] = [];
  const trades = dedupeTrades(rawItems.map((item) => normalizeTrade(normalizedChain, item))).sort(
    (a, b) => (b.timestampUnix ?? 0) - (a.timestampUnix ?? 0)
  );

  if (rawItems.length === 0) {
    warnings.push("GMGN smart money feed returned no trade rows.");
  }

  if (rawItems.length > trades.length) {
    warnings.push(`${rawItems.length - trades.length} duplicate trade row(s) were removed by txHash.`);
  }

  return {
    chain: normalizedChain,
    side: side ?? null,
    limit,
    count: trades.length,
    trades,
    summary: buildSummary(trades),
    warnings,
    ...(options.includeRaw ? { raw } : {}),
  };
}
