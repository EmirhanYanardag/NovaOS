import { NextResponse } from "next/server";
import {
  cacheAgeWarning,
  createCacheKey,
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

type MoralisTokenBalance = {
  token_address?: string;
  balance?: string;
  balance_formatted?: string;
  symbol?: string;
  name?: string;
};

type MoralisTokenBalancesResponse = {
  result?: MoralisTokenBalance[];
};

type BatchWalletProfile = {
  rank: number;
  walletAddress: string;
  shortAddress: string;
  balance: string;
  ownershipPercentage: string;
  isContract: boolean | null;
  nativeBalance: {
    raw: string;
    formatted: string;
  } | null;
  transactionCount: number | null;
  firstSeen: string | null;
  lastActive: string | null;
  recentActivityCount: number | null;
  tokenBalance: {
    tokenAddress: string;
    raw: string;
    formatted: string;
    symbol: string | null;
    name: string | null;
  } | null;
  dataQuality: DataQuality;
  walletAgeDays: number | null;
  daysSinceLastActive: number | null;
  activityVelocityScore: number;
  dormancyRiskScore: number;
  concentrationRiskScore: number;
  behaviorReliabilityScore: number;
  activityScore: number;
  maturityScore: number;
  concentrationScore: number;
  dataConfidence: number;
  behaviorClass: BehaviorClass;
  behaviorExplanation: string;
  behaviorStatus: "pending_v2";
  notes: string[];
};

type WalletProfilesResponse = {
  tokenAddress: string;
  chain: string;
  limit: number;
  profiles: BatchWalletProfile[];
  summary: {
    profiledWallets: number;
    goodProfiles: number;
    partialProfiles: number;
    unavailableProfiles: number;
    averageActivityScore: number;
    averageMaturityScore: number;
    highestConcentrationScore: number;
    averageDataConfidence: number;
    dominantBehaviorClass: BehaviorClass | "unavailable";
    averageWalletAgeDays: number | null;
    averageActivityVelocity: number;
    averageDormancyRisk: number;
    highestConcentrationRisk: number;
    reliabilityAverage: number;
  };
  warnings?: string[];
  cache?: CacheMetadata;
};

type ApiErrorCode =
  | "MISSING_API_KEY"
  | "MISSING_CHAIN"
  | "MISSING_TOKEN_ADDRESS"
  | "INVALID_TOKEN_ADDRESS"
  | "INVALID_LIMIT"
  | "WALLET_PROFILES_FAILED";

const WALLET_PROFILES_CACHE_TTL_SECONDS = 300;

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

function shortAddress(address: string) {
  if (!address || address.length < 10) return address || "Unknown";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatTokenBalance(value?: string) {
  const num = Number(value || 0);

  if (!num) return "0";
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;

  return num.toFixed(2);
}

function formatNativeBalance(raw?: string) {
  if (!raw) return null;

  try {
    const wei = BigInt(raw);
    const divisor = BigInt("1000000000000000000");
    const whole = wei / divisor;
    const fraction = wei % divisor;
    const fractionText = fraction.toString().padStart(18, "0").slice(0, 6);
    const trimmedFraction = fractionText.replace(/0+$/, "");

    return trimmedFraction
      ? `${whole.toString()}.${trimmedFraction}`
      : whole.toString();
  } catch {
    return raw;
  }
}

function formatPercent(value?: number) {
  const num = Number(value || 0);
  if (!num) return "0.000%";
  return `${num.toFixed(3)}%`;
}

function getHolderAddress(holder: MoralisHolder) {
  return holder.owner_address || holder.ownerAddress || holder.address || "";
}

function getHolderBalance(holder: MoralisHolder) {
  return holder.balance_formatted || holder.balanceFormatted || holder.balance || "0";
}

function getHolderPercentage(holder: MoralisHolder) {
  return (
    Number(holder.percentage_relative_to_total_supply) ||
    Number(holder.percentage) ||
    0
  );
}

function parseTimestamp(value?: string) {
  if (!value) return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;
  return new Date(time).toISOString();
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

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function daysSince(value: string | null) {
  if (!value) return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;
  return Math.max(0, (Date.now() - time) / 86_400_000);
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

  const lifetimeComponent = Math.min(35, Math.log10((transactionCount || 0) + 1) * 12);
  const pageActivityComponent = Math.min(45, (recentActivityCount || 0) * 0.45);
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

  return clampScore(lifetimeComponent + pageActivityComponent + recencyComponent);
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
  isContract: boolean | null;
  dataQuality: DataQuality;
  walletAgeDays: number | null;
  activityVelocityScore: number;
  dormancyRiskScore: number;
  concentrationRiskScore: number;
}): BehaviorClass {
  if (isContract) return "contract/system";
  if (dataQuality === "unavailable") return "insufficient data";
  if (walletAgeDays !== null && walletAgeDays <= 14) return "new/fresh wallet";
  if (concentrationRiskScore >= 70 && dormancyRiskScore >= 60) return "dormant whale";
  if (concentrationRiskScore >= 70 && activityVelocityScore >= 45) return "active whale";
  if (activityVelocityScore >= 60) return "active accumulator";
  return "passive holder";
}

function scoreProfile({
  isContract,
  dataQuality,
  transactionCount,
  recentActivityCount,
  firstSeen,
  lastActive,
  nativeBalance,
  ownershipPercentage,
}: {
  isContract: boolean | null;
  dataQuality: DataQuality;
  transactionCount: number | null;
  recentActivityCount: number | null;
  firstSeen: string | null;
  lastActive: string | null;
  nativeBalance: BatchWalletProfile["nativeBalance"];
  ownershipPercentage: number;
}) {
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
    hasNativeBalance: Boolean(nativeBalance),
  });
  const behaviorClass = classifyBehavior({
    isContract,
    dataQuality,
    walletAgeDays,
    activityVelocityScore,
    dormancyRiskScore,
    concentrationRiskScore,
  });
  const behaviorExplanation =
    `Classified as ${behaviorClass} from activity velocity ${activityVelocityScore}, ` +
    `dormancy risk ${dormancyRiskScore}, concentration risk ${concentrationRiskScore}, ` +
    `and reliability ${behaviorReliabilityScore}. This is metadata/activity inference, not profitability analysis.`;

  return {
    walletAgeDays,
    daysSinceLastActive,
    activityVelocityScore,
    dormancyRiskScore,
    concentrationRiskScore,
    behaviorReliabilityScore,
    activityScore: activityVelocityScore,
    maturityScore:
      walletAgeDays === null
        ? 0
        : clampScore(Math.min(100, (walletAgeDays / 365) * 100)),
    concentrationScore: concentrationRiskScore,
    dataConfidence: behaviorReliabilityScore,
    behaviorClass,
    behaviorExplanation,
  };
}

