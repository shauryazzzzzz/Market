/**
 * MarketsPage — StockAnalysis.com-style NSE market movers dashboard.
 * Tabs: Gainers · Losers · Most Active · 52-Wk High · 52-Wk Low · Bulk Deals · Short Selling · Volatility
 * All data fetched from the FUNDA backend (server-computed), no raw backend data exposed.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchMovers, fetch52WkHL, fetchBulkDeals,
  fetchShortSelling, fetchVolatility, fetchMarketOverview,
} from './api';
import { Loading, ErrorState, exportCSV, CHART_COLORS, fmtNum } from './utils';

// ── Tiny sparkbar: inline % change bar ───────────────────────────────────────
function ChangeBadge({ value }) {
  const v = parseFloat(value) || 0;
  const color = v >= 0 ? 'var(--up)' : 'var(--down)';
  const sign = v >= 0 ? '+' : '';
  return (
    <span style={{ color, fontWeight: 700, fontSize: 13 }}>
      {sign}{v.toFixed(2)}%
    </span>
  );
}

// ── Inline mini bar for magnitude display ────────────────────────────────────
function MiniBar({ value, max, color }) {
  const pct = max > 0 ? Math.min(100, (Math.abs(value) / max) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 80, height: 6, background: 'var(--border)',
        borderRadius: 3, overflow: 'hidden',
      }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ color: 'var(--muted)', fontSize: 11 }}>{fmtNum(value, 1)}</span>
    </div>
  );
}

// ── Market overview header strip ─────────────────────────────────────────────
function MarketOverviewStrip({ data }) {
  if (!data) return null;
  const items = [
    { label: 'Total Securities', value: fmtNum(data.totalSecurities, 0) },
    { label: 'Advances', value: fmtNum(data.advances, 0), color: 'var(--up)' },
    { label: 'Declines', value: fmtNum(data.declines, 0), color: 'var(--down)' },
    { label: 'Unchanged', value: fmtNum(data.unchanged, 0) },
    { label: 'A/D Ratio', value: data.adRatio },
    { label: 'Avg Change %', value: data.avgChangePct },
    { label: 'Total Turnover (Cr)', value: fmtNum(data.totalTurnoverCr, 0) },
    { label: 'Date', value: data.date || 'N/A' },
  ];

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 12,
      padding: '12px 0', marginBottom: 16,
      borderBottom: '1px solid var(--border)',
    }}>
      {items.map(it => (
        <div key={it.label} style={{
          background: 'var(--surface)', borderRadius: 6, padding: '8px 14px',
          border: '1px solid var(--border)', minWidth: 110,
        }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
            {it.label}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: it.color || 'var(--text)' }}>
            {it.value ?? 'N/A'}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Column definition helpers ─────────────────────────────────────────────────
const MOVER_COLS = [
  { key: 'rank',       label: '#',            width: 40 },
  { key: 'symbol',     label: 'Symbol',       width: 100, bold: true },
  { key: 'sector',     label: 'Sector',       width: 150, muted: true },
  { key: 'close',      label: 'Close',        width: 90,  fmt: v => fmtNum(v, 2) },
  { key: 'prevClose',  label: 'Prev Close',   width: 90,  fmt: v => fmtNum(v, 2), muted: true },
  { key: 'changePct',  label: '% Change',     width: 100, special: 'change' },
  { key: 'high',       label: 'High',         width: 90,  fmt: v => fmtNum(v, 2) },
  { key: 'low',        label: 'Low',          width: 90,  fmt: v => fmtNum(v, 2) },
  { key: 'volume',     label: 'Volume',       width: 110, fmt: v => fmtNum(v, 0) },
  { key: 'pe',         label: 'P/E',          width: 80,  fmt: v => fmtNum(v, 1) },
  { key: 'delivPct',   label: 'Deliv %',      width: 80,  fmt: v => v != null ? `${fmtNum(v,1)}%` : 'N/A' },
  { key: 'mcap',       label: 'MCap (Cr)',    width: 110, fmt: v => fmtNum(v, 0) },
];

const HI_LO_COLS = [
  { key: 'rank',        label: '#',            width: 40 },
  { key: 'symbol',      label: 'Symbol',       width: 100, bold: true },
  { key: 'close',       label: 'Close',        width: 90,  fmt: v => fmtNum(v, 2) },
  { key: 'changePct',   label: '% Change',     width: 100, special: 'change' },
  { key: 'high52w',     label: '52W High',     width: 100, fmt: v => fmtNum(v, 2) },
  { key: 'low52w',      label: '52W Low',      width: 100, fmt: v => fmtNum(v, 2) },
  { key: 'nearHigh',    label: 'Near High %',  width: 110, fmt: v => v != null ? `${fmtNum(v,1)}%` : 'N/A', muted: true },
];

const BULK_COLS = [
  { key: 'rank',        label: '#',        width: 40 },
  { key: 'symbol',      label: 'Symbol',   width: 100, bold: true },
  { key: 'client',      label: 'Client',   width: 200 },
  { key: 'buySell',     label: 'B/S',      width: 60, special: 'bs' },
  { key: 'qty',         label: 'Qty',      width: 110, fmt: v => fmtNum(v, 0) },
  { key: 'price',       label: 'Price',    width: 90,  fmt: v => fmtNum(v, 2) },
  { key: 'exchange',    label: 'Exch',     width: 60,  muted: true },
];

const SHORT_COLS = [
  { key: 'rank',        label: '#',            width: 40 },
  { key: 'symbol',      label: 'Symbol',       width: 100, bold: true },
  { key: 'qty',         label: 'Short Qty',    width: 120, fmt: v => fmtNum(v, 0) },
  { key: 'price',       label: 'Price',        width: 90,  fmt: v => fmtNum(v, 2) },
  { key: 'client',      label: 'Client',       width: 200, muted: true },
];

const VOLT_COLS = [
  { key: 'rank',        label: '#',          width: 40 },
  { key: 'symbol',      label: 'Symbol',     width: 100, bold: true },
  { key: 'volatility',  label: 'Ann. Vol %', width: 130, special: 'bar-volt' },
  { key: 'close',       label: 'Close',      width: 90,  fmt: v => fmtNum(v, 2) },
  { key: 'changePct',   label: '% Change',   width: 100, special: 'change' },
];

// ── Generic sortable table ────────────────────────────────────────────────────
function DataTable({ cols, rows, onExport }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('desc');

  const handleSort = key => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sorted = React.useMemo(() => {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const cmp = isNaN(av) ? String(av).localeCompare(String(bv)) : (+av) - (+bv);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir]);

  const maxVolt = React.useMemo(() => Math.max(0, ...rows.map(r => Math.abs(parseFloat(r.volatility) || 0))), [rows]);

  if (!rows.length) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>No data available</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button className="btn-ghost" onClick={onExport} style={{ fontSize: 12 }}>⬇ Export CSV</button>
      </div>
      <div style={{ overflowX: 'auto', borderRadius: 6, border: '1px solid var(--border)' }}>
        <table className="analytics-table" style={{ minWidth: cols.reduce((a,c) => a + (c.width || 100), 0) }}>
          <thead>
            <tr>
              {cols.map(c => (
                <th key={c.key} style={{ width: c.width, cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => handleSort(c.key)}>
                  {c.label}
                  {sortKey === c.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={row.symbol || i} className={i % 2 === 0 ? '' : 'row-alt'}>
                {cols.map(c => {
                  const v = row[c.key];
                  let cell;
                  if (c.special === 'change') {
                    cell = <ChangeBadge value={v} />;
                  } else if (c.special === 'bs') {
                    cell = (
                      <span style={{ color: String(v).toUpperCase().includes('B') ? 'var(--up)' : 'var(--down)', fontWeight: 700 }}>
                        {v}
                      </span>
                    );
                  } else if (c.special === 'bar-volt') {
                    cell = <MiniBar value={parseFloat(v) || 0} max={maxVolt} color="#ffaa00" />;
                  } else {
                    cell = (
                      <span style={{ color: c.bold ? 'var(--text)' : c.muted ? 'var(--muted)' : undefined,
                        fontWeight: c.bold ? 600 : undefined }}>
                        {c.fmt ? c.fmt(v) : v ?? 'N/A'}
                      </span>
                    );
                  }
                  return <td key={c.key} style={{ width: c.width }}>{cell}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Tab definitions ───────────────────────────────────────────────────────────
const TABS = [
  { id: 'gainers',      label: '▲ Gainers',      emoji: '🟢' },
  { id: 'losers',       label: '▼ Losers',       emoji: '🔴' },
  { id: 'active',       label: '⚡ Most Active',  emoji: '⚡' },
  { id: '52high',       label: '📈 52W High',     emoji: '📈' },
  { id: '52low',        label: '📉 52W Low',      emoji: '📉' },
  { id: 'bulk',         label: '🏦 Bulk Deals',   emoji: '🏦' },
  { id: 'short',        label: '📉 Short Selling', emoji: '🧨' },
  { id: 'volatility',   label: '🌊 Volatility',   emoji: '🌊' },
];

// ── Per-tab data loaders ──────────────────────────────────────────────────────
async function loadTab(tab) {
  switch (tab) {
    case 'gainers':  return { cols: MOVER_COLS, data: (await fetchMovers('gainers', 200)).data };
    case 'losers':   return { cols: MOVER_COLS, data: (await fetchMovers('losers', 200)).data };
    case 'active':   return { cols: MOVER_COLS, data: (await fetchMovers('active', 200)).data };
    case '52high':   return { cols: HI_LO_COLS, data: await fetch52WkHL('high', 200) };
    case '52low':    return { cols: HI_LO_COLS, data: await fetch52WkHL('low', 200) };
    case 'bulk':     return { cols: BULK_COLS,  data: await fetchBulkDeals() };
    case 'short':    return { cols: SHORT_COLS, data: await fetchShortSelling() };
    case 'volatility': return { cols: VOLT_COLS, data: await fetchVolatility(200) };
    default: return { cols: [], data: [] };
  }
}

// ── Top gainers/losers side-by-side mini cards ────────────────────────────────
function TopMoversStrip({ gainers, losers }) {
  const renderList = (items, isGainers) => (
    <div style={{ flex: 1, minWidth: 200 }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em',
        color: isGainers ? 'var(--up)' : 'var(--down)', marginBottom: 8 }}>
        Top {isGainers ? 'Gainers' : 'Losers'}
      </div>
      {items.slice(0, 5).map((r, i) => (
        <div key={r.symbol || i} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '5px 0', borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{r.symbol}</span>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>₹{fmtNum(r.close, 2)}</span>
          <ChangeBadge value={r.changePct} />
        </div>
      ))}
    </div>
  );
  return (
    <div style={{ display: 'flex', gap: 32, padding: '12px 16px',
      background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 16 }}>
      {renderList(gainers, true)}
      <div style={{ width: 1, background: 'var(--border)' }} />
      {renderList(losers, false)}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MarketsPage() {
  const [activeTab, setActiveTab] = useState('gainers');
  const [overview, setOverview] = useState(null);
  const [tabState, setTabState] = useState({ loading: false, error: null, cols: [], data: [] });
  const [topGainers, setTopGainers] = useState([]);
  const [topLosers, setTopLosers] = useState([]);
  const [overviewLoaded, setOverviewLoaded] = useState(false);

  // Load overview + top movers once
  useEffect(() => {
    if (overviewLoaded) return;
    setOverviewLoaded(true);
    fetchMarketOverview().then(setOverview).catch(() => {});
    fetchMovers('gainers', 5).then(r => setTopGainers(r.data)).catch(() => {});
    fetchMovers('losers', 5).then(r => setTopLosers(r.data)).catch(() => {});
  }, [overviewLoaded]);

  // Load tab data whenever tab changes
  useEffect(() => {
    setTabState({ loading: true, error: null, cols: [], data: [] });
    loadTab(activeTab)
      .then(({ cols, data }) => setTabState({ loading: false, error: null, cols, data }))
      .catch(e => setTabState({ loading: false, error: e.message, cols: [], data: [] }));
  }, [activeTab]);

  const handleExport = useCallback(() => {
    exportCSV(tabState.data, `nse_${activeTab}`);
  }, [tabState.data, activeTab]);

  return (
    <div>
      {/* Page title */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
        <h1 className="section-title" style={{ margin: 0 }}>NSE Market Movers</h1>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>Live from local DATA files</span>
      </div>
      <p className="section-sub" style={{ marginBottom: 16 }}>
        Gainers · Losers · Most Active · 52-Week extremes · Bulk Deals · Short Selling · Volatility
      </p>

      {/* Overview strip */}
      <MarketOverviewStrip data={overview} />

      {/* Top movers quick-view */}
      {(topGainers.length > 0 || topLosers.length > 0) && (
        <TopMoversStrip gainers={topGainers} losers={topLosers} />
      )}

      {/* Tab bar */}
      <div className="section-tabs" style={{ marginBottom: 16 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`section-tab${activeTab === t.id ? ' active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.emoji} {t.label.replace(/^[^\s]+\s/, '')}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="chart-card">
        <div className="chart-card-header">
          <div className="chart-card-title">
            {TABS.find(t => t.id === activeTab)?.label}
          </div>
          {tabState.data.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              {tabState.data.length} records
            </span>
          )}
        </div>

        {tabState.loading && <Loading />}
        {tabState.error && <ErrorState title="Load Failed" message={tabState.error} />}
        {!tabState.loading && !tabState.error && (
          <DataTable
            cols={tabState.cols}
            rows={tabState.data.map((r, i) => ({ rank: i + 1, ...r }))}
            onExport={handleExport}
          />
        )}
      </div>

      {/* Sector breakdown for gainers/losers/active */}
      {['gainers', 'losers', 'active'].includes(activeTab) && !tabState.loading && tabState.data.length > 0 && (
        <SectorBreakdown data={tabState.data} type={activeTab} />
      )}
    </div>
  );
}

// ── Sector breakdown bar chart (pure CSS, no ECharts dependency needed here) ──
function SectorBreakdown({ data, type }) {
  const agg = React.useMemo(() => {
    const map = {};
    data.forEach(r => {
      const s = r.sector || 'Unknown';
      if (!map[s]) map[s] = { count: 0, avgChange: 0, total: 0 };
      map[s].count += 1;
      map[s].total += parseFloat(r.changePct) || 0;
    });
    return Object.entries(map)
      .map(([sector, v]) => ({ sector, count: v.count, avgChange: (v.total / v.count).toFixed(2) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }, [data]);

  const maxCount = Math.max(...agg.map(a => a.count));
  const color = type === 'gainers' ? 'var(--up)' : type === 'losers' ? 'var(--down)' : '#00d4ff';

  return (
    <div className="chart-card" style={{ marginTop: 16 }}>
      <div className="chart-card-header">
        <div className="chart-card-title">Sector Breakdown — {type.charAt(0).toUpperCase() + type.slice(1)}</div>
      </div>
      <div style={{ padding: '8px 0' }}>
        {agg.map(a => (
          <div key={a.sector} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ width: 160, fontSize: 12, color: 'var(--muted)', textAlign: 'right', flexShrink: 0 }}>
              {a.sector}
            </div>
            <div style={{ flex: 1, background: 'var(--border)', borderRadius: 3, height: 16, overflow: 'hidden' }}>
              <div style={{
                width: `${(a.count / maxCount) * 100}%`,
                height: '100%', background: color,
                borderRadius: 3, transition: 'width 0.4s ease',
                display: 'flex', alignItems: 'center', paddingLeft: 6,
              }}>
                <span style={{ fontSize: 10, color: '#0a0e1a', fontWeight: 700 }}>{a.count}</span>
              </div>
            </div>
            <div style={{ width: 70, fontSize: 12, textAlign: 'right' }}>
              <ChangeBadge value={a.avgChange} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
