/**
 * Section D: Extended Chart Library
 * All chart types from the requirements table, rendered from OHLCV data.
 * Accessible via a chart-type selector panel.
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { useStore } from './store.jsx';
import { fetchOHLCV } from './api';
import { ChartSkeleton, EmptyState, DateRangeSelector, exportChartPNG, exportCSV, CHART_COLORS } from './utils';

// ── Hook: OHLCV from cache ────────────────────────────────────────────────────
function useTickerOHLCV(ticker, period) {
  const { state, dispatch } = useStore();
  const key = `${ticker}__${period}`;
  const cached = state.ohlcvCache[key];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!ticker || cached) return;
    setLoading(true); setError(null);
    fetchOHLCV(ticker, period)
      .then(d => { dispatch({ type: 'SET_OHLCV', key, payload: d }); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [ticker, period]);
  return { data: cached || [], loading, error };
}

// ── Heikin-Ashi transform ─────────────────────────────────────────────────────
function toHeikinAshi(data) {
  return data.map((d, i) => {
    const prev = data[i - 1];
    const haClose = (d.open + d.high + d.low + d.close) / 4;
    const haOpen = prev ? (prev.open + prev.close) / 2 : (d.open + d.close) / 2;
    const haHigh = Math.max(d.high ?? haOpen, haOpen, haClose);
    const haLow = Math.min(d.low ?? haOpen, haOpen, haClose);
    return { ...d, open: haOpen, high: haHigh, low: haLow, close: haClose };
  });
}

// ── Volume profile (price bins) ───────────────────────────────────────────────
function buildVolumeProfile(data, bins = 30) {
  const closes = data.map(d => d.close).filter(v => v != null);
  if (!closes.length) return [];
  const min = Math.min(...closes), max = Math.max(...closes);
  const step = (max - min) / bins;
  const profile = Array.from({ length: bins }, (_, i) => ({
    price: +(min + i * step + step / 2).toFixed(2),
    volume: 0,
  }));
  data.forEach(d => {
    const idx = Math.min(Math.floor((d.close - min) / step), bins - 1);
    if (idx >= 0) profile[idx].volume += d.volume || 0;
  });
  return profile;
}

// ── Returns distribution ──────────────────────────────────────────────────────
function buildReturnsHistogram(data, bins = 20) {
  const returns = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i].close && data[i - 1].close) {
      returns.push((data[i].close - data[i - 1].close) / data[i - 1].close * 100);
    }
  }
  if (!returns.length) return [];
  const min = Math.min(...returns), max = Math.max(...returns);
  const step = (max - min) / bins;
  const hist = Array.from({ length: bins }, (_, i) => ({ range: +(min + i * step).toFixed(2), count: 0 }));
  returns.forEach(r => {
    const idx = Math.min(Math.floor((r - min) / step), bins - 1);
    if (idx >= 0) hist[idx].count++;
  });
  return hist;
}

// ── Scatter: Beta vs Return ───────────────────────────────────────────────────
function computeBetaReturn(data) {
  if (data.length < 2) return { beta: null, totalReturn: null };
  const closes = data.map(d => d.close).filter(v => v != null);
  const first = closes[0], last = closes[closes.length - 1];
  const totalReturn = ((last - first) / first) * 100;
  const dailyReturns = [];
  for (let i = 1; i < closes.length; i++) {
    dailyReturns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  const avg = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / dailyReturns.length;
  const beta = Math.sqrt(variance) * Math.sqrt(252); // annualized volatility as proxy for beta
  return { beta: +beta.toFixed(3), totalReturn: +totalReturn.toFixed(2) };
}

// ── Chart type definitions ────────────────────────────────────────────────────
export const CHART_TYPES = [
  { id: 'line',        label: 'Line Chart',             category: 'Price' },
  { id: 'area',        label: 'Area / Mountain',        category: 'Price' },
  { id: 'ohlc_bar',   label: 'OHLC Bar',               category: 'Price' },
  { id: 'candlestick', label: 'Candlestick',            category: 'Price' },
  { id: 'baseline',   label: 'Baseline / Delta',        category: 'Price' },
  { id: 'heikin',     label: 'Heikin-Ashi',             category: 'Noise-Filtered' },
  { id: 'renko',      label: 'Renko (simulated)',       category: 'Noise-Filtered' },
  { id: 'vol_profile', label: 'Volume Profile',         category: 'Volume' },
  { id: 'scatter',    label: 'Scatter: Beta vs Return', category: 'Statistical' },
  { id: 'histogram',  label: 'Returns Distribution',   category: 'Statistical' },
  { id: 'comparison', label: 'Multi-Ticker Comparison', category: 'Comparison' },
];

// ── Main Extended Chart component ─────────────────────────────────────────────
export default function ExtendedChartLibrary() {
  const { state } = useStore();
  const { selectedTickers } = state;
  const [chartType, setChartType] = useState('candlestick');
  const [ticker, setTicker] = useState('');
  const [period, setPeriod] = useState('3M');
  const chartRef = useRef(null);

  useEffect(() => {
    if (selectedTickers.length && !ticker) setTicker(selectedTickers[0]);
  }, [selectedTickers]);

  const activeTicker = ticker || selectedTickers[0] || '';
  const { data, loading, error } = useTickerOHLCV(activeTicker, period);

  const categories = [...new Set(CHART_TYPES.map(c => c.category))];

  if (!selectedTickers.length) return <EmptyState message="Select tickers to access the extended chart library" />;

  return (
    <div>
      {/* Chart Type Selector Panel */}
      <div className="chart-type-panel">
        {categories.map(cat => (
          <div key={cat} className="chart-type-category">
            <div className="chart-type-category-label">{cat}</div>
            <div className="chart-type-btn-row">
              {CHART_TYPES.filter(c => c.category === cat).map(c => (
                <button
                  key={c.id}
                  className={`chart-type-btn${chartType === c.id ? ' active' : ''}`}
                  onClick={() => setChartType(c.id)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Ticker + Period Controls */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '16px 0', flexWrap: 'wrap' }}>
        <select className="chart-select" value={ticker} onChange={e => setTicker(e.target.value)}>
          {selectedTickers.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <DateRangeSelector value={period} onChange={setPeriod} />
        <button className="chart-export-btn" onClick={() => exportChartPNG(chartRef, `${chartType}-${activeTicker}`)}>⬇ PNG</button>
        <button className="chart-export-btn" onClick={() => exportCSV(data, `${activeTicker}-ohlcv`)}>⬇ CSV</button>
      </div>

      {loading && <ChartSkeleton title={CHART_TYPES.find(c => c.id === chartType)?.label} />}
      {error && <EmptyState message={`Data load failed: ${error}`} />}
      {!loading && !error && (
        <ChartRenderer
          chartType={chartType}
          data={data}
          ticker={activeTicker}
          allTickers={selectedTickers}
          allOHLCV={state.ohlcvCache}
          period={period}
          chartRef={chartRef}
        />
      )}
    </div>
  );
}

// ── Chart renderer dispatcher ─────────────────────────────────────────────────
function ChartRenderer({ chartType, data, ticker, allTickers, allOHLCV, period, chartRef }) {
  const option = useMemo(() => {
    if (!data.length && chartType !== 'scatter' && chartType !== 'comparison') return null;
    switch (chartType) {
      case 'line':     return buildLineOption(data);
      case 'area':     return buildAreaOption(data);
      case 'ohlc_bar': return buildOHLCBarOption(data);
      case 'candlestick': return buildCandlestickOption(data);
      case 'baseline': return buildBaselineOption(data);
      case 'heikin':   return buildHeikinOption(data);
      case 'renko':    return buildRenkoOption(data);
      case 'vol_profile': return buildVolProfileOption(data);
      case 'scatter':  return buildScatterOption(allTickers, allOHLCV, period);
      case 'histogram': return buildHistogramOption(data);
      case 'comparison': return buildComparisonOption(allTickers, allOHLCV, period);
      default: return null;
    }
  }, [chartType, data, allTickers, allOHLCV, period]);

  if (!option) return <EmptyState message={`No data available for ${ticker} to render this chart type`} />;

  return <ReactECharts ref={chartRef} option={option} style={{ height: 440 }} theme="dark" />;
}

// ── Option builders ───────────────────────────────────────────────────────────

const baseGrid = { top: 20, bottom: 60, left: 60, right: 20 };
const baseXAxis = (dates) => ({
  type: 'category', data: dates, boundaryGap: false,
  axisLabel: { color: '#6b7a99', fontSize: 10, rotate: 20 },
  axisLine: { lineStyle: { color: '#1e2d45' } },
  splitLine: { show: false },
});
const baseYAxis = { type: 'value', scale: true, axisLabel: { color: '#6b7a99', fontSize: 10 }, axisLine: { lineStyle: { color: '#1e2d45' } }, splitLine: { lineStyle: { color: '#1e2d45', type: 'dashed' } } };
const baseZoom = [{ type: 'inside' }, { type: 'slider', bottom: 30, height: 18, borderColor: '#1e2d45', textStyle: { color: '#6b7a99' } }];

function buildLineOption(data) {
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    grid: baseGrid,
    xAxis: baseXAxis(data.map(d => d.date)),
    yAxis: baseYAxis,
    dataZoom: baseZoom,
    series: [{ name: 'Close', type: 'line', data: data.map(d => d.close), lineStyle: { color: '#00d4ff', width: 2 }, symbol: 'none', connectNulls: false }],
  };
}

function buildAreaOption(data) {
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    grid: baseGrid,
    xAxis: baseXAxis(data.map(d => d.date)),
    yAxis: baseYAxis,
    dataZoom: baseZoom,
    series: [{
      name: 'Close', type: 'line', data: data.map(d => d.close),
      lineStyle: { color: '#00d4ff', width: 1.5 }, symbol: 'none',
      areaStyle: {
        color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: 'rgba(0,212,255,0.3)' }, { offset: 1, color: 'rgba(0,212,255,0.01)' }] },
      },
    }],
  };
}

