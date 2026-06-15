import type { RiskPressureResultV1 } from "@/lib/risk-pressure-engine";
import type { StructuralSafetyResultV1 } from "@/lib/structural-safety-engine";
import type { Top100HolderAlphaV3Result } from "@/lib/top100-holder-alpha-v3-engine";

export type NovaConvictionTierV1 =
  | "Very Weak Conviction"
  | "Weak Conviction"
  | "Mixed / Unclear Conviction"
  | "Moderate Conviction"
  | "Strong Conviction"
  | "Elite Conviction";

export type NovaConvictionQualityV1 =
  | "elite"
  | "strong"
  | "moderate"
  | "mixed"
  | "weak"
  | "very_weak";

export type NovaConvictionResultV1 = {
  version: "nova-conviction-v1-holder-structural-risk";
  novaConvictionScore: number;
  convictionTier: NovaConvictionTierV1;
  components: {
    holderAlphaComponent: number;
    structuralSafetyComponent: number;
    riskPressureScore: number;
    riskAdjustedComponent: number;
    dataConfidenceComponent: number;
  };
  weights: {
    holderAlpha: 0.5;
    structuralSafety: 0.25;
    riskAdjusted: 0.15;
    dataConfidence: 0.1;
  };
  confidence: {
    holderAlphaConfidence: number;
    structuralSafetyConfidence: number;
    riskPressureConfidence: number;
    combinedDataConfidence: number;
    confidenceTier: "high" | "medium" | "low";
  };
  moduleSummaries: {
    holderAlpha: {
      score: number;
      weightedWalletAlphaV3: number | null;
      simpleAverageWalletAlphaV3: number | null;
      holderCompositionScore: number | null;
      eliteWalletCount: number | null;
      strongWalletCount: number | null;
      goodWalletCount: number | null;
      averageWalletCount: number | null;
      weakWalletCount: number | null;
      toxicWalletCount: number | null;
      goodOrBetterOwnershipPercent: number | null;
      weakOrToxicOwnershipPercent: number | null;
      thesis: Top100HolderAlphaV3Result["holderCompositionThesis"] | null;
    };
    structuralSafety: {
      score: number;
      keyMetrics: StructuralSafetyResultV1["metrics"] | null;
      explanations: string[];
    };
    riskPressure: {
      score: number;
      structuralRiskScore: number | null;
      holderRiskScore: number | null;
      marketRiskScore: number | null;
      behavioralRiskScore: number | null;
      confidenceRiskScore: number | null;
      keyMetrics: RiskPressureResultV1["metrics"] | null;
      explanations: string[];
    };
  };
  thesis: {
    summary: string;
    quality: NovaConvictionQualityV1;
    phase: string;
    keyPoints: string[];
    risks: string[];
    positives: string[];
  };
  explanations: string[];
  warnings: string[];
};

export type NovaConvictionInputV1 = {
  holderAlpha?: Top100HolderAlphaV3Result | null;
  structuralSafety?: StructuralSafetyResultV1 | null;
  riskPressure?: RiskPressureResultV1 | null;
  warnings?: string[];
};

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function convictionTier(score: number): NovaConvictionTierV1 {
  if (score >= 85) return "Elite Conviction";
  if (score >= 70) return "Strong Conviction";
  if (score >= 55) return "Moderate Conviction";
  if (score >= 40) return "Mixed / Unclear Conviction";
  if (score >= 25) return "Weak Conviction";
  return "Very Weak Conviction";
}

function thesisQuality(score: number): NovaConvictionQualityV1 {
  if (score >= 85) return "elite";
  if (score >= 70) return "strong";
  if (score >= 55) return "moderate";
  if (score >= 40) return "mixed";
  if (score >= 25) return "weak";
  return "very_weak";
}

function confidenceTier(score: number) {
  if (score >= 75) return "high";
  if (score >= 55) return "medium";
  return "low";
}

function holderAlphaConfidence(holderAlpha: Top100HolderAlphaV3Result | null) {
  if (!holderAlpha) return 35;
  return holderAlpha.confidenceScore;
}

function structuralSafetyConfidence(structuralSafety: StructuralSafetyResultV1 | null) {
  if (!structuralSafety) return 35;
  const hasCoreMetrics =
    structuralSafety.metrics.top1Ownership !== null &&
    structuralSafety.metrics.averageWalletAlpha !== null &&
    structuralSafety.metrics.weightedWalletAlpha !== null;
  return hasCoreMetrics ? 70 : 50;
}

function riskPressureConfidence(riskPressure: RiskPressureResultV1 | null) {
  if (!riskPressure) return 35;
  return clampScore(100 - riskPressure.confidenceRiskScore);
}

