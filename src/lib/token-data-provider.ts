import type {
  TokenHolderSnapshot,
  WalletHolding,
  WalletProfile,
  WalletTrade,
} from "@/lib/novaos-data-layer";
import { buildWalletProfileV1 } from "@/lib/novaos-data-layer";
import {
  normalizeGmgnActivityResponse,
  normalizeGmgnTopHoldersResponse,
  runGmgnTopHolders,
  runGmgnWalletActivity,
} from "@/lib/gmgn";
import { fetchGmgnWalletActivityPaginated } from "@/lib/gmgn-wallet-activity";
import type { GmgnWalletHistoryMode } from "@/lib/gmgn-wallet-activity";
import {
  buildGmgnTop100DeepSnapshot,
  normalizeGmgnActivityToWalletTrade,
  toTokenHolderSnapshot,
  type GmgnTop100DeepSnapshot,
} from "@/lib/gmgn-top100-snapshot";

export type TokenDataProviderName = "moralis" | "gmgn";

export type TokenDataProviderReplacementStatus =
  | "legacy"
  | "candidate"
  | "partial"
  | "planned";

export type TokenDataProviderRequest = {
  chain: string;
  tokenAddress: string;
  walletAddress?: string;
  limit?: number;
  cursor?: string;
};

export type Top100DeepSnapshotRequest = TokenDataProviderRequest & {
  activityLimit?: number;
  concurrency?: number;
  includeRaw?: boolean;
  debug?: boolean;
  deepHistory?: boolean;
  historyMode?: GmgnWalletHistoryMode;
  walletMaxPages?: number;
  hardMaxPages?: number;
  walletMaxActivities?: number;
};

export type WalletActivityProviderOptions = {
  limit?: number;
  cursor?: string;
  paginate?: boolean;
  historyMode?: GmgnWalletHistoryMode;
  maxPages?: number;
  hardMaxPages?: number;
  maxActivities?: number;
};

export type TokenDataProviderResult<T> = {
  provider: TokenDataProviderName;
  status: "ok" | "partial" | "unavailable";
  data: T;
  warnings: string[];
};

export interface TokenDataProvider {
  name: TokenDataProviderName;
  status: TokenDataProviderReplacementStatus;
  getTokenHolders(
    request: TokenDataProviderRequest
  ): Promise<TokenDataProviderResult<TokenHolderSnapshot[]>>;
  getWalletTrades(
    request: TokenDataProviderRequest & { walletAddress: string }
  ): Promise<TokenDataProviderResult<WalletTrade[]>>;
  getWalletProfile(
    request: TokenDataProviderRequest & { walletAddress: string }
  ): Promise<TokenDataProviderResult<WalletProfile>>;
  getWalletHoldings(
    request: TokenDataProviderRequest & { walletAddress: string }
  ): Promise<TokenDataProviderResult<WalletHolding[]>>;
}

export interface MoralisProvider extends TokenDataProvider {
  name: "moralis";
  status: "legacy";
}

export interface GMGNProvider extends TokenDataProvider {
  name: "gmgn";
  status: "candidate" | "partial" | "planned";
  getTopHolders(
    chain: string,
    tokenAddress: string,
    limit?: number
  ): Promise<TokenDataProviderResult<TokenHolderSnapshot[]>>;
  getWalletActivity(
    chain: string,
    wallet: string,
    options?: WalletActivityProviderOptions
  ): Promise<TokenDataProviderResult<WalletTrade[]>>;
  getTop100DeepSnapshot(
    chain: string,
    tokenAddress: string,
    options?: Omit<Top100DeepSnapshotRequest, "chain" | "tokenAddress">
  ): Promise<TokenDataProviderResult<GmgnTop100DeepSnapshot>>;
}

const DEFAULT_LIMIT = 100;
const DEFAULT_CONCURRENCY = 3;
const MAX_LIMIT = 100;
const MAX_CONCURRENCY = 5;
const DEFAULT_FULL_CONCURRENCY = 2;
const MAX_FULL_CONCURRENCY = 3;
const DEFAULT_WALLET_MAX_PAGES = 3;
const MAX_WALLET_MAX_PAGES = 10;
const DEFAULT_WALLET_MAX_ACTIVITIES = 200;
const MAX_WALLET_MAX_ACTIVITIES = 500;
const DEFAULT_FULL_HARD_MAX_PAGES = 50;
const MAX_FULL_HARD_MAX_PAGES = 100;
const DEFAULT_FULL_MAX_ACTIVITIES = 2000;
const MAX_FULL_MAX_ACTIVITIES = 5000;

