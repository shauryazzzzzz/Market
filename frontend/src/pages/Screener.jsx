/**
 * Screener.jsx — Enhanced multi-factor stock screener
 * Uses /api/fundamentals/screener with all 23 filter parameters
 * Features: preset screens, sort, CSV export, clickable rows → /stock/:symbol
 */
import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { Loading, fmtCr, fmtPct, fmt, Signal } from '../components/shared'

// ── Preset screen configurations ─────────────────────────────────────────────
const PRESETS = [
  {
    id: 'highRoeLowDebt',
    label: 'High ROE Low Debt',
    desc: 'Quality businesses with strong returns and clean balance sheets',
    icon: '🏆',
    filters: { minROE: 20, maxDebtToEquity: 0.5 },
    sortBy: 'roe',
  },
  {
    id: 'grahamValue',
    label: 'Graham Value Picks',
    desc: 'Stocks trading below Graham intrinsic value',
    icon: '💎',
    filters: { belowGraham: true, minROE: 10 },
    sortBy: 'grahamDiff',
  },
  {
    id: 'qualityGrowth',
    label: 'Quality Growth',
    desc: 'High Piotroski score with consistent profit and ROE growth',
    icon: '🚀',
    filters: { minPiotroski: 6, minROE: 15, minProfitGrowth: 15 },
    sortBy: 'piotroskiScore',
  },
  {
    id: 'dividendIncome',
    label: 'Dividend Income',
    desc: 'Regular dividend payers with manageable debt',
    icon: '💰',
    filters: { minDividendYield: 2, maxDebtToEquity: 1 },
    sortBy: 'dividendYield',
  },
  {
    id: 'momentum',
    label: 'Momentum Breakouts',
    desc: 'Strong price momentum with earnings acceleration',
    icon: '⚡',
    filters: { minReturn1yr: 30, minYoyQProfitGrowth: 10 },
    sortBy: 'return1yr',
  },
]

// ── Default / blank filters ───────────────────────────────────────────────────
const BLANK = {
  minROE:              '',
  maxPE:               '',
  minProfitGrowth:     '',
  minSalesGrowth:      '',
  maxDebtToEquity:     '',
  minOPM:              '',
  minPiotroski:        '',
  minPromoterHolding:  '',
  minMarketCap:        '',
  maxMarketCap:        '',
  minDividendYield:    '',
  maxPegRatio:         '',
  industry:            '',
  minReturn1yr:        '',
  maxReturn1yr:        '',
  minCashFromOps:      '',
  minPatQ:             '',
  maxEvEbitda:         '',
  minPB:               '',
  maxPB:               '',
  minYoyQProfitGrowth: '',
  belowGraham:         false,
  sortBy:              'piotroskiScore',
  n:                   100,
}

// ── Filter controls ───────────────────────────────────────────────────────────
function FilterInput({ label, fieldKey, value, onChange, placeholder = '—', type = 'number' }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>{label}</div>
      <input className="input" style={{ width: '100%', padding: '5px 8px', fontSize: 12 }}
        type={type} placeholder={placeholder}
        value={value}
        onChange={e => onChange(fieldKey, type === 'number' ? e.target.value : e.target.value)}
      />
    </div>
  )
}

function sigRating(s) {
  const pioScore = s.piotroskiScore ?? 0
  const roe      = s.roe ?? 0
  const de       = s.debtToEquity ?? 99
  if (pioScore >= 7 && roe >= 15) return 'BUY'
  if (pioScore <= 3 || de > 2)    return 'SELL'
  return 'HOLD'
}

