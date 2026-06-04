import { NextResponse } from "next/server";
import {
  cacheAgeWarning,
  createTokenAnalysisCacheKey,
  getOrSetCache,
  type CacheMetadata,
} from "../../../lib/cache";
import { calculateConvictionEngine } from "../../../lib/conviction-engine";
import {
  analyzeDeepWalletBehaviorBatch,
  type DeepWalletBehaviorBatchResult,
  type DeepWalletBehaviorResult,
} from "../../../lib/deep-wallet-behavior";
import {
  analyzeFundingBundle,
  type FundingBundleResult,
  type FundingWalletInput,
} from "../../../lib/funding-bundle-detection";
import {
  mapLiveDataToConvictionInput,
  type LiveClusterSummary,
  type LiveHolderRow,
  type LiveMarketData,
  type LiveWalletProfilesInput,
} from "../../../lib/conviction-live-mapper";

type ApiErrorCode =
  | "MISSING_CHAIN"
  | "MISSING_TOKEN_ADDRESS"
  | "INVALID_TOKEN_ADDRESS"
  | "INVALID_LIMIT"
  | "HOLDER_DATA_FAILED"
  | "CONVICTION_ENGINE_FAILED";

type ConvictionEngineApiResponse = {
  chain: string;
  tokenAddress: string;
  tokenSymbol: string | null;
  finalConvictionScore: number;
  subScores: ReturnType<typeof calculateConvictionEngine>["subScores"];
  aggregation: ReturnType<typeof calculateConvictionEngine>["aggregation"];
  explanation: ReturnType<typeof calculateConvictionEngine>["explanation"];
  dataConfidence: ReturnType<typeof calculateConvictionEngine>["dataConfidence"];
  walletBreakdowns: ReturnType<typeof calculateConvictionEngine>["walletBreakdowns"];
  mapperCoverage: ReturnType<typeof mapLiveDataToConvictionInput>["coverage"];
  mapperWarnings: string[];
  warnings: string[];
  deepBehavior?: {
    enabled: boolean;
    analyzedWallets: number;
    summary: DeepWalletBehaviorBatchResult["summary"];
    walletResults: DeepWalletBehaviorResult[];
    warnings: string[];
  };
  deepBehaviorImpact?: {
    baselineConvictionScore: number;
    enrichedConvictionScore: number;
    delta: number;
    direction: "improved" | "weakened" | "neutral";
    strongestPositiveDrivers: string[];
    strongestNegativeDrivers: string[];
    changedSubscores: {
      holderIntegrityDelta: number;
      walletQualityDelta: number;
      behaviorStabilityDelta: number;
      riskProtectionDelta: number;
      botActivityRiskDelta: number;
      rotationRiskDelta: number;
    };
    walletDrivers: {
      walletAddress: string;
      shortAddress: string;
      rank?: number;
      impact: "positive" | "negative" | "neutral";
      reason: string;
      tokenSpecificConvictionScore?: number;
      botLikeActivityRisk?: number;
      rotationBehaviorRisk?: number;
      accumulationPressure?: number;
      distributionPressure?: number;
    }[];
  };
  bundleDetection?: FundingBundleResult;
  status: "live" | "live_with_deep_behavior" | "partial";
  cache?: CacheMetadata;
};

const CONVICTION_STANDARD_CACHE_TTL_SECONDS = 300;
const CONVICTION_DEEP_CACHE_TTL_SECONDS = 900;