function capLimit(value?: number) {
  if (!value) return DEFAULT_LIMIT;
  if (!Number.isInteger(value) || value < 1) return DEFAULT_LIMIT;
  return Math.min(value, MAX_LIMIT);
}

function capConcurrency(value?: number) {
  if (!value) return DEFAULT_CONCURRENCY;
  if (!Number.isInteger(value) || value < 1) return DEFAULT_CONCURRENCY;
  return Math.min(value, MAX_CONCURRENCY);
}

function capSnapshotConcurrency(value: number | undefined, historyMode: GmgnWalletHistoryMode) {
  if (historyMode === "full") {
    if (!value) return DEFAULT_FULL_CONCURRENCY;
    if (!Number.isInteger(value) || value < 1) return DEFAULT_FULL_CONCURRENCY;
    return Math.min(value, MAX_FULL_CONCURRENCY);
  }

  return capConcurrency(value);
}

function capMaxPages(value?: number) {
  if (!value) return DEFAULT_WALLET_MAX_PAGES;
  if (!Number.isInteger(value) || value < 1) return DEFAULT_WALLET_MAX_PAGES;
  return Math.min(value, MAX_WALLET_MAX_PAGES);
}

function capMaxActivities(value?: number) {
  if (!value) return DEFAULT_WALLET_MAX_ACTIVITIES;
  if (!Number.isInteger(value) || value < 1) return DEFAULT_WALLET_MAX_ACTIVITIES;
  return Math.min(value, MAX_WALLET_MAX_ACTIVITIES);
}

function capFullMaxPages(value?: number) {
  if (!value) return DEFAULT_FULL_HARD_MAX_PAGES;
  if (!Number.isInteger(value) || value < 1) return DEFAULT_FULL_HARD_MAX_PAGES;
  return Math.min(value, MAX_FULL_HARD_MAX_PAGES);
}

function capFullMaxActivities(value?: number) {
  if (!value) return DEFAULT_FULL_MAX_ACTIVITIES;
  if (!Number.isInteger(value) || value < 1) return DEFAULT_FULL_MAX_ACTIVITIES;
  return Math.min(value, MAX_FULL_MAX_ACTIVITIES);
}

function resolveHistoryMode(options: {
  paginate?: boolean;
  deepHistory?: boolean;
  historyMode?: GmgnWalletHistoryMode;
}) {
  return options.historyMode || (options.paginate || options.deepHistory ? "bounded" : "firstPage");
}

function unavailable<T>(provider: TokenDataProviderName, data: T, warning: string) {
  return {
    provider,
    status: "unavailable" as const,
    data,
    warnings: [warning],
  };
}

// Moralis remains the legacy fallback contract until every production route has
// a verified GMGN compatibility layer. This object intentionally performs no work.
export const MoralisProviderLegacy: MoralisProvider = {
  name: "moralis",
  status: "legacy",
  async getTokenHolders() {
    return unavailable("moralis", [], "MoralisProvider is legacy scaffolding only.");
  },
  async getWalletTrades() {
    return unavailable("moralis", [], "MoralisProvider is legacy scaffolding only.");
  },
  async getWalletProfile({ walletAddress }) {
    return unavailable(
      "moralis",
      buildWalletProfileV1({ wallet: walletAddress, trades: [] }),
      "MoralisProvider is legacy scaffolding only."
    );
  },
  async getWalletHoldings() {
    return unavailable("moralis", [], "MoralisProvider is legacy scaffolding only.");
  },
};

