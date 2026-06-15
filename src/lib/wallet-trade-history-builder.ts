import type { WalletTrade } from "@/lib/novaos-data-layer";

export type CompletedTradeResult = "win" | "loss" | "breakeven";
export type WalletEvolutionTrend = "improving" | "stable" | "deteriorating";

export type CompletedTrade = {
  tokenAddress: string;
  tokenSymbol: string | null;
  firstBuyTimestamp: string;
  lastSellTimestamp: string;
  holdingSeconds: number;
  totalBuyUsd: number;
  totalSellUsd: number;
  realizedPnlUsd: number;
  realizedMultiple: number;
  tradeResult: CompletedTradeResult;
};

export type TradeHistoryMetrics = {
  totalCompletedTrades: number;
  totalWinningTrades: number;
  totalLosingTrades: number;
  avgRealizedMultiple: number | null;
  medianRealizedMultiple: number | null;
  avgWinningMultiple: number | null;
  avgLosingMultiple: number | null;
  avgHoldSeconds: number | null;
  medianHoldSeconds: number | null;
  profitFactor: number | null;
  maxWinnerMultiple: number | null;
  maxLoserMultiple: number | null;
};

export type WalletEvolutionMetrics = {
  last30dWinRate: number | null;
  previous30dWinRate: number | null;
  last30dPnl: number | null;
  previous30dPnl: number | null;
  trendDirection: WalletEvolutionTrend;
};

type BuyLot = {
  timestamp: string;
  costUsd: number;
  tokenSymbol: string | null;
};

function timestampMs(value: string | null) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function safeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4));
}

function median(values: number[]) {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2
    ? Number(sorted[mid].toFixed(4))
    : Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(4));
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function tradeResult(pnl: number): CompletedTradeResult {
  if (pnl > 0) return "win";
  if (pnl < 0) return "loss";
  return "breakeven";
}

function completedTradeFromSell({
  tokenAddress,
  tokenSymbol,
  buyLots,
  sell,
}: {
  tokenAddress: string;
  tokenSymbol: string | null;
  buyLots: BuyLot[];
  sell: WalletTrade;
}) {
  const sellTime = timestampMs(sell.timestamp);
  const sellUsd = safeNumber(sell.costUsd);

  if (sellTime === null || !sell.timestamp || sellUsd === null) return null;

  const eligibleBuys = buyLots.filter((buy) => {
    const buyTime = timestampMs(buy.timestamp);
    return buyTime !== null && buyTime <= sellTime;
  });
  const buyUsdFromLots = sum(eligibleBuys.map((buy) => buy.costUsd));
  const buyCostUsd = safeNumber(sell.buyCostUsd) ?? buyUsdFromLots;

  if (buyCostUsd <= 0) return null;

  const firstBuy = eligibleBuys[0];
  if (!firstBuy) return null;

  const firstBuyTime = timestampMs(firstBuy.timestamp);
  if (firstBuyTime === null) return null;

  const realizedPnlUsd = sellUsd - buyCostUsd;
  const realizedMultiple = sellUsd / buyCostUsd;

  return {
    tokenAddress,
    tokenSymbol: tokenSymbol || sell.tokenSymbol || firstBuy.tokenSymbol,
    firstBuyTimestamp: firstBuy.timestamp,
    lastSellTimestamp: sell.timestamp,
    holdingSeconds: Math.max(0, (sellTime - firstBuyTime) / 1000),
    totalBuyUsd: Number(buyCostUsd.toFixed(4)),
    totalSellUsd: Number(sellUsd.toFixed(4)),
    realizedPnlUsd: Number(realizedPnlUsd.toFixed(4)),
    realizedMultiple: Number(realizedMultiple.toFixed(4)),
    tradeResult: tradeResult(realizedPnlUsd),
  };
}

export function buildCompletedTrades(trades: WalletTrade[]): CompletedTrade[] {
  const grouped = new Map<string, WalletTrade[]>();

  for (const trade of trades) {
    if (!trade.tokenAddress || !trade.timestamp) continue;
    if (trade.eventType !== "buy" && trade.eventType !== "sell") continue;

    grouped.set(trade.tokenAddress, [...(grouped.get(trade.tokenAddress) || []), trade]);
  }

  const completedTrades: CompletedTrade[] = [];

  for (const [tokenAddress, tokenTrades] of grouped.entries()) {
    const sorted = tokenTrades.sort(
      (a, b) => (timestampMs(a.timestamp) || 0) - (timestampMs(b.timestamp) || 0)
    );
    const buyLots: BuyLot[] = [];

    for (const trade of sorted) {
      if (trade.eventType === "buy") {
        const costUsd = safeNumber(trade.costUsd);
        if (costUsd !== null && costUsd > 0 && trade.timestamp) {
          buyLots.push({
            timestamp: trade.timestamp,
            costUsd,
            tokenSymbol: trade.tokenSymbol,
          });
        }
      }

      if (trade.eventType === "sell" && buyLots.length > 0) {
        const completed = completedTradeFromSell({
          tokenAddress,
          tokenSymbol: trade.tokenSymbol,
          buyLots,
          sell: trade,
        });

        if (completed) {
          completedTrades.push(completed);
          buyLots.length = 0;
        }
      }
    }
  }

  return completedTrades.sort(
    (a, b) => Date.parse(a.lastSellTimestamp) - Date.parse(b.lastSellTimestamp)
  );
}

