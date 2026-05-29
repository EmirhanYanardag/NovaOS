import type {
  ConvictionClusterInput,
  ConvictionEngineInput,
  ConvictionMarketInput,
  ConvictionWalletInput,
} from "./conviction-engine";

export type LiveHolderRow = {
  rank?: number;
  address?: string;
  fullAddress?: string;
  walletAddress?: string;
  ownerAddress?: string;
  wallet?: string;
  balance?: string | number;
  ownershipPercentage?: string | number;
  percentage?: string | number;
  rawPercentage?: number;
  label?: string | null;
  entity?: string | null;
  type?: string | null;
  isContract?: boolean | null;
  estimatedCluster?: string;
  cluster?: string;
};

export type LiveWalletProfile = {
  rank?: number;
  walletAddress?: string;
  fullAddress?: string;
  address?: string;
  balance?: string | number;
  ownershipPercentage?: string | number;
  isContract?: boolean | null;
  nativeBalance?: {
    formatted?: string;
    raw?: string;
  } | null;
  transactionCount?: number | null;
  recentActivityCount?: number | null;
  walletAgeDays?: number | null;
  daysSinceLastActive?: number | null;
  activityVelocityScore?: number;
  dormancyRiskScore?: number;
  concentrationRiskScore?: number;
  behaviorReliabilityScore?: number;
  behaviorClass?: string;
};

export type LiveWalletProfilesInput =
  | LiveWalletProfile[]
  | {
      profiles?: LiveWalletProfile[];
      summary?: unknown;
    }
  | null
  | undefined;

export type LiveClusterSummary = {
  clusters?: Array<{
    riskLevel?: string;
    relationshipType?: string;
    walletCount?: number;
  }>;
  networkSummary?: {
    totalAnalyzedWallets?: number;
    clusteredWallets?: number;
    isolatedWallets?: number;
    averageClusterConfidence?: number;
    dominantRelationshipType?: string;
  };
};

export type LiveMarketData = {
  liquidity?: string | number;
  liquidityUsd?: string | number;
  marketCap?: string | number;
  marketCapUsd?: string | number;
  volume24h?: string | number;
  volume24hUsd?: string | number;
  change24h?: string | number;
  priceChange24h?: string | number;
  volumeChange24h?: string | number;
  raw?: {
    liquidity?: number;
    marketCap?: number;
    volume24h?: number;
    priceUsd?: number;
  };
};

export type ConvictionLiveMapperInput = {
  chain: string;
  tokenAddress: string;
  tokenSymbol?: string;
  holders?: LiveHolderRow[] | { holders?: LiveHolderRow[]; summary?: unknown };
  walletProfiles?: LiveWalletProfilesInput;
  clusterSummary?: LiveClusterSummary | null;
  marketData?: LiveMarketData | null;
};

export type ConvictionLiveMapperResult = {
  input: ConvictionEngineInput;
  mapperWarnings: string[];
  coverage: {
    holderCount: number;
    walletProfileCount: number;
    hasMarketData: boolean;
    hasClusterData: boolean;
    hasTokenTransferData: boolean;
  };
};

const exchangeKeywords = [
  "exchange",
  "binance",
  "coinbase",
  "okx",
  "kraken",
  "bybit",
  "kucoin",
  "gate",
  "mexc",
  "bitget",
  "crypto.com",
];

