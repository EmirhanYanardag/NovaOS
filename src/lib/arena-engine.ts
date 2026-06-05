export type ArenaVerdict =
  | "AI aligned with holder behavior"
  | "AI cautious while holders accumulate"
  | "AI conviction exceeds holder confidence"
  | "Fragmented holder behavior"
  | "Insufficient behavioral agreement";

export type ArenaConfidenceLabel = "High" | "Medium" | "Low";
export type NovaArenaStance = "Pending" | "Bullish" | "Accumulate" | "Bearish";
export type ArenaTimeframe = "24H" | "7D";

export type ArenaWindow = {
  arenaWindowId: string;
  timeframe: ArenaTimeframe;
  opensAt: string;
  closesAt: string;
  resolvesAt: string;
  votingOpen: boolean;
};

export type ArenaProgress = {
  progressPercent: number;
  votingOpen: boolean;
};

export type ArenaTimeRemaining = {
  timeRemainingLabel: string;
};

export type NovaArenaStanceInput = {
  convictionScore?: number | null;
  holderQuality?: number | null;
  structuralSafety?: number | null;
  marketIntegrity?: number | null;
  insiderRisk?: number | null;
  walletFlow?: string | null;
  dataConfidence?: number | null;
};

export type NovaArenaStanceResult = {
  stance: NovaArenaStance;
  reason: string;
};

export type ArenaClusterSignals = {
  totalAnalyzedWallets?: number;
  clusteredWallets?: number;
  isolatedWallets?: number;
  averageClusterConfidence?: number;
  dominantRelationshipType?: string;
  elevatedRiskClusters?: number;
  possibleCoordinationClusters?: number;
};

export type ArenaEngineInput = {
  convictionScore?: number;
  insiderRiskScore?: number;
  holderQualityScore?: number;
  activityScore?: number;
  dominantBehaviorClass?: string;
  reliabilityScore?: number;
  profiledWallets?: number;
  clusterSignals?: ArenaClusterSignals;
};

export type ArenaResult = {
  verdict: ArenaVerdict;
  confidenceLabel: ArenaConfidenceLabel;
  explanation: string;
  agreementScore: number;
  disagreementScore: number;
  aiConfidenceScore: number;
  holderBehaviorScore: number;
  signals: string[];
};

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function optionalScore(value?: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? clampScore(value)
    : null;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function utcDateId(date: Date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0)
  );
}

function dailyCloseFor(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 0, 0)
  );
}

function weeklyCloseFor(date: Date) {
  const day = date.getUTCDay();
  const daysUntilSunday = (7 - day) % 7;
  const closeDate = addUtcDays(date, daysUntilSunday);
  return new Date(
    Date.UTC(
      closeDate.getUTCFullYear(),
      closeDate.getUTCMonth(),
      closeDate.getUTCDate(),
      23,
      59,
      0,
      0
    )
  );
}

function buildArenaWindow({
  closesAt,
  timeframe,
  now,
}: {
  closesAt: Date;
  timeframe: ArenaTimeframe;
  now: Date;
}): ArenaWindow {
  const opensAt =
    timeframe === "24H" ? startOfUtcDay(closesAt) : addUtcDays(startOfUtcDay(closesAt), -6);
  const resolvesAt =
    timeframe === "24H"
      ? new Date(
          Date.UTC(
            closesAt.getUTCFullYear(),
            closesAt.getUTCMonth(),
            closesAt.getUTCDate() + 1,
            23,
            30,
            0,
            0
          )
        )
      : new Date(
          Date.UTC(
            closesAt.getUTCFullYear(),
            closesAt.getUTCMonth(),
            closesAt.getUTCDate() + 7,
            23,
            30,
            0,
            0
          )
        );
  const suffix = timeframe === "24H" ? utcDateId(closesAt) : `week-${utcDateId(closesAt)}`;

  return {
    arenaWindowId: `${timeframe}:${suffix}`,
    timeframe,
    opensAt: opensAt.toISOString(),
    closesAt: closesAt.toISOString(),
    resolvesAt: resolvesAt.toISOString(),
    votingOpen: now.getTime() < closesAt.getTime(),
  };
}

export function getDailyArenaWindow(now = new Date()): ArenaWindow {
  const currentClose = dailyCloseFor(now);
  const closesAt =
    now.getTime() < currentClose.getTime() ? currentClose : dailyCloseFor(addUtcDays(now, 1));

  return buildArenaWindow({ closesAt, timeframe: "24H", now });
}

