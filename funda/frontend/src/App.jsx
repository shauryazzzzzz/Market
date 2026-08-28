/**
 * FUNDA — Fundamental Analysis Platform
 * Redesigned: TradingView × MoneyControl × Tijori Finance aesthetic
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { StoreProvider, useStore } from './store.jsx';
import FilterBar from './FilterBar';
import { RadarChart, SectorHeatmap, TickerHeatmap, SankeyChart, LeadingLaggingPanel } from './ChartsA';
import { MultiPaneChart } from './ChartsB';
import { FundamentalsKPIRow, PEBandChart, ROEChart, FinancialTrendChart } from './ChartsC';
import ExtendedChartLibrary from './ChartsD';
import MarketsPage from './MarketsPage';
import NsePage from './NsePage';
import LiveQuotesPage from './LiveQuotesPage';
import TopMoversWidget from './TopMoversWidget';
import { fetchSummary, fetchMarketOverview } from './api';
import { SectionTabs, Loading, ErrorState } from './utils';

// ── Scrolling ticker tape ─────────────────────────────────────────────────────
const TAPE_ITEMS = [
  { label: 'NIFTY 50',    value: '25,432.10', chg: '+0.42%', up: true },
  { label: 'SENSEX',      value: '83,721.40', chg: '+0.38%', up: true },
  { label: 'BANK NIFTY',  value: '52,140.80', chg: '-0.11%', up: false },
  { label: 'NIFTY IT',    value: '41,820.30', chg: '+1.24%', up: true },
  { label: 'NIFTY MID',   value: '18,960.50', chg: '-0.22%', up: false },
  { label: 'INDIA VIX',   value: '13.42',     chg: '+2.18%', up: false },
  { label: 'USD/INR',     value: '83.92',     chg: '+0.07%', up: false },
  { label: 'GOLD (MCX)',  value: '71,240',    chg: '+0.55%', up: true },
];

function TickerTape() {
  // Double the items for seamless loop
  const items = [...TAPE_ITEMS, ...TAPE_ITEMS];
  return (
    <div className="ticker-tape">
      <div className="ticker-tape-track">
        {items.map((item, i) => (
          <span key={i} className="ticker-tape-item">
            <span className="ticker-tape-label">{item.label}</span>
            <span className="ticker-tape-value">{item.value}</span>
            <span className={`ticker-tape-chg ${item.up ? 'up' : 'down'}`}>{item.chg}</span>
            <span className="ticker-tape-sep">·</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Market status / index chips in topbar ─────────────────────────────────────
function IndexChip({ label, value, chg, up }) {
  return (
    <div className="index-chip">
      <span className="index-chip-label">{label}</span>
      <span className="index-chip-value">{value}</span>
      <span className={`index-chip-chg ${up ? 'up' : 'down'}`}>{chg}</span>
    </div>
  );
}

// ── Ticker search input ───────────────────────────────────────────────────────
function TopbarSearch() {
  const [val, setVal] = useState('');
  const { dispatch } = useStore();
  const handleKey = (e) => {
    if (e.key === 'Enter' && val.trim()) {
      dispatch({ type: 'SET_SELECTED_TICKERS', payload: [val.trim().toUpperCase()] });
      setVal('');
    }
  };
  return (
    <div className="topbar-search-wrap">
      <span className="topbar-search-icon">⌕</span>
      <input
        className="topbar-search"
        placeholder="Search ticker… (Enter)"
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={handleKey}
      />
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard() {
  const [summary, setSummary]   = useState(null);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    Promise.all([fetchSummary(), fetchMarketOverview()])
      .then(([s, o]) => { setSummary(s); setOverview(o); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (error)   return <ErrorState title="Backend Offline" message={error} />;

  return (
    <div className="page-body">
      {/* Market overview strip */}
      {overview && (
        <div className="overview-strip">
          {[
            { label: 'Total Securities', v: overview.totalSecurities?.toLocaleString(), color: '' },
            { label: 'Advances',         v: overview.advances?.toLocaleString(),        color: 'var(--bull)' },
            { label: 'Declines',         v: overview.declines?.toLocaleString(),        color: 'var(--bear)' },
            { label: 'Unchanged',        v: overview.unchanged?.toLocaleString(),       color: '' },
            { label: 'A/D Ratio',        v: overview.adRatio,                           color: '' },
            { label: 'Avg Δ %',          v: overview.avgChangePct != null ? `${(+overview.avgChangePct).toFixed(2)}%` : 'N/A', color: (+overview.avgChangePct >= 0 ? 'var(--bull)' : 'var(--bear)') },
            { label: 'Turnover (Cr)',    v: overview.totalTurnoverCr != null ? (+overview.totalTurnoverCr / 100).toFixed(0) + ' Cr' : 'N/A', color: '' },
          ].map(it => (
            <div key={it.label} className="overview-strip-item">
              <div className="overview-strip-label">{it.label}</div>
              <div className="overview-strip-value" style={{ color: it.color || 'var(--tv-heading)' }}>{it.v ?? '—'}</div>
            </div>
          ))}
        </div>
      )}

      {/* KPI grid */}
      <div className="stats-grid">
        {[
          { label: 'Files Indexed',  value: summary.filesIndexed,                  sub: 'CSV / XLSX / JSON' },
          { label: 'Total Records',  value: summary.totalUniqueRows?.toLocaleString(), sub: 'Across all files' },
          { label: 'Unique Tickers', value: summary.uniqueTickers?.toLocaleString(),   sub: 'NSE / BSE symbols' },
          { label: 'Sectors',        value: summary.uniqueSectors,                 sub: 'Distinct sectors' },
        ].map(c => (
          <div key={c.label} className="stat-card">
            <div className="stat-label">{c.label}</div>
            <div className="stat-value">{c.value}</div>
            <div className="stat-sub">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Two-column: movers left, sectors right */}
      <div className="dashboard-two-col">
        <TopMoversWidget />
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-title">Sectors Available</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {summary.sectors?.length > 0
                ? summary.sectors.map(s => <span key={s} className="badge badge-accent">{s}</span>)
                : <span className="muted">No sector data yet.</span>}
            </div>
          </div>
          <div className="card">
            <div className="card-title">Data Source Health</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {summary.indexedFiles?.slice(0, 16).map(f => (
                <span key={f.name} className={`badge ${f.error ? 'badge-negative' : 'badge-positive'}`}>
                  {f.name.split('/').pop().split('.')[0]} ({(f.rows || 0).toLocaleString()})
                </span>
              ))}
              {summary.indexedFiles?.length > 16 && (
                <span className="badge badge-neutral">+{summary.indexedFiles.length - 16} more</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Compare page ──────────────────────────────────────────────────────────────
function ComparePage() {
  const [activeTab, setActiveTab] = useState('heatmap');
  const tabs = [
    { id: 'heatmap', label: 'Market Heatmap' },
    { id: 'radar',   label: 'Radar Chart' },
    { id: 'ticker',  label: 'Sector Metrics' },
    { id: 'sankey',  label: 'Capital Flow' },
    { id: 'signals', label: 'Lead/Lag Signals' },
  ];
  return (
    <div>
      <FilterBar />
      <SectionTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
      <div className="page-body" style={{ paddingTop: 12 }}>
        {activeTab === 'heatmap' && <SectorHeatmap />}
        {activeTab === 'radar'   && <RadarChart />}
        {activeTab === 'ticker'  && <TickerHeatmap />}
        {activeTab === 'sankey'  && <SankeyChart />}
        {activeTab === 'signals' && <LeadingLaggingPanel />}
      </div>
    </div>
  );
}

// ── Technical page — multi-pane TradingView layout ────────────────────────────
function TechnicalPage() {
  return (
    <div>
      <FilterBar />
      <div className="page-body" style={{ paddingTop: 12 }}>
        <MultiPaneChart />
      </div>
    </div>
  );
}

// ── Fundamentals page ─────────────────────────────────────────────────────────
function FundaPage() {
  const [activeTab, setActiveTab] = useState('kpi');
  const tabs = [
    { id: 'kpi',   label: 'KPI Summary' },
    { id: 'pe',    label: 'PE Band' },
    { id: 'roe',   label: 'ROE Comparison' },
    { id: 'trend', label: 'Financial Trends' },
  ];
  return (
    <div>
      <FilterBar />
      <SectionTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
      <div className="page-body" style={{ paddingTop: 12 }}>
        {activeTab === 'kpi'   && <FundamentalsKPIRow />}
        {activeTab === 'pe'    && <PEBandChart />}
        {activeTab === 'roe'   && <ROEChart />}
        {activeTab === 'trend' && <FinancialTrendChart />}
      </div>
    </div>
  );
}

// ── Extended page ─────────────────────────────────────────────────────────────
function ExtendedPage() {
  return (
    <div>
      <FilterBar />
      <div className="page-body" style={{ paddingTop: 12 }}>
        <ExtendedChartLibrary />
      </div>
    </div>
  );
}

// ── Nav items ─────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { to: '/dashboard',    icon: '▦',  label: 'Overview',      section: 'FUNDA',   badge: null },
  { to: '/compare',      icon: '◈',  label: 'Compare/Flow',  section: 'Charts',  badge: 'A' },
  { to: '/technical',    icon: '↗',  label: 'Technical',     section: 'Charts',  badge: 'B' },
  { to: '/fundamentals', icon: '⊞',  label: 'Fundamentals',  section: 'Charts',  badge: 'C' },
  { to: '/extended',     icon: '⊟',  label: 'Chart Library', section: 'Charts',  badge: 'D' },
  { to: '/markets',      icon: '⇅',  label: 'Market Movers', section: 'Markets', badge: null },
  { to: '/nse',          icon: '↓',  label: 'NSE Reports',   section: 'Markets', badge: null },
  { to: '/live',         icon: '●',  label: 'Live Quotes',   section: 'Markets', badge: 'live' },
];

// ── Layout ────────────────────────────────────────────────────────────────────
function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();

  return (
    <div className="app-shell">
      {/* Ticker tape */}
      <TickerTape />

      {/* Topbar */}
      <header className="topbar">
        <button className="topbar-menu-btn" onClick={() => setSidebarOpen(o => !o)} title="Toggle sidebar">
          <span className={`topbar-hamburger ${sidebarOpen ? 'open' : ''}`}>
            <span /><span /><span />
          </span>
        </button>

        <NavLink to="/dashboard" className="topbar-logo" style={{ textDecoration: 'none' }}>
          <div className="topbar-logo-mark">F</div>
          <div>
            <div className="topbar-logo-text">FUNDA</div>
            <div className="topbar-logo-sub">Analytics Platform</div>
          </div>
        </NavLink>

        {/* Index chips */}
        <div className="topbar-indices">
          <IndexChip label="NIFTY 50"   value="25,432" chg="+0.42%" up />
          <IndexChip label="SENSEX"     value="83,721" chg="+0.38%" up />
          <IndexChip label="BANK NIFTY" value="52,140" chg="-0.11%" up={false} />
        </div>

        <TopbarSearch />

        <div className="topbar-right">
          <span className="market-status-dot live" />
          <span className="market-status-text">NSE LIVE</span>
        </div>
      </header>

      <div className="main-layout">
        {/* Sidebar */}
        <nav className={`sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}>
          {[...new Set(NAV_ITEMS.map(n => n.section))].map(section => (
            <div key={section} className="sidebar-section">
              <div className="sidebar-section-title">{section}</div>
              {NAV_ITEMS.filter(n => n.section === section).map(n => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                  title={n.label}
                >
                  <span className="sidebar-link-icon">{n.icon}</span>
                  <span className="sidebar-link-label">{n.label}</span>
                  {n.badge && (
                    <span className={`sidebar-badge ${n.badge === 'live' ? 'live' : ''}`}>
                      {n.badge === 'live' ? '●' : n.badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
          <div className="sidebar-footer">
            <div>Local CSV · XLSX · JSON</div>
            <div>All calcs server-side</div>
            <div style={{ marginTop: 4, color: 'var(--bull)', fontSize: 9 }}>● No internet required</div>
          </div>
        </nav>

        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/"             element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"    element={<Dashboard />} />
            <Route path="/compare"      element={<ComparePage />} />
            <Route path="/technical"    element={<TechnicalPage />} />
            <Route path="/fundamentals" element={<FundaPage />} />
            <Route path="/extended"     element={<ExtendedPage />} />
            <Route path="/markets"      element={<MarketsPage />} />
            <Route path="/nse"          element={<NsePage />} />
            <Route path="/live"         element={<LiveQuotesPage />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </StoreProvider>
  );
}
