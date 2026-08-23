/**
 * PeerComparison.jsx — side-by-side stock comparison
 * Route: /compare
 * Data: /api/fundamentals/compare?symbols=TCS,INFY,WIPRO
 *        /api/stock/search-suggest?q=<query>
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Loading, ErrorBox, fmtCr, fmtPct, fmt } from '../components/shared'

// ── Reuse scoring logic from StockDeepDive ───────────────────────────────────
function scoreAxes(c) {
  if (!c) return { Value: 0, Growth: 0, Quality: 0, Momentum: 0, Income: 0 }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
  const norm  = (v, lo, hi) => clamp(((v - lo) / (hi - lo)) * 10, 0, 10)

  const peScore    = c.pe         != null ? norm(50 - c.pe, 0, 50) : 5
  const pbScore    = c.pb         != null ? norm(10 - c.pb, 0, 10) : 5
  const gScore     = c.grahamDiff != null ? norm(-c.grahamDiff, -100, 100) : 5
  const Value      = parseFloat(((peScore + pbScore + gScore) / 3).toFixed(1))

  const pg3   = c.profitGrowth3yr != null ? norm(c.profitGrowth3yr, 0, 40) : 5
  const sg3   = c.salesGrowth3yr  != null ? norm(c.salesGrowth3yr,  0, 30) : 5
  const pg5   = c.profitGrowth5yr != null ? norm(c.profitGrowth5yr, 0, 40) : 5
  const Growth = parseFloat(((pg3 + sg3 + pg5) / 3).toFixed(1))

  const roeScore = c.roe           != null ? norm(c.roe,              0, 40) : 5
  const opmScore = c.opm           != null ? norm(c.opm,              0, 40) : 5
  const pioScore = c.piotroskiScore!= null ? norm(c.piotroskiScore,   0, 9 ) : 5
  const deScore  = c.debtToEquity  != null ? norm(3 - c.debtToEquity, 0, 3 ) : 5
  const Quality  = parseFloat(((roeScore + opmScore + pioScore + deScore) / 4).toFixed(1))

  const r1yr     = c.return1yr  != null ? norm(c.return1yr, -30, 80) : 5
  const r3m      = c.return3m   != null ? norm(c.return3m,  -15, 30) : 5
  const r6m      = c.return6m   != null ? norm(c.return6m,  -20, 50) : 5
  const Momentum = parseFloat(((r1yr + r3m + r6m) / 3).toFixed(1))

  const divScore  = c.dividendYield   != null ? norm(c.dividendYield,   0, 8) : 3
  const promScore = c.promoterHolding != null ? norm(c.promoterHolding, 25, 75) : 5
  const cashScore = c.cashFromOps     != null ? (c.cashFromOps > 0 ? 7 : 3) : 5
  const Income    = parseFloat(((divScore + promScore + cashScore) / 3).toFixed(1))

  return { Value, Growth, Quality, Momentum, Income }
}

const RADAR_COLORS = ['#2f81f7', '#a371f7', '#3fb950', '#d29922', '#f85149']
const MAX_STOCKS   = 5

// ── Search-suggest dropdown ───────────────────────────────────────────────────
function SearchSuggest({ onSelect }) {
  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState([])
  const [open,     setOpen]     = useState(false)
  const [loading,  setLoading]  = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const search = useCallback(async (q) => {
    if (q.length < 1) { setResults([]); setOpen(false); return }
    setLoading(true)
    try {
      const r = await axios.get(`/api/stock/search-suggest?q=${encodeURIComponent(q)}`)
      setResults(r.data?.data || [])
      setOpen(true)
    } catch { setResults([]) }
    setLoading(false)
  }, [])

  const onChange = (e) => {
    const v = e.target.value
    setQuery(v)
    search(v)
  }

  const pick = (r) => {
    onSelect(r.nseCode)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative', width: 280 }}>
      <input className="input" style={{ width: '100%' }}
        placeholder="Add stock (name or NSE code)…"
        value={query} onChange={onChange} />
      {loading && <div style={{ position: 'absolute', right: 8, top: 10, fontSize: 11, color: 'var(--muted)' }}>…</div>}
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
          boxShadow: 'var(--shadow)', marginTop: 4, maxHeight: 260, overflowY: 'auto',
        }}>
          {results.map((r, i) => (
            <div key={i}
              style={{ padding: '9px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: 13 }}
              onMouseDown={() => pick(r)}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ fontWeight: 600 }}>{r.name}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                {r.nseCode} · {r.industry}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Metric row ────────────────────────────────────────────────────────────────
function MetricRow({ label, stocks, field, format, higherIsBetter, suffix = '' }) {
  const values = stocks.map(s => s[field])
  const valid  = values.filter(v => v != null && !isNaN(v))
  if (valid.length === 0) return null
  const best = higherIsBetter ? Math.max(...valid) : Math.min(...valid)

  return (
    <tr>
      <td style={{ color: 'var(--muted)', fontSize: 12, padding: '8px 12px', whiteSpace: 'nowrap' }}>{label}</td>
      {stocks.map((s, i) => {
        const v = s[field]
        const isBest = v != null && v === best
        const display = v != null ? `${format ? format(v) : Number(v).toFixed(1)}${suffix}` : '—'
        return (
          <td key={i} style={{
            padding: '8px 12px', textAlign: 'right', fontSize: 13, fontWeight: isBest ? 700 : 400,
            background: isBest ? 'rgba(63,185,80,.08)' : 'transparent',
            color: isBest ? 'var(--positive)' : 'var(--text)',
          }}>
            {display}
          </td>
        )
      })}
    </tr>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PeerComparison() {
  const [symbols,  setSymbols]  = useState(['TCS', 'INFY', 'WIPRO'])
  const [stocks,   setStocks]   = useState([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)

  const load = useCallback(async (syms) => {
    if (!syms.length) { setStocks([]); return }
    setLoading(true)
    setError(null)
    try {
      const r = await axios.get(`/api/fundamentals/compare?symbols=${syms.join(',')}`)
      if (!r.data.success) throw new Error(r.data.error || 'Failed')
      setStocks(r.data.data || [])
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [])

  useEffect(() => { load(symbols) }, []) // eslint-disable-line

  const addSymbol = (code) => {
    if (!code) return
    const upper = code.toUpperCase()
    if (symbols.includes(upper) || symbols.length >= MAX_STOCKS) return
    const next = [...symbols, upper]
    setSymbols(next)
    load(next)
  }

  const removeSymbol = (code) => {
    const next = symbols.filter(s => s !== code)
    setSymbols(next)
    load(next)
  }

  // Radar data
  const radarData = Object.keys(scoreAxes({})).map(axis => {
    const row = { axis }
    stocks.forEach((s, i) => { row[`stock${i}`] = scoreAxes(s)[axis] })
    return row
  })

  const sections = [
    { label: 'Valuation', rows: [
      { label: 'Price ₹',        field: 'currentPrice',   higherIsBetter: false, format: v => `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, suffix: '' },
      { label: 'P/E Ratio',      field: 'pe',             higherIsBetter: false },
      { label: 'P/B Ratio',      field: 'pb',             higherIsBetter: false },
      { label: 'PEG Ratio',      field: 'pegRatio',       higherIsBetter: false },
      { label: 'EV/EBITDA',      field: 'evEbitda',       higherIsBetter: false },
      { label: 'Graham Diff %',  field: 'grahamDiff',     higherIsBetter: false },
    ]},
    { label: 'Profitability', rows: [
      { label: 'ROE %',          field: 'roe',            higherIsBetter: true,  suffix: '%' },
      { label: 'ROE 3Y avg %',   field: 'roe3yr',         higherIsBetter: true,  suffix: '%' },
      { label: 'OPM %',          field: 'opm',            higherIsBetter: true,  suffix: '%' },
      { label: 'OPM (Q) %',      field: 'opmQ',           higherIsBetter: true,  suffix: '%' },
      { label: 'NPM %',          field: 'npm',            higherIsBetter: true,  suffix: '%' },
      { label: 'NPM (Q) %',      field: 'npmQ',           higherIsBetter: true,  suffix: '%' },
    ]},
    { label: 'Growth', rows: [
      { label: 'Sales Gr 1Y %',  field: 'salesGrowth',    higherIsBetter: true,  suffix: '%' },
      { label: 'Sales Gr 3Y %',  field: 'salesGrowth3yr', higherIsBetter: true,  suffix: '%' },
      { label: 'Profit Gr 1Y %', field: 'profitGrowth',   higherIsBetter: true,  suffix: '%' },
      { label: 'Profit Gr 3Y %', field: 'profitGrowth3yr',higherIsBetter: true,  suffix: '%' },
      { label: 'YoY Q Profit %', field: 'yoyQProfitGrowth',higherIsBetter: true, suffix: '%' },
      { label: 'QoQ Profit %',   field: 'qoqProfits',     higherIsBetter: true,  suffix: '%' },
    ]},
    { label: 'Financial Health', rows: [
      { label: 'Piotroski Score', field: 'piotroskiScore', higherIsBetter: true, suffix: '/9' },
      { label: 'Debt/Equity',     field: 'debtToEquity',   higherIsBetter: false },
      { label: 'Cash from Ops',   field: 'cashFromOps',    higherIsBetter: true, format: v => fmtCr(v), suffix: '' },
      { label: 'Net Cash Flow',   field: 'netCashFlow',    higherIsBetter: true, format: v => fmtCr(v), suffix: '' },
    ]},
    { label: 'Returns', rows: [
      { label: 'Return 3M %',    field: 'return3m',       higherIsBetter: true,  suffix: '%' },
      { label: 'Return 6M %',    field: 'return6m',       higherIsBetter: true,  suffix: '%' },
      { label: 'Return 1Y %',    field: 'return1yr',      higherIsBetter: true,  suffix: '%' },
      { label: 'Return 3Y %',    field: 'return3yr',      higherIsBetter: true,  suffix: '%' },
      { label: 'Return 5Y %',    field: 'return5yr',      higherIsBetter: true,  suffix: '%' },
    ]},
    { label: 'Shareholding', rows: [
      { label: 'Promoter %',     field: 'promoterHolding', higherIsBetter: true, suffix: '%' },
      { label: 'FII %',          field: 'fiiHolding',      higherIsBetter: true, suffix: '%' },
      { label: 'DII %',          field: 'diiHolding',      higherIsBetter: true, suffix: '%' },
      { label: 'Dividend Yield', field: 'dividendYield',   higherIsBetter: true, suffix: '%' },
    ]},
  ]

  return (
    <div className="page">
      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
        <div>
          <div className="page-title">Peer Comparison</div>
          <div className="page-sub">Side-by-side analysis · up to 5 stocks · green = winner per metric</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {symbols.length < MAX_STOCKS && <SearchSuggest onSelect={addSymbol} />}
          <button className="btn btn-ghost btn-sm" onClick={() => load(symbols)}>↺ Refresh</button>
        </div>
      </div>

      {/* Symbol chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {symbols.map((s, i) => (
          <div key={s} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 20, fontSize: 13, fontWeight: 600,
            background: `${RADAR_COLORS[i]}22`, border: `1px solid ${RADAR_COLORS[i]}55`,
            color: RADAR_COLORS[i],
          }}>
            <Link to={`/stock/${s}`} style={{ color: 'inherit' }}>{s}</Link>
            <button style={{ color: 'inherit', opacity: 0.7, fontSize: 15 }} onClick={() => removeSymbol(s)}>×</button>
          </div>
        ))}
        {symbols.length === 0 && (
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>No stocks selected. Use the search above to add up to 5 stocks.</span>
        )}
      </div>

      {error && <ErrorBox msg={error} />}
      {loading && <Loading />}

      {!loading && stocks.length > 0 && (
        <>
          {/* Radar comparison */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <div className="card-title">Normalized Score Comparison</div>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>Value · Growth · Quality · Momentum · Income — each 0–10</span>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart
                data={radarData}
                margin={{ top: 10, right: 40, left: 40, bottom: 10 }}
              >
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="axis" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
                {stocks.map((s, i) => (
                  <Radar
                    key={i}
                    name={s.name ?? s.nseCode ?? `Stock ${i + 1}`}
                    dataKey={`stock${i}`}
                    stroke={RADAR_COLORS[i]}
                    fill={RADAR_COLORS[i]}
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                ))}
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [Number(v).toFixed(1)]}
                />
              </RadarChart>
            </ResponsiveContainer>

            {/* Total scores */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
              {stocks.map((s, i) => {
                const total = Object.values(scoreAxes(s)).reduce((a, b) => a + b, 0)
                return (
                  <div key={i} style={{ textAlign: 'center', padding: '8px 16px', background: 'var(--bg3)', borderRadius: 8 }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: RADAR_COLORS[i] }}>
                      {total.toFixed(0)}<span style={{ fontSize: 12, color: 'var(--muted)' }}>/50</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.name ?? s.nseCode}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Comparison table */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Full Metrics Table</div>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>Green highlight = best in group per metric</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ tableLayout: 'fixed', minWidth: 500 }}>
                <colgroup>
                  <col style={{ width: 160 }} />
                  {stocks.map((_, i) => <col key={i} />)}
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Metric</th>
                    {stocks.map((s, i) => (
                      <th key={i} style={{ textAlign: 'right' }}>
                        <Link to={`/stock/${s.nseCode}`}
                          style={{ color: RADAR_COLORS[i], fontWeight: 700, fontSize: 12 }}>
                          {s.nseCode ?? `S${i + 1}`}
                        </Link>
                        <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.industry}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sections.map(section => (
                    <>
                      <tr key={section.label + '_hd'}>
                        <td colSpan={stocks.length + 1} style={{
                          padding: '10px 12px 4px', fontSize: 11, fontWeight: 700,
                          textTransform: 'uppercase', letterSpacing: '.7px',
                          color: 'var(--muted)', borderBottom: '1px solid var(--border)',
                          background: 'var(--bg3)',
                        }}>
                          {section.label}
                        </td>
                      </tr>
                      {section.rows.map(row => (
                        <MetricRow key={row.field} {...row} stocks={stocks} />
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!loading && stocks.length === 0 && symbols.length > 0 && !error && (
        <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>
          No data found for the selected symbols. Try different NSE codes.
        </div>
      )}
    </div>
  )
}
