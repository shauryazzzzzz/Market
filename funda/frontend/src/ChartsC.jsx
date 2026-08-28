/**
 * Section C: Fundamental & Valuation Charts
 * - PE Band Chart
 * - ROE Time-Series (multi-ticker with sector average)
 * - Financial Trend (Revenue, EPS)
 * - KPI Summary Cards
 */
import React, { useState, useEffect, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { useStore } from './store.jsx';
import { fetchFundamentals, fetchOHLCV, fetchTickerMetrics } from './api';
import { ChartSkeleton, EmptyState, DateRangeSelector, exportChartPNG, exportCSV, KpiCard, CHART_COLORS, fmtNum } from './utils';

function useTickerOHLCV(ticker, period) {
  const { state, dispatch } = useStore();
  const key = `${ticker}__${period}`;
  const cached = state.ohlcvCache[key];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!ticker || cached) return;
    setLoading(true);
    setError(null);
    fetchOHLCV(ticker, period)
      .then(data => { dispatch({ type: 'SET_OHLCV', key, payload: data }); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [ticker, period]);

  return { data: cached || [], loading, error };
}

// ── KPI Cards Row ─────────────────────────────────────────────────────────────
export function FundamentalsKPIRow() {
  const { state, dispatch } = useStore();
  const { selectedTickers, fundaCache } = state;

  useEffect(() => {
    if (!selectedTickers.length) return;
    const missing = selectedTickers.filter(t => !fundaCache[t]);
    if (!missing.length) return;
    fetchFundamentals(missing).then(data => {
      data.forEach((d, i) => {
        if (d) dispatch({ type: 'SET_FUNDA', ticker: missing[i], payload: d });
      });
    }).catch(() => {});
  }, [selectedTickers]);

  if (!selectedTickers.length) {
    return (
      <div className="kpi-row">
        <div style={{ color: 'var(--muted)', fontSize: 13, padding: '16px 0' }}>Select tickers to see fundamentals KPIs</div>
      </div>
    );
  }

  return (
    <div>
      {selectedTickers.map(ticker => {
        const f = fundaCache[ticker];
        return (
          <div key={ticker} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 8, fontFamily: 'var(--mono)' }}>
              {f?.name || ticker}
              {f?.sector && <span style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: 8 }}>{f.sector}</span>}
            </div>
            <div className="stats-grid">
              <KpiCard label="P/E Ratio" value={f?.pe != null ? fmtNum(f.pe, 1) : null} sub="Price / Earnings" />
              <KpiCard label="ROE" value={f?.roe != null ? `${fmtNum(f.roe, 1)}%` : null} sub="Return on Equity" color={f?.roe > 15 ? 'var(--positive)' : f?.roe < 0 ? 'var(--negative)' : undefined} />
              <KpiCard label="EPS" value={f?.eps != null ? fmtNum(f.eps, 2) : null} sub="Earnings per Share" />
              <KpiCard label="Market Cap" value={f?.mcap != null ? `₹${fmtNum(f.mcap / 1e9, 1)}B` : null} sub="Billion ₹" />
              <KpiCard label="Revenue" value={f?.revenue != null ? `₹${fmtNum(f.revenue / 1e9, 1)}B` : null} sub="Billion ₹" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── PE Band Chart ─────────────────────────────────────────────────────────────
export function PEBandChart() {
  const { state, dispatch } = useStore();
  const { selectedTickers, fundaCache } = state;
  const [ticker, setTicker] = useState('');
  const [period, setPeriod] = useState('1Y');
  const [bands, setBands] = useState([10, 15, 20, 25, 30]);
  const chartRef = useRef(null);

  useEffect(() => {
    if (selectedTickers.length && !ticker) setTicker(selectedTickers[0]);
  }, [selectedTickers]);

  const activeTicker = ticker || selectedTickers[0] || '';
  const { data, loading, error } = useTickerOHLCV(activeTicker, period);

  useEffect(() => {
    if (!activeTicker || fundaCache[activeTicker]) return;
    fetchFundamentals([activeTicker]).then(d => {
      if (d[0]) dispatch({ type: 'SET_FUNDA', ticker: activeTicker, payload: d[0] });
    }).catch(() => {});
  }, [activeTicker]);

  if (!selectedTickers.length) return <EmptyState message="Select tickers to see PE Band chart" />;
  if (loading) return <ChartSkeleton title="PE Band Chart" />;
  if (!data.length) return <EmptyState message={`No price history for ${activeTicker}`} />;

  const f = fundaCache[activeTicker];
  const eps = f?.eps || null;
  const dates = data.map(d => d.date);
  const closes = data.map(d => d.close);

  const bandSeries = bands.map((pe, i) => ({
    name: `${pe}x PE`,
    type: 'line',
    data: eps != null ? closes.map(() => +(eps * pe).toFixed(2)) : [],
    lineStyle: { type: 'dashed', width: 1, color: CHART_COLORS[(i + 2) % CHART_COLORS.length] },
    symbol: 'none',
    label: { show: false },
  }));

  const option = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', textStyle: { fontSize: 11 } },
    legend: {
      data: ['Price', ...bands.map(b => `${b}x PE`)],
      bottom: 0,
      textStyle: { color: '#6b7a99', fontSize: 11 },
    },
    grid: { top: 20, bottom: 60, left: 60, right: 20 },
    xAxis: {
      type: 'category', data: dates, boundaryGap: false,
      axisLabel: { color: '#6b7a99', fontSize: 10, rotate: 20 },
      axisLine: { lineStyle: { color: '#1e2d45' } },
    },
    yAxis: {
      type: 'value', scale: true,
      axisLabel: { color: '#6b7a99', fontSize: 10 },
      axisLine: { lineStyle: { color: '#1e2d45' } },
      splitLine: { lineStyle: { color: '#1e2d45', type: 'dashed' } },
    },
    dataZoom: [{ type: 'inside' }, { type: 'slider', bottom: 30, height: 18, borderColor: '#1e2d45', textStyle: { color: '#6b7a99' } }],
    series: [
      {
        name: 'Price',
        type: 'line',
        data: closes,
        lineStyle: { color: '#00d4ff', width: 2 },
        areaStyle: { color: 'rgba(0,212,255,0.07)' },
        symbol: 'none',
        z: 10,
      },
      ...bandSeries,
    ],
  };

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <div className="chart-card-title">P/E Band Chart — {activeTicker}{eps == null ? ' (EPS not found — bands not shown)' : ''}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="chart-select" value={ticker} onChange={e => setTicker(e.target.value)}>
            {selectedTickers.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <DateRangeSelector value={period} onChange={setPeriod} />
          <button className="chart-export-btn" onClick={() => exportChartPNG(chartRef, `pe-band-${activeTicker}`)}>⬇ PNG</button>
        </div>
      </div>
      <ReactECharts ref={chartRef} option={option} style={{ height: 380 }} theme="dark" />
    </div>
  );
}

// ── ROE Comparison Chart ──────────────────────────────────────────────────────
export function ROEChart() {
  const { state, dispatch } = useStore();
  const { selectedTickers, fundaCache } = state;
  const chartRef = useRef(null);
  const [sectorAvg, setSectorAvg] = React.useState(null);

  useEffect(() => {
    if (!selectedTickers.length) return;
    const missing = selectedTickers.filter(t => !fundaCache[t]);
    if (!missing.length) return;
    fetchFundamentals(missing).then(data => {
      data.forEach((d, i) => { if (d) dispatch({ type: 'SET_FUNDA', ticker: missing[i], payload: d }); });
    });
  }, [selectedTickers]);

  // Compute sector average from all tickers
  useEffect(() => {
    const roes = selectedTickers.map(t => fundaCache[t]?.roe).filter(v => v != null);
    if (roes.length) setSectorAvg(roes.reduce((a, b) => a + b, 0) / roes.length);
  }, [selectedTickers, fundaCache]);

  if (!selectedTickers.length) return <EmptyState message="Select tickers to see ROE comparison" />;

  const labels = selectedTickers.map(t => fundaCache[t]?.name || t);
  const roeValues = selectedTickers.map(t => {
    const v = fundaCache[t]?.roe;
    return v != null ? +v.toFixed(2) : null;
  });

  const option = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', textStyle: { fontSize: 11 } },
    legend: { data: ['ROE %', 'Sector Avg'], bottom: 0, textStyle: { color: '#6b7a99', fontSize: 11 } },
    grid: { top: 20, bottom: 60, left: 60, right: 20 },
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: { color: '#6b7a99', fontSize: 11, rotate: labels.length > 4 ? 25 : 0 },
      axisLine: { lineStyle: { color: '#1e2d45' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#6b7a99', fontSize: 10, formatter: v => `${v}%` },
      axisLine: { lineStyle: { color: '#1e2d45' } },
      splitLine: { lineStyle: { color: '#1e2d45', type: 'dashed' } },
    },
    series: [
      {
        name: 'ROE %',
        type: 'bar',
        data: roeValues.map((v, i) => ({
          value: v,
          itemStyle: { color: v == null ? '#1e2d45' : v > 15 ? '#00ff88' : v > 0 ? '#ffaa00' : '#ff4444' },
        })),
        barMaxWidth: 60,
        label: { show: true, position: 'top', color: '#6b7a99', fontSize: 10, formatter: p => p.value != null ? `${p.value}%` : '' },
      },
      ...(sectorAvg != null ? [{
        name: 'Sector Avg',
        type: 'line',
        data: labels.map(() => +sectorAvg.toFixed(2)),
        lineStyle: { color: '#a78bfa', type: 'dashed', width: 1.5 },
        symbol: 'none',
        label: { show: false },
      }] : []),
    ],
  };

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <div className="chart-card-title">Return on Equity (ROE) Comparison</div>
        <button className="chart-export-btn" onClick={() => exportChartPNG(chartRef, 'roe-chart')}>⬇ PNG</button>
      </div>
      <ReactECharts ref={chartRef} option={option} style={{ height: 340 }} theme="dark" />
    </div>
  );
}

// ── Financial Trend Chart (Revenue + EPS bar) ─────────────────────────────────
export function FinancialTrendChart() {
  const { state, dispatch } = useStore();
  const { selectedTickers, fundaCache } = state;
  const chartRef = useRef(null);

  useEffect(() => {
    if (!selectedTickers.length) return;
    const missing = selectedTickers.filter(t => !fundaCache[t]);
    if (!missing.length) return;
    fetchFundamentals(missing).then(data => {
      data.forEach((d, i) => { if (d) dispatch({ type: 'SET_FUNDA', ticker: missing[i], payload: d }); });
    });
  }, [selectedTickers]);

  if (!selectedTickers.length) return <EmptyState message="Select tickers to see financial trends" />;

  const labels = selectedTickers.map(t => fundaCache[t]?.name || t);

  const option = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', textStyle: { fontSize: 11 } },
    legend: { data: ['Revenue (B)', 'EPS'], bottom: 0, textStyle: { color: '#6b7a99', fontSize: 11 } },
    grid: { top: 20, bottom: 60, left: 60, right: 60 },
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: { color: '#6b7a99', fontSize: 11, rotate: labels.length > 4 ? 25 : 0 },
      axisLine: { lineStyle: { color: '#1e2d45' } },
    },
    yAxis: [
      {
        type: 'value', name: 'Revenue (B)', nameTextStyle: { color: '#6b7a99', fontSize: 10 },
        axisLabel: { color: '#6b7a99', fontSize: 10 },
        axisLine: { lineStyle: { color: '#1e2d45' } },
        splitLine: { lineStyle: { color: '#1e2d45', type: 'dashed' } },
      },
      {
        type: 'value', name: 'EPS', nameTextStyle: { color: '#6b7a99', fontSize: 10 },
        axisLabel: { color: '#6b7a99', fontSize: 10 },
        axisLine: { lineStyle: { color: '#1e2d45' } },
        splitLine: { show: false },
        position: 'right',
      },
    ],
    series: [
      {
        name: 'Revenue (B)',
        type: 'bar',
        yAxisIndex: 0,
        data: selectedTickers.map(t => {
          const v = fundaCache[t]?.revenue;
          return v != null ? +(v / 1e9).toFixed(2) : null;
        }),
        barMaxWidth: 50,
        itemStyle: { color: '#00d4ff', opacity: 0.8 },
        label: { show: true, position: 'top', color: '#6b7a99', fontSize: 10, formatter: p => p.value != null ? `${p.value}B` : '' },
      },
      {
        name: 'EPS',
        type: 'line',
        yAxisIndex: 1,
        data: selectedTickers.map(t => {
          const v = fundaCache[t]?.eps;
          return v != null ? +v.toFixed(2) : null;
        }),
        lineStyle: { color: '#ffaa00', width: 2 },
        symbol: 'circle',
        symbolSize: 7,
        itemStyle: { color: '#ffaa00' },
      },
    ],
  };

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <div className="chart-card-title">Financial Snapshot — Revenue & EPS</div>
        <button className="chart-export-btn" onClick={() => exportChartPNG(chartRef, 'financial-trend')}>⬇ PNG</button>
      </div>
      <ReactECharts ref={chartRef} option={option} style={{ height: 340 }} theme="dark" />
    </div>
  );
}
