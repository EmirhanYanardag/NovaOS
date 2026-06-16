import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

type QueryValue = string | number | boolean | Array<string | number | boolean> | undefined | null;

const DEFAULT_GMGN_OPENAPI_BASE = "https://openapi.gmgn.ai";

type GmgnEndpointKind =
  | "topHoldersRequests"
  | "walletActivityRequests"
  | "walletStatsRequests"
  | "tokenInfoRequests"
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
    smartMoneyRequests: 0,
    otherGmgnRequests: 0,
    endpointCounts: {},
    uniqueWallets: new Set<string>(),
    firstFailure: null,
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
      smartMoneyRequests: 0,
      otherGmgnRequests: 0,
      endpointCounts: {},
      uniqueWalletCount: 0,
      requestsPerHolderAverage: 0,
      firstFailure: null,
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
    smartMoneyRequests: store.smartMoneyRequests,
    otherGmgnRequests: store.otherGmgnRequests,
    endpointCounts: { ...store.endpointCounts },
    uniqueWalletCount,
    requestsPerHolderAverage: uniqueWalletCount > 0
      ? Number((store.totalRequests / uniqueWalletCount).toFixed(2))
      : 0,
    firstFailure: store.firstFailure,
  };
}

function endpointKind(path: string): GmgnEndpointKind {
  if (path === "/v1/market/token_top_holders") return "topHoldersRequests";
  if (path === "/v1/user/wallet_activity") return "walletActivityRequests";
  if (path === "/v1/user/wallet_stats") return "walletStatsRequests";
  if (path === "/v1/token/info") return "tokenInfoRequests";
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
      ? (parsedJson as { error?: unknown; message?: unknown })
      : null;
  const combined = [
    text,
    String(jsonRecord?.error ?? ""),
    String(jsonRecord?.message ?? ""),
  ].join(" ");

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
  responseText,
  status,
  url,
}: {
  contentType: string | null;
  errorCode: GmgnOpenApiErrorCode | null;
  failingStep: string;
  parsedJson: unknown;
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
  const url = buildOpenApiUrl(path, query);
  const finalizeRequest = recordGmgnOpenApiAttempt({ path, url });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: gmgnOpenApiHeaders(),
      cache: "no-store",
      signal: controller.signal,
    });
    const text = await response.text();
    const contentType = response.headers.get("content-type");
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
        responseText: text,
        status: response.status,
        url,
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
        responseText: text,
        status: response.status,
        url,
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
        responseText: text,
        status: response.status,
        url,
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
      finalizeRequest?.({
        success: false,
        status: null,
        errorCode: "GMGN_OPENAPI_NETWORK",
        failingStep,
      });
      const diagnostics = diagnosticsFor({
        contentType: null,
        errorCode: "GMGN_OPENAPI_NETWORK",
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
      throw new GmgnOpenApiError(`${source} failed via GMGN OpenAPI network request.`, diagnostics);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
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