function structuredError({
  code,
  message,
  details,
  status,
}: {
  code: ApiErrorCode;
  message: string;
  details?: unknown;
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

function parseLimit(value: string | null) {
  if (!value) return 10;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(25, Math.max(1, Math.floor(parsed)));
}

function parseDeepLimit(value: string | null) {
  if (!value) return 3;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 3;
  return Math.min(10, Math.max(1, Math.floor(parsed)));
}

function parseMarketNumber(value: string | null) {
  if (!value) return null;
  const cleaned = value.replace(/[$,]/g, "").trim();
  const multiplier = /b$/i.test(cleaned)
    ? 1_000_000_000
    : /m$/i.test(cleaned)
    ? 1_000_000
    : /k$/i.test(cleaned)
    ? 1_000
    : 1;
  const parsed = Number(cleaned.replace(/[bmk]$/i, ""));
  return Number.isFinite(parsed) ? parsed * multiplier : null;
}

function marketBucket(value: string | null) {
  const parsed = parseMarketNumber(value);
  if (parsed === null) return undefined;
  if (Math.abs(parsed) < 100) return String(Math.round(parsed));

  const magnitude = 10 ** Math.max(0, Math.floor(Math.log10(Math.abs(parsed))) - 2);
  return String(Math.round(parsed / magnitude) * magnitude);
}

function marketCacheBuckets(searchParams: URLSearchParams) {
  return {
    marketCapBucket: marketBucket(searchParams.get("marketCapUsd")),
    liquidityBucket: marketBucket(searchParams.get("liquidityUsd")),
    volume24hBucket: marketBucket(searchParams.get("volume24hUsd")),
    priceChangeBucket: marketBucket(searchParams.get("priceChange24h")),
    volumeChangeBucket: marketBucket(searchParams.get("volumeChange24h")),
  };
}

function mapChain(chain: string) {
  const key = chain.toLowerCase();

  if (key === "ethereum" || key === "eth") return "eth";
  if (key === "base") return "base";
  if (key === "bsc" || key === "bnb") return "bsc";
  if (key === "mantle") return "0x1388";
  if (key === "polygon") return "polygon";
  if (key === "arbitrum") return "arbitrum";
  if (key === "optimism") return "optimism";

  return key;
}

async function fetchJson<T>(
  url: string
): Promise<{ ok: true; data: T } | { ok: false; status: number }> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return { ok: false, status: response.status };
    const data = (await response.json()) as T;
    if (
      data &&
      typeof data === "object" &&
      "error" in data &&
      (data as { error?: unknown }).error
    ) {
      return { ok: false, status: response.status };
    }

    return { ok: true, data };
  } catch {
    return { ok: false, status: 500 };
  }
}

