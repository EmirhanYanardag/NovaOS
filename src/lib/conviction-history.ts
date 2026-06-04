export type ConvictionSnapshot = {
  snapshotId: string;
  tokenAddress: string;
  chain: string;
  tokenSymbol?: string;
  tokenLogo?: string;
  createdAt: string;
  finalConvictionScore: number;
  subScores: {
    holderIntegrity?: number;
    walletQuality?: number;
    behaviorStability?: number;
    liquidityTrust?: number;
    marketMomentum?: number;
    riskProtection?: number;
    insiderRisk?: number;
    clusterRisk?: number;
    bundleRisk?: number;
    botActivityRisk?: number;
    rotationRisk?: number;
    freshWalletRisk?: number;
  };
  dataConfidence?: {
    score?: number;
    label?: string;
  };
  explanationHeadline?: string;
  warnings?: string[];
  source?: {
    status?: string;
    cacheGeneratedAt?: string;
  };
};

export type ConvictionSnapshotComparison = {
  fromSnapshotId: string;
  toSnapshotId: string;
  tokenAddress: string;
  chain: string;
  previousScore: number;
  currentScore: number;
  scoreDelta: number;
  direction: "increased" | "decreased" | "unchanged";
  magnitude: "minor" | "moderate" | "major";
  subScoreDeltas: Record<string, number>;
  strongestPositiveChanges: string[];
  strongestNegativeChanges: string[];
  summary: string;
  riskShiftSummary: string;
  confidenceShiftSummary: string;
};

export type ConvictionHistoryTimeframe = "1h" | "1d" | "7d" | "30d" | "all";

export type ConvictionHistorySelection = {
  previousSnapshot?: ConvictionSnapshot;
  currentSnapshot?: ConvictionSnapshot;
  snapshotsInRange: ConvictionSnapshot[];
  rangeLabel: string;
  reason?: string;
};

type ConvictionSnapshotInput = Omit<
  ConvictionSnapshot,
  "snapshotId" | "createdAt"
> & {
  snapshotId?: string;
  createdAt?: string;
};

const positiveSubscoreLabels: Record<string, string> = {
  holderIntegrity: "holder integrity",
  walletQuality: "wallet quality",
  behaviorStability: "behavior stability",
  liquidityTrust: "liquidity trust",
  marketMomentum: "market momentum",
  riskProtection: "risk protection",
};

const riskSubscoreLabels: Record<string, string> = {
  insiderRisk: "insider risk",
  clusterRisk: "cluster risk",
  bundleRisk: "bundle risk",
  botActivityRisk: "bot activity risk",
  rotationRisk: "rotation risk",
  freshWalletRisk: "fresh wallet risk",
};

function normalizeKey(chain: string, tokenAddress: string) {
  return `${chain.toLowerCase()}:${tokenAddress.toLowerCase()}`;
}

const convictionHistoryTimeframeMs: Record<
  Exclude<ConvictionHistoryTimeframe, "all">,
  number
