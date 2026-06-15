import type { GmgnRiskStats } from "@/lib/gmgn-risk-stats";
import type { TokenHolderSnapshot } from "@/lib/novaos-data-layer";
import type { Top100HolderAlphaResultV1 } from "@/lib/top100-holder-alpha-engine";
import type { WalletAlphaResultV2 } from "@/lib/wallet-alpha-engine";

type SmartMoneyClassification = {
  smart: boolean;
  renowned: boolean;
  whale: boolean;
};

type ClassifiedWallet = {
  wallet: WalletAlphaResultV2;
  holder: TokenHolderSnapshot | null;
  classification: SmartMoneyClassification;
  ownershipPercentage: number | null;
  netFlowUsd: number | null;
};

export type SmartMoneyIntelligenceInputV1 = {
  riskStats?: GmgnRiskStats | null;
  holderAlpha?: Top100HolderAlphaResultV1 | null;
  walletAlphaBatch?: WalletAlphaResultV2[];
  holders?: TokenHolderSnapshot[];
  warnings?: string[];
};

export type SmartMoneyIntelligenceSubscoresV1 = {
  smartMoneyPresenceScore: number;
  smartMoneyQualityScore: number;
  smartMoneyOwnershipScore: number;
  smartMoneyConvictionScore: number;
  smartMoneyAccumulationScore: number;
  smartMoneyConcentrationScore: number;
};

export type SmartMoneyIntelligenceMetricsV1 = {
  smartWalletCount: number | null;
  renownedWalletCount: number | null;
  whaleWalletCount: number | null;
  smartWalletOwnershipShare: number | null;
  renownedWalletOwnershipShare: number | null;
  whaleOwnershipShare: number | null;
  smartWalletAverageAlpha: number | null;
  smartWalletWeightedAlpha: number | null;
  smartWalletBehavioralConviction: number | null;
  smartWalletNetFlowUsd: number | null;
  smartWalletAccumulatingCount: number;
  smartWalletDistributingCount: number;
  smartWalletNeutralCount: number;
  smartWalletCoverageRate: number | null;
};

export type SmartMoneyIntelligenceResultV1 = {
  smartMoneyScore: number;
  subscores: SmartMoneyIntelligenceSubscoresV1;
  metrics: SmartMoneyIntelligenceMetricsV1;
  explanations: string[];
  warnings: string[];
};

const SMART_LABEL_PATTERNS = [
  "smart_money",
  "smart money",
  "smart_wallet",
  "smart wallet",
  "smart",
  "kol",
  "alpha",
];
const RENOWNED_LABEL_PATTERNS = ["renowned", "famous", "influencer", "notable"];
const WHALE_LABEL_PATTERNS = ["whale", "large_holder", "large holder"];

function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function clampScore(value: number) {
  return Math.round(clamp(value));
}

