import {
  normalizeGmgnTopHoldersResponse,
  runGmgnTopHolders,
  type GMGNHolder,
} from "@/lib/gmgn";
import {
  computeTop100HolderAlphaV3,
  type AnalysisMode,
  type Top100HolderAlphaV3Result,
} from "@/lib/top100-holder-alpha-v3-engine";
import {
  computeWalletAlphaLight,
  neutralWalletAlphaLightFallback,
  type WalletAlphaLight,
} from "@/lib/wallet-alpha-light-engine";
import {
  computeWalletAlphaV3,
  type WalletAlphaV3Options,
  type WalletAlphaV3Result,
} from "@/lib/wallet-alpha-v3-engine";

export type KlineInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";
export type EstimatedCostLevel = "low" | "medium" | "high";

export type Top100HolderAlphaModeConfig = {
  analysisMode: AnalysisMode;
  holderLimit: number;
  deepHolderLimit: number;
  lightHolderLimit: number;
  estimatedCostLevel: EstimatedCostLevel;
};

export type RunTop100HolderAlphaV3Config = {
  chain: string;
  address: string;
  analysisMode: AnalysisMode;
  walletMaxPages: number;
  walletMaxActivities: number;
  maxTokens: number;
  interval: KlineInterval;
  concurrency: number;
  forceRefresh: boolean;
  routeWarnings?: string[];
};

type WalletAlphaHolderResult =
  | {
      success: true;
      holder: GMGNHolder;
      holderRank: number;
      analysisDepth: "deep";
      walletAlpha: WalletAlphaV3Result;
    }
  | {
      success: true;
      holder: GMGNHolder;
      holderRank: number;
      analysisDepth: "light";
      walletAlpha: WalletAlphaLight;
      fallback: boolean;
    }
  | {
      success: false;
      holder: GMGNHolder;
      holderRank: number;
      wallet: string | null;
      error: string;
    };

export class Top100HolderAlphaZeroHoldersError extends Error {
  debug: Record<string, unknown>;

  constructor(debug: Record<string, unknown>) {
    super("Top100 Holder Alpha fetched zero holders.");
    this.name = "Top100HolderAlphaZeroHoldersError";
    this.debug = debug;
  }
}

export function getTop100HolderAlphaModeConfig(
  mode: AnalysisMode
): Top100HolderAlphaModeConfig {
  if (mode === "fast") {
    return {
      analysisMode: "fast",
      holderLimit: 50,
      deepHolderLimit: 10,
      lightHolderLimit: 50,
      estimatedCostLevel: "low",
    };
  }

  if (mode === "deep") {
    return {
      analysisMode: "deep",
      holderLimit: 100,
      deepHolderLimit: 100,
      lightHolderLimit: 0,
      estimatedCostLevel: "high",
    };
  }

  return {
    analysisMode: "balanced",
    holderLimit: 100,
    deepHolderLimit: 25,
    lightHolderLimit: 100,
    estimatedCostLevel: "medium",
  };
}

