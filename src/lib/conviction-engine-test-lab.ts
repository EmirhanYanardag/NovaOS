import {
  calculateConvictionEngine,
  type ConvictionEngineInput,
  type ConvictionEngineResult,
  type ConvictionWalletInput,
} from "./conviction-engine";
import { SYNTHETIC_SCENARIO_EXPECTED_RANGES } from "./conviction-engine-config";

export type ConvictionScenarioName =
  | "Rug Pull"
  | "Fresh Wallet Farm"
  | "Bot Farm"
  | "Whale Concentration"
  | "Organic Community"
  | "Diamond Hands"
  | "Healthy Growth"
  | "Exchange Dominated";

export type ScenarioRange = {
  min: number;
  max: number;
};

export type ScenarioRunResult = {
  name: ConvictionScenarioName;
  input: ConvictionEngineInput;
  finalConvictionScore: number;
  subScores: ConvictionEngineResult["subScores"];
  risks: {
    insiderRisk: number;
    clusterRisk: number;
    botActivityRisk: number;
    rotationRisk: number;
    freshWalletRisk: number;
  };
  explanation: ConvictionEngineResult["explanation"];
  confidence: ConvictionEngineResult["dataConfidence"];
  expectedRange: ScenarioRange;
  withinExpectedRange: boolean;
  primaryInfluences: string[];
};

export type ScenarioValidationResult = {
  totalScenarios: number;
  passed: number;
  failed: Array<{
    name: ConvictionScenarioName;
    score: number;
    expectedRange: ScenarioRange;
  }>;
  results: ScenarioRunResult[];
};

const scenarioRanges: Record<ConvictionScenarioName, ScenarioRange> =
  SYNTHETIC_SCENARIO_EXPECTED_RANGES;

function syntheticAddress(seed: number) {
  return `0x${seed.toString(16).padStart(40, "0")}`;
}

function makeWallet(
  rank: number,
  overrides: Partial<ConvictionWalletInput> = {}
): ConvictionWalletInput {
  return {
    rank,
    address: syntheticAddress(rank),
    balance: 1_000_000 / rank,
    ownershipPercent: Math.max(0.03, 4 / rank),
    walletAgeDays: 180,
    transactionCount: 280,
    recentTx30d: 18,
    recentTx7d: 4,
    daysSinceLastActive: 2,
    nativeBalanceUsd: 650,
    tokenTransferInCount: 6,
    tokenTransferOutCount: 1,
    tokenHoldDays: 120,
    interactedTokenCount: 12,
    isContract: false,
    isExchange: false,
    isFreshWallet: false,
    clusterRiskScore: 12,
    fundingSimilarityScore: 8,
    ...overrides,
  };
}

function makeWallets(
  count: number,
  factory: (rank: number) => Partial<ConvictionWalletInput>
) {
  return Array.from({ length: count }, (_, index) => {
    const rank = index + 1;
    return makeWallet(rank, factory(rank));
  });
}

function buildInput(
  tokenSymbol: string,
  holders: ConvictionWalletInput[],
  overrides: Partial<ConvictionEngineInput> = {}
): ConvictionEngineInput {
  return {
    chain: "ethereum",
    tokenAddress: syntheticAddress(tokenSymbol.length * 991),
    tokenSymbol,
    holders,
    holderCount: holders.length,
    top10OwnershipPercent: holders
      .slice(0, 10)
      .reduce((sum, wallet) => sum + (wallet.ownershipPercent || 0), 0),
    top25OwnershipPercent: holders
      .slice(0, 25)
      .reduce((sum, wallet) => sum + (wallet.ownershipPercent || 0), 0),
    top100OwnershipPercent: holders.reduce(
      (sum, wallet) => sum + (wallet.ownershipPercent || 0),
      0
    ),
    contractHolderCount: holders.filter((wallet) => wallet.isContract).length,
    exchangeHolderCount: holders.filter((wallet) => wallet.isExchange).length,
    market: {
      liquidityUsd: 1_800_000,
      marketCapUsd: 18_000_000,
      volume24hUsd: 1_250_000,
      priceChange24h: 8,
      volumeChange24h: 22,
    },
    cluster: {
      averageClusterConfidence: 20,
      clusteredWalletPercent: 12,
      dominantRelationshipType: "Isolated",
      elevatedRiskClusterCount: 0,
    },
    ...overrides,
  };
}