function phase({
  holderAlpha,
  structuralSafety,
  riskPressure,
}: {
  holderAlpha: number;
  structuralSafety: number;
  riskPressure: number;
}) {
  if (holderAlpha < 45 && riskPressure > 45) return "post-hype / distribution risk";
  if (holderAlpha < 45 && riskPressure <= 45) return "weak holder conviction / possible accumulation";
  if (holderAlpha >= 65 && structuralSafety >= 65 && riskPressure <= 35) return "high-conviction accumulation";
  if (holderAlpha >= 55 && riskPressure <= 45) return "healthy accumulation / constructive holder base";
  return "mixed structure";
}

function buildThesis({
  score,
  holderAlpha,
  structuralSafety,
  riskPressure,
  confidence,
}: {
  score: number;
  holderAlpha: Top100HolderAlphaV3Result | null;
  structuralSafety: StructuralSafetyResultV1 | null;
  riskPressure: RiskPressureResultV1 | null;
  confidence: number;
}) {
  const holderScore = holderAlpha?.holderAlphaV3Score ?? 50;
  const structuralScore = structuralSafety?.structuralSafetyScore ?? 50;
  const riskScore = riskPressure?.riskPressureScore ?? 50;
  const keyPoints: string[] = [];
  const risks: string[] = [];
  const positives: string[] = [];

  if (holderScore < 45) {
    keyPoints.push("Top holder quality is weak; good-or-better wallets do not dominate analyzed ownership.");
    risks.push("Weak holder quality limits conviction.");
  } else if (holderScore >= 65) {
    keyPoints.push("Holder base contains meaningful high-quality wallets.");
    positives.push("Holder Alpha supports conviction.");
  } else if (holderScore >= 55) {
    keyPoints.push("Holder base quality is constructive but not dominant.");
  } else {
    keyPoints.push("Holder base quality is mixed.");
  }

  if (riskScore >= 46) {
    keyPoints.push("Risk pressure is elevated and may reduce conviction despite holder quality.");
    risks.push("Risk Pressure remains elevated.");
  } else {
    keyPoints.push("Risk pressure is contained, supporting cleaner conviction.");
    positives.push("Risk Pressure is contained.");
  }

  if (structuralScore < 60) {
    keyPoints.push("Structural safety is mixed or weak, limiting confidence.");
    risks.push("Structural Safety does not fully support conviction.");
  } else if (structuralScore >= 75) {
    positives.push("Structural Safety appears healthy.");
  }

  if (confidence < 55) {
    keyPoints.push("Data confidence is limited; treat the score as directional.");
    risks.push("Data confidence is low.");
  } else if (confidence >= 75) {
    keyPoints.push("Data coverage is strong enough to support the current read.");
    positives.push("Data confidence is high.");
  }

  return {
    summary: `${convictionTier(score)}: ${phase({
      holderAlpha: holderScore,
      structuralSafety: structuralScore,
      riskPressure: riskScore,
    })}.`,
    quality: thesisQuality(score),
    phase: phase({
      holderAlpha: holderScore,
      structuralSafety: structuralScore,
      riskPressure: riskScore,
    }),
    keyPoints,
    risks,
    positives,
  };
}

function explanations({
  holderAlpha,
  structuralSafety,
  riskPressure,
  riskAdjusted,
  confidence,
  score,
}: {
  holderAlpha: number;
  structuralSafety: number;
  riskPressure: number;
  riskAdjusted: number;
  confidence: number;
  score: number;
}) {
  return [
    `Nova Conviction V1 is ${score}/100 from holder quality, structural safety, inverted risk pressure, and data confidence.`,
    `Holder Alpha contributes ${holderAlpha}/100 with a 50% weight.`,
    `Structural Safety contributes ${structuralSafety}/100 with a 25% weight.`,
    `Risk Pressure is ${riskPressure}/100, so the risk-adjusted component is ${riskAdjusted}/100 with a 15% weight.`,
    `Data Confidence contributes ${confidence}/100 with a 10% weight.`,
    "Behavioral Conviction is intentionally excluded from Nova Conviction V1.",
  ];
}

