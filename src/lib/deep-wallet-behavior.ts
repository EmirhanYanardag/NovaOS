export type NormalizedTokenTransfer = {
  txHash: string;
  timestamp?: string;
  blockNumber?: number;
  walletAddress: string;
  tokenAddress?: string;
  tokenSymbol?: string;
  direction: "in" | "out" | "unknown";
  amount?: number;
  valueUsd?: number;
  counterparty?: string;
};

export type DeepWalletBehaviorInput = {
  walletAddress: string;
  tokenAddress: string;
  chain: string;
  holderRank?: number;
  ownershipPercent?: number;
  walletAgeDays?: number;
  transactionCount?: number;
  recentTx30d?: number;
  recentTx7d?: number;
  daysSinceLastActive?: number;
  interactedTokenCount?: number;
  nativeBalanceUsd?: number;
  rawTransfers: unknown[];
};

export type DeepWalletBehaviorResult = {
  walletAddress: string;
  tokenAddress: string;
  tokenTransferInCount: number;
  tokenTransferOutCount: number;
  tokenTransferTotalCount: number;
  firstTokenActivityAt?: string;
  lastTokenActivityAt?: string;
  estimatedTokenHoldDays?: number;
  daysSinceLastTokenActivity?: number;
  accumulationPressure: number;
  distributionPressure: number;
  transferBalanceScore: number;
  holdQualityScore: number;
  botLikeActivityRisk: number;
  rotationBehaviorRisk: number;
  shortHoldRisk: number;
  concentrationRisk: number;
  tokenSpecificConvictionScore: number;
  walletBehaviorQualityScore: number;
  behaviorTags: string[];
  positives: string[];
  negatives: string[];
  dataQuality: {
    score: number;
    label: "Low" | "Medium" | "High";
    warnings: string[];
  };
};

export type DeepWalletBehaviorBatchResult = {
  results: DeepWalletBehaviorResult[];
  summary: {
    analyzedWallets: number;
    averageTokenSpecificConviction: number;
    averageWalletBehaviorQuality: number;
    averageBotLikeActivityRisk: number;
    averageRotationBehaviorRisk: number;
    averageShortHoldRisk: number;
    averageAccumulationPressure: number;
    averageDistributionPressure: number;
    highRiskWalletCount: number;
    lowDataWalletCount: number;
  };
  warnings: string[];
};

type BatchHolder = {
  rank: number;
  address: string;
  ownershipPercent?: number;
  walletAgeDays?: number;
  transactionCount?: number;
  recentTx30d?: number;
  recentTx7d?: number;
  daysSinceLastActive?: number;
  interactedTokenCount?: number;
  nativeBalanceUsd?: number;
};

