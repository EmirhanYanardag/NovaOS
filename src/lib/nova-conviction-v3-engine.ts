import type { GmgnRiskStats } from "@/lib/gmgn-risk-stats";
import type { RiskPressureResultV1 } from "@/lib/risk-pressure-engine";
import type { SmartMoneyFlowResultV1 } from "@/lib/smart-money-flow-engine";
import type { StructuralSafetyResultV1 } from "@/lib/structural-safety-engine";
import type { Top100HolderAlphaV3Result } from "@/lib/top100-holder-alpha-v3-engine";

export type NovaConvictionV3Tier = "elite" | "strong" | "good" | "mixed" | "weak" | "toxic";
export type NovaConvictionV3RiskTier = "low" | "moderate" | "elevated" | "high" | "extreme";

export type NovaConvictionV3Input = {
  holderAlpha: Top100HolderAlphaV3Result | null;
  smartMoneyFlow?: SmartMoneyFlowResultV1 | null;
  structuralSafety?: StructuralSafetyResultV1 | null;
  riskPressure?: RiskPressureResultV1 | null;
  riskStats?: GmgnRiskStats | null;
  warnings?: string[];
};

export type NovaConvictionV3Result = {
  version: "nova-conviction-v3";
  novaConvictionScore: number;
  convictionTier: NovaConvictionV3Tier;
  scores: {
    holderAlpha: number;
    smartMoneyFlow: number | null;
    structuralSafety: number | null;
    riskPressure: number | null;
    liquidityHealth: number | null;
    dataConfidence: number;
  };
  risk: {
    riskScore: number;
    riskTier: NovaConvictionV3RiskTier;
    riskDrivers: string[];
  };
  thesis: {
    summary: string;
    bullishPoints: string[];
    bearishPoints: string[];
    neutralPoints: string[];
    finalInterpretation: string;
  };
  scoreBreakdown: {
    novaConviction: {
      rawConviction: number;
      confidenceModifier: number;
      finalScore: number;
      weightsUsed: Record<string, number>;
      components: Record<string, number | null>;
    };
    riskScore: {
      finalRiskScore: number;
      weightsUsed: Record<string, number>;
      components: Record<string, number>;
    };
    dataConfidence: {
      finalDataConfidence: number;
      components: Record<string, number | null>;
    };
  };
  warnings: string[];
};

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

function convictionTier(score: number): NovaConvictionV3Tier {
  if (score >= 85) return "elite";
  if (score >= 70) return "strong";
  if (score >= 58) return "good";
  if (score >= 45) return "mixed";
  if (score >= 25) return "weak";
  return "toxic";
}

function riskTier(score: number): NovaConvictionV3RiskTier {
  if (score <= 20) return "low";
  if (score <= 40) return "moderate";
  if (score <= 60) return "elevated";
  if (score <= 80) return "high";
  return "extreme";
}

function confidenceModifier(dataConfidence: number) {
  if (dataConfidence >= 75) return 1;
  if (dataConfidence >= 60) return 0.97;
  if (dataConfidence >= 45) return 0.93;
  return 0.88;
}

function liquidityHealth(riskStats: GmgnRiskStats | null) {
  const liquidityUsd = riskStats?.liquidityUsd;
  if (typeof liquidityUsd !== "number" || !Number.isFinite(liquidityUsd)) return null;
  if (liquidityUsd >= 1_000_000) return 90;
  if (liquidityUsd >= 500_000) return 75;
  if (liquidityUsd >= 200_000) return 60;
  if (liquidityUsd >= 50_000) return 35;
  return 15;
}

function convictionWeights({
  smartMoneyAvailable,
  structuralAvailable,
}: {
  smartMoneyAvailable: boolean;
  structuralAvailable: boolean;
}) {
  const weights = {
    holderAlpha: 0.38,
    smartMoneyFlow: smartMoneyAvailable ? 0.22 : 0,
    structuralSafety: structuralAvailable ? 0.18 : 0,
    riskPressureInverted: 0.14,
    liquidityHealth: 0.08,
  };

  if (!smartMoneyAvailable) {
    weights.holderAlpha += 0.14;
    weights.structuralSafety += structuralAvailable ? 0.08 : 0;
    if (!structuralAvailable) weights.holderAlpha += 0.08;
  }

  if (!structuralAvailable) {
    weights.holderAlpha += 0.1;
    weights.riskPressureInverted += 0.08;
  }

  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  return Object.fromEntries(
    Object.entries(weights).map(([key, value]) => [key, round(value / total)])
  ) as typeof weights;
}

