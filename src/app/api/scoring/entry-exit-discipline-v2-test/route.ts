import { NextResponse } from "next/server";
import {
  aggregateEntryExitDisciplineV2,
  analyzeWalletEntryExitDisciplineV2,
  getRelevantEntryExitActivityRange,
  type WalletEntryExitDisciplineV2,
} from "@/lib/entry-exit-discipline-v2";
import { normalizeGmgnTopHoldersResponse, runGmgnTopHolders, type GMGNHolder } from "@/lib/gmgn";
import { fetchGmgnTokenKline } from "@/lib/gmgn-token-kline";
import { fetchGmgnWalletActivityPaginated } from "@/lib/gmgn-wallet-activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORTED_CHAINS = new Set(["sol", "bsc", "base", "eth"]);
const INTERVALS = new Set(["1m", "5m", "15m", "1h", "4h", "1d"]);
const DEFAULT_HOLDER_LIMIT = 20;
const MAX_HOLDER_LIMIT = 100;
const DEFAULT_WALLET_MAX_PAGES = 5;
const MAX_WALLET_MAX_PAGES = 50;
const DEFAULT_WALLET_MAX_ACTIVITIES = 500;
const MAX_WALLET_MAX_ACTIVITIES = 2000;
const DEFAULT_CONCURRENCY = 2;
const MAX_CONCURRENCY = 5;
const DEFAULT_KLINE_LIMIT = 500;
const MAX_KLINE_LIMIT = 1000;
const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const SOL_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
type KlineInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

function errorResponse(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

function parseBoundedInteger(value: string | null, defaultValue: number, max: number) {
  if (!value) return defaultValue;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return null;

  return Math.min(parsed, max);
}

function parseOptionalUnixSeconds(value: string | null) {
  if (!value) return undefined;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return null;

  return parsed;
}

function parseBoolean(value: string | null) {
  return value === "true" || value === "1";
}

function isValidAddress(chain: string, address: string) {
  return chain === "sol"
    ? SOL_ADDRESS_PATTERN.test(address)
    : EVM_ADDRESS_PATTERN.test(address);
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "unknown error";
}

function unixSeconds(value: number | null) {
  if (value === null) return null;
  return value > 9_999_999_999 ? Math.trunc(value / 1000) : value;
}

function klineUnixBounds(candles: Array<{ timestampUnix: number | null }>) {
  const timestamps = candles
    .map((candle) => unixSeconds(candle.timestampUnix))
    .filter((timestamp): timestamp is number => timestamp !== null);

  return {
    earliest: timestamps.length > 0 ? Math.min(...timestamps) : null,
    latest: timestamps.length > 0 ? Math.max(...timestamps) : null,
  };
}

function klineCoversWindow({
  earliest,
  latest,
  targetEarliest,
  targetLatest,
  coverageGraceSeconds = 0,
}: {
  earliest: number | null;
  latest: number | null;
  targetEarliest: number | null;
  targetLatest: number | null;
  coverageGraceSeconds?: number;
}) {
  if (targetEarliest === null || targetLatest === null) return false;
  if (earliest === null || latest === null) return false;
  return earliest <= targetEarliest + coverageGraceSeconds && latest + coverageGraceSeconds >= targetLatest;
}

function klineRetryOrder(requestedInterval: KlineInterval) {
  const order: KlineInterval[] = [requestedInterval, "4h", "1d"];
  return Array.from(new Set(order));
}

async function mapWithConcurrency<T, R>({
  items,
  concurrency,
  mapper,
}: {
  items: T[];
  concurrency: number;
  mapper: (item: T, index: number) => Promise<R>;
}) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );

  return results;
}

function holderWallet(holder: GMGNHolder) {
  return holder.wallet || holder.address;
}

function routeExplanations(mode: "single-wallet" | "top-holders", wallets: WalletEntryExitDisciplineV2[]) {
  const rows = [
    "Entry Discipline V2 uses kline-supported post-entry peak comparisons.",
    "Exit Discipline V2 compares realized exits against post-entry and post-exit peak context.",
  ];

  if (mode === "top-holders") {
    rows.push("Top-holder mode weights token-level aggregates by current holder ownership or USD value when available.");
  }

  if (wallets.some((wallet) => wallet.warnings.some((warning) => warning.includes("Kline history starts")))) {
    rows.push("Kline coverage starts after some wallet buys, so entry scores may be conservative.");
  }

  if (wallets.some((wallet) => wallet.averageMissedUpsideRatio !== null && wallet.averageMissedUpsideRatio >= 2)) {
    rows.push("Exit Discipline is limited because some exits occurred before later upside.");
  }

  return rows;
}