export function parseCompactNumber(value: string | number | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;

  const normalized = value
    .toString()
    .trim()
    .replace(/,/g, "")
    .replace(/\$/g, "")
    .replace(/%/g, "");
  const match = normalized.match(/^(-?\d+(?:\.\d+)?)([kmbt])?$/i);
  if (!match) {
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const numeric = Number(match[1]);
  const suffix = match[2]?.toLowerCase();
  const multiplier =
    suffix === "k"
      ? 1_000
      : suffix === "m"
      ? 1_000_000
      : suffix === "b"
      ? 1_000_000_000
      : suffix === "t"
      ? 1_000_000_000_000
      : 1;

  return numeric * multiplier;
}

export function parseUsdString(value: string | number | null | undefined) {
  return parseCompactNumber(value);
}

export function parsePercentString(value: string | number | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  return parseCompactNumber(value.toString().replace("%", ""));
}

function normalizeAddress(value?: string | null) {
  return value?.trim().toLowerCase() || "";
}

function getHolderRows(
  holders?: ConvictionLiveMapperInput["holders"]
): LiveHolderRow[] {
  if (Array.isArray(holders)) return holders;
  return holders?.holders || [];
}

function getWalletProfiles(
  walletProfiles?: LiveWalletProfilesInput
): LiveWalletProfile[] {
  if (Array.isArray(walletProfiles)) return walletProfiles;
  return walletProfiles?.profiles || [];
}

function getHolderAddress(holder: LiveHolderRow) {
  return (
    holder.fullAddress ||
    holder.walletAddress ||
    holder.ownerAddress ||
    holder.address ||
    ""
  );
}

function getProfileAddress(profile: LiveWalletProfile) {
  return profile.walletAddress || profile.fullAddress || profile.address || "";
}

function isExchangeLike(holder: LiveHolderRow) {
  const combined = [holder.label, holder.entity, holder.type, holder.wallet]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return exchangeKeywords.some((keyword) => combined.includes(keyword));
}

function parseNativeBalanceUsd(profile?: LiveWalletProfile) {
  if (!profile?.nativeBalance) return undefined;
  const formatted = profile.nativeBalance.formatted;
  if (!formatted) return undefined;
  return parseCompactNumber(formatted);
}

function mapMarketData(marketData?: LiveMarketData | null): ConvictionMarketInput | undefined {
  if (!marketData) return undefined;

  return {
    liquidityUsd: marketData.raw?.liquidity ?? parseUsdString(marketData.liquidityUsd ?? marketData.liquidity),
    marketCapUsd: marketData.raw?.marketCap ?? parseUsdString(marketData.marketCapUsd ?? marketData.marketCap),
    volume24hUsd: marketData.raw?.volume24h ?? parseUsdString(marketData.volume24hUsd ?? marketData.volume24h),
    priceChange24h: parsePercentString(
      marketData.priceChange24h ?? marketData.change24h
    ),
    volumeChange24h: parsePercentString(marketData.volumeChange24h),
  };
}

function mapClusterData(
  clusterSummary?: LiveClusterSummary | null
): ConvictionClusterInput | undefined {
  if (!clusterSummary?.networkSummary) return undefined;

  const totalAnalyzed = clusterSummary.networkSummary.totalAnalyzedWallets || 0;
  const clustered = clusterSummary.networkSummary.clusteredWallets || 0;
  const elevatedRiskClusterCount =
    clusterSummary.clusters?.filter((cluster) => cluster.riskLevel === "Elevated")
      .length || 0;

  return {
    averageClusterConfidence:
      clusterSummary.networkSummary.averageClusterConfidence,
    clusteredWalletPercent:
      totalAnalyzed > 0 ? Math.round((clustered / totalAnalyzed) * 100) : 0,
    dominantRelationshipType:
      clusterSummary.networkSummary.dominantRelationshipType,
    elevatedRiskClusterCount,
  };
}

function mapHolderToWalletInput(
  holder: LiveHolderRow,
  profile: LiveWalletProfile | undefined,
  fallbackRank: number
): ConvictionWalletInput {
  const address = getHolderAddress(holder) || getProfileAddress(profile || {});
  const ownershipPercent =
    typeof holder.rawPercentage === "number"
      ? holder.rawPercentage
      : parsePercentString(holder.ownershipPercentage ?? holder.percentage);
  const profileConcentrationRisk = profile?.concentrationRiskScore;
  const holderClusterRisk =
    holder.estimatedCluster?.toLowerCase().includes("concentrated") ||
    holder.cluster?.toLowerCase().includes("concentrated")
      ? 45
      : undefined;

  return {
    rank: holder.rank || profile?.rank || fallbackRank,
    address,
    balance: parseCompactNumber(profile?.balance ?? holder.balance),
    ownershipPercent,
    walletAgeDays: profile?.walletAgeDays ?? undefined,
    transactionCount: profile?.transactionCount ?? undefined,
    recentTx30d: profile?.recentActivityCount ?? undefined,
    recentTx7d:
      typeof profile?.activityVelocityScore === "number"
        ? Math.round(profile.activityVelocityScore / 10)
        : undefined,
    daysSinceLastActive: profile?.daysSinceLastActive ?? undefined,
    nativeBalanceUsd: parseNativeBalanceUsd(profile),
    isContract: profile?.isContract ?? holder.isContract ?? undefined,
    isExchange: isExchangeLike(holder),
    isFreshWallet:
      profile?.behaviorClass === "new/fresh wallet" ||
      (typeof profile?.walletAgeDays === "number" && profile.walletAgeDays <= 7),
    clusterRiskScore: profileConcentrationRisk ?? holderClusterRisk,
  };
}

export function mapLiveDataToConvictionInput({
  chain,
  tokenAddress,
  tokenSymbol,
  holders,
  walletProfiles,
  clusterSummary,
  marketData,
}: ConvictionLiveMapperInput): ConvictionLiveMapperResult {
  const mapperWarnings: string[] = [];
  const holderRows = getHolderRows(holders);
  const profiles = getWalletProfiles(walletProfiles);
  const profilesByAddress = new Map(
    profiles.map((profile) => [normalizeAddress(getProfileAddress(profile)), profile])
  );
  const mappedHolders = holderRows
    .map((holder, index) => {
      const address = normalizeAddress(getHolderAddress(holder));
      const profile = profilesByAddress.get(address);
      return mapHolderToWalletInput(holder, profile, index + 1);
    })
    .filter((holder) => holder.address);
  const holderSummary = !Array.isArray(holders) ? holders?.summary : undefined;
  const summaryRecord =
    holderSummary && typeof holderSummary === "object"
      ? (holderSummary as Record<string, unknown>)
      : {};

  if (holderRows.length === 0) {
    mapperWarnings.push("No holder rows were provided to the conviction mapper.");
  }

  if (profiles.length === 0) {
    mapperWarnings.push("Wallet profile data is unavailable; wallet metadata confidence will be lower.");
  }

  mapperWarnings.push(
    "Token-specific transfer in/out counts are not mapped yet; deeper transaction indexing is required."
  );

  return {
    input: {
      chain,
      tokenAddress,
      tokenSymbol,
      holders: mappedHolders,
      market: mapMarketData(marketData),
      cluster: mapClusterData(clusterSummary),
      holderCount:
        typeof summaryRecord.holderCount === "number"
          ? summaryRecord.holderCount
          : mappedHolders.length,
      top10OwnershipPercent: parsePercentString(summaryRecord.top10Ownership as string | number | undefined),
      top25OwnershipPercent: parsePercentString(summaryRecord.top25Ownership as string | number | undefined),
      top100OwnershipPercent: mappedHolders.reduce(
        (sum, holder) => sum + (holder.ownershipPercent || 0),
        0
      ),
      contractHolderCount:
        typeof summaryRecord.contractCount === "number"
          ? summaryRecord.contractCount
          : mappedHolders.filter((holder) => holder.isContract).length,
      exchangeHolderCount:
        typeof summaryRecord.exchangeCount === "number"
          ? summaryRecord.exchangeCount
          : mappedHolders.filter((holder) => holder.isExchange).length,
    },
    mapperWarnings,
    coverage: {
      holderCount: mappedHolders.length,
      walletProfileCount: profiles.length,
      hasMarketData: Boolean(marketData),
      hasClusterData: Boolean(clusterSummary?.networkSummary),
      hasTokenTransferData: false,
    },
  };
}

export function createMapperPreviewFromSyntheticLikeData() {
  return mapLiveDataToConvictionInput({
    chain: "base",
    tokenAddress: "0x0000000000000000000000000000000000000abc",
    tokenSymbol: "NOVA",
    holders: {
      holders: [
        {
          rank: 1,
          fullAddress: "0x0000000000000000000000000000000000000001",
          balance: "1.4M",
          ownershipPercentage: "2.4%",
          label: "Community holder",
        },
        {
          rank: 2,
          fullAddress: "0x0000000000000000000000000000000000000002",
          balance: "920K",
          ownershipPercentage: "1.2%",
          label: "Exchange wallet",
        },
      ],
      summary: {
        holderCount: 2,
        top10Ownership: "3.6%",
        top25Ownership: "3.6%",
        contractCount: 0,
        exchangeCount: 1,
      },
    },
    walletProfiles: {
      profiles: [
        {
          rank: 1,
          walletAddress: "0x0000000000000000000000000000000000000001",
          transactionCount: 420,
          recentActivityCount: 24,
          walletAgeDays: 180,
          daysSinceLastActive: 2,
          activityVelocityScore: 64,
          concentrationRiskScore: 26,
          behaviorClass: "active accumulator",
        },
      ],
    },
    marketData: {
      liquidity: "$1.8M",
      marketCap: "$18M",
      volume24h: "$1.1M",
      change24h: 8.4,
    },
    clusterSummary: {
      networkSummary: {
        totalAnalyzedWallets: 20,
        clusteredWallets: 4,
        isolatedWallets: 16,
        averageClusterConfidence: 32,
        dominantRelationshipType: "Behavioral Similarity",
      },
      clusters: [{ riskLevel: "Low", relationshipType: "Behavioral Similarity" }],
    },
  });
}
