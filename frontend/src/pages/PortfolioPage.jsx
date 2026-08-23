/**
 * PortfolioPage.jsx — Portfolio X-Ray
 * Route: /portfolio
 * Local-storage persisted holdings · sector allocation · P&L · quality scores
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import axios from 'axios'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, Legend, CartesianGrid,
} from 'recharts'
import { Loading, ErrorBox, fmtCr, fmtPct, fmt, GradeBadge, Signal } from '../components/shared'

const STORAGE_KEY = 'aladdin_portfolio_v1'
const COLORS = [
  '#2f81f7', '#3fb950', '#f85149', '#d29922', '#a371f7',
  '#39c5cf', '#ff8c42', '#6ecb63', '#e05c97', '#58a6ff',
]

// ── Persist helpers ───────────────────────────────────────────────────────────
function saveHoldings(h) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(h)) } catch {} }
function loadHoldings()  { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] } }

// ── AddHoldingForm ────────────────────────────────────────────────────────────
function AddHoldingForm({ onAdd }) {
  const [sym,  setSym]  = useState('')
  const [qty,  setQty]  = useState('')
  const [avg,  setAvg]  = useState('')
  const [sugg, setSugg] = useState([])

  const search = useCallback(async (q) => {
    if (q.length < 1) { setSugg([]); return }
    try {
      const r = await axios.get(`/api/stock/search-suggest?q=${encodeURIComponent(q)}`)
      setSugg(r.data?.data?.slice(0, 6) || [])
    } catch { setSugg([]) }
  }, [])

  const submit = (e) => {
    e.preventDefault()
    if (!sym.trim() || !qty || !avg) return
    onAdd({ symbol: sym.trim().toUpperCase(), qty: parseFloat(qty), avgPrice: parseFloat(avg) })
    setSym(''); setQty(''); setAvg(''); setSugg([])
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>NSE Symbol</div>
        <input className="input" placeholder="e.g. TCS" value={sym}
          onChange={e => { setSym(e.target.value); search(e.target.value) }}
          style={{ width: 160 }} />
        {sugg.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, width: 280, zIndex: 200, marginTop: 4,
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
            boxShadow: 'var(--shadow)', maxHeight: 200, overflowY: 'auto',
          }}>
            {sugg.map((s, i) => (
              <div key={i} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12,
                borderBottom: '1px solid var(--border)' }}
                onMouseDown={() => { setSym(s.nseCode); setSugg([]) }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ fontWeight: 600 }}>{s.nseCode}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{s.name?.slice(0, 28)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Qty</div>
        <input className="input" type="number" placeholder="100" value={qty}
          onChange={e => setQty(e.target.value)} style={{ width: 90 }} />
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Avg Buy ₹</div>
        <input className="input" type="number" placeholder="2500.00" value={avg}
          onChange={e => setAvg(e.target.value)} style={{ width: 120 }} />
      </div>
      <button className="btn btn-primary" type="submit">+ Add</button>
    </form>
  )
}

// ── Sector Allocation Pie ─────────────────────────────────────────────────────
function SectorPie({ rows }) {
  const sectors = {}
  rows.forEach(r => {
    const s = r.fundamentals?.industry || 'Unknown'
    sectors[s] = (sectors[s] || 0) + (r.currentValue || r.investedValue || 0)
  })
  const data = Object.entries(sectors)
    .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(0)) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <ResponsiveContainer width={200} height={200}>
        <PieChart>
          <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={55} outerRadius={90}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 12 }}
            formatter={v => [`₹${(v/100000).toFixed(1)}L`, '']} />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ flex: 1 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
            <div style={{ flex: 1, fontSize: 12 }}>{d.name}</div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{((d.value / total) * 100).toFixed(1)}%</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── P&L Bar Chart ─────────────────────────────────────────────────────────────
function PnLChart({ rows }) {
  const data = rows.filter(r => r.pnlPct != null).map(r => ({
    name: r.symbol,
    pnl:  parseFloat((r.pnlPct || 0).toFixed(2)),
  })).sort((a, b) => b.pnl - a.pnl)

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -10, bottom: 24 }}>
        <XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 10 }} angle={-30} textAnchor="end" />
        <YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} tickFormatter={v => `${v}%`} />
        <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 12 }}
          formatter={v => [`${v}%`, 'P&L']} />
        <Bar dataKey="pnl" radius={[3,3,0,0]}>
          {data.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? 'var(--positive)' : 'var(--negative)'} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Holdings Table ────────────────────────────────────────────────────────────
function HoldingsTable({ rows, onDelete, loading }) {
  if (!rows.length) return (
    <div className="loading" style={{ height: 120 }}>Add your first holding using the form above</div>
  )
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Sector</th>
            <th>Qty</th>
            <th>Avg Cost</th>
            <th>CMP</th>
            <th>Invested</th>
            <th>Current Val</th>
            <th>P&L</th>
            <th>P&L %</th>
            <th>Grade</th>
            <th>Signal</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="sym">{r.symbol}</td>
              <td style={{ fontSize: 11, color: 'var(--muted)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {r.fundamentals?.industry || '—'}
              </td>
              <td>{r.qty.toLocaleString()}</td>
              <td>₹{r.avgPrice.toFixed(2)}</td>
              <td>
                {loading && !r.livePrice ? <span style={{ color: 'var(--muted)' }}>…</span> :
                  r.livePrice ? `₹${r.livePrice.toFixed(2)}` : '—'}
              </td>
              <td>{fmtCr(r.investedValue / 10000000)}</td>
              <td>{r.currentValue ? fmtCr(r.currentValue / 10000000) : '—'}</td>
              <td>
                {r.pnlAbs != null ? (
                  <span className={r.pnlAbs >= 0 ? 'metric-pos' : 'metric-neg'}>
                    {r.pnlAbs >= 0 ? '+' : ''}₹{Math.abs(r.pnlAbs).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </span>
                ) : '—'}
              </td>
              <td>
                {r.pnlPct != null ? (
                  <span className={r.pnlPct >= 0 ? 'metric-pos' : 'metric-neg'}>
                    {r.pnlPct >= 0 ? '+' : ''}{r.pnlPct.toFixed(2)}%
                  </span>
                ) : '—'}
              </td>
              <td><GradeBadge grade={r.fundamentals?.grade?.grade} /></td>
              <td><Signal rating={r.fundamentals?.grade?.recommendation} /></td>
              <td>
                <button className="btn btn-sm btn-ghost" onClick={() => onDelete(i)}
                  style={{ color: 'var(--negative)', padding: '2px 8px' }}>✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PortfolioPage() {
  const [holdings,  setHoldings]  = useState(() => loadHoldings())
  const [enriched,  setEnriched]  = useState([])
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)
  const [activeTab, setActiveTab] = useState('holdings')

  // Enrich all holdings: fundamentals + live price
  const enrich = useCallback(async (raw) => {
    if (!raw.length) { setEnriched([]); return }
    setLoading(true); setError(null)
    const enriched = await Promise.all(raw.map(async (h) => {
      let livePrice = null, fundamentals = null
      try {
        const r = await axios.get(`/api/stock/deep-dive?q=${encodeURIComponent(h.symbol)}`, { timeout: 10000 })
        if (r.data?.success) {
          livePrice    = r.data.data?.livePriceData?.price || null
          fundamentals = r.data.data?.company ? {
            industry:  r.data.data.company.industry,
            grade:     r.data.data.grade,
            roe:       r.data.data.company.roe,
            pe:        r.data.data.company.pe,
            opm:       r.data.data.company.opm,
          } : null
        }
      } catch {}
      const investedValue = h.qty * h.avgPrice
      const currentValue  = livePrice ? h.qty * livePrice : null
      const pnlAbs  = currentValue != null ? currentValue - investedValue : null
      const pnlPct  = pnlAbs != null ? (pnlAbs / investedValue) * 100 : null
      return { ...h, livePrice, fundamentals, investedValue, currentValue, pnlAbs, pnlPct }
    }))
    setEnriched(enriched)
    setLoading(false)
  }, [])

  useEffect(() => { enrich(holdings) }, [holdings]) // eslint-disable-line

  const addHolding = (h) => {
    const next = [...holdings, h]
    setHoldings(next); saveHoldings(next)
  }

  const deleteHolding = (idx) => {
    const next = holdings.filter((_, i) => i !== idx)
    setHoldings(next); saveHoldings(next)
  }

  // Summary stats
  const summary = useMemo(() => {
    const totalInvested = enriched.reduce((s, r) => s + (r.investedValue || 0), 0)
    const totalCurrent  = enriched.reduce((s, r) => s + (r.currentValue || r.investedValue || 0), 0)
    const totalPnl      = totalCurrent - totalInvested
    const totalPnlPct   = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0
    const numPositive   = enriched.filter(r => (r.pnlPct || 0) > 0).length
    const numNegative   = enriched.filter(r => (r.pnlPct || 0) < 0).length
    return { totalInvested, totalCurrent, totalPnl, totalPnlPct, numPositive, numNegative, count: enriched.length }
  }, [enriched])

  const TABS = [
    { id: 'holdings',  label: '📋 Holdings' },
    { id: 'sectors',   label: '🥧 Sectors' },
    { id: 'pnl',       label: '📊 P&L Chart' },
  ]

  return (
    <div className="page">
      <div style={{ marginBottom: 20 }}>
        <div className="page-title">Portfolio X-Ray</div>
        <div className="page-sub">Holdings tracker · Sector allocation · Real-time P&L · Fundamental quality scores</div>
      </div>

      {/* Add holding */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-header">
          <div>
            <div className="card-label">Holdings</div>
            <div className="card-title">Add / Manage Your Portfolio</div>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={() => enrich(holdings)} disabled={loading}>
            {loading ? '⟳ Refreshing…' : '⟳ Refresh Prices'}
          </button>
        </div>
        <AddHoldingForm onAdd={addHolding} />
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10 }}>
          ℹ Holdings saved in browser localStorage · Prices fetched live from Yahoo Finance
        </div>
      </div>

      {error && <ErrorBox msg={error} />}

      {/* Summary strip */}
      {summary.count > 0 && (
        <div className="grid-4" style={{ marginBottom: 18 }}>
          <div className="card">
            <div className="card-label">Invested</div>
            <div className="big-value" style={{ fontSize: 20, marginTop: 6 }}>
              ₹{(summary.totalInvested / 100000).toFixed(1)}L
            </div>
            <div className="sub-value">{summary.count} stocks</div>
          </div>
          <div className="card">
            <div className="card-label">Current Value</div>
            <div className="big-value" style={{ fontSize: 20, marginTop: 6 }}>
              ₹{(summary.totalCurrent / 100000).toFixed(1)}L
            </div>
            <div className="sub-value">
              {loading ? 'Updating prices…' : 'Live prices'}
            </div>
          </div>
          <div className="card">
            <div className="card-label">Total P&L</div>
            <div className={`big-value ${summary.totalPnl >= 0 ? 'metric-pos' : 'metric-neg'}`} style={{ fontSize: 20, marginTop: 6 }}>
              {summary.totalPnl >= 0 ? '+' : ''}₹{Math.abs(summary.totalPnl / 100000).toFixed(1)}L
            </div>
            <div className={summary.totalPnlPct >= 0 ? 'metric-pos sub-value' : 'metric-neg sub-value'}>
              {summary.totalPnlPct >= 0 ? '+' : ''}{summary.totalPnlPct.toFixed(2)}%
            </div>
          </div>
          <div className="card">
            <div className="card-label">Winners / Losers</div>
            <div className="big-value" style={{ fontSize: 20, marginTop: 6 }}>
              <span className="metric-pos">{summary.numPositive}▲</span>
              <span style={{ color: 'var(--muted)', margin: '0 6px' }}>/</span>
              <span className="metric-neg">{summary.numNegative}▼</span>
            </div>
            <div className="sub-value">out of {summary.count} holdings</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      {summary.count > 0 && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {TABS.map(t => (
              <button key={t.id} className={`btn btn-sm ${activeTab === t.id ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setActiveTab(t.id)}>{t.label}</button>
            ))}
          </div>

          {activeTab === 'holdings' && (
            <div className="card">
              <HoldingsTable rows={enriched} onDelete={deleteHolding} loading={loading} />
            </div>
          )}

          {activeTab === 'sectors' && (
            <div className="card">
              <div className="card-header">
                <div><div className="card-label">Allocation</div><div className="card-title">Sector Breakdown (by Value)</div></div>
              </div>
              <SectorPie rows={enriched} />
            </div>
          )}

          {activeTab === 'pnl' && (
            <div className="card">
              <div className="card-header">
                <div><div className="card-label">Returns</div><div className="card-title">P&L % per Stock</div></div>
              </div>
              <PnLChart rows={enriched} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
