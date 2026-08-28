/**
 * Section A: Comparison & Relational Charts
 *
 * 1. TradingView-style Sector Heatmap (Treemap) — tiles sized by market cap, colored by % change
 * 2. Intra-Sector Ticker Heatmap  — per-ticker fundamental metrics matrix
 * 3. Multi-Ticker Radar Chart     — overlaid fundamental comparison
 * 4. Sankey: Sector → Ticker Capital Flow weighted by market cap
 * 5. Leading/Lagging Signals panel
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { useStore } from './store.jsx';
import { fetchFundamentals, fetchSectorMetrics, fetchTickerMetrics, fetchSankeyData, fetchTreemapData } from './api';
import { ChartSkeleton, EmptyState, exportChartPNG, exportCSV } from './utils';

const CHART_COLORS = ['#00d4ff', '#00ff88', '#ffaa00', '#ff6b6b', '#a78bfa', '#34d399', '#f59e0b', '#ec4899'];

// ── Color scale: red → neutral → green (for % change) ────────────────────────
function chgColor(pct) {
  if (pct == null) return '#1e2d45';
  // Strong green > +3%, light green +1–3%, near-zero grey ±1%, light red -1–3%, strong red < -3%
  if (pct >= 3)   return '#0a7c3c';
  if (pct >= 1)   return '#1a9e52';
  if (pct >= 0)   return '#256e3b';
  if (pct >= -1)  return '#7a3020';
  if (pct >= -3)  return '#b03020';
  return '#c0392b';
}
function chgText(pct) {
  if (pct == null) return '#8899aa';
  return Math.abs(pct) < 1.5 ? '#ccd5e0' : '#ffffff';
}

// ══════════════════════════════════════════════════════════════════
//  1. TradingView-style Sector Treemap Heatmap
//     Tiles = tickers, size = market cap, color = daily % change
//     Grouped by sector with sector total shown as parent
// ══════════════════════════════════════════════════════════════════
export function SectorHeatmap() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [filter, setFilter]   = useState('all');       // all | positive | negative
  const [sizeBy, setSizeBy]   = useState('mcap');      // mcap | volume
  const [colorBy, setColorBy] = useState('chgPct');    // chgPct | rsi | abs
  const chartRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    fetchTreemapData()
      .then(items => { setData(items); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return <ChartSkeleton title="Sector Heatmap (TradingView-style)" />;
  if (error)   return <EmptyState message={`Failed to load treemap: ${error}`} />;
  if (!data?.length) return <EmptyState message="No sector data available. Ensure bhavdata and mcap files are in DATA folder." />;

  // Filter
  const visible = data.filter(d => {
    if (filter === 'positive') return (d.chgPct ?? 0) >= 0;
    if (filter === 'negative') return (d.chgPct ?? 0) < 0;
    return true;
  });

  // Group by sector → build ECharts treemap format
  // ECharts treemap: { name, value, children:[{name,value,itemStyle:{color}},...] }
  const sectorGroups = {};
  for (const item of visible) {
    if (!sectorGroups[item.sector]) sectorGroups[item.sector] = [];
    sectorGroups[item.sector].push(item);
  }

  // Which value drives tile SIZE
  const sizeVal = (t) => {
    if (sizeBy === 'mcap')   return t.mcap   || 1;
    return 1; // equal size fallback
  };
  // Which metric drives tile COLOR
  const colorVal = (t) => {
    if (colorBy === 'chgPct') return t.chgPct;
    if (colorBy === 'abs')    return t.close;
    return t.chgPct; // default
  };

  const treeData = Object.entries(sectorGroups)
    .map(([sector, tickers]) => {
      const sectorSize = tickers.reduce((s, t) => s + sizeVal(t), 0);
      const chgVals    = tickers.map(t => t.chgPct).filter(v => v != null);
      const avgChg     = chgVals.length ? chgVals.reduce((a, b) => a + b, 0) / chgVals.length : null;

      return {
        name:    sector,
        value:   sectorSize,
        _avgChg: avgChg,
        children: tickers
          .sort((a, b) => sizeVal(b) - sizeVal(a))
          .map(t => {
            const cv = colorVal(t);
            return {
              name:   t.ticker,
              value:  sizeVal(t),
              _chg:   t.chgPct,
              _close: t.close,
              _name:  t.name,
              _pe:    t.pe,
              itemStyle: { color: chgColor(cv), borderColor: '#0a0e1a', borderWidth: 1 },
              label:     { color: chgText(cv), fontSize: 11, fontWeight: 'bold' },
            };
          }),
      };
    })
    .sort((a, b) => b.value - a.value); // largest sectors first

  // Stats for the legend bar
  const allChgs = visible.map(d => d.chgPct).filter(v => v != null);
  const advancing = allChgs.filter(v => v >= 0).length;
  const declining = allChgs.filter(v => v < 0).length;

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      formatter: p => {
        const d = p.data;
        if (!d._chg && d._avgChg == null) return d.name;
        if (d.children) {
          // sector node
          return `<b>${d.name}</b><br/>Avg change: ${d._avgChg != null ? d._avgChg.toFixed(2) + '%' : 'N/A'}`;
        }
        const chgStr = d._chg != null ? `${d._chg >= 0 ? '+' : ''}${d._chg.toFixed(2)}%` : 'N/A';
        const peStr  = d._pe  != null ? `P/E ${d._pe.toFixed(1)}` : '';
        return [
          `<b>${d.name}</b>  <span style="color:${chgColor(d._chg)}">${chgStr}</span>`,
          d._close != null ? `₹${(+d._close).toLocaleString()}` : '',
          peStr,
          `<span style="color:#8899aa;font-size:10px">${d._name || ''}</span>`,
        ].filter(Boolean).join('<br/>');
      },
    },
    series: [{
      type: 'treemap',
      data: treeData,
      width:  '100%',
      height: '100%',
      roam: false,
      nodeClick: false,
      breadcrumb: {
        show: true,
        height: 22,
        itemStyle: { color: '#12182c', borderColor: '#1e2d45', textStyle: { color: '#8899aa', fontSize: 11 } },
      },
      levels: [
        // Level 0 = sector groups
        {
          itemStyle: { borderColor: '#0a0e1a', borderWidth: 3, gapWidth: 3 },
          upperLabel: {
            show: true,
            height: 22,
            color: '#c8d4e8',
            fontWeight: 'bold',
            fontSize: 11,
            backgroundColor: 'rgba(10,14,26,0.85)',
            padding: [4, 6],
          },
        },
        // Level 1 = individual tickers
        {
          itemStyle: { borderColor: '#0a0e1a', borderWidth: 1, gapWidth: 1 },
          label: {
            show: true,
            position: 'inside',
            formatter: p => {
              const d = p.data;
              const chgStr = d._chg != null ? `${d._chg >= 0 ? '+' : ''}${d._chg.toFixed(2)}%` : '';
              return `{ticker|${d.name}}\n{chg|${chgStr}}`;
            },
            rich: {
              ticker: { fontSize: 11, fontWeight: 'bold', color: '#ffffff', lineHeight: 16 },
              chg:    { fontSize: 10, color: '#ccddee', lineHeight: 14 },
            },
          },
        },
      ],
      // Squarify algorithm makes bigger tiles square-ish
      squareRatio: 0.5 * (1 + Math.sqrt(5)),
    }],
  };

  return (
    <div className="chart-card">
      {/* Toolbar */}
      <div className="heatmap-toolbar">
        <span className="heatmap-toolbar-label">Size by</span>
        <div className="hm-pill-group">
          {[['mcap','Mkt Cap'],['equal','Equal']].map(([v,l]) => (
            <button key={v} className={`hm-pill${sizeBy===v?' active':''}`} onClick={() => setSizeBy(v)}>{l}</button>
          ))}
        </div>

        <span className="heatmap-toolbar-label" style={{ marginLeft: 12 }}>Color by</span>
        <div className="hm-pill-group">
          {[['chgPct','Day Chg %'],['abs','Price']].map(([v,l]) => (
            <button key={v} className={`hm-pill${colorBy===v?' active':''}`} onClick={() => setColorBy(v)}>{l}</button>
          ))}
        </div>

        <div className="hm-control-group" style={{ marginLeft: 16 }}>
          {[['all','All'],['positive','▲'],['negative','▼']].map(([v,l]) => (
            <button key={v} className={`hm-control-btn${filter===v?' active':''}`} onClick={() => setFilter(v)}>{l}</button>
          ))}
        </div>

        {/* A/D counter */}
        <span style={{ marginLeft: 12, fontSize: 11, color: 'var(--bull)', fontFamily: 'var(--mono)' }}>▲ {advancing}</span>
        <span style={{ marginLeft: 6,  fontSize: 11, color: 'var(--bear)', fontFamily: 'var(--mono)' }}>▼ {declining}</span>

        <div className="hm-legend">
          <span>−5%</span>
          <div className="hm-legend-bar" />
          <span>+5%</span>
          <button className="chart-export-btn" style={{ marginLeft: 8 }} onClick={() => exportChartPNG(chartRef, 'market-heatmap')}>↓ PNG</button>
        </div>
      </div>
      <div className="chart-card-header" style={{ padding: '6px 16px' }}>
        <div className="chart-card-title">
          Market Heatmap — Size: {sizeBy === 'mcap' ? 'Mkt Cap' : 'Equal'} · Color: {colorBy === 'chgPct' ? 'Day Chg %' : 'Price'}
        </div>
      </div>
      {/* Color scale legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '4px 0 8px', fontSize: 10, color: '#6b7a99' }}>
        <span>−5%+</span>
        {[...Array(11)].map((_, i) => {
          const pct = -5 + i * 1;
          return <div key={i} style={{ width: 22, height: 10, background: chgColor(pct), borderRadius: 1 }} />;
        })}
        <span>+5%+</span>
      </div>
      <ReactECharts
        ref={chartRef}
        option={option}
        style={{ height: 520 }}
        notMerge
      />
      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6, paddingTop: 4, borderTop: '1px solid var(--border)' }}>
        Click a sector tile to drill down. {visible.length} tickers across {treeData.length} sectors.
        {data.some(d => d.mcap == null) && ' · Tickers without market cap data have equal-size tiles.'}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  2. Intra-Sector Ticker Heatmap (fundamental metrics matrix)
//     Rows = tickers, Columns = metrics, colors = value magnitude
// ══════════════════════════════════════════════════════════════════
export function TickerHeatmap() {
  const { state, dispatch } = useStore();
  const [tickerMetrics, setTickerMetrics] = useState(null);
  const [loading, setLoading]   = useState(false);
  const chartRef = useRef(null);

  const { selectedSectors, selectedTickers } = state;

  useEffect(() => {
    if (!selectedSectors.length) return;
    setLoading(true);
    const tickers = selectedTickers.length ? selectedTickers : null;
    fetchTickerMetrics(selectedSectors[0], tickers)
      .then(d => { setTickerMetrics(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [selectedSectors.join(','), selectedTickers.join(',')]);

  if (!selectedSectors.length) return <EmptyState message="Select a sector to see per-ticker metrics heatmap" />;
  if (loading) return <ChartSkeleton title="Ticker Heatmap" />;
  if (!tickerMetrics?.length) return <EmptyState message="No fundamental data for selected tickers" />;

  const cols = ['P/E', 'ROE %', 'Revenue'];
  const fieldMap = { 'P/E': 'pe', 'ROE %': 'roe', 'Revenue': 'revenue' };
  const tickerLabels = tickerMetrics.map(t => t.name || t.ticker || 'Unknown');

  const data = [];
  tickerMetrics.forEach((t, ri) => {
    cols.forEach((col, ci) => {
      const v = t[fieldMap[col]];
      data.push([ci, ri, v != null ? +v.toFixed(2) : null]);
    });
  });

  const allVals = data.map(d => d[2]).filter(v => v != null);
  if (!allVals.length) return <EmptyState message="No numeric fundamentals found for selected tickers" />;

  const option = {
    backgroundColor: 'transparent',
    tooltip: { formatter: p => `${tickerLabels[p.data[1]]} — ${cols[p.data[0]]}: ${p.data[2] ?? 'N/A'}` },
    grid: { top: 30, bottom: 80, left: 130, right: 20 },
    xAxis: {
      type: 'category', data: cols, splitArea: { show: true },
      axisLabel: { color: '#6b7a99', fontSize: 11 },
      axisLine: { lineStyle: { color: '#1e2d45' } },
    },
    yAxis: {
      type: 'category', data: tickerLabels, splitArea: { show: true },
      axisLabel: { color: '#6b7a99', fontSize: 10 },
      axisLine: { lineStyle: { color: '#1e2d45' } },
    },
    visualMap: {
      min: Math.min(...allVals), max: Math.max(...allVals),
      calculable: true, orient: 'horizontal', bottom: 0, left: 'center',
      inRange: { color: ['#991b1b', '#1e2d45', '#14532d'] },
      textStyle: { color: '#6b7a99', fontSize: 10 },
    },
    series: [{
      type: 'heatmap',
      data: data.filter(d => d[2] != null),
      label: { show: true, fontSize: 10, formatter: p => p.data[2]?.toFixed(1) },
      emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,212,255,0.4)' } },
    }],
  };

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <div className="chart-card-title">Intra-Sector Fundamentals — {selectedSectors[0]}</div>
        <button className="chart-export-btn" onClick={() => exportCSV(tickerMetrics, 'ticker-heatmap')}>⬇ CSV</button>
      </div>
      <ReactECharts ref={chartRef} option={option} style={{ height: Math.max(260, tickerLabels.length * 28 + 120) }} theme="dark" />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  3. Multi-Ticker Radar Chart — fundamental comparison
// ══════════════════════════════════════════════════════════════════
export function RadarChart() {
  const { state, dispatch } = useStore();
  const { selectedTickers, fundaCache } = state;
  const chartRef = useRef(null);

  useEffect(() => {
    if (!selectedTickers.length) return;
    const missing = selectedTickers.filter(t => !fundaCache[t]);
    if (!missing.length) return;
    fetchFundamentals(missing).then(data => {
      data.forEach((d, i) => { if (d) dispatch({ type: 'SET_FUNDA', ticker: missing[i], payload: d }); });
    }).catch(() => {});
  }, [selectedTickers.join(',')]);

  if (!selectedTickers.length) return <EmptyState message="Select 2–6 tickers to compare on radar" />;

  const metrics = ['P/E', 'ROE', 'EPS', 'Revenue', 'Mkt Cap'];
  const fieldMap = { 'P/E': 'pe', 'ROE': 'roe', 'EPS': 'eps', 'Revenue': 'revenue', 'Mkt Cap': 'mcap' };

  // Normalize each axis to 0–100
  const rawValues = metrics.map(m => selectedTickers.map(t => fundaCache[t]?.[fieldMap[m]] || null));
  const maxValues = rawValues.map(vals => {
    const d = vals.filter(v => v != null);
    return d.length ? Math.max(...d) : 1;
  });
  const norm = (val, max) => val == null ? 0 : Math.round((val / (max || 1)) * 100);

  const option = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' },
    legend: { data: selectedTickers, bottom: 0, textStyle: { color: '#6b7a99', fontSize: 11 } },
    radar: {
      indicator: metrics.map(m => ({ name: m, max: 100 })),
      center: ['50%', '48%'], radius: '62%',
      name: { textStyle: { color: '#6b7a99', fontSize: 11 } },
      axisLine: { lineStyle: { color: '#1e2d45' } },
      splitLine: { lineStyle: { color: '#1e2d45' } },
      splitArea: { areaStyle: { color: ['rgba(30,45,69,0.3)', 'rgba(17,24,39,0.3)'] } },
    },
    series: [{
      type: 'radar',
      data: selectedTickers.map((t, ti) => ({
        name: t,
        value: metrics.map((m, mi) => norm(fundaCache[t]?.[fieldMap[m]], maxValues[mi])),
        lineStyle: { color: CHART_COLORS[ti % CHART_COLORS.length], width: 2 },
        areaStyle: { color: CHART_COLORS[ti % CHART_COLORS.length], opacity: 0.12 },
        symbol: 'circle', symbolSize: 6,
        itemStyle: { color: CHART_COLORS[ti % CHART_COLORS.length] },
      })),
    }],
  };

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <div className="chart-card-title">Multi-Ticker Fundamental Radar</div>
        <button className="chart-export-btn" onClick={() => exportChartPNG(chartRef, 'radar')}>⬇ PNG</button>
      </div>
      <ReactECharts ref={chartRef} option={option} style={{ height: 420 }} theme="dark" />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  4. Sankey: Sector → Ticker capital flow (weighted by market cap)
// ══════════════════════════════════════════════════════════════════
export function SankeyChart() {
  const { state, dispatch } = useStore();
  const chartRef = useRef(null);

  useEffect(() => {
    if (state.sankeyData) return;
    dispatch({ type: 'SET_SANKEY_LOADING', payload: true });
    fetchSankeyData()
      .then(d => dispatch({ type: 'SET_SANKEY', payload: d }))
      .catch(() => dispatch({ type: 'SET_SANKEY_LOADING', payload: false }));
  }, []);

  if (state.sankeyLoading) return <ChartSkeleton title="Capital Flow — Sector → Ticker" />;
  if (!state.sankeyData?.nodes?.length) return <EmptyState message="No sector-to-ticker flow data available" />;

  const { nodes, links } = state.sankeyData;

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      triggerOn: 'mousemove',
      formatter: params =>
        params.dataType === 'edge'
          ? `${params.data.source} → ${params.data.target}: ₹${(+params.data.value / 1e3).toFixed(1)}K Cr`
          : params.name,
    },
    series: [{
      type: 'sankey',
      layout: 'none',
      emphasis: { focus: 'adjacency' },
      data: nodes,
      links,
      lineStyle: { color: 'gradient', opacity: 0.45, curveness: 0.5 },
      label: { color: '#e8edf5', fontSize: 11 },
      itemStyle: { borderWidth: 0 },
      levels: [
        { depth: 0, itemStyle: { color: '#00d4ff' }, lineStyle: { color: 'source', opacity: 0.4 } },
        { depth: 1, itemStyle: { color: '#00ff88' }, lineStyle: { color: 'source', opacity: 0.3 } },
      ],
    }],
  };

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <div className="chart-card-title">Sector → Ticker Capital Flow (by Market Cap)</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--muted)' }}>Flow width ∝ Market Cap</span>
          <button className="chart-export-btn" onClick={() => exportChartPNG(chartRef, 'sankey')}>⬇ PNG</button>
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', padding: '4px 0 8px' }}>
        Each flow shows how much of the market's capitalisation sits within each sector and its top tickers. Wider = bigger market cap.
      </div>
      <ReactECharts ref={chartRef} option={option} style={{ height: 560 }} theme="dark" />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  5. Leading & Lagging Indicators Signal Table
// ══════════════════════════════════════════════════════════════════
export function LeadingLaggingPanel() {
  const { state } = useStore();
  const { selectedTickers, ohlcvCache } = state;

  if (!selectedTickers.length) return <EmptyState message="Select tickers to see leading/lagging indicator signals" />;

  const rows = selectedTickers.map(ticker => {
    const data = ohlcvCache[`${ticker}__1Y`] || ohlcvCache[`${ticker}__6M`] || ohlcvCache[`${ticker}__3M`] || null;
    if (!data?.length) return { ticker, hasData: false };

    const last = data[data.length - 1];
    const rsi      = last?.rsi;
    const macdHist = last?.macdHist;
    const price    = last?.close;
    const bollU    = last?.bollUpper;
    const bollL    = last?.bollLower;
    const sma20    = last?.bollMiddle;

    const rsiSignal  = rsi == null ? 'N/A' : rsi > 70 ? 'Overbought' : rsi < 30 ? 'Oversold' : 'Neutral';
    const macdSignal = macdHist == null ? 'N/A' : macdHist > 0 ? 'Bullish' : 'Bearish';
    const bollSignal = price == null || bollU == null ? 'N/A'
      : price > bollU ? 'Above Upper'
      : price < bollL ? 'Below Lower' : 'Within Bands';

    return {
      ticker, price: price?.toFixed(2), rsi: rsi?.toFixed(1), rsiSignal,
      macdHist: macdHist?.toFixed(3), macdSignal,
      sma20: sma20?.toFixed(2), bollSignal, hasData: true,
    };
  });

  const badge = (signal, positive, negative) => {
    const cls = signal === positive ? 'pos' : signal === negative ? 'neg' : 'muted';
    return <span className={`indicator-badge ${cls}`}>{signal}</span>;
  };

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <div className="chart-card-title">Leading & Lagging Indicator Signals</div>
        <div style={{ fontSize: 10, color: 'var(--muted)' }}>
          <b>Leading:</b> RSI, MACD Histogram &nbsp;|&nbsp; <b>Lagging:</b> SMA20, Bollinger position
        </div>
        <button className="chart-export-btn" onClick={() => exportCSV(rows, 'indicator-signals')}>⬇ CSV</button>
      </div>
      {rows.some(r => !r.hasData) && (
        <div style={{ padding: '8px 0', color: 'var(--muted)', fontSize: 11 }}>
          ⚠ Some tickers have no price history loaded yet — navigate to Technical tab to trigger a load.
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              {['Ticker','Price','RSI(14)','RSI Signal','MACD Hist','MACD','SMA20','Bollinger'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.ticker} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--surface)' }}>
                <td style={{ padding: '8px 12px', fontFamily: 'var(--mono)', color: 'var(--accent)', fontWeight: 600 }}>{r.ticker}</td>
                <td style={{ padding: '8px 12px', fontFamily: 'var(--mono)' }}>{r.price ? `₹${r.price}` : '—'}</td>
                <td style={{ padding: '8px 12px', fontFamily: 'var(--mono)' }}>{r.rsi || '—'}</td>
                <td style={{ padding: '8px 12px' }}>{badge(r.rsiSignal, 'Oversold', 'Overbought')}</td>
                <td style={{ padding: '8px 12px', fontFamily: 'var(--mono)', color: r.macdHist > 0 ? '#00ff88' : '#ff4444' }}>{r.macdHist || '—'}</td>
                <td style={{ padding: '8px 12px' }}>{badge(r.macdSignal, 'Bullish', 'Bearish')}</td>
                <td style={{ padding: '8px 12px', fontFamily: 'var(--mono)' }}>{r.sma20 || '—'}</td>
                <td style={{ padding: '8px 12px' }}>{badge(r.bollSignal, 'Below Lower', 'Above Upper')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