async function fetchMoralisTransfers({
  apiKey,
  chain,
  tokenAddress,
  walletAddress,
}: {
  apiKey: string;
  chain: string;
  tokenAddress: string;
  walletAddress: string;
}) {
  const url = new URL(
    `https://deep-index.moralis.io/api/v2.2/${walletAddress}/erc20/transfers`
  );
  url.searchParams.set("chain", mapChain(chain));
  url.searchParams.set("limit", "100");
  url.searchParams.set("order", "DESC");
  url.searchParams.append("contract_addresses", tokenAddress);

  const response = await fetch(url.toString(), {
    headers: {
      accept: "application/json",
      "X-API-Key": apiKey,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Moralis token transfer request failed.");
  }

  const data = (await response.json()) as { result?: unknown[] };
  return data.result || [];
}

function marketDataFromSearchParams(searchParams: URLSearchParams): LiveMarketData | null {
  const marketData: LiveMarketData = {
    marketCapUsd: searchParams.get("marketCapUsd") || undefined,
    liquidityUsd: searchParams.get("liquidityUsd") || undefined,
    volume24hUsd: searchParams.get("volume24hUsd") || undefined,
    priceChange24h: searchParams.get("priceChange24h") || undefined,
    volumeChange24h: searchParams.get("volumeChange24h") || undefined,
  };
  const hasMarketData = Object.values(marketData).some(
    (value) => value !== undefined && value !== ""
  );

  return hasMarketData ? marketData : null;
}

function shortAddress(address: string) {
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function scoreDelta(enriched: number, baseline: number) {
  return Math.round(enriched - baseline);
}

function buildWalletImpactReason(wallet: DeepWalletBehaviorResult) {
  if (wallet.dataQuality.score < 45) {
    return "Wallet behavior is too low-data to materially influence conviction.";
  }
  if (wallet.botLikeActivityRisk > 70) {
    return "Bot-like transfer pattern weakened wallet quality.";
  }
  if (wallet.distributionPressure > 65) {
    return "Wallet has elevated distribution pressure.";
  }
  if (wallet.rotationBehaviorRisk > 65) {
    return "Rotation behavior weakened wallet quality.";
  }
  if (wallet.shortHoldRisk > 70) {
    return "Short-cycle token activity weakened wallet quality.";
  }
  if (wallet.accumulationPressure > 70) {
    return "Wallet shows accumulation-dominant token flow.";
  }
  if (wallet.holdQualityScore > 70 && wallet.botLikeActivityRisk < 35) {
    return "Wallet shows stable token holding behavior with low bot-like risk.";
  }

  return "Deep behavior did not materially alter this wallet's conviction input.";
}

function buildDeepBehaviorImpact({
  baseline,
  enriched,
  deepResults,
  ranksByAddress,
}: {
  baseline: ReturnType<typeof calculateConvictionEngine>;
  enriched: ReturnType<typeof calculateConvictionEngine>;
  deepResults: DeepWalletBehaviorResult[];
  ranksByAddress: Map<string, number>;
}): NonNullable<ConvictionEngineApiResponse["deepBehaviorImpact"]> {
  const delta = scoreDelta(
    enriched.finalConvictionScore,
    baseline.finalConvictionScore
  );
  const direction =
    Math.abs(delta) < 2 ? "neutral" : delta > 0 ? "improved" : "weakened";
  const changedSubscores = {
    holderIntegrityDelta: scoreDelta(
      enriched.subScores.holderIntegrity,
      baseline.subScores.holderIntegrity
    ),
    walletQualityDelta: scoreDelta(
      enriched.subScores.walletQuality,
      baseline.subScores.walletQuality
    ),
    behaviorStabilityDelta: scoreDelta(
      enriched.subScores.behaviorStability,
      baseline.subScores.behaviorStability
    ),
    riskProtectionDelta: scoreDelta(
      enriched.subScores.riskProtection,
      baseline.subScores.riskProtection
    ),
    botActivityRiskDelta: scoreDelta(
      enriched.subScores.botActivityRisk,
      baseline.subScores.botActivityRisk
    ),
    rotationRiskDelta: scoreDelta(
      enriched.subScores.rotationRisk,
      baseline.subScores.rotationRisk
    ),
  };
  const strongestPositiveDrivers: string[] = [];
  const strongestNegativeDrivers: string[] = [];

  if (direction === "neutral") {
    strongestPositiveDrivers.push(
      "Deep behavior did not materially change conviction."
    );
  }
  if (changedSubscores.walletQualityDelta > 0) {
    strongestPositiveDrivers.push("Wallet quality improved after token-transfer enrichment.");
  }
  if (changedSubscores.behaviorStabilityDelta > 0) {
    strongestPositiveDrivers.push("Behavior stability improved from lower deep bot or rotation risk.");
  }
  if (deepResults.some((wallet) => wallet.accumulationPressure > 70)) {
    strongestPositiveDrivers.push("Accumulation-dominant token flow appeared in profiled wallets.");
  }
  if (
    deepResults.some(
      (wallet) => wallet.holdQualityScore > 70 && wallet.botLikeActivityRisk < 35
    )
  ) {
    strongestPositiveDrivers.push("Stable hold behavior with low bot-like risk was detected.");
  }
  if (changedSubscores.walletQualityDelta < 0) {
    strongestNegativeDrivers.push("Wallet quality weakened after token-transfer enrichment.");
  }
  if (changedSubscores.riskProtectionDelta < 0) {
    strongestNegativeDrivers.push("Risk protection weakened after deep behavior analysis.");
  }
  if (deepResults.some((wallet) => wallet.distributionPressure > 65)) {
    strongestNegativeDrivers.push("Distribution pressure is elevated in at least one profiled wallet.");
  }
  if (deepResults.some((wallet) => wallet.botLikeActivityRisk > 70)) {
    strongestNegativeDrivers.push("Bot-like transfer risk is elevated in at least one profiled wallet.");
  }
  if (deepResults.some((wallet) => wallet.rotationBehaviorRisk > 65)) {
    strongestNegativeDrivers.push("Rotation behavior risk is elevated in at least one profiled wallet.");
  }
  if (deepResults.some((wallet) => wallet.shortHoldRisk > 70)) {
    strongestNegativeDrivers.push("Short-hold risk is elevated in at least one profiled wallet.");
  }
  if (strongestNegativeDrivers.length === 0) {
    strongestNegativeDrivers.push("No major negative deep-behavior driver was detected.");
  }

  return {
    baselineConvictionScore: baseline.finalConvictionScore,
    enrichedConvictionScore: enriched.finalConvictionScore,
    delta,
    direction,
    strongestPositiveDrivers: strongestPositiveDrivers.slice(0, 4),
    strongestNegativeDrivers: strongestNegativeDrivers.slice(0, 4),
    changedSubscores,
    walletDrivers: deepResults.map((wallet) => {
      const riskAverage =
        (wallet.botLikeActivityRisk +
          wallet.rotationBehaviorRisk +
          wallet.shortHoldRisk) /
        3;
      const impact =
        wallet.dataQuality.score < 45
          ? "neutral"
          : wallet.tokenSpecificConvictionScore >= 65 && riskAverage < 50
          ? "positive"
          : wallet.tokenSpecificConvictionScore <= 40 || riskAverage > 65
          ? "negative"
          : "neutral";

      return {
        walletAddress: wallet.walletAddress,
        shortAddress: shortAddress(wallet.walletAddress),
        rank: ranksByAddress.get(wallet.walletAddress.toLowerCase()),
        impact,
        reason: buildWalletImpactReason(wallet),
        tokenSpecificConvictionScore: wallet.tokenSpecificConvictionScore,
        botLikeActivityRisk: wallet.botLikeActivityRisk,
        rotationBehaviorRisk: wallet.rotationBehaviorRisk,
        accumulationPressure: wallet.accumulationPressure,
        distributionPressure: wallet.distributionPressure,
      };
    }),
  };
}

function buildFundingWalletInputs({
  deepResults,
  holders,
}: {
  holders: ReturnType<typeof mapLiveDataToConvictionInput>["input"]["holders"];
  deepResults: DeepWalletBehaviorResult[];
}): FundingWalletInput[] {
  const deepByAddress = new Map(
    deepResults.map((result) => [result.walletAddress.toLowerCase(), result])
  );

  return holders.map((holder) => {
    const deepWallet = deepByAddress.get(holder.address.toLowerCase());

    return {
      rank: holder.rank,
      address: holder.address,
      ownershipPercent: holder.ownershipPercent,
      walletAgeDays: holder.walletAgeDays,
      transactionCount: holder.transactionCount,
      recentTx30d: holder.recentTx30d,
      recentTx7d: holder.recentTx7d,
      interactedTokenCount: holder.interactedTokenCount,
      tokenTransferInCount:
        deepWallet?.tokenTransferInCount ?? holder.tokenTransferInCount,
      tokenTransferOutCount:
        deepWallet?.tokenTransferOutCount ?? holder.tokenTransferOutCount,
      tokenHoldDays: deepWallet?.estimatedTokenHoldDays ?? holder.tokenHoldDays,
      firstTokenActivityAt: deepWallet?.firstTokenActivityAt,
      nativeBalanceUsd: holder.nativeBalanceUsd,
    };
  });
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const { searchParams } = requestUrl;
  const chain = searchParams.get("chain")?.trim();
  const tokenAddress = searchParams.get("tokenAddress")?.trim();
  const tokenSymbol = searchParams.get("tokenSymbol")?.trim() || null;
  const limit = parseLimit(searchParams.get("limit"));
  const deepEnabled = searchParams.get("deep") === "true";
  const deepLimit = parseDeepLimit(searchParams.get("deepLimit"));

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

  if (limit === null) {
    return structuredError({
      code: "INVALID_LIMIT",
      message: "limit must be a number between 1 and 25.",
      details: { limit: searchParams.get("limit") },
      status: 400,
    });
  }

  const normalizedChain = mapChain(chain);
  const normalizedTokenAddress = tokenAddress.toLowerCase();
  const convictionCacheTtl = deepEnabled
    ? CONVICTION_DEEP_CACHE_TTL_SECONDS
    : CONVICTION_STANDARD_CACHE_TTL_SECONDS;
  const cacheKey = createTokenAnalysisCacheKey({
    route: "conviction-engine",
    chain: normalizedChain,
    tokenAddress: normalizedTokenAddress,
    tokenSymbol,
    mode: deepEnabled ? "deep" : "standard",
    limit,
    deepLimit,
    extra: {
      deep: deepEnabled,
      ...marketCacheBuckets(searchParams),
    },
  });

  const origin = requestUrl.origin;

  try {
    const cachedResult = await getOrSetCache<ConvictionEngineApiResponse>(
      cacheKey,
      convictionCacheTtl,
      async () => {
        const baseParams = new URLSearchParams({
          chain: normalizedChain,
          tokenAddress: normalizedTokenAddress,
        });
        const warnings: string[] = [];
        const holdersUrl = `${origin}/api/holders?${baseParams}`;
        const holdersResult = await fetchJson<{
          holders: LiveHolderRow[];
          summary: unknown;
        }>(holdersUrl);

        if (!holdersResult.ok) {
          throw new Error("HOLDER_DATA_FAILED");
        }

        const profileLimit = Math.min(limit, 10);
        if (limit > profileLimit) {
          warnings.push(
            "Wallet profile enrichment is currently capped at 10 wallets by the existing wallet-profiles route."
          );
        }

        const profileParams = new URLSearchParams({
          chain: normalizedChain,
          tokenAddress: normalizedTokenAddress,
          limit: String(profileLimit),
        });
        const profilesResult = await fetchJson<LiveWalletProfilesInput>(
          `${origin}/api/wallet-profiles?${profileParams}`
        );
        let walletProfiles: LiveWalletProfilesInput = null;

        if (profilesResult.ok) {
          walletProfiles = profilesResult.data;
        } else {
          warnings.push(
            "Wallet profile enrichment was unavailable; conviction was calculated from holder data and available market/cluster inputs."
          );
        }

        const clusterParams = new URLSearchParams({
          chain: normalizedChain,
          tokenAddress: normalizedTokenAddress,
          limit: String(limit),
        });
        const clusterResult = await fetchJson<LiveClusterSummary>(
          `${origin}/api/wallet-clusters?${clusterParams}`
        );
        let clusterSummary: LiveClusterSummary | null = null;

        if (clusterResult.ok) {
          clusterSummary = clusterResult.data;
        } else {
          warnings.push(
            "Cluster enrichment was unavailable; conviction was calculated without cluster risk enrichment."
          );
        }

        const mapped = mapLiveDataToConvictionInput({
          chain: normalizedChain,
          tokenAddress: normalizedTokenAddress,
          tokenSymbol: tokenSymbol || undefined,
          holders: holdersResult.data,
          walletProfiles,
          clusterSummary,
          marketData: marketDataFromSearchParams(searchParams),
        });
        let convictionInput = mapped.input;
        let deepBehavior: ConvictionEngineApiResponse["deepBehavior"];
        let deepBehaviorImpact: ConvictionEngineApiResponse["deepBehaviorImpact"];
        let bundleDetection: ConvictionEngineApiResponse["bundleDetection"];
        const baselineResult = calculateConvictionEngine(mapped.input);

        if (deepEnabled) {
          const apiKey = process.env.MORALIS_API_KEY;

          if (!apiKey) {
            warnings.push(
              "Deep behavior was requested but MORALIS_API_KEY is unavailable; standard conviction was returned."
            );
          } else {
            try {
              const deepCacheKey = createTokenAnalysisCacheKey({
                route: "conviction-deep-behavior",
                chain: normalizedChain,
                tokenAddress: normalizedTokenAddress,
                mode: "deep",
                deepLimit,
              });
              const deepCachedResult =
                await getOrSetCache<DeepWalletBehaviorBatchResult>(
                  deepCacheKey,
                  CONVICTION_DEEP_CACHE_TTL_SECONDS,
                  () =>
                    analyzeDeepWalletBehaviorBatch({
                      chain: normalizedChain,
                      tokenAddress: normalizedTokenAddress,
                      holders: convictionInput.holders,
                      deepLimit,
                      fetchTransfersForWallet: (walletAddress) =>
                        fetchMoralisTransfers({
                          apiKey,
                          chain: normalizedChain,
                          tokenAddress: normalizedTokenAddress,
                          walletAddress,
                        }),
                    }),
                  { provider: "moralis", route: "conviction-deep-behavior" }
                );
              const deepResult = deepCachedResult.value;
              const deepByAddress = new Map(
                deepResult.results.map((result) => [
                  result.walletAddress.toLowerCase(),
                  result,
                ])
              );
              const ranksByAddress = new Map(
                convictionInput.holders.map((holder) => [
                  holder.address.toLowerCase(),
                  holder.rank,
                ])
              );

              convictionInput = {
                ...convictionInput,
                holders: convictionInput.holders.map((holder) => {
                  const deepWallet = deepByAddress.get(holder.address.toLowerCase());
                  if (!deepWallet) return holder;

                  return {
                    ...holder,
                    tokenTransferInCount: deepWallet.tokenTransferInCount,
                    tokenTransferOutCount: deepWallet.tokenTransferOutCount,
                    tokenHoldDays: deepWallet.estimatedTokenHoldDays,
                    daysSinceLastActive:
                      deepWallet.daysSinceLastTokenActivity ??
                      holder.daysSinceLastActive,
                    deepBotLikeActivityRisk: deepWallet.botLikeActivityRisk,
                    deepRotationBehaviorRisk: deepWallet.rotationBehaviorRisk,
                    deepTokenSpecificConvictionScore:
                      deepWallet.tokenSpecificConvictionScore,
                    deepWalletBehaviorQualityScore:
                      deepWallet.walletBehaviorQualityScore,
                  };
                }),
              };
              deepBehavior = {
                enabled: true,
                analyzedWallets: deepResult.summary.analyzedWallets,
                summary: deepResult.summary,
                walletResults: deepResult.results,
                warnings: deepResult.warnings,
              };
              try {
                bundleDetection = analyzeFundingBundle({
                  chain: normalizedChain,
                  tokenAddress: normalizedTokenAddress,
                  tokenSymbol: tokenSymbol || undefined,
                  wallets: buildFundingWalletInputs({
                    holders: convictionInput.holders,
                    deepResults: deepResult.results,
                  }),
                });
                convictionInput = {
                  ...convictionInput,
                  bundleRiskScore: bundleDetection.bundleRiskScore,
                  fundingSimilarityScore: bundleDetection.fundingSimilarityScore,
                  fakeDecentralizationRisk:
                    bundleDetection.fakeDecentralizationRisk,
                };
              } catch {
                warnings.push(
                  "Funding and bundle detection failed; conviction was calculated without bundle-risk enrichment."
                );
              }
              const enrichedPreview = calculateConvictionEngine(convictionInput);
              deepBehaviorImpact = buildDeepBehaviorImpact({
                baseline: baselineResult,
                enriched: enrichedPreview,
                deepResults: deepResult.results,
                ranksByAddress,
              });
              warnings.push(
                "Deep behavior uses token transfer history and directional inference; DEX buy/sell semantics may be approximate when only transfer direction is available."
              );
            } catch {
              warnings.push(
                "Deep behavior enrichment failed; standard conviction was returned."
              );
            }
          }
        }

        const result = calculateConvictionEngine(convictionInput);

        return {
          chain: normalizedChain,
          tokenAddress: normalizedTokenAddress,
          tokenSymbol,
          finalConvictionScore: result.finalConvictionScore,
          subScores: result.subScores,
          aggregation: result.aggregation,
          explanation: result.explanation,
          dataConfidence: result.dataConfidence,
          walletBreakdowns: result.walletBreakdowns,
          mapperCoverage: {
            ...mapped.coverage,
            hasTokenTransferData: Boolean(deepBehavior?.analyzedWallets),
          },
          mapperWarnings: mapped.mapperWarnings,
          warnings: [...warnings, ...result.warnings],
          deepBehavior,
          deepBehaviorImpact,
          bundleDetection,
          status: deepBehavior
            ? "live_with_deep_behavior"
            : profilesResult.ok && clusterResult.ok && mapped.coverage.hasMarketData
            ? "live"
            : "partial",
        };
      },
      {
        provider: deepEnabled ? "moralis" : "internal",
        route: "conviction-engine",
      }
    );

    return NextResponse.json({
      ...cachedResult.value,
      warnings: [
        ...cachedResult.value.warnings,
        cacheAgeWarning(convictionCacheTtl),
      ],
      cache: cachedResult.cache,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "HOLDER_DATA_FAILED") {
      return structuredError({
        code: "HOLDER_DATA_FAILED",
        message: "Holder data is required before conviction can be calculated.",
        details: { source: "holders" },
        status: 502,
      });
    }

    return structuredError({
      code: "CONVICTION_ENGINE_FAILED",
      message: "Conviction Engine request failed unexpectedly.",
      status: 500,
    });
  }
}