// ── CSV export ────────────────────────────────────────────────────────────────
function exportCSV(rows) {
  if (!rows.length) return
  const cols = ['name', 'nseCode', 'industry', 'currentPrice', 'marketCap', 'pe', 'pb',
    'roe', 'opm', 'npm', 'debtToEquity', 'piotroskiScore', 'dividendYield',
    'profitGrowth', 'salesGrowth', 'return1yr', 'promoterHolding', 'fiiHolding']
  const header = cols.join(',')
  const lines  = rows.map(r => cols.map(c => {
    const v = r[c]
    if (v == null) return ''
    if (typeof v === 'string' && v.includes(',')) return `"${v}"`
    return v
  }).join(','))
  const csv  = [header, ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `screener-results-${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Sort header helper ────────────────────────────────────────────────────────
function SortTh({ col, label, sortBy, sortDir, onSort, alignRight = true }) {
  return (
    <th style={{ cursor: 'pointer', userSelect: 'none', textAlign: alignRight ? 'right' : 'left' }}
      onClick={() => onSort(col)}>
      {label} {sortBy === col ? (sortDir < 0 ? '▼' : '▲') : ''}
    </th>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Screener() {
  const navigate   = useNavigate()
  const [filters,  setFilters]   = useState({ ...BLANK })
  const [results,  setResults]   = useState([])
  const [loading,  setLoading]   = useState(false)
  const [hasRun,   setHasRun]    = useState(false)
  const [sortBy,   setSortBy]    = useState('piotroskiScore')
  const [sortDir,  setSortDir]   = useState(-1)
  const [industries, setInds]    = useState([])
  const [activePreset, setPreset] = useState(null)

  // Load industry list once
  useEffect(() => {
    axios.get('/api/fundamentals/industry-list')
      .then(r => setInds(r.data?.data || []))
      .catch(() => {})
  }, [])

  const setFilter = useCallback((key, value) => {
    setFilters(f => ({ ...f, [key]: value }))
    setPreset(null)
  }, [])

  const applyPreset = (preset) => {
    setFilters({ ...BLANK, ...preset.filters, sortBy: preset.sortBy, n: BLANK.n })
    setPreset(preset.id)
    runScreen({ ...BLANK, ...preset.filters, sortBy: preset.sortBy, n: BLANK.n })
  }

  const buildParams = (f) => {
    const p = new URLSearchParams()
    if (f.minROE              !== '') p.set('minROE',             f.minROE)
    if (f.maxPE               !== '') p.set('maxPE',              f.maxPE)
    if (f.minProfitGrowth     !== '') p.set('minProfitGrowth',    f.minProfitGrowth)
    if (f.minSalesGrowth      !== '') p.set('minSalesGrowth',     f.minSalesGrowth)
    if (f.maxDebtToEquity     !== '') p.set('maxDebtToEquity',    f.maxDebtToEquity)
    if (f.minOPM              !== '') p.set('minOPM',             f.minOPM)
    if (f.minPiotroski        !== '') p.set('minPiotroski',       f.minPiotroski)
    if (f.minPromoterHolding  !== '') p.set('minPromoterHolding', f.minPromoterHolding)
    if (f.minMarketCap        !== '') p.set('minMarketCap',       f.minMarketCap)
    if (f.maxMarketCap        !== '') p.set('maxMarketCap',       f.maxMarketCap)
    if (f.minDividendYield    !== '') p.set('minDividendYield',   f.minDividendYield)
    if (f.maxPegRatio         !== '') p.set('maxPegRatio',        f.maxPegRatio)
    if (f.industry)                   p.set('industry',           f.industry)
    if (f.minReturn1yr        !== '') p.set('minReturn1yr',       f.minReturn1yr)
    if (f.maxReturn1yr        !== '') p.set('maxReturn1yr',       f.maxReturn1yr)
    if (f.minCashFromOps      !== '') p.set('minCashFromOps',     f.minCashFromOps)
    if (f.minPatQ             !== '') p.set('minPatQ',            f.minPatQ)
    if (f.maxEvEbitda         !== '') p.set('maxEvEbitda',        f.maxEvEbitda)
    if (f.minPB               !== '') p.set('minPB',              f.minPB)
    if (f.maxPB               !== '') p.set('maxPB',              f.maxPB)
    if (f.minYoyQProfitGrowth !== '') p.set('minYoyQProfitGrowth', f.minYoyQProfitGrowth)
    if (f.belowGraham)                p.set('belowGraham',        'true')
    p.set('sortBy', f.sortBy || 'piotroskiScore')
    p.set('n',      f.n || 100)
    return p.toString()
  }

  const runScreen = async (f = filters) => {
    setLoading(true)
    setHasRun(true)
    try {
      const r = await axios.get(`/api/fundamentals/screener?${buildParams(f)}`)
      setResults(r.data?.data || [])
    } catch (e) {
      setResults([])
    }
    setLoading(false)
  }

  const reset = () => {
    setFilters({ ...BLANK })
    setResults([])
    setHasRun(false)
    setPreset(null)
  }

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => -d)
    else { setSortBy(col); setSortDir(-1) }
  }

  const sorted = useMemo(() => {
    return [...results].sort((a, b) => {
      const av = a[sortBy] ?? -Infinity
      const bv = b[sortBy] ?? -Infinity
      return sortDir * (bv - av)
    })
  }, [results, sortBy, sortDir])

  // Summary stats
  const buys  = results.filter(s => sigRating(s) === 'BUY').length
  const holds = results.filter(s => sigRating(s) === 'HOLD').length
  const sells = results.filter(s => sigRating(s) === 'SELL').length
  const avgPE = results.filter(s => s.pe != null).length
    ? (results.reduce((a, s) => a + (s.pe ?? 0), 0) / results.filter(s => s.pe != null).length).toFixed(1)
    : '—'
  const avgROE = results.filter(s => s.roe != null).length
    ? (results.reduce((a, s) => a + (s.roe ?? 0), 0) / results.filter(s => s.roe != null).length).toFixed(1)
    : '—'

  const filterGroups = [
    { label: 'Profitability', fields: [
      { key: 'minROE',          label: 'Min ROE %',             placeholder: 'e.g. 15' },
      { key: 'minOPM',          label: 'Min OPM %',             placeholder: 'e.g. 10' },
    ]},
    { label: 'Valuation', fields: [
      { key: 'maxPE',           label: 'Max P/E',               placeholder: 'e.g. 30' },
      { key: 'minPB',           label: 'Min P/B',               placeholder: 'e.g. 0' },
      { key: 'maxPB',           label: 'Max P/B',               placeholder: 'e.g. 10' },
      { key: 'maxPegRatio',     label: 'Max PEG Ratio',         placeholder: 'e.g. 1' },
      { key: 'maxEvEbitda',     label: 'Max EV/EBITDA',         placeholder: 'e.g. 20' },
    ]},
    { label: 'Growth', fields: [
      { key: 'minProfitGrowth',     label: 'Min Profit Growth %',   placeholder: 'e.g. 10' },
      { key: 'minSalesGrowth',      label: 'Min Sales Growth %',    placeholder: 'e.g. 10' },
      { key: 'minYoyQProfitGrowth', label: 'Min YoY Q Profit Gr %', placeholder: 'e.g. 5' },
    ]},
    { label: 'Returns', fields: [
      { key: 'minReturn1yr',    label: 'Min Return 1Y %',       placeholder: 'e.g. 20' },
      { key: 'maxReturn1yr',    label: 'Max Return 1Y %',       placeholder: 'e.g. 200' },
    ]},
    { label: 'Financial Health', fields: [
      { key: 'maxDebtToEquity', label: 'Max Debt/Equity',       placeholder: 'e.g. 1' },
      { key: 'minPiotroski',    label: 'Min Piotroski Score',   placeholder: 'e.g. 6' },
      { key: 'minCashFromOps',  label: 'Min Cash from Ops (Cr)',placeholder: 'e.g. 500' },
    ]},
    { label: 'Size & Income', fields: [
      { key: 'minMarketCap',    label: 'Min Mkt Cap (Cr)',      placeholder: 'e.g. 500' },
      { key: 'maxMarketCap',    label: 'Max Mkt Cap (Cr)',      placeholder: 'e.g. 100000' },
      { key: 'minDividendYield',label: 'Min Dividend Yield %',  placeholder: 'e.g. 2' },
      { key: 'minPromoterHolding',label:'Min Promoter % ',      placeholder: 'e.g. 30' },
      { key: 'minPatQ',         label: 'Min Quarterly PAT (Cr)',placeholder: 'e.g. 100' },
    ]},
  ]

  return (
    <div className="page">
      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="page-title">Advanced Stock Screener</div>
          <div className="page-sub">23 filter parameters · preset screens · CSV export · click rows for deep-dive</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={reset}>↺ Reset All</button>
          {results.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => exportCSV(sorted)}>⬇ Export CSV</button>
          )}
        </div>
      </div>

      {/* Preset screens */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title" style={{ marginBottom: 12 }}>Preset Screens</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {PRESETS.map(p => (
            <button key={p.id}
              className={`btn btn-sm ${activePreset === p.id ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => applyPreset(p)}
              title={p.desc}
            >
              {p.icon} {p.label}
            </button>
          ))}
        </div>
        {activePreset && (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>
            {PRESETS.find(p => p.id === activePreset)?.desc}
          </div>
        )}
      </div>

      <div className="layout-sidebar" style={{ marginBottom: 16 }}>
        {/* Left: filters */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Filters</div>
          </div>

          {/* Industry picker */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Industry</div>
            <select className="input" style={{ width: '100%', fontSize: 12 }}
              value={filters.industry}
              onChange={e => setFilter('industry', e.target.value)}>
              <option value="">All Industries</option>
              {industries.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>

          {/* Below Graham toggle */}
          <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="checkbox" id="belowGraham" checked={filters.belowGraham}
              onChange={e => setFilter('belowGraham', e.target.checked)}
              style={{ accentColor: 'var(--primary)' }} />
            <label htmlFor="belowGraham" style={{ fontSize: 12, cursor: 'pointer' }}>
              Below Graham intrinsic value only
            </label>
          </div>

          {/* Filter groups */}
          {filterGroups.map(group => (
            <div key={group.label} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--muted)', marginBottom: 8, borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>
                {group.label}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {group.fields.map(f => (
                  <FilterInput key={f.key}
                    label={f.label}
                    fieldKey={f.key}
                    value={filters[f.key]}
                    onChange={setFilter}
                    placeholder={f.placeholder}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Sort by */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Sort results by</div>
            <select className="input" style={{ width: '100%', fontSize: 12 }}
              value={filters.sortBy}
              onChange={e => setFilter('sortBy', e.target.value)}>
              {[
                ['piotroskiScore', 'Piotroski Score'],
                ['roe',            'ROE %'],
                ['pe',             'P/E (low first)'],
                ['opm',            'OPM %'],
                ['profitGrowth',   'Profit Growth 1Y'],
                ['salesGrowth',    'Sales Growth 1Y'],
                ['return1yr',      'Return 1Y'],
                ['return3yr',      'Return 3Y'],
                ['marketCap',      'Market Cap'],
                ['dividendYield',  'Dividend Yield'],
                ['debtToEquity',   'Debt/Equity'],
                ['grahamDiff',     'Graham Discount'],
              ].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          {/* Result limit */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Max results</div>
            <select className="input" style={{ width: '100%', fontSize: 12 }}
              value={filters.n}
              onChange={e => setFilter('n', Number(e.target.value))}>
              {[25, 50, 100, 200, 500].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => runScreen()}>
            Run Screen
          </button>
        </div>

        {/* Right: summary */}
        <div>
          <div className="card">
            <div className="card-title" style={{ marginBottom: 12 }}>Results Summary</div>
            {loading ? <Loading /> : hasRun ? (
              <>
                <div style={{ fontSize: 40, fontWeight: 800, color: 'var(--primary)', lineHeight: 1 }}>
                  {results.length}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16, marginTop: 4 }}>stocks match your filters</div>
                <div className="stat-row">
                  <span className="stat-label">BUY signals</span>
                  <span className="stat-val metric-pos">{buys}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">HOLD signals</span>
                  <span className="stat-val" style={{ color: 'var(--warning)' }}>{holds}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">SELL signals</span>
                  <span className="stat-val metric-neg">{sells}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Avg P/E</span>
                  <span className="stat-val">{avgPE}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Avg ROE %</span>
                  <span className="stat-val">{avgROE}%</span>
                </div>
                {results.length > 0 && (
                  <button className="btn btn-ghost btn-sm" style={{ width: '100%', marginTop: 14 }}
                    onClick={() => exportCSV(sorted)}>
                    ⬇ Export {results.length} rows as CSV
                  </button>
                )}
              </>
            ) : (
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                Set filters and click <strong style={{ color: 'var(--text)' }}>Run Screen</strong> — or choose a preset above.
              </div>
            )}
          </div>

          {hasRun && results.length > 0 && (
            <div className="card" style={{ marginTop: 14 }}>
              <div className="card-title" style={{ marginBottom: 10 }}>Top 3 by {filters.sortBy}</div>
              {sorted.slice(0, 3).map((s, i) => (
                <div key={s.nseCode ?? i}
                  style={{ padding: '8px 0', borderBottom: i < 2 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}
                  onClick={() => navigate(`/stock/${s.nseCode}`)}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{s.nseCode} · {s.industry}</div>
                  <div style={{ fontSize: 12, marginTop: 2 }}>
                    PE {fmt(s.pe)} · ROE {fmt(s.roe)}% · Piotroski {s.piotroskiScore ?? '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Results table */}
      {hasRun && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              {loading ? 'Running screen…' : `${sorted.length} Results`}
            </div>
            {sorted.length > 0 && (
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Click row for deep-dive</span>
            )}
          </div>
          {loading ? <Loading /> : sorted.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
              No stocks match your criteria. Try loosening the filters.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>#</th>
                    <th style={{ textAlign: 'left' }}>Company</th>
                    <th style={{ textAlign: 'left' }}>NSE</th>
                    <th style={{ textAlign: 'left' }}>Industry</th>
                    <SortTh col="currentPrice"   label="Price ₹"     sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh col="marketCap"       label="Mkt Cap"     sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh col="pe"              label="P/E"         sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh col="pb"              label="P/B"         sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh col="roe"             label="ROE %"       sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh col="opm"             label="OPM %"       sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh col="debtToEquity"    label="D/E"         sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh col="piotroskiScore"  label="Piotroski"   sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh col="profitGrowth"    label="PAT Gr%"     sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh col="return1yr"       label="Ret 1Y%"     sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh col="dividendYield"   label="Div%"        sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                    <th>Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((s, i) => (
                    <tr key={s.nseCode ?? i}
                      style={{ cursor: 'pointer' }}
                      onClick={() => s.nseCode && navigate(`/stock/${s.nseCode}`)}>
                      <td style={{ color: 'var(--muted)', fontSize: 11 }}>{i + 1}</td>
                      <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>{s.name}</td>
                      <td className="sym">{s.nseCode ?? '—'}</td>
                      <td style={{ color: 'var(--muted)', fontSize: 12, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.industry}</td>
                      <td style={{ textAlign: 'right' }}>{s.currentPrice != null ? `₹${Number(s.currentPrice).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}</td>
                      <td style={{ textAlign: 'right', fontSize: 12 }}>{fmtCr(s.marketCap)}</td>
                      <td style={{ textAlign: 'right' }}>{fmt(s.pe)}</td>
                      <td style={{ textAlign: 'right' }}>{fmt(s.pb)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <span className={(s.roe ?? 0) >= 15 ? 'metric-pos' : (s.roe ?? 0) >= 10 ? '' : 'metric-neg'}>{fmt(s.roe)}%</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>{fmt(s.opm)}%</td>
                      <td style={{ textAlign: 'right' }}>
                        <span className={(s.debtToEquity ?? 0) <= 0.5 ? 'metric-pos' : (s.debtToEquity ?? 0) > 1.5 ? 'metric-neg' : ''}>{fmt(s.debtToEquity)}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className={(s.piotroskiScore ?? 0) >= 7 ? 'metric-pos' : (s.piotroskiScore ?? 0) >= 4 ? '' : 'metric-neg'}>{s.piotroskiScore ?? '—'}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>{fmtPct(s.profitGrowth)}</td>
                      <td style={{ textAlign: 'right' }}>{fmtPct(s.return1yr)}</td>
                      <td style={{ textAlign: 'right' }}>{s.dividendYield != null ? `${fmt(s.dividendYield)}%` : '—'}</td>
                      <td><Signal rating={sigRating(s)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
