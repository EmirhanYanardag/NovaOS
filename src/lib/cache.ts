type CacheValue<T> = {
  value: T;
  createdAt: number;
  expiresAt: number;
};

type CacheMetadata = {
  hit: boolean;
  ttlRemaining?: number;
  generatedAt: string;
  route?: string;
  inFlightDedupe?: boolean;
  expensiveProviderCall?: boolean;
  provider?: "moralis" | "internal" | "none";
};

type CacheKeyInput = {
  chain?: string | null;
  tokenAddress?: string | null;
  route: string;
  extra?: Record<string, string | number | boolean | null | undefined>;
};

type TokenAnalysisCacheKeyInput = {
  route: string;
  chain?: string | null;
  tokenAddress?: string | null;
  pairAddress?: string | null;
  walletAddress?: string | null;
  tokenSymbol?: string | null;
  mode?: string | null;
  limit?: string | number | null;
  deepLimit?: string | number | null;
  personalityLimit?: string | number | null;
  extra?: Record<string, string | number | boolean | null | undefined>;
};

type GlobalCacheStore = {
  values: Map<string, CacheValue<unknown>>;
  pending: Map<string, Promise<CacheValue<unknown>>>;
  metrics: CacheStats;
};

type RouteCacheStats = {
  route: string;
  hits: number;
  misses: number;
  sets: number;
  inFlightDedupes: number;
  estimatedProviderCalls: number;
  hitRate: number;
};

type CacheStats = {
  totalGets: number;
  totalHits: number;
  totalMisses: number;
  totalSets: number;
  totalDeletes: number;
  inFlightDedupes: number;
  entriesCount: number;
  expiredClears: number;
  routes: Record<string, RouteCacheStats>;
  recentExpensiveMisses: Array<{
    key: string;
    route: string;
    provider: "moralis";
    createdAt: string;
  }>;
};

const globalCache = globalThis as typeof globalThis & {
  __novaosCacheStore?: GlobalCacheStore;
};

function createEmptyStats(): CacheStats {
  return {
    totalGets: 0,
    totalHits: 0,
    totalMisses: 0,
    totalSets: 0,
    totalDeletes: 0,
    inFlightDedupes: 0,
    entriesCount: 0,
    expiredClears: 0,
    routes: {},
    recentExpensiveMisses: [],
  };
}

const cacheStore =
  globalCache.__novaosCacheStore ||
  (globalCache.__novaosCacheStore = {
    values: new Map<string, CacheValue<unknown>>(),
    pending: new Map<string, Promise<CacheValue<unknown>>>(),
    metrics: createEmptyStats(),
  });

function ensureCacheStatsShape() {
  const metrics = cacheStore.metrics;

  metrics.routes ||= {};
  metrics.recentExpensiveMisses ||= [];

  Object.values(metrics.routes).forEach((stats) => {
    stats.inFlightDedupes ||= 0;
    stats.estimatedProviderCalls ||= 0;
    stats.hitRate ||= 0;
  });
}

function now() {
  return Date.now();
}

function normalizePart(value: string | number | boolean | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeUpperPart(value: string | number | boolean | null | undefined) {
  return String(value ?? "").trim().toUpperCase();
}

function normalizeLimit(
  value: string | number | null | undefined,
  fallback: number
) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return String(fallback);
  return String(Math.max(1, Math.floor(parsed)));
}

function routeFromKey(key: string) {
  return key.split(":")[1] || "unknown";
}

function getRouteStats(route: string) {
  ensureCacheStatsShape();

  const existing = cacheStore.metrics.routes[route];
  if (existing) return existing;

  const nextStats = {
    route,
    hits: 0,
    misses: 0,
    sets: 0,
    inFlightDedupes: 0,
    estimatedProviderCalls: 0,
    hitRate: 0,
  };
  cacheStore.metrics.routes[route] = nextStats;
  return nextStats;
}

function recordHit(key: string) {
  cacheStore.metrics.totalHits += 1;
  getRouteStats(routeFromKey(key)).hits += 1;
}

