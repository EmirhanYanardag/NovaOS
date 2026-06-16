import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

type QueryValue = string | number | boolean | Array<string | number | boolean> | undefined | null;

const DEFAULT_GMGN_OPENAPI_BASE = "https://openapi.gmgn.ai";
const DEFAULT_UNKNOWN_ENDPOINT_DELAY_MS = 500;

type GmgnEndpointKind =
  | "topHoldersRequests"
  | "walletActivityRequests"
  | "walletStatsRequests"
  | "tokenInfoRequests"
  | "tokenKlineRequests"
  | "smartMoneyRequests"
  | "otherGmgnRequests";

type GmgnOpenApiRequestStore = {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  topHoldersRequests: number;
  walletActivityRequests: number;
  walletStatsRequests: number;
  tokenInfoRequests: number;
  tokenKlineRequests: number;
  smartMoneyRequests: number;
  otherGmgnRequests: number;
  endpointCounts: Record<string, number>;
  uniqueWallets: Set<string>;
  firstFailure: {
    endpointPath: string;
    status: number | null;
    errorCode: GmgnOpenApiErrorCode | "GMGN_OPENAPI_NETWORK" | null;
    failingStep: string;
  } | null;
  totalQueuedRequests: number;
  totalExecutedRequests: number;
  totalDedupedRequests: number;
  queueWaitMsTotal: number;
  scanAbortedAfterRateLimit: boolean;
  firstRateLimit: {
    endpointPath: string;
    status: number | null;
    message: string | null;
    retryAfterSeconds: number | null;
    resetAt: string | null;
    failingStep: string;
  } | null;
  requestCache: Map<string, Promise<unknown>>;
};

const gmgnRequestStorage = new AsyncLocalStorage<GmgnOpenApiRequestStore>();

function createRequestStore(): GmgnOpenApiRequestStore {
  return {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    topHoldersRequests: 0,
    walletActivityRequests: 0,
    walletStatsRequests: 0,
    tokenInfoRequests: 0,
    tokenKlineRequests: 0,
    smartMoneyRequests: 0,
    otherGmgnRequests: 0,
    endpointCounts: {},
    uniqueWallets: new Set<string>(),
    firstFailure: null,
    totalQueuedRequests: 0,
    totalExecutedRequests: 0,
    totalDedupedRequests: 0,
    queueWaitMsTotal: 0,
    scanAbortedAfterRateLimit: false,
    firstRateLimit: null,
    requestCache: new Map<string, Promise<unknown>>(),
  };
}

export function runWithGmgnOpenApiRequestTracking<T>(callback: () => Promise<T>) {
  return gmgnRequestStorage.run(createRequestStore(), callback);
}

export function getGmgnOpenApiRequestSummary() {
  const store = gmgnRequestStorage.getStore();
  if (!store) {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      topHoldersRequests: 0,
      walletActivityRequests: 0,
      walletStatsRequests: 0,
      tokenInfoRequests: 0,
      tokenKlineRequests: 0,
      smartMoneyRequests: 0,
      otherGmgnRequests: 0,
      endpointCounts: {},
      uniqueWalletCount: 0,
      requestsPerHolderAverage: 0,
      firstFailure: null,
      totalQueuedRequests: 0,
      totalExecutedRequests: 0,
      totalDedupedRequests: 0,
      queueWaitMsTotal: 0,
      scanAbortedAfterRateLimit: false,
      firstRateLimitEndpoint: null,
      firstRateLimitStatus: null,
      firstRateLimitMessage: null,
      retryAfterSeconds: null,
      resetAt: null,
    };
  }

  const uniqueWalletCount = store.uniqueWallets.size;
  return {
    totalRequests: store.totalRequests,
    successfulRequests: store.successfulRequests,
    failedRequests: store.failedRequests,
    topHoldersRequests: store.topHoldersRequests,
    walletActivityRequests: store.walletActivityRequests,
    walletStatsRequests: store.walletStatsRequests,
    tokenInfoRequests: store.tokenInfoRequests,
    tokenKlineRequests: store.tokenKlineRequests,
    smartMoneyRequests: store.smartMoneyRequests,
    otherGmgnRequests: store.otherGmgnRequests,
    endpointCounts: { ...store.endpointCounts },
    uniqueWalletCount,
    requestsPerHolderAverage: uniqueWalletCount > 0
      ? Number((store.totalRequests / uniqueWalletCount).toFixed(2))
      : 0,
    firstFailure: store.firstFailure,
    totalQueuedRequests: store.totalQueuedRequests,
    totalExecutedRequests: store.totalExecutedRequests,
    totalDedupedRequests: store.totalDedupedRequests,
    queueWaitMsTotal: store.queueWaitMsTotal,
    scanAbortedAfterRateLimit: store.scanAbortedAfterRateLimit,
    firstRateLimitEndpoint: store.firstRateLimit?.endpointPath ?? null,
    firstRateLimitStatus: store.firstRateLimit?.status ?? null,
    firstRateLimitMessage: store.firstRateLimit?.message ?? null,
    retryAfterSeconds: store.firstRateLimit?.retryAfterSeconds ?? null,
    resetAt: store.firstRateLimit?.resetAt ?? null,
  };
}