export function buildTradeHistoryMetrics(
  completedTrades: CompletedTrade[]
): TradeHistoryMetrics {
  const wins = completedTrades.filter((trade) => trade.tradeResult === "win");
  const losses = completedTrades.filter((trade) => trade.tradeResult === "loss");
  const multiples = completedTrades.map((trade) => trade.realizedMultiple);
  const holdTimes = completedTrades.map((trade) => trade.holdingSeconds);
  const grossProfit = sum(
    wins.map((trade) => Math.max(0, trade.realizedPnlUsd))
  );
  const grossLoss = Math.abs(
    sum(losses.map((trade) => Math.min(0, trade.realizedPnlUsd)))
  );

  return {
    totalCompletedTrades: completedTrades.length,
    totalWinningTrades: wins.length,
    totalLosingTrades: losses.length,
    avgRealizedMultiple: average(multiples),
    medianRealizedMultiple: median(multiples),
    avgWinningMultiple: average(wins.map((trade) => trade.realizedMultiple)),
    avgLosingMultiple: average(losses.map((trade) => trade.realizedMultiple)),
    avgHoldSeconds: average(holdTimes),
    medianHoldSeconds: median(holdTimes),
    profitFactor:
      grossLoss > 0
        ? Number((grossProfit / grossLoss).toFixed(4))
        : grossProfit > 0
        ? null
        : null,
    maxWinnerMultiple:
      wins.length > 0 ? Number(Math.max(...wins.map((trade) => trade.realizedMultiple)).toFixed(4)) : null,
    maxLoserMultiple:
      losses.length > 0 ? Number(Math.min(...losses.map((trade) => trade.realizedMultiple)).toFixed(4)) : null,
  };
}

function windowStats({
  trades,
  start,
  end,
}: {
  trades: CompletedTrade[];
  start: number;
  end: number;
}) {
  const windowTrades = trades.filter((trade) => {
    const sellTime = Date.parse(trade.lastSellTimestamp);
    return Number.isFinite(sellTime) && sellTime >= start && sellTime < end;
  });
  const wins = windowTrades.filter((trade) => trade.tradeResult === "win").length;
  const losses = windowTrades.filter((trade) => trade.tradeResult === "loss").length;
  const totalComparable = wins + losses;
  const pnl = sum(windowTrades.map((trade) => trade.realizedPnlUsd));

  return {
    winRate:
      totalComparable > 0 ? Number(((wins / totalComparable) * 100).toFixed(2)) : null,
    pnl: windowTrades.length > 0 ? Number(pnl.toFixed(4)) : null,
  };
}

export function buildWalletEvolutionMetrics(
  completedTrades: CompletedTrade[],
  now = Date.now()
): WalletEvolutionMetrics {
  const thirtyDaysMs = 30 * 86_400_000;
  const last30d = windowStats({
    trades: completedTrades,
    start: now - thirtyDaysMs,
    end: now,
  });
  const previous30d = windowStats({
    trades: completedTrades,
    start: now - thirtyDaysMs * 2,
    end: now - thirtyDaysMs,
  });
  let trendDirection: WalletEvolutionTrend = "stable";

  if (last30d.pnl !== null && previous30d.pnl !== null) {
    const pnlDelta = last30d.pnl - previous30d.pnl;
    const winRateDelta =
      last30d.winRate !== null && previous30d.winRate !== null
        ? last30d.winRate - previous30d.winRate
        : 0;

    if (pnlDelta > 0 && winRateDelta >= -5) trendDirection = "improving";
    if (pnlDelta < 0 && winRateDelta <= 5) trendDirection = "deteriorating";
  }

  return {
    last30dWinRate: last30d.winRate,
    previous30dWinRate: previous30d.winRate,
    last30dPnl: last30d.pnl,
    previous30dPnl: previous30d.pnl,
    trendDirection,
  };
}
