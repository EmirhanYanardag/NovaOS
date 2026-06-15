import type { WalletAlphaResultV2 } from "@/lib/wallet-alpha-engine";

type QualityTier = "elite" | "strong" | "average" | "weak" | "toxic";

type TierCounts = Record<QualityTier, number>;
type TierOwnership = Record<QualityTier, number>;

export type StructuralSafetyMetricsV1 = {
  top1Ownership: number | null;
  top5Ownership: number;
  top10Ownership: number;
  top25Ownership: number;
  averageWalletAlpha: number | null;
  weightedWalletAlpha: number | null;
  eliteWalletCount: number;
  strongWalletCount: number;
  averageWalletCount: number;
  weakWalletCount: number;
  toxicWalletCount: number;
  eliteOwnershipShare: number;
  strongOwnershipShare: number;
  averageOwnershipShare: number;
  weakOwnershipShare: number;
  toxicOwnershipShare: number;
};

export type StructuralSafetyResultV1 = {
  structuralSafetyScore: number;
  concentrationScore: number;
  holderDiversityScore: number;
  holderQualityScore: number;
  ownershipDistributionScore: number;
  walletIndependenceScore: number;
  metrics: StructuralSafetyMetricsV1;
  explanations: string[];
};

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function round(value: number, decimals = 2) {
  return Number(value.toFixed(decimals));
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return round(sum(values) / values.length);
}