function endpointKind(path: string): GmgnEndpointKind {
  if (path === "/v1/market/token_top_holders") return "topHoldersRequests";
  if (path === "/v1/user/wallet_activity") return "walletActivityRequests";
  if (path === "/v1/user/wallet_stats") return "walletStatsRequests";
  if (path === "/v1/token/info") return "tokenInfoRequests";
  if (path === "/v1/market/token_kline") return "tokenKlineRequests";
  if (path === "/v1/user/smartmoney") return "smartMoneyRequests";
  return "otherGmgnRequests";
}

function recordGmgnOpenApiAttempt({
  path,
  url,
}: {
  path: string;
  url: URL;
}) {
  const store = gmgnRequestStorage.getStore();
  if (!store) return null;

  const kind = endpointKind(path);
  const wallet = url.searchParams.get("wallet_address") || url.searchParams.get("wallet");
  store.totalRequests += 1;
  store[kind] += 1;
  store.endpointCounts[path] = (store.endpointCounts[path] || 0) + 1;
  if (wallet) store.uniqueWallets.add(wallet.toLowerCase());

  let finalized = false;
  return ({
    success,
    status,
    errorCode,
    failingStep,
  }: {
    success: boolean;
    status: number | null;
    errorCode: GmgnOpenApiErrorCode | "GMGN_OPENAPI_NETWORK" | null;
    failingStep: string;
  }) => {
    if (finalized) return;
    finalized = true;
    if (success) {
      store.successfulRequests += 1;
      return;
    }

    store.failedRequests += 1;
    if (!store.firstFailure) {
      store.firstFailure = {
        endpointPath: `${url.pathname}${url.search}`,
        status,
        errorCode,
        failingStep,
      };
    }
  };
}

const endpointDelayMs: Record<string, number> = {
  "/v1/token/info": 100,
  "/v1/market/token_top_holders": 400,
  "/v1/market/token_kline": 250,
  "/v1/user/wallet_activity": 700,
  "/v1/user/wallet_stats": 700,
  "/v1/user/smartmoney": 150,
};

let gmgnQueueTail: Promise<void> = Promise.resolve();
const lastExecutedAtByEndpoint = new Map<string, number>();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function gmgnEndpointDelay(path: string) {
  return endpointDelayMs[path] ?? DEFAULT_UNKNOWN_ENDPOINT_DELAY_MS;
}

async function runThroughGmgnQueue<T>(path: string, task: () => Promise<T>) {
  const store = gmgnRequestStorage.getStore();
  const queuedAt = Date.now();
  if (store) store.totalQueuedRequests += 1;

  const previous = gmgnQueueTail;
  let release: () => void = () => undefined;
  gmgnQueueTail = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous.catch(() => undefined);

  try {
    const now = Date.now();
    const minDelayMs = gmgnEndpointDelay(path);
    const lastExecutedAt = lastExecutedAtByEndpoint.get(path) ?? 0;
    const waitMs = Math.max(0, minDelayMs - (now - lastExecutedAt));
    const queueWaitMs = Date.now() - queuedAt + waitMs;
    if (store) store.queueWaitMsTotal += queueWaitMs;
    if (waitMs > 0) await sleep(waitMs);
    lastExecutedAtByEndpoint.set(path, Date.now());
    if (store) store.totalExecutedRequests += 1;
    return await task();
  } finally {
    release();
  }
}

export type GmgnOpenApiErrorCode =
  | "GMGN_OPENAPI_AUTH_ACCESS"
  | "GMGN_OPENAPI_BAD_REQUEST"
  | "GMGN_OPENAPI_RATE_LIMIT"
  | "GMGN_OPENAPI_UPSTREAM"
  | "GMGN_OPENAPI_NON_JSON"
  | "GMGN_OPENAPI_NETWORK"
  | "GMGN_OPENAPI_BUSINESS_ERROR";

