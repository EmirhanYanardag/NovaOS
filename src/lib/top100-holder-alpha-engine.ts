import type { WalletAlphaResultV2 } from "@/lib/wallet-alpha-engine";

type HolderAlphaTier = "elite" | "strong" | "average" | "weak" | "toxic";

type Distribution = Record<HolderAlphaTier, number>;

export type Top100HolderAlphaResultV1 = {
  holderAlphaScore: number;
  holderAlphaTier: HolderAlphaTier;
  walletCount: number;
  analyzedWalletCount: number;
  weightedWalletAlpha: number | null;
  simpleAverageWalletAlpha: number | null;
  eliteWalletCount: number;
  strongWalletCount: number;
  weakWalletCount: number;
  toxicWalletCount: number;
  eliteOwnershipShare: number;
  strongOwnershipShare: number;
  weakOwnershipShare: number;
  toxicOwnershipShare: number;
  topHolderConcentration: number | null;
  top10OwnershipShare: number;
  top25OwnershipShare: number;
  holderQualityDistribution: Distribution;
  ownershipWeightedDistribution: Distribution;
  dataConfidenceScore: number;
  coverage: {
    fullHistoryWallets: number;
    partialHistoryWallets: number;
    lowConfidenceWallets: number;
    averageActivitiesPerWallet: number | null;
    averageCompletedTradesPerWallet: number | null;
  };
  explanations: string[];
};

function round(value: number, decimals = 2) {
  return Number(value.toFixed(decimals));
}

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function walletTier(score: number): HolderAlphaTier {
  if (score >= 80) return "elite";
  if (score >= 65) return "strong";
  if (score >= 45) return "average";
  if (score >= 30) return "weak";
  return "toxic";
}

