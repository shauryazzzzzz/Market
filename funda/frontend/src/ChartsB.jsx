/**
 * Section B — Technical Analysis
 * Multi-pane TradingView layout:
 *   Pane 1 (top, ~55%):   Candlestick + Bollinger Bands + Volume bars
 *   Pane 2 (middle, ~25%): MACD Line + Signal + Histogram (colored)
 *   Pane 3 (bottom, ~20%): RSI with 70/30 shaded bands
 *
 * All panes share the same X-axis zoom/pan (dataZoom).
 * All indicators are server-computed via /api/funda/live/indicators/:symbol
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import { useStore } from './store.jsx';
import { fetchOHLCV } from './api';
import { ChartSkeleton, EmptyState, DateRangeSelector, exportChartPNG, exportCSV } from './utils';

// ── Shared hook ───────────────────────────────────────────────────────────────
function useTickerOHLCV(ticker, period) {
  const { state, dispatch } = useStore();
  const key    = `${ticker}__${period}`;
  const cached = state.ohlcvCache[key];
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!ticker || cached) return;
    setLoading(true);
    setError(null);
    fetchOHLCV(ticker, period)
      .then(data => { dispatch({ type: 'SET_OHLCV', key, payload: data }); setLoading(false); })
      .catch(e  => { setError(e.message); setLoading(false); });
  }, [ticker, period]);

  return { data: cached || [], loading, error };
}

// ── ECharts dark theme overrides ──────────────────────────────────────────────
const TV = {
  bg:        '#131722',
  surface:   '#1e222d',
  surface2:  '#2a2e39',
  border:    '#363a45',
  text:      '#d1d4dc',
  textDim:   '#787b86',
  bull:      '#26a69a',
  bear:      '#ef5350',
  blue:      '#2962ff',
  yellow:    '#f5a623',
};

const axisStyle = {
  axisLabel:    { color: TV.textDim, fontSize: 10 },
  axisLine:     { lineStyle: { color: TV.border } },
  axisTick:     { lineStyle: { color: TV.border } },
  splitLine:    { lineStyle: { color: TV.border, type: 'dashed', opacity: 0.5 } },
};

// ── Main multi-pane component ─────────────────────────────────────────────────
export function MultiPaneChart() {
  const { state }            = useStore();
  const { selectedTickers }  = state;
  const [ticker, setTicker]  = useState('');
  const [period, setPeriod]  = useState('3M');
  const chartRef             = useRef(null);

  useEffect(() => {
    if (selectedTickers.length && !ticker) setTicker(selectedTickers[0]);
  }, [selectedTickers]);

  const activeTicker            = ticker || selectedTickers[0] || '';
  const { data, loading, error } = useTickerOHLCV(activeTicker, period);

  // ── Keyboard shortcut: cycle periods ──────────────────────────────────────
  useEffect(() => {
    const periods = ['1W','1M','3M','6M','1Y','5Y'];
    const handler = (e) => {
      if (e.key === 'ArrowRight') setPeriod(p => { const i = periods.indexOf(p); return periods[Math.min(i+1, periods.length-1)]; });
      if (e.key === 'ArrowLeft')  setPeriod(p => { const i = periods.indexOf(p); return periods[Math.max(i-1, 0)]; });
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!selectedTickers.length) {
    return (
      <div className="multipane-empty">
        <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>↗</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--tv-text)', marginBottom: 8 }}>
          No ticker selected
        </div>
        <div style={{ color: 'var(--tv-text-mute)', fontSize: 12, maxWidth: 320, textAlign: 'center' }}>
          Use the Sector/Ticker dropdowns above to select a stock.
          Charts will show candlestick · Bollinger · MACD · RSI.
        </div>
      </div>
    );
  }
  if (loading) return <ChartSkeleton title={`Loading ${activeTicker} — ${period}`} />;
  if (error)   return <EmptyState message={`Could not load data for ${activeTicker}: ${error}`} />;
  if (!data.length) return <EmptyState message={`No price history available for ${activeTicker}`} />;

  // ── Build series data ──────────────────────────────────────────────────────
  const dates      = data.map(d => d.date);
  const ohlc       = data.map(d => [d.open, d.close, d.low, d.high].map(v => v != null ? +v.toFixed(2) : null));
  const closes     = data.map(d => d.close   != null ? +d.close.toFixed(2)      : null);
  const volumes    = data.map(d => d.volume   != null ? d.volume                 : null);
  const bollUpper  = data.map(d => d.bollUpper  != null ? +d.bollUpper.toFixed(2)  : null);
  const bollMiddle = data.map(d => d.bollMiddle != null ? +d.bollMiddle.toFixed(2) : null);
  const bollLower  = data.map(d => d.bollLower  != null ? +d.bollLower.toFixed(2)  : null);
  const macdLine   = data.map(d => d.macd      != null ? +d.macd.toFixed(4)      : null);
  const signalLine = data.map(d => d.macdSignal != null ? +d.macdSignal.toFixed(4) : null);
  const histogram  = data.map(d => d.macdHist  != null ? +d.macdHist.toFixed(4)   : null);
  const rsiData    = data.map(d => d.rsi       != null ? +d.rsi.toFixed(2)        : null);

  // Latest values for the info bar
  const last  = data[data.length - 1];
  const prev  = data[data.length - 2];
  const chg   = (last?.close != null && prev?.close != null)
    ? +((last.close - prev.close) / prev.close * 100).toFixed(2) : null;
  const isUp  = (chg ?? 0) >= 0;

  // Volume colors: green if close >= open, red otherwise
  const volColors = data.map((d, i) => ({
    value: d.volume,
    itemStyle: {
      color: (d.close ?? 0) >= (d.open ?? 0) ? 'rgba(38,166,154,0.45)' : 'rgba(239,83,80,0.45)',
    },
  }));

  // MACD histogram colors
  const histColored = histogram.map(v => ({
    value: v,
    itemStyle: {
      color: v == null ? 'transparent' : v >= 0 ? TV.bull : TV.bear,
      opacity: v == null ? 0 : Math.min(1, 0.5 + Math.abs(v) * 3),
    },
  }));

  // RSI fill zones (above 70 = red zone, below 30 = green zone)
  const rsiAbove70 = rsiData.map(v => v != null && v > 70 ? v : null);
  const rsiBelow30 = rsiData.map(v => v != null && v < 30 ? v : null);

  // ── ECharts option — 3 grids stacked ──────────────────────────────────────
  const option = {
    backgroundColor: TV.bg,
    animation: false,

    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross', crossStyle: { color: TV.textDim } },
      backgroundColor: TV.surface,
      borderColor: TV.border,
      textStyle: { color: TV.text, fontSize: 11, fontFamily: 'IBM Plex Mono, monospace' },
      formatter: (params) => {
        const p = params.find(p => p.seriesName === 'OHLC');
        const r = params.find(p => p.seriesName === 'RSI')?.data;
        const m = params.find(p => p.seriesName === 'MACD')?.data;
        if (!p) return '';
        const [o, c, l, h] = p.data ?? [null,null,null,null];
        const up = (c ?? 0) >= (o ?? 0);
        const chgRow = (o != null && c != null)
          ? `<span style="color:${up ? TV.bull : TV.bear}">${up?'+':''}${((c-o)/o*100).toFixed(2)}%</span>`
          : '';
        return [
          `<b style="font-size:12px">${p.axisValue}</b>`,
          `O <b>${o}</b>  H <b>${h}</b>  L <b>${l}</b>  C <b style="color:${up?TV.bull:TV.bear}">${c}</b>  ${chgRow}`,
          r != null ? `RSI <b style="color:${r>70?TV.bear:r<30?TV.bull:TV.blue}">${(+r).toFixed(1)}</b>` : '',
          m != null ? `MACD <b style="color:${+m>=0?TV.bull:TV.bear}">${(+m).toFixed(4)}</b>` : '',
        ].filter(Boolean).join('<br/>');
      },
    },

    axisPointer: { link: [{ xAxisIndex: 'all' }] },

    // ── Grids: 3 vertical sections ──────────────────────────────────────────
    grid: [
      { top: 8,    left: 60, right: 14, height: '52%' },   // price + BB + volume
      { top: '64%', left: 60, right: 14, height: '16%' },   // MACD
      { top: '84%', left: 60, right: 14, height: '12%' },   // RSI
    ],

    xAxis: [
      { type: 'category', data: dates, gridIndex: 0, boundaryGap: false,
        axisLabel: { show: false }, ...axisStyle, axisLine: { lineStyle: { color: TV.border } } },
      { type: 'category', data: dates, gridIndex: 1, boundaryGap: false,
        axisLabel: { show: false }, ...axisStyle },
      { type: 'category', data: dates, gridIndex: 2, boundaryGap: false,
        axisLabel: { color: TV.textDim, fontSize: 9, rotate: 20, interval: Math.floor(dates.length / 6) },
        ...axisStyle },
    ],

    yAxis: [
      // Price axis (left of pane 0)
      { type: 'value', scale: true, gridIndex: 0, position: 'left',
        ...axisStyle,
        axisLabel: { color: TV.textDim, fontSize: 10, formatter: v => `₹${v.toLocaleString()}` },
        splitNumber: 4 },
      // Volume axis (right of pane 0, small %)
      { type: 'value', scale: true, gridIndex: 0, position: 'right',
        axisLabel: { show: false }, splitLine: { show: false }, axisLine: { show: false }, axisTick: { show: false },
        max: v => v.max * 4 },
      // MACD
      { type: 'value', scale: true, gridIndex: 1, ...axisStyle,
        axisLabel: { color: TV.textDim, fontSize: 9 }, splitNumber: 3 },
      // RSI
      { type: 'value', min: 0, max: 100, gridIndex: 2, ...axisStyle,
        axisLabel: { color: TV.textDim, fontSize: 9 }, splitNumber: 2,
        interval: 30 },
    ],

    dataZoom: [
      { type: 'inside', xAxisIndex: [0, 1, 2], start: Math.max(0, 100 - Math.min(100, 90)), end: 100 },
      {
        type: 'slider', xAxisIndex: [0, 1, 2], bottom: 2, height: 20,
        borderColor: TV.border, fillerColor: 'rgba(41,98,255,0.08)',
        handleStyle: { color: TV.blue, borderColor: TV.blue },
        textStyle: { color: TV.textDim },
        moveHandleStyle: { color: TV.border },
      },
    ],

    series: [
      // ─ Pane 0: Candlestick ─────────────────────────────────────────────────
      {
        name: 'OHLC', type: 'candlestick', xAxisIndex: 0, yAxisIndex: 0,
        data: ohlc,
        itemStyle: {
          color:        TV.bull,
          color0:       TV.bear,
          borderColor:  TV.bull,
          borderColor0: TV.bear,
        },
      },
      // ─ Bollinger Upper ────────────────────────────────────────────────────
      {
        name: 'BB Upper', type: 'line', xAxisIndex: 0, yAxisIndex: 0,
        data: bollUpper, symbol: 'none',
        lineStyle: { color: 'rgba(239,83,80,0.55)', width: 1, type: 'dashed' },
        areaStyle: { color: 'rgba(239,83,80,0.04)' },
        z: 1,
      },
      // ─ Bollinger Middle (SMA20) ───────────────────────────────────────────
      {
        name: 'BB SMA', type: 'line', xAxisIndex: 0, yAxisIndex: 0,
        data: bollMiddle, symbol: 'none',
        lineStyle: { color: 'rgba(245,166,35,0.7)', width: 1 },
        z: 2,
      },
      // ─ Bollinger Lower ────────────────────────────────────────────────────
      {
        name: 'BB Lower', type: 'line', xAxisIndex: 0, yAxisIndex: 0,
        data: bollLower, symbol: 'none',
        lineStyle: { color: 'rgba(38,166,154,0.55)', width: 1, type: 'dashed' },
        z: 1,
      },
      // ─ Volume ────────────────────────────────────────────────────────────
      {
        name: 'Volume', type: 'bar', xAxisIndex: 0, yAxisIndex: 1,
        data: volColors, barWidth: '80%', z: 0,
      },

      // ─ Pane 1: MACD Histogram ─────────────────────────────────────────────
      {
        name: 'Histogram', type: 'bar', xAxisIndex: 1, yAxisIndex: 2,
        data: histColored, barWidth: '80%',
        markLine: {
          silent: true,
          data: [{ yAxis: 0, lineStyle: { color: TV.border, width: 1 } }],
          label: { show: false },
        },
      },
      // ─ MACD Line ─────────────────────────────────────────────────────────
      {
        name: 'MACD', type: 'line', xAxisIndex: 1, yAxisIndex: 2,
        data: macdLine, symbol: 'none',
        lineStyle: { color: TV.blue, width: 1.5 },
        z: 5,
      },
      // ─ Signal Line ───────────────────────────────────────────────────────
      {
        name: 'Signal', type: 'line', xAxisIndex: 1, yAxisIndex: 2,
        data: signalLine, symbol: 'none',
        lineStyle: { color: TV.yellow, width: 1.5 },
        z: 5,
      },

      // ─ Pane 2: RSI line ───────────────────────────────────────────────────
      {
        name: 'RSI', type: 'line', xAxisIndex: 2, yAxisIndex: 3,
        data: rsiData, symbol: 'none',
        lineStyle: { color: TV.blue, width: 1.5 },
        areaStyle: { color: 'rgba(41,98,255,0.06)' },
        markLine: {
          silent: true,
          symbol: 'none',
          data: [
            { yAxis: 70, lineStyle: { color: 'rgba(239,83,80,0.55)', type: 'dashed', width: 1 } },
            { yAxis: 30, lineStyle: { color: 'rgba(38,166,154,0.55)', type: 'dashed', width: 1 } },
          ],
          label: { show: true, formatter: p => p.data.yAxis, fontSize: 9, color: TV.textDim },
        },
        // MarkArea for OB/OS zones
        markArea: {
          silent: true,
          data: [
            [{yAxis: 70}, {yAxis: 100, itemStyle: { color: 'rgba(239,83,80,0.06)' }}],
            [{yAxis: 0},  {yAxis: 30,  itemStyle: { color: 'rgba(38,166,154,0.06)' }}],
          ],
        },
      },
    ],
  };

  // ── Last-value info bar ────────────────────────────────────────────────────
  const lastRSI  = last?.rsi  != null ? +last.rsi.toFixed(1)  : null;
  const lastMACD = last?.macdHist != null ? +last.macdHist.toFixed(4) : null;
  const lastBB   = last?.bollUpper != null ? ` BB(${last.bollLower?.toFixed(0)}–${last.bollUpper?.toFixed(0)})` : '';

  return (
    <div className="chart-card" style={{ background: TV.bg }}>
      {/* Header */}
      <div className="chart-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="chart-card-title">{activeTicker}</span>
          {last?.close != null && (
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 700,
              color: isUp ? TV.bull : TV.bear,
            }}>
              ₹{last.close.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          )}
          {chg != null && (
            <span style={{
              fontSize: 12, fontWeight: 600, fontFamily: 'var(--mono)',
              color: isUp ? TV.bull : TV.bear,
              background: isUp ? 'rgba(38,166,154,0.12)' : 'rgba(239,83,80,0.12)',
              padding: '2px 8px', borderRadius: 4,
            }}>
              {isUp ? '+' : ''}{chg}%
            </span>
          )}
          {/* Pane labels */}
          <span style={{ fontSize: 10, color: TV.textDim, marginLeft: 4 }}>
            BB(20,2σ){lastBB}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Indicator badges */}
          {lastRSI != null && (
            <span className={`at-signal ${lastRSI > 70 ? 'at-signal-bear' : lastRSI < 30 ? 'at-signal-bull' : 'at-signal-neu'}`}>
              RSI {lastRSI}
            </span>
          )}
          {lastMACD != null && (
            <span className={`at-signal ${lastMACD >= 0 ? 'at-signal-bull' : 'at-signal-bear'}`}>
              MACD {lastMACD >= 0 ? '+' : ''}{lastMACD}
            </span>
          )}

          {/* Ticker select */}
          <select className="chart-select" value={ticker} onChange={e => setTicker(e.target.value)}>
            {selectedTickers.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          {/* Period pills */}
          <DateRangeSelector value={period} onChange={setPeriod} />

          {/* Export */}
          <button className="chart-export-btn" onClick={() => exportChartPNG(chartRef, `technical-${activeTicker}`)}>
            ↓ PNG
          </button>
          <button className="chart-export-btn" onClick={() => exportCSV(data, `${activeTicker}-ohlcv`)}>
            ↓ CSV
          </button>
        </div>
      </div>

      {/* Pane labels overlay */}
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', top: 8, left: 68, zIndex: 10, pointerEvents: 'none' }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: TV.textDim, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            PRICE · BOLLINGER · VOLUME
          </span>
        </div>
        <ReactECharts
          ref={chartRef}
          option={option}
          style={{ height: 560 }}
          theme="dark"
          opts={{ renderer: 'canvas' }}
        />
        {/* MACD label */}
        <div style={{ position: 'absolute', bottom: '17%', left: 68, pointerEvents: 'none' }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: TV.textDim, letterSpacing: '0.1em', textTransform: 'uppercase' }}>MACD (12,26,9)</span>
        </div>
        {/* RSI label */}
        <div style={{ position: 'absolute', bottom: '7%', left: 68, pointerEvents: 'none' }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: TV.textDim, letterSpacing: '0.1em', textTransform: 'uppercase' }}>RSI (14)</span>
        </div>
      </div>

      {/* Legend row */}
      <div style={{
        display: 'flex', gap: 16, padding: '6px 16px',
        borderTop: '1px solid var(--tv-border)',
        fontSize: 10, color: TV.textDim,
        background: TV.surface,
      }}>
        {[
          { color: TV.bull,                  label: 'Bullish Candle' },
          { color: TV.bear,                  label: 'Bearish Candle' },
          { color: 'rgba(239,83,80,0.7)',    label: 'BB Upper' },
          { color: 'rgba(245,166,35,0.8)',   label: 'BB SMA(20)' },
          { color: 'rgba(38,166,154,0.7)',   label: 'BB Lower' },
          { color: TV.blue,                  label: 'MACD / RSI' },
          { color: TV.yellow,                label: 'Signal' },
        ].map(l => (
          <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 2, background: l.color, display: 'inline-block', borderRadius: 1 }} />
            {l.label}
          </span>
        ))}
        <span style={{ marginLeft: 'auto', color: TV.textDim }}>
          ← → Arrow keys to change period · Scroll to zoom
        </span>
      </div>
    </div>
  );
}

// ── Legacy named exports so old imports still work ────────────────────────────
export const MACDChart       = () => <MultiPaneChart />;
export const BollingerChart  = () => <MultiPaneChart />;
export const RSIChart        = () => <MultiPaneChart />;
export const CandlestickChart = () => <MultiPaneChart />;
export default MultiPaneChart;
