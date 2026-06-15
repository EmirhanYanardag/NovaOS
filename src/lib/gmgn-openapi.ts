import { randomUUID } from "node:crypto";

type QueryValue = string | number | boolean | Array<string | number | boolean> | undefined | null;

const DEFAULT_GMGN_OPENAPI_BASE = "https://openapi.gmgn.ai";

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

function logOpenApiFailure({
  contentType,
  failingStep,
  path,
  responseText,
  status,
  url,
}: {
  contentType: string | null;
  failingStep: string;
  path: string;
  responseText: string;
  status: number | null;
  url: URL;
}) {
  console.warn("[GMGN OpenAPI]", {
    baseUsed: url.origin,
    endpointPath: `${url.pathname}${url.search}`,
    method: "GET",
    path,
    status,
    contentType,
    responsePreview: sanitize(responseText).slice(0, 300),
    hasGMGNKey: Boolean(process.env.GMGN_API_KEY),
    requestHeaders: {
      accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
      hasXApiKey: Boolean(process.env.GMGN_API_KEY),
    },
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

    try {
      payload = text.trim() ? JSON.parse(text) : null;
    } catch {
      logOpenApiFailure({
        contentType,
        failingStep,
        path,
        responseText: text,
        status: response.status,
        url,
      });
      throw new Error(`${source} returned non-JSON from GMGN OpenAPI.`);
    }

    if (!response.ok) {
      logOpenApiFailure({
        contentType,
        failingStep,
        path,
        responseText: text,
        status: response.status,
        url,
      });
      throw new Error(`${source} failed via GMGN OpenAPI HTTP ${response.status}.`);
    }

    if (
      payload &&
      typeof payload === "object" &&
      "code" in payload &&
      (payload as { code?: unknown }).code !== 0
    ) {
      logOpenApiFailure({
        contentType,
        failingStep,
        path,
        responseText: text,
        status: response.status,
        url,
      });
      const error = (payload as { error?: unknown }).error;
      const message = (payload as { message?: unknown }).message;
      throw new Error(
        `${source} failed via GMGN OpenAPI: ${sanitize(String(error || message || "business error"))}`
      );
    }

    if (payload && typeof payload === "object" && "data" in payload) {
      return (payload as { data?: unknown }).data;
    }

    return payload;
  } catch (error) {
    if (error instanceof Error && !error.message.includes("GMGN OpenAPI")) {
      logOpenApiFailure({
        contentType: null,
        failingStep,
        path,
        responseText: error.message,
        status: null,
        url,
      });
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
