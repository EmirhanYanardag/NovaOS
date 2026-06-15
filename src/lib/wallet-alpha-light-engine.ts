type ConfidenceLevel = "low" | "medium" | "high";
type UnknownRecord = Record<string, unknown>;
type Period = "30d" | "7d";

export type GmgnWalletPnlStats = {
  wallet: string;
  chain: string;
  period: Period;
  realizedPnlPercent: number | null;
  realizedPnlUsd: number | null;
  totalPnlUsd: number | null;
  unrealizedPnlUsd: number | null;
  winRatePercent: number | null;
  pnlMultiplier: number | null;
  totalSpentUsd: number | null;
  totalTxCount: number | null;
  buyTxCount: number | null;
  sellTxCount: number | null;
  tokenCount: number | null;
  avgDurationSeconds: number | null;
  costUsd: number | null;
  avgCostUsd: number | null;
  avgSoldUsd: number | null;
  avgRealizedProfitUsd: number | null;
  feesUsd: number | null;
  volumeUsd: number | null;
  distribution: {
    gt500: { count: number | null; percent: number | null };
    p200to500: { count: number | null; percent: number | null };
    p0to200: { count: number | null; percent: number | null };
    n50to0: { count: number | null; percent: number | null };
    ltMinus50: { count: number | null; percent: number | null };
  };
  sourceAvailable: boolean;
  sourceCommand: string | null;
  derived: {
    realizedPnlPercentFromUsd: boolean;
    totalTxCountFromBuySell: boolean;
    pnlMultiplierFromPnlPercent: boolean;
  };
  missingFields: string[];
  raw?: unknown;
};

export type WalletAlphaLight = {
  wallet: string;
  chain: string;
  isFallback: boolean;
  sourceAvailable: boolean;
  sourceCommand: string | null;
  walletAlphaLight: number;
  confidenceLevel: ConfidenceLevel;
  rawMetrics: {
    realizedPnlPercent: number | null;
    winRate: number | null;
    realizedPnlUsd: number | null;
    totalPnlUsd: number | null;
    pnlMultiplier: number | null;
    totalSpentUsd: number | null;
    tradeCount: number | null;
    tokenCount: number | null;
    buyCount: number | null;
    sellCount: number | null;
    avgHoldSeconds: number | null;
    period: string | null;
  };
  pnlStats: GmgnWalletPnlStats;
  scoreBreakdown: {
    pnlEfficiencyQuality: number;
    distributionQuality: number;
    winRateQuality: number;
    tradeDepthQuality: number;
    riskControlQuality: number;
    activityQuality: number;
    dataCompletenessQuality: number;
    lightConfidenceScore: number;
    sourceCompleteness: number;
    distributionCompleteness: number;
    distributionAvailable: boolean;
    winRateAvailable: boolean;
    realizedPnlPercentDerived: boolean;
    formula: string;
    formulaUsed: string;
    normalizedPnlStats: GmgnWalletPnlStats;
    source: "gmgn-portfolio-stats-light" | "wallet-alpha-light-fallback";
  };
  warnings: string[];
  explanations: string[];
};

export type WalletAlphaLightOptions = {
  includeRaw?: boolean;
  period?: Period;
};

const SUPPORTED_CHAINS = new Set(["sol", "bsc", "base", "eth"]);
const EVM_WALLET_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const SOL_WALLET_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const LIGHT_FORMULA_WITH_DISTRIBUTION =
  "0.30 pnlEfficiency + 0.20 distribution + 0.17 winRate + 0.13 tradeDepth + 0.10 riskControl + 0.06 activity + 0.04 dataCompleteness";
const LIGHT_FORMULA_NO_DISTRIBUTION =
  "no-distribution formula: 0.42 pnlEfficiency + 0.17 winRate + 0.18 tradeDepth + 0.13 riskControl + 0.06 activity + 0.04 dataCompleteness";
const DEFAULT_GMGN_API_BASE = "https://gmgn.ai";
const IS_VERCEL_RUNTIME = Boolean(process.env.VERCEL);

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const text = value.trim();
    const suffix = text.match(/[kmb]\b/i)?.[0]?.toLowerCase();
    let normalized = text.replace(/[%$+\s]/g, "").replace(/[kmb]\b/i, "");
    if (/^-?\d+,\d+$/.test(normalized) && !normalized.includes(".")) {
      normalized = normalized.replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
    const multiplier = suffix === "k" ? 1_000 : suffix === "m" ? 1_000_000 : suffix === "b" ? 1_000_000_000 : 1;
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed * multiplier;
    if (/^\(.+\)$/.test(text)) {
      const inner = asNumber(`-${text.slice(1, -1)}`);
      if (inner !== null) return inner;
    }
    return null;
  }

  return null;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function clampScore(value: number) {
  return Math.round(clamp(value));
}

function round(value: number, decimals = 2) {
  return Number(value.toFixed(decimals));
}

function interpolate(value: number, inputMin: number, inputMax: number, outputMin: number, outputMax: number) {
  if (value <= inputMin) return outputMin;
  if (value >= inputMax) return outputMax;
  const ratio = (value - inputMin) / (inputMax - inputMin);
  return outputMin + (outputMax - outputMin) * ratio;
}

function interpolateBreakpoints(value: number, points: Array<[number, number]>) {
  if (value <= points[0][0]) return points[0][1];
  for (let index = 1; index < points.length; index += 1) {
    const [x, y] = points[index];
    const [previousX, previousY] = points[index - 1];
    if (value <= x) return interpolate(value, previousX, x, previousY, y);
  }
  return points[points.length - 1][1];
}

