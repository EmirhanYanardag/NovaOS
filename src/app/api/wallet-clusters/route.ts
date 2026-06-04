import { NextResponse } from "next/server";
import {
  cacheAgeWarning,
  createTokenAnalysisCacheKey,
  getOrSetCache,
  type CacheMetadata,
} from "../../../lib/cache";

type Confidence = "High" | "Medium" | "Low";
type RelationshipType =
  | "Behavioral Similarity"
  | "Activity Overlap"
  | "Possible Coordination"
  | "Passive Similarity"
  | "Isolated";
type RiskLevel = "Low" | "Medium" | "Elevated";
type DataQuality = "partial" | "good" | "unavailable";

type MoralisHolder = {
  owner_address?: string;
  ownerAddress?: string;
  address?: string;
  percentage_relative_to_total_supply?: number;
  percentage?: number;
  is_contract?: boolean;
};

type MoralisHoldersResponse = {
  result?: MoralisHolder[];
};

type MoralisTransaction = {
  block_timestamp?: string;
};

type MoralisTransactionResponse = {
  result?: MoralisTransaction[];
  total?: number;
};

type MoralisTokenTransfer = {
  block_timestamp?: string;
  token_address?: string;
  address?: string;
};

type MoralisTokenTransferResponse = {
  result?: MoralisTokenTransfer[];
};

type WalletClusterProfile = {
  walletAddress: string;
  shortAddress: string;
  ownershipPercentage: number;
  isContract: boolean;
  transactionCount: number | null;
  recentActivityCount: number;
  walletAgeDays: number | null;
  daysSinceLastActive: number | null;
  activityVelocityScore: number;
  dormancyRiskScore: number;
  concentrationRiskScore: number;
  interactedTokens: string[];
  dataQuality: DataQuality;
};

type WalletCluster = {
  clusterId: string;
  confidence: Confidence;
  relationshipType: RelationshipType;
  walletCount: number;
  wallets: Array<{
    walletAddress: string;
    shortAddress: string;
    ownershipPercentage: number;
    activityVelocityScore: number;
    dormancyRiskScore: number;
    concentrationRiskScore: number;
  }>;
  sharedSignals: string[];
  riskLevel: RiskLevel;
  explanation: string;
};

