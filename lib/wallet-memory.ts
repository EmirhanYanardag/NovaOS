export type MemoryConfidenceLabel = "High" | "Medium" | "Low";

export type MemoryTransferDirection =
  | "buy"
  | "sell"
  | "transfer_in"
  | "transfer_out";

export type RawWalletMemoryTransfer = {
  transaction_hash?: string;
  tx_hash?: string;
  block_timestamp?: string;
  token_address?: string;
  address?: string;
  token_symbol?: string;
  symbol?: string;
  from_address?: string;
  to_address?: string;
  from_wallet?: string;
  to_wallet?: string;
  value?: string;
  value_decimal?: string;
  value_formatted?: string;
  amount?: string;
  usd_value?: number | string;
  value_usd?: number | string;
  direction?: string;
  transaction_type?: string;
  category?: string;
};

export type WalletMemoryTransfer = {
  timestamp: string | null;
  tokenAddress: string | null;
  tokenSymbol: string | null;
  direction: MemoryTransferDirection;
  valueUsd: number | null;
  amount: string | null;
  counterparty: string | null;
  txHash: string | null;
};

export type WalletMemorySnapshot = {
  walletAddress: string;
  chain: string;
  walletFingerprint: string;
  observedAt: string;
  interactedTokenAddresses: string[];
  repeatedTokenCount: number;
  activeDaysEstimate: number;
  transactionCount: number;
  consistencyScore: number;
  convictionBehaviorScore: number;
  rotationScore: number;
  narrativeExposure: {
    score: number;
    tokenDiversity: number;
    label: "Focused" | "Mixed" | "Broad";
  };
  repeatedBehaviorFlags: string[];
};

export type WalletMemoryResult = WalletMemorySnapshot & {
  repeatedWalletSeen: boolean;
  recurringClusterAppearance: {
    detected: boolean;
    score: number;
    explanation: string;
  };
  speculativeBehaviorScore: number;
  memorySummary: string;
  confidenceLabel: MemoryConfidenceLabel;
  warnings: string[];
};

const memorySnapshots = new Map<string, WalletMemorySnapshot[]>();