export function normalizeTop100HolderAlphaAddress(chain: string, address: string) {
  return chain === "eth" || chain === "base" || chain === "bsc"
    ? address.toLowerCase()
    : address;
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

export async function runTop100HolderAlphaV3FromRequestConfig(
  config: RunTop100HolderAlphaV3Config
): Promise<{
  holderAlpha: Top100HolderAlphaV3Result;
  normalizedAddress: string;
  modeConfig: Top100HolderAlphaModeConfig;
  warnings: string[];
}> {
  const modeConfig = getTop100HolderAlphaModeConfig(config.analysisMode);
  const normalizedAddress = normalizeTop100HolderAlphaAddress(
    config.chain,
    config.address
  );
  const holderLimit = modeConfig.holderLimit;
  const holdersResponse = normalizeGmgnTopHoldersResponse(
    await runGmgnTopHolders({
      chain: config.chain,
      address: normalizedAddress,
      limit: holderLimit,
      orderBy: "amount_percentage",
      direction: "desc",
    }),
    holderLimit
  );
  const holders = holdersResponse.holders.slice(0, holderLimit);
  const deepHolderLimit = modeConfig.deepHolderLimit;
  const lightHolderLimit = modeConfig.lightHolderLimit;

  console.log("[Holder Alpha] Top holders fetched", {
    chain: config.chain,
    address: normalizedAddress,
    holderCount: holders.length,
    firstHolder: holders[0],
    analysisMode: config.analysisMode,
    holderLimit,
    deepHolderLimit,
    lightHolderLimit,
  });

  if (holders.length === 0) {
    throw new Top100HolderAlphaZeroHoldersError({
      chain: config.chain,
      address: normalizedAddress,
      analysisMode: config.analysisMode,
      holderInputConfig: {
        chain: config.chain,
        address: normalizedAddress,
        analysisMode: config.analysisMode,
        holderLimit,
        deepHolderLimit,
        lightHolderLimit,
        walletMaxPages: config.walletMaxPages,
        walletMaxActivities: config.walletMaxActivities,
        maxTokens: config.maxTokens,
        interval: config.interval,
        concurrency: config.concurrency,
        forceRefresh: config.forceRefresh,
      },
      holderFetchResultPreview: holdersResponse,
      possibleCause:
        "Wrong address parameter, wrong chain, wrong adapter input, or route not using the same Top100 execution path.",
    });
  }

  const options: WalletAlphaV3Options = {
    walletMaxPages: config.walletMaxPages,
    walletMaxActivities: config.walletMaxActivities,
    maxTokens: config.maxTokens,
    interval: config.interval,
    concurrency: config.concurrency,
  };
  const walletResults = await mapWithConcurrency({
    items: holders,
    concurrency: config.concurrency,
    mapper: async (holder, index): Promise<WalletAlphaHolderResult> => {
      const wallet = holderWallet(holder);
      const holderRank = index + 1;

      if (!wallet) {
        return {
          success: false,
          holder,
          holderRank,
          wallet,
          error: "Holder row did not include a wallet address.",
        };
      }

      if (holderRank > deepHolderLimit && config.analysisMode !== "deep") {
        try {
          const walletAlpha = await computeWalletAlphaLight(config.chain, wallet, {
            period: "30d",
          });

          return {
            success: true,
            holder,
            holderRank,
            analysisDepth: "light",
            walletAlpha,
            fallback: false,
          };
        } catch (error) {
          const reason = `GMGN portfolio stats unavailable for holder rank ${holderRank}; using neutral low-confidence light score. ${messageFromError(error)}`;
          return {
            success: true,
            holder,
            holderRank,
            analysisDepth: "light",
            walletAlpha: neutralWalletAlphaLightFallback({
              chain: config.chain,
              wallet,
              reason,
            }),
            fallback: true,
          };
        }
      }

      try {
        const walletAlpha = await computeWalletAlphaV3({
          chain: config.chain,
          wallet,
          options,
        });

        return {
          success: true,
          holder,
          holderRank,
          analysisDepth: "deep",
          walletAlpha,
        };
      } catch (error) {
        return {
          success: false,
          holder,
          holderRank,
          wallet,
          error: messageFromError(error),
        };
      }
    },
  });
  const successfulResults = walletResults.filter(
    (result): result is Extract<WalletAlphaHolderResult, { success: true }> =>
      result.success
  );
  const failedResults = walletResults.filter(
    (result): result is Extract<WalletAlphaHolderResult, { success: false }> =>
      !result.success
  );
  const warnings = [
    ...(config.routeWarnings || []),
    ...failedResults.map((result) =>
      `Holder rank ${result.holderRank}${
        result.wallet ? ` (${result.wallet})` : ""
      } failed Wallet Alpha V3 analysis: ${result.error}`
    ),
  ];
  const fallbackLightWalletCount = successfulResults.filter(
    (result) =>
      result.analysisDepth === "light" && "fallback" in result && result.fallback
  ).length;
  const lightFallbackWarnings = successfulResults
    .filter(
      (
        result
      ): result is Extract<
        WalletAlphaHolderResult,
        { success: true; analysisDepth: "light" }
      > =>
        result.analysisDepth === "light" &&
        "fallback" in result &&
        result.fallback
    )
    .flatMap((result) => result.walletAlpha.warnings);
  warnings.push(...lightFallbackWarnings);
  if (lightFallbackWarnings.length > 0) {
    warnings.push(
      "GMGN portfolio stats unavailable; neutral fallback light scores were used where configured."
    );
  }
  if (
    successfulResults.length > 0 &&
    fallbackLightWalletCount / successfulResults.length > 0.5
  ) {
    warnings.push(
      "Most light wallets used neutral fallback because GMGN portfolio stats were unavailable."
    );
  }
  const holderAlpha = computeTop100HolderAlphaV3({
    holders,
    walletAlphaResults: successfulResults.map((result) => ({
      holder: result.holder,
      holderRank: result.holderRank,
      analysisDepth: result.analysisDepth,
      walletAlpha: result.walletAlpha,
      walletAlphaSource:
        result.analysisDepth === "deep"
          ? "wallet-alpha-v3.3-deep"
          : "fallback" in result && result.fallback
          ? "wallet-alpha-light-fallback"
          : "gmgn-portfolio-stats-light",
    })),
    requestedHolderLimit: holderLimit,
    analysisMode: config.analysisMode,
    deepHolderLimit,
    lightHolderLimit,
    estimatedCostLevel: modeConfig.estimatedCostLevel,
    fallbackLightWalletCount,
    failedWalletCount: failedResults.length,
    warnings,
  });

  return {
    holderAlpha,
    normalizedAddress,
    modeConfig,
    warnings,
  };
}
