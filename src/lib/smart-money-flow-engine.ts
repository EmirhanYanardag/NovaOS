import type { SmartMoneyTrade } from "@/lib/gmgn-smart-money-trades";

export type SmartMoneyFlowResultV1 = {
  limit: number;
  matchedTradeCount: number;
  smartMoneyFlowScore: number;
  smartMoneyNetFlowUsd: number;
  smartMoneyBuyUsd: number;
  smartMoneySellUsd: number;
  smartMoneyBuyCount: number;
  smartMoneySellCount: number;
  smartMoneyBuyPressure: number | null;
  smartMoneySellPressure: number | null;
  uniqueSmartWallets: number;
  topSmartWallets: Array<{
    wallet: string | null;
    walletName: string | null;
    twitterUsername: string | null;
    tags: string[];
    tradeCount: number;
    buyUsd: number;
    sellUsd: number;
    netFlowUsd: number;
  }>;
  walletTagDistribution: Array<{
    tag: string;
    count: number;
  }>;
  recentTrades: SmartMoneyTrade[];
  explanations: string[];
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

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function walletKey(trade: SmartMoneyTrade) {
  return trade.wallet?.toLowerCase() || `unknown:${trade.txHash || trade.timestamp || "trade"}`;
}

function usdTotal(trades: SmartMoneyTrade[]) {
  return round(
    sum(
      trades
        .map((trade) => trade.amountUsd)
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    )
  );
}

function uniqueWalletCount(trades: SmartMoneyTrade[]) {
  return new Set(
    trades
      .map((trade) => trade.wallet?.toLowerCase())
      .filter((wallet): wallet is string => Boolean(wallet))
  ).size;
}

function buyPressureScore(buyPressure: number | null) {
  if (buyPressure === null) return 50;
  return clampScore(buyPressure);
}

function netFlowScore({
  buyUsd,
  sellUsd,
  netFlowUsd,
}: {
  buyUsd: number;
  sellUsd: number;
  netFlowUsd: number;
}) {
  const total = buyUsd + sellUsd;
  if (total <= 0) return 50;

  const ratio = buyUsd / total;
  const ratioScore = 50 + (ratio - 0.5) * 90;
  const magnitude = Math.min(18, Math.log10(Math.abs(netFlowUsd) + 1) * 3.5);
  const magnitudeTilt = netFlowUsd > 0 ? magnitude : netFlowUsd < 0 ? -magnitude : 0;

  return clampScore(ratioScore + magnitudeTilt);
}

function uniqueWalletScore(uniqueSmartWallets: number) {
  if (uniqueSmartWallets >= 20) return 90;
  if (uniqueSmartWallets >= 10) return 80;
  if (uniqueSmartWallets >= 5) return 68;
  if (uniqueSmartWallets >= 3) return 58;
  if (uniqueSmartWallets >= 1) return 45;
  return 40;
}

function activityScore(matchedTradeCount: number) {
  if (matchedTradeCount >= 50) return 90;
  if (matchedTradeCount >= 25) return 80;
  if (matchedTradeCount >= 10) return 68;
  if (matchedTradeCount >= 3) return 55;
  if (matchedTradeCount >= 1) return 45;
  return 40;
}

function buildTopSmartWallets(trades: SmartMoneyTrade[]) {
  const grouped = new Map<
    string,
    {
      wallet: string | null;
      walletName: string | null;
      twitterUsername: string | null;
      tags: Set<string>;
      tradeCount: number;
      buyUsd: number;
      sellUsd: number;
    }
  >();

  for (const trade of trades) {
    const key = walletKey(trade);
    const current =
      grouped.get(key) ??
      {
        wallet: trade.wallet,
        walletName: trade.walletName,
        twitterUsername: trade.twitterUsername,
        tags: new Set<string>(),
        tradeCount: 0,
        buyUsd: 0,
        sellUsd: 0,
      };

    current.tradeCount += 1;
    if (trade.side === "buy") current.buyUsd += trade.amountUsd ?? 0;
    if (trade.side === "sell") current.sellUsd += trade.amountUsd ?? 0;
    for (const tag of trade.walletTags) current.tags.add(tag);

    grouped.set(key, current);
  }

  return [...grouped.values()]
    .map((wallet) => ({
      wallet: wallet.wallet,
      walletName: wallet.walletName,
      twitterUsername: wallet.twitterUsername,
      tags: [...wallet.tags],
      tradeCount: wallet.tradeCount,
      buyUsd: round(wallet.buyUsd),
      sellUsd: round(wallet.sellUsd),
      netFlowUsd: round(wallet.buyUsd - wallet.sellUsd),
    }))
    .sort((a, b) => Math.abs(b.netFlowUsd) - Math.abs(a.netFlowUsd))
    .slice(0, 10);
}

function buildWalletTagDistribution(trades: SmartMoneyTrade[]) {
  const counts = new Map<string, number>();

  for (const trade of trades) {
    for (const tag of trade.walletTags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

function buildExplanations({
  matchedTradeCount,
  buyUsd,
  sellUsd,
  netFlowUsd,
  uniqueSmartWallets,
  score,
}: {
  matchedTradeCount: number;
  buyUsd: number;
  sellUsd: number;
  netFlowUsd: number;
  uniqueSmartWallets: number;
  score: number;
}) {
  const rows: string[] = [];

  rows.push("Smart Money Flow V1 uses the recent GMGN smart money trade feed window only.");

  if (matchedTradeCount === 0) {
    rows.push("No recent smart money trades matched this token in the fetched GMGN window.");
  } else if (netFlowUsd > 0) {
    rows.push(`Smart money recent net flow is positive at ${round(netFlowUsd, 2)} USD.`);
  } else if (netFlowUsd < 0) {
    rows.push(`Smart money recent net flow is negative at ${round(netFlowUsd, 2)} USD.`);
  } else {
    rows.push("Smart money recent buy and sell flow is balanced.");
  }

  if (buyUsd > sellUsd) {
    rows.push("Buy pressure is stronger than sell pressure in the recent smart money feed.");
  } else if (sellUsd > buyUsd) {
    rows.push("Sell pressure is stronger than buy pressure in the recent smart money feed.");
  }

  if (uniqueSmartWallets >= 5) {
    rows.push(`${uniqueSmartWallets} unique smart wallets participated recently.`);
  } else if (matchedTradeCount > 0) {
    rows.push("Recent smart money participation is concentrated in a small wallet set.");
  }

  rows.push(`Smart Money Flow score is ${score}/100 for this recent-feed window.`);

  return rows;
}

export function computeSmartMoneyFlowV1({
  trades,
  limit,
}: {
  trades: SmartMoneyTrade[];
  limit: number;
}): SmartMoneyFlowResultV1 {
  const sortedTrades = [...trades].sort(
    (a, b) => (b.timestampUnix ?? 0) - (a.timestampUnix ?? 0)
  );
  const warnings: string[] = [];
  const buyTrades = sortedTrades.filter((trade) => trade.side === "buy");
  const sellTrades = sortedTrades.filter((trade) => trade.side === "sell");
  const buyUsd = usdTotal(buyTrades);
  const sellUsd = usdTotal(sellTrades);
  const totalUsd = buyUsd + sellUsd;
  const netFlowUsd = round(buyUsd - sellUsd);
  const buyPressure = totalUsd > 0 ? round((buyUsd / totalUsd) * 100, 2) : null;
  const sellPressure = totalUsd > 0 ? round((sellUsd / totalUsd) * 100, 2) : null;
  const uniqueSmartWallets = uniqueWalletCount(sortedTrades);

  if (sortedTrades.length === 0) {
    warnings.push("No recent smart money trades found in GMGN feed window.");
  }

  const score =
    sortedTrades.length === 0
      ? 50
      : clampScore(
          buyPressureScore(buyPressure) * 0.45 +
            netFlowScore({ buyUsd, sellUsd, netFlowUsd }) * 0.3 +
            uniqueWalletScore(uniqueSmartWallets) * 0.15 +
            activityScore(sortedTrades.length) * 0.1
        );

  return {
    limit,
    matchedTradeCount: sortedTrades.length,
    smartMoneyFlowScore: score,
    smartMoneyNetFlowUsd: netFlowUsd,
    smartMoneyBuyUsd: buyUsd,
    smartMoneySellUsd: sellUsd,
    smartMoneyBuyCount: buyTrades.length,
    smartMoneySellCount: sellTrades.length,
    smartMoneyBuyPressure: buyPressure,
    smartMoneySellPressure: sellPressure,
    uniqueSmartWallets,
    topSmartWallets: buildTopSmartWallets(sortedTrades),
    walletTagDistribution: buildWalletTagDistribution(sortedTrades),
    recentTrades: sortedTrades.slice(0, 25),
    explanations: buildExplanations({
      matchedTradeCount: sortedTrades.length,
      buyUsd,
      sellUsd,
      netFlowUsd,
      uniqueSmartWallets,
      score,
    }),
    warnings,
  };
}
