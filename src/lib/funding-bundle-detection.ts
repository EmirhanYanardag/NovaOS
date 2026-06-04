export type FundingWalletInput = {
  rank: number;
  address: string;
  ownershipPercent?: number;
  walletAgeDays?: number;
  firstSeenAt?: string;
  firstTokenActivityAt?: string;
  nativeBalanceUsd?: number;
  transactionCount?: number;
  recentTx30d?: number;
  recentTx7d?: number;
  interactedTokenCount?: number;
  tokenTransferInCount?: number;
  tokenTransferOutCount?: number;
  tokenHoldDays?: number;
  counterparties?: string[];
  fundingSources?: string[];
  firstFundingTxHash?: string;
  firstFundingFrom?: string;
  firstFundingAt?: string;
};

export type FundingBundleInput = {
  chain: string;
  tokenAddress: string;
  tokenSymbol?: string;
  wallets: FundingWalletInput[];
};

export type FundingBundleResult = {
  bundleRiskScore: number;
  fundingSimilarityScore: number;
  sameWindowActivityScore: number;
  freshWalletClusterScore: number;
  sharedCounterpartyScore: number;
  fakeDecentralizationRisk: number;
  riskLevel: "Low" | "Medium" | "Elevated" | "High";
  detectedGroups: {
    groupId: string;
    wallets: string[];
    reason: string;
    confidence: "Low" | "Medium" | "High";
    riskScore: number;
  }[];
  positives: string[];
  negatives: string[];
  warnings: string[];
};

function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function normalizeAddress(value?: string) {
  return value?.trim().toLowerCase() || "";
}