function validateInput(chain: string, wallet: string) {
  if (!SUPPORTED_CHAINS.has(chain)) throw new Error("Unsupported chain for wallet light analysis.");
  const valid = chain === "sol" ? SOL_WALLET_PATTERN.test(wallet) : EVM_WALLET_PATTERN.test(wallet);
  if (!valid) throw new Error("wallet must be a valid address for the requested chain.");
}

function ratioToPercent(value: unknown) {
  const numeric = asNumber(value);
  if (numeric === null) return null;
  return Math.abs(numeric) <= 1 ? round(numeric * 100) : round(numeric);
}

function firstNumber(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = asNumber(record[key]);
    if (value !== null) return value;
  }

  return null;
}

function firstPercent(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = ratioToPercent(record[key]);
    if (value !== null) return value;
  }

  return null;
}

function collectRecords(value: unknown, records: UnknownRecord[] = []) {
  if (typeof value === "string") {
    records.push(parseTextStatsRecord(value));
    return records;
  }

  if (isRecord(value)) {
    records.push(value);
    for (const nested of Object.values(value)) collectRecords(nested, records);
  } else if (Array.isArray(value)) {
    for (const item of value) collectRecords(item, records);
  }

  return records;
}

function firstRegexNumber(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const value = asNumber(match[1]);
      if (value !== null) return value;
    }
  }

  return null;
}

function firstRegexPercent(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const value = ratioToPercent(match[1]);
      if (value !== null) return value;
    }
  }

  return null;
}

function firstRegexDuration(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const value = parseDurationSeconds(match[1]);
      if (value !== null) return value;
    }
  }

  return null;
}

function parseDistributionLine(text: string, patterns: RegExp[]) {
  const line = text
    .split(/\r?\n/)
    .map((row) => row.trim())
    .find((row) => patterns.some((pattern) => pattern.test(row)));
  if (!line) return { count: null, percent: null };

  const percentMatches = Array.from(line.matchAll(/([+-]?\d+(?:[.,]\d+)?)\s*%/g));
  const percent = percentMatches.length > 1
    ? ratioToPercent(percentMatches[percentMatches.length - 1][1])
    : null;
  const withoutBucketLabel = patterns.reduce((row, pattern) => row.replace(pattern, ""), line);
  const countMatch = withoutBucketLabel.match(/(?:^|\s)(\d+)(?=\s|$)(?!\s*%)/);

  return {
    count: countMatch ? asNumber(countMatch[1]) : null,
    percent,
  };
}

function parseTextDistribution(text: string): GmgnWalletPnlStats["distribution"] {
  return {
    gt500: parseDistributionLine(text, [/>\s*500\s*%/i]),
    p200to500: parseDistributionLine(text, [/200\s*%\s*(?:~|-|to)\s*500\s*%/i]),
    p0to200: parseDistributionLine(text, [/0\s*%\s*(?:~|-|to)\s*200\s*%/i]),
    n50to0: parseDistributionLine(text, [/-50\s*%\s*(?:~|-|to)\s*0\s*%/i]),
    ltMinus50: parseDistributionLine(text, [/<\s*-?50\s*%/i]),
  };
}