export function isEvmAddress(address: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function mapChain(chain: string) {
  const key = chain.toLowerCase();

  if (key === "ethereum" || key === "eth") return "eth";
  if (key === "base") return "base";
  if (key === "bsc" || key === "bnb") return "bsc";
  if (key === "mantle") return "0x1388";
  if (key === "polygon") return "polygon";
  if (key === "arbitrum") return "arbitrum";
  if (key === "optimism") return "optimism";

  return key;
}

export function normalizeWalletMemoryTransfer({
  transfer,
  walletAddress,
}: {
  transfer: RawWalletMemoryTransfer;
  walletAddress: string;
}): WalletMemoryTransfer {
  const direction = classifyDirection({ transfer, walletAddress });
  const wallet = walletAddress.toLowerCase();
  const from = transfer.from_address || transfer.from_wallet || null;
  const to = transfer.to_address || transfer.to_wallet || null;
  const counterparty =
    to?.toLowerCase() === wallet
      ? from
      : from?.toLowerCase() === wallet
      ? to
      : to || from;

  return {
    timestamp: parseTimestamp(transfer.block_timestamp),
    tokenAddress: transfer.token_address || transfer.address || null,
    tokenSymbol: transfer.token_symbol || transfer.symbol || null,
    direction,
    valueUsd: parseNumber(transfer.usd_value ?? transfer.value_usd),
    amount:
      transfer.value_decimal ||
      transfer.value_formatted ||
      transfer.amount ||
      transfer.value ||
      null,
    counterparty,
    txHash: transfer.transaction_hash || transfer.tx_hash || null,
  };
}

export function analyzeWalletMemory({
  chain,
  walletAddress,
  transfers,
}: {
  chain: string;
  walletAddress: string;
  transfers: WalletMemoryTransfer[];
}): WalletMemoryResult {
  const normalizedChain = mapChain(chain);
  const previousSnapshots = getWalletMemoryHistory(walletAddress, normalizedChain);
  const interactedTokenAddresses = uniqueTokens(transfers);
  const repeatedTokenCount = countRepeatedTokens(transfers);
  const activeDaysEstimate = activeDayCount(transfers);
  const transactionCount = transfers.length;
  const tokenDiversity = interactedTokenAddresses.length;
  const inboundCount = transfers.filter(
    (transfer) =>
      transfer.direction === "buy" || transfer.direction === "transfer_in"
  ).length;
  const outboundCount = transfers.filter(
    (transfer) =>
      transfer.direction === "sell" || transfer.direction === "transfer_out"
  ).length;
  const recurringCounterpartyCount = countRecurringCounterparties(transfers);
  const consistencyScore = calculateConsistencyScore({
    activeDaysEstimate,
    repeatedTokenCount,
    recurringCounterpartyCount,
    tokenDiversity,
    transactionCount,
  });
  const convictionBehaviorScore = calculateConvictionBehaviorScore({
    inboundCount,
    outboundCount,
    repeatedTokenCount,
    tokenDiversity,
    transactionCount,
  });
  const rotationScore = calculateRotationScore({
    outboundCount,
    tokenDiversity,
    transactionCount,
  });
  const narrativeExposure = calculateNarrativeExposure(tokenDiversity);
  const recurringClusterAppearance = detectRecurringClusterAppearance({
    previousSnapshots,
    recurringCounterpartyCount,
    repeatedTokenCount,
    tokenDiversity,
  });
  const repeatedBehaviorFlags = buildRepeatedBehaviorFlags({
    convictionBehaviorScore,
    previousSnapshots,
    recurringClusterAppearanceDetected: recurringClusterAppearance.detected,
    repeatedTokenCount,
    rotationScore,
    tokenDiversity,
    transactionCount,
  });
  const walletFingerprint = generateWalletFingerprint({
    activeDaysEstimate,
    chain: normalizedChain,
    convictionBehaviorScore,
    repeatedTokenCount,
    rotationScore,
    tokenDiversity,
    walletAddress,
  });
  const speculativeBehaviorScore = Math.max(
    rotationScore,
    Math.round(narrativeExposure.score * 0.72 + rotationScore * 0.28)
  );
  const confidenceLabel = confidenceFromActivity({
    transactionCount,
    repeatedTokenCount,
    previousSnapshotCount: previousSnapshots.length,
    valueCoverage: valueCoverage(transfers),
  });
  const snapshot: WalletMemorySnapshot = {
    walletAddress,
    chain: normalizedChain,
    walletFingerprint,
    observedAt: new Date().toISOString(),
    interactedTokenAddresses,
    repeatedTokenCount,
    activeDaysEstimate,
    transactionCount,
    consistencyScore,
    convictionBehaviorScore,
    rotationScore,
    narrativeExposure,
    repeatedBehaviorFlags,
  };
  const warnings = [
    "Wallet Memory Engine V1 uses in-memory runtime observations and recent ERC20 transfer metadata only.",
    "No PnL, win rate, average hold duration, smart money identity or insider identity is calculated.",
    "Memory resets when the server runtime resets until database persistence is added.",
  ];

  return {
    ...snapshot,
    repeatedWalletSeen: previousSnapshots.length > 0,
    recurringClusterAppearance,
    speculativeBehaviorScore,
    memorySummary: buildMemorySummary({
      confidenceLabel,
      convictionBehaviorScore,
      previousSnapshotCount: previousSnapshots.length,
      rotationScore,
      tokenDiversity,
      transactionCount,
    }),
    confidenceLabel,
    warnings,
  };
}

export function rememberWalletSnapshot(snapshot: WalletMemorySnapshot) {
  const key = memoryKey(snapshot.walletAddress, snapshot.chain);
  const existing = memorySnapshots.get(key) || [];
  const next = [snapshot, ...existing].slice(0, 12);

  memorySnapshots.set(key, next);

  return next;
}

export function getWalletMemoryHistory(walletAddress: string, chain: string) {
  return memorySnapshots.get(memoryKey(walletAddress, chain)) || [];
}

function classifyDirection({
  transfer,
  walletAddress,
}: {
  transfer: RawWalletMemoryTransfer;
  walletAddress: string;
}): MemoryTransferDirection {
  const semanticDirection = (
    transfer.direction ||
    transfer.transaction_type ||
    transfer.category ||
    ""
  ).toLowerCase();

  if (semanticDirection.includes("buy")) return "buy";
  if (semanticDirection.includes("sell")) return "sell";

  const wallet = walletAddress.toLowerCase();
  const from = (transfer.from_address || transfer.from_wallet || "").toLowerCase();
  const to = (transfer.to_address || transfer.to_wallet || "").toLowerCase();

  if (to === wallet) return "transfer_in";
  if (from === wallet) return "transfer_out";

  return "transfer_out";
}

function parseTimestamp(value?: string) {
  if (!value) return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;
  return new Date(time).toISOString();
}

function parseNumber(value?: number | string | null) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function uniqueTokens(transfers: WalletMemoryTransfer[]) {
  return Array.from(
    new Set(
      transfers
        .map((transfer) => transfer.tokenAddress?.toLowerCase() || "")
        .filter((address) => isEvmAddress(address))
    )
  );
}

function countRepeatedTokens(transfers: WalletMemoryTransfer[]) {
  const counts = new Map<string, number>();

  for (const transfer of transfers) {
    const tokenAddress = transfer.tokenAddress?.toLowerCase();
    if (!tokenAddress || !isEvmAddress(tokenAddress)) continue;
    counts.set(tokenAddress, (counts.get(tokenAddress) || 0) + 1);
  }

  return Array.from(counts.values()).filter((count) => count >= 2).length;
}

function countRecurringCounterparties(transfers: WalletMemoryTransfer[]) {
  const counts = new Map<string, number>();

  for (const transfer of transfers) {
    const counterparty = transfer.counterparty?.toLowerCase();
    if (!counterparty || !isEvmAddress(counterparty)) continue;
    counts.set(counterparty, (counts.get(counterparty) || 0) + 1);
  }

  return Array.from(counts.values()).filter((count) => count >= 2).length;
}

function activeDayCount(transfers: WalletMemoryTransfer[]) {
  return new Set(
    transfers
      .map((transfer) => transfer.timestamp?.slice(0, 10))
      .filter((day): day is string => Boolean(day))
  ).size;
}

function calculateConsistencyScore({
  activeDaysEstimate,
  repeatedTokenCount,
  recurringCounterpartyCount,
  tokenDiversity,
  transactionCount,
}: {
  activeDaysEstimate: number;
  repeatedTokenCount: number;
  recurringCounterpartyCount: number;
  tokenDiversity: number;
  transactionCount: number;
}) {
  const activityBase = Math.min(35, activeDaysEstimate * 5);
  const repeatedTokenBase = Math.min(25, repeatedTokenCount * 8);
  const counterpartyBase = Math.min(20, recurringCounterpartyCount * 6);
  const historyBase = Math.min(20, Math.log10(transactionCount + 1) * 12);
  const diversityPenalty = tokenDiversity > 18 ? 18 : tokenDiversity > 10 ? 8 : 0;

  return clampScore(
    activityBase + repeatedTokenBase + counterpartyBase + historyBase - diversityPenalty
  );
}

function calculateConvictionBehaviorScore({
  inboundCount,
  outboundCount,
  repeatedTokenCount,
  tokenDiversity,
  transactionCount,
}: {
  inboundCount: number;
  outboundCount: number;
  repeatedTokenCount: number;
  tokenDiversity: number;
  transactionCount: number;
}) {
  if (transactionCount === 0) return 0;

  const inboundRatio = inboundCount / Math.max(1, inboundCount + outboundCount);
  const repeatedTokenBase = Math.min(35, repeatedTokenCount * 9);
  const focusBase = tokenDiversity <= 4 ? 25 : tokenDiversity <= 10 ? 14 : 4;
  const flowBase = inboundRatio >= 0.58 ? 25 : inboundRatio >= 0.45 ? 14 : 5;
  const activityBase = Math.min(15, Math.log10(transactionCount + 1) * 8);

  return clampScore(repeatedTokenBase + focusBase + flowBase + activityBase);
}

function calculateRotationScore({
  outboundCount,
  tokenDiversity,
  transactionCount,
}: {
  outboundCount: number;
  tokenDiversity: number;
  transactionCount: number;
}) {
  if (transactionCount === 0) return 0;

  const outboundRatio = outboundCount / Math.max(1, transactionCount);
  const diversityBase = Math.min(48, tokenDiversity * 4);
  const outboundBase = outboundRatio >= 0.6 ? 32 : outboundRatio >= 0.4 ? 22 : 10;
  const activityBase = Math.min(20, Math.log10(transactionCount + 1) * 10);

  return clampScore(diversityBase + outboundBase + activityBase);
}

function calculateNarrativeExposure(
  tokenDiversity: number
): WalletMemorySnapshot["narrativeExposure"] {
  const score = clampScore(tokenDiversity * 6);
  const label: WalletMemorySnapshot["narrativeExposure"]["label"] =
    tokenDiversity >= 14 ? "Broad" : tokenDiversity >= 6 ? "Mixed" : "Focused";

  return {
    score,
    tokenDiversity,
    label,
  };
}

function detectRecurringClusterAppearance({
  previousSnapshots,
  recurringCounterpartyCount,
  repeatedTokenCount,
  tokenDiversity,
}: {
  previousSnapshots: WalletMemorySnapshot[];
  recurringCounterpartyCount: number;
  repeatedTokenCount: number;
  tokenDiversity: number;
}) {
  const priorClusterLikeFlags = previousSnapshots.some((snapshot) =>
    snapshot.repeatedBehaviorFlags.includes("cluster_like_recurrence")
  );
  const detected =
    priorClusterLikeFlags ||
    (recurringCounterpartyCount >= 2 && repeatedTokenCount >= 2) ||
    (previousSnapshots.length > 0 && tokenDiversity >= 6);
  const score = clampScore(
    recurringCounterpartyCount * 18 +
      repeatedTokenCount * 8 +
      previousSnapshots.length * 10
  );

  return {
    detected,
    score,
    explanation: detected
      ? "Recurring cluster appearance is inferred from repeated counterparties, repeated token participation or prior runtime observations."
      : "No recurring cluster appearance was detected from current runtime memory and recent transfer activity.",
  };
}

function buildRepeatedBehaviorFlags({
  convictionBehaviorScore,
  previousSnapshots,
  recurringClusterAppearanceDetected,
  repeatedTokenCount,
  rotationScore,
  tokenDiversity,
  transactionCount,
}: {
  convictionBehaviorScore: number;
  previousSnapshots: WalletMemorySnapshot[];
  recurringClusterAppearanceDetected: boolean;
  repeatedTokenCount: number;
  rotationScore: number;
  tokenDiversity: number;
  transactionCount: number;
}) {
  const flags: string[] = [];

  if (previousSnapshots.length > 0) flags.push("repeated_wallet_seen");
  if (repeatedTokenCount >= 2) flags.push("repeated_token_participation");
  if (recurringClusterAppearanceDetected) flags.push("cluster_like_recurrence");
  if (convictionBehaviorScore >= 65) flags.push("conviction_like_behavior");
  if (rotationScore >= 65) flags.push("rotation_tendency");
  if (tokenDiversity >= 10) flags.push("narrative_chasing_tendency");
  if (transactionCount < 5) flags.push("sparse_memory");

  return flags.length > 0 ? flags : ["insufficient_repetition_detected"];
}

function confidenceFromActivity({
  transactionCount,
  repeatedTokenCount,
  previousSnapshotCount,
  valueCoverage,
}: {
  transactionCount: number;
  repeatedTokenCount: number;
  previousSnapshotCount: number;
  valueCoverage: number;
}) {
  const score = clampScore(
    Math.min(45, transactionCount * 2) +
      Math.min(20, repeatedTokenCount * 7) +
      Math.min(20, previousSnapshotCount * 10) +
      Math.round(valueCoverage * 15)
  );

  if (score >= 72) return "High";
  if (score >= 45) return "Medium";
  return "Low";
}

function valueCoverage(transfers: WalletMemoryTransfer[]) {
  if (transfers.length === 0) return 0;
  return (
    transfers.filter((transfer) => transfer.valueUsd !== null).length /
    transfers.length
  );
}

function buildMemorySummary({
  confidenceLabel,
  convictionBehaviorScore,
  previousSnapshotCount,
  rotationScore,
  tokenDiversity,
  transactionCount,
}: {
  confidenceLabel: MemoryConfidenceLabel;
  convictionBehaviorScore: number;
  previousSnapshotCount: number;
  rotationScore: number;
  tokenDiversity: number;
  transactionCount: number;
}) {
  if (transactionCount === 0) {
    return "Wallet memory is unavailable because no recent ERC20 transfer activity was returned.";
  }

  const primaryBehavior =
    convictionBehaviorScore >= rotationScore
      ? "conviction-like"
      : "rotation-oriented";
  const seenText =
    previousSnapshotCount > 0
      ? "This wallet has appeared in runtime memory before."
      : "This is the first runtime memory observation for this wallet.";

  return `${seenText} Current behavior is inferred as ${primaryBehavior} with ${confidenceLabel.toLowerCase()} confidence across ${tokenDiversity} interacted tokens.`;
}

function generateWalletFingerprint({
  activeDaysEstimate,
  chain,
  convictionBehaviorScore,
  repeatedTokenCount,
  rotationScore,
  tokenDiversity,
  walletAddress,
}: {
  activeDaysEstimate: number;
  chain: string;
  convictionBehaviorScore: number;
  repeatedTokenCount: number;
  rotationScore: number;
  tokenDiversity: number;
  walletAddress: string;
}) {
  const fingerprintSeed = [
    walletAddress.toLowerCase(),
    chain.toLowerCase(),
    bucket(tokenDiversity, 4),
    bucket(repeatedTokenCount, 2),
    bucket(activeDaysEstimate, 3),
    bucket(convictionBehaviorScore, 20),
    bucket(rotationScore, 20),
  ].join(":");

  return `wm_${fnv1a(fingerprintSeed)}`;
}

function bucket(value: number, size: number) {
  if (size <= 0) return value;
  return Math.floor(value / size) * size;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function memoryKey(walletAddress: string, chain: string) {
  return `${chain.toLowerCase()}:${walletAddress.toLowerCase()}`;
}

function fnv1a(value: string) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}