export function getWeeklyArenaWindow(now = new Date()): ArenaWindow {
  const currentClose = weeklyCloseFor(now);
  const closesAt =
    now.getTime() < currentClose.getTime() ? currentClose : weeklyCloseFor(addUtcDays(now, 7));

  return buildArenaWindow({ closesAt, timeframe: "7D", now });
}

export function getArenaProgress(window: ArenaWindow, now = new Date()): ArenaProgress {
  const opensAt = Date.parse(window.opensAt);
  const closesAt = Date.parse(window.closesAt);
  const current = now.getTime();
  const total = closesAt - opensAt;
  const elapsed = current - opensAt;

  return {
    progressPercent: total > 0 ? clampPercent((elapsed / total) * 100) : 100,
    votingOpen: current < closesAt,
  };
}

export function getTimeRemaining(window: ArenaWindow, now = new Date()): ArenaTimeRemaining {
  const remainingMs = Date.parse(window.closesAt) - now.getTime();

  if (remainingMs <= 0) {
    return { timeRemainingLabel: "Voting closed" };
  }

  const totalMinutes = Math.ceil(remainingMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return { timeRemainingLabel: `${days}d ${hours}h remaining` };
  }

  if (hours > 0) {
    return { timeRemainingLabel: `${hours}h ${minutes}m remaining` };
  }

  return { timeRemainingLabel: `${minutes}m remaining` };
}

export function deriveNovaArenaStance(
  input: NovaArenaStanceInput
): NovaArenaStanceResult {
  if (
    typeof input.convictionScore !== "number" ||
    !Number.isFinite(input.convictionScore)
  ) {
    return {
      stance: "Pending",
      reason: "Conviction score is unavailable.",
    };
  }

  const convictionScore = optionalScore(input.convictionScore) ?? 0;

  if (convictionScore <= 47) {
    return {
      stance: "Bearish",
      reason: "Bearish because the conviction score is below the bullish threshold.",
    };
  }

  if (convictionScore <= 57) {
    return {
      stance: "Accumulate",
      reason:
        "Accumulate because the conviction score is mixed and not yet strong enough for Bullish.",
    };
  }

  return {
    stance: "Bullish",
    reason: "Bullish because the conviction score is above the bullish threshold.",
  };
}

function hasAccumulationTone(behaviorClass?: string) {
  if (!behaviorClass) return false;
  const value = behaviorClass.toLowerCase();
  return (
    value.includes("active accumulator") ||
    value.includes("active whale") ||
    value.includes("high activity") ||
    value.includes("active holder")
  );
}

function hasFragmentedClusterTone(clusterSignals?: ArenaClusterSignals) {
  if (!clusterSignals) return false;
  const dominantRelationship =
    clusterSignals.dominantRelationshipType?.toLowerCase() || "";
  const total = clusterSignals.totalAnalyzedWallets || 0;
  const clustered = clusterSignals.clusteredWallets || 0;
  const isolated = clusterSignals.isolatedWallets || 0;
  const mixedNetwork = total > 0 && clustered > 0 && isolated > 0;

  return (
    dominantRelationship.includes("possible coordination") ||
    (mixedNetwork && (clusterSignals.averageClusterConfidence || 0) < 58) ||
    (clusterSignals.elevatedRiskClusters || 0) > 0 ||
    (clusterSignals.possibleCoordinationClusters || 0) > 0
  );
}

