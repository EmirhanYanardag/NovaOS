export type GMGNActivity = {
  timestamp: string | null;
  type: "buy" | "sell" | "transfer" | string | null;
  chain: string | null;
  wallet: string | null;
  tokenAddress: string | null;
  tokenSymbol: string | null;
  amount: string | number | null;
  valueUsd: number | null;
  txHash: string | null;
  raw: unknown;
};

export type GMGNHolder = {
  wallet: string | null;
  address: string | null;
  amount: string | number | null;
  amountPercentage: number | null;
  usdValue: number | null;
  tag: string | null;
  label: string | null;
  costBasis: number | null;
  realizedPnl: number | null;
  unrealizedPnl: number | null;
  raw: unknown;
};

type GmgnWalletActivityInput = {
  chain: string;
  wallet: string;
  limit: number;
  cursor?: string;
  type?: "buy" | "sell" | "transfer";
};

type GmgnTopHoldersInput = {
  chain: string;
  address: string;
  limit: number;
  orderBy: string;
  direction: "asc" | "desc";
};

type NormalizedGmgnActivityResponse = {
  activities: GMGNActivity[];
  next: string | null;
  count: number;
  oldestTimestamp: string | null;
  newestTimestamp: string | null;
};

type NormalizedGmgnTopHoldersResponse = {
  holders: GMGNHolder[];
  count: number;
};

type UnknownRecord = Record<string, unknown>;

const EVM_WALLET_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const SOL_WALLET_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SAFE_CURSOR_PATTERN = /^[A-Za-z0-9._:+=/-]{1,512}$/;
const SAFE_ORDER_BY_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const SUPPORTED_GMGN_CHAINS = ["eth", "base", "bsc", "sol", "mantle"] as const;
const DEFAULT_GMGN_API_BASE = "https://gmgn.ai";
const IS_VERCEL_RUNTIME = Boolean(process.env.VERCEL);

export type GmgnDirectFailureDiagnostic = {
  baseUsed: string;
  endpointPath: string;
  status: number | null;
  contentType: string | null;
  responsePreview: string;
  hasGMGNKey: boolean;
  failingStep: string;
  requestHeaders: Record<string, string | boolean>;
  responseClassification: string;
};

export class GmgnDirectNonJsonError extends Error {
  diagnostics: GmgnDirectFailureDiagnostic;

  constructor(message: string, diagnostics: GmgnDirectFailureDiagnostic) {
    super(message);
    this.name = "GmgnDirectNonJsonError";
    this.diagnostics = diagnostics;
  }
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function parseTimestamp(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const timestamp = value > 9_999_999_999 ? value : value * 1000;
    return new Date(timestamp).toISOString();
  }

  if (typeof value !== "string" || !value.trim()) return null;

  const numeric = Number(value);
  const parsed = Number.isFinite(numeric)
    ? numeric > 9_999_999_999
      ? numeric
      : numeric * 1000
    : Date.parse(value);

  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
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

function extractActivityArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];

  const directCandidates = [
    payload.activities,
    payload.activity,
    payload.items,
    payload.list,
    payload.result,
    payload.rows,
  ];

  for (const candidate of directCandidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  if (isRecord(payload.data)) {
    return extractActivityArray(payload.data);
  }

  return [];
}

function extractNext(payload: unknown): string | null {
  if (!isRecord(payload)) return null;

  const direct = firstString(payload, [
    "next",
    "nextCursor",
    "next_cursor",
    "cursor",
  ]);

  if (direct) return direct;
  if (isRecord(payload.data)) return extractNext(payload.data);

  return null;
}

function extractHolderArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];

  const directCandidates = [
    payload.holders,
    payload.holder,
    payload.items,
    payload.list,
    payload.result,
    payload.rows,
  ];

  for (const candidate of directCandidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  if (isRecord(payload.data)) {
    return extractHolderArray(payload.data);
  }

  return [];
}