function smartMoneyConfidence(flow: SmartMoneyFlowResultV1 | null) {
  if (!flow) return null;
  if (flow.matchedTradeCount >= 10 && flow.uniqueSmartWallets >= 3) return 70;
  if (flow.matchedTradeCount > 0) return 50;
  return 35;
}

function structuralConfidence(structuralSafety: StructuralSafetyResultV1 | null) {
  if (!structuralSafety) return null;
  return structuralSafety.metrics.averageWalletAlpha !== null &&
    structuralSafety.metrics.weightedWalletAlpha !== null
    ? 70
    : 50;
}

function dataConfidence({
  holderAlpha,
  smartMoneyFlow,
  structuralSafety,
}: {
  holderAlpha: Top100HolderAlphaV3Result | null;
  smartMoneyFlow: SmartMoneyFlowResultV1 | null;
  structuralSafety: StructuralSafetyResultV1 | null;
}) {
  const holderConfidence = holderAlpha?.confidenceScore ?? 35;
  const holderCoverage = holderAlpha?.holderSetCoverageScore ?? 35;
  const smartConfidence = smartMoneyConfidence(smartMoneyFlow);
  const structuralRiskConfidence = structuralConfidence(structuralSafety);
  const weights = {
    holderAlphaConfidence: 0.5,
    holderSetCoverageScore: 0.2,
    smartMoneyConfidence: smartConfidence === null ? 0 : 0.15,
    structuralRiskConfidence: structuralRiskConfidence === null ? 0 : 0.15,
  };

  if (smartConfidence === null) weights.holderAlphaConfidence += 0.15;
  if (structuralRiskConfidence === null) weights.holderAlphaConfidence += 0.15;

  const finalDataConfidence = clampScore(
    holderConfidence * weights.holderAlphaConfidence +
      holderCoverage * weights.holderSetCoverageScore +
      (smartConfidence ?? 0) * weights.smartMoneyConfidence +
      (structuralRiskConfidence ?? 0) * weights.structuralRiskConfidence
  );

  return {
    finalDataConfidence,
    components: {
      holderAlphaConfidence: holderConfidence,
      holderSetCoverageScore: holderCoverage,
      smartMoneyConfidence: smartConfidence,
      structuralRiskConfidence,
    },
  };
}

function computeRiskScore({
  holderAlpha,
  structuralSafety,
  riskPressure,
  dataConfidenceScore,
}: {
  holderAlpha: Top100HolderAlphaV3Result | null;
  structuralSafety: StructuralSafetyResultV1 | null;
  riskPressure: RiskPressureResultV1 | null;
  dataConfidenceScore: number;
}) {
  const riskPressureScore = riskPressure?.riskPressureScore ?? 50;
  const structuralRisk = structuralSafety ? 100 - structuralSafety.structuralSafetyScore : 50;
  const weakOrToxicOwnership = holderAlpha?.weakOrToxicOwnershipPercent ?? 0;
  const goodOrBetterOwnership = holderAlpha?.goodOrBetterOwnershipPercent ?? 0;
  const weakHolderOwnershipPressure = clampScore(
    (weakOrToxicOwnership - goodOrBetterOwnership) * 2
  );
  const suspiciousLabelPressure = clampScore(
    (holderAlpha?.suspiciousLikeOwnershipPercent ?? 0) * 8 +
      (holderAlpha?.bundlerLikeOwnershipPercent ?? 0) * 5 +
      (holderAlpha?.freshLikeOwnershipPercent ?? 0) * 3
  );
  const dataUncertaintyRisk = clampScore(100 - dataConfidenceScore);
  const finalRiskScore = clampScore(
    riskPressureScore * 0.35 +
      structuralRisk * 0.25 +
      weakHolderOwnershipPressure * 0.2 +
      suspiciousLabelPressure * 0.1 +
      dataUncertaintyRisk * 0.1
  );

  return {
    finalRiskScore,
    components: {
      riskPressure: riskPressureScore,
      structuralRisk,
      weakHolderOwnershipPressure,
      suspiciousLabelPressure,
      dataUncertaintyRisk,
    },
  };
}