export type GmgnOpenApiDiagnostics = {
  ok: boolean;
  status: number | null;
  endpointPath: string;
  baseUsed: string;
  method: "GET";
  hasGMGNKey: boolean;
  hasClientId: boolean;
  timestampPreview: string | null;
  timestampFormat: "unix-seconds" | "missing" | "invalid";
  contentType: string | null;
  gmgnCode: unknown;
  gmgnMessage: unknown;
  gmgnError: unknown;
  retryAfterSeconds: number | null;
  resetAt: string | null;
  responsePreview: string;
  requestHeaderNames: string[];
  failingStep: string;
  errorCode: GmgnOpenApiErrorCode | null;
};

export class GmgnOpenApiError extends Error {
  diagnostics: GmgnOpenApiDiagnostics;

  constructor(message: string, diagnostics: GmgnOpenApiDiagnostics) {
    super(message);
    this.name = "GmgnOpenApiError";
    this.diagnostics = diagnostics;
  }
}

function unknownRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function nestedValue(root: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (key in root) return root[key];
  }

  for (const value of Object.values(root)) {
    const nested = unknownRecord(value);
    if (!nested) continue;
    const found = nestedValue(nested, keys);
    if (found !== undefined) return found;
  }

  return undefined;
}

function parseRetryAfterSeconds(value: string | null) {
  if (!value) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 0) return Math.ceil(numeric);
  const parsedDate = Date.parse(value);
  if (Number.isFinite(parsedDate)) {
    return Math.max(0, Math.ceil((parsedDate - Date.now()) / 1000));
  }
  return null;
}

function parseResetAt(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      const ms = numeric > 10_000_000_000 ? numeric : numeric * 1000;
      return new Date(ms).toISOString();
    }

    const parsedDate = Date.parse(value);
    if (Number.isFinite(parsedDate)) return new Date(parsedDate).toISOString();
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 10_000_000_000 ? value : value * 1000;
    return new Date(ms).toISOString();
  }

  return null;
}

function gmgnOpenApiBase() {
  const configured = process.env.GMGN_API_BASE?.trim();
  if (!configured) return DEFAULT_GMGN_OPENAPI_BASE;

  try {
    const url = new URL(configured);
    if (url.hostname === "openapi.gmgn.ai") {
      return configured.replace(/\/+$/, "");
    }
  } catch {
    return DEFAULT_GMGN_OPENAPI_BASE;
  }

  console.warn("[GMGN OpenAPI] Ignoring GMGN_API_BASE because it is not the OpenAPI host.", {
    configuredHost: (() => {
      try {
        return new URL(configured).hostname;
      } catch {
        return "invalid-url";
      }
    })(),
    requiredHost: "openapi.gmgn.ai",
  });
  return DEFAULT_GMGN_OPENAPI_BASE;
}

function sanitize(value: string) {
  return value
    .replace(process.env.GMGN_API_KEY || "__NO_KEY__", "[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

function timestampFormat(value: string | null) {
  if (!value) return "missing" as const;
  return /^\d{10}$/.test(value) ? "unix-seconds" as const : "invalid" as const;
}

function buildOpenApiUrl(path: string, query: Record<string, QueryValue>) {
  const url = new URL(`${gmgnOpenApiBase()}${path}`);
  const params = new URLSearchParams();
  const authQuery: Record<string, QueryValue> = {
    timestamp: Math.floor(Date.now() / 1000),
    client_id: randomUUID(),
  };
  const fullQuery: Record<string, QueryValue> = { ...query, ...authQuery };

  for (const [key, value] of Object.entries(fullQuery)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, String(item));
    } else {
      params.set(key, String(value));
    }
  }

  url.search = params.toString();
  return url;
}

function openApiRequestCacheKey(path: string, query: Record<string, QueryValue>) {
  const params = new URLSearchParams();
  const entries = Object.entries(query).sort(([left], [right]) => left.localeCompare(right));

  for (const [key, value] of entries) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      for (const item of [...value].sort()) params.append(key, String(item));
    } else {
      params.set(key, String(value));
    }
  }

  return `${path}?${params.toString()}`;
}

function gmgnOpenApiHeaders() {
  return {
    accept: "application/json, text/plain, */*",
    "Content-Type": "application/json",
    "X-APIKEY": process.env.GMGN_API_KEY || "",
  };
}

function explicitRateLimitText(value: string) {
  const text = value.toLowerCase();
  return (
    text.includes("rate limit") ||
    text.includes("too many requests") ||
    text.includes("quota")
  );
}