function round(value: number, decimals = 4) {
  return Number(value.toFixed(decimals));
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeAddress(value: string | null | undefined) {
  return value ? value.toLowerCase() : null;
}

function percentage(value: number | null | undefined) {
  if (!isNumber(value)) return null;
  return value <= 1 ? value * 100 : value;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return round(sum(values) / values.length);
}

function addWarning(warnings: string[], condition: boolean, warning: string) {
  if (condition && !warnings.includes(warning)) warnings.push(warning);
}

function textMatches(text: string, patterns: string[]) {
  return patterns.some((pattern) => text.includes(pattern));
}

function classifyHolder(holder: TokenHolderSnapshot | null): SmartMoneyClassification {
  const label = holder?.label?.toLowerCase() || "";

  return {
    smart: textMatches(label, SMART_LABEL_PATTERNS),
    renowned: textMatches(label, RENOWNED_LABEL_PATTERNS),
    whale: textMatches(label, WHALE_LABEL_PATTERNS),
  };
}

function holderMap(holders: TokenHolderSnapshot[]) {
  const map = new Map<string, TokenHolderSnapshot>();

  for (const holder of holders) {
    const wallet = normalizeAddress(holder.wallet);
    if (wallet) map.set(wallet, holder);
  }

  return map;
}

function netFlow(wallet: WalletAlphaResultV2) {
  const buyUsd = wallet.rawMetrics.totalBuyUsd;
  const sellUsd = wallet.rawMetrics.totalSellUsd;

  if (!isNumber(buyUsd) && !isNumber(sellUsd)) return null;
  return round((buyUsd ?? 0) - (sellUsd ?? 0));
}

function classifyWallets({
  walletAlphaBatch,
  holders,
}: {
  walletAlphaBatch: WalletAlphaResultV2[];
  holders: TokenHolderSnapshot[];
}) {
  const holdersByWallet = holderMap(holders);
  const classified: ClassifiedWallet[] = [];

  for (const wallet of walletAlphaBatch) {
    const address = normalizeAddress(wallet.wallet);
    const holder = address ? holdersByWallet.get(address) ?? null : null;
    const classification = classifyHolder(holder);

    if (!classification.smart && !classification.renowned && !classification.whale) {
      continue;
    }

    classified.push({
      wallet,
      holder,
      classification,
      ownershipPercentage:
        percentage(holder?.ownershipPercentage) ??
        percentage(wallet.rawMetrics.ownershipPercentage),
      netFlowUsd: netFlow(wallet),
    });
  }

  return classified;
}

function walletCountFromRiskStats(
  riskStats: GmgnRiskStats | null | undefined,
  key: "smartWalletCount" | "renownedWalletCount" | "whaleWalletCount",
  matchedCount: number
) {
  return riskStats?.[key] ?? matchedCount;
}

function smartCapitalWallets(classified: ClassifiedWallet[]) {
  return classified.filter(
    (wallet) =>
      wallet.classification.smart ||
      wallet.classification.renowned ||
      wallet.classification.whale
  );
}

function ownershipFor(classified: ClassifiedWallet[], key: keyof SmartMoneyClassification) {
  const values = classified
    .filter((wallet) => wallet.classification[key])
    .map((wallet) => wallet.ownershipPercentage)
    .filter((value): value is number => value !== null);

  if (values.length === 0) return null;
  return round(sum(values));
}

function weightedAlpha(classified: ClassifiedWallet[]) {
  if (classified.length === 0) return null;
  const weighted = classified
    .map((wallet) => {
      const ownership = wallet.ownershipPercentage;
      return {
        score: wallet.wallet.scores.walletAlphaV2,
        weight: ownership !== null && ownership > 0 ? Math.sqrt(ownership) : 1,
      };
    })
    .filter((item) => Number.isFinite(item.score) && item.weight > 0);
  const totalWeight = sum(weighted.map((item) => item.weight));

  if (totalWeight <= 0) return null;

  return round(
    sum(weighted.map((item) => item.score * item.weight)) / totalWeight
  );
}

function behavioralConviction(classified: ClassifiedWallet[]) {
  if (classified.length === 0) return null;

  const scored = classified.map((wallet) => {
    const buyUsd = wallet.wallet.rawMetrics.totalBuyUsd ?? 0;
    const sellUsd = wallet.wallet.rawMetrics.totalSellUsd ?? 0;
    const totalFlow = buyUsd + sellUsd;
    const flowTilt = totalFlow > 0 ? (buyUsd - sellUsd) / totalFlow : 0;
    const alpha = wallet.wallet.scores.walletAlphaV2;
    const holdScore = wallet.wallet.scores.holdDisciplineV2;
    const rotationScore = wallet.wallet.scores.rotationQualityV2;
    const score = clampScore(
      50 + flowTilt * 28 + (alpha - 50) * 0.22 + (holdScore - 50) * 0.12 + (rotationScore - 50) * 0.08
    );

    return {
      score,
      weight:
        wallet.ownershipPercentage !== null && wallet.ownershipPercentage > 0
          ? Math.sqrt(wallet.ownershipPercentage)
          : 1,
    };
  });
  const totalWeight = sum(scored.map((item) => item.weight));

  if (totalWeight <= 0) return null;

  return round(sum(scored.map((item) => item.score * item.weight)) / totalWeight);
}

function flowBuckets(classified: ClassifiedWallet[]) {
  let accumulating = 0;
  let distributing = 0;
  let neutral = 0;

  for (const wallet of classified) {
    const net = wallet.netFlowUsd;
    const totalFlow =
      (wallet.wallet.rawMetrics.totalBuyUsd ?? 0) +
      (wallet.wallet.rawMetrics.totalSellUsd ?? 0);
    const threshold = Math.max(100, totalFlow * 0.1);

    if (net === null || Math.abs(net) <= threshold) {
      neutral += 1;
    } else if (net > 0) {
      accumulating += 1;
    } else {
      distributing += 1;
    }
  }

  return { accumulating, distributing, neutral };
}

function ownershipEntropyScore(classified: ClassifiedWallet[]) {
  const ownershipValues = classified
    .map((wallet) => wallet.ownershipPercentage)
    .filter((value): value is number => value !== null && value > 0);

  if (classified.length === 0) return 50;
  if (ownershipValues.length < 2) return ownershipValues.length === 1 ? 35 : 50;

  const total = sum(ownershipValues);
  if (total <= 0) return 50;

  const entropy = -sum(
    ownershipValues.map((ownership) => {
      const p = ownership / total;
      return p > 0 ? p * Math.log(p) : 0;
    })
  );
  const maxEntropy = Math.log(ownershipValues.length);
  const dominantShare = Math.max(...ownershipValues) / total;

  return clampScore((entropy / maxEntropy) * 82 + (1 - dominantShare) * 18);
}

function scorePresence(count: number | null, coverageRate: number | null) {
  if (count === null) return 40;

  let score = 5;
  if (count >= 25) score = 85;
  else if (count >= 10) score = 72;
  else if (count >= 6) score = 60;
  else if (count >= 3) score = 45;
  else if (count >= 1) score = 28;

  if (coverageRate !== null && coverageRate < 0.25) score -= 10;

  return clampScore(score);
}

function scoreOwnership(ownershipShare: number | null) {
  if (ownershipShare === null) return 45;
  if (ownershipShare >= 25) return 90;
  if (ownershipShare >= 15) return 78;
  if (ownershipShare >= 8) return 64;
  if (ownershipShare >= 3) return 45;
  if (ownershipShare > 0) return 25;
  return 5;
}

function scoreQuality(weighted: number | null, averageAlpha: number | null) {
  const score = weighted ?? averageAlpha ?? 50;
  return clampScore(score);
}

function scoreAccumulation({
  netFlowUsd,
  accumulating,
  distributing,
  neutral,
}: {
  netFlowUsd: number | null;
  accumulating: number;
  distributing: number;
  neutral: number;
}) {
  const walletCount = accumulating + distributing + neutral;
  const flowScore =
    netFlowUsd === null
      ? 50
      : netFlowUsd > 0
        ? 62 + Math.min(23, Math.log10(Math.abs(netFlowUsd) + 1) * 4)
        : 38 - Math.min(23, Math.log10(Math.abs(netFlowUsd) + 1) * 4);
  const countTilt = walletCount > 0 ? ((accumulating - distributing) / walletCount) * 22 : 0;

  return clampScore(flowScore + countTilt);
}

function buildMetrics(input: SmartMoneyIntelligenceInputV1): {
  metrics: SmartMoneyIntelligenceMetricsV1;
  classified: ClassifiedWallet[];
} {
  const walletAlphaBatch = input.walletAlphaBatch ?? [];
  const classified = smartCapitalWallets(
    classifyWallets({
      walletAlphaBatch,
      holders: input.holders ?? [],
    })
  );
  const smartOnly = classified.filter((wallet) => wallet.classification.smart);
  const renownedOnly = classified.filter((wallet) => wallet.classification.renowned);
  const whaleOnly = classified.filter((wallet) => wallet.classification.whale);
  const smartWalletCount = walletCountFromRiskStats(
    input.riskStats,
    "smartWalletCount",
    smartOnly.length
  );
  const renownedWalletCount = walletCountFromRiskStats(
    input.riskStats,
    "renownedWalletCount",
    renownedOnly.length
  );
  const whaleWalletCount = walletCountFromRiskStats(
    input.riskStats,
    "whaleWalletCount",
    whaleOnly.length
  );
  const aggregateClassifiedCount =
    (smartWalletCount ?? 0) + (renownedWalletCount ?? 0) + (whaleWalletCount ?? 0);
  const matchedCount = classified.length;
  const coverageRate =
    aggregateClassifiedCount > 0
      ? round(Math.min(1, matchedCount / aggregateClassifiedCount))
      : walletAlphaBatch.length > 0
        ? round(matchedCount / walletAlphaBatch.length)
        : null;
  const alphas = classified.map((wallet) => wallet.wallet.scores.walletAlphaV2);
  const netFlows = classified
    .map((wallet) => wallet.netFlowUsd)
    .filter((value): value is number => value !== null);
  const buckets = flowBuckets(classified);

  return {
    classified,
    metrics: {
      smartWalletCount,
      renownedWalletCount,
      whaleWalletCount,
      smartWalletOwnershipShare: ownershipFor(classified, "smart"),
      renownedWalletOwnershipShare: ownershipFor(classified, "renowned"),
      whaleOwnershipShare: ownershipFor(classified, "whale"),
      smartWalletAverageAlpha: average(alphas),
      smartWalletWeightedAlpha: weightedAlpha(classified),
      smartWalletBehavioralConviction: behavioralConviction(classified),
      smartWalletNetFlowUsd: netFlows.length > 0 ? round(sum(netFlows)) : null,
      smartWalletAccumulatingCount: buckets.accumulating,
      smartWalletDistributingCount: buckets.distributing,
      smartWalletNeutralCount: buckets.neutral,
      smartWalletCoverageRate: coverageRate,
    },
  };
}

function buildExplanations({
  metrics,
  subscores,
  smartMoneyScore,
  holderAlpha,
}: {
  metrics: SmartMoneyIntelligenceMetricsV1;
  subscores: SmartMoneyIntelligenceSubscoresV1;
  smartMoneyScore: number;
  holderAlpha: Top100HolderAlphaResultV1 | null | undefined;
}) {
  const rows: string[] = [];
  const totalOwnership =
    (metrics.smartWalletOwnershipShare ?? 0) +
    (metrics.renownedWalletOwnershipShare ?? 0) +
    (metrics.whaleOwnershipShare ?? 0);

  if (subscores.smartMoneyPresenceScore >= 65 && totalOwnership >= 8) {
    rows.push("Smart capital participation is strong.");
  } else if (subscores.smartMoneyPresenceScore < 40) {
    rows.push("Smart capital participation appears limited in the observed holder set.");
  }

  if (totalOwnership > 0) {
    rows.push(`Smart-classified wallets control ${round(totalOwnership, 2)}% of observed ownership.`);
  }

  if (metrics.smartWalletNetFlowUsd !== null && metrics.smartWalletNetFlowUsd > 0) {
    rows.push("Smart money is currently accumulating.");
  } else if (metrics.smartWalletNetFlowUsd !== null && metrics.smartWalletNetFlowUsd < 0) {
    rows.push("Smart money is currently distributing.");
  } else {
    rows.push("Smart money behavior is currently neutral or not fully observable.");
  }

  if ((metrics.smartWalletWeightedAlpha ?? 50) >= 65) {
    rows.push("Smart wallet quality appears strong.");
  } else if ((metrics.smartWalletWeightedAlpha ?? 50) < 45) {
    rows.push("Smart wallet quality appears weak.");
  }

  if (
    metrics.smartWalletNetFlowUsd !== null &&
    metrics.smartWalletNetFlowUsd < 0 &&
    (holderAlpha?.weightedWalletAlpha ?? 50) >= 60
  ) {
    rows.push("Smart money is distributing despite healthy holder quality.");
  }

  if ((metrics.smartWalletCoverageRate ?? 1) < 0.5) {
    rows.push("Smart wallet coverage is limited.");
  }

  if (subscores.smartMoneyConcentrationScore >= 65) {
    rows.push("Smart money ownership appears distributed across multiple wallets.");
  } else if (subscores.smartMoneyConcentrationScore < 45) {
    rows.push("Smart money ownership is concentrated in a small number of wallets.");
  }

  rows.push(`Smart Money Intelligence is ${smartMoneyScore}/100 from presence, quality, ownership, behavior, accumulation, and concentration.`);

  return rows;
}

export function computeSmartMoneyIntelligenceV1(
  input: SmartMoneyIntelligenceInputV1
): SmartMoneyIntelligenceResultV1 {
  const warnings = [...(input.warnings ?? []), ...(input.riskStats?.warnings ?? [])];
  const { metrics, classified } = buildMetrics(input);
  const aggregateClassifiedCount =
    (metrics.smartWalletCount ?? 0) +
    (metrics.renownedWalletCount ?? 0) +
    (metrics.whaleWalletCount ?? 0);
  const observedOwnership =
    (metrics.smartWalletOwnershipShare ?? 0) +
    (metrics.renownedWalletOwnershipShare ?? 0) +
    (metrics.whaleOwnershipShare ?? 0);

  addWarning(
    warnings,
    aggregateClassifiedCount > 0 && classified.length === 0,
    "GMGN provided aggregate smart/renowned/whale counts, but holder-level wallet tags could not be matched to ownership."
  );
  addWarning(
    warnings,
    observedOwnership === 0 && aggregateClassifiedCount > 0,
    "Smart wallet ownership coverage is unavailable from current holder metadata."
  );
  addWarning(
    warnings,
    metrics.smartWalletCoverageRate !== null && metrics.smartWalletCoverageRate < 0.5,
    "Smart wallet classification coverage is low; treat ownership and behavior metrics as partial."
  );
  addWarning(
    warnings,
    !input.walletAlphaBatch || input.walletAlphaBatch.length === 0,
    "Wallet Alpha V2 data unavailable; smart money quality and behavior use neutral fallbacks."
  );

  const smartMoneyPresenceScore = scorePresence(
    aggregateClassifiedCount || null,
    metrics.smartWalletCoverageRate
  );
  const smartMoneyQualityScore = scoreQuality(
    metrics.smartWalletWeightedAlpha,
    metrics.smartWalletAverageAlpha
  );
  const smartMoneyOwnershipScore = scoreOwnership(
    observedOwnership > 0 ? observedOwnership : null
  );
  const smartMoneyConvictionScore = clampScore(
    metrics.smartWalletBehavioralConviction ?? 50
  );
  const smartMoneyAccumulationScore = scoreAccumulation({
    netFlowUsd: metrics.smartWalletNetFlowUsd,
    accumulating: metrics.smartWalletAccumulatingCount,
    distributing: metrics.smartWalletDistributingCount,
    neutral: metrics.smartWalletNeutralCount,
  });
  const smartMoneyConcentrationScore = ownershipEntropyScore(classified);
  const subscores = {
    smartMoneyPresenceScore,
    smartMoneyQualityScore,
    smartMoneyOwnershipScore,
    smartMoneyConvictionScore,
    smartMoneyAccumulationScore,
    smartMoneyConcentrationScore,
  };
  const smartMoneyScore = clampScore(
    smartMoneyPresenceScore * 0.18 +
      smartMoneyQualityScore * 0.22 +
      smartMoneyOwnershipScore * 0.22 +
      smartMoneyConvictionScore * 0.16 +
      smartMoneyAccumulationScore * 0.14 +
      smartMoneyConcentrationScore * 0.08
  );

  return {
    smartMoneyScore,
    subscores,
    metrics,
    explanations: buildExplanations({
      metrics,
      subscores,
      smartMoneyScore,
      holderAlpha: input.holderAlpha,
    }),
    warnings: Array.from(new Set(warnings)),
  };
}