// GMGN is now the intended primary provider for new NovaOS wallet intelligence
// data paths. It is not connected to production terminal flow until migration
// parity with the legacy Moralis-backed routes is proven.
export const GMGNProviderPrimary: GMGNProvider = {
  name: "gmgn",
  status: "candidate",
  async getTopHolders(chain, tokenAddress, limit = DEFAULT_LIMIT) {
    const cappedLimit = capLimit(limit);
    const raw = await runGmgnTopHolders({
      chain,
      address: tokenAddress,
      limit: cappedLimit,
      orderBy: "amount_percentage",
      direction: "desc",
    });
    const normalized = normalizeGmgnTopHoldersResponse(raw, cappedLimit);

    return {
      provider: "gmgn",
      status: "ok",
      data: normalized.holders.map((holder, index) =>
        toTokenHolderSnapshot({
          holder,
          chain,
          tokenAddress,
          holderRank: index + 1,
        })
      ),
      warnings: [],
    };
  },
  async getWalletActivity(chain, wallet, options = {}) {
    const cappedLimit = capLimit(options.limit);
    const historyMode = resolveHistoryMode(options);
    const normalized = historyMode !== "firstPage"
      ? await fetchGmgnWalletActivityPaginated({
          chain,
          wallet,
          limitPerPage: cappedLimit,
          historyMode,
          maxPages: capMaxPages(options.maxPages),
          hardMaxPages: capFullMaxPages(options.hardMaxPages),
          maxActivities:
            historyMode === "full"
              ? capFullMaxActivities(options.maxActivities)
              : capMaxActivities(options.maxActivities),
        })
      : normalizeGmgnActivityResponse(
          await runGmgnWalletActivity({
            chain,
            wallet,
            limit: cappedLimit,
            cursor: options.cursor,
          })
        );

    return {
      provider: "gmgn",
      status: normalized.next ? "partial" : "ok",
      data: normalized.activities.map((activity) =>
        normalizeGmgnActivityToWalletTrade({ activity, wallet, chain })
      ),
      warnings: normalized.next
        ? [
            historyMode !== "firstPage"
              ? "GMGN still returned a next cursor after paginated activity fetching; history is capped."
              : "GMGN returned a next cursor; this response contains the first page only.",
          ]
        : [],
    };
  },
  async getTop100DeepSnapshot(chain, tokenAddress, options = {}) {
    const historyMode = resolveHistoryMode(options);
    const snapshot = await buildGmgnTop100DeepSnapshot({
      chain,
      address: tokenAddress,
      holderLimit: capLimit(options.limit),
      activityLimit: capLimit(options.activityLimit),
      concurrency: capSnapshotConcurrency(options.concurrency, historyMode),
      includeRaw: Boolean(options.includeRaw),
      debug: Boolean(options.debug),
      deepHistory: Boolean(options.deepHistory),
      historyMode,
      walletMaxPages: capMaxPages(options.walletMaxPages),
      hardMaxPages: capFullMaxPages(options.hardMaxPages),
      walletMaxActivities:
        historyMode === "full"
          ? capFullMaxActivities(options.walletMaxActivities)
          : capMaxActivities(options.walletMaxActivities),
    });

    return {
      provider: "gmgn",
      status: snapshot.holdersFailed > 0 ? "partial" : "ok",
      data: snapshot,
      warnings:
        snapshot.holdersFailed > 0
          ? [`${snapshot.holdersFailed} holder activity requests failed.`]
          : [],
    };
  },
  async getTokenHolders(request) {
    return this.getTopHolders(request.chain, request.tokenAddress, request.limit);
  },
  async getWalletTrades(request) {
    return this.getWalletActivity(request.chain, request.walletAddress, {
      limit: request.limit,
      cursor: request.cursor,
    });
  },
  async getWalletProfile(request) {
    const activity = await this.getWalletActivity(request.chain, request.walletAddress, {
      limit: request.limit,
      cursor: request.cursor,
    });

    return {
      provider: "gmgn",
      status: activity.status,
      data: buildWalletProfileV1({
        wallet: request.walletAddress,
        trades: activity.data,
      }),
      warnings: activity.warnings,
    };
  },
  async getWalletHoldings() {
    return {
      provider: "gmgn",
      status: "unavailable",
      data: [],
      warnings: [
        "GMGN wallet holdings are not integrated yet; token holder snapshots are available for analyzed tokens only.",
      ],
    };
  },
};