function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function safeNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function average(values: number[]) {
  const safeValues = values.filter((value) => Number.isFinite(value));
  if (safeValues.length === 0) return 0;
  return safeValues.reduce((sum, value) => sum + value, 0) / safeValues.length;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function firstString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function firstNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.replace(/,/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function normalizeAddress(value?: string) {
  return value?.trim().toLowerCase() || "";
}

function parseTimestamp(value?: string) {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return undefined;
  return new Date(parsed).toISOString();
}

function dayDiff(startMs: number, endMs: number) {
  return Math.max(0, Math.floor((endMs - startMs) / 86_400_000));
}

export function normalizeMoralisTransfers({
  walletAddress,
  tokenAddress,
  rawTransfers,
}: {
  walletAddress: string;
  tokenAddress: string;
  rawTransfers: unknown[];
}): NormalizedTokenTransfer[] {
  const wallet = normalizeAddress(walletAddress);
  const token = normalizeAddress(tokenAddress);

  return rawTransfers.map((rawTransfer) => {
    const record = asRecord(rawTransfer);
    const from = normalizeAddress(
      firstString(record, ["from_address", "fromAddress", "from"])
    );
    const to = normalizeAddress(firstString(record, ["to_address", "toAddress", "to"]));
    const transferToken = normalizeAddress(
      firstString(record, ["token_address", "tokenAddress", "address"])
    );
    const direction: NormalizedTokenTransfer["direction"] =
      from === wallet ? "out" : to === wallet ? "in" : "unknown";
    const counterparty =
      direction === "in" ? from || undefined : direction === "out" ? to || undefined : undefined;

    return {
      txHash:
        firstString(record, ["transaction_hash", "transactionHash", "hash"]) ||
        "unknown",
      timestamp: parseTimestamp(
        firstString(record, ["block_timestamp", "blockTimestamp", "timestamp"])
      ),
      blockNumber: firstNumber(record, ["block_number", "blockNumber"]),
      walletAddress,
      tokenAddress: transferToken || tokenAddress,
      tokenSymbol: firstString(record, ["token_symbol", "tokenSymbol", "symbol"]),
      direction,
      amount: firstNumber(record, [
        "value_decimal",
        "valueFormatted",
        "value_formatted",
        "value",
      ]),
      valueUsd: firstNumber(record, ["value_usd", "usd_value", "valueUsd"]),
      counterparty,
    };
  }).filter((transfer) =>
    token ? normalizeAddress(transfer.tokenAddress) === token : true
  );
}

function scoreShortHoldRisk(estimatedTokenHoldDays?: number) {
  if (estimatedTokenHoldDays === undefined) return 50;
  if (estimatedTokenHoldDays <= 1) return 95;
  if (estimatedTokenHoldDays <= 3) return 85;
  if (estimatedTokenHoldDays <= 7) return 70;
  if (estimatedTokenHoldDays <= 30) return 45;
  if (estimatedTokenHoldDays <= 90) return 20;
  return 8;
}

function scoreHoldQuality(estimatedTokenHoldDays?: number) {
  if (estimatedTokenHoldDays === undefined) return 35;
  if (estimatedTokenHoldDays <= 1) return 5;
  if (estimatedTokenHoldDays <= 3) return 15;
  if (estimatedTokenHoldDays <= 7) return 30;
  if (estimatedTokenHoldDays <= 30) return 55;
  if (estimatedTokenHoldDays <= 90) return 80;
  return 95;
}

function countTransfersSince(transfers: NormalizedTokenTransfer[], days: number) {
  const since = Date.now() - days * 86_400_000;
  return transfers.filter((transfer) => {
    if (!transfer.timestamp) return false;
    const parsed = Date.parse(transfer.timestamp);
    return Number.isFinite(parsed) && parsed >= since;
  }).length;
}

function calculateTransferFrequencyRisk({
  activeWindowDays,
  transfers,
}: {
  activeWindowDays: number;
  transfers: NormalizedTokenTransfer[];
}) {
  const total = transfers.length;
  const transfersIn24h = countTransfersSince(transfers, 1);
  const transfersIn7d = countTransfersSince(transfers, 7);

  if (transfersIn7d >= 50) return { risk: 95, transfersIn24h, transfersIn7d };
  if (transfersIn24h >= 20) return { risk: 80, transfersIn24h, transfersIn7d };
  if (total <= 3) return { risk: 10, transfersIn24h, transfersIn7d };
  if (total <= 10) return { risk: 25, transfersIn24h, transfersIn7d };
  if (total <= 20) return { risk: 45, transfersIn24h, transfersIn7d };

  const transfersPerDay = total / Math.max(1, activeWindowDays);
  return {
    risk: clamp(transfersPerDay * 18),
    transfersIn24h,
    transfersIn7d,
  };
}

function calculateAlternationRisk(transfers: NormalizedTokenTransfer[]) {
  const directional = transfers.filter(
    (transfer) => transfer.direction === "in" || transfer.direction === "out"
  );
  let directionChanges = 0;

  for (let index = 1; index < directional.length; index += 1) {
    if (directional[index].direction !== directional[index - 1].direction) {
      directionChanges += 1;
    }
  }

  const transitions = Math.max(0, directional.length - 1);
  const alternationRatio = transitions > 0 ? directionChanges / transitions : 0;
  const rawRisk = clamp(alternationRatio * 100);

  return directional.length < 4 ? Math.min(rawRisk, 40) : rawRisk;
}

function calculateRepeatedCounterpartyRisk(transfers: NormalizedTokenTransfer[]) {
  const counterparties = transfers
    .map((transfer) => normalizeAddress(transfer.counterparty))
    .filter(Boolean);
  if (counterparties.length === 0) return 35;

  const counts = new Map<string, number>();
  counterparties.forEach((counterparty) => {
    counts.set(counterparty, (counts.get(counterparty) || 0) + 1);
  });
  const dominantCount = Math.max(...counts.values());
  const risk = clamp((dominantCount / counterparties.length) * 100);

  return counterparties.length < 3 ? Math.min(risk, 50) : risk;
}

function calculateRepetitiveAmountRisk(transfers: NormalizedTokenTransfer[]) {
  const amounts = transfers
    .map((transfer) => transfer.amount)
    .filter((amount): amount is number => typeof amount === "number");
  if (amounts.length === 0) return 35;

  const buckets = new Map<string, number>();
  amounts.forEach((amount) => {
    const bucket = amount === 0 ? "0" : amount.toPrecision(4);
    buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
  });
  const repeatedSimilarAmounts = [...buckets.values()]
    .filter((count) => count > 1)
    .reduce((sum, count) => sum + count, 0);

  return clamp((repeatedSimilarAmounts / amounts.length) * 100);
}

function calculateConcentrationRisk(ownershipPercent?: number) {
  if (ownershipPercent === undefined) return 35;
  let risk = ownershipPercent * 25;
  if (ownershipPercent > 1) risk += 10;
  if (ownershipPercent > 5) risk += 20;
  if (ownershipPercent > 10) risk += 30;
  return clamp(risk);
}

function buildDataQuality({
  transfers,
}: {
  transfers: NormalizedTokenTransfer[];
}): DeepWalletBehaviorResult["dataQuality"] {
  const warnings: string[] = [];
  const timestampCoverage =
    transfers.length > 0
      ? transfers.filter((transfer) => transfer.timestamp).length / transfers.length
      : 0;
  const directionCoverage =
    transfers.length > 0
      ? transfers.filter((transfer) => transfer.direction !== "unknown").length /
        transfers.length
      : 0;
  const amountCoverage =
    transfers.length > 0
      ? transfers.filter((transfer) => typeof transfer.amount === "number").length /
        transfers.length
      : 0;
  let score = 0;

  score += transfers.length >= 20 ? 35 : transfers.length >= 8 ? 25 : transfers.length >= 3 ? 14 : 4;
  score += timestampCoverage * 22;
  score += directionCoverage * 24;
  score += amountCoverage * 9;

  if (transfers.length < 3) warnings.push("Sparse token transfer history lowers confidence.");
  if (timestampCoverage < 0.7) warnings.push("Some transfers are missing timestamps.");
  if (directionCoverage < 0.8) warnings.push("Some transfers could not be directionally classified.");
  if (amountCoverage < 0.5) warnings.push("Amount coverage is limited for repetitive-amount analysis.");

  const finalScore = Math.round(clamp(score));

  return {
    score: finalScore,
    label: finalScore >= 72 ? "High" : finalScore >= 45 ? "Medium" : "Low",
    warnings,
  };
}

export function analyzeDeepWalletBehavior(
  input: DeepWalletBehaviorInput
): DeepWalletBehaviorResult {
  const transfers = normalizeMoralisTransfers({
    walletAddress: input.walletAddress,
    tokenAddress: input.tokenAddress,
    rawTransfers: input.rawTransfers,
  }).sort((a, b) => {
    const aTime = a.timestamp ? Date.parse(a.timestamp) : 0;
    const bTime = b.timestamp ? Date.parse(b.timestamp) : 0;
    return aTime - bTime;
  });
  const inboundTransfers = transfers.filter((transfer) => transfer.direction === "in");
  const outboundTransfers = transfers.filter((transfer) => transfer.direction === "out");
  const inCount = inboundTransfers.length;
  const outCount = outboundTransfers.length;
  const directionalTotal = inCount + outCount;
  const accumulationPressure =
    directionalTotal > 0 ? (inCount / directionalTotal) * 100 : 0;
  const distributionPressure =
    directionalTotal > 0 ? (outCount / directionalTotal) * 100 : 0;
  const transferBalanceScore = clamp(
    50 + accumulationPressure * 0.5 - distributionPressure * 0.7
  );
  const timestamps = transfers
    .map((transfer) => (transfer.timestamp ? Date.parse(transfer.timestamp) : NaN))
    .filter((timestamp) => Number.isFinite(timestamp));
  const firstMs = timestamps.length ? Math.min(...timestamps) : undefined;
  const lastMs = timestamps.length ? Math.max(...timestamps) : undefined;
  const estimatedTokenHoldDays =
    firstMs !== undefined && lastMs !== undefined ? dayDiff(firstMs, lastMs) : undefined;
  const daysSinceLastTokenActivity =
    lastMs !== undefined ? dayDiff(lastMs, Date.now()) : undefined;
  const shortHoldRisk = scoreShortHoldRisk(estimatedTokenHoldDays);
  const holdQualityScore = scoreHoldQuality(estimatedTokenHoldDays);
  const activeWindowDays =
    estimatedTokenHoldDays !== undefined ? Math.max(1, estimatedTokenHoldDays) : 1;
  const { risk: transferFrequencyRisk, transfersIn24h, transfersIn7d } =
    calculateTransferFrequencyRisk({ activeWindowDays, transfers });
  const alternationRisk = calculateAlternationRisk(transfers);
  const repeatedCounterpartyRisk = calculateRepeatedCounterpartyRisk(transfers);
  const repetitiveAmountRisk = calculateRepetitiveAmountRisk(transfers);
  let botRisk =
    0.3 * transferFrequencyRisk +
    0.25 * alternationRisk +
    0.2 * repeatedCounterpartyRisk +
    0.15 * shortHoldRisk +
    0.1 * repetitiveAmountRisk;

  if (safeNumber(input.walletAgeDays, 365) <= 7 && transfers.length >= 10) botRisk += 12;
  if (transfersIn24h >= 20) botRisk += 10;
  if (transfersIn7d >= 50) botRisk += 10;

  const botLikeActivityRisk = clamp(botRisk);
  const interactedTokenCount = input.interactedTokenCount;
  const tokenExposureRisk =
    typeof interactedTokenCount === "number"
      ? clamp(interactedTokenCount * 2)
      : 40;
  const highTransferCycleRisk = clamp(
    (Math.min(inCount, outCount) / Math.max(1, directionalTotal)) * 160
  );
  const rotationBehaviorRisk = clamp(
    0.3 * distributionPressure +
      0.25 * shortHoldRisk +
      0.2 * botLikeActivityRisk +
      0.15 * tokenExposureRisk +
      0.1 * highTransferCycleRisk
  );
  const concentrationRisk = calculateConcentrationRisk(input.ownershipPercent);
  let tokenSpecificConvictionScore =
    0.3 * accumulationPressure +
    0.25 * transferBalanceScore +
    0.2 * holdQualityScore +
    0.15 * (100 - botLikeActivityRisk) +
    0.1 * (100 - rotationBehaviorRisk);

  if (shortHoldRisk > 80) tokenSpecificConvictionScore -= 10;
  if (botLikeActivityRisk > 80) tokenSpecificConvictionScore -= 15;
  if (rotationBehaviorRisk > 80) tokenSpecificConvictionScore -= 10;
  if (
    concentrationRisk > 80 &&
    (input.walletAgeDays === undefined || input.walletAgeDays <= 30)
  ) {
    tokenSpecificConvictionScore -= 12;
  }
  if (distributionPressure > 75) tokenSpecificConvictionScore -= 10;

  tokenSpecificConvictionScore = clamp(tokenSpecificConvictionScore);
  const walletBehaviorQualityScore = clamp(
    0.3 * tokenSpecificConvictionScore +
      0.2 * holdQualityScore +
      0.15 * accumulationPressure +
      0.15 * (100 - botLikeActivityRisk) +
      0.1 * (100 - rotationBehaviorRisk) +
      0.1 * (100 - concentrationRisk)
  );
  const dataQuality = buildDataQuality({ transfers });
  const behaviorTags: string[] = [];
  const positives: string[] = [];
  const negatives: string[] = [];

  if (accumulationPressure > 70) {
    behaviorTags.push("accumulating");
    positives.push("Wallet shows accumulation-dominant token flow.");
  }
  if (distributionPressure > 65) {
    behaviorTags.push("distributing");
    negatives.push("Distribution pressure dominates token flow.");
  }
  if (botLikeActivityRisk > 70) {
    behaviorTags.push("bot-like activity");
    negatives.push("Repeated in/out behavior increases bot-like activity risk.");
  } else {
    positives.push("Bot-like transfer risk is low.");
  }
  if (rotationBehaviorRisk > 65) {
    behaviorTags.push("rotation behavior");
    negatives.push("Rotation behavior appears elevated.");
  } else {
    positives.push("Rotation behavior appears limited.");
  }
  if (shortHoldRisk > 70) {
    behaviorTags.push("short-cycle holder");
    negatives.push("Short token activity window increases short-cycle risk.");
  }
  if (holdQualityScore > 70 && botLikeActivityRisk < 35 && rotationBehaviorRisk < 45) {
    behaviorTags.push("stable holder");
    positives.push("Token activity window suggests longer holding behavior.");
  }
  if (concentrationRisk > 65) {
    behaviorTags.push("concentrated holder");
    negatives.push("Concentrated ownership increases downside sensitivity.");
  } else {
    positives.push("Ownership is not excessively concentrated.");
  }
  if (dataQuality.score < 45) {
    behaviorTags.push("low data");
    negatives.push("Limited token transfer data reduces confidence.");
  }

  return {
    walletAddress: input.walletAddress,
    tokenAddress: input.tokenAddress,
    tokenTransferInCount: inCount,
    tokenTransferOutCount: outCount,
    tokenTransferTotalCount: transfers.length,
    firstTokenActivityAt:
      firstMs !== undefined ? new Date(firstMs).toISOString() : undefined,
    lastTokenActivityAt:
      lastMs !== undefined ? new Date(lastMs).toISOString() : undefined,
    estimatedTokenHoldDays,
    daysSinceLastTokenActivity,
    accumulationPressure: Math.round(accumulationPressure),
    distributionPressure: Math.round(distributionPressure),
    transferBalanceScore: Math.round(transferBalanceScore),
    holdQualityScore: Math.round(holdQualityScore),
    botLikeActivityRisk: Math.round(botLikeActivityRisk),
    rotationBehaviorRisk: Math.round(rotationBehaviorRisk),
    shortHoldRisk: Math.round(shortHoldRisk),
    concentrationRisk: Math.round(concentrationRisk),
    tokenSpecificConvictionScore: Math.round(tokenSpecificConvictionScore),
    walletBehaviorQualityScore: Math.round(walletBehaviorQualityScore),
    behaviorTags: behaviorTags.length ? behaviorTags : ["limited signal"],
    positives,
    negatives,
    dataQuality,
  };
}

export async function analyzeDeepWalletBehaviorBatch({
  chain,
  deepLimit = 5,
  fetchTransfersForWallet,
  holders,
  tokenAddress,
}: {
  chain: string;
  tokenAddress: string;
  holders: BatchHolder[];
  fetchTransfersForWallet: (walletAddress: string) => Promise<unknown[]>;
  deepLimit?: number;
}): Promise<DeepWalletBehaviorBatchResult> {
  const limit = Math.min(10, Math.max(1, Math.floor(deepLimit)));
  const warnings: string[] = [];
  const seen = new Set<string>();
  const topHolders = [...holders]
    .sort((a, b) => a.rank - b.rank)
    .filter((holder) => {
      const address = normalizeAddress(holder.address);
      if (!address || seen.has(address)) return false;
      seen.add(address);
      return true;
    })
    .slice(0, limit);
  const settled = await Promise.allSettled(
    topHolders.map(async (holder) => {
      const rawTransfers = await fetchTransfersForWallet(holder.address);
      return analyzeDeepWalletBehavior({
        walletAddress: holder.address,
        tokenAddress,
        chain,
        holderRank: holder.rank,
        ownershipPercent: holder.ownershipPercent,
        walletAgeDays: holder.walletAgeDays,
        transactionCount: holder.transactionCount,
        recentTx30d: holder.recentTx30d,
        recentTx7d: holder.recentTx7d,
        daysSinceLastActive: holder.daysSinceLastActive,
        interactedTokenCount: holder.interactedTokenCount,
        nativeBalanceUsd: holder.nativeBalanceUsd,
        rawTransfers,
      });
    })
  );
  const results: DeepWalletBehaviorResult[] = [];

  settled.forEach((result, index) => {
    if (result.status === "fulfilled") {
      results.push(result.value);
    } else {
      warnings.push(
        `Deep behavior fetch failed for rank ${topHolders[index]?.rank || index + 1}.`
      );
    }
  });

  return {
    results,
    summary: {
      analyzedWallets: results.length,
      averageTokenSpecificConviction: Math.round(
        average(results.map((result) => result.tokenSpecificConvictionScore))
      ),
      averageWalletBehaviorQuality: Math.round(
        average(results.map((result) => result.walletBehaviorQualityScore))
      ),
      averageBotLikeActivityRisk: Math.round(
        average(results.map((result) => result.botLikeActivityRisk))
      ),
      averageRotationBehaviorRisk: Math.round(
        average(results.map((result) => result.rotationBehaviorRisk))
      ),
      averageShortHoldRisk: Math.round(
        average(results.map((result) => result.shortHoldRisk))
      ),
      averageAccumulationPressure: Math.round(
        average(results.map((result) => result.accumulationPressure))
      ),
      averageDistributionPressure: Math.round(
        average(results.map((result) => result.distributionPressure))
      ),
      highRiskWalletCount: results.filter(
        (result) =>
          result.botLikeActivityRisk > 70 ||
          result.rotationBehaviorRisk > 65 ||
          result.shortHoldRisk > 70
      ).length,
      lowDataWalletCount: results.filter((result) => result.dataQuality.score < 45)
        .length,
    },
    warnings,
  };
}