function shortAddress(value: string) {
  if (value.length < 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function riskLevelFromScore(score: number): FundingBundleResult["riskLevel"] {
  if (score >= 76) return "High";
  if (score >= 51) return "Elevated";
  if (score >= 26) return "Medium";
  return "Low";
}

function confidenceFromScore(score: number): "Low" | "Medium" | "High" {
  if (score >= 75) return "High";
  if (score >= 45) return "Medium";
  return "Low";
}

function parseTime(value?: string) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function percent(part: number, total: number) {
  if (total <= 0) return 0;
  return (part / total) * 100;
}

function largestGroup<T>(groups: Map<string, T[]>) {
  return [...groups.entries()].sort((a, b) => b[1].length - a[1].length)[0];
}

function calculateFreshWalletClusterScore(wallets: FundingWalletInput[]) {
  const total = Math.max(1, wallets.length);
  const freshWallets = wallets.filter(
    (wallet) =>
      typeof wallet.walletAgeDays === "number" && wallet.walletAgeDays <= 7
  );
  const youngWallets = wallets.filter(
    (wallet) =>
      typeof wallet.walletAgeDays === "number" && wallet.walletAgeDays <= 30
  );
  const freshWalletPercent = percent(freshWallets.length, total);
  const youngWalletPercent = percent(youngWallets.length, total);
  const freshHighOwnershipCount = freshWallets.filter(
    (wallet) => (wallet.ownershipPercent || 0) > 1
  ).length;
  const lowTxHighOwnershipCount = wallets.filter(
    (wallet) =>
      (wallet.transactionCount || 0) <= 5 && (wallet.ownershipPercent || 0) > 1
  ).length;
  let score =
    freshWalletPercent <= 10
      ? freshWalletPercent
      : freshWalletPercent <= 25
      ? 22 + (freshWalletPercent - 10) * 1.4
      : freshWalletPercent <= 50
      ? 43 + (freshWalletPercent - 25) * 1.3
      : 76 + (freshWalletPercent - 50) * 0.48;

  score += youngWalletPercent * 0.18;
  score += freshHighOwnershipCount * 8;
  score += lowTxHighOwnershipCount * 6;

  return Math.round(clamp(score));
}

function calculateSameWindowActivityScore(wallets: FundingWalletInput[]) {
  const timedWallets = wallets
    .map((wallet) => ({
      wallet,
      time: parseTime(wallet.firstTokenActivityAt),
    }))
    .filter((item): item is { wallet: FundingWalletInput; time: number } =>
      Number.isFinite(item.time)
    );
  const total = Math.max(1, wallets.length);

  if (timedWallets.length < 2) return 0;

  const scoreForWindow = (windowMs: number, multiplier: number) => {
    let largest = 0;

    timedWallets.forEach((source) => {
      const count = timedWallets.filter(
        (candidate) => Math.abs(candidate.time - source.time) <= windowMs
      ).length;
      largest = Math.max(largest, count);
    });

    return percent(largest, total) * multiplier;
  };

  return Math.round(
    clamp(
      Math.max(
        scoreForWindow(60_000, 1.2),
        scoreForWindow(5 * 60_000, 1),
        scoreForWindow(15 * 60_000, 0.8),
        scoreForWindow(60 * 60_000, 0.6)
      )
    )
  );
}

function calculateFundingSimilarityScore(wallets: FundingWalletInput[]) {
  const fundingPairs = wallets.flatMap((wallet) => {
    const sources = [
      wallet.firstFundingFrom,
      ...(wallet.fundingSources || []),
    ].map(normalizeAddress).filter(Boolean);

    return sources.map((source) => ({ source, wallet }));
  });

  if (fundingPairs.length === 0) {
    return {
      score: 35,
      warning:
        "Funding source data unavailable; funding similarity is estimated conservatively.",
      groups: new Map<string, FundingWalletInput[]>(),
    };
  }

  const groups = new Map<string, FundingWalletInput[]>();
  fundingPairs.forEach(({ source, wallet }) => {
    const existing = groups.get(source) || [];
    if (!existing.some((item) => item.address === wallet.address)) {
      groups.set(source, [...existing, wallet]);
    }
  });
  const dominant = largestGroup(groups);
  const score = dominant ? percent(dominant[1].length, wallets.length) : 0;

  return {
    score: Math.round(clamp(score)),
    warning: null,
    groups,
  };
}

function calculateSharedCounterpartyScore(wallets: FundingWalletInput[]) {
  const groups = new Map<string, FundingWalletInput[]>();

  wallets.forEach((wallet) => {
    (wallet.counterparties || []).map(normalizeAddress).filter(Boolean).forEach(
      (counterparty) => {
        const existing = groups.get(counterparty) || [];
        if (!existing.some((item) => item.address === wallet.address)) {
          groups.set(counterparty, [...existing, wallet]);
        }
      }
    );
  });

  const knownWallets = wallets.filter((wallet) => wallet.counterparties?.length);
  if (knownWallets.length < 3) {
    return {
      score: knownWallets.length === 0 ? 20 : 35,
      groups,
      weakData: true,
    };
  }

  const dominant = largestGroup(groups);
  const dominantShare = dominant ? percent(dominant[1].length, wallets.length) : 0;
  const repeatedGroups = [...groups.values()].filter((group) => group.length >= 2);
  const repeatedBonus = Math.min(24, repeatedGroups.length * 4);

  return {
    score: Math.round(clamp(dominantShare + repeatedBonus)),
    groups,
    weakData: false,
  };
}

function walletList(wallets: FundingWalletInput[]) {
  return wallets
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 8)
    .map((wallet) => shortAddress(wallet.address));
}

function buildDetectedGroups({
  fundingGroups,
  sameWindowActivityScore,
  sharedCounterpartyGroups,
  wallets,
}: {
  fundingGroups: Map<string, FundingWalletInput[]>;
  sameWindowActivityScore: number;
  sharedCounterpartyGroups: Map<string, FundingWalletInput[]>;
  wallets: FundingWalletInput[];
}) {
  const groups: FundingBundleResult["detectedGroups"] = [];
  const dominantFundingGroup = largestGroup(fundingGroups);

  if (dominantFundingGroup && dominantFundingGroup[1].length >= 2) {
    groups.push({
      groupId: "funding-source-01",
      wallets: walletList(dominantFundingGroup[1]),
      reason:
        "Wallets show possible funding similarity from a shared funding source.",
      confidence: confidenceFromScore(percent(dominantFundingGroup[1].length, wallets.length)),
      riskScore: Math.round(clamp(percent(dominantFundingGroup[1].length, wallets.length))),
    });
  }

  const timedWallets = wallets.filter((wallet) => wallet.firstTokenActivityAt);
  if (sameWindowActivityScore >= 35 && timedWallets.length >= 2) {
    groups.push({
      groupId: "activity-window-01",
      wallets: walletList(timedWallets),
      reason:
        "Wallets show similar first token activity timing in a short window.",
      confidence: confidenceFromScore(sameWindowActivityScore),
      riskScore: sameWindowActivityScore,
    });
  }

  const freshHighOwnership = wallets.filter(
    (wallet) =>
      typeof wallet.walletAgeDays === "number" &&
      wallet.walletAgeDays <= 30 &&
      (wallet.ownershipPercent || 0) > 1
  );
  if (freshHighOwnership.length >= 2) {
    groups.push({
      groupId: "fresh-ownership-01",
      wallets: walletList(freshHighOwnership),
      reason:
        "Fresh high-ownership wallets increase bundle-like structure risk.",
      confidence: confidenceFromScore(freshHighOwnership.length * 18),
      riskScore: Math.round(clamp(freshHighOwnership.length * 18)),
    });
  }

  const dominantCounterpartyGroup = largestGroup(sharedCounterpartyGroups);
  if (dominantCounterpartyGroup && dominantCounterpartyGroup[1].length >= 2) {
    groups.push({
      groupId: "shared-counterparty-01",
      wallets: walletList(dominantCounterpartyGroup[1]),
      reason:
        "Wallets show shared counterparty overlap, suggesting possible coordination.",
      confidence: confidenceFromScore(
        percent(dominantCounterpartyGroup[1].length, wallets.length)
      ),
      riskScore: Math.round(
        clamp(percent(dominantCounterpartyGroup[1].length, wallets.length))
      ),
    });
  }

  return groups.slice(0, 6);
}

export function analyzeFundingBundle(
  input: FundingBundleInput
): FundingBundleResult {
  const wallets = input.wallets.filter((wallet) => normalizeAddress(wallet.address));
  const warnings = [
    "Bundle detection is inference-based and does not prove shared ownership.",
    "Transfer-only analysis cannot confirm funding control or insider identity.",
  ];

  if (wallets.length === 0) {
    return {
      bundleRiskScore: 0,
      fundingSimilarityScore: 35,
      sameWindowActivityScore: 0,
      freshWalletClusterScore: 0,
      sharedCounterpartyScore: 20,
      fakeDecentralizationRisk: 0,
      riskLevel: "Low",
      detectedGroups: [],
      positives: ["No wallet set was available for bundle analysis."],
      negatives: [],
      warnings,
    };
  }

  const freshWalletClusterScore = calculateFreshWalletClusterScore(wallets);
  const sameWindowActivityScore = calculateSameWindowActivityScore(wallets);
  const fundingSimilarity = calculateFundingSimilarityScore(wallets);
  const sharedCounterparty = calculateSharedCounterpartyScore(wallets);

  if (fundingSimilarity.warning) warnings.push(fundingSimilarity.warning);
  if (sharedCounterparty.weakData) {
    warnings.push("Counterparty data is limited; shared counterparty risk is conservative.");
  }

  const fundingSimilarityScore = fundingSimilarity.score;
  const sharedCounterpartyScore = sharedCounterparty.score;
  const fakeDecentralizationRisk = Math.round(
    clamp(
      0.3 * freshWalletClusterScore +
        0.25 * sameWindowActivityScore +
        0.25 * fundingSimilarityScore +
        0.2 * sharedCounterpartyScore
    )
  );
  const bundleRiskScore = Math.round(
    clamp(
      0.3 * fundingSimilarityScore +
        0.25 * sameWindowActivityScore +
        0.2 * freshWalletClusterScore +
        0.15 * sharedCounterpartyScore +
        0.1 * fakeDecentralizationRisk
    )
  );
  const detectedGroups = buildDetectedGroups({
    fundingGroups: fundingSimilarity.groups,
    sameWindowActivityScore,
    sharedCounterpartyGroups: sharedCounterparty.groups,
    wallets,
  });
  const positives: string[] = [];
  const negatives: string[] = [];

  if (sameWindowActivityScore < 30) {
    positives.push("Top holders show limited same-window activity.");
  } else {
    negatives.push(
      "Multiple top wallets first interacted with the token in the same short time window."
    );
  }
  if (fundingSimilarityScore < 45 || fundingSimilarity.warning) {
    positives.push("No dominant shared funding source detected.");
  } else {
    negatives.push("Possible funding similarity increases coordination risk.");
  }
  if (freshWalletClusterScore < 35) {
    positives.push("Fresh wallet concentration appears limited.");
  } else {
    negatives.push("Fresh high-ownership wallets increase bundle-like risk.");
  }
  if (sharedCounterpartyScore >= 45) {
    negatives.push("Shared counterparty overlap suggests possible coordination.");
  }

  return {
    bundleRiskScore,
    fundingSimilarityScore,
    sameWindowActivityScore,
    freshWalletClusterScore,
    sharedCounterpartyScore,
    fakeDecentralizationRisk,
    riskLevel: riskLevelFromScore(bundleRiskScore),
    detectedGroups,
    positives,
    negatives,
    warnings,
  };
}