function buildRiskDrivers({
  riskScore,
  holderAlpha,
  riskPressure,
  structuralSafety,
}: {
  riskScore: number;
  holderAlpha: Top100HolderAlphaV3Result | null;
  riskPressure: RiskPressureResultV1 | null;
  structuralSafety: StructuralSafetyResultV1 | null;
}) {
  const drivers: string[] = [];

  if ((riskPressure?.riskPressureScore ?? 50) > 60) drivers.push("Risk Pressure is elevated.");
  if ((holderAlpha?.weakOrToxicOwnershipPercent ?? 0) > (holderAlpha?.goodOrBetterOwnershipPercent ?? 0)) {
    drivers.push("Weak/toxic ownership exceeds good-or-better ownership.");
  }
  if ((holderAlpha?.bundlerLikeOwnershipPercent ?? 0) > 2) drivers.push("Bundler-like ownership pressure is elevated.");
  if ((holderAlpha?.suspiciousLikeOwnershipPercent ?? 0) > 1) drivers.push("Suspicious-like holder labels are visible.");
  if ((holderAlpha?.freshLikeOwnershipPercent ?? 0) > 3) drivers.push("Fresh wallet ownership is notable.");
  if ((structuralSafety?.structuralSafetyScore ?? 50) < 45) drivers.push("Structural Safety is weak or mixed.");
  if (riskScore < 35) drivers.push("Risk pressure is relatively controlled.");

  return drivers;
}

function thesis({
  score,
  riskScore,
  holderAlpha,
  smartMoneyFlow,
  structuralSafety,
}: {
  score: number;
  riskScore: number;
  holderAlpha: Top100HolderAlphaV3Result | null;
  smartMoneyFlow: SmartMoneyFlowResultV1 | null;
  structuralSafety: StructuralSafetyResultV1 | null;
}) {
  const holderScore = holderAlpha?.holderAlphaV3Score ?? 50;
  const bullishPoints: string[] = [];
  const bearishPoints: string[] = [];
  const neutralPoints: string[] = [];

  if (holderScore < 45) {
    bearishPoints.push("Holder quality is weak; weak/toxic holders may dominate analyzed ownership.");
  } else if (holderScore <= 57) {
    neutralPoints.push("Holder base is mixed; no clear elite accumulation signal is visible.");
  } else if (holderScore <= 69) {
    bullishPoints.push("Holder quality is good; several strong wallets may support the token.");
  } else {
    bullishPoints.push("Holder base is strong; high-quality wallets appear meaningful in analyzed ownership.");
  }

  if ((holderAlpha?.goodOrBetterOwnershipPercent ?? 0) < 5 && (holderAlpha?.weakOrToxicOwnershipPercent ?? 0) > 25) {
    bearishPoints.push("Good-or-better ownership is too small compared to weak/toxic ownership.");
  }

  if ((holderAlpha?.smartLikeOwnershipPercent ?? 0) > 2) bullishPoints.push("Smart-like ownership is visible.");
  if ((holderAlpha?.bundlerLikeOwnershipPercent ?? 0) > 2) bearishPoints.push("Bundler-like ownership pressure is elevated.");
  if ((holderAlpha?.freshLikeOwnershipPercent ?? 0) > 3) {
    neutralPoints.push("Fresh wallet ownership is notable and should be monitored.");
  }
  if (riskScore > 60) bearishPoints.push("Risk pressure is elevated.");
  if (riskScore < 35) bullishPoints.push("Risk pressure is relatively controlled.");
  if (smartMoneyFlow && smartMoneyFlow.smartMoneyFlowScore >= 60) {
    bullishPoints.push("Recent smart money flow is constructive in the GMGN feed window.");
  } else if (smartMoneyFlow && smartMoneyFlow.smartMoneyFlowScore < 45) {
    bearishPoints.push("Recent smart money flow is weak or distribution-heavy in the GMGN feed window.");
  }
  if (structuralSafety && structuralSafety.structuralSafetyScore < 45) {
    bearishPoints.push("Structural Safety is mixed or weak.");
  }

  const tier = convictionTier(score);
  return {
    summary: `Nova Conviction V3 is ${score}/100 (${tier}).`,
    bullishPoints,
    bearishPoints,
    neutralPoints,
    finalInterpretation:
      tier === "elite" || tier === "strong"
        ? "Current evidence is consistent with a constructive holder-quality setup, while remaining risks should still be monitored."
        : tier === "good"
          ? "Current evidence suggests a useful but not decisive conviction setup."
          : tier === "mixed"
            ? "Current evidence is mixed; the token needs cleaner holder quality, structure, or risk data before conviction is strong."
            : "Current evidence suggests weak token-level conviction from the available NovaOS data layers.",
  };
}