export function generateRugPullScenario(): ConvictionEngineInput {
  const holders = makeWallets(40, (rank) => ({
    ownershipPercent: rank === 1 ? 38 : rank <= 5 ? 7 : 0.35,
    walletAgeDays: rank <= 12 ? 3 : 18,
    isFreshWallet: rank <= 18,
    transactionCount: rank <= 12 ? 18 : 60,
    recentTx30d: rank <= 12 ? 22 : 8,
    recentTx7d: rank <= 12 ? 16 : 3,
    daysSinceLastActive: rank <= 5 ? 1 : 12,
    tokenTransferInCount: rank <= 12 ? 2 : 3,
    tokenTransferOutCount: rank <= 12 ? 8 : 3,
    tokenHoldDays: rank <= 20 ? 1 : 8,
    interactedTokenCount: rank <= 12 ? 4 : 8,
    clusterRiskScore: rank <= 15 ? 92 : 55,
    fundingSimilarityScore: rank <= 15 ? 88 : 45,
  }));

  return buildInput("RUG", holders, {
    market: {
      liquidityUsd: 18_000,
      marketCapUsd: 4_200_000,
      volume24hUsd: 950_000,
      priceChange24h: 135,
      volumeChange24h: 310,
    },
    cluster: {
      averageClusterConfidence: 88,
      clusteredWalletPercent: 76,
      dominantRelationshipType: "Possible Coordination",
      elevatedRiskClusterCount: 5,
    },
  });
}

export function generateFreshWalletFarmScenario(): ConvictionEngineInput {
  const holders = makeWallets(60, (rank) => ({
    ownershipPercent: rank <= 20 ? 1.8 : 0.28,
    walletAgeDays: rank <= 42 ? 4 : 22,
    isFreshWallet: rank <= 42,
    transactionCount: rank <= 42 ? 34 : 85,
    recentTx30d: rank <= 42 ? 30 : 10,
    recentTx7d: rank <= 42 ? 12 : 3,
    daysSinceLastActive: rank <= 42 ? 1 : 8,
    tokenTransferInCount: rank <= 42 ? 5 : 4,
    tokenTransferOutCount: rank <= 42 ? 5 : 2,
    tokenHoldDays: rank <= 42 ? 3 : 18,
    interactedTokenCount: rank <= 42 ? 10 : 14,
    clusterRiskScore: rank <= 42 ? 68 : 28,
    fundingSimilarityScore: rank <= 42 ? 72 : 20,
  }));

  return buildInput("FARM", holders, {
    market: {
      liquidityUsd: 55_000,
      marketCapUsd: 9_500_000,
      volume24hUsd: 760_000,
      priceChange24h: 74,
      volumeChange24h: 135,
    },
    cluster: {
      averageClusterConfidence: 72,
      clusteredWalletPercent: 58,
      dominantRelationshipType: "Activity Overlap",
      elevatedRiskClusterCount: 3,
    },
  });
}

export function generateBotFarmScenario(): ConvictionEngineInput {
  const holders = makeWallets(70, (rank) => ({
    ownershipPercent: rank <= 10 ? 2.1 : 0.32,
    walletAgeDays: rank <= 35 ? 38 : 120,
    transactionCount: rank <= 45 ? 1_800 : 220,
    recentTx30d: rank <= 45 ? 420 : 34,
    recentTx7d: rank <= 45 ? 130 : 8,
    daysSinceLastActive: 0,
    tokenTransferInCount: rank <= 45 ? 80 : 8,
    tokenTransferOutCount: rank <= 45 ? 78 : 4,
    tokenHoldDays: rank <= 45 ? 1 : 24,
    interactedTokenCount: rank <= 45 ? 44 : 16,
    clusterRiskScore: rank <= 45 ? 58 : 18,
    fundingSimilarityScore: rank <= 45 ? 54 : 12,
  }));

  return buildInput("BOT", holders, {
    market: {
      liquidityUsd: 460_000,
      marketCapUsd: 11_000_000,
      volume24hUsd: 5_800_000,
      priceChange24h: 28,
      volumeChange24h: 180,
    },
    cluster: {
      averageClusterConfidence: 62,
      clusteredWalletPercent: 46,
      dominantRelationshipType: "Behavioral Similarity",
      elevatedRiskClusterCount: 2,
    },
  });
}

