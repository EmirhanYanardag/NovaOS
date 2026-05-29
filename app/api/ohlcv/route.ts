import { NextResponse } from "next/server";

type RawCandle = [number, number, number, number, number, number];

function mapNetwork(chain: string) {
  const key = chain.toLowerCase();

  if (key === "ethereum" || key === "eth") return "eth";
  if (key === "bsc" || key === "bnb") return "bsc";
  if (key === "base") return "base";
  if (key === "solana" || key === "sol") return "solana";
  if (key === "mantle") return "mantle";

  return key;
}

function mapTimeframe(tf: string) {
  if (tf === "1m") return { timeframe: "minute", aggregate: "1", limit: 300, pages: 1 };
  if (tf === "5m") return { timeframe: "minute", aggregate: "5", limit: 400, pages: 1 };
  if (tf === "15m") return { timeframe: "minute", aggregate: "15", limit: 500, pages: 1 };
  if (tf === "1h") return { timeframe: "hour", aggregate: "1", limit: 700, pages: 2 };
  if (tf === "4h") return { timeframe: "hour", aggregate: "4", limit: 700, pages: 2 };
  if (tf === "1d") return { timeframe: "day", aggregate: "1", limit: 700, pages: 2 };

  return { timeframe: "hour", aggregate: "1", limit: 700, pages: 2 };
}

function normalizeCandles(list: RawCandle[]) {
  const map = new Map<number, RawCandle>();

  for (const item of list) {
    const [time, open, high, low, close, volume] = item;

    if (
      !time ||
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close)
    ) {
      continue;
    }

    map.set(time, [time, open, high, low, close, volume || 0]);
  }

  return Array.from(map.values()).sort((a, b) => a[0] - b[0]);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const chain = searchParams.get("chain");
  const pool = searchParams.get("pool");
  const tf = searchParams.get("tf") || "1h";

  if (!chain || !pool) {
    return NextResponse.json(
      { error: "Missing chain or pool parameter." },
      { status: 400 }
    );
  }

  const network = mapNetwork(chain);
  const { timeframe, aggregate, limit, pages } = mapTimeframe(tf);

  try {
    let beforeTimestamp: number | null = null;
    const allCandles: RawCandle[] = [];

    for (let page = 0; page < pages; page++) {
      const url = new URL(
        `https://api.geckoterminal.com/api/v2/networks/${network}/pools/${pool}/ohlcv/${timeframe}`
      );

      url.searchParams.set("aggregate", aggregate);
      url.searchParams.set("limit", String(limit));
      url.searchParams.set("currency", "usd");

      if (beforeTimestamp) {
        url.searchParams.set("before_timestamp", String(beforeTimestamp));
      }

      const response = await fetch(url.toString(), {
        headers: {
          accept: "application/json;version=20230302",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        if (allCandles.length > 0) break;

        return NextResponse.json(
          { error: "OHLCV request failed for this pair or timeframe." },
          { status: 200 }
        );
      }

      const data = await response.json();
      const list: RawCandle[] = data?.data?.attributes?.ohlcv_list || [];

      if (!list.length) break;

      allCandles.push(...list);

      const oldest = list[list.length - 1]?.[0];
      if (!oldest || oldest === beforeTimestamp) break;

      beforeTimestamp = oldest - 1;
    }

    const normalized = normalizeCandles(allCandles);

    const candles = normalized.map((item) => ({
      time: item[0],
      open: item[1],
      high: item[2],
      low: item[3],
      close: item[4],
    }));

    const volume = normalized.map((item) => ({
      time: item[0],
      value: item[5],
      color:
        item[4] >= item[1]
          ? "rgba(125,255,222,0.22)"
          : "rgba(255,95,118,0.22)",
    }));

    return NextResponse.json({
      candles,
      volume,
      count: candles.length,
      timeframe: tf,
    });
  } catch {
    return NextResponse.json(
      { error: "Unexpected OHLCV server error." },
      { status: 200 }
    );
  }
}