function buildOHLCBarOption(data) {
  const hasOHLC = data.some(d => d.open != null);
  if (!hasOHLC) return buildLineOption(data);
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    grid: baseGrid,
    xAxis: baseXAxis(data.map(d => d.date)),
    yAxis: baseYAxis,
    dataZoom: baseZoom,
    series: [{
      name: 'OHLC',
      type: 'candlestick',
      data: data.map(d => [d.open, d.close, d.low, d.high]),
      itemStyle: { color: '#00ff88', color0: '#ff4444', borderColor: '#00ff88', borderColor0: '#ff4444' },
    }],
  };
}

function buildCandlestickOption(data) {
  return buildOHLCBarOption(data); // same
}

function buildBaselineOption(data) {
  const closes = data.map(d => d.close).filter(v => v != null);
  if (!closes.length) return null;
  const baseline = closes[0];
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', formatter: p => `${p[0].name}: ${p[0].value?.toFixed(2)} (${((p[0].value - baseline) / baseline * 100).toFixed(2)}%)` },
    grid: baseGrid,
    xAxis: baseXAxis(data.map(d => d.date)),
    yAxis: baseYAxis,
    dataZoom: baseZoom,
    series: [{
      name: 'Price',
      type: 'line',
      data: data.map(d => d.close),
      lineStyle: { width: 2, color: '#00d4ff' },
      symbol: 'none',
      markLine: { silent: true, symbol: 'none', data: [{ yAxis: baseline, lineStyle: { color: '#ffaa00', type: 'dashed', width: 1 }, label: { formatter: `Base ${baseline?.toFixed(2)}`, color: '#ffaa00', fontSize: 10 } }] },
      areaStyle: {
        color: (params) => params.value >= baseline ? 'rgba(0,255,136,0.15)' : 'rgba(255,68,68,0.15)',
        origin: baseline,
      },
    }],
  };
}