function parseTextStatsRecord(text: string): UnknownRecord {
  const normalized = text.replace(/\u001b\[[0-9;]*m/g, "");
  return {
    realized_pnl_percent: firstRegexPercent(normalized, [
      /realized\s+pnl\s*(?:%|percent|rate)?[^\n:+-]*[:\s]+([+-]?\d+(?:[.,]\d+)?)\s*%/i,
      /realized\s+profit\s*(?:%|percent|rate)?[^\n:+-]*[:\s]+([+-]?\d+(?:[.,]\d+)?)\s*%/i,
    ]),
    realized_pnl_usd: firstRegexNumber(normalized, [
      /realized\s+pnl[^\n$+-]*([+-]?\$?\d[\d,]*(?:\.\d+)?\s*[kmb]?)/i,
      /realized\s+profit[^\n$+-]*([+-]?\$?\d[\d,]*(?:\.\d+)?\s*[kmb]?)/i,
    ]),
    total_pnl_usd: firstRegexNumber(normalized, [
      /total\s+pnl[^\n$+-]*([+-]?\$?\d[\d,]*(?:\.\d+)?\s*[kmb]?)/i,
      /total\s+profit[^\n$+-]*([+-]?\$?\d[\d,]*(?:\.\d+)?\s*[kmb]?)/i,
    ]),
    unrealized_pnl_usd: firstRegexNumber(normalized, [
      /unrealized\s+pnl[^\n$+-]*([+-]?\$?\d[\d,]*(?:\.\d+)?\s*[kmb]?)/i,
      /unrealized\s+profit[^\n$+-]*([+-]?\$?\d[\d,]*(?:\.\d+)?\s*[kmb]?)/i,
    ]),
    win_rate: firstRegexPercent(normalized, [/win\s*rate[^\n\d+-]*([+-]?\d+(?:[.,]\d+)?)\s*%/i]),
    total_tx_count: firstRegexNumber(normalized, [/total\s+tx(?:\s+count)?[^\n\d]*(\d+)/i, /tx\s+count[^\n\d]*(\d+)/i]),
    buy_tx_count: firstRegexNumber(normalized, [/buy\s+tx(?:\s+count)?[^\n\d]*(\d+)/i, /\bbuy(?:s)?\b[^\n\d]*(\d+)/i]),
    sell_tx_count: firstRegexNumber(normalized, [/sell\s+tx(?:\s+count)?[^\n\d]*(\d+)/i, /\bsell(?:s)?\b[^\n\d]*(\d+)/i]),
    token_count: firstRegexNumber(normalized, [/token\s+count[^\n\d]*(\d+)/i, /tokens[^\n\d]*(\d+)/i]),
    cost_usd: firstRegexNumber(normalized, [/\bcost\b[^\n$+-]*([+-]?\$?\d[\d,]*(?:\.\d+)?\s*[kmb]?)/i, /total\s+spent[^\n$+-]*([+-]?\$?\d[\d,]*(?:\.\d+)?\s*[kmb]?)/i]),
    volume_usd: firstRegexNumber(normalized, [/volume[^\n$+-]*([+-]?\$?\d[\d,]*(?:\.\d+)?\s*[kmb]?)/i]),
    fees_usd: firstRegexNumber(normalized, [/fees?[^\n$+-]*([+-]?\$?\d[\d,]*(?:\.\d+)?\s*[kmb]?)/i]),
    avg_duration: firstRegexDuration(normalized, [/avg(?:erage)?\s+duration[^\n\d]*([0-9dhms\s.]+)/i, /avg(?:erage)?\s+hold[^\n\d]*([0-9dhms\s.]+)/i]),
    distribution: parseTextDistribution(normalized),
  };
}

function bestRecord(raw: unknown) {
  const records = collectRecords(raw);
  return (
    records.find((record) =>
      [
        "data",
        "realized_pnl",
        "realizedPnl",
        "realized_profit",
        "realized_profit_30d",
        "realized_pnl_30d",
        "win_rate",
        "winRate",
        "winrate",
        "total_pnl",
        "pnl",
        "pnl_30d",
        "distribution",
        "pnl_distribution",
      ].some((key) => record[key] !== undefined)
    ) ??
    records[0] ??
    {}
  );
}

function parseDurationSeconds(value: unknown): number | null {
  const numeric = asNumber(value);
  if (numeric !== null) return numeric;
  const text = asString(value)?.toLowerCase();
  if (!text) return null;

  const matches = Array.from(text.matchAll(/([0-9]+(?:\.[0-9]+)?)\s*(d|day|days|h|hr|hrs|hour|hours|m|min|mins|minute|minutes|s|sec|secs|second|seconds)/g));
  if (matches.length === 0) return null;

  return matches.reduce((total, match) => {
    const amount = Number(match[1]);
    const unit = match[2];
    if (!Number.isFinite(amount)) return total;
    if (unit.startsWith("d")) return total + amount * 86_400;
    if (unit.startsWith("h")) return total + amount * 3_600;
    if (unit.startsWith("m")) return total + amount * 60;
    return total + amount;
  }, 0);
}

function emptyDistribution(): GmgnWalletPnlStats["distribution"] {
  return {
    gt500: { count: null, percent: null },
    p200to500: { count: null, percent: null },
    p0to200: { count: null, percent: null },
    n50to0: { count: null, percent: null },
    ltMinus50: { count: null, percent: null },
  };
}

function findDistributionRecord(raw: unknown) {
  return collectRecords(raw).find((record) =>
    Object.keys(record).some((key) =>
      /500|200|0_?to_?200|minus|loss|profit.*distribution|distribution|pnl.*ratio|pnl.*count/i.test(key)
    )
  );
}

function bucket(record: UnknownRecord, percentKeys: string[], countKeys: string[]) {
  return {
    count: firstNumber(record, countKeys),
    percent: firstPercent(record, percentKeys),
  };
}

function normalizeDistribution(raw: unknown): GmgnWalletPnlStats["distribution"] {
  if (typeof raw === "string") return parseTextDistribution(raw);

  const record = findDistributionRecord(raw);
  if (!record) return emptyDistribution();
  if (isRecord(record.distribution)) {
    return {
      gt500: bucket(record.distribution, [">500%", "gt500", "gt_500", "pnl_gt_500", "profit_gt_500", "percent"], ["gt500_count", "pnl_gt_500_count", "count"]),
      p200to500: bucket(record.distribution, ["200%-500%", "p200to500", "p200_500", "pnl_200_500", "profit_200_500", "percent"], ["p200to500_count", "pnl_200_500_count", "count"]),
      p0to200: bucket(record.distribution, ["0%-200%", "p0to200", "p0_200", "pnl_0_200", "profit_0_200", "percent"], ["p0to200_count", "pnl_0_200_count", "count"]),
      n50to0: bucket(record.distribution, ["-50%-0%", "n50to0", "n50_0", "pnl_minus_50_0", "percent"], ["n50to0_count", "pnl_minus_50_0_count", "count"]),
      ltMinus50: bucket(record.distribution, ["<-50%", "ltMinus50", "lt_minus_50", "pnl_lt_minus_50", "percent"], ["lt_minus_50_count", "pnl_lt_minus_50_count", "count"]),
    };
  }

  return {
    gt500: bucket(record, [">500%", "gt500", "gt_500", "pnl_gt_500", "profit_gt_500", "pnl_500p", "more_than_500_percent", "pnl_gt_500_percent", "profit_500_ratio"], ["gt500_count", "pnl_gt_500_count", "profit_500_count"]),
    p200to500: bucket(record, ["200%-500%", "p200to500", "p200_500", "pnl_200_500", "profit_200_500", "pnl_200_500_percent", "profit_200_500_ratio"], ["p200to500_count", "pnl_200_500_count", "profit_200_500_count"]),
    p0to200: bucket(record, ["0%-200%", "p0to200", "p0_200", "pnl_0_200", "profit_0_200", "pnl_0_200_percent", "profit_0_200_ratio"], ["p0to200_count", "pnl_0_200_count", "profit_0_200_count"]),
    n50to0: bucket(record, ["-50%-0%", "n50to0", "n50_0", "pnl_minus_50_0", "loss_50_0", "pnl_n50_0", "pnl_-50_0_percent", "loss_50_0_ratio"], ["n50to0_count", "pnl_minus_50_0_count", "loss_50_0_count"]),
    ltMinus50: bucket(record, ["<-50%", "ltMinus50", "lt_minus_50", "pnl_lt_minus_50", "loss_gt_50", "pnl_lt_50", "pnl_lt_-50_percent", "loss_gt_50_ratio"], ["lt_minus_50_count", "pnl_lt_minus_50_count", "loss_gt_50_count"]),
  };
}

function normalizeGmgnWalletPnlStats({
  wallet,
  chain,
  period,
  raw,
  sourceCommand,
  includeRaw,
}: {
  wallet: string;
  chain: string;
  period: Period;
  raw: unknown;
  sourceCommand: string;
  includeRaw: boolean;
}): GmgnWalletPnlStats {
  const record = bestRecord(raw);
  const costUsd = firstNumber(record, ["cost", "cost_usd", "costUsd", "total_cost", "total_cost_usd", "total_buy_usd", "totalSpentUsd", "total_spent_usd", "total_spent"]);
  const realizedPnlUsd = firstNumber(record, ["realized_pnl_usd", "realizedPnlUsd", "realized_pnl", "realized_profit_usd", "realized_profit", "realized_profit_30d", "realized_pnl_30d"]);
  const totalPnlUsd = firstNumber(record, ["total_pnl_usd", "totalPnlUsd", "total_pnl", "pnl_usd", "profit_usd", "profit", "total_profit", "pnl_30d"]);
  const totalSpentUsd = firstNumber(record, ["total_spent_usd", "totalSpentUsd", "total_spent", "cost", "cost_usd", "total_cost", "total_cost_usd", "total_buy_usd"]);
  const buyTxCount = firstNumber(record, ["buy_tx_count", "buyTxCount", "buy_count", "buyCount", "buy_trades", "buy", "buy_num"]);
  const sellTxCount = firstNumber(record, ["sell_tx_count", "sellTxCount", "sell_count", "sellCount", "sell_trades", "sell", "sell_num"]);
  const rawRealizedPnlPercent = firstPercent(record, ["realized_pnl_percent", "realizedPnlPercent", "realized_pnl_percentage", "realized_profit_percent", "realized_profit_rate", "pnl_percent", "pnl_rate", "realized_profit_rate_30d", "realized_pnl_rate_30d"]);
  const realizedPnlPercentFromUsd =
    rawRealizedPnlPercent === null &&
    realizedPnlUsd !== null &&
    totalSpentUsd !== null &&
    totalSpentUsd > 0;
  const realizedPnlPercent = realizedPnlPercentFromUsd
    ? round((realizedPnlUsd / totalSpentUsd) * 100)
    : rawRealizedPnlPercent;
  const rawTotalTxCount = firstNumber(record, ["total_tx_count", "totalTxCount", "tx_count", "txCount", "total_trades", "trade_count", "tradeCount", "txs", "total_tx_num"]);
  const totalTxCountFromBuySell = rawTotalTxCount === null && buyTxCount !== null && sellTxCount !== null;
  const totalTxCount = totalTxCountFromBuySell ? buyTxCount + sellTxCount : rawTotalTxCount;
  const rawPnlMultiplier = firstNumber(record, ["pnl_multiplier", "pnlMultiplier", "realized_multiple", "realizedMultiple", "multiple", "profit_multiplier"]);
  const pnlMultiplierFromPnlPercent = rawPnlMultiplier === null && realizedPnlPercent !== null;
  const pnlMultiplier = pnlMultiplierFromPnlPercent ? round(1 + realizedPnlPercent / 100, 6) : rawPnlMultiplier;
  const distribution = normalizeDistribution(raw);
  const statsWithoutMissing = {
    realizedPnlPercent,
    realizedPnlUsd,
    totalPnlUsd,
    winRatePercent: firstPercent(record, ["win_rate", "winRate", "winrate", "realized_win_rate", "pnl_win_rate", "profit_token_rate", "profitTokenRate"]),
    pnlMultiplier,
    totalSpentUsd,
    costUsd,
    totalTxCount,
    buyTxCount,
    sellTxCount,
    tokenCount: firstNumber(record, ["token_count", "tokenCount", "tokens", "token_num", "total_tokens", "token_num_30d", "pnl_token_num"]),
    avgDurationSeconds: parseDurationSeconds(record.avg_duration ?? record.avgDuration ?? record.avg_holding_duration ?? record.avg_hold_time ?? record.avgHoldTime),
    distribution,
  };
  const missingFields = [
    ["realizedPnlPercent", statsWithoutMissing.realizedPnlPercent],
    ["realizedPnlUsd", realizedPnlUsd],
    ["totalPnlUsd", totalPnlUsd],
    ["winRatePercent", statsWithoutMissing.winRatePercent],
    ["pnlMultiplier", pnlMultiplier],
    ["totalSpentUsd", totalSpentUsd],
    ["costUsd", costUsd],
    ["totalTxCount", totalTxCount],
    ["buyTxCount", buyTxCount],
    ["sellTxCount", sellTxCount],
    ["tokenCount", statsWithoutMissing.tokenCount],
    ["avgDurationSeconds", statsWithoutMissing.avgDurationSeconds],
    ["distribution", distributionCompleteness(distribution) >= 70 ? 1 : null],
  ]
    .filter(([, value]) => value === null)
    .map(([key]) => String(key));

  return {
    wallet,
    chain,
    period,
    realizedPnlPercent,
    realizedPnlUsd,
    totalPnlUsd,
    unrealizedPnlUsd: firstNumber(record, ["unrealized_pnl_usd", "unrealizedPnlUsd", "unrealized_pnl", "unrealized_profit_usd", "unrealized_profit"]),
    winRatePercent: statsWithoutMissing.winRatePercent,
    pnlMultiplier,
    totalSpentUsd,
    totalTxCount,
    buyTxCount,
    sellTxCount,
    tokenCount: statsWithoutMissing.tokenCount,
    avgDurationSeconds: statsWithoutMissing.avgDurationSeconds,
    costUsd,
    avgCostUsd: firstNumber(record, ["avg_cost", "avgCost", "avg_cost_usd", "avgCostUsd", "average_cost"]),
    avgSoldUsd: firstNumber(record, ["avg_sold", "avgSold", "avg_sold_usd", "avgSoldUsd", "average_sold"]),
    avgRealizedProfitUsd: firstNumber(record, ["avg_realized_profit", "avgRealizedProfit", "avg_realized_profit_usd", "avgRealizedProfitUsd"]),
    feesUsd: firstNumber(record, ["fees", "fees_usd", "fee_usd", "total_fees", "total_fees_usd"]),
    volumeUsd: firstNumber(record, ["volume", "volume_usd", "volumeUsd", "total_volume", "total_volume_usd"]),
    distribution,
    sourceAvailable: true,
    sourceCommand,
    derived: {
      realizedPnlPercentFromUsd,
      totalTxCountFromBuySell,
      pnlMultiplierFromPnlPercent,
    },
    missingFields,
    ...(includeRaw ? { raw } : {}),
  };
}

function distributionCompleteness(distribution: GmgnWalletPnlStats["distribution"]) {
  const buckets = Object.values(distribution);
  const present = buckets.filter((bucketValue) => bucketValue.percent !== null || bucketValue.count !== null).length;
  if (present === 5) return 100;
  if (present >= 2) return 70;
  return 35;
}

function distributionAvailable(stats: GmgnWalletPnlStats) {
  return distributionCompleteness(stats.distribution) >= 70;
}

function distributionPercents(stats: GmgnWalletPnlStats) {
  const distribution = stats.distribution;
  const buckets = Object.values(distribution);
  const hasPercents = buckets.some((bucketValue) => bucketValue.percent !== null);
  const totalCount = buckets.reduce((total, bucketValue) => total + (bucketValue.count ?? 0), 0);
  const percentFor = (bucketValue: { count: number | null; percent: number | null }) => {
    if (bucketValue.percent !== null) return bucketValue.percent;
    if (!hasPercents && totalCount > 0 && bucketValue.count !== null) return (bucketValue.count / totalCount) * 100;
    return 0;
  };

  return {
    gt500: percentFor(distribution.gt500),
    p200to500: percentFor(distribution.p200to500),
    p0to200: percentFor(distribution.p0to200),
    n50to0: percentFor(distribution.n50to0),
    ltMinus50: percentFor(distribution.ltMinus50),
  };
}

function dataCompletenessQuality(stats: GmgnWalletPnlStats) {
  const fieldScores = [
    stats.realizedPnlPercent === null ? 0 : stats.derived.realizedPnlPercentFromUsd ? 0.6 : 1,
    stats.realizedPnlUsd !== null ? 1 : 0,
    stats.totalSpentUsd !== null || stats.costUsd !== null ? 1 : 0,
    stats.winRatePercent !== null ? 1 : 0,
    stats.totalTxCount === null ? 0 : stats.derived.totalTxCountFromBuySell ? 0.75 : 1,
    stats.tokenCount !== null ? 1 : 0,
    distributionAvailable(stats) ? 1 : 0,
    stats.avgDurationSeconds !== null ? 1 : 0,
    stats.pnlMultiplier === null ? 0 : stats.derived.pnlMultiplierFromPnlPercent ? 0.4 : 1,
  ];
  return round((fieldScores.reduce((total, value) => total + value, 0) / fieldScores.length) * 100);
}

function distributionQuality(stats: GmgnWalletPnlStats) {
  if (!distributionAvailable(stats)) return null;

  const distribution = distributionPercents(stats);
  const bigWinnerPercent = distribution.gt500 + distribution.p200to500;
  const solidWinnerPercent = distribution.p0to200;
  const smallLossPercent = distribution.n50to0;
  const bigLossPercent = distribution.ltMinus50;

  return clampScore(
    50 +
      bigWinnerPercent * 0.55 +
      solidWinnerPercent * 0.2 -
      smallLossPercent * 0.35 -
      bigLossPercent * 0.9
  );
}

function pnlEfficiencyQuality(stats: GmgnWalletPnlStats) {
  const pnlPercent = stats.realizedPnlPercent ?? (stats.pnlMultiplier !== null ? (stats.pnlMultiplier - 1) * 100 : null);
  if (pnlPercent === null) return 50;

  return clampScore(
    interpolateBreakpoints(pnlPercent, [
      [-70, 5],
      [-40, 20],
      [-20, 35],
      [0, 48],
      [20, 58],
      [50, 70],
      [100, 82],
      [250, 92],
      [400, 100],
    ])
  );
}

function winRateQuality(stats: GmgnWalletPnlStats) {
  const winRate = stats.winRatePercent;
  let score: number;

  if (winRate === null) score = 50;
  else score = interpolateBreakpoints(winRate, [
    [25, 15],
    [30, 30],
    [40, 45],
    [50, 58],
    [60, 72],
    [70, 85],
    [80, 95],
  ]);
  return clampScore(score);
}

function tradeDepthQuality(stats: GmgnWalletPnlStats) {
  const tokenCount = stats.tokenCount;
  const txCount = stats.totalTxCount;
  let score = txCount === null ? 50 : interpolateBreakpoints(txCount, [
    [2, 15],
    [5, 25],
    [15, 40],
    [40, 55],
    [100, 70],
    [250, 82],
    [500, 90],
  ]);

  if (tokenCount !== null && tokenCount <= 2 && (txCount ?? 0) > 40) score = Math.min(score, 55);
  return clampScore(score);
}

function riskControlQuality(stats: GmgnWalletPnlStats) {
  let score = 55;
  const pnl = stats.realizedPnlPercent;
  const distribution = distributionPercents(stats);

  if (pnl !== null && pnl < -50) score -= 35;
  else if (pnl !== null && pnl < -25) score -= 22;
  else if (pnl !== null && pnl < -10) score -= 12;
  else if (pnl !== null && pnl >= 50) score += 14;
  else if (pnl !== null && pnl >= 20) score += 8;

  if (distributionAvailable(stats)) {
    if (distribution.ltMinus50 >= 30) score -= 30;
    else if (distribution.ltMinus50 >= 20) score -= 20;
    else if (distribution.ltMinus50 >= 10) score -= 10;
  }

  const txCount = stats.totalTxCount;
  const buyTxCount = stats.buyTxCount;
  const sellTxCount = stats.sellTxCount;
  if (buyTxCount !== null && sellTxCount !== null && txCount !== null && txCount >= 20) {
    const sellRatio = sellTxCount / Math.max(1, txCount);
    if (sellRatio < 0.2) score -= 8;
    if (sellRatio > 0.85) score -= 5;
  }
  return clampScore(score);
}

function activityQuality(stats: GmgnWalletPnlStats) {
  const txCount = stats.totalTxCount;
  const buyTxCount = stats.buyTxCount;
  const sellTxCount = stats.sellTxCount;
  let score = txCount === null ? 50 : interpolateBreakpoints(txCount, [
    [2, 20],
    [10, 40],
    [50, 55],
    [150, 65],
    [300, 70],
  ]);

  if (buyTxCount !== null && sellTxCount !== null && Math.max(buyTxCount, sellTxCount) > 0) {
    const balanceRatio = Math.min(buyTxCount, sellTxCount) / Math.max(buyTxCount, sellTxCount);
    if (balanceRatio >= 0.45) score += 8;
    else if (balanceRatio >= 0.25) score += 2;
    else score -= 8;
  }
  return clampScore(score);
}

function lightConfidenceScore(stats: GmgnWalletPnlStats, dataScore: number) {
  return clampScore(dataScore);
}

function lightConfidenceLevel(stats: GmgnWalletPnlStats, confidenceScore: number): ConfidenceLevel {
  if (
    confidenceScore >= 70 &&
    distributionAvailable(stats) &&
    stats.winRatePercent !== null &&
    stats.realizedPnlPercent !== null
  ) {
    return "high";
  }
  if (confidenceScore >= 70) return "medium";
  if (confidenceScore >= 45) return "low";
  return "low";
}

function rawMetricsFromStats(stats: GmgnWalletPnlStats): WalletAlphaLight["rawMetrics"] {
  return {
    realizedPnlPercent: stats.realizedPnlPercent,
    winRate: stats.winRatePercent,
    realizedPnlUsd: stats.realizedPnlUsd,
    totalPnlUsd: stats.totalPnlUsd,
    pnlMultiplier: stats.pnlMultiplier,
    totalSpentUsd: stats.totalSpentUsd,
    tradeCount: stats.totalTxCount,
    tokenCount: stats.tokenCount,
    buyCount: stats.buyTxCount,
    sellCount: stats.sellTxCount,
    avgHoldSeconds: stats.avgDurationSeconds,
    period: stats.period,
  };
}

function computeLightScore(stats: GmgnWalletPnlStats): WalletAlphaLight {
  const distributionScore = distributionQuality(stats);
  const distributionIsAvailable = distributionScore !== null;
  const pnlScore = pnlEfficiencyQuality(stats);
  const winRateScore = winRateQuality(stats);
  const tradeDepthScore = tradeDepthQuality(stats);
  const riskScore = riskControlQuality(stats);
  const activityScore = activityQuality(stats);
  const dataScore = dataCompletenessQuality(stats);
  const rawLightScore = distributionIsAvailable
    ? pnlScore * 0.3 +
      distributionScore * 0.2 +
      winRateScore * 0.17 +
      tradeDepthScore * 0.13 +
      riskScore * 0.1 +
      activityScore * 0.06 +
      dataScore * 0.04
    : pnlScore * 0.42 +
      winRateScore * 0.17 +
      tradeDepthScore * 0.18 +
      riskScore * 0.13 +
      activityScore * 0.06 +
      dataScore * 0.04;
  const confidenceScore = lightConfidenceScore(stats, dataScore);
  const confidenceLevel = lightConfidenceLevel(stats, confidenceScore);
  const walletAlphaLight = clampScore(
    confidenceLevel === "low"
      ? 50 + (rawLightScore - 50) * 0.75
      : rawLightScore
  );
  const formulaUsed = distributionIsAvailable ? LIGHT_FORMULA_WITH_DISTRIBUTION : LIGHT_FORMULA_NO_DISTRIBUTION;

  return {
    wallet: stats.wallet,
    chain: stats.chain,
    isFallback: false,
    sourceAvailable: true,
    sourceCommand: stats.sourceCommand,
    walletAlphaLight,
    confidenceLevel,
    rawMetrics: rawMetricsFromStats(stats),
    pnlStats: stats,
    scoreBreakdown: {
      pnlEfficiencyQuality: pnlScore,
      distributionQuality: distributionScore ?? 0,
      winRateQuality: winRateScore,
      tradeDepthQuality: tradeDepthScore,
      riskControlQuality: riskScore,
      activityQuality: activityScore,
      dataCompletenessQuality: dataScore,
      lightConfidenceScore: confidenceScore,
      sourceCompleteness: dataScore,
      distributionCompleteness: distributionCompleteness(stats.distribution),
      distributionAvailable: distributionIsAvailable,
      winRateAvailable: stats.winRatePercent !== null,
      realizedPnlPercentDerived: stats.derived.realizedPnlPercentFromUsd,
      formula: formulaUsed,
      formulaUsed,
      normalizedPnlStats: stats,
      source: "gmgn-portfolio-stats-light",
    },
    warnings: [],
    explanations: [
      "Light Wallet Alpha uses normalized GMGN portfolio stats, not historical Entry/Exit V3.",
      `Light score is ${walletAlphaLight}/100 using ${distributionIsAvailable ? "portfolio distribution" : "the no-distribution formula"}.`,
    ],
  };
}

async function runGmgnCli(args: string[]) {
  if (IS_VERCEL_RUNTIME) {
    throw new Error("gmgn-cli execution is disabled in Vercel serverless runtime.");
  }

  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);
  const env = {
    ...process.env,
    GMGN_API_KEY: process.env.GMGN_API_KEY,
  };
  const execOptions = {
    env,
    maxBuffer: 1024 * 1024 * 5,
    timeout: 30_000,
    windowsHide: true,
  };
  const { stdout } =
    process.platform === "win32"
      ? await execFileAsync("cmd.exe", ["/d", "/c", ["gmgn-cli", ...args].join(" ")], execOptions)
      : await execFileAsync("gmgn-cli", args, execOptions);

  try {
    return JSON.parse(stdout) as unknown;
  } catch {
    throw new Error("GMGN portfolio stats command returned non-JSON output.");
  }
}