function holderAlphaTier(score: number): HolderAlphaTier {
  return walletTier(score);
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

function emptyDistribution(): Distribution {
  return {
    elite: 0,
    strong: 0,
    average: 0,
    weak: 0,
    toxic: 0,
  };
}

function distributionPercentages(distribution: Distribution, total: number) {
  if (total <= 0) return emptyDistribution();

  return {
    elite: round((distribution.elite / total) * 100),
    strong: round((distribution.strong / total) * 100),
    average: round((distribution.average / total) * 100),
    weak: round((distribution.weak / total) * 100),
    toxic: round((distribution.toxic / total) * 100),
  };
}

function dataConfidenceScore(wallets: WalletAlphaResultV2[]) {
  if (wallets.length === 0) return 0;

  const fullHistoryRatio =
    wallets.filter((wallet) => wallet.rawMetrics.reachedEndOfHistory).length /
    wallets.length;
  const highConfidenceRatio =
    wallets.filter((wallet) => wallet.confidenceLevel === "high").length /
    wallets.length;
  const averageActivities =
    average(wallets.map((wallet) => wallet.rawMetrics.activityCount)) || 0;
  const averageCompletedTrades =
    average(wallets.map((wallet) => wallet.rawMetrics.totalCompletedTrades)) || 0;

  return clampScore(
    fullHistoryRatio * 35 +
      highConfidenceRatio * 30 +
      Math.min(1, averageActivities / 100) * 20 +
      Math.min(1, averageCompletedTrades / 12) * 15
  );
}

function explanations({
  score,
  weighted,
  simple,
  confidence,
  distribution,
  coverage,
  top10OwnershipShare,
}: {
  score: number;
  weighted: number | null;
  simple: number | null;
  confidence: number;
  distribution: Distribution;
  coverage: Top100HolderAlphaResultV1["coverage"];
  top10OwnershipShare: number;
}) {
  const rows: string[] = [];

  rows.push(
    `Holder Alpha is ${score}/100 from ownership-weighted Wallet Alpha, simple average Wallet Alpha, and data confidence.`
  );

  if (weighted !== null) {
    rows.push(`Ownership-weighted Wallet Alpha is ${weighted}/100 using square-root ownership weights.`);
  }

  if (simple !== null) {
    rows.push(`Simple average Wallet Alpha is ${simple}/100 across analyzed wallets.`);
  }

  rows.push(`Data confidence contributes ${confidence}/100 based on history coverage, confidence levels, activity depth, and completed trade depth.`);

  if (distribution.elite + distribution.strong > distribution.weak + distribution.toxic) {
    rows.push("Elite and strong wallets outnumber weak and toxic wallets.");
  }

  if (distribution.toxic > 0) {
    rows.push(`${distribution.toxic} toxic wallet(s) were detected in the analyzed holder set.`);
  }

  if (coverage.partialHistoryWallets > coverage.fullHistoryWallets) {
    rows.push("More wallets have partial history than full GMGN history, so holder quality should be treated as provisional.");
  }

  rows.push(`Top 10 ownership share is ${top10OwnershipShare}%; concentration is reported separately and does not reduce Holder Alpha V1.`);

  return rows;
}

export function computeTop100HolderAlphaV1(
  walletAlphaBatch: WalletAlphaResultV2[]
): Top100HolderAlphaResultV1 {
  const wallets = walletAlphaBatch.filter((wallet) =>
    Number.isFinite(wallet.scores.walletAlphaV2)
  );
  const walletCount = walletAlphaBatch.length;
  const analyzedWalletCount = wallets.length;
  const walletScores = wallets.map((wallet) => wallet.scores.walletAlphaV2);
  const simpleAverageWalletAlpha = average(walletScores);
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
  const holderQualityCounts = emptyDistribution();
  const ownershipWeightedShares = emptyDistribution();

  for (const wallet of wallets) {
    const tier = walletTier(wallet.scores.walletAlphaV2);
    holderQualityCounts[tier] += 1;
    ownershipWeightedShares[tier] += ownership(wallet);
  }

  const sortedOwnership = [...wallets]
    .map(ownership)
    .sort((a, b) => b - a);
  const topHolderConcentration = sortedOwnership[0] ?? null;
  const top10OwnershipShare = round(sum(sortedOwnership.slice(0, 10)));
  const top25OwnershipShare = round(sum(sortedOwnership.slice(0, 25)));
  const confidence = dataConfidenceScore(wallets);
  const holderAlphaScore = clampScore(
    (weightedWalletAlpha ?? 50) * 0.65 +
      (simpleAverageWalletAlpha ?? 50) * 0.25 +
      confidence * 0.1
  );
  const coverage = {
    fullHistoryWallets: wallets.filter(
      (wallet) => wallet.rawMetrics.reachedEndOfHistory
    ).length,
    partialHistoryWallets: wallets.filter(
      (wallet) =>
        wallet.rawMetrics.hasMoreHistory ||
        wallet.rawMetrics.stoppedByPageLimit ||
        wallet.rawMetrics.stoppedByActivityLimit ||
        wallet.rawMetrics.stoppedByTimeout
    ).length,
    lowConfidenceWallets: wallets.filter(
      (wallet) => wallet.confidenceLevel === "low"
    ).length,
    averageActivitiesPerWallet: average(
      wallets.map((wallet) => wallet.rawMetrics.activityCount)
    ),
    averageCompletedTradesPerWallet: average(
      wallets.map((wallet) => wallet.rawMetrics.totalCompletedTrades)
    ),
  };

  return {
    holderAlphaScore,
    holderAlphaTier: holderAlphaTier(holderAlphaScore),
    walletCount,
    analyzedWalletCount,
    weightedWalletAlpha,
    simpleAverageWalletAlpha,
    eliteWalletCount: holderQualityCounts.elite,
    strongWalletCount: holderQualityCounts.strong,
    weakWalletCount: holderQualityCounts.weak,
    toxicWalletCount: holderQualityCounts.toxic,
    eliteOwnershipShare: round(ownershipWeightedShares.elite),
    strongOwnershipShare: round(ownershipWeightedShares.strong),
    weakOwnershipShare: round(ownershipWeightedShares.weak),
    toxicOwnershipShare: round(ownershipWeightedShares.toxic),
    topHolderConcentration:
      topHolderConcentration === null ? null : round(topHolderConcentration),
    top10OwnershipShare,
    top25OwnershipShare,
    holderQualityDistribution: distributionPercentages(
      holderQualityCounts,
      analyzedWalletCount
    ),
    ownershipWeightedDistribution: {
      elite: round(ownershipWeightedShares.elite),
      strong: round(ownershipWeightedShares.strong),
      average: round(ownershipWeightedShares.average),
      weak: round(ownershipWeightedShares.weak),
      toxic: round(ownershipWeightedShares.toxic),
    },
    dataConfidenceScore: confidence,
    coverage,
    explanations: explanations({
      score: holderAlphaScore,
      weighted: weightedWalletAlpha,
      simple: simpleAverageWalletAlpha,
      confidence,
      distribution: holderQualityCounts,
      coverage,
      top10OwnershipShare,
    }),
  };
}