function averageScore(values: number[]) {
  if (values.length === 0) return 0;
  return clampScore(
    values.reduce((sum, value) => sum + value, 0) / values.length
  );
}

function dominantBehaviorClass(
  profiles: Pick<BatchWalletProfile, "behaviorClass">[]
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

function averageNullable(values: Array<number | null>) {
  const realValues = values.filter((value): value is number => value !== null);
  if (realValues.length === 0) return null;
  return Math.round(
    realValues.reduce((sum, value) => sum + value, 0) / realValues.length
  );
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
  limit,
}: {
  apiKey: string;
  chain: string;
  tokenAddress: string;
  limit: number;
}) {
  const url = new URL(
    `https://deep-index.moralis.io/api/v2.2/erc20/${tokenAddress}/owners`
  );

  url.searchParams.set("chain", chain);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("order", "DESC");

  const data = await fetchMoralisJson<MoralisHoldersResponse>({ url, apiKey });

  return (data.result || []).slice(0, limit);
}

async function profileWallet({
  apiKey,
  chain,
  tokenAddress,
  holder,
  rank,
}: {
  apiKey: string;
  chain: string;
  tokenAddress: string;
  holder: MoralisHolder;
  rank: number;
}): Promise<BatchWalletProfile> {
  const walletAddress = getHolderAddress(holder);
  const notes: string[] = [
    "Wallet Behavior Engine V2 metrics are pending.",
    "PnL, win rate, average hold time and smart money labels are not calculated.",
  ];

  let nativeBalance: BatchWalletProfile["nativeBalance"] = null;
  let transactionCount: number | null = null;
  let firstSeen: string | null = null;
  let lastActive: string | null = null;
  let recentActivityCount: number | null = null;
  let tokenBalance: BatchWalletProfile["tokenBalance"] = null;
  let hasNativeBalance = false;
  let hasTransactions = false;
  let hasTokenBalanceRead = false;

  if (!walletAddress) {
    const unavailableScores = scoreProfile({
      isContract: Boolean(holder.is_contract),
      dataQuality: "unavailable",
      transactionCount: null,
      recentActivityCount: null,
      firstSeen: null,
      lastActive: null,
      nativeBalance: null,
      ownershipPercentage: getHolderPercentage(holder),
    });

    return {
      rank,
      walletAddress: "",
      shortAddress: "Unknown",
      balance: formatTokenBalance(getHolderBalance(holder)),
      ownershipPercentage: formatPercent(getHolderPercentage(holder)),
      isContract: Boolean(holder.is_contract),
      nativeBalance: null,
      transactionCount: null,
      firstSeen: null,
      lastActive: null,
      recentActivityCount: null,
      tokenBalance: null,
      dataQuality: "unavailable",
      ...unavailableScores,
      behaviorStatus: "pending_v2",
      notes: [
        ...notes,
        "Holder address was unavailable in Moralis holder data.",
        "Scores are zero or low-confidence because wallet profile data is unavailable.",
      ],
    };
  }

  try {
    const nativeUrl = new URL(
      `https://deep-index.moralis.io/api/v2.2/${walletAddress}/balance`
    );
    nativeUrl.searchParams.set("chain", chain);

    const nativeData = await fetchMoralisJson<MoralisNativeBalanceResponse>({
      url: nativeUrl,
      apiKey,
    });

    if (nativeData.balance) {
      nativeBalance = {
        raw: nativeData.balance,
        formatted: formatNativeBalance(nativeData.balance) || nativeData.balance,
      };
      hasNativeBalance = true;
      notes.push("Native balance is returned directly by Moralis.");
    }
  } catch {
    notes.push("Native balance unavailable from Moralis for this wallet.");
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
    notes.push(
      "Transaction count and timestamps are inferred from Moralis native wallet transactions."
    );
    notes.push(
      "firstSeen is the oldest transaction in the returned page, not guaranteed lifetime wallet creation."
    );
  } catch {
    notes.push("Native wallet transaction history unavailable from Moralis.");
  }

  try {
    const tokenUrl = new URL(
      `https://deep-index.moralis.io/api/v2.2/wallets/${walletAddress}/tokens`
    );
    tokenUrl.searchParams.set("chain", chain);
    tokenUrl.searchParams.set("exclude_spam", "true");

    const tokenData = await fetchMoralisJson<MoralisTokenBalancesResponse>({
      url: tokenUrl,
      apiKey,
    });

    const normalizedTokenAddress = tokenAddress.toLowerCase();
    const matchingToken = (tokenData.result || []).find(
      (token) => token.token_address?.toLowerCase() === normalizedTokenAddress
    );

    if (matchingToken) {
      tokenBalance = {
        tokenAddress,
        raw: matchingToken.balance || "0",
        formatted: matchingToken.balance_formatted || matchingToken.balance || "0",
        symbol: matchingToken.symbol || null,
        name: matchingToken.name || null,
      };
    } else {
      tokenBalance = {
        tokenAddress,
        raw: "0",
        formatted: "0",
        symbol: null,
        name: null,
      };
      notes.push("Moralis returned no matching token balance for this wallet.");
    }

    hasTokenBalanceRead = true;
    notes.push("Token balance check uses Moralis wallet token balances.");
  } catch {
    notes.push("Token balance unavailable from Moralis for this wallet.");
  }

  notes.push("Holder balance and ownership percentage come from Moralis token owners.");

  const dataQuality: DataQuality =
    hasNativeBalance && hasTransactions
      ? "good"
      : hasNativeBalance || hasTransactions || hasTokenBalanceRead
      ? "partial"
      : "unavailable";
  const ownershipPercentage = getHolderPercentage(holder);
  const scores = scoreProfile({
    isContract: Boolean(holder.is_contract),
    dataQuality,
    transactionCount,
    recentActivityCount,
    firstSeen,
    lastActive,
    nativeBalance,
    ownershipPercentage,
  });

  notes.push(
    "activityVelocityScore uses transactionCount, recentActivityCount and daysSinceLastActive."
  );
  notes.push(
    "walletAgeDays is inferred from firstSeen in returned Moralis transactions; it is not a guaranteed wallet creation date."
  );
  notes.push(
    "dormancyRiskScore uses daysSinceLastActive from returned Moralis transactions."
  );
  notes.push(
    "concentrationRiskScore uses holder ownership percentage from Moralis token owners."
  );
  notes.push("behaviorReliabilityScore uses dataQuality plus available wallet age, activity and native balance fields.");
  notes.push("behaviorClass is behavior inference from wallet metadata and transaction activity, not profitability analysis.");

  return {
    rank,
    walletAddress,
    shortAddress: shortAddress(walletAddress),
    balance: formatTokenBalance(getHolderBalance(holder)),
    ownershipPercentage: formatPercent(ownershipPercentage),
    isContract: Boolean(holder.is_contract),
    nativeBalance,
    transactionCount,
    firstSeen,
    lastActive,
    recentActivityCount,
    tokenBalance,
    dataQuality,
    ...scores,
    behaviorStatus: "pending_v2",
    notes,
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
  const requestedLimit = Number(searchParams.get("limit") || 5);

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
      message: "limit must be a number between 1 and 10.",
      details: { limit: searchParams.get("limit") },
      status: 400,
    });
  }

  const limit = Math.min(10, Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : 5));
  const mappedChain = mapChain(chain);
  const cacheKey = createCacheKey({
    route: "wallet-profiles",
    chain: mappedChain,
    tokenAddress,
    extra: { limit },
  });

  try {
    const cachedResult = await getOrSetCache<WalletProfilesResponse>(
      cacheKey,
      WALLET_PROFILES_CACHE_TTL_SECONDS,
      async () => {
        const holders = await fetchTopHolders({
          apiKey,
          chain: mappedChain,
          tokenAddress,
          limit,
        });

        const profiles = await Promise.all(
          holders.map((holder, index) =>
            profileWallet({
              apiKey,
              chain: mappedChain,
              tokenAddress,
              holder,
              rank: index + 1,
            })
          )
        );

        const summary = {
      profiledWallets: profiles.length,
      goodProfiles: profiles.filter((profile) => profile.dataQuality === "good").length,
      partialProfiles: profiles.filter((profile) => profile.dataQuality === "partial").length,
      unavailableProfiles: profiles.filter(
        (profile) => profile.dataQuality === "unavailable"
      ).length,
      averageActivityScore: averageScore(
        profiles.map((profile) => profile.activityScore)
      ),
      averageMaturityScore: averageScore(
        profiles.map((profile) => profile.maturityScore)
      ),
      highestConcentrationScore:
        profiles.length > 0
          ? Math.max(...profiles.map((profile) => profile.concentrationScore))
          : 0,
      averageDataConfidence: averageScore(
        profiles.map((profile) => profile.dataConfidence)
      ),
      dominantBehaviorClass: dominantBehaviorClass(profiles),
      averageWalletAgeDays: averageNullable(
        profiles.map((profile) => profile.walletAgeDays)
      ),
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

        return {
          tokenAddress,
          chain: mappedChain,
          limit,
          profiles,
          summary,
        };
      }
    );

    return NextResponse.json({
      ...cachedResult.value,
      warnings: [
        ...(cachedResult.value.warnings || []),
        cacheAgeWarning(WALLET_PROFILES_CACHE_TTL_SECONDS),
      ],
      cache: cachedResult.cache,
    });
  } catch (error) {
    return structuredError({
      code: "WALLET_PROFILES_FAILED",
      message:
        error instanceof Error
          ? error.message
          : "Wallet profile batch request failed.",
      status: 500,
    });
  }
}
