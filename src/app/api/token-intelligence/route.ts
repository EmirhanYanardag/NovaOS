import { NextResponse } from "next/server";
import {
  cacheAgeWarning,
  createTokenAnalysisCacheKey,
  getOrSetCache,
  type CacheMetadata,
} from "../../../lib/cache";

type DataQuality = "partial" | "good" | "unavailable";

type BehaviorClass =
  | "contract/system"
  | "dormant whale"
  | "active whale"
  | "active accumulator"
  | "passive holder"
  | "new/fresh wallet"
  | "insufficient data";

type MoralisHolder = {
  owner_address?: string;
  ownerAddress?: string;
  address?: string;
  balance?: string;
  balance_formatted?: string;
  balanceFormatted?: string;
  percentage_relative_to_total_supply?: number;
  percentage?: number;
  label?: string;
  entity?: string;
  is_contract?: boolean;
};

type MoralisHoldersResponse = {
  result?: MoralisHolder[];
};

type MoralisNativeBalanceResponse = {
  balance?: string;
};

type MoralisTransaction = {
  block_timestamp?: string;
};

type MoralisTransactionResponse = {
  result?: MoralisTransaction[];
  total?: number;
};

type TokenWalletProfile = {
  walletAddress: string;
  ownershipPercentage: number;
  isContract: boolean;
  isExchange: boolean;
  dataQuality: DataQuality;
  walletAgeDays: number | null;
  daysSinceLastActive: number | null;
  activityVelocityScore: number;
  dormancyRiskScore: number;
  concentrationRiskScore: number;
  behaviorReliabilityScore: number;
  behaviorClass: BehaviorClass;
};

type TokenIntelligenceResponse = {
  tokenAddress: string;
  chain: string;
  analyzedWallets: number;
  holderSummary: {
    holderCount: number;
    top10Ownership: string;
    top25Ownership: string;
    whaleCount: number;
    contractCount: number;
    exchangeCount: number;
  };
  behaviorSummary: {
    dominantBehaviorClass: BehaviorClass | "unavailable";
    averageActivityVelocity: number;
    averageDormancyRisk: number;
    highestConcentrationRisk: number;
    reliabilityAverage: number;
  };
  scores: {
    convictionScore: number;
    insiderRiskScore: number;
    holderQualityScore: number;
    activityScore: number;
    reliabilityScore: number;
  };
  thesis: {
    headline: string;
    bullets: string[];
    riskNotes: string[];
    confidenceLabel: "High" | "Medium" | "Low";
  };
  warnings: string[];
  cache?: CacheMetadata;
};

type ApiErrorCode =
  | "MISSING_API_KEY"
  | "MISSING_CHAIN"
  | "MISSING_TOKEN_ADDRESS"
  | "INVALID_TOKEN_ADDRESS"
  | "INVALID_LIMIT"
  | "MORALIS_REQUEST_FAILED"
  | "UNEXPECTED_ERROR";

const TOKEN_INTELLIGENCE_CACHE_TTL_SECONDS = 600;

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

function getHolderAddress(holder: MoralisHolder) {
  return holder.owner_address || holder.ownerAddress || holder.address || "";
}

function getHolderPercentage(holder: MoralisHolder) {
  return (
    Number(holder.percentage_relative_to_total_supply) ||
    Number(holder.percentage) ||
    0
  );
}

function formatPercent(value: number) {
  if (!value) return "0.000%";
  return `${value.toFixed(3)}%`;
}

function parseTimestamp(value?: string) {
  if (!value) return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;
  return new Date(time).toISOString();
}

