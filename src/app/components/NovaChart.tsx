"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  IChartApi,
  ISeriesApi,
  LineStyle,
  UTCTimestamp,
} from "lightweight-charts";

type Candle = {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
};

type VolumeBar = {
  time: UTCTimestamp;
  value: number;
  color: string;
};

type NovaChartProps = {
  token: string;
  price: string;
  marketCap: string;
  liquidity: string;
  volume24h: string;
  chain: string;
  pairAddress?: string;
  chartHeight?: number;
};

const timeframes = ["1m", "5m", "15m", "1h", "4h", "1d"];

function timeframeLabel(tf: string) {
  if (tf === "1m") return "1M";
  if (tf === "5m") return "5M";
  if (tf === "15m") return "15M";
  if (tf === "1h") return "1H";
  if (tf === "4h") return "4H";
  if (tf === "1d") return "1D";

  return tf.toUpperCase();
}

function NovaChartComponent({
  token,
  price,
  marketCap,
  liquidity,
  volume24h,
  chain,
  pairAddress,
  chartHeight = 840,
}: NovaChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const hasFittedRef = useRef(false);

  const [timeframe, setTimeframe] = useState("1h");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [volume, setVolume] = useState<VolumeBar[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const candleCountText = useMemo(() => {
    if (!candles.length) return "No candles";
    return `${candles.length.toLocaleString()} candles`;
  }, [candles.length]);

  useEffect(() => {
    hasFittedRef.current = false;
    const resetFrame = requestAnimationFrame(() => {
      setCandles([]);
      setVolume([]);
      setError("");
    });

    if (!pairAddress || !chain) {
      return () => cancelAnimationFrame(resetFrame);
    }

    let active = true;
    const controller = new AbortController();

    async function fetchCandles() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/ohlcv?chain=${encodeURIComponent(
            chain
          )}&pool=${encodeURIComponent(pairAddress || "")}&tf=${timeframe}`,
          { signal: controller.signal }
        );

        const data = await response.json();

        if (!active) return;

        if (data.error) {
          setError(data.error);
          return;
        }

        setCandles(data.candles || []);
        setVolume(data.volume || []);
      } catch (err) {
        if (!active) return;
        if (err instanceof Error && err.name === "AbortError") return;

        setError("Could not load chart data.");
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchCandles();

    return () => {
      active = false;
      cancelAnimationFrame(resetFrame);
      controller.abort();
    };
  }, [chain, pairAddress, timeframe]);

  useEffect(() => {
    if (!containerRef.current || chartRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth || 900,
      height: chartHeight,
      autoSize: false,
      layout: {
        background: {
          type: ColorType.Solid,
          color: "#05070a",
        },
        textColor: "rgba(255,255,255,0.42)",
        attributionLogo: false,
      },
      grid: {
        vertLines: {
          color: "rgba(255,255,255,0.03)",
        },
        horzLines: {
          color: "rgba(255,255,255,0.03)",
        },
      },
      crosshair: {
        mode: 0,
        vertLine: {
          color: "rgba(180,240,255,0.18)",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#071318",
        },
        horzLine: {
          color: "rgba(180,240,255,0.18)",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#071318",
        },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.08)",
        scaleMargins: {
          top: 0.04,
          bottom: 0.08,
        },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 8,
        barSpacing: 6,
        minBarSpacing: 2,
        fixLeftEdge: false,
        fixRightEdge: false,
        lockVisibleTimeRangeOnResize: false,
      },
      handleScroll: {
        mouseWheel: false,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: false,
        pinch: true,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "rgba(125,255,222,0.96)",
      downColor: "rgba(255,95,118,0.96)",
      borderUpColor: "rgba(125,255,222,1)",
      borderDownColor: "rgba(255,95,118,1)",
      wickUpColor: "rgba(125,255,222,0.95)",
      wickDownColor: "rgba(255,95,118,0.95)",
      priceLineColor: "rgba(180,240,255,0.35)",
      priceLineWidth: 1,
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: {
        type: "volume",
      },
      priceScaleId: "",
      lastValueVisible: false,
      priceLineVisible: false,
    });

    chart.priceScale("").applyOptions({
      scaleMargins: {
        top: 0.9,
        bottom: 0,
      },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    function handleResize() {
      if (!containerRef.current || !chartRef.current) return;

      chartRef.current.applyOptions({
        width: containerRef.current.clientWidth || 900,
        height: chartHeight,
      });
    }

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);

      chart.remove();

      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [chartHeight]);

  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current || !volumeSeriesRef.current) {
      return;
    }

    if (!candles.length) {
      candleSeriesRef.current.setData([]);
      volumeSeriesRef.current.setData([]);
      return;
    }

    candleSeriesRef.current.setData(candles);
    volumeSeriesRef.current.setData(volume);

    if (!hasFittedRef.current) {
      const visibleBars = timeframe === "1m" || timeframe === "5m" ? 180 : 260;
      const from = Math.max(0, candles.length - visibleBars);
      const to = candles.length - 1;

      if (candles[from] && candles[to]) {
        chartRef.current.timeScale().setVisibleRange({
          from: candles[from].time,
          to: candles[to].time,
        });
      } else {
        chartRef.current.timeScale().fitContent();
      }

      hasFittedRef.current = true;
    }
  }, [candles, volume, timeframe]);

  return (
    <div
      style={{ minHeight: chartHeight + 140 }}
      className="relative flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#05070a]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(1,44,59,0.24),transparent_62%)]" />

      <div className="relative z-20 flex shrink-0 items-center justify-between gap-6 border-b border-white/10 bg-black/30 px-5 py-4 backdrop-blur-xl">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.32em] text-cyan-100/38">
            {token} / USD
          </p>

          <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-1">
            <p className="text-3xl font-semibold tracking-[-0.06em]">
              {price}
            </p>

            <p className="pb-1 text-sm text-white/32">
              MC {marketCap} · Liq {liquidity}
            </p>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-xs uppercase tracking-[0.32em] text-cyan-100/38">
            24H Volume
          </p>

          <p className="mt-2 text-2xl font-semibold tracking-[-0.05em]">
            {volume24h}
          </p>
        </div>
      </div>

      <div className="relative z-20 flex shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-black/15 px-5 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2 overflow-x-auto text-xs text-white/40">
          {timeframes.map((item) => (
            <button
              key={item}
              onClick={() => {
                if (loading || item === timeframe) return;
                setTimeframe(item);
              }}
              disabled={loading}
              className={`rounded-full px-3 py-1 transition ${
                item === timeframe
                  ? "bg-cyan-100/10 text-cyan-100"
                  : loading
                  ? "cursor-not-allowed opacity-40"
                  : "hover:text-white/70"
              }`}
            >
              {timeframeLabel(item)}
            </button>
          ))}
        </div>

        <div className="hidden items-center gap-4 text-xs text-white/35 md:flex">
          <span>{candleCountText}</span>
          <span>USD</span>
          <span>{loading ? "Syncing..." : "Live candles"}</span>
        </div>
      </div>

      <div className="relative z-10 flex-1">
        <div
          ref={containerRef}
          style={{ height: chartHeight }}
          className="w-full"
        />

        {!pairAddress && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#05070a]/80 text-sm text-white/35 backdrop-blur-sm">
            Search and select a token pair to load real candles.
          </div>
        )}

        {pairAddress && loading && !candles.length && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#05070a]/80 text-sm text-white/35 backdrop-blur-sm">
            Loading real OHLCV data...
          </div>
        )}

        {pairAddress && error && !candles.length && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#05070a]/80 px-6 text-center text-sm text-red-100/55 backdrop-blur-sm">
            {error}
          </div>
        )}

        {pairAddress && !loading && !error && !candles.length && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#05070a]/80 px-6 text-center text-sm text-white/35 backdrop-blur-sm">
            No candle data found for this pair.
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(NovaChartComponent);