function buildHeikinOption(data) {
  const ha = toHeikinAshi(data);
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    grid: baseGrid,
    xAxis: baseXAxis(ha.map(d => d.date)),
    yAxis: baseYAxis,
    dataZoom: baseZoom,
    series: [{
      name: 'Heikin-Ashi',
      type: 'candlestick',
      data: ha.map(d => [d.open, d.close, d.low, d.high]),
      itemStyle: { color: '#00ff88', color0: '#ff4444', borderColor: '#00ff88', borderColor0: '#ff4444' },
    }],
  };
}

function buildRenkoOption(data) {
  // Renko: fixed-brick-size filtering
  const closes = data.map(d => d.close).filter(v => v != null);
  if (closes.length < 2) return null;
  const range = Math.max(...closes) - Math.min(...closes);
  const brickSize = +(range / 20).toFixed(2);
  const bricks = [];
  let base = closes[0];
  for (let i = 1; i < closes.length; i++) {
    while (closes[i] >= base + brickSize) {
      bricks.push({ start: base, end: base + brickSize, up: true });
      base += brickSize;
    }
    while (closes[i] <= base - brickSize) {
      bricks.push({ start: base, end: base - brickSize, up: false });
      base -= brickSize;
    }
  }
  if (!bricks.length) return buildLineOption(data);
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    grid: { top: 20, bottom: 60, left: 60, right: 20 },
    xAxis: { type: 'category', data: bricks.map((_, i) => i + 1), axisLabel: { color: '#6b7a99', fontSize: 10 }, axisLine: { lineStyle: { color: '#1e2d45' } } },
    yAxis: { type: 'value', scale: true, axisLabel: { color: '#6b7a99', fontSize: 10 }, axisLine: { lineStyle: { color: '#1e2d45' } }, splitLine: { lineStyle: { color: '#1e2d45', type: 'dashed' } } },
    dataZoom: baseZoom,
    series: [{
      type: 'candlestick',
      data: bricks.map(b => [b.start, b.end, Math.min(b.start, b.end), Math.max(b.start, b.end)]),
      itemStyle: { color: '#00ff88', color0: '#ff4444', borderColor: '#00ff88', borderColor0: '#ff4444' },
      name: `Renko (brick: ${brickSize})`,
    }],
  };
}

