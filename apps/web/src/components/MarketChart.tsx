"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  createChart,
  HistogramSeries,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp
} from "lightweight-charts";
import type { MarketCandle } from "@githubwatch/shared";

interface MarketChartProps {
  candles: MarketCandle[];
}

export function MarketChart({ candles }: MarketChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { color: "#ffffff" },
        textColor: "#344054"
      },
      grid: {
        vertLines: { color: "#edf1f6" },
        horzLines: { color: "#edf1f6" }
      },
      rightPriceScale: {
        borderColor: "#d9dee8"
      },
      timeScale: {
        borderColor: "#d9dee8",
        timeVisible: true,
        secondsVisible: false
      },
      crosshair: {
        mode: 1
      }
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#d92d20",
      downColor: "#1570ef",
      borderUpColor: "#d92d20",
      borderDownColor: "#1570ef",
      wickUpColor: "#d92d20",
      wickDownColor: "#1570ef"
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: "#98a2b3",
      priceFormat: {
        type: "volume"
      },
      priceScaleId: ""
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.78,
        bottom: 0
      }
    });

    chartRef.current = chart;
    seriesRef.current = series;
    volumeSeriesRef.current = volumeSeries;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current) {
      return;
    }

    seriesRef.current.setData(toChartData(candles));
    volumeSeriesRef.current?.setData(toVolumeData(candles));
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  return <div className="market-chart" ref={containerRef} />;
}

function toVolumeData(candles: MarketCandle[]): HistogramData[] {
  return candles.map((candle) => ({
    time: Math.floor(new Date(candle.timestamp).getTime() / 1000) as UTCTimestamp,
    value: candle.volume,
    color: candle.close >= candle.open ? "#f0443840" : "#2e90fa40"
  }));
}

function toChartData(candles: MarketCandle[]): CandlestickData[] {
  return candles.map((candle) => ({
    time: Math.floor(new Date(candle.timestamp).getTime() / 1000) as UTCTimestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close
  }));
}
