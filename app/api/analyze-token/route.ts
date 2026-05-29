import { NextResponse } from "next/server";
import {
  cacheAgeWarning,
  createCacheKey,
  getOrSetCache,
  type CacheMetadata,
} from "../../../lib/cache";

type AnalyzeMode = "fast" | "standard" | "deep";
type ModuleStatus = "loaded" | "failed" | "skipped";

type ModuleResult = {
  status: ModuleStatus;
  cache?: CacheMetadata;
  message?: string;
};

type AnalyzeTokenResponse = {
  chain: string;
  tokenAddress: string;
  tokenSymbol: string | null;
  mode: AnalyzeMode;
  generatedAt: string;
  holders: unknown | null;
  walletProfiles: unknown | null;
  clusters: unknown | null;
  tokenIntelligence: unknown | null;
  conviction: unknown | null;
  walletPersonalities: unknown | null;
  warnings: string[];
  modules: {
    holders: ModuleResult;
    walletProfiles: ModuleResult;
    clusters: ModuleResult;
    tokenIntelligence: ModuleResult;
    conviction: ModuleResult;
    walletPersonalities: ModuleResult;
  };
  cache?: CacheMetadata;
};

type ApiErrorCode =
  | "MISSING_CHAIN"
  | "MISSING_TOKEN_ADDRESS"
  | "INVALID_TOKEN_ADDRESS"
  | "INVALID_MODE"
  | "INVALID_LIMIT"
  | "HOLDER_DATA_FAILED"
  | "ANALYZE_TOKEN_FAILED";

const ANALYZE_TOKEN_CACHE_TTL_SECONDS = 180;

function structuredError({
  code,
  details,
  message,
  status,
}: {
  code: ApiErrorCode;
  details?: unknown;
  message: string;
  status: number;
}) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        details: details ?? null,
      },
    },
    { status }
  );
}

function isEvmAddress(address: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function parseMode(value: string | null): AnalyzeMode | null {
  if (!value) return "standard";
  if (value === "fast" || value === "standard" || value === "deep") return value;
  return null;
}

function parseLimit({
  fallback,
  max,
  value,
}: {
  fallback: number;
  max: number;
  value: string | null;
}) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(max, Math.max(1, Math.floor(parsed)));
}

function getCacheMetadataFromBody(value: unknown): CacheMetadata | undefined {
  if (!value || typeof value !== "object") return undefined;
  const cache = (value as { cache?: unknown }).cache;
  if (!cache || typeof cache !== "object") return undefined;
  return cache as CacheMetadata;
}

async function fetchModule<T>(
  url: string
): Promise<
  | { ok: true; data: T; cache?: CacheMetadata }
  | { ok: false; message: string }
> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    const data = (await response.json()) as T & { error?: unknown };

    if (!response.ok || data?.error) {
      return { ok: false, message: "Module request failed." };
    }

    return {
      ok: true,
      data,
      cache: getCacheMetadataFromBody(data),
    };
  } catch {
    return { ok: false, message: "Module request failed." };
  }
}

function marketParamsFromSearch(searchParams: URLSearchParams) {
  const params: Record<string, string> = {};

  [
    "marketCapUsd",
    "liquidityUsd",
    "volume24hUsd",
    "priceChange24h",
    "volumeChange24h",
  ].forEach((key) => {
    const value = searchParams.get(key);
    if (value) params[key] = value;
  });

  return params;
}

