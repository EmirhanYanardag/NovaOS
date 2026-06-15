import { NextResponse } from "next/server";
import {
  normalizeGmgnTopHoldersResponse,
  runGmgnTopHolders,
  type GMGNHolder,
} from "@/lib/gmgn";
import { fetchGmgnRiskStats, type GmgnRiskStats } from "@/lib/gmgn-risk-stats";
import {
  computeNovaConvictionV1,
  type NovaConvictionResultV1,
} from "@/lib/nova-conviction-v1-engine";
import { computeRiskPressureV1, type RiskPressureResultV1 } from "@/lib/risk-pressure-engine";
import {
  computeStructuralSafetyV1,
  type StructuralSafetyResultV1,
} from "@/lib/structural-safety-engine";
import { GMGNProviderPrimary } from "@/lib/token-data-provider";
import {
  computeTop100HolderAlphaV1,
  type Top100HolderAlphaResultV1,
} from "@/lib/top100-holder-alpha-engine";
import {
  computeTop100HolderAlphaV3,
  type Top100HolderAlphaV3Result,
} from "@/lib/top100-holder-alpha-v3-engine";
import {
  computeWalletAlphaBatchV2,
  type WalletAlphaResultV2,
} from "@/lib/wallet-alpha-engine";
import {
  computeWalletAlphaV3,
  type WalletAlphaV3Options,
  type WalletAlphaV3Result,
} from "@/lib/wallet-alpha-v3-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORTED_CHAINS = new Set(["sol", "bsc", "base", "eth"]);
const INTERVALS = new Set(["1m", "5m", "15m", "1h", "4h", "1d"]);
const DEFAULT_HOLDER_LIMIT = 100;
const MAX_HOLDER_LIMIT = 100;
const DEFAULT_WALLET_MAX_PAGES = 25;
const MAX_WALLET_MAX_PAGES = 50;
const DEFAULT_WALLET_MAX_ACTIVITIES = 5000;
const MAX_WALLET_MAX_ACTIVITIES = 5000;
const DEFAULT_MAX_TOKENS = 50;
const MAX_TOKENS = 100;
const DEFAULT_CONCURRENCY = 2;
const MAX_CONCURRENCY = 5;
const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const SOL_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

type KlineInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

type WalletAlphaHolderResult =
  | {
      success: true;
      holder: GMGNHolder;
      holderRank: number;
      walletAlpha: WalletAlphaV3Result;
    }
  | {
      success: false;
      holder: GMGNHolder;
      holderRank: number;
      wallet: string | null;
      error: string;
    };