export function computeNovaConvictionV1(input: NovaConvictionInputV1): NovaConvictionResultV1 {
  const warnings = [...(input.warnings ?? [])];
  const holderAlpha = input.holderAlpha ?? null;
  const structuralSafety = input.structuralSafety ?? null;
  const riskPressure = input.riskPressure ?? null;

  if (!holderAlpha) warnings.push("Top100 Holder Alpha V3.2 failed; neutral holder alpha fallback used.");
  if (!structuralSafety) warnings.push("Structural Safety failed; neutral structural safety fallback used.");
  if (!riskPressure) warnings.push("Risk Pressure failed; neutral risk-pressure fallback used.");

  warnings.push("Behavioral Conviction is not included in Nova Conviction V1.");
  warnings.push("Smart Money ownership/flow is not included in Nova Conviction V1 unless explicitly returned by child modules.");

  const holderAlphaComponent = holderAlpha?.holderAlphaV3Score ?? 50;
  const structuralSafetyComponent = structuralSafety?.structuralSafetyScore ?? 50;
  const riskPressureScore = riskPressure?.riskPressureScore ?? 50;
  const riskAdjustedComponent = clampScore(100 - riskPressureScore);
  const holderAlphaConfidence = holderAlphaConfidenceValue(holderAlpha);
  const structuralConfidence = structuralSafetyConfidence(structuralSafety);
  const riskConfidence = riskPressureConfidence(riskPressure);
  const combinedDataConfidence = clampScore(
    holderAlphaConfidence * 0.5 + structuralConfidence * 0.25 + riskConfidence * 0.25
  );
  const novaConvictionScore = clampScore(
    holderAlphaComponent * 0.5 +
      structuralSafetyComponent * 0.25 +
      riskAdjustedComponent * 0.15 +
      combinedDataConfidence * 0.1
  );

  return {
    version: "nova-conviction-v1-holder-structural-risk",
    novaConvictionScore,
    convictionTier: convictionTier(novaConvictionScore),
    components: {
      holderAlphaComponent,
      structuralSafetyComponent,
      riskPressureScore,
      riskAdjustedComponent,
      dataConfidenceComponent: combinedDataConfidence,
    },
    weights: {
      holderAlpha: 0.5,
      structuralSafety: 0.25,
      riskAdjusted: 0.15,
      dataConfidence: 0.1,
    },
    confidence: {
      holderAlphaConfidence,
      structuralSafetyConfidence: structuralConfidence,
      riskPressureConfidence: riskConfidence,
      combinedDataConfidence,
      confidenceTier: confidenceTier(combinedDataConfidence),
    },
    moduleSummaries: {
      holderAlpha: {
        score: holderAlphaComponent,
        weightedWalletAlphaV3: holderAlpha?.weightedWalletAlphaV3 ?? null,
        simpleAverageWalletAlphaV3: holderAlpha?.simpleAverageWalletAlphaV3 ?? null,
        holderCompositionScore: holderAlpha?.holderCompositionScore ?? null,
        eliteWalletCount: holderAlpha?.eliteWalletCount ?? null,
        strongWalletCount: holderAlpha?.strongWalletCount ?? null,
        goodWalletCount: holderAlpha?.goodWalletCount ?? null,
        averageWalletCount: holderAlpha?.averageWalletCount ?? null,
        weakWalletCount: holderAlpha?.weakWalletCount ?? null,
        toxicWalletCount: holderAlpha?.toxicWalletCount ?? null,
        goodOrBetterOwnershipPercent: holderAlpha?.goodOrBetterOwnershipPercent ?? null,
        weakOrToxicOwnershipPercent: holderAlpha?.weakOrToxicOwnershipPercent ?? null,
        thesis: holderAlpha?.holderCompositionThesis ?? null,
      },
      structuralSafety: {
        score: structuralSafetyComponent,
        keyMetrics: structuralSafety?.metrics ?? null,
        explanations: structuralSafety?.explanations ?? [],
      },
      riskPressure: {
        score: riskPressureScore,
        structuralRiskScore: riskPressure?.structuralRiskScore ?? null,
        holderRiskScore: riskPressure?.holderRiskScore ?? null,
        marketRiskScore: riskPressure?.marketRiskScore ?? null,
        behavioralRiskScore: riskPressure?.behavioralRiskScore ?? null,
        confidenceRiskScore: riskPressure?.confidenceRiskScore ?? null,
        keyMetrics: riskPressure?.metrics ?? null,
        explanations: riskPressure?.explanations ?? [],
      },
    },
    thesis: buildThesis({
      score: novaConvictionScore,
      holderAlpha,
      structuralSafety,
      riskPressure,
      confidence: combinedDataConfidence,
    }),
    explanations: explanations({
      holderAlpha: holderAlphaComponent,
      structuralSafety: structuralSafetyComponent,
      riskPressure: riskPressureScore,
      riskAdjusted: riskAdjustedComponent,
      confidence: combinedDataConfidence,
      score: novaConvictionScore,
    }),
    warnings: Array.from(new Set(warnings)),
  };
}

function holderAlphaConfidenceValue(holderAlpha: Top100HolderAlphaV3Result | null) {
  return holderAlphaConfidence(holderAlpha);
}