function classifyOpenApiFailure({
  parsedJson,
  status,
  text,
  wasJson,
}: {
  parsedJson: unknown;
  status: number | null;
  text: string;
  wasJson: boolean;
}): GmgnOpenApiErrorCode {
  const jsonRecord =
    parsedJson && typeof parsedJson === "object"
      ? (parsedJson as { code?: unknown; error?: unknown; message?: unknown })
      : null;
  const codeValue = jsonRecord?.code;
  const combined = [
    text,
    String(codeValue ?? ""),
    String(jsonRecord?.error ?? ""),
    String(jsonRecord?.message ?? ""),
  ].join(" ");

  if (codeValue === 429 || String(codeValue) === "429") return "GMGN_OPENAPI_RATE_LIMIT";
  if (status === 429 || explicitRateLimitText(combined)) return "GMGN_OPENAPI_RATE_LIMIT";
  if (status === 401 || status === 403) return "GMGN_OPENAPI_AUTH_ACCESS";
  if (status === 400) return "GMGN_OPENAPI_BAD_REQUEST";
  if (status !== null && status >= 500) return "GMGN_OPENAPI_UPSTREAM";
  if (!wasJson) return "GMGN_OPENAPI_NON_JSON";
  if (status === null) return "GMGN_OPENAPI_NETWORK";
  return "GMGN_OPENAPI_BUSINESS_ERROR";
}

function diagnosticsFor({
  contentType,
  errorCode,
  failingStep,
  parsedJson,
  retryAfterHeader,
  responseText,
  status,
  url,
}: {
  contentType: string | null;
  errorCode: GmgnOpenApiErrorCode | null;
  failingStep: string;
  parsedJson: unknown;
  retryAfterHeader?: string | null;
  responseText: string;
  status: number | null;
  url: URL;
}): GmgnOpenApiDiagnostics {
  const timestamp = url.searchParams.get("timestamp");
  const clientId = url.searchParams.get("client_id");
  const jsonRecord =
    parsedJson && typeof parsedJson === "object"
      ? (parsedJson as { code?: unknown; error?: unknown; message?: unknown })
      : null;
  const resetAt = jsonRecord
    ? parseResetAt(nestedValue(jsonRecord, ["reset_at", "resetAt", "reset_time", "resetTime"]))
    : null;
  const retryAfterFromJson = jsonRecord
    ? nestedValue(jsonRecord, ["retry_after", "retryAfter", "retry_after_seconds", "retryAfterSeconds"])
    : null;
  const retryAfterSeconds = parseRetryAfterSeconds(retryAfterHeader ?? null)
    ?? (typeof retryAfterFromJson === "number" || typeof retryAfterFromJson === "string"
      ? parseRetryAfterSeconds(String(retryAfterFromJson))
      : null);

  return {
    ok: status !== null && status >= 200 && status < 300 && !errorCode,
    status,
    endpointPath: `${url.pathname}${url.search}`,
    baseUsed: url.origin,
    method: "GET",
    hasGMGNKey: Boolean(process.env.GMGN_API_KEY),
    hasClientId: Boolean(clientId),
    timestampPreview: timestamp ? `${timestamp.slice(0, 4)}...${timestamp.slice(-2)}` : null,
    timestampFormat: timestampFormat(timestamp),
    contentType,
    gmgnCode: jsonRecord?.code ?? null,
    gmgnMessage: jsonRecord?.message ?? null,
    gmgnError: jsonRecord?.error ?? null,
    retryAfterSeconds,
    resetAt,
    responsePreview: sanitize(responseText),
    requestHeaderNames: Object.keys(gmgnOpenApiHeaders()),
    failingStep,
    errorCode,
  };
}

function logOpenApiFailure({
  diagnostics,
  path,
}: {
  diagnostics: GmgnOpenApiDiagnostics;
  path: string;
}) {
  console.warn("[GMGN OpenAPI]", {
    ...diagnostics,
    path,
  });
}

function logOpenApi429({
  response,
  text,
  url,
  failingStep,
}: {
  response: Response;
  text: string;
  url: URL;
  failingStep: string;
}) {
  if (response.status !== 429) return;

  console.warn("GMGN_OPENAPI_429", {
    endpointPath: `${url.pathname}${url.search}`,
    status: response.status,
    retryAfter: response.headers.get("retry-after"),
    responsePreview: sanitize(text),
    failingStep,
  });
}