function errorResponse(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

function parseBoundedInteger(value: string | null, defaultValue: number, max: number) {
  if (!value) return defaultValue;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return null;

  return Math.min(parsed, max);
}

function parseBoolean(value: string | null) {
  return value === "true" || value === "1";
}

function isValidAddress(chain: string, address: string) {
  return chain === "sol"
    ? SOL_ADDRESS_PATTERN.test(address)
    : EVM_ADDRESS_PATTERN.test(address);
}

function holderWallet(holder: GMGNHolder) {
  return holder.wallet || holder.address || null;
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "unknown error";
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

function countConfidence(walletAlphaBatch: WalletAlphaResultV2[]) {
  return {
    highConfidenceCount: walletAlphaBatch.filter((wallet) => wallet.confidenceLevel === "high").length,
    mediumConfidenceCount: walletAlphaBatch.filter((wallet) => wallet.confidenceLevel === "medium").length,
    lowConfidenceCount: walletAlphaBatch.filter((wallet) => wallet.confidenceLevel === "low").length,
  };
}

async function computeHolderAlphaV3Module({
  chain,
  address,
  holderLimit,
  options,
  concurrency,
}: {
  chain: string;
  address: string;
  holderLimit: number;
  options: WalletAlphaV3Options;
  concurrency: number;
}) {
  const holdersResponse = normalizeGmgnTopHoldersResponse(
    await runGmgnTopHolders({
      chain,
      address,
      limit: holderLimit,
      orderBy: "amount_percentage",
      direction: "desc",
    }),
    holderLimit
  );
  const holders = holdersResponse.holders.slice(0, holderLimit);
  const walletResults = await mapWithConcurrency({
    items: holders,
    concurrency,
    mapper: async (holder, index): Promise<WalletAlphaHolderResult> => {
      const wallet = holderWallet(holder);

      if (!wallet) {
        return {
          success: false,
          holder,
          holderRank: index + 1,
          wallet,
          error: "Holder row did not include a wallet address.",
        };
      }

      try {
        return {
          success: true,
          holder,
          holderRank: index + 1,
          walletAlpha: await computeWalletAlphaV3({
            chain,
            wallet,
            options,
          }),
        };
      } catch (error) {
        return {
          success: false,
          holder,
          holderRank: index + 1,
          wallet,
          error: messageFromError(error),
        };
      }
    },
  });
  const successfulResults = walletResults.filter(
    (result): result is Extract<WalletAlphaHolderResult, { success: true }> => result.success
  );
  const failedResults = walletResults.filter(
    (result): result is Extract<WalletAlphaHolderResult, { success: false }> => !result.success
  );
  const warnings = failedResults.map((result) =>
    `Holder rank ${result.holderRank}${result.wallet ? ` (${result.wallet})` : ""} failed Wallet Alpha V3 analysis: ${result.error}`
  );

  return computeTop100HolderAlphaV3({
    holders,
    walletAlphaResults: successfulResults.map((result) => ({
      holder: result.holder,
      holderRank: result.holderRank,
      walletAlpha: result.walletAlpha,
    })),
    requestedHolderLimit: holderLimit,
    failedWalletCount: failedResults.length,
    warnings,
  });
}

async function computeV2SupportModules({
  chain,
  address,
  holderLimit,
  walletMaxPages,
  walletMaxActivities,
  concurrency,
  warnings,
}: {
  chain: string;
  address: string;
  holderLimit: number;
  walletMaxPages: number;
  walletMaxActivities: number;
  concurrency: number;
  warnings: string[];
}) {
  const providerResult = await GMGNProviderPrimary.getTop100DeepSnapshot(
    chain,
    address,
    {
      limit: holderLimit,
      activityLimit: 100,
      concurrency,
      includeRaw: true,
      debug: false,
      historyMode: "full",
      hardMaxPages: walletMaxPages,
      walletMaxActivities,
    }
  );
  warnings.push(...providerResult.warnings);

  const walletAlphaBatch = computeWalletAlphaBatchV2(providerResult.data.holders);
  const confidenceCounts = countConfidence(walletAlphaBatch);
  const coverage = {
    walletCount: walletAlphaBatch.length,
    walletsReachedEndOfHistory: providerResult.data.walletsReachedEndOfHistory,
    walletsStoppedByPageLimit: providerResult.data.walletsStoppedByPageLimit,
    walletsStoppedByActivityLimit: providerResult.data.walletsStoppedByActivityLimit,
    averageActivitiesPerWallet: providerResult.data.holdersAnalyzed
      ? Number((providerResult.data.totalActivities / providerResult.data.holdersAnalyzed).toFixed(2))
      : null,
    ...confidenceCounts,
  };

  return {
    holderAlphaV1: computeTop100HolderAlphaV1(walletAlphaBatch),
    structuralSafety: computeStructuralSafetyV1(walletAlphaBatch),
    coverage,
  };
}

export async function GET(request: Request) {
  const startedAt = Date.now();

  if (!process.env.GMGN_API_KEY) {
    return errorResponse(
      "Missing GMGN_API_KEY in server environment. Add it to .env.local or .env in the project root, then restart the Next.js server.",
      500
    );
  }

  const { searchParams } = new URL(request.url);
  const chain = searchParams.get("chain")?.toLowerCase() || "";
  const address = searchParams.get("address")?.trim() || "";
  const holderLimit = parseBoundedInteger(searchParams.get("holderLimit"), DEFAULT_HOLDER_LIMIT, MAX_HOLDER_LIMIT);
  const walletMaxPages = parseBoundedInteger(searchParams.get("walletMaxPages"), DEFAULT_WALLET_MAX_PAGES, MAX_WALLET_MAX_PAGES);
  const walletMaxActivities = parseBoundedInteger(searchParams.get("walletMaxActivities"), DEFAULT_WALLET_MAX_ACTIVITIES, MAX_WALLET_MAX_ACTIVITIES);
  const maxTokens = parseBoundedInteger(searchParams.get("maxTokens"), DEFAULT_MAX_TOKENS, MAX_TOKENS);
  const concurrency = parseBoundedInteger(searchParams.get("concurrency"), DEFAULT_CONCURRENCY, MAX_CONCURRENCY);
  const interval = searchParams.get("interval") || "1h";
  const forceRefresh = parseBoolean(searchParams.get("forceRefresh"));

  if (!chain) return errorResponse("Missing chain parameter.");
  if (!SUPPORTED_CHAINS.has(chain)) return errorResponse("Unsupported chain. Use sol, bsc, base, or eth.");
  if (!address) return errorResponse("Missing address parameter.");
  if (!isValidAddress(chain, address)) return errorResponse("address must be a valid token address for the requested chain.");
  if (holderLimit === null) return errorResponse("holderLimit must be an integer from 1 to 100.");
  if (walletMaxPages === null) return errorResponse("walletMaxPages must be an integer from 1 to 50.");
  if (walletMaxActivities === null) return errorResponse("walletMaxActivities must be an integer from 1 to 5000.");
  if (maxTokens === null) return errorResponse("maxTokens must be an integer from 1 to 100.");
  if (concurrency === null) return errorResponse("concurrency must be an integer from 1 to 5.");
  if (!INTERVALS.has(interval)) return errorResponse("interval must be one of 1m, 5m, 15m, 1h, 4h, or 1d.");

  const warnings: string[] = [];
  let holderAlpha: Top100HolderAlphaV3Result | null = null;
  let structuralSafety: StructuralSafetyResultV1 | null = null;
  let riskPressure: RiskPressureResultV1 | null = null;
  let riskStats: GmgnRiskStats | null = null;
  let holderAlphaV1: Top100HolderAlphaResultV1 | null = null;
  let coverage: Parameters<typeof computeRiskPressureV1>[0]["coverage"] = null;

  try {
    holderAlpha = await computeHolderAlphaV3Module({
      chain,
      address,
      holderLimit,
      concurrency,
      options: {
        walletMaxPages,
        walletMaxActivities,
        maxTokens,
        interval: interval as KlineInterval,
        concurrency,
      },
    });
    warnings.push(...holderAlpha.warnings);
  } catch (error) {
    warnings.push(`Top100 Holder Alpha V3.2 failed: ${messageFromError(error)}`);
  }

  try {
    riskStats = await fetchGmgnRiskStats({ chain, address });
    warnings.push(...riskStats.warnings);
  } catch (error) {
    warnings.push(`GMGN Risk Stats failed: ${messageFromError(error)}`);
  }

  try {
    const support = await computeV2SupportModules({
      chain,
      address,
      holderLimit,
      walletMaxPages,
      walletMaxActivities,
      concurrency,
      warnings,
    });
    holderAlphaV1 = support.holderAlphaV1;
    structuralSafety = support.structuralSafety;
    coverage = support.coverage;
  } catch (error) {
    warnings.push(`Structural/Risk support snapshot failed: ${messageFromError(error)}`);
  }

  try {
    riskPressure = computeRiskPressureV1({
      riskStats,
      holderAlpha: holderAlphaV1,
      behavioralConviction: null,
      structuralSafety,
      coverage,
      warnings,
    });
    warnings.push(...riskPressure.warnings);
  } catch (error) {
    warnings.push(`Risk Pressure failed: ${messageFromError(error)}`);
  }

  const conviction: NovaConvictionResultV1 = computeNovaConvictionV1({
    holderAlpha,
    structuralSafety,
    riskPressure,
    warnings,
  });

  return NextResponse.json({
    success: true,
    version: conviction.version,
    chain,
    address,
    runtimeMs: Date.now() - startedAt,
    forceRefresh,
    novaConvictionScore: conviction.novaConvictionScore,
    convictionTier: conviction.convictionTier,
    components: conviction.components,
    weights: conviction.weights,
    confidence: conviction.confidence,
    moduleSummaries: conviction.moduleSummaries,
    thesis: conviction.thesis,
    explanations: conviction.explanations,
    warnings: conviction.warnings,
  });
}