function buildVolProfileOption(data) {
  const profile = buildVolumeProfile(data, 30);
  if (!profile.length) return null;
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', formatter: p => `Price: ${p[0].name} — Vol: ${p[0].value?.toLocaleString()}` },
    grid: { top: 20, bottom: 60, left: 80, right: 20 },
    xAxis: { type: 'value', axisLabel: { color: '#6b7a99', fontSize: 10 }, axisLine: { lineStyle: { color: '#1e2d45' } }, splitLine: { lineStyle: { color: '#1e2d45', type: 'dashed' } } },
    yAxis: { type: 'category', data: profile.map(p => p.price), axisLabel: { color: '#6b7a99', fontSize: 10 }, axisLine: { lineStyle: { color: '#1e2d45' } } },
    series: [{
      name: 'Volume at Price',
      type: 'bar',
      data: profile.map(p => p.volume),
      barMaxWidth: 30,
      itemStyle: { color: (params) => params.value > Math.max(...profile.map(p => p.volume)) * 0.7 ? '#00d4ff' : 'rgba(0,212,255,0.4)' },
    }],
  };
}

function buildScatterOption(allTickers, allOHLCV, period) {
  const points = allTickers.map((t, i) => {
    const data = allOHLCV[`${t}__${period}`] || allOHLCV[`${t}__all`] || [];
    if (!data.length) return null;
    const { beta, totalReturn } = computeBetaReturn(data);
    return { name: t, value: [beta, totalReturn], symbolSize: 12, itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] } };
  }).filter(Boolean);

  if (!points.length) return null;
  return {
    backgroundColor: 'transparent',
    tooltip: {
      formatter: p => `${p.data.name}<br/>Volatility: ${p.data.value[0]}<br/>Total Return: ${p.data.value[1]}%`,
    },
    xAxis: {
      type: 'value', name: 'Annualized Volatility (Beta Proxy)', nameTextStyle: { color: '#6b7a99', fontSize: 10 },
      axisLabel: { color: '#6b7a99', fontSize: 10 }, axisLine: { lineStyle: { color: '#1e2d45' } },
      splitLine: { lineStyle: { color: '#1e2d45', type: 'dashed' } },
    },
    yAxis: {
      type: 'value', name: 'Total Return %', nameTextStyle: { color: '#6b7a99', fontSize: 10 },
      axisLabel: { color: '#6b7a99', fontSize: 10 }, axisLine: { lineStyle: { color: '#1e2d45' } },
      splitLine: { lineStyle: { color: '#1e2d45', type: 'dashed' } },
    },
    series: [{
      type: 'scatter',
      data: points,
      label: { show: true, position: 'top', formatter: p => p.data.name, color: '#6b7a99', fontSize: 10 },
    }],
  };
}