export function buildArenaInterpretation(input: ArenaEngineInput): ArenaResult {
  const conviction = optionalScore(input.convictionScore);
  const insiderRisk = optionalScore(input.insiderRiskScore);
  const holderQuality = optionalScore(input.holderQualityScore);
  const activity = optionalScore(input.activityScore);
  const reliability = optionalScore(input.reliabilityScore);

  const availableScores = [
    conviction,
    insiderRisk,
    holderQuality,
    activity,
  ].filter((score): score is number => score !== null);

  if (availableScores.length < 3) {
    return {
      verdict: "Insufficient behavioral agreement",
      confidenceLabel: "Low",
      explanation:
        "Arena comparison needs token intelligence and holder behavior signals before it can compare AI thesis confidence against observed holder patterns.",
      agreementScore: 0,
      disagreementScore: 0,
      aiConfidenceScore: 0,
      holderBehaviorScore: 0,
      signals: ["Waiting for token intelligence", "Waiting for holder behavior"],
    };
  }

  const normalizedConviction = conviction ?? average(availableScores);
  const normalizedRisk = insiderRisk ?? 50;
  const normalizedQuality = holderQuality ?? average(availableScores);
  const normalizedActivity = activity ?? average(availableScores);
  const normalizedReliability = reliability ?? average(availableScores);

  const clusterConfidence = clampScore(
    input.clusterSignals?.averageClusterConfidence ?? 50
  );
  const clusterStability = clampScore(
    100 -
      (input.clusterSignals?.elevatedRiskClusters || 0) * 12 -
      (input.clusterSignals?.possibleCoordinationClusters || 0) * 8
  );
  const profileCoverageScore = clampScore((input.profiledWallets || 0) * 12);

  const aiConfidenceScore = clampScore(
    average([normalizedConviction, normalizedQuality, normalizedReliability])
  );
  const holderBehaviorScore = clampScore(
    normalizedQuality * 0.34 +
      normalizedActivity * 0.26 +
      (100 - normalizedRisk) * 0.24 +
      clusterStability * 0.16
  );
  const clusterPenalty = hasFragmentedClusterTone(input.clusterSignals) ? 18 : 0;
  const riskPenalty = normalizedRisk > 70 ? 12 : normalizedRisk > 55 ? 6 : 0;
  const rawDisagreement =
    Math.abs(normalizedConviction - holderBehaviorScore) +
    clusterPenalty +
    riskPenalty;
  const disagreementScore = clampScore(rawDisagreement);
  const agreementScore = clampScore(100 - disagreementScore);

  const confidenceBase = average([
    normalizedReliability,
    clusterConfidence,
    profileCoverageScore,
  ]);
  const confidenceLabel: ArenaConfidenceLabel =
    confidenceBase >= 70 ? "High" : confidenceBase >= 45 ? "Medium" : "Low";

  const fragmented = hasFragmentedClusterTone(input.clusterSignals);
  const accumulationTone =
    hasAccumulationTone(input.dominantBehaviorClass) || normalizedActivity >= 62;

  let verdict: ArenaVerdict = "Insufficient behavioral agreement";
  if (fragmented && disagreementScore >= 34) {
    verdict = "Fragmented holder behavior";
  } else if (
    normalizedConviction < 52 &&
    accumulationTone &&
    holderBehaviorScore >= 58
  ) {
    verdict = "AI cautious while holders accumulate";
  } else if (
    normalizedConviction >= 64 &&
    (holderBehaviorScore < 54 || normalizedRisk >= 62)
  ) {
    verdict = "AI conviction exceeds holder confidence";
  } else if (agreementScore >= 62 && normalizedRisk < 65) {
    verdict = "AI aligned with holder behavior";
  }

  const signals = [
    `Conviction ${normalizedConviction}`,
    `Holder behavior ${holderBehaviorScore}`,
    `Insider risk ${normalizedRisk}`,
    `Agreement ${agreementScore}`,
  ];

  if (input.dominantBehaviorClass) {
    signals.push(`Dominant behavior: ${input.dominantBehaviorClass}`);
  }

  if (input.clusterSignals?.dominantRelationshipType) {
    signals.push(
      `Cluster signal: ${input.clusterSignals.dominantRelationshipType}`
    );
  }

  const explanationByVerdict: Record<ArenaVerdict, string> = {
    "AI aligned with holder behavior":
      "Token intelligence confidence is broadly aligned with holder quality, activity metadata and current cluster signals.",
    "AI cautious while holders accumulate":
      "The thesis remains conservative while holder activity and behavior metadata show accumulation-like participation.",
    "AI conviction exceeds holder confidence":
      "The thesis confidence is stronger than the observed holder behavior support, or risk signals are still elevated.",
    "Fragmented holder behavior":
      "Holder behavior appears mixed across activity, concentration and cluster signals, so the arena reads the market as behaviorally fragmented.",
    "Insufficient behavioral agreement":
      "Available holder behavior and token intelligence signals do not yet show enough agreement for a stronger interpretation.",
  };

  return {
    verdict,
    confidenceLabel,
    explanation: explanationByVerdict[verdict],
    agreementScore,
    disagreementScore,
    aiConfidenceScore,
    holderBehaviorScore,
    signals,
  };
}
