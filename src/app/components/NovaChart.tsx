"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  AreaSeries,
  ColorType,
  createChart,
  IChartApi,
  ISeriesApi,
  LineSeries,
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

const defaultTimeframe = "1h";
const timeframes = ["1m", "5m", "15m", defaultTimeframe, "4h", "1d"];

function timeframeLabel(tf: string) {
  if (tf === "1m") return "1M";
  if (tf === "5m") return "5M";
  if (tf === "15m") return "15M";
  if (tf === "1h") return "1H";
  if (tf === "4h") return "4H";
  if (tf === "1d") return "1D";

  return tf.toUpperCase();
}

function normalizeChartCandles(items: Candle[]) {
  const map = new Map<number, Candle>();

  for (const item of items) {
    const time = Number(item.time);
    const open = Number(item.open);
    const high = Number(item.high);
    const low = Number(item.low);
    const close = Number(item.close);

    if (
      !time ||
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close)
    ) {
      continue;
    }

    map.set(time, {
      time: time as UTCTimestamp,
      open,
      high,
      low,
      close,
    });
  }

  return Array.from(map.values()).sort((a, b) => a.time - b.time);
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
  const areaSeriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const lineGlowSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const candlesRef = useRef<Candle[]>([]);
  const hasFittedRef = useRef(false);
  const reflowFrameRef = useRef<number | null>(null);

  const [timeframe, setTimeframe] = useState(defaultTimeframe);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reflowChart = useCallback(() => {
    if (!containerRef.current || !chartRef.current) return;

    const bounds = containerRef.current.getBoundingClientRect();
    chartRef.current.applyOptions({
      width: Math.round(bounds.width) || 900,
      height: Math.round(bounds.height) || chartHeight,
    });
  }, [chartHeight]);

  const scheduleChartReflow = useCallback(() => {
    if (reflowFrameRef.current !== null) {
      cancelAnimationFrame(reflowFrameRef.current);
    }

    reflowFrameRef.current = requestAnimationFrame(() => {
      reflowFrameRef.current = null;
      reflowChart();
      requestAnimationFrame(reflowChart);
    });
  }, [reflowChart]);

  useEffect(() => {
    hasFittedRef.current = false;
    let active = true;

    queueMicrotask(() => {
      if (!active) return;

      setCandles([]);
      setError("");
    });

    if (!pairAddress || !chain) {
      scheduleChartReflow();
      return () => {
        active = false;
      };
    }

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

        setCandles(normalizeChartCandles(data.candles || []));
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
      controller.abort();
    };
  }, [chain, pairAddress, scheduleChartReflow, timeframe]);

  useEffect(() => {
    if (!containerRef.current || chartRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth || 900,
      height: Math.round(containerRef.current.getBoundingClientRect().height) || chartHeight,
      autoSize: false,
      layout: {
        background: {
          type: ColorType.Solid,
          color: "rgba(5,8,11,0)",
        },
        textColor: "rgba(227,224,215,0.42)",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: {
          color: "rgba(178,190,181,0.08)",
        },
        horzLines: {
          color: "rgba(178,190,181,0.08)",
        },
      },
      crosshair: {
        mode: 0,
        vertLine: {
          color: "rgba(178,190,181,0.16)",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#101213",
        },
        horzLine: {
          color: "rgba(178,190,181,0.16)",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#101213",
        },
      },
      rightPriceScale: {
        borderColor: "rgba(178,190,181,0.10)",
        scaleMargins: {
          top: 0.08,
          bottom: 0.1,
        },
      },
      timeScale: {
        borderColor: "rgba(178,190,181,0.10)",
        timeVisible: true,
        secondsVisible: false,
        minimumHeight: 36,
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

    const lineGlowSeries = chart.addSeries(LineSeries, {
      color: "rgba(255,255,255,0.08)",
      lineWidth: 4,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: "#E5E4E2",
      lineWidth: 2,
      topColor: "rgba(230,230,230,0.10)",
      bottomColor: "rgba(0,0,0,0)",
      priceLineColor: "rgba(178,190,181,0.30)",
      priceLineWidth: 1,
      lastValueVisible: true,
    });

    chartRef.current = chart;
    areaSeriesRef.current = areaSeries;
    lineGlowSeriesRef.current = lineGlowSeries;

    const resizeObserver = new ResizeObserver(reflowChart);
    resizeObserver.observe(containerRef.current);
    scheduleChartReflow();
    window.addEventListener("resize", reflowChart);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", reflowChart);

      chart.remove();

      chartRef.current = null;
      areaSeriesRef.current = null;
      lineGlowSeriesRef.current = null;
    };
  }, [chartHeight, reflowChart, scheduleChartReflow]);

  useEffect(() => {
    if (!chartRef.current || !areaSeriesRef.current) return;

    function applyVisiblePriceRange() {
      if (!chartRef.current) return;

      const chart = chartRef.current;
      const visibleRange = chart.timeScale().getVisibleLogicalRange();
      const sourceCandles = candlesRef.current;

      if (!sourceCandles.length || !visibleRange) {
        chart.priceScale("right").setAutoScale(true);
        return;
      }

      const from = Math.max(0, Math.floor(visibleRange.from));
      const to = Math.min(sourceCandles.length - 1, Math.ceil(visibleRange.to));
      const visibleCandles = sourceCandles.slice(from, to + 1);

      if (!visibleCandles.length) {
        chart.priceScale("right").setAutoScale(true);
        return;
      }

      let minPrice = Number.POSITIVE_INFINITY;
      let maxPrice = Number.NEGATIVE_INFINITY;

      for (const candle of visibleCandles) {
        minPrice = Math.min(minPrice, candle.close);
        maxPrice = Math.max(maxPrice, candle.close);
      }

      if (!Number.isFinite(minPrice) || !Number.isFinite(maxPrice)) {
        chart.priceScale("right").setAutoScale(true);
        return;
      }

      const range = maxPrice - minPrice;
      const padding = range > 0 ? range * 0.1 : Math.max(Math.abs(maxPrice) * 0.01, 1);

      chart.priceScale("right").setVisibleRange({
        from: minPrice - padding,
        to: maxPrice + padding,
      });
    }

    const timeScale = chartRef.current.timeScale();
    timeScale.subscribeVisibleLogicalRangeChange(applyVisiblePriceRange);
    const frame = requestAnimationFrame(applyVisiblePriceRange);

    return () => {
      cancelAnimationFrame(frame);
      timeScale.unsubscribeVisibleLogicalRangeChange(applyVisiblePriceRange);
    };
  }, []);

  useEffect(() => {
    candlesRef.current = candles;

    if (!chartRef.current || !areaSeriesRef.current) {
      return;
    }

    scheduleChartReflow();

    if (!candles.length) {
      areaSeriesRef.current.setData([]);
      lineGlowSeriesRef.current?.setData([]);
      chartRef.current.priceScale("right").setAutoScale(true);
      return;
    }

    const lineData = candles.map((candle) => ({
      time: candle.time,
      value: candle.close,
    }));

    lineGlowSeriesRef.current?.setData(lineData);
    areaSeriesRef.current.setData(lineData);

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

    requestAnimationFrame(() => {
      const visibleRange = chartRef.current?.timeScale().getVisibleLogicalRange();
      if (!chartRef.current || !visibleRange) return;

      const from = Math.max(0, Math.floor(visibleRange.from));
      const to = Math.min(candles.length - 1, Math.ceil(visibleRange.to));
      const visibleCandles = candles.slice(from, to + 1);

      if (!visibleCandles.length) return;

      let minPrice = Number.POSITIVE_INFINITY;
      let maxPrice = Number.NEGATIVE_INFINITY;

      for (const candle of visibleCandles) {
        minPrice = Math.min(minPrice, candle.close);
        maxPrice = Math.max(maxPrice, candle.close);
      }

      if (!Number.isFinite(minPrice) || !Number.isFinite(maxPrice)) return;

      const range = maxPrice - minPrice;
      const padding = range > 0 ? range * 0.1 : Math.max(Math.abs(maxPrice) * 0.01, 1);

      chartRef.current.priceScale("right").setVisibleRange({
        from: minPrice - padding,
        to: maxPrice + padding,
      });
    });
  }, [candles, scheduleChartReflow, timeframe]);

  return (
    <div
      style={{ height: chartHeight + 96, minHeight: chartHeight + 96 }}
      className="nova-chart-card nova-card-strong nova-glass-hover relative flex flex-col overflow-hidden rounded-[1.75rem]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(178,190,181,0.08),transparent_58%)]" />

      <div className="relative z-20 flex shrink-0 flex-col gap-4 px-5 py-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.32em] text-[color:var(--nova-text-muted)]">
            {token} / USD
          </p>

          <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-1">
            <p className="text-3xl font-semibold tracking-[-0.06em]">
              {price}
            </p>

            <p className="pb-1 text-sm text-[color:var(--nova-text-muted)]">
              MC {marketCap} · Liq {liquidity}
            </p>
          </div>
        </div>

        <div className="shrink-0 text-left sm:text-right">
          <p className="text-xs uppercase tracking-[0.32em] text-[color:var(--nova-text-muted)]">
            24H Volume
          </p>

          <p className="mt-2 text-2xl font-semibold tracking-[-0.05em]">
            {volume24h}
          </p>
        </div>
      </div>

      <div className="relative z-20 flex shrink-0 items-center justify-between gap-4 border-y border-[color:var(--nova-border)] bg-[rgba(10,10,10,0.50)] px-5 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2 overflow-x-auto text-xs text-[color:var(--nova-text-soft)]">
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
                  ? "bg-[rgba(178,190,181,0.12)] text-[color:var(--nova-text)]"
                  : loading
                  ? "cursor-not-allowed opacity-40"
                  : "hover:text-[color:var(--nova-text-soft)]"
              }`}
            >
              {timeframeLabel(item)}
            </button>
          ))}
        </div>

        <div aria-hidden="true" className="hidden md:block" />
      </div>

      <div className="nova-chart-body relative z-10 min-h-0 flex-1 overflow-visible pb-9">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-2/3 bg-[radial-gradient(ellipse_at_50%_100%,rgba(178,190,181,0.10),rgba(10,10,10,0.08)_42%,transparent_72%)]" />
        <div
          ref={containerRef}
          className="nova-chart-container absolute inset-x-0 top-0 z-10 min-h-0 w-full"
        />

        {!pairAddress && (
          <div className="nova-card-inner absolute inset-0 z-30 flex items-center justify-center text-sm text-[color:var(--nova-text-muted)] backdrop-blur-sm">
            Search and select a token pair to load real candles.
          </div>
        )}

        {pairAddress && loading && !candles.length && (
          <div className="nova-card-inner absolute inset-0 z-30 flex items-center justify-center text-sm text-[color:var(--nova-text-muted)] backdrop-blur-sm">
            Loading real OHLCV data...
          </div>
        )}

        {pairAddress && error && !candles.length && (
          <div className="nova-card-inner absolute inset-0 z-30 flex items-center justify-center px-6 text-center text-sm text-[color:var(--nova-danger)] backdrop-blur-sm">
            {error}
          </div>
        )}

        {pairAddress && !loading && !error && !candles.length && (
          <div className="nova-card-inner absolute inset-0 z-30 flex items-center justify-center px-6 text-center text-sm text-[color:var(--nova-text-muted)] backdrop-blur-sm">
            No candle data found for this pair.
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(NovaChartComponent);