function ownership(wallet: WalletAlphaResultV2) {
  const value = wallet.rawMetrics.ownershipPercentage;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function ownershipWeight(wallet: WalletAlphaResultV2, walletCount: number) {
  const value = ownership(wallet);
  if (value > 0) return Math.sqrt(value);
  return walletCount > 0 ? 1 / walletCount : 0;
}

function qualityTier(score: number): QualityTier {
  if (score >= 80) return "elite";
  if (score >= 65) return "strong";
  if (score >= 45) return "average";
  if (score >= 30) return "weak";
  return "toxic";
}

function emptyCounts(): TierCounts {
  return {
    elite: 0,
    strong: 0,
    average: 0,
    weak: 0,
    toxic: 0,
  };
}

function emptyOwnership(): TierOwnership {
  return {
    elite: 0,
    strong: 0,
    average: 0,
    weak: 0,
    toxic: 0,
  };
}

function concentrationScore({
  top1,
  top5,
  top10,
  top25,
}: {
  top1: number;
  top5: number;
  top10: number;
  top25: number;
}) {
  const top1Penalty = Math.max(0, top1 - 3) * 2.2;
  const top5Penalty = Math.max(0, top5 - 18) * 1.15;
  const top10Penalty = Math.max(0, top10 - 32) * 0.8;
  const top25Penalty = Math.max(0, top25 - 60) * 0.35;

  return clampScore(100 - top1Penalty - top5Penalty - top10Penalty - top25Penalty);
}

function holderDiversityScore(ownershipValues: number[]) {
  const positive = ownershipValues.filter((value) => value > 0);
  if (positive.length < 2) return positive.length === 1 ? 25 : 50;

  const total = sum(positive);
  if (total <= 0) return 50;

  const entropy = -sum(
    positive.map((value) => {
      const p = value / total;
      return p > 0 ? p * Math.log(p) : 0;
    })
  );
  const maxEntropy = Math.log(positive.length);

  return clampScore((entropy / maxEntropy) * 100);
}

function holderQualityScore({
  averageWalletAlpha,
  weightedWalletAlpha,
  counts,
  walletCount,
}: {
  averageWalletAlpha: number | null;
  weightedWalletAlpha: number | null;
  counts: TierCounts;
  walletCount: number;
}) {
  const base = (weightedWalletAlpha ?? 50) * 0.6 + (averageWalletAlpha ?? 50) * 0.4;
  if (walletCount === 0) return clampScore(base);

  const weakRatio = (counts.weak + counts.toxic) / walletCount;
  const strongRatio = (counts.elite + counts.strong) / walletCount;

  return clampScore(base + strongRatio * 10 - weakRatio * 18);
}

function ownershipDistributionScore(tierOwnership: TierOwnership) {
  const totalOwnership = sum(Object.values(tierOwnership));
  if (totalOwnership <= 0) return 50;

  const score =
    (tierOwnership.elite * 100 +
      tierOwnership.strong * 82 +
      tierOwnership.average * 58 +
      tierOwnership.weak * 25 +
      tierOwnership.toxic * 0) /
    totalOwnership;

  return clampScore(score);
}

function walletVector(wallet: WalletAlphaResultV2) {
  const buys = wallet.rawMetrics.buyCount;
  const sells = wallet.rawMetrics.sellCount;
  const tradeTotal = buys + sells;
  const buyShare = tradeTotal > 0 ? buys / tradeTotal : 0.5;
  const activityPressure = Math.min(1, wallet.rawMetrics.activityCount / 200);
  const tokenPressure = Math.min(1, wallet.rawMetrics.uniqueTokensTraded / 100);

  return [buyShare, activityPressure, tokenPressure];
}

function walletIndependenceScore(wallets: WalletAlphaResultV2[]) {
  if (wallets.length < 3) return 55;

  const vectors = wallets.map(walletVector);
  const similarities: number[] = [];

  for (let i = 0; i < vectors.length; i += 1) {
    for (let j = i + 1; j < vectors.length; j += 1) {
      const distance =
        Math.abs(vectors[i][0] - vectors[j][0]) +
        Math.abs(vectors[i][1] - vectors[j][1]) +
        Math.abs(vectors[i][2] - vectors[j][2]);
      similarities.push(1 - Math.min(1, distance / 3));
    }
  }

  const averageSimilarity = average(similarities) ?? 0;
  return clampScore(100 - averageSimilarity * 72);
}

function buildMetrics(wallets: WalletAlphaResultV2[]): StructuralSafetyMetricsV1 {
  const ownershipValues = wallets.map(ownership).sort((a, b) => b - a);
  const walletCount = wallets.length;
  const totalWeight = sum(wallets.map((wallet) => ownershipWeight(wallet, walletCount)));
  const weightedWalletAlpha =
    totalWeight > 0
      ? round(
          sum(
            wallets.map(
              (wallet) =>
                wallet.scores.walletAlphaV2 * ownershipWeight(wallet, walletCount)
            )
          ) / totalWeight
        )
      : null;
  const counts = emptyCounts();
  const tierOwnership = emptyOwnership();

  for (const wallet of wallets) {
    const tier = qualityTier(wallet.scores.walletAlphaV2);
    counts[tier] += 1;
    tierOwnership[tier] += ownership(wallet);
  }

  return {
    top1Ownership: ownershipValues[0] === undefined ? null : round(ownershipValues[0]),
    top5Ownership: round(sum(ownershipValues.slice(0, 5))),
    top10Ownership: round(sum(ownershipValues.slice(0, 10))),
    top25Ownership: round(sum(ownershipValues.slice(0, 25))),
    averageWalletAlpha: average(wallets.map((wallet) => wallet.scores.walletAlphaV2)),
    weightedWalletAlpha,
    eliteWalletCount: counts.elite,
    strongWalletCount: counts.strong,
    averageWalletCount: counts.average,
    weakWalletCount: counts.weak,
    toxicWalletCount: counts.toxic,
    eliteOwnershipShare: round(tierOwnership.elite),
    strongOwnershipShare: round(tierOwnership.strong),
    averageOwnershipShare: round(tierOwnership.average),
    weakOwnershipShare: round(tierOwnership.weak),
    toxicOwnershipShare: round(tierOwnership.toxic),
  };
}

function explanations({
  metrics,
  concentration,
  diversity,
  holderQuality,
  ownershipDistribution,
  independence,
}: {
  metrics: StructuralSafetyMetricsV1;
  concentration: number;
  diversity: number;
  holderQuality: number;
  ownershipDistribution: number;
  independence: number;
}) {
  const rows: string[] = [];

  if (concentration >= 70) {
    rows.push("Holder concentration appears structurally healthy.");
  } else if (concentration < 45) {
    rows.push("Ownership concentration is elevated.");
  } else {
    rows.push("Ownership concentration is moderate.");
  }

  if (diversity >= 70) {
    rows.push("Holder ownership appears broadly distributed.");
  } else if (diversity < 45) {
    rows.push("Holder diversity is limited by dominant ownership pockets.");
  }

  if (holderQuality >= 65) {
    rows.push("Holder quality remains strong.");
  } else if (holderQuality < 45) {
    rows.push("Holder quality is structurally weak.");
  }

  if (ownershipDistribution >= 65) {
    rows.push("Ownership is concentrated among higher-quality wallets.");
  } else if (ownershipDistribution < 45) {
    rows.push("Weak or toxic wallets control a concerning ownership share.");
  }

  if (independence >= 65) {
    rows.push("Holder behavior appears sufficiently independent for V1 heuristics.");
  } else if (independence < 45) {
    rows.push("Behavioral similarity between holders is elevated.");
  }

  rows.push(
    `Top holder owns ${metrics.top1Ownership ?? 0}%, top 10 own ${metrics.top10Ownership}%, and top 25 own ${metrics.top25Ownership}%.`
  );
  rows.push("Wallet Independence V1 is heuristic only; transfer graphs, funding analysis, clustering, and entity relationships are future V2 inputs.");

  return rows;
}

export function computeStructuralSafetyV1(
  walletAlphaBatch: WalletAlphaResultV2[]
): StructuralSafetyResultV1 {
  const wallets = walletAlphaBatch.filter((wallet) =>
    Number.isFinite(wallet.scores.walletAlphaV2)
  );
  const metrics = buildMetrics(wallets);
  const ownershipValues = wallets.map(ownership);
  const concentration = concentrationScore({
    top1: metrics.top1Ownership ?? 0,
    top5: metrics.top5Ownership,
    top10: metrics.top10Ownership,
    top25: metrics.top25Ownership,
  });
  const diversity = holderDiversityScore(ownershipValues);
  const quality = holderQualityScore({
    averageWalletAlpha: metrics.averageWalletAlpha,
    weightedWalletAlpha: metrics.weightedWalletAlpha,
    counts: {
      elite: metrics.eliteWalletCount,
      strong: metrics.strongWalletCount,
      average: metrics.averageWalletCount,
      weak: metrics.weakWalletCount,
      toxic: metrics.toxicWalletCount,
    },
    walletCount: wallets.length,
  });
  const ownershipDistribution = ownershipDistributionScore({
    elite: metrics.eliteOwnershipShare,
    strong: metrics.strongOwnershipShare,
    average: metrics.averageOwnershipShare,
    weak: metrics.weakOwnershipShare,
    toxic: metrics.toxicOwnershipShare,
  });
  const independence = walletIndependenceScore(wallets);
  const structuralSafetyScore = clampScore(
    concentration * 0.3 +
      diversity * 0.2 +
      quality * 0.2 +
      ownershipDistribution * 0.15 +
      independence * 0.15
  );

  return {
    structuralSafetyScore,
    concentrationScore: concentration,
    holderDiversityScore: diversity,
    holderQualityScore: quality,
    ownershipDistributionScore: ownershipDistribution,
    walletIndependenceScore: independence,
    metrics,
    explanations: explanations({
      metrics,
      concentration,
      diversity,
      holderQuality: quality,
      ownershipDistribution,
      independence,
    }),
  };
}