function daysSince(value: string | null) {
  if (!value) return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;
  return Math.max(0, (Date.now() - time) / 86_400_000);
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function isExchangeLabel(label?: string) {
  const lower = (label || "").toLowerCase();

  return (
    lower.includes("exchange") ||
    lower.includes("binance") ||
    lower.includes("bybit") ||
    lower.includes("coinbase") ||
    lower.includes("okx") ||
    lower.includes("kucoin") ||
    lower.includes("gate") ||
    lower.includes("mexc") ||
    lower.includes("kraken")
  );
}

function pickTransactionWindow(transactions: MoralisTransaction[]) {
  const timestamps = transactions
    .map((transaction) => parseTimestamp(transaction.block_timestamp))
    .filter((timestamp): timestamp is string => Boolean(timestamp))
    .sort((a, b) => Date.parse(a) - Date.parse(b));

  return {
    firstSeen: timestamps[0] || null,
    lastActive: timestamps[timestamps.length - 1] || null,
  };
}

function calculateActivityVelocityScore({
  transactionCount,
  recentActivityCount,
  daysSinceLastActive,
}: {
  transactionCount: number | null;
  recentActivityCount: number | null;
  daysSinceLastActive: number | null;
}) {
  if (transactionCount === null && recentActivityCount === null) return 0;

  const lifetimeComponent = Math.min(
    35,
    Math.log10((transactionCount || 0) + 1) * 12
  );
  const recentComponent = Math.min(45, (recentActivityCount || 0) * 0.45);
  const recencyComponent =
    daysSinceLastActive === null
      ? 0
      : daysSinceLastActive <= 7
      ? 20
      : daysSinceLastActive <= 30
      ? 14
      : daysSinceLastActive <= 90
      ? 8
      : 2;

  return clampScore(lifetimeComponent + recentComponent + recencyComponent);
}

function calculateDormancyRiskScore(daysSinceLastActive: number | null) {
  if (daysSinceLastActive === null) return 60;
  if (daysSinceLastActive <= 7) return 5;
  if (daysSinceLastActive <= 30) return 15;
  if (daysSinceLastActive <= 90) return 35;
  if (daysSinceLastActive <= 180) return 55;
  if (daysSinceLastActive <= 365) return 75;
  return 90;
}

function calculateConcentrationRiskScore(ownershipPercentage: number) {
  return clampScore(Math.min(100, ownershipPercentage * 25));
}

function calculateReliabilityScore({
  dataQuality,
  hasWalletAge,
  hasLastActive,
  hasNativeBalance,
}: {
  dataQuality: DataQuality;
  hasWalletAge: boolean;
  hasLastActive: boolean;
  hasNativeBalance: boolean;
}) {
  const base =
    dataQuality === "good" ? 65 : dataQuality === "partial" ? 35 : 10;
  const ageBonus = hasWalletAge ? 12 : 0;
  const activityBonus = hasLastActive ? 13 : 0;
  const balanceBonus = hasNativeBalance ? 10 : 0;

  return clampScore(base + ageBonus + activityBonus + balanceBonus);
}

function classifyBehavior({
  isContract,
  dataQuality,
  walletAgeDays,
  activityVelocityScore,
  dormancyRiskScore,
  concentrationRiskScore,
}: {
  isContract: boolean;
  dataQuality: DataQuality;
  walletAgeDays: number | null;
  activityVelocityScore: number;
  dormancyRiskScore: number;
  concentrationRiskScore: number;
}): BehaviorClass {
  if (isContract) return "contract/system";
  if (dataQuality === "unavailable") return "insufficient data";
  if (walletAgeDays !== null && walletAgeDays <= 14) return "new/fresh wallet";
  if (concentrationRiskScore >= 70 && dormancyRiskScore >= 60) {
    return "dormant whale";
  }
  if (concentrationRiskScore >= 70 && activityVelocityScore >= 45) {
    return "active whale";
  }
  if (activityVelocityScore >= 60) return "active accumulator";
  return "passive holder";
}

function averageScore(values: number[]) {
  if (values.length === 0) return 0;
  return clampScore(
    values.reduce((sum, value) => sum + value, 0) / values.length
  );
}

function averageNullable(values: Array<number | null>) {
  const realValues = values.filter((value): value is number => value !== null);
  if (realValues.length === 0) return null;
  return Math.round(
    realValues.reduce((sum, value) => sum + value, 0) / realValues.length
  );
}

function dominantBehaviorClass(
  profiles: Pick<TokenWalletProfile, "behaviorClass">[]
): BehaviorClass | "unavailable" {
  if (profiles.length === 0) return "unavailable";

  const counts = new Map<BehaviorClass, number>();

  for (const profile of profiles) {
    counts.set(
      profile.behaviorClass,
      (counts.get(profile.behaviorClass) || 0) + 1
    );
  }

  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ||
    "unavailable";
}

async function fetchMoralisJson<T>({
  url,
  apiKey,
}: {
  url: URL;
  apiKey: string;
}) {
  const response = await fetch(url.toString(), {
    headers: {
      accept: "application/json",
      "X-API-Key": apiKey,
    },
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || "Moralis request failed.");
  }

  return data as T;
}

async function fetchTopHolders({
  apiKey,
  chain,
  tokenAddress,
}: {
  apiKey: string;
  chain: string;
  tokenAddress: string;
}) {
  const url = new URL(
    `https://deep-index.moralis.io/api/v2.2/erc20/${tokenAddress}/owners`
  );

  url.searchParams.set("chain", chain);
  url.searchParams.set("limit", "100");
  url.searchParams.set("order", "DESC");

  const data = await fetchMoralisJson<MoralisHoldersResponse>({ url, apiKey });

  return data.result || [];
}

async function profileHolder({
  apiKey,
  chain,
  holder,
}: {
  apiKey: string;
  chain: string;
  holder: MoralisHolder;
}): Promise<TokenWalletProfile> {
  const walletAddress = getHolderAddress(holder);
  const ownershipPercentage = getHolderPercentage(holder);
  const label = holder.label || holder.entity || "";
  const isContract = Boolean(holder.is_contract);
  const isExchange = isExchangeLabel(label);

  if (!walletAddress || !isEvmAddress(walletAddress)) {
    return buildProfile({
      walletAddress,
      ownershipPercentage,
      isContract,
      isExchange,
      hasNativeBalance: false,
      transactionCount: null,
      recentActivityCount: null,
      firstSeen: null,
      lastActive: null,
      dataQuality: "unavailable",
    });
  }

  let hasNativeBalance = false;
  let hasTransactions = false;
  let transactionCount: number | null = null;
  let recentActivityCount: number | null = null;
  let firstSeen: string | null = null;
  let lastActive: string | null = null;

  try {
    const nativeUrl = new URL(
      `https://deep-index.moralis.io/api/v2.2/${walletAddress}/balance`
    );
    nativeUrl.searchParams.set("chain", chain);

    const nativeData = await fetchMoralisJson<MoralisNativeBalanceResponse>({
      url: nativeUrl,
      apiKey,
    });

    hasNativeBalance = Boolean(nativeData.balance);
  } catch {
    hasNativeBalance = false;
  }

  try {
    const transactionUrl = new URL(
      `https://deep-index.moralis.io/api/v2.2/${walletAddress}`
    );
    transactionUrl.searchParams.set("chain", chain);
    transactionUrl.searchParams.set("limit", "100");

    const transactionData =
      await fetchMoralisJson<MoralisTransactionResponse>({
        url: transactionUrl,
        apiKey,
      });
    const transactions = transactionData.result || [];
    const window = pickTransactionWindow(transactions);

    transactionCount =
      typeof transactionData.total === "number"
        ? transactionData.total
        : transactions.length;
    recentActivityCount = transactions.length;
    firstSeen = window.firstSeen;
    lastActive = window.lastActive;
    hasTransactions = true;
  } catch {
    hasTransactions = false;
  }

  const dataQuality: DataQuality =
    hasNativeBalance && hasTransactions
      ? "good"
      : hasNativeBalance || hasTransactions
      ? "partial"
      : "unavailable";

  return buildProfile({
    walletAddress,
    ownershipPercentage,
    isContract,
    isExchange,
    hasNativeBalance,
    transactionCount,
    recentActivityCount,
    firstSeen,
    lastActive,
    dataQuality,
  });
}

function buildProfile({
  walletAddress,
  ownershipPercentage,
  isContract,
  isExchange,
  hasNativeBalance,
  transactionCount,
  recentActivityCount,
  firstSeen,
  lastActive,
  dataQuality,
}: {
  walletAddress: string;
  ownershipPercentage: number;
  isContract: boolean;
  isExchange: boolean;
  hasNativeBalance: boolean;
  transactionCount: number | null;
  recentActivityCount: number | null;
  firstSeen: string | null;
  lastActive: string | null;
  dataQuality: DataQuality;
}): TokenWalletProfile {
  const walletAgeDaysRaw = daysSince(firstSeen);
  const daysSinceLastActiveRaw = daysSince(lastActive);
  const walletAgeDays =
    walletAgeDaysRaw === null ? null : Math.round(walletAgeDaysRaw);
  const daysSinceLastActive =
    daysSinceLastActiveRaw === null ? null : Math.round(daysSinceLastActiveRaw);
  const activityVelocityScore = calculateActivityVelocityScore({
    transactionCount,
    recentActivityCount,
    daysSinceLastActive,
  });
  const dormancyRiskScore = calculateDormancyRiskScore(daysSinceLastActive);
  const concentrationRiskScore =
    calculateConcentrationRiskScore(ownershipPercentage);
  const behaviorReliabilityScore = calculateReliabilityScore({
    dataQuality,
    hasWalletAge: walletAgeDays !== null,
    hasLastActive: daysSinceLastActive !== null,
    hasNativeBalance,
  });
  const behaviorClass = classifyBehavior({
    isContract,
    dataQuality,
    walletAgeDays,
    activityVelocityScore,
    dormancyRiskScore,
    concentrationRiskScore,
  });

  return {
    walletAddress,
    ownershipPercentage,
    isContract,
    isExchange,
    dataQuality,
    walletAgeDays,
    daysSinceLastActive,
    activityVelocityScore,
    dormancyRiskScore,
    concentrationRiskScore,
    behaviorReliabilityScore,
    behaviorClass,
  };
}

function buildHolderSummary(holders: MoralisHolder[]) {
  const top10Ownership = holders
    .slice(0, 10)
    .reduce((sum, holder) => sum + getHolderPercentage(holder), 0);
  const top25Ownership = holders
    .slice(0, 25)
    .reduce((sum, holder) => sum + getHolderPercentage(holder), 0);
  const whaleCount = holders.filter(
    (holder) => getHolderPercentage(holder) >= 1
  ).length;
  const contractCount = holders.filter((holder) =>
    Boolean(holder.is_contract)
  ).length;
  const exchangeCount = holders.filter((holder) =>
    isExchangeLabel(holder.label || holder.entity)
  ).length;

  return {
    holderCount: holders.length,
    top10Ownership,
    top25Ownership,
    whaleCount,
    contractCount,
    exchangeCount,
  };
}

function buildScores({
  top10Ownership,
  top25Ownership,
  whaleCount,
  contractCount,
  exchangeCount,
  profiles,
  behaviorSummary,
}: {
  top10Ownership: number;
  top25Ownership: number;
  whaleCount: number;
  contractCount: number;
  exchangeCount: number;
  profiles: TokenWalletProfile[];
  behaviorSummary: TokenIntelligenceResponse["behaviorSummary"];
}) {
  const averageWalletAgeDays = averageNullable(
    profiles.map((profile) => profile.walletAgeDays)
  );
  const matureWalletScore =
    averageWalletAgeDays === null
      ? 35
      : clampScore(Math.min(100, (averageWalletAgeDays / 365) * 100));
  const systemWalletPenalty = Math.min(
    35,
    (contractCount + exchangeCount) * 2
  );
  const nonSystemDistributionScore = clampScore(100 - systemWalletPenalty);
  const holderQualityScore = clampScore(
    behaviorSummary.reliabilityAverage * 0.45 +
      matureWalletScore * 0.3 +
      nonSystemDistributionScore * 0.25
  );
  const insiderRiskScore = clampScore(
    top10Ownership * 0.85 +
      top25Ownership * 0.45 +
      behaviorSummary.highestConcentrationRisk * 0.45 +
      whaleCount * 1.4
  );
  const activityScore = behaviorSummary.averageActivityVelocity;
  const reliabilityScore = behaviorSummary.reliabilityAverage;
  const convictionScore = clampScore(
    holderQualityScore * 0.34 +
      activityScore * 0.24 +
      reliabilityScore * 0.24 +
      (100 - behaviorSummary.averageDormancyRisk) * 0.18
  );

  return {
    convictionScore,
    insiderRiskScore,
    holderQualityScore,
    activityScore,
    reliabilityScore,
  };
}

function buildThesis({
  analyzedWallets,
  holderSummary,
  behaviorSummary,
  scores,
  profileCoverage,
}: {
  analyzedWallets: number;
  holderSummary: ReturnType<typeof buildHolderSummary>;
  behaviorSummary: TokenIntelligenceResponse["behaviorSummary"];
  scores: TokenIntelligenceResponse["scores"];
  profileCoverage: number;
}) {
  const confidenceLabel: "High" | "Medium" | "Low" =
    behaviorSummary.reliabilityAverage >= 75 && profileCoverage >= 0.7
      ? "High"
      : behaviorSummary.reliabilityAverage >= 45 && profileCoverage >= 0.4
      ? "Medium"
      : "Low";
  const headline =
    scores.insiderRiskScore >= 70
      ? "Token shows elevated holder concentration risk."
      : scores.convictionScore >= 65
      ? "Token shows moderate holder conviction from available metadata."
      : "Token intelligence remains early and should be treated cautiously.";
  const bullets = [
    `${analyzedWallets} top wallets profiled from holder distribution and wallet metadata.`,
    `Dominant inferred behavior class is ${behaviorSummary.dominantBehaviorClass}.`,
    `Average activity velocity is ${behaviorSummary.averageActivityVelocity}/100 with reliability at ${behaviorSummary.reliabilityAverage}/100.`,
    `Top 10 holders control ${formatPercent(holderSummary.top10Ownership)} of supply.`,
  ];

  if (holderSummary.contractCount > 0 || holderSummary.exchangeCount > 0) {
    bullets.push(
      `${holderSummary.contractCount} contract and ${holderSummary.exchangeCount} exchange-labeled holders were detected in the top holder set.`
    );
  }

  const riskNotes = [
    "Summary is inferred from holder distribution and wallet metadata, not profitability.",
    `Highest concentration risk is ${behaviorSummary.highestConcentrationRisk}/100.`,
  ];

  if (scores.insiderRiskScore >= 65) {
    riskNotes.push("Top holder concentration may increase rotation or insider-risk sensitivity.");
  }

  if (confidenceLabel === "Low") {
    riskNotes.push("Profile coverage or wallet metadata quality is limited.");
  }

  return {
    headline,
    bullets: bullets.slice(0, 5),
    riskNotes: riskNotes.slice(0, 4),
    confidenceLabel,
  };
}

export async function GET(request: Request) {
  const apiKey = process.env.MORALIS_API_KEY;

  if (!apiKey) {
    return structuredError({
      code: "MISSING_API_KEY",
      message: "Missing MORALIS_API_KEY in .env file.",
      status: 500,
    });
  }

  const { searchParams } = new URL(request.url);
  const chain = searchParams.get("chain");
  const tokenAddress = searchParams.get("tokenAddress");
  const requestedLimit = Number(searchParams.get("limit") || 10);

  if (!chain) {
    return structuredError({
      code: "MISSING_CHAIN",
      message: "Missing chain parameter.",
      status: 400,
    });
  }

  if (!tokenAddress) {
    return structuredError({
      code: "MISSING_TOKEN_ADDRESS",
      message: "Missing tokenAddress parameter.",
      status: 400,
    });
  }

  if (!isEvmAddress(tokenAddress)) {
    return structuredError({
      code: "INVALID_TOKEN_ADDRESS",
      message: "tokenAddress must be a valid EVM contract address.",
      details: { tokenAddress },
      status: 400,
    });
  }

  if (searchParams.get("limit") && !Number.isFinite(requestedLimit)) {
    return structuredError({
      code: "INVALID_LIMIT",
      message: "limit must be a number between 1 and 20.",
      details: { limit: searchParams.get("limit") },
      status: 400,
    });
  }

  const limit = Math.min(20, Math.max(1, requestedLimit));
  const mappedChain = mapChain(chain);
  const normalizedTokenAddress = tokenAddress.toLowerCase();
  const cacheKey = createTokenAnalysisCacheKey({
    route: "token-intelligence",
    chain: mappedChain,
    tokenAddress: normalizedTokenAddress,
    extra: { limit },
  });

  try {
    const cachedResult = await getOrSetCache<TokenIntelligenceResponse>(
      cacheKey,
      TOKEN_INTELLIGENCE_CACHE_TTL_SECONDS,
      async () => {
        const holders = await fetchTopHolders({
          apiKey,
          chain: mappedChain,
          tokenAddress: normalizedTokenAddress,
        });
        const holderSummaryRaw = buildHolderSummary(holders);
        const profiledHolders = holders.slice(0, limit);
        const profiles = await Promise.all(
          profiledHolders.map((holder) =>
            profileHolder({
              apiKey,
              chain: mappedChain,
              holder,
            })
          )
        );
        const behaviorSummary = {
      dominantBehaviorClass: dominantBehaviorClass(profiles),
      averageActivityVelocity: averageScore(
        profiles.map((profile) => profile.activityVelocityScore)
      ),
      averageDormancyRisk: averageScore(
        profiles.map((profile) => profile.dormancyRiskScore)
      ),
      highestConcentrationRisk:
        profiles.length > 0
          ? Math.max(...profiles.map((profile) => profile.concentrationRiskScore))
          : 0,
      reliabilityAverage: averageScore(
        profiles.map((profile) => profile.behaviorReliabilityScore)
      ),
        };
        const scores = buildScores({
          ...holderSummaryRaw,
          profiles,
          behaviorSummary,
        });
        const thesis = buildThesis({
          analyzedWallets: profiles.length,
          holderSummary: holderSummaryRaw,
          behaviorSummary,
          scores,
          profileCoverage:
            holderSummaryRaw.holderCount === 0
              ? 0
              : profiles.length / Math.min(holderSummaryRaw.holderCount, limit),
        });
        const warnings = [
          "Token intelligence is inferred from holder distribution and wallet metadata.",
          "PnL, win rate, average hold duration and smart money identity are not calculated.",
          "firstSeen is based on returned Moralis transaction history and is not guaranteed wallet creation time.",
        ];

        if (profiles.some((profile) => profile.dataQuality === "unavailable")) {
          warnings.push("Some profiled wallets had unavailable wallet metadata.");
        }

        return {
          tokenAddress: normalizedTokenAddress,
          chain: mappedChain,
          analyzedWallets: profiles.length,
          holderSummary: {
            holderCount: holderSummaryRaw.holderCount,
            top10Ownership: formatPercent(holderSummaryRaw.top10Ownership),
            top25Ownership: formatPercent(holderSummaryRaw.top25Ownership),
            whaleCount: holderSummaryRaw.whaleCount,
            contractCount: holderSummaryRaw.contractCount,
            exchangeCount: holderSummaryRaw.exchangeCount,
          },
          behaviorSummary,
          scores,
          thesis,
          warnings,
        };
      },
      { provider: "moralis", route: "token-intelligence" }
    );

    return NextResponse.json({
      ...cachedResult.value,
      warnings: [
        ...cachedResult.value.warnings,
        cacheAgeWarning(TOKEN_INTELLIGENCE_CACHE_TTL_SECONDS),
      ],
      cache: cachedResult.cache,
    });
  } catch (error) {
    return structuredError({
      code:
        error instanceof Error && error.message.includes("Moralis")
          ? "MORALIS_REQUEST_FAILED"
          : "UNEXPECTED_ERROR",
      message:
        error instanceof Error
          ? error.message
          : "Token intelligence request failed.",
      status: 500,
    });
  }
}