export function generateWhaleConcentrationScenario(): ConvictionEngineInput {
  const holders = makeWallets(80, (rank) => ({
    ownershipPercent: rank === 1 ? 18 : rank === 2 ? 11 : rank <= 8 ? 4.5 : 0.3,
    walletAgeDays: rank <= 8 ? 420 : 160,
    transactionCount: rank <= 8 ? 180 : 260,
    recentTx30d: rank <= 8 ? 4 : 16,
    recentTx7d: rank <= 8 ? 1 : 4,
    daysSinceLastActive: rank <= 8 ? 18 : 3,
    tokenTransferInCount: rank <= 8 ? 8 : 6,
    tokenTransferOutCount: rank <= 8 ? 1 : 2,
    tokenHoldDays: rank <= 8 ? 280 : 75,
    interactedTokenCount: rank <= 8 ? 8 : 18,
    clusterRiskScore: rank <= 8 ? 44 : 18,
    fundingSimilarityScore: rank <= 8 ? 28 : 8,
  }));

  return buildInput("WHALE", holders, {
    market: {
      liquidityUsd: 1_100_000,
      marketCapUsd: 32_000_000,
      volume24hUsd: 780_000,
      priceChange24h: 4,
      volumeChange24h: 12,
    },
    cluster: {
      averageClusterConfidence: 34,
      clusteredWalletPercent: 22,
      dominantRelationshipType: "Passive Similarity",
      elevatedRiskClusterCount: 1,
    },
  });
}

export function generateOrganicCommunityScenario(): ConvictionEngineInput {
  const holders = makeWallets(100, (rank) => ({
    ownershipPercent: rank <= 10 ? 0.85 : rank <= 25 ? 0.42 : 0.12,
    walletAgeDays: rank <= 25 ? 260 : 150,
    transactionCount: rank <= 25 ? 420 : 180,
    recentTx30d: rank <= 25 ? 20 : 11,
    recentTx7d: rank <= 25 ? 5 : 2,
    daysSinceLastActive: rank <= 60 ? 2 : 8,
    tokenTransferInCount: rank <= 50 ? 8 : 4,
    tokenTransferOutCount: rank <= 50 ? 2 : 1,
    tokenHoldDays: rank <= 60 ? 120 : 65,
    interactedTokenCount: rank <= 50 ? 18 : 12,
    clusterRiskScore: 12,
    fundingSimilarityScore: 8,
  }));

  return buildInput("ORG", holders);
}

export function generateDiamondHandsScenario(): ConvictionEngineInput {
  const holders = makeWallets(100, (rank) => ({
    ownershipPercent: rank <= 10 ? 0.7 : rank <= 25 ? 0.34 : 0.11,
    walletAgeDays: rank <= 40 ? 760 : 420,
    transactionCount: rank <= 40 ? 320 : 160,
    recentTx30d: rank <= 40 ? 6 : 3,
    recentTx7d: rank <= 40 ? 1 : 0,
    daysSinceLastActive: rank <= 45 ? 9 : 18,
    tokenTransferInCount: rank <= 60 ? 7 : 4,
    tokenTransferOutCount: rank <= 80 ? 0 : 1,
    tokenHoldDays: rank <= 60 ? 520 : 260,
    interactedTokenCount: rank <= 60 ? 10 : 8,
    clusterRiskScore: 8,
    fundingSimilarityScore: 4,
  }));

  return buildInput("DIAMOND", holders, {
    market: {
      liquidityUsd: 4_200_000,
      marketCapUsd: 38_000_000,
      volume24hUsd: 1_400_000,
      priceChange24h: 5,
      volumeChange24h: 18,
    },
  });
}

export function generateHealthyGrowthScenario(): ConvictionEngineInput {
  const holders = makeWallets(100, (rank) => ({
    ownershipPercent: rank <= 10 ? 0.95 : rank <= 25 ? 0.48 : 0.14,
    walletAgeDays: rank <= 40 ? 240 : 110,
    transactionCount: rank <= 40 ? 520 : 210,
    recentTx30d: rank <= 40 ? 28 : 14,
    recentTx7d: rank <= 40 ? 7 : 3,
    daysSinceLastActive: rank <= 70 ? 1 : 5,
    tokenTransferInCount: rank <= 65 ? 10 : 5,
    tokenTransferOutCount: rank <= 65 ? 2 : 1,
    tokenHoldDays: rank <= 65 ? 90 : 48,
    interactedTokenCount: rank <= 50 ? 20 : 16,
    clusterRiskScore: 14,
    fundingSimilarityScore: 8,
  }));

  return buildInput("GROWTH", holders, {
    market: {
      liquidityUsd: 3_500_000,
      marketCapUsd: 28_000_000,
      volume24hUsd: 2_600_000,
      priceChange24h: 14,
      volumeChange24h: 44,
    },
    cluster: {
      averageClusterConfidence: 24,
      clusteredWalletPercent: 18,
      dominantRelationshipType: "Behavioral Similarity",
      elevatedRiskClusterCount: 0,
    },
  });
}