function recordMiss(key: string) {
  cacheStore.metrics.totalMisses += 1;
  getRouteStats(routeFromKey(key)).misses += 1;
}

function recordInFlightDedupe(key: string) {
  const routeStats = getRouteStats(routeFromKey(key));
  cacheStore.metrics.inFlightDedupes += 1;
  routeStats.inFlightDedupes += 1;
}

function recordExpensiveMiss(key: string, provider?: "moralis" | "internal" | "none") {
  if (provider !== "moralis") return;

  ensureCacheStatsShape();

  const route = routeFromKey(key);
  getRouteStats(route).estimatedProviderCalls += 1;
  cacheStore.metrics.recentExpensiveMisses.unshift({
    key: sanitizeCacheKey(key),
    route,
    provider,
    createdAt: new Date().toISOString(),
  });
  cacheStore.metrics.recentExpensiveMisses =
    cacheStore.metrics.recentExpensiveMisses.slice(0, 25);
}

function recordSet(key: string) {
  cacheStore.metrics.totalSets += 1;
  getRouteStats(routeFromKey(key)).sets += 1;
  cacheStore.metrics.entriesCount = cacheStore.values.size;
}

function sanitizeCacheKey(key: string) {
  return key
    .split(":")
    .map((part) => {
      if (/^0x[a-f0-9]{40}$/i.test(part)) {
        return `${part.slice(0, 6)}...${part.slice(-4)}`;
      }
      return part;
    })
    .join(":");
}

export function clearExpiredCache() {
  ensureCacheStatsShape();

  const currentTime = now();
  let cleared = 0;

  for (const [key, entry] of cacheStore.values.entries()) {
    if (entry.expiresAt <= currentTime) {
      cacheStore.values.delete(key);
      cleared += 1;
    }
  }

  if (cleared > 0) {
    cacheStore.metrics.expiredClears += cleared;
    cacheStore.metrics.entriesCount = cacheStore.values.size;
  }
}

export function getCache<T>(key: string): CacheValue<T> | null {
  ensureCacheStatsShape();
  clearExpiredCache();
  cacheStore.metrics.totalGets += 1;

  const entry = cacheStore.values.get(key);
  if (!entry) {
    recordMiss(key);
    return null;
  }

  recordHit(key);
  return entry as CacheValue<T>;
}

export function setCache<T>(key: string, value: T, ttlSeconds: number) {
  ensureCacheStatsShape();

  const createdAt = now();
  const entry: CacheValue<T> = {
    value,
    createdAt,
    expiresAt: createdAt + ttlSeconds * 1000,
  };

  cacheStore.values.set(key, entry);
  recordSet(key);
  return entry;
}

export function deleteCache(key: string) {
  ensureCacheStatsShape();

  cacheStore.values.delete(key);
  cacheStore.pending.delete(key);
  cacheStore.metrics.totalDeletes += 1;
  cacheStore.metrics.entriesCount = cacheStore.values.size;
}

