import { createHash } from "crypto";
import { NextResponse } from "next/server";

type DecisionSnapshotInput = {
  chain?: string;
  tokenAddress?: string;
  tokenSymbol?: string;
  convictionScore?: number;
  insiderRiskScore?: number;
  holderQualityScore?: number;
  activityScore?: number;
  thesisHeadline?: string;
};

type ApiErrorCode =
  | "INVALID_JSON"
  | "MISSING_CHAIN"
  | "MISSING_TOKEN_ADDRESS"
  | "INVALID_TOKEN_ADDRESS"
  | "INVALID_SCORE";

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

function normalizeScore(value: unknown) {
  const score = Number(value);
  if (!Number.isFinite(score) || score < 0 || score > 100) return null;
  return Math.round(score);
}

function buildSnapshot(input: Required<DecisionSnapshotInput>) {
  const createdAt = new Date().toISOString();
  const snapshotCore = {
    chain: input.chain.toLowerCase(),
    tokenAddress: input.tokenAddress.toLowerCase(),
    tokenSymbol: input.tokenSymbol,
    scores: {
      convictionScore: input.convictionScore,
      insiderRiskScore: input.insiderRiskScore,
      holderQualityScore: input.holderQualityScore,
      activityScore: input.activityScore,
    },
    thesisHeadline: input.thesisHeadline,
  };
  const snapshotHash = createHash("sha256")
    .update(JSON.stringify(snapshotCore))
    .digest("hex");

  return {
    snapshotId: `local_${snapshotHash.slice(0, 16)}`,
    snapshotHash,
    status: "local_preview" as const,
    verificationStatus: "not_onchain_yet" as const,
    chain: snapshotCore.chain,
    tokenAddress: snapshotCore.tokenAddress,
    tokenSymbol: snapshotCore.tokenSymbol || null,
    scores: snapshotCore.scores,
    thesisHeadline: snapshotCore.thesisHeadline || null,
    createdAt,
    mantleVerification: {
      targetNetwork: "Mantle" as const,
      planned: true,
      contractStatus: "not_deployed_yet" as const,
      note:
        "This is a deterministic local preview hash. It has not been submitted on-chain; Mantle verification is planned for a future contract layer.",
    },
  };
}

export async function POST(request: Request) {
  let input: DecisionSnapshotInput;

  try {
    input = await request.json();
  } catch {
    return structuredError({
      code: "INVALID_JSON",
      message: "Request body must be valid JSON.",
      status: 400,
    });
  }

  const chain = input.chain?.trim();
  const tokenAddress = input.tokenAddress?.trim();

  if (!chain) {
    return structuredError({
      code: "MISSING_CHAIN",
      message: "Missing chain.",
      status: 400,
    });
  }

  if (!tokenAddress) {
    return structuredError({
      code: "MISSING_TOKEN_ADDRESS",
      message: "Missing tokenAddress.",
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

  const convictionScore = normalizeScore(input.convictionScore);
  const insiderRiskScore = normalizeScore(input.insiderRiskScore);
  const holderQualityScore = normalizeScore(input.holderQualityScore);
  const activityScore = normalizeScore(input.activityScore);

  if (
    convictionScore === null ||
    insiderRiskScore === null ||
    holderQualityScore === null ||
    activityScore === null
  ) {
    return structuredError({
      code: "INVALID_SCORE",
      message: "All scores must be numbers between 0 and 100.",
      details: {
        convictionScore: input.convictionScore,
        insiderRiskScore: input.insiderRiskScore,
        holderQualityScore: input.holderQualityScore,
        activityScore: input.activityScore,
      },
      status: 400,
    });
  }

  return NextResponse.json(
    buildSnapshot({
      chain,
      tokenAddress,
      tokenSymbol: input.tokenSymbol?.trim() || "",
      convictionScore,
      insiderRiskScore,
      holderQualityScore,
      activityScore,
      thesisHeadline: input.thesisHeadline?.trim() || "",
    })
  );
}