export async function GET(request: Request) {
  if (!process.env.GMGN_API_KEY) {
    return errorResponse(
      "Missing GMGN_API_KEY in server environment. Add it to .env.local or .env in the project root, then restart the Next.js server.",
      500
    );
  }

  const { searchParams } = new URL(request.url);
  const chain = searchParams.get("chain")?.toLowerCase() || "";
  const address = searchParams.get("address")?.trim() || "";
  const wallet = searchParams.get("wallet")?.trim() || "";
  const holderLimit = parseBoundedInteger(
    searchParams.get("holderLimit"),
    DEFAULT_HOLDER_LIMIT,
    MAX_HOLDER_LIMIT
  );
  const walletMaxPages = parseBoundedInteger(
    searchParams.get("walletMaxPages"),
    DEFAULT_WALLET_MAX_PAGES,
    MAX_WALLET_MAX_PAGES
  );
  const walletMaxActivities = parseBoundedInteger(
    searchParams.get("walletMaxActivities"),
    DEFAULT_WALLET_MAX_ACTIVITIES,
    MAX_WALLET_MAX_ACTIVITIES
  );
  const concurrency = parseBoundedInteger(
    searchParams.get("concurrency"),
    DEFAULT_CONCURRENCY,
    MAX_CONCURRENCY
  );
  const interval = searchParams.get("interval") || "1h";
  const klineLimit = parseBoundedInteger(
    searchParams.get("klineLimit"),
    DEFAULT_KLINE_LIMIT,
    MAX_KLINE_LIMIT
  );
  const from = parseOptionalUnixSeconds(searchParams.get("from"));
  const to = parseOptionalUnixSeconds(searchParams.get("to"));
  const includeRaw = parseBoolean(searchParams.get("includeRaw"));

  if (!chain) return errorResponse("Missing chain parameter.");
  if (!SUPPORTED_CHAINS.has(chain)) {
    return errorResponse("Unsupported chain. Use sol, bsc, base, or eth.");
  }

  if (!address) return errorResponse("Missing address parameter.");
  if (!isValidAddress(chain, address)) {
    return errorResponse("address must be a valid token address for the requested chain.");
  }

  if (wallet && !isValidAddress(chain, wallet)) {
    return errorResponse("wallet must be a valid address for the requested chain.");
  }

  if (holderLimit === null) return errorResponse("holderLimit must be an integer from 1 to 100.");
  if (walletMaxPages === null) return errorResponse("walletMaxPages must be an integer from 1 to 50.");
  if (walletMaxActivities === null) return errorResponse("walletMaxActivities must be an integer from 1 to 2000.");
  if (concurrency === null) return errorResponse("concurrency must be an integer from 1 to 5.");
  if (klineLimit === null) return errorResponse("klineLimit must be an integer from 1 to 1000.");
  if (!INTERVALS.has(interval)) return errorResponse("interval must be one of 1m, 5m, 15m, 1h, 4h, or 1d.");
  if (from === null) return errorResponse("from must be a positive Unix timestamp in seconds.");
  if (to === null) return errorResponse("to must be a positive Unix timestamp in seconds.");

  const warnings: string[] = [];

  try {
    const mode = wallet ? "single-wallet" as const : "top-holders" as const;
    const holders = wallet
      ? []
      : normalizeGmgnTopHoldersResponse(
          await runGmgnTopHolders({
            chain,
            address,
            limit: holderLimit,
            orderBy: "amount_percentage",
            direction: "desc",
          }),
          holderLimit
        ).holders;
    const targets = wallet
      ? [{ wallet, holder: null as GMGNHolder | null }]
      : holders
          .map((holder) => ({ wallet: holderWallet(holder), holder }))
          .filter((item): item is { wallet: string; holder: GMGNHolder } => Boolean(item.wallet));

    const activityResults = await mapWithConcurrency({
      items: targets,
      concurrency,
      mapper: async (target) => {
        try {
          const activity = await fetchGmgnWalletActivityPaginated({
            chain,
            wallet: target.wallet,
            limitPerPage: 100,
            historyMode: "full",
            hardMaxPages: walletMaxPages,
            maxActivities: walletMaxActivities,
          });

          return { target, activity };
        } catch (error) {
          warnings.push(`Wallet ${target.wallet} activity fetch failed: ${messageFromError(error)}`);
          return null;
        }
      },
    });
    const successfulActivities = activityResults.filter(
      (result): result is NonNullable<typeof result> => result !== null
    );
    const ranges = successfulActivities.map((result) =>
      getRelevantEntryExitActivityRange({
        activities: result.activity.activities,
        wallet: result.target.wallet,
        tokenAddress: address,
      })
    );
    const earliestRelevantBuyTimestamps = ranges
      .map((range) => range.earliestRelevantBuyTimestamp)
      .filter((timestamp): timestamp is number => timestamp !== null);
    const latestRelevantSellTimestamps = ranges
      .map((range) => range.latestRelevantSellTimestamp)
      .filter((timestamp): timestamp is number => timestamp !== null);
    const latestRelevantActivityTimestamps = ranges
      .map((range) => range.latestRelevantActivityTimestamp)
      .filter((timestamp): timestamp is number => timestamp !== null);
    const requestedInterval = interval as KlineInterval;
    const nowUnix = Math.floor(Date.now() / 1000);
    const targetEarliest =
      earliestRelevantBuyTimestamps.length > 0
        ? Math.min(...earliestRelevantBuyTimestamps)
        : null;
    const targetLatest =
      latestRelevantSellTimestamps.length > 0
        ? Math.max(...latestRelevantSellTimestamps)
        : latestRelevantActivityTimestamps.length > 0
          ? Math.max(...latestRelevantActivityTimestamps)
          : null;
    const resolvedFrom =
      from ??
      (targetEarliest !== null
        ? Math.max(0, targetEarliest - 3600)
        : undefined);
    const resolvedTo =
      to ??
      (targetEarliest !== null
        ? Math.max(
            nowUnix,
            ...latestRelevantSellTimestamps,
            ...latestRelevantActivityTimestamps
          )
        : undefined);

    if (from === undefined && resolvedFrom !== undefined) {
      warnings.push("Kline range was derived from earliest relevant wallet buy timestamp.");
    }

    const klineRetryAttempts: Array<{
      interval: KlineInterval;
      count: number;
      earliest: number | null;
      latest: number | null;
      covered: boolean;
    }> = [];
    const klineResults = [];

    for (const candidateInterval of klineRetryOrder(requestedInterval)) {
      const candidate = await fetchGmgnTokenKline(chain, address, {
        interval: candidateInterval,
        limit: klineLimit,
        from: resolvedFrom,
        to: resolvedTo,
        includeRaw,
      });
      const bounds = klineUnixBounds(candidate.candles);
      const coverageGraceSeconds = candidateInterval === "1d" ? 86_400 : 0;
      const covered = klineCoversWindow({
        earliest: bounds.earliest,
        latest: bounds.latest,
        targetEarliest,
        targetLatest,
        coverageGraceSeconds,
      });

      klineRetryAttempts.push({
        interval: candidateInterval,
        count: candidate.count,
        earliest: bounds.earliest,
        latest: bounds.latest,
        covered,
      });
      klineResults.push(candidate);

      if (covered) break;
    }

    const coveredResultIndex = klineRetryAttempts.findIndex((attempt) => attempt.covered);
    const selectedKlineIndex =
      coveredResultIndex >= 0 ? coveredResultIndex : Math.max(0, klineResults.length - 1);
    const kline = klineResults[selectedKlineIndex];
    const effectiveInterval = klineRetryAttempts[selectedKlineIndex]?.interval ?? requestedInterval;
    const coverageGraceSeconds = effectiveInterval === "1d" ? 86_400 : 0;
    const klineCoverageStrategy =
      coveredResultIndex === 0
        ? "requested-interval-covered"
        : coveredResultIndex > 0
          ? "widened-interval-covered"
          : "no-interval-covered";

    if (effectiveInterval === "1d") {
      warnings.push("Daily kline resolution was used; Entry/Exit V2 is approximate.");
    }

    warnings.push(...kline.warnings);
    const klineTimestamps = kline.candles
      .map((candle) => candle.timestampUnix)
      .map((timestamp) =>
        timestamp !== null && timestamp > 9_999_999_999
          ? Math.trunc(timestamp / 1000)
          : timestamp
      )
      .filter((timestamp): timestamp is number => timestamp !== null);
    const klineEarliestTimestampUnix =
      klineTimestamps.length > 0 ? Math.min(...klineTimestamps) : null;
    const klineLatestTimestampUnix =
      klineTimestamps.length > 0 ? Math.max(...klineTimestamps) : null;

    const wallets = successfulActivities.map((result) => {
      const walletResult = analyzeWalletEntryExitDisciplineV2({
        chain,
        tokenAddress: address,
        wallet: result.target.wallet,
        activities: result.activity.activities,
        candles: kline.candles,
        totalSupply: kline.totalSupply,
        coverageGraceSeconds,
        holder: result.target.holder,
        includeRaw,
      });

      walletResult.warnings.push(
        ...[
          result.activity.stoppedByPageLimit ? "Wallet activity stopped by page limit." : null,
          result.activity.stoppedByActivityLimit ? "Wallet activity stopped by activity limit." : null,
          result.activity.stoppedByTimeout ? "Wallet activity stopped by timeout." : null,
        ].filter((warning): warning is string => Boolean(warning))
      );

      return walletResult;
    }).filter(
      (result): result is WalletEntryExitDisciplineV2 => result !== null
    );
    const aggregate = aggregateEntryExitDisciplineV2(wallets);

    return NextResponse.json({
      success: true,
      chain,
      address,
      mode,
      ...(wallet ? { wallet } : {}),
      interval: effectiveInterval,
      requestedInterval,
      effectiveInterval,
      klineCoverageStrategy,
      klineRetryAttempts,
      klineCount: kline.count,
      klineEarliestTimestampUnix,
      klineLatestTimestampUnix,
      klineEarliestTimestamp: kline.earliestTimestamp,
      klineLatestTimestamp: kline.latestTimestamp,
      klineFrom: resolvedFrom ?? null,
      klineTo: resolvedTo ?? null,
      aggregate,
      wallets,
      explanations: routeExplanations(mode, wallets),
      warnings: Array.from(
        new Set([
          ...warnings,
          ...wallets.flatMap((result) => result.warnings),
        ])
      ),
      ...(includeRaw ? { raw: { kline: kline.raw } } : {}),
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error
        ? error.message
        : "Entry/Exit Discipline V2 test request failed.",
      500
    );
  }
}