export function createCacheKey({
  chain,
  extra,
  route,
  tokenAddress,
}: CacheKeyInput) {
  const extraKey = Object.entries(extra || {})
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${normalizePart(key)}=${normalizePart(value)}`)
    .join("&");

  return [
    "novaos",
    normalizePart(route),
    normalizePart(chain),
    normalizePart(tokenAddress),
    extraKey,
  ].join(":");
}

export function createTokenAnalysisCacheKey({
  chain,
  deepLimit,
  extra,
  limit,
  mode,
  pairAddress,
  personalityLimit,
  route,
  tokenAddress,
  tokenSymbol,
  walletAddress,
}: TokenAnalysisCacheKeyInput) {
  return createCacheKey({
    route,
    chain: normalizePart(chain),
    tokenAddress: normalizePart(tokenAddress),
    extra: {
      pairAddress: normalizePart(pairAddress),
      walletAddress: normalizePart(walletAddress),
      tokenSymbol: normalizeUpperPart(tokenSymbol),
      mode: normalizePart(mode || "standard"),
      limit: normalizeLimit(limit, 10),
      deepLimit: normalizeLimit(deepLimit, 3),
      personalityLimit: normalizeLimit(personalityLimit, 5),
      ...extra,
    },
  });
}

export function getCacheMetadata<T>(
  entry: CacheValue<T>,
  hit: boolean,
  options: {
    expensiveProviderCall?: boolean;
    inFlightDedupe?: boolean;
    provider?: "moralis" | "internal" | "none";
    route?: string;
  } = {}
): CacheMetadata {
  const ttlRemaining = Math.max(0, Math.ceil((entry.expiresAt - now()) / 1000));

  return {
    hit,
    ttlRemaining,
    generatedAt: new Date(entry.createdAt).toISOString(),
    ...options,
  };
}

export function cacheAgeWarning(ttlSeconds: number) {
  const minutes = Math.max(1, Math.ceil(ttlSeconds / 60));
  return `Data may be up to ${minutes} minutes old.`;
}

export async function getOrSetCache<T>(
  key: string,
  ttlSeconds: number,
  producer: () => Promise<T>,
  options: {
    provider?: "moralis" | "internal" | "none";
    route?: string;
  } = {}
): Promise<{ value: T; cache: CacheMetadata }> {
  const cached = getCache<T>(key);

  if (cached) {
    return {
      value: cached.value,
      cache: getCacheMetadata(cached, true, {
        expensiveProviderCall: false,
        provider: options.provider,
        route: options.route || routeFromKey(key),
      }),
    };
  }

  const pending = cacheStore.pending.get(key) as
    | Promise<CacheValue<T>>
    | undefined;

  if (pending) {
    recordInFlightDedupe(key);
    const entry = await pending;
    return {
      value: entry.value,
      cache: getCacheMetadata(entry, true, {
        expensiveProviderCall: false,
        inFlightDedupe: true,
        provider: options.provider,
        route: options.route || routeFromKey(key),
      }),
    };
  }

  recordExpensiveMiss(key, options.provider);

  const pendingEntry = producer()
    .then((value) => setCache(key, value, ttlSeconds))
    .finally(() => {
      cacheStore.pending.delete(key);
    });

  cacheStore.pending.set(key, pendingEntry as Promise<CacheValue<unknown>>);

  const entry = await pendingEntry;
  return {
    value: entry.value,
    cache: getCacheMetadata(entry, false, {
      expensiveProviderCall: options.provider === "moralis",
      provider: options.provider,
      route: options.route || routeFromKey(key),
    }),
  };
}

export function getCacheStats(): CacheStats {
  ensureCacheStatsShape();
  clearExpiredCache();

  return {
    ...cacheStore.metrics,
    entriesCount: cacheStore.values.size,
    routes: Object.fromEntries(
      Object.entries(cacheStore.metrics.routes).map(([route, stats]) => [
        route,
        {
          ...stats,
          hitRate:
            stats.hits + stats.misses > 0
              ? Math.round((stats.hits / (stats.hits + stats.misses)) * 100)
              : 0,
        },
      ])
    ),
    recentExpensiveMisses: [...cacheStore.metrics.recentExpensiveMisses],
  };
}

export function resetCacheStats() {
  cacheStore.metrics = createEmptyStats();
  cacheStore.metrics.entriesCount = cacheStore.values.size;
}

export function getCacheEntriesPreview() {
  ensureCacheStatsShape();
  clearExpiredCache();

  return [...cacheStore.values.entries()]
    .slice(0, 50)
    .map(([key, entry]) => ({
      key: sanitizeCacheKey(key),
      route: routeFromKey(key),
      createdAt: new Date(entry.createdAt).toISOString(),
      expiresAt: new Date(entry.expiresAt).toISOString(),
      ttlRemaining: Math.max(0, Math.ceil((entry.expiresAt - now()) / 1000)),
    }));
}

export type { CacheMetadata, CacheStats };