function appendParams(url: URL, params: Record<string, string | number | boolean | null>) {
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const { searchParams } = requestUrl;
  const chain = searchParams.get("chain")?.trim();
  const tokenAddress = searchParams.get("tokenAddress")?.trim();
  const tokenSymbol = searchParams.get("tokenSymbol")?.trim() || null;
  const mode = parseMode(searchParams.get("mode"));
  const limit = parseLimit({
    value: searchParams.get("limit"),
    fallback: 10,
    max: 25,
  });
  const deepLimit = parseLimit({
    value: searchParams.get("deepLimit"),
    fallback: 5,
    max: 10,
  });
  const personalityLimit = parseLimit({
    value: searchParams.get("personalityLimit"),
    fallback: 5,
    max: 10,
  });
  const marketParams = marketParamsFromSearch(searchParams);

  if (!chain) {
    return structuredError({
      code: "MISSING_CHAIN",
      message: "chain is required.",
      status: 400,
    });
  }

  if (!tokenAddress) {
    return structuredError({
      code: "MISSING_TOKEN_ADDRESS",
      message: "tokenAddress is required.",
      status: 400,
    });
  }

  if (!isEvmAddress(tokenAddress)) {
    return structuredError({
      code: "INVALID_TOKEN_ADDRESS",
      message: "tokenAddress must be a valid EVM address.",
      details: { tokenAddress },
      status: 400,
    });
  }

  if (!mode) {
    return structuredError({
      code: "INVALID_MODE",
      message: 'mode must be "fast", "standard" or "deep".',
      details: { mode: searchParams.get("mode") },
      status: 400,
    });
  }

  if (limit === null || deepLimit === null || personalityLimit === null) {
    return structuredError({
      code: "INVALID_LIMIT",
      message: "limit, deepLimit and personalityLimit must be valid numbers.",
      details: {
        limit: searchParams.get("limit"),
        deepLimit: searchParams.get("deepLimit"),
        personalityLimit: searchParams.get("personalityLimit"),
      },
      status: 400,
    });
  }

  const cacheKey = createCacheKey({
    route: "analyze-token",
    chain,
    tokenAddress,
    extra: {
      mode,
      tokenSymbol,
      pairAddress: searchParams.get("pairAddress"),
      limit,
      deepLimit: mode === "deep" ? deepLimit : undefined,
      personalityLimit: mode === "fast" ? undefined : personalityLimit,
      ...marketParams,
    },
  });

  try {
    const cachedResult = await getOrSetCache<AnalyzeTokenResponse>(
      cacheKey,
      ANALYZE_TOKEN_CACHE_TTL_SECONDS,
      async () => {
        const origin = requestUrl.origin;
        const warnings = [
          "Unified token analysis is a bundled API foundation and does not calculate PnL, win rate, smart money identity or price prediction.",
        ];
        const modules: AnalyzeTokenResponse["modules"] = {
          holders: { status: "skipped" },
          walletProfiles: { status: "skipped" },
          clusters: { status: "skipped" },
          tokenIntelligence: { status: "skipped" },
          conviction: { status: "skipped" },
          walletPersonalities: { status: "skipped" },
        };
        const baseParams = {
          chain,
          tokenAddress,
        };
        const holdersUrl = new URL("/api/holders", origin);
        appendParams(holdersUrl, baseParams);
        const holdersResult = await fetchModule<unknown>(holdersUrl.toString());

        if (!holdersResult.ok) {
          throw new Error("HOLDER_DATA_FAILED");
        }

        modules.holders = {
          status: "loaded",
          cache: holdersResult.cache,
        };

        if (mode === "fast") {
          return {
            chain,
            tokenAddress,
            tokenSymbol,
            mode,
            generatedAt: new Date().toISOString(),
            holders: holdersResult.data,
            walletProfiles: null,
            clusters: null,
            tokenIntelligence: null,
            conviction: null,
            walletPersonalities: null,
            warnings,
            modules,
          };
        }

        const walletProfilesUrl = new URL("/api/wallet-profiles", origin);
        appendParams(walletProfilesUrl, { ...baseParams, limit: Math.min(limit, 10) });

        const clustersUrl = new URL("/api/wallet-clusters", origin);
        appendParams(clustersUrl, { ...baseParams, limit });

        const tokenIntelligenceUrl = new URL("/api/token-intelligence", origin);
        appendParams(tokenIntelligenceUrl, { ...baseParams, limit: Math.min(limit, 20) });

        const convictionUrl = new URL("/api/conviction-engine", origin);
        appendParams(convictionUrl, {
          ...baseParams,
          tokenSymbol,
          limit,
          deep: mode === "deep",
          deepLimit: mode === "deep" ? deepLimit : null,
          ...marketParams,
        });

        const personalitiesUrl = new URL("/api/wallet-personalities", origin);
        appendParams(personalitiesUrl, {
          ...baseParams,
          limit: personalityLimit,
        });

        const [
          walletProfilesSettled,
          clustersSettled,
          tokenIntelligenceSettled,
          convictionSettled,
          personalitiesSettled,
        ] =
          await Promise.allSettled([
            fetchModule<unknown>(walletProfilesUrl.toString()),
            fetchModule<unknown>(clustersUrl.toString()),
            fetchModule<unknown>(tokenIntelligenceUrl.toString()),
            fetchModule<unknown>(convictionUrl.toString()),
            fetchModule<unknown>(personalitiesUrl.toString()),
          ]);

        const extractModule = (
          settled: PromiseSettledResult<
            | { ok: true; data: unknown; cache?: CacheMetadata }
            | { ok: false; message: string }
          >,
          moduleName: keyof AnalyzeTokenResponse["modules"]
        ) => {
          if (settled.status === "fulfilled" && settled.value.ok) {
            modules[moduleName] = {
              status: "loaded",
              cache: settled.value.cache,
            };
            return settled.value.data;
          }

          modules[moduleName] = {
            status: "failed",
            message: `${moduleName} module unavailable.`,
          };
          warnings.push(`${moduleName} module unavailable in unified analysis.`);
          return null;
        };

        return {
          chain,
          tokenAddress,
          tokenSymbol,
          mode,
          generatedAt: new Date().toISOString(),
          holders: holdersResult.data,
          walletProfiles: extractModule(walletProfilesSettled, "walletProfiles"),
          clusters: extractModule(clustersSettled, "clusters"),
          tokenIntelligence: extractModule(
            tokenIntelligenceSettled,
            "tokenIntelligence"
          ),
          conviction: extractModule(convictionSettled, "conviction"),
          walletPersonalities: extractModule(
            personalitiesSettled,
            "walletPersonalities"
          ),
          warnings,
          modules,
        };
      }
    );

    return NextResponse.json({
      ...cachedResult.value,
      warnings: [
        ...cachedResult.value.warnings,
        cacheAgeWarning(ANALYZE_TOKEN_CACHE_TTL_SECONDS),
      ],
      cache: cachedResult.cache,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "HOLDER_DATA_FAILED") {
      return structuredError({
        code: "HOLDER_DATA_FAILED",
        message: "Holder data is required before unified analysis can run.",
        status: 502,
      });
    }

    return structuredError({
      code: "ANALYZE_TOKEN_FAILED",
      message: "Unified token analysis failed unexpectedly.",
      status: 500,
    });
  }
}