export function computeNovaConvictionV3(input: NovaConvictionV3Input): NovaConvictionV3Result {
  const warnings = [...(input.warnings ?? [])];
  const holderAlpha = input.holderAlpha;
  const smartMoneyFlow = input.smartMoneyFlow ?? null;
  const structuralSafety = input.structuralSafety ?? null;
  const riskPressure = input.riskPressure ?? null;
  const liquidity = liquidityHealth(input.riskStats ?? null);

  if (!holderAlpha) warnings.push("Top100 Holder Alpha V3.2 unavailable; neutral holder fallback used.");
  if (!smartMoneyFlow) warnings.push("Smart Money Flow unavailable; its Conviction weight was redistributed.");
  if (!structuralSafety) warnings.push("Structural Safety unavailable; its Conviction weight was redistributed.");
  if (!riskPressure) warnings.push("Risk Pressure unavailable; neutral 50 fallback used.");
  if (liquidity === null) warnings.push("Liquidity Health unavailable; neutral 50 fallback used.");

  const holderAlphaScore = holderAlpha?.holderAlphaV3Score ?? 50;
  const smartMoneyScore = smartMoneyFlow?.smartMoneyFlowScore ?? null;
  const structuralScore = structuralSafety?.structuralSafetyScore ?? null;
  const riskPressureScore = riskPressure?.riskPressureScore ?? null;
  const riskPressureInverted = clampScore(100 - (riskPressureScore ?? 50));
  const liquidityScore = liquidity ?? 50;
  const dataConfidenceResult = dataConfidence({
    holderAlpha,
    smartMoneyFlow,
    structuralSafety,
  });
  const weights = convictionWeights({
    smartMoneyAvailable: smartMoneyScore !== null,
    structuralAvailable: structuralScore !== null,
  });
  const rawConviction =
    holderAlphaScore * weights.holderAlpha +
    (smartMoneyScore ?? 0) * weights.smartMoneyFlow +
    (structuralScore ?? 0) * weights.structuralSafety +
    riskPressureInverted * weights.riskPressureInverted +
    liquidityScore * weights.liquidityHealth;
  const modifier = confidenceModifier(dataConfidenceResult.finalDataConfidence);
  let finalScore = clampScore(rawConviction * modifier);

  if (dataConfidenceResult.finalDataConfidence < 45 && rawConviction > 70) {
    finalScore = Math.min(finalScore, 68);
    warnings.push("High conviction capped because data confidence is low.");
  }

  const risk = computeRiskScore({
    holderAlpha,
    structuralSafety,
    riskPressure,
    dataConfidenceScore: dataConfidenceResult.finalDataConfidence,
  });

  return {
    version: "nova-conviction-v3",
    novaConvictionScore: finalScore,
    convictionTier: convictionTier(finalScore),
    scores: {
      holderAlpha: holderAlphaScore,
      smartMoneyFlow: smartMoneyScore,
      structuralSafety: structuralScore,
      riskPressure: riskPressureScore,
      liquidityHealth: liquidity,
      dataConfidence: dataConfidenceResult.finalDataConfidence,
    },
    risk: {
      riskScore: risk.finalRiskScore,
      riskTier: riskTier(risk.finalRiskScore),
      riskDrivers: buildRiskDrivers({
        riskScore: risk.finalRiskScore,
        holderAlpha,
        riskPressure,
        structuralSafety,
      }),
    },
    thesis: thesis({
      score: finalScore,
      riskScore: risk.finalRiskScore,
      holderAlpha,
      smartMoneyFlow,
      structuralSafety,
    }),
    scoreBreakdown: {
      novaConviction: {
        rawConviction: round(rawConviction),
        confidenceModifier: modifier,
        finalScore,
        weightsUsed: weights,
        components: {
          holderAlpha: holderAlphaScore,
          smartMoneyFlow: smartMoneyScore,
          structuralSafety: structuralScore,
          riskPressureInverted,
          liquidityHealth: liquidity,
        },
      },
      riskScore: {
        finalRiskScore: risk.finalRiskScore,
        weightsUsed: {
          riskPressure: 0.35,
          structuralRisk: 0.25,
          weakHolderOwnershipPressure: 0.2,
          suspiciousLabelPressure: 0.1,
          dataUncertaintyRisk: 0.1,
        },
        components: risk.components,
      },
      dataConfidence: {
        finalDataConfidence: dataConfidenceResult.finalDataConfidence,
        components: dataConfidenceResult.components,
      },
    },
    warnings: Array.from(new Set(warnings)),
  };
}