function normalizeActivity(item: unknown): GMGNActivity {
  const record = isRecord(item) ? item : {};
  const timestamp = parseTimestamp(
    record.timestamp ??
      record.time ??
      record.block_timestamp ??
      record.blockTime ??
      record.created_at
  );

  return {
    timestamp,
    type: firstString(record, ["type", "event", "activity_type", "side"]),
    chain: firstString(record, ["chain", "chain_name", "network"]),
    wallet: firstString(record, ["wallet", "wallet_address", "address"]),
    tokenAddress: firstString(record, [
      "token_address",
      "tokenAddress",
      "address",
      "contract_address",
    ]),
    tokenSymbol: firstString(record, ["token_symbol", "tokenSymbol", "symbol"]),
    amount:
      asString(record.amount) ??
      asString(record.token_amount) ??
      asNumber(record.amount) ??
      asNumber(record.token_amount),
    valueUsd: firstNumber(record, ["value_usd", "valueUsd", "usd_value", "usd"]),
    txHash: firstString(record, ["tx_hash", "txHash", "transaction_hash", "hash"]),
    raw: item,
  };
}

function normalizeHolder(item: unknown): GMGNHolder {
  const record = isRecord(item) ? item : {};
  const address = firstString(record, [
    "wallet",
    "address",
    "holder_address",
    "holderAddress",
    "wallet_address",
    "owner_address",
    "ownerAddress",
  ]);

  return {
    wallet: address,
    address,
    amount:
      firstValue(record, [
        "amount",
        "balance",
        "holding",
        "hold_amount",
        "holdAmount",
        "token_amount",
        "tokenAmount",
      ]) as string | number | null,
    amountPercentage: firstNumber(record, [
      "amount_percentage",
      "amountPercentage",
      "holding_percentage",
      "holdingPercentage",
      "percentage",
      "percent",
      "share",
    ]),
    usdValue: firstNumber(record, [
      "usd_value",
      "usdValue",
      "value_usd",
      "valueUsd",
      "holding_value",
      "holdingValue",
    ]),
    tag: firstString(record, ["tag", "tags", "wallet_tag", "walletTag"]),
    label: firstString(record, ["label", "entity", "name", "wallet_label", "walletLabel"]),
    costBasis: firstNumber(record, [
      "cost_basis",
      "costBasis",
      "avg_cost",
      "avgCost",
      "average_cost",
      "averageCost",
    ]),
    realizedPnl: firstNumber(record, [
      "realized_pnl",
      "realizedPnl",
      "realized_profit",
      "realizedProfit",
    ]),
    unrealizedPnl: firstNumber(record, [
      "unrealized_pnl",
      "unrealizedPnl",
      "unrealized_profit",
      "unrealizedProfit",
    ]),
    raw: item,
  };
}

export function normalizeGmgnActivityResponse(
  payload: unknown
): NormalizedGmgnActivityResponse {
  const activities = extractActivityArray(payload).map(normalizeActivity);
  const timestamps = activities
    .map((activity) =>
      activity.timestamp ? Date.parse(activity.timestamp) : Number.NaN
    )
    .filter((timestamp) => Number.isFinite(timestamp));

  return {
    activities,
    next: extractNext(payload),
    count: activities.length,
    oldestTimestamp:
      timestamps.length > 0 ? new Date(Math.min(...timestamps)).toISOString() : null,
    newestTimestamp:
      timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : null,
  };
}

export function normalizeGmgnTopHoldersResponse(
  payload: unknown,
  limit = 100
): NormalizedGmgnTopHoldersResponse {
  const holders = extractHolderArray(payload).map(normalizeHolder).slice(0, limit);

  return {
    holders,
    count: holders.length,
  };
}

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