export function generateExchangeDominatedScenario(): ConvictionEngineInput {
  const holders = makeWallets(90, (rank) => ({
    ownershipPercent: rank <= 5 ? 5.5 : rank <= 15 ? 0.65 : 0.16,
    walletAgeDays: rank <= 8 ? 1_200 : 180,
    transactionCount: rank <= 8 ? 12_000 : 240,
    recentTx30d: rank <= 8 ? 260 : 14,
    recentTx7d: rank <= 8 ? 60 : 3,
    daysSinceLastActive: rank <= 8 ? 0 : 5,
    tokenTransferInCount: rank <= 8 ? 160 : 6,
    tokenTransferOutCount: rank <= 8 ? 140 : 2,
    tokenHoldDays: rank <= 8 ? 400 : 80,
    interactedTokenCount: rank <= 8 ? 120 : 14,
    isExchange: rank <= 8,
    clusterRiskScore: rank <= 8 ? 36 : 12,
    fundingSimilarityScore: rank <= 8 ? 24 : 8,
  }));

  return buildInput("EXCH", holders, {
    exchangeHolderCount: 8,
    market: {
      liquidityUsd: 3_200_000,
      marketCapUsd: 72_000_000,
      volume24hUsd: 6_800_000,
      priceChange24h: 3,
      volumeChange24h: 26,
    },
    cluster: {
      averageClusterConfidence: 36,
      clusteredWalletPercent: 28,
      dominantRelationshipType: "Activity Overlap",
      elevatedRiskClusterCount: 2,
    },
  });
}

const scenarioGenerators: Record<
  ConvictionScenarioName,
  () => ConvictionEngineInput
> = {
  "Rug Pull": generateRugPullScenario,
  "Fresh Wallet Farm": generateFreshWalletFarmScenario,
  "Bot Farm": generateBotFarmScenario,
  "Whale Concentration": generateWhaleConcentrationScenario,
  "Organic Community": generateOrganicCommunityScenario,
  "Diamond Hands": generateDiamondHandsScenario,
  "Healthy Growth": generateHealthyGrowthScenario,
  "Exchange Dominated": generateExchangeDominatedScenario,
};

function getPrimaryInfluences(result: ConvictionEngineResult) {
  const subScores = result.subScores;
  const influences = [
    ["holder integrity", subScores.holderIntegrity],
    ["wallet quality", subScores.walletQuality],
    ["behavior stability", subScores.behaviorStability],
    ["liquidity trust", subScores.liquidityTrust],
    ["market momentum", subScores.marketMomentum],
    ["risk protection", subScores.riskProtection],
    ["insider risk", 100 - subScores.insiderRisk],
    ["cluster risk", 100 - subScores.clusterRisk],
    ["bot activity risk", 100 - subScores.botActivityRisk],
    ["rotation risk", 100 - subScores.rotationRisk],
  ] as const;

  return [...influences]
    .sort((a, b) => Math.abs(b[1] - 50) - Math.abs(a[1] - 50))
    .slice(0, 4)
    .map(([label, score]) => `${label}: ${score}`);
}

export function runScenario(name: ConvictionScenarioName): ScenarioRunResult {
  const generator = scenarioGenerators[name];
  const input = generator();
  const result = calculateConvictionEngine(input);
  const expectedRange = scenarioRanges[name];
  const withinExpectedRange =
    result.finalConvictionScore >= expectedRange.min &&
    result.finalConvictionScore <= expectedRange.max;

  return {
    name,
    input,
    finalConvictionScore: result.finalConvictionScore,
    subScores: result.subScores,
    risks: {
      insiderRisk: result.subScores.insiderRisk,
      clusterRisk: result.subScores.clusterRisk,
      botActivityRisk: result.subScores.botActivityRisk,
      rotationRisk: result.subScores.rotationRisk,
      freshWalletRisk: result.subScores.freshWalletRisk,
    },
    explanation: result.explanation,
    confidence: result.dataConfidence,
    expectedRange,
    withinExpectedRange,
    primaryInfluences: getPrimaryInfluences(result),
  };
}

export function runAllScenarios() {
  return (Object.keys(scenarioGenerators) as ConvictionScenarioName[]).map(
    (name) => runScenario(name)
  );
}

export function validateScenarioRanges(): ScenarioValidationResult {
  const results = runAllScenarios();
  const failed = results
    .filter((result) => !result.withinExpectedRange)
    .map((result) => ({
      name: result.name,
      score: result.finalConvictionScore,
      expectedRange: result.expectedRange,
    }));

  return {
    totalScenarios: results.length,
    passed: results.length - failed.length,
    failed,
    results,
  };
}