type WalletClustersResponse = {
  tokenAddress: string;
  chain: string;
  clusters: WalletCluster[];
  networkSummary: {
    totalAnalyzedWallets: number;
    clusteredWallets: number;
    isolatedWallets: number;
    averageClusterConfidence: number;
    dominantRelationshipType: RelationshipType | "Unavailable";
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

const WALLET_CLUSTERS_CACHE_TTL_SECONDS = 900;

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
  recentActivityCount: number;
  daysSinceLastActive: number | null;
}) {
  if (transactionCount === null && recentActivityCount === 0) return 0;

  const lifetimeComponent = Math.min(
    35,
    Math.log10((transactionCount || 0) + 1) * 12
  );
  const recentComponent = Math.min(45, recentActivityCount * 0.45);
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

function confidenceValue(confidence: Confidence) {
  if (confidence === "High") return 85;
  if (confidence === "Medium") return 60;
  return 35;
}

function confidenceFromScore(score: number): Confidence {
  if (score >= 78) return "High";
  if (score >= 55) return "Medium";
  return "Low";
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

  return data.result || [];
}

async function buildWalletProfile({
  apiKey,
  chain,
  holder,
}: {
  apiKey: string;
  chain: string;
  holder: MoralisHolder;
}): Promise<WalletClusterProfile> {
  const walletAddress = getHolderAddress(holder);
  const ownershipPercentage = getHolderPercentage(holder);
  const isContract = Boolean(holder.is_contract);

  let transactionCount: number | null = null;
  let recentActivityCount = 0;
  let firstSeen: string | null = null;
  let lastActive: string | null = null;
  let interactedTokens: string[] = [];
  let hasTransactions = false;
  let hasTransfers = false;

  if (!walletAddress || !isEvmAddress(walletAddress)) {
    return {
      walletAddress,
      shortAddress: shortAddress(walletAddress),
      ownershipPercentage,
      isContract,
      transactionCount,
      recentActivityCount,
      walletAgeDays: null,
      daysSinceLastActive: null,
      activityVelocityScore: 0,
      dormancyRiskScore: 60,
      concentrationRiskScore: calculateConcentrationRiskScore(ownershipPercentage),
      interactedTokens,
      dataQuality: "unavailable",
    };
  }

  try {
    const transactionUrl = new URL(
      `https://deep-index.moralis.io/api/v2.2/${walletAddress}`
    );
    transactionUrl.searchParams.set("chain", chain);
    transactionUrl.searchParams.set("limit", "50");

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

  try {
    const transferUrl = new URL(
      `https://deep-index.moralis.io/api/v2.2/${walletAddress}/erc20/transfers`
    );
    transferUrl.searchParams.set("chain", chain);
    transferUrl.searchParams.set("limit", "25");
    transferUrl.searchParams.set("order", "DESC");

    const transferData = await fetchMoralisJson<MoralisTokenTransferResponse>({
      url: transferUrl,
      apiKey,
    });

    interactedTokens = Array.from(
      new Set(
        (transferData.result || [])
          .map((transfer) => transfer.token_address || transfer.address || "")
          .filter((address) => isEvmAddress(address))
          .map((address) => address.toLowerCase())
      )
    ).slice(0, 12);
    hasTransfers = true;
  } catch {
    hasTransfers = false;
  }

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

  return {
    walletAddress,
    shortAddress: shortAddress(walletAddress),
    ownershipPercentage,
    isContract,
    transactionCount,
    recentActivityCount,
    walletAgeDays,
    daysSinceLastActive,
    activityVelocityScore,
    dormancyRiskScore: calculateDormancyRiskScore(daysSinceLastActive),
    concentrationRiskScore: calculateConcentrationRiskScore(ownershipPercentage),
    interactedTokens,
    dataQuality:
      hasTransactions && hasTransfers
        ? "good"
        : hasTransactions || hasTransfers
        ? "partial"
        : "unavailable",
  };
}

function rangeSimilarity(a: number | null, b: number | null, tolerance: number) {
  if (a === null || b === null) return 0;
  return Math.abs(a - b) <= tolerance ? 1 : 0;
}

function scoreRelationship(a: WalletClusterProfile, b: WalletClusterProfile) {
  const sharedSignals: string[] = [];
  let score = 0;

  if (rangeSimilarity(a.daysSinceLastActive, b.daysSinceLastActive, 7)) {
    score += 18;
    sharedSignals.push("similar recent activity window");
  }

  if (Math.abs(a.recentActivityCount - b.recentActivityCount) <= 5) {
    score += 14;
    sharedSignals.push("similar transaction frequency");
  }

  if (rangeSimilarity(a.walletAgeDays, b.walletAgeDays, 30)) {
    score += 14;
    sharedSignals.push("similar wallet age range");
  }

  if (Math.abs(a.activityVelocityScore - b.activityVelocityScore) <= 12) {
    score += 14;
    sharedSignals.push("similar activity velocity");
  }

  if (Math.abs(a.dormancyRiskScore - b.dormancyRiskScore) <= 12) {
    score += 12;
    sharedSignals.push("similar dormancy pattern");
  }

  if (Math.abs(a.concentrationRiskScore - b.concentrationRiskScore) <= 15) {
    score += 10;
    sharedSignals.push("similar concentration level");
  }

  const sharedTokens = a.interactedTokens.filter((token) =>
    b.interactedTokens.includes(token)
  );

  if (sharedTokens.length >= 3) {
    score += 18;
    sharedSignals.push("repeated shared token interactions");
  } else if (sharedTokens.length > 0) {
    score += 8;
    sharedSignals.push("some shared token interactions");
  }

  if (a.isContract || b.isContract) {
    score = Math.max(0, score - 20);
    sharedSignals.push("contract wallet present, reducing confidence");
  }

  return {
    score: clampScore(score),
    sharedSignals,
  };
}

function relationshipTypeFromScore({
  score,
  sharedSignals,
}: {
  score: number;
  sharedSignals: string[];
}): RelationshipType {
  if (score < 42) return "Isolated";
  if (
    score >= 78 &&
    sharedSignals.includes("similar recent activity window") &&
    sharedSignals.includes("repeated shared token interactions")
  ) {
    return "Possible Coordination";
  }
  if (sharedSignals.includes("similar recent activity window")) {
    return "Activity Overlap";
  }
  if (
    sharedSignals.includes("similar dormancy pattern") &&
    !sharedSignals.includes("similar recent activity window")
  ) {
    return "Passive Similarity";
  }
  return "Behavioral Similarity";
}

function riskLevelFromCluster({
  relationshipType,
  averageConcentration,
  confidence,
}: {
  relationshipType: RelationshipType;
  averageConcentration: number;
  confidence: Confidence;
}): RiskLevel {
  if (
    relationshipType === "Possible Coordination" &&
    confidence !== "Low" &&
    averageConcentration >= 45
  ) {
    return "Elevated";
  }

  if (
    relationshipType === "Activity Overlap" ||
    relationshipType === "Possible Coordination" ||
    averageConcentration >= 55
  ) {
    return "Medium";
  }

  return "Low";
}

function buildClusters(profiles: WalletClusterProfile[]) {
  const edges = new Map<string, { score: number; sharedSignals: string[] }>();

  for (let i = 0; i < profiles.length; i++) {
    for (let j = i + 1; j < profiles.length; j++) {
      const relationship = scoreRelationship(profiles[i], profiles[j]);

      if (relationship.score >= 42) {
        edges.set(`${i}:${j}`, relationship);
      }
    }
  }

  const visited = new Set<number>();
  const clusters: WalletCluster[] = [];

  for (let index = 0; index < profiles.length; index++) {
    if (visited.has(index)) continue;

    const stack = [index];
    const members = new Set<number>();
    const relationshipScores: number[] = [];
    const signals = new Set<string>();

    while (stack.length > 0) {
      const current = stack.pop();
      if (current === undefined || members.has(current)) continue;

      members.add(current);
      visited.add(current);

      for (let other = 0; other < profiles.length; other++) {
        const key =
          current < other ? `${current}:${other}` : `${other}:${current}`;
        const edge = edges.get(key);

        if (!edge) continue;

        relationshipScores.push(edge.score);
        edge.sharedSignals.forEach((signal) => signals.add(signal));

        if (!members.has(other)) {
          stack.push(other);
        }
      }
    }

    const walletMembers = Array.from(members).map((member) => profiles[member]);

    if (walletMembers.length <= 1) {
      clusters.push(buildIsolatedCluster(profiles[index], clusters.length + 1));
      continue;
    }

    const averageScore = average(relationshipScores);
    const confidence = confidenceFromScore(averageScore);
    const sharedSignals = Array.from(signals);
    const relationshipType = relationshipTypeFromScore({
      score: averageScore,
      sharedSignals,
    });
    const averageConcentration = average(
      walletMembers.map((wallet) => wallet.concentrationRiskScore)
    );

    clusters.push({
      clusterId: `cluster-${String(clusters.length + 1).padStart(2, "0")}`,
      confidence,
      relationshipType,
      walletCount: walletMembers.length,
      wallets: walletMembers.map((wallet) => ({
        walletAddress: wallet.walletAddress,
        shortAddress: wallet.shortAddress,
        ownershipPercentage: wallet.ownershipPercentage,
        activityVelocityScore: wallet.activityVelocityScore,
        dormancyRiskScore: wallet.dormancyRiskScore,
        concentrationRiskScore: wallet.concentrationRiskScore,
      })),
      sharedSignals: sharedSignals.slice(0, 6),
      riskLevel: riskLevelFromCluster({
        relationshipType,
        averageConcentration,
        confidence,
      }),
      explanation:
        "Cluster inference is based on behavioral similarity, activity overlap, wallet metadata and recent token interactions. It does not indicate shared ownership or insider identity.",
    });
  }

  return clusters.sort((a, b) => {
    if (a.relationshipType === "Isolated" && b.relationshipType !== "Isolated") {
      return 1;
    }
    if (a.relationshipType !== "Isolated" && b.relationshipType === "Isolated") {
      return -1;
    }
    return confidenceValue(b.confidence) - confidenceValue(a.confidence);
  });
}

function buildIsolatedCluster(
  wallet: WalletClusterProfile,
  clusterNumber: number
): WalletCluster {
  return {
    clusterId: `cluster-${String(clusterNumber).padStart(2, "0")}`,
    confidence: "Low",
    relationshipType: "Isolated",
    walletCount: 1,
    wallets: [
      {
        walletAddress: wallet.walletAddress,
        shortAddress: wallet.shortAddress,
        ownershipPercentage: wallet.ownershipPercentage,
        activityVelocityScore: wallet.activityVelocityScore,
        dormancyRiskScore: wallet.dormancyRiskScore,
        concentrationRiskScore: wallet.concentrationRiskScore,
      },
    ],
    sharedSignals: ["no strong relationship signals detected"],
    riskLevel: wallet.concentrationRiskScore >= 60 ? "Medium" : "Low",
    explanation:
      "This wallet did not meet the conservative similarity threshold against other analyzed holders.",
  };
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function dominantRelationshipType(
  clusters: Pick<WalletCluster, "relationshipType">[]
): RelationshipType | "Unavailable" {
  const nonIsolated = clusters.filter(
    (cluster) => cluster.relationshipType !== "Isolated"
  );
  const source = nonIsolated.length > 0 ? nonIsolated : clusters;

  if (source.length === 0) return "Unavailable";

  const counts = new Map<RelationshipType, number>();

  for (const cluster of source) {
    counts.set(
      cluster.relationshipType,
      (counts.get(cluster.relationshipType) || 0) + 1
    );
  }

  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ||
    "Unavailable";
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
  const requestedLimit = Number(searchParams.get("limit") || 20);

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
      message: "limit must be a number between 1 and 40.",
      details: { limit: searchParams.get("limit") },
      status: 400,
    });
  }

  const limit = Math.min(40, Math.max(1, requestedLimit));
  const mappedChain = mapChain(chain);
  const normalizedTokenAddress = tokenAddress.toLowerCase();
  const cacheKey = createTokenAnalysisCacheKey({
    route: "wallet-clusters",
    chain: mappedChain,
    tokenAddress: normalizedTokenAddress,
    extra: { limit },
  });

  try {
    const cachedResult = await getOrSetCache<WalletClustersResponse>(
      cacheKey,
      WALLET_CLUSTERS_CACHE_TTL_SECONDS,
      async () => {
        const holders = await fetchTopHolders({
          apiKey,
          chain: mappedChain,
          tokenAddress: normalizedTokenAddress,
          limit,
        });
        const profiles = await Promise.all(
          holders.map((holder) =>
            buildWalletProfile({
              apiKey,
              chain: mappedChain,
              holder,
            })
          )
        );
        const clusters = buildClusters(profiles);
        const clusteredWallets = new Set(
          clusters
            .filter((cluster) => cluster.relationshipType !== "Isolated")
            .flatMap((cluster) =>
              cluster.wallets.map((wallet) => wallet.walletAddress.toLowerCase())
            )
        ).size;
        const isolatedWallets = Math.max(0, profiles.length - clusteredWallets);
        const nonIsolatedClusters = clusters.filter(
          (cluster) => cluster.relationshipType !== "Isolated"
        );
        const averageClusterConfidence = average(
          nonIsolatedClusters.map((cluster) => confidenceValue(cluster.confidence))
        );

        return {
          tokenAddress: normalizedTokenAddress,
          chain: mappedChain,
          clusters,
          networkSummary: {
            totalAnalyzedWallets: profiles.length,
            clusteredWallets,
            isolatedWallets,
            averageClusterConfidence,
            dominantRelationshipType: dominantRelationshipType(clusters),
          },
          warnings: [
            "Cluster Intelligence V1 detects behavioral similarity and activity overlap only.",
            "Clusters do not imply shared ownership, insider identity or coordinated control.",
            "Profitability, PnL and smart money labels are not calculated.",
            "Wallet age and activity windows depend on recent Moralis-indexed data availability.",
          ],
        };
      },
      { provider: "moralis", route: "wallet-clusters" }
    );

    return NextResponse.json({
      ...cachedResult.value,
      warnings: [
        ...cachedResult.value.warnings,
        cacheAgeWarning(WALLET_CLUSTERS_CACHE_TTL_SECONDS),
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
          : "Wallet cluster request failed.",
      status: 500,
    });
  }
}