function validateWalletActivityInput({
  chain,
  wallet,
  limit,
  cursor,
  type,
}: GmgnWalletActivityInput) {
  validateChain(chain);

  if (!isValidAddressForChain(chain, wallet)) {
    throw new Error("wallet must be a valid address for the requested chain.");
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("limit must be an integer from 1 to 100.");
  }

  if (cursor && !SAFE_CURSOR_PATTERN.test(cursor)) {
    throw new Error("cursor contains unsupported characters.");
  }

  if (type && !["buy", "sell", "transfer"].includes(type)) {
    throw new Error("Unsupported GMGN activity type.");
  }
}

function validateTopHoldersInput({
  chain,
  address,
  limit,
  orderBy,
  direction,
}: GmgnTopHoldersInput) {
  validateChain(chain);

  if (!isValidAddressForChain(chain, address)) {
    throw new Error("address must be a valid token address for the requested chain.");
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("limit must be an integer from 1 to 100.");
  }

  if (!SAFE_ORDER_BY_PATTERN.test(orderBy)) {
    throw new Error("orderBy contains unsupported characters.");
  }

  if (!["asc", "desc"].includes(direction)) {
    throw new Error("direction must be asc or desc.");
  }
}

function buildGmgnCliArgs({
  chain,
  wallet,
  limit,
  cursor,
  type,
}: GmgnWalletActivityInput) {
  const args = [
    "portfolio",
    "activity",
    "--chain",
    chain,
    "--wallet",
    wallet,
    "--limit",
    String(limit),
  ];

  if (cursor) args.push("--cursor", cursor);
  if (type) args.push("--type", type);

  return args;
}

function buildGmgnTopHoldersArgs({
  chain,
  address,
  orderBy,
  direction,
}: GmgnTopHoldersInput) {
  return [
    "token",
    "holders",
    "--chain",
    chain,
    "--address",
    address,
    "--order-by",
    orderBy,
    "--direction",
    direction,
  ];
}

async function runGmgnCli(args: string[]) {
  if (IS_VERCEL_RUNTIME) {
    throw new Error("gmgn-cli execution is disabled in Vercel serverless runtime.");
  }

  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);
  const env = {
    ...process.env,
    GMGN_API_KEY: process.env.GMGN_API_KEY,
  };
  const execOptions = {
    env,
    maxBuffer: 1024 * 1024 * 5,
    timeout: 30_000,
    windowsHide: true,
  };

  const { stdout } =
    process.platform === "win32"
      ? await execFileAsync("cmd.exe", ["/d", "/c", ["gmgn-cli", ...args].join(" ")], execOptions)
      : await execFileAsync("gmgn-cli", args, execOptions);

  try {
    return JSON.parse(stdout) as unknown;
  } catch {
    throw new Error("GMGN CLI returned non-JSON output.");
  }
}

function gmgnAuthHeaders() {
  const apiKey = process.env.GMGN_API_KEY || "";
  const headers: Record<string, string> = {
    accept: "application/json, text/plain, */*",
    "user-agent": "Mozilla/5.0",
    origin: "https://gmgn.ai",
    referer: "https://gmgn.ai/",
  };

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
    headers["X-API-KEY"] = apiKey;
    headers["x-api-key"] = apiKey;
  }

  return headers;
}

function gmgnApiBaseCandidates() {
  const configured = process.env.GMGN_API_BASE?.trim();
  return Array.from(new Set([
    configured || "",
    DEFAULT_GMGN_API_BASE,
    "https://api.gmgn.ai",
    "https://gmgn.ai/api",
    "https://www.gmgn.ai",
  ].filter(Boolean))).map((base) => base.replace(/\/+$/, ""));
}