function gmgnAuthHeaders() {
  const apiKey = process.env.GMGN_API_KEY || "";
  const headers: HeadersInit = {
    accept: "application/json",
  };

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
    headers["X-API-KEY"] = apiKey;
    headers["x-api-key"] = apiKey;
  }

  return headers;
}

function gmgnApiBaseCandidates() {
  const configured = process.env.GMGN_API_BASE?.trim();
  return Array.from(new Set([
    configured || "",
    DEFAULT_GMGN_API_BASE,
    "https://api.gmgn.ai",
  ].filter(Boolean))).map((base) => base.replace(/\/+$/, ""));
}

function candidateUrl(base: string, path: string, params: Record<string, string | number | undefined>) {
  const url = new URL(path, `${base}/`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  return url;
}

function sanitizeProviderError(message: string) {
  return message
    .replace(process.env.GMGN_API_KEY || "__NO_KEY__", "[redacted]")
    .replace(/https?:\/\/[^\s)]+/g, (url) => {
      try {
        const parsed = new URL(url);
        return `${parsed.origin}${parsed.pathname}`;
      } catch {
        return "[url]";
      }
    })
    .slice(0, 360);
}

async function fetchJsonCandidates({
  candidates,
  source,
}: {
  candidates: URL[];
  source: string;
}) {
  const failures: string[] = [];

  for (const url of candidates) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);

    try {
      const response = await fetch(url.toString(), {
        headers: gmgnAuthHeaders(),
        cache: "no-store",
        signal: controller.signal,
      });
      const text = await response.text();
      let data: unknown = null;

      if (text.trim()) {
        try {
          data = JSON.parse(text);
        } catch {
          failures.push(`${url.pathname}: non-json response`);
          continue;
        }
      }

      if (!response.ok) {
        failures.push(`${url.pathname}: HTTP ${response.status}`);
        continue;
      }

      return data;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown error";
      failures.push(`${url.pathname}: ${reason}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(`${source} unavailable via direct GMGN HTTP. ${sanitizeProviderError(failures.join("; "))}`);
}

async function fetchGmgnWalletPnlStatsDirect({
  chain,
  wallet,
  period,
}: {
  chain: string;
  wallet: string;
  period: Period;
}) {
  const candidates = gmgnApiBaseCandidates().flatMap((base) => [
    candidateUrl(base, `/defi/quotation/v1/wallet/portfolio_stats/${chain}/${wallet}`, { period }),
    candidateUrl(base, `/defi/quotation/v1/wallet/portfolio/stats/${chain}/${wallet}`, { period }),
    candidateUrl(base, `/defi/quotation/v1/wallet/${chain}/${wallet}/portfolio_stats`, { period }),
    candidateUrl(base, `/api/v1/wallet/portfolio_stats/${chain}/${wallet}`, { period }),
  ]);

  return fetchJsonCandidates({ candidates, source: "GMGN portfolio stats" });
}

function statsLooksUsable(stats: GmgnWalletPnlStats) {
  return Boolean(
    stats.winRatePercent !== null ||
      stats.realizedPnlPercent !== null ||
      stats.realizedPnlUsd !== null ||
      stats.totalPnlUsd !== null ||
      stats.totalTxCount !== null ||
      stats.tokenCount !== null ||
      distributionCompleteness(stats.distribution) >= 70
  );
}

async function fetchGmgnWalletPnlStats({
  chain,
  wallet,
  period,
  includeRaw,
}: {
  chain: string;
  wallet: string;
  period: Period;
  includeRaw: boolean;
}) {
  const failures: string[] = [];
  const periods: Period[] = period === "30d" ? ["30d", "7d"] : [period, "30d"];

  for (const candidatePeriod of Array.from(new Set(periods))) {
    const args = ["portfolio", "stats", "--chain", chain, "--wallet", wallet, "--period", candidatePeriod];

    try {
      const useDirect = IS_VERCEL_RUNTIME || process.env.GMGN_DIRECT_HTTP === "true";
      const raw = useDirect
        ? await fetchGmgnWalletPnlStatsDirect({ chain, wallet, period: candidatePeriod })
        : await runGmgnCli(args).catch((error) => {
            if (process.env.GMGN_CLI_ONLY === "true") throw error;
            return fetchGmgnWalletPnlStatsDirect({ chain, wallet, period: candidatePeriod });
          });
      const sourceCommand = useDirect
        ? `gmgn-direct portfolio stats ${chain}/${wallet} ${candidatePeriod}`
        : `gmgn-cli ${args.join(" ")}`;
      const stats = normalizeGmgnWalletPnlStats({
        wallet,
        chain,
        period: candidatePeriod,
        raw,
        sourceCommand,
        includeRaw,
      });
      if (statsLooksUsable(stats)) return stats;
      failures.push(`${sourceCommand}: response did not include usable PnL fields`);
    } catch (error) {
      const source = IS_VERCEL_RUNTIME || process.env.GMGN_DIRECT_HTTP === "true"
        ? "gmgn-direct portfolio stats"
        : `gmgn-cli ${args.join(" ")}`;
      failures.push(`${source}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  throw new Error(`GMGN portfolio stats unavailable. Tried ${failures.length} period(s).`);
}

export async function fetchWalletAlphaLight(
  chain: string,
  wallet: string,
  options: WalletAlphaLightOptions = {}
) {
  validateInput(chain, wallet);
  const stats = await fetchGmgnWalletPnlStats({
    chain,
    wallet,
    period: options.period ?? "30d",
    includeRaw: Boolean(options.includeRaw),
  });

  return computeLightScore(stats);
}

export const computeWalletAlphaLight = fetchWalletAlphaLight;

export function neutralWalletAlphaLightFallback({
  chain,
  wallet,
  reason,
  period = "30d",
}: {
  chain: string;
  wallet: string;
  reason: string;
  period?: Period;
}): WalletAlphaLight {
  const stats: GmgnWalletPnlStats = {
    wallet,
    chain,
    period,
    realizedPnlPercent: null,
    realizedPnlUsd: null,
    totalPnlUsd: null,
    unrealizedPnlUsd: null,
    winRatePercent: null,
    pnlMultiplier: null,
    totalSpentUsd: null,
    totalTxCount: null,
    buyTxCount: null,
    sellTxCount: null,
    tokenCount: null,
    avgDurationSeconds: null,
    costUsd: null,
    avgCostUsd: null,
    avgSoldUsd: null,
    avgRealizedProfitUsd: null,
    feesUsd: null,
    volumeUsd: null,
    distribution: emptyDistribution(),
    sourceAvailable: false,
    sourceCommand: null,
    derived: {
      realizedPnlPercentFromUsd: false,
      totalTxCountFromBuySell: false,
      pnlMultiplierFromPnlPercent: false,
    },
    missingFields: [
      "realizedPnlPercent",
      "realizedPnlUsd",
      "totalPnlUsd",
      "winRatePercent",
      "pnlMultiplier",
      "totalSpentUsd",
      "costUsd",
      "totalTxCount",
      "buyTxCount",
      "sellTxCount",
      "tokenCount",
      "avgDurationSeconds",
      "distribution",
    ],
  };

  return {
    wallet,
    chain,
    isFallback: true,
    sourceAvailable: false,
    sourceCommand: null,
    walletAlphaLight: 50,
    confidenceLevel: "low",
    rawMetrics: rawMetricsFromStats(stats),
    pnlStats: stats,
    scoreBreakdown: {
      pnlEfficiencyQuality: 50,
      distributionQuality: 50,
      winRateQuality: 50,
      tradeDepthQuality: 50,
      riskControlQuality: 50,
      activityQuality: 50,
      dataCompletenessQuality: 0,
      lightConfidenceScore: 0,
      sourceCompleteness: 0,
      distributionCompleteness: 0,
      distributionAvailable: false,
      winRateAvailable: false,
      realizedPnlPercentDerived: false,
      formula: LIGHT_FORMULA_NO_DISTRIBUTION,
      formulaUsed: LIGHT_FORMULA_NO_DISTRIBUTION,
      normalizedPnlStats: stats,
      source: "wallet-alpha-light-fallback",
    },
    warnings: [
      "GMGN portfolio stats unavailable; light score is neutral fallback, not real wallet alpha.",
      reason,
    ],
    explanations: [
      "Light Wallet Alpha returned neutral because GMGN portfolio stats were unavailable for this wallet.",
    ],
  };
}