function rateLimitMessage(parsedJson: unknown, fallbackText: string) {
  const jsonRecord = unknownRecord(parsedJson);
  const message = jsonRecord
    ? nestedValue(jsonRecord, ["message", "error", "msg", "reason"])
    : null;
  if (typeof message === "string" && message.trim()) return sanitize(message);
  return sanitize(fallbackText);
}

function markScanRateLimited({
  diagnostics,
  parsedJson,
  text,
}: {
  diagnostics: GmgnOpenApiDiagnostics;
  parsedJson: unknown;
  text: string;
}) {
  if (diagnostics.errorCode !== "GMGN_OPENAPI_RATE_LIMIT") return;

  const store = gmgnRequestStorage.getStore();
  if (!store) return;

  store.scanAbortedAfterRateLimit = true;
  if (!store.firstRateLimit) {
    store.firstRateLimit = {
      endpointPath: diagnostics.endpointPath,
      status: diagnostics.status,
      message: rateLimitMessage(parsedJson, text),
      retryAfterSeconds: diagnostics.retryAfterSeconds,
      resetAt: diagnostics.resetAt,
      failingStep: diagnostics.failingStep,
    };
  }
}

async function executeGmgnOpenApiRequest({
  failingStep,
  path,
  query,
  source,
}: {
  failingStep: string;
  path: string;
  query: Record<string, QueryValue>;
  source: string;
}) {
  const url = buildOpenApiUrl(path, query);
  const finalizeRequest = recordGmgnOpenApiAttempt({ path, url });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await runThroughGmgnQueue(path, async () => {
      const store = gmgnRequestStorage.getStore();
      if (store?.scanAbortedAfterRateLimit) {
        throw new Error("GMGN scan aborted after first rate limit.");
      }

      return fetch(url.toString(), {
        method: "GET",
        headers: gmgnOpenApiHeaders(),
        cache: "no-store",
        signal: controller.signal,
      });
    });
    const text = await response.text();
    const contentType = response.headers.get("content-type");
    const retryAfterHeader = response.headers.get("retry-after");
    let payload: unknown;
    let wasJson = true;

    try {
      payload = text.trim() ? JSON.parse(text) : null;
    } catch {
      wasJson = false;
      const errorCode = classifyOpenApiFailure({
        parsedJson: null,
        status: response.status,
        text,
        wasJson,
      });
      finalizeRequest?.({
        success: false,
        status: response.status,
        errorCode,
        failingStep,
      });
      logOpenApi429({
        response,
        text,
        url,
        failingStep,
      });
      const diagnostics = diagnosticsFor({
        contentType,
        errorCode,
        failingStep,
        parsedJson: null,
        retryAfterHeader,
        responseText: text,
        status: response.status,
        url,
      });
      markScanRateLimited({
        diagnostics,
        parsedJson: null,
        text,
      });
      logOpenApiFailure({
        diagnostics,
        path,
      });
      throw new GmgnOpenApiError(`${source} returned non-JSON from GMGN OpenAPI.`, diagnostics);
    }

    if (!response.ok) {
      const errorCode = classifyOpenApiFailure({
        parsedJson: payload,
        status: response.status,
        text,
        wasJson,
      });
      finalizeRequest?.({
        success: false,
        status: response.status,
        errorCode,
        failingStep,
      });
      logOpenApi429({
        response,
        text,
        url,
        failingStep,
      });
      const diagnostics = diagnosticsFor({
        contentType,
        errorCode,
        failingStep,
        parsedJson: payload,
        retryAfterHeader,
        responseText: text,
        status: response.status,
        url,
      });
      markScanRateLimited({
        diagnostics,
        parsedJson: payload,
        text,
      });
      logOpenApiFailure({
        diagnostics,
        path,
      });
      throw new GmgnOpenApiError(
        `${source} failed via GMGN OpenAPI HTTP ${response.status}.`,
        diagnostics
      );
    }

    if (
      payload &&
      typeof payload === "object" &&
      "code" in payload &&
      (payload as { code?: unknown }).code !== 0
    ) {
      const errorCode = classifyOpenApiFailure({
        parsedJson: payload,
        status: response.status,
        text,
        wasJson,
      });
      finalizeRequest?.({
        success: false,
        status: response.status,
        errorCode,
        failingStep,
      });
      const diagnostics = diagnosticsFor({
        contentType,
        errorCode,
        failingStep,
        parsedJson: payload,
        retryAfterHeader,
        responseText: text,
        status: response.status,
        url,
      });
      markScanRateLimited({
        diagnostics,
        parsedJson: payload,
        text,
      });
      logOpenApiFailure({
        diagnostics,
        path,
      });
      const error = (payload as { error?: unknown }).error;
      const message = (payload as { message?: unknown }).message;
      throw new GmgnOpenApiError(
        `${source} failed via GMGN OpenAPI: ${sanitize(String(error || message || "business error"))}`,
        diagnostics
      );
    }

    if (payload && typeof payload === "object" && "data" in payload) {
      finalizeRequest?.({
        success: true,
        status: response.status,
        errorCode: null,
        failingStep,
      });
      return (payload as { data?: unknown }).data;
    }

    finalizeRequest?.({
      success: true,
      status: response.status,
      errorCode: null,
      failingStep,
    });
    return payload;
  } catch (error) {
    if (error instanceof GmgnOpenApiError) throw error;

    if (error instanceof Error) {
      const store = gmgnRequestStorage.getStore();
      const abortedAfterRateLimit = store?.scanAbortedAfterRateLimit === true;
      finalizeRequest?.({
        success: false,
        status: null,
        errorCode: abortedAfterRateLimit ? "GMGN_OPENAPI_RATE_LIMIT" : "GMGN_OPENAPI_NETWORK",
        failingStep,
      });
      const diagnostics = diagnosticsFor({
        contentType: null,
        errorCode: abortedAfterRateLimit ? "GMGN_OPENAPI_RATE_LIMIT" : "GMGN_OPENAPI_NETWORK",
        failingStep,
        parsedJson: null,
        responseText: error.message,
        status: null,
        url,
      });
      logOpenApiFailure({
        diagnostics,
        path,
      });
      throw new GmgnOpenApiError(
        abortedAfterRateLimit
          ? `${source} stopped because GMGN rate limit was already reached in this scan.`
          : `${source} failed via GMGN OpenAPI network request.`,
        diagnostics
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchGmgnOpenApiJson({
  failingStep,
  path,
  query,
  source,
}: {
  failingStep: string;
  path: string;
  query: Record<string, QueryValue>;
  source: string;
}) {
  const store = gmgnRequestStorage.getStore();
  const cacheKey = openApiRequestCacheKey(path, query);

  if (store?.scanAbortedAfterRateLimit) {
    const url = buildOpenApiUrl(path, query);
    const diagnostics = diagnosticsFor({
      contentType: null,
      errorCode: "GMGN_OPENAPI_RATE_LIMIT",
      failingStep,
      parsedJson: null,
      responseText: "GMGN scan aborted after first rate limit.",
      status: null,
      url,
    });
    throw new GmgnOpenApiError(
      `${source} stopped because GMGN rate limit was already reached in this scan.`,
      diagnostics
    );
  }

  const existing = store?.requestCache.get(cacheKey);
  if (existing) {
    if (store) store.totalDedupedRequests += 1;
    return existing;
  }

  const requestPromise = executeGmgnOpenApiRequest({
    failingStep,
    path,
    query,
    source,
  });
  store?.requestCache.set(cacheKey, requestPromise);

  try {
    return await requestPromise;
  } catch (error) {
    store?.requestCache.delete(cacheKey);
    throw error;
  }
}

export async function probeGmgnOpenApiTokenInfo({
  address,
  chain,
}: {
  address: string;
  chain: string;
}) {
  const path = "/v1/token/info";
  const url = buildOpenApiUrl(path, { chain, address });
  const response = await fetch(url.toString(), {
    method: "GET",
    headers: gmgnOpenApiHeaders(),
    cache: "no-store",
  });
  const text = await response.text();
  const contentType = response.headers.get("content-type");
  let payload: unknown = null;
  let wasJson = true;

  try {
    payload = text.trim() ? JSON.parse(text) : null;
  } catch {
    wasJson = false;
  }

  const hasBusinessError =
    payload &&
    typeof payload === "object" &&
    "code" in payload &&
    (payload as { code?: unknown }).code !== 0;
  const errorCode =
    !response.ok || hasBusinessError || !wasJson
      ? classifyOpenApiFailure({
          parsedJson: payload,
          status: response.status,
          text,
          wasJson,
        })
      : null;

  const diagnostics = diagnosticsFor({
    contentType,
    errorCode,
    failingStep: "provider-test-gmgn-openapi",
    parsedJson: payload,
    responseText: text,
    status: response.status,
    url,
  });

  return {
    ...diagnostics,
    ok: response.ok && !hasBusinessError && wasJson,
  };
}