> = {
  "1h": 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

const convictionHistoryRangeLabels: Record<ConvictionHistoryTimeframe, string> =
  {
    "1h": "1H Replay",
    "1d": "1D Replay",
    "7d": "7D Replay",
    "30d": "30D Replay",
    all: "All Stored History",
  };

function createSnapshotId({
  chain,
  createdAt,
  tokenAddress,
}: {
  chain: string;
  createdAt: string;
  tokenAddress: string;
}) {
  return `${chain.toLowerCase()}-${tokenAddress.toLowerCase().slice(0, 10)}-${Date.parse(
    createdAt
  )}`;
}

function safeNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

const snapshotComparisonKeys: Array<
  keyof ConvictionSnapshot["subScores"]
> = [
  "holderIntegrity",
  "walletQuality",
  "behaviorStability",
  "liquidityTrust",
  "marketMomentum",
  "riskProtection",
  "insiderRisk",
  "clusterRisk",
  "bundleRisk",
  "botActivityRisk",
  "rotationRisk",
  "freshWalletRisk",
];

function hasSameMeasuredScores(
  previous: ConvictionSnapshot,
  current: ConvictionSnapshot
) {
  return (
    previous.finalConvictionScore === current.finalConvictionScore &&
    snapshotComparisonKeys.every(
      (key) => previous.subScores[key] === current.subScores[key]
    ) &&
    previous.dataConfidence?.score === current.dataConfidence?.score &&
    previous.dataConfidence?.label === current.dataConfidence?.label
  );
}

function roundDelta(value: number) {
  return Math.round(value);
}

function labelList(values: string[]) {
  if (values.length === 0) return "";
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function changeMagnitudeLabel(value: string) {
  return Math.abs(Number(value.match(/[-+]?\d+$/)?.[0] || 0));
}

export function createConvictionSnapshot(
  input: ConvictionSnapshotInput
): ConvictionSnapshot {
  const createdAt = input.createdAt || new Date().toISOString();

  return {
    snapshotId:
      input.snapshotId ||
      createSnapshotId({
        chain: input.chain,
        tokenAddress: input.tokenAddress,
        createdAt,
      }),
    tokenAddress: input.tokenAddress,
    chain: input.chain,
    tokenSymbol: input.tokenSymbol,
    tokenLogo: input.tokenLogo,
    createdAt,
    finalConvictionScore: Math.round(safeNumber(input.finalConvictionScore)),
    subScores: { ...input.subScores },
    dataConfidence: input.dataConfidence
      ? { ...input.dataConfidence }
      : undefined,
    explanationHeadline: input.explanationHeadline,
    warnings: input.warnings ? [...input.warnings] : undefined,
    source: input.source ? { ...input.source } : undefined,
  };
}

export function selectComparisonSnapshots(
  snapshots: ConvictionSnapshot[],
  timeframe: ConvictionHistoryTimeframe
): ConvictionHistorySelection {
  const orderedSnapshots = [...snapshots].sort(
    (left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt)
  );
  const currentSnapshot = orderedSnapshots[orderedSnapshots.length - 1];
  const rangeLabel = convictionHistoryRangeLabels[timeframe];

  if (!currentSnapshot) {
    return {
      snapshotsInRange: [],
      rangeLabel,
      reason: "No conviction snapshot stored yet.",
    };
  }

  if (timeframe === "all") {
    return {
      currentSnapshot,
      previousSnapshot:
        orderedSnapshots.length >= 2 ? orderedSnapshots[0] : undefined,
      snapshotsInRange: orderedSnapshots,
      rangeLabel,
      reason:
        orderedSnapshots.length >= 2
          ? undefined
          : "Replay requires at least two real snapshots.",
    };
  }

  const cutoff =
    Date.parse(currentSnapshot.createdAt) - convictionHistoryTimeframeMs[timeframe];
  const snapshotsInRange = orderedSnapshots.filter(
    (snapshot) => Date.parse(snapshot.createdAt) >= cutoff
  );
  const previousSnapshot =
    snapshotsInRange.length >= 2 ? snapshotsInRange[0] : undefined;

  return {
    currentSnapshot,
    previousSnapshot,
    snapshotsInRange,
    rangeLabel,
    reason: previousSnapshot
      ? undefined
      : "No earlier stored snapshot inside the selected range.",
  };
}

export function calculateScoreDelta(previousScore: number, currentScore: number) {
  return roundDelta(safeNumber(currentScore) - safeNumber(previousScore));
}

export function classifyDeltaMagnitude(
  delta: number
): ConvictionSnapshotComparison["magnitude"] {
  const absoluteDelta = Math.abs(delta);
  if (absoluteDelta < 5) return "minor";
  if (absoluteDelta < 15) return "moderate";
  return "major";
}

function calculateSubscoreDeltas(
  previous: ConvictionSnapshot,
  current: ConvictionSnapshot
) {
  const keys = new Set([
    ...Object.keys(previous.subScores),
    ...Object.keys(current.subScores),
  ]);
  const deltas: Record<string, number> = {};

  keys.forEach((key) => {
    const previousValue = safeNumber(
      previous.subScores[key as keyof ConvictionSnapshot["subScores"]]
    );
    const currentValue = safeNumber(
      current.subScores[key as keyof ConvictionSnapshot["subScores"]]
    );
    deltas[key] = calculateScoreDelta(previousValue, currentValue);
  });

  return deltas;
}

export function generateSubscoreDeltaSummary(deltas: Record<string, number>) {
  const positiveChanges: string[] = [];
  const negativeChanges: string[] = [];

  Object.entries(deltas).forEach(([key, delta]) => {
    if (Math.abs(delta) < 3) return;

    if (key in positiveSubscoreLabels) {
      const label = positiveSubscoreLabels[key];
      if (delta > 0) positiveChanges.push(`${label} +${delta}`);
      if (delta < 0) negativeChanges.push(`${label} ${delta}`);
      return;
    }

    if (key in riskSubscoreLabels) {
      const label = riskSubscoreLabels[key];
      if (delta < 0) positiveChanges.push(`${label} ${delta}`);
      if (delta > 0) negativeChanges.push(`${label} +${delta}`);
    }
  });

  return {
    strongestPositiveChanges: positiveChanges
      .sort((a, b) => changeMagnitudeLabel(b) - changeMagnitudeLabel(a))
      .slice(0, 4),
    strongestNegativeChanges: negativeChanges
      .sort((a, b) => changeMagnitudeLabel(b) - changeMagnitudeLabel(a))
      .slice(0, 4),
  };
}

export function generateConvictionChangeSummary(
  comparison: Pick<
    ConvictionSnapshotComparison,
    | "direction"
    | "scoreDelta"
    | "strongestPositiveChanges"
    | "strongestNegativeChanges"
  >
) {
  const absoluteDelta = Math.abs(comparison.scoreDelta);

  if (comparison.direction === "unchanged") {
    return "Conviction remained stable; no major measured driver changed between stored snapshots.";
  }

  if (comparison.direction === "increased") {
    const drivers = comparison.strongestPositiveChanges.length
      ? ` as ${labelList(comparison.strongestPositiveChanges)} improved`
      : "";
    return `Conviction increased by ${absoluteDelta} points${drivers}.`;
  }

  const drivers = comparison.strongestNegativeChanges.length
    ? ` as ${labelList(comparison.strongestNegativeChanges)} weakened`
    : "";
  return `Conviction decreased by ${absoluteDelta} points${drivers}.`;
}

export function generateRiskShiftSummary(
  previous: ConvictionSnapshot,
  current: ConvictionSnapshot
) {
  const riskKeys = Object.keys(riskSubscoreLabels) as Array<
    keyof ConvictionSnapshot["subScores"]
  >;
  const changes = riskKeys
    .map((key) => ({
      key,
      label: riskSubscoreLabels[key],
      delta: calculateScoreDelta(
        safeNumber(previous.subScores[key]),
        safeNumber(current.subScores[key])
      ),
    }))
    .filter((change) => Math.abs(change.delta) >= 3)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  if (changes.length === 0) return "Risk posture remained broadly stable.";

  const increased = changes.filter((change) => change.delta > 0);
  const decreased = changes.filter((change) => change.delta < 0);

  if (increased.length >= decreased.length) {
    return `Risk increased most through ${labelList(
      increased.slice(0, 3).map((change) => `${change.label} +${change.delta}`)
    )}.`;
  }

  return `Risk eased most through ${labelList(
    decreased.slice(0, 3).map((change) => `${change.label} ${change.delta}`)
  )}.`;
}

export function generateConfidenceShiftSummary(
  previous: ConvictionSnapshot,
  current: ConvictionSnapshot
) {
  const previousScore = previous.dataConfidence?.score;
  const currentScore = current.dataConfidence?.score;
  const previousLabel = previous.dataConfidence?.label;
  const currentLabel = current.dataConfidence?.label;

  if (typeof previousScore !== "number" || typeof currentScore !== "number") {
    if (previousLabel && currentLabel && previousLabel !== currentLabel) {
      return `Data confidence shifted from ${previousLabel} to ${currentLabel}.`;
    }
    return "Data confidence shift is unavailable for this comparison.";
  }

  const delta = calculateScoreDelta(previousScore, currentScore);
  if (Math.abs(delta) < 3) return "Data confidence remained broadly stable.";

  const direction = delta > 0 ? "improved" : "weakened";
  return `Data confidence ${direction} by ${Math.abs(delta)} points${
    previousLabel && currentLabel ? ` (${previousLabel} to ${currentLabel})` : ""
  }.`;
}

export function compareConvictionSnapshots(
  previous: ConvictionSnapshot,
  current: ConvictionSnapshot
): ConvictionSnapshotComparison {
  const scoreDelta = calculateScoreDelta(
    previous.finalConvictionScore,
    current.finalConvictionScore
  );
  const direction: ConvictionSnapshotComparison["direction"] =
    Math.abs(scoreDelta) < 1
      ? "unchanged"
      : scoreDelta > 0
      ? "increased"
      : "decreased";
  const subScoreDeltas = calculateSubscoreDeltas(previous, current);
  const subscoreSummary = generateSubscoreDeltaSummary(subScoreDeltas);
  const comparisonBase = {
    direction,
    scoreDelta,
    strongestPositiveChanges: subscoreSummary.strongestPositiveChanges,
    strongestNegativeChanges: subscoreSummary.strongestNegativeChanges,
  };

  return {
    fromSnapshotId: previous.snapshotId,
    toSnapshotId: current.snapshotId,
    tokenAddress: current.tokenAddress,
    chain: current.chain,
    previousScore: previous.finalConvictionScore,
    currentScore: current.finalConvictionScore,
    scoreDelta,
    direction,
    magnitude: classifyDeltaMagnitude(scoreDelta),
    subScoreDeltas,
    strongestPositiveChanges: subscoreSummary.strongestPositiveChanges,
    strongestNegativeChanges: subscoreSummary.strongestNegativeChanges,
    summary: generateConvictionChangeSummary(comparisonBase),
    riskShiftSummary: generateRiskShiftSummary(previous, current),
    confidenceShiftSummary: generateConfidenceShiftSummary(previous, current),
  };
}

export function createInMemoryConvictionHistoryStore() {
  const snapshotsByToken = new Map<string, ConvictionSnapshot[]>();

  return {
    addSnapshot(snapshot: ConvictionSnapshot) {
      const normalizedSnapshot = createConvictionSnapshot(snapshot);
      const key = normalizeKey(
        normalizedSnapshot.chain,
        normalizedSnapshot.tokenAddress
      );
      const snapshots = snapshotsByToken.get(key) || [];
      const existing = snapshots.find(
        (candidate) => candidate.snapshotId === normalizedSnapshot.snapshotId
      );
      if (existing) return existing;
      const latest = snapshots[snapshots.length - 1];
      const elapsedSinceLatest = latest
        ? Date.parse(normalizedSnapshot.createdAt) - Date.parse(latest.createdAt)
        : null;
      const isRecentDuplicate =
        latest &&
        elapsedSinceLatest !== null &&
        elapsedSinceLatest >= 0 &&
        elapsedSinceLatest < 60_000 &&
        hasSameMeasuredScores(latest, normalizedSnapshot);
      if (isRecentDuplicate) return latest;
      const nextSnapshots = [...snapshots, normalizedSnapshot].sort(
        (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)
      );
      snapshotsByToken.set(key, nextSnapshots);
      return normalizedSnapshot;
    },
    getLatestSnapshot(chain: string, tokenAddress: string) {
      const snapshots = snapshotsByToken.get(normalizeKey(chain, tokenAddress));
      return snapshots?.[snapshots.length - 1] || null;
    },
    getSnapshots(chain: string, tokenAddress: string) {
      return [...(snapshotsByToken.get(normalizeKey(chain, tokenAddress)) || [])];
    },
    clearSnapshots(chain: string, tokenAddress: string) {
      snapshotsByToken.delete(normalizeKey(chain, tokenAddress));
    },
    compareWithLatest(snapshot: ConvictionSnapshot) {
      const latest = this.getLatestSnapshot(snapshot.chain, snapshot.tokenAddress);
      const normalizedSnapshot = createConvictionSnapshot(snapshot);
      if (!latest) {
        this.addSnapshot(normalizedSnapshot);
        return null;
      }
      const comparison = compareConvictionSnapshots(latest, normalizedSnapshot);
      this.addSnapshot(normalizedSnapshot);
      return comparison;
    },
  };
}

type ConvictionHistoryStore = ReturnType<
  typeof createInMemoryConvictionHistoryStore
>;

const globalHistory = globalThis as typeof globalThis & {
  __novaosConvictionHistoryStore?: ConvictionHistoryStore;
};

export function getInMemoryConvictionHistoryStore() {
  return (
    globalHistory.__novaosConvictionHistoryStore ||
    (globalHistory.__novaosConvictionHistoryStore =
      createInMemoryConvictionHistoryStore())
  );
}