function candidateUrl(base: string, path: string, params: Record<string, string | number | undefined>) {
  const url = new URL(`${base}/${path.replace(/^\/+/, "")}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  return url;
}

function sanitizedHeadersForLog(headers: HeadersInit) {
  const record = headers as Record<string, string>;
  return {
    accept: record.accept,
    "user-agent": record["user-agent"],
    origin: record.origin,
    referer: record.referer,
    hasAuthorization: Boolean(record.Authorization),
    hasXApiKey: Boolean(record["X-API-KEY"] || record["x-api-key"]),
  };
}

function responsePreview(text: string) {
  return text
    .replace(process.env.GMGN_API_KEY || "__NO_KEY__", "[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

function classifyNonJsonResponse({
  status,
  text,
}: {
  status: number;
  text: string;
}) {
  const lower = text.toLowerCase();
  if (lower.includes("cloudflare") || lower.includes("cf-ray") || lower.includes("checking your browser")) return "cloudflare";
  if (status === 404 || lower.includes("404") || lower.includes("not found")) return "404-html-or-wrong-route";
  if (status === 401 || status === 403 || lower.includes("login") || lower.includes("sign in") || lower.includes("unauthorized")) return "login-auth-page";
  if (status === 429 || lower.includes("rate limit") || lower.includes("too many requests")) return "rate-limit-page";
  if (lower.includes("blocked") || lower.includes("access denied") || lower.includes("forbidden")) return "blocked-request";
  if (lower.startsWith("<!doctype html") || lower.startsWith("<html")) return "html-non-json";
  return "non-json";
}

function directFailureDiagnostic({
  baseUsed,
  contentType,
  endpointPath,
  failingStep,
  headers,
  responseText,
  status,
}: {
  baseUsed: string;
  contentType: string | null;
  endpointPath: string;
  failingStep: string;
  headers: HeadersInit;
  responseText: string;
  status: number | null;
}): GmgnDirectFailureDiagnostic {
  return {
    baseUsed,
    endpointPath,
    status,
    contentType,
    responsePreview: responsePreview(responseText),
    hasGMGNKey: Boolean(process.env.GMGN_API_KEY),
    failingStep,
    requestHeaders: sanitizedHeadersForLog(headers),
    responseClassification: status === null
      ? "network-error"
      : classifyNonJsonResponse({ status, text: responseText }),
  };
}

function logDirectDiagnostic(diagnostic: GmgnDirectFailureDiagnostic) {
  console.warn("[GMGN direct HTTP]", diagnostic);
}

function sanitizeProviderError(message: string) {
  return message
    .replace(process.env.GMGN_API_KEY || "__NO_KEY__", "[redacted]")
    .replace(/https?:\/\/[^\s)]+/g, (url) => {
      try {
        const parsed = new URL(url);
        return `${parsed.origin}${parsed.pathname}`;
      } catch {
        return "[url]";
      }
    })
    .slice(0, 360);
}

async function fetchJsonCandidates({
  candidates,
  failingStep,
  source,
}: {
  candidates: URL[];
  failingStep: string;
  source: string;
}) {
  const failures: string[] = [];

  for (const url of candidates) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    const headers = gmgnAuthHeaders();

    try {
      const response = await fetch(url.toString(), {
        headers,
        cache: "no-store",
        signal: controller.signal,
      });
      const text = await response.text();
      const contentType = response.headers.get("content-type");
      let data: unknown = null;
      const diagnosticBase = {
        baseUsed: url.pathname.startsWith("/api/")
          ? `${url.origin}/api`
          : url.origin,
        contentType,
        endpointPath: `${url.pathname}${url.search}`,
        failingStep,
        headers,
        responseText: text,
        status: response.status,
      };

      if (text.trim()) {
        try {
          data = JSON.parse(text);
        } catch {
          const diagnostic = directFailureDiagnostic(diagnosticBase);
          logDirectDiagnostic(diagnostic);
          if (failingStep === "top-holders") {
            throw new GmgnDirectNonJsonError("GMGN top holders returned non-JSON response.", diagnostic);
          }
          failures.push(`${url.pathname}: non-json response (${diagnostic.responseClassification})`);
          continue;
        }
      }

      if (!response.ok) {
        logDirectDiagnostic(directFailureDiagnostic(diagnosticBase));
        failures.push(`${url.pathname}: HTTP ${response.status}`);
        continue;
      }

      return data;
    } catch (error) {
      if (error instanceof GmgnDirectNonJsonError) throw error;
      const reason = error instanceof Error ? error.message : "unknown error";
      logDirectDiagnostic(directFailureDiagnostic({
        baseUsed: url.pathname.startsWith("/api/")
          ? `${url.origin}/api`
          : url.origin,
        contentType: null,
        endpointPath: `${url.pathname}${url.search}`,
        failingStep,
        headers,
        responseText: reason,
        status: null,
      }));
      failures.push(`${url.pathname}: ${reason}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(`${source} unavailable via direct GMGN HTTP. ${sanitizeProviderError(failures.join("; "))}`);
}

async function fetchGmgnWalletActivityDirect(input: GmgnWalletActivityInput) {
  const candidates = gmgnApiBaseCandidates().flatMap((base) => [
    candidateUrl(base, `/defi/quotation/v1/wallet_activity/${input.chain}/${input.wallet}`, {
      limit: input.limit,
      cursor: input.cursor,
      type: input.type,
    }),
    candidateUrl(base, `/defi/quotation/v1/wallet/activity/${input.chain}/${input.wallet}`, {
      limit: input.limit,
      cursor: input.cursor,
      type: input.type,
    }),
    candidateUrl(base, `/api/v1/wallet/activity/${input.chain}/${input.wallet}`, {
      limit: input.limit,
      cursor: input.cursor,
      type: input.type,
    }),
  ]);

  return fetchJsonCandidates({ candidates, failingStep: "wallet-activity", source: "GMGN wallet activity" });
}

async function fetchGmgnTopHoldersDirect(input: GmgnTopHoldersInput) {
  const candidates = gmgnApiBaseCandidates().flatMap((base) => [
    candidateUrl(base, `/defi/quotation/v1/tokens/top_holders/${input.chain}/${input.address}`, {
      limit: input.limit,
      orderby: input.orderBy,
      direction: input.direction,
    }),
    candidateUrl(base, `/defi/quotation/v1/tokens/${input.chain}/${input.address}/top_holders`, {
      limit: input.limit,
      orderby: input.orderBy,
      direction: input.direction,
    }),
    candidateUrl(base, `/defi/quotation/v1/token_holders/${input.chain}/${input.address}`, {
      limit: input.limit,
      orderby: input.orderBy,
      direction: input.direction,
    }),
    candidateUrl(base, `/api/v1/token_holders/${input.chain}/${input.address}`, {
      limit: input.limit,
      orderby: input.orderBy,
      direction: input.direction,
    }),
  ]);

  return fetchJsonCandidates({ candidates, failingStep: "top-holders", source: "GMGN top holders" });
}

export async function runGmgnWalletActivity({
  chain,
  wallet,
  limit,
  cursor,
  type,
}: GmgnWalletActivityInput) {
  const input = { chain, wallet, limit, cursor, type };
  validateWalletActivityInput(input);

  if (IS_VERCEL_RUNTIME || process.env.GMGN_DIRECT_HTTP === "true") {
    return fetchGmgnWalletActivityDirect(input);
  }

  const args = buildGmgnCliArgs(input);
  try {
    return await runGmgnCli(args);
  } catch (error) {
    if (process.env.GMGN_CLI_ONLY === "true") throw error;
    return fetchGmgnWalletActivityDirect(input);
  }
}

export async function runGmgnTopHolders({
  chain,
  address,
  limit,
  orderBy,
  direction,
}: GmgnTopHoldersInput) {
  const input = { chain, address, limit, orderBy, direction };
  validateTopHoldersInput(input);

  if (IS_VERCEL_RUNTIME || process.env.GMGN_DIRECT_HTTP === "true") {
    return fetchGmgnTopHoldersDirect(input);
  }

  try {
    return await runGmgnCli(buildGmgnTopHoldersArgs(input));
  } catch (error) {
    if (process.env.GMGN_CLI_ONLY === "true") throw error;
    return fetchGmgnTopHoldersDirect(input);
  }
}