function buildHistogramOption(data) {
  const hist = buildReturnsHistogram(data, 25);
  if (!hist.length) return null;
  const avg = hist.reduce((a, b) => a + b.range * b.count, 0) / hist.reduce((a, b) => a + b.count, 0);
  return {
    backgroundColor: 'transparent',
    tooltip: { formatter: p => `Return: ${p.name}% — Count: ${p.value}` },
    grid: { top: 20, bottom: 60, left: 60, right: 20 },
    xAxis: { type: 'category', data: hist.map(h => `${h.range}%`), axisLabel: { color: '#6b7a99', fontSize: 9, rotate: 30 }, axisLine: { lineStyle: { color: '#1e2d45' } } },
    yAxis: { type: 'value', axisLabel: { color: '#6b7a99', fontSize: 10 }, axisLine: { lineStyle: { color: '#1e2d45' } }, splitLine: { lineStyle: { color: '#1e2d45', type: 'dashed' } } },
    series: [
      {
        name: 'Return Frequency',
        type: 'bar',
        data: hist.map(h => ({
          value: h.count,
          itemStyle: { color: h.range < 0 ? 'rgba(255,68,68,0.7)' : 'rgba(0,255,136,0.7)' },
        })),
        markLine: { silent: true, symbol: 'none', data: [{ xAxis: avg.toFixed(2) + '%', lineStyle: { color: '#ffaa00', type: 'dashed' }, label: { formatter: `avg ${avg.toFixed(2)}%`, color: '#ffaa00', fontSize: 10 } }] },
      },
    ],
  };
}

function buildComparisonOption(allTickers, allOHLCV, period) {
  const series = allTickers.map((t, i) => {
    const data = allOHLCV[`${t}__${period}`] || allOHLCV[`${t}__all`] || [];
    if (!data.length) return null;
    const first = data.find(d => d.close != null)?.close || 1;
    return {
      name: t,
      type: 'line',
      data: data.map(d => ({ value: d.close != null ? +((d.close / first - 1) * 100).toFixed(2) : null, name: d.date })),
      lineStyle: { color: CHART_COLORS[i % CHART_COLORS.length], width: 2 },
      symbol: 'none',
      connectNulls: false,
    };
  }).filter(Boolean);

  if (!series.length) return null;
  const allDates = (allOHLCV[`${allTickers[0]}__${period}`] || allOHLCV[`${allTickers[0]}__all`] || []).map(d => d.date);

  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', textStyle: { fontSize: 11 } },
    legend: { data: allTickers, bottom: 0, textStyle: { color: '#6b7a99', fontSize: 11 } },
    grid: { top: 20, bottom: 60, left: 60, right: 20 },
    xAxis: baseXAxis(allDates),
    yAxis: { type: 'value', axisLabel: { color: '#6b7a99', fontSize: 10, formatter: v => `${v}%` }, axisLine: { lineStyle: { color: '#1e2d45' } }, splitLine: { lineStyle: { color: '#1e2d45', type: 'dashed' } } },
    dataZoom: baseZoom,
    series,
  };
}
