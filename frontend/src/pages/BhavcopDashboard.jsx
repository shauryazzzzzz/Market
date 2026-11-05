/**
 * BhavcopDashboard.jsx
 * NSE Bhavcopy — daily end-of-day market data dashboard.
 * Data source: NSE India public Bhavcopy archive (no dummy data).
 *
 * Sections:
 *  1. Market Summary cards (turnover, A/D, breadth)
 *  2. Sector Performance bar chart
 *  3. Tabbed data tables: Gainers | Losers | Most Active (Value) | Most Active (Vol) | Delivery
 *  4. Advance-Decline heatmap ring + sector treemap
 */

import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend, Treemap,
} from 'recharts'

// ── Shared style helpers ───────────────────────────────────────────────────────
const fmt2  = n => n == null ? '—' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })
const fmtCr = n => { if (n == null) return '—'; if (n >= 100000) return `₹${(n/100000).toFixed(1)}L Cr`; if (n >= 1000) return `₹${(n/1000).toFixed(1)}K Cr`; return `₹${n.toFixed(0)} Cr`; }
const Chg   = ({ v }) => { if (v == null) return <span style={{color:'var(--muted)'}}>—</span>; const pos = v >= 0; return <span className={pos?'metric-pos':'metric-neg'}>{pos?'▲':'▼'} {Math.abs(v).toFixed(2)}%</span> }

// ── Palette for charts ─────────────────────────────────────────────────────────
const GREEN = '#3fb950'
const RED   = '#f85149'
const BLUE  = '#2f81f7'
const MUTED = '#8b949e'
const SECTOR_COLORS = ['#2f81f7','#3fb950','#a371f7','#d29922','#f85149','#58a6ff','#7ee787','#ffa657','#ff7b72','#79c0ff']

// ── Reusable: loading spinner ──────────────────────────────────────────────────
function Spin() {
  return <div className="loading"><div className="spin"/><span>Fetching NSE Bhavcopy data…</span></div>
}

// ── Reusable: error block with retry ──────────────────────────────────────────
function ErrBlock({ msg, onRetry }) {
  return (
    <div className="error-box" style={{ margin: '24px 0', display:'flex', alignItems:'center', gap:12, justifyContent:'space-between' }}>
      <span>⚠ {msg}</span>
      {onRetry && <button className="btn btn-ghost btn-sm" onClick={onRetry}>Retry</button>}
    </div>
  )
}

// ── Summary metric card ────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, color }) {
  return (
    <div className="card" style={{ display:'flex', flexDirection:'column', gap:6 }}>
      <div className="card-label">{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || 'var(--text)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color:'var(--muted)' }}>{sub}</div>}
    </div>
  )
}

// ── Sortable, searchable, paginated data table ─────────────────────────────────
const PAGE_SZ = 15

const COL_DEFS = [
  { key:'sym',          label:'Symbol',      num:false },
  { key:'series',       label:'Series',      num:false },
  { key:'open',         label:'Open',        num:true  },
  { key:'high',         label:'High',        num:true  },
  { key:'low',          label:'Low',         num:true  },
  { key:'close',        label:'Close',       num:true  },
  { key:'prevClose',    label:'Prev Close',  num:true  },
  { key:'changePts',    label:'Chg (₹)',     num:true  },
  { key:'changePct',    label:'Chg %',       num:true  },
  { key:'qty',          label:'Volume',      num:true  },
  { key:'turnoverCr',   label:'TO (Cr)',     num:true  },
  { key:'sector',       label:'Sector',      num:false },
]

const DELIVERY_COLS = [
  ...COL_DEFS,
  { key:'delivQty',  label:'Deliv Qty',  num:true },
  { key:'delivPct',  label:'Deliv %',    num:true },
]

function DataTable({ rows, extraCols = false }) {
  const [sortKey, setSortKey]   = useState('changePct')
  const [sortDir, setSortDir]   = useState(-1)   // -1 = desc, 1 = asc
  const [search,  setSearch]    = useState('')
  const [page,    setPage]      = useState(1)

  const cols = extraCols ? DELIVERY_COLS : COL_DEFS

  const filtered = rows.filter(r => !search || r.sym.includes(search.toUpperCase()) || (r.sector||'').toLowerCase().includes(search.toLowerCase()))

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey]; const bv = b[sortKey]
    if (av == null && bv == null) return 0
    if (av == null) return 1; if (bv == null) return -1
    return (av > bv ? 1 : av < bv ? -1 : 0) * sortDir
  })

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SZ))
  const paginated  = sorted.slice((page-1)*PAGE_SZ, page*PAGE_SZ)

  const toggleSort = col => {
    if (sortKey === col) setSortDir(d => -d)
    else { setSortKey(col); setSortDir(-1) }
    setPage(1)
  }

  const thSt = {
    padding:'8px 10px', fontSize:11, textTransform:'uppercase', letterSpacing:'.6px',
    color:'var(--muted)', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap',
    cursor:'pointer', userSelect:'none', background:'var(--bg3)', position:'sticky', top:0,
  }
  const tdSt = (num, val) => ({
    padding:'8px 10px', borderBottom:'1px solid rgba(48,54,61,.4)',
    fontSize:12, textAlign: num ? 'right' : 'left',
    color: num && typeof val === 'number' ? (val > 0 ? GREEN : val < 0 ? RED : 'var(--text)') : 'var(--text)',
    fontWeight: num && Math.abs(val||0) > 3 ? 600 : 400,
    whiteSpace:'nowrap',
  })

  const renderCell = (row, col) => {
    const v = row[col.key]
    if (col.key === 'sym') return <span style={{fontWeight:700, color:BLUE}}>{v}</span>
    if (col.key === 'changePct') return <Chg v={v} />
    if (col.key === 'changePts') return v == null ? '—' : (v > 0 ? '+' : '') + v.toFixed(2)
    if (col.key === 'turnoverCr') return fmtCr(v)
    if (col.key === 'qty') return fmt2(v)
    if (col.key === 'delivQty') return fmt2(v)
    if (col.key === 'delivPct') return v == null ? '—' : <span style={{color:v>60?GREEN:v>40?'var(--warning)':'var(--text)'}}>{v.toFixed(1)}%</span>
    if (col.num) return fmt2(v)
    return v || '—'
  }

  return (
    <div>
      {/* Search + count */}
      <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:10, flexWrap:'wrap' }}>
        <input
          className="input"
          style={{ width:180, fontSize:12, padding:'5px 10px' }}
          placeholder="🔍 Filter symbol / sector…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
        />
        <span style={{ fontSize:11, color:'var(--muted)' }}>{filtered.length} stocks</span>
      </div>

      {/* Table */}
      <div style={{ overflowX:'auto', maxHeight:480, overflowY:'auto' }}>
        <table className="data-table" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              {cols.map(c => (
                <th key={c.key} style={{ ...thSt, textAlign: c.num ? 'right' : 'left' }} onClick={() => toggleSort(c.key)}>
                  {c.label}{sortKey===c.key ? (sortDir===-1?' ↓':' ↑') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map((row, i) => (
              <tr key={i} style={{ transition:'background .1s' }}
                onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.04)'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}
              >
                {cols.map(c => (
                  <td key={c.key} style={tdSt(c.num, row[c.key])}>
                    {renderCell(row, c)}
                  </td>
                ))}
              </tr>
            ))}
            {paginated.length === 0 && (
              <tr><td colSpan={cols.length} style={{ textAlign:'center', padding:24, color:'var(--muted)', fontSize:12 }}>No data</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:10, justifyContent:'center', flexWrap:'wrap' }}>
          <button className="btn btn-ghost btn-sm" disabled={page===1} onClick={() => setPage(1)}>«</button>
          <button className="btn btn-ghost btn-sm" disabled={page===1} onClick={() => setPage(p=>p-1)}>‹</button>
          <span style={{ fontSize:11, color:'var(--muted)', padding:'0 6px' }}>Page {page} / {totalPages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page===totalPages} onClick={() => setPage(p=>p+1)}>›</button>
          <button className="btn btn-ghost btn-sm" disabled={page===totalPages} onClick={() => setPage(totalPages)}>»</button>
        </div>
      )}
    </div>
  )
}

// ── Sector Performance bar chart ───────────────────────────────────────────────
function SectorChart({ data }) {
  if (!data || data.length === 0) return <div style={{color:'var(--muted)', fontSize:12, padding:16}}>No sector data</div>

  const topSectors = [...data]
    .sort((a,b) => b.turnoverCr - a.turnoverCr)
    .slice(0, 12)
    .map((s, i) => ({ ...s, fill: SECTOR_COLORS[i % SECTOR_COLORS.length] }))

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    return (
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:6, padding:'10px 14px', fontSize:12 }}>
        <div style={{ fontWeight:700, marginBottom:4 }}>{d.sector}</div>
        <div>Stocks: {d.count}</div>
        <div>Advances: <span style={{color:GREEN}}>{d.advances}</span> / Declines: <span style={{color:RED}}>{d.declines}</span></div>
        <div>Avg Change: <span style={{color:d.avgChangePct>=0?GREEN:RED}}>{d.avgChangePct>=0?'+':''}{d.avgChangePct}%</span></div>
        <div>Turnover: {fmtCr(d.turnoverCr)}</div>
      </div>
    )
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
      {/* Turnover bar chart */}
      <div>
        <div style={{ fontSize:12, color:'var(--muted)', marginBottom:8 }}>Turnover by Sector (₹ Cr)</div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={topSectors} layout="vertical" margin={{ left:10, right:20, top:0, bottom:0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
            <XAxis type="number" tick={{ fill:'var(--muted)', fontSize:10 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
            <YAxis type="category" dataKey="sector" tick={{ fill:'var(--text)', fontSize:11 }} width={88} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="turnoverCr" radius={[0,3,3,0]}>
              {topSectors.map((s, i) => <Cell key={i} fill={s.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Avg change bar chart */}
      <div>
        <div style={{ fontSize:12, color:'var(--muted)', marginBottom:8 }}>Avg % Change by Sector</div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={topSectors} layout="vertical" margin={{ left:10, right:20, top:0, bottom:0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
            <XAxis type="number" tick={{ fill:'var(--muted)', fontSize:10 }} tickFormatter={v => `${v}%`} />
            <YAxis type="category" dataKey="sector" tick={{ fill:'var(--text)', fontSize:11 }} width={88} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="avgChangePct" radius={[0,3,3,0]}>
              {topSectors.map((s, i) => <Cell key={i} fill={s.avgChangePct >= 0 ? GREEN : RED} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ── Advance-Decline donut chart ────────────────────────────────────────────────
function ADChart({ advances, declines, unchanged }) {
  const data = [
    { name:'Advances', value:advances,  fill:GREEN },
    { name:'Declines', value:declines,  fill:RED   },
    { name:'Unchanged',value:unchanged, fill:MUTED },
  ]
  const total = advances + declines + unchanged

  return (
    <div style={{ display:'flex', alignItems:'center', gap:20, justifyContent:'center', flexWrap:'wrap' }}>
      <PieChart width={180} height={180}>
        <Pie data={data} cx={85} cy={85} innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
          {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
        </Pie>
      </PieChart>
      <div style={{ display:'flex', flexDirection:'column', gap:8, fontSize:13 }}>
        {data.map(d => (
          <div key={d.name} style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ width:10, height:10, borderRadius:'50%', background:d.fill, flexShrink:0 }}/>
            <span style={{ color:'var(--muted)', minWidth:70 }}>{d.name}</span>
            <span style={{ fontWeight:700 }}>{d.value.toLocaleString()}</span>
            <span style={{ color:'var(--muted)', fontSize:11 }}>({total > 0 ? (d.value/total*100).toFixed(1) : 0}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Delivery vs Volume scatter-like bar chart ─────────────────────────────────
function DeliveryChart({ rows }) {
  if (!rows || rows.length === 0) return <div style={{color:'var(--muted)',fontSize:12,padding:16}}>No delivery data available for this session</div>

  const top15 = [...rows].sort((a,b) => (b.delivPct||0)-(a.delivPct||0)).slice(0, 15)

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={top15} margin={{ left:0, right:10, top:0, bottom:30 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="sym" tick={{ fill:'var(--muted)', fontSize:10 }} angle={-35} textAnchor="end" interval={0} />
        <YAxis tick={{ fill:'var(--muted)', fontSize:10 }} domain={[0,100]} tickFormatter={v=>`${v}%`} />
        <Tooltip
          contentStyle={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:6, fontSize:12 }}
          formatter={(v, name) => [`${v.toFixed(1)}%`, 'Delivery %']}
        />
        <Bar dataKey="delivPct" name="Delivery %" radius={[3,3,0,0]}>
          {top15.map((r, i) => <Cell key={i} fill={r.delivPct > 60 ? GREEN : r.delivPct > 40 ? BLUE : MUTED} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Tabs component ─────────────────────────────────────────────────────────────
const TABS = [
  { id:'gainers',  label:'🚀 Top Gainers',   api:'/api/bhavcopy/gainers?limit=50',       delivery:false },
  { id:'losers',   label:'📉 Top Losers',    api:'/api/bhavcopy/losers?limit=50',        delivery:false },
  { id:'value',    label:'💰 Most Active (₹)',api:'/api/bhavcopy/active?by=value&limit=50',delivery:false },
  { id:'volume',   label:'📊 Most Active (Vol)',api:'/api/bhavcopy/active?by=volume&limit=50',delivery:false },
  { id:'delivery', label:'📦 High Delivery',  api:'/api/bhavcopy/delivery?limit=50',      delivery:true  },
]

function TablesSection({ tradeDate }) {
  const [activeTab, setActiveTab] = useState('gainers')
  const [tabData, setTabData]     = useState({})
  const [tabLoading, setTabLoading] = useState({})
  const [tabError, setTabError]   = useState({})

  const loadTab = useCallback(async (tab) => {
    if (tabData[tab.id]) return   // already loaded
    setTabLoading(prev => ({ ...prev, [tab.id]: true }))
    setTabError(prev => ({ ...prev, [tab.id]: null }))
    try {
      const r = await axios.get(tab.api, { timeout: 25000 })
      if (!r.data.success) throw new Error(r.data.error || 'Server error')
      setTabData(prev => ({ ...prev, [tab.id]: r.data.data || [] }))
    } catch (e) {
      setTabError(prev => ({ ...prev, [tab.id]: e.message }))
    } finally {
      setTabLoading(prev => ({ ...prev, [tab.id]: false }))
    }
  }, [tabData])

  useEffect(() => {
    const tab = TABS.find(t => t.id === activeTab)
    if (tab) loadTab(tab)
  }, [activeTab, loadTab])

  const tab = TABS.find(t => t.id === activeTab)
  const rows    = tabData[activeTab] || []
  const loading = tabLoading[activeTab]
  const error   = tabError[activeTab]

  return (
    <div className="card" style={{ marginTop:16 }}>
      <div className="card-header">
        <div>
          <div className="card-label">NSE Bhavcopy Tables</div>
          <div className="card-title">Daily Market Data · {tradeDate}</div>
        </div>
      </div>

      {/* Tab row */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:16, borderBottom:'1px solid var(--border)', paddingBottom:10 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`btn btn-sm ${activeTab === t.id ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab(t.id)}
          >{t.label}</button>
        ))}
      </div>

      {loading && <Spin />}
      {!loading && error && <ErrBlock msg={error} onRetry={() => { setTabData(p=>({...p,[activeTab]:undefined})); loadTab(tab) }} />}
      {!loading && !error && <DataTable rows={rows} extraCols={tab?.delivery} />}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function BhavcopDashboard() {
  const [summary, setSummary] = useState(null)
  const [sectors, setSectors] = useState([])
  const [delivery, setDelivery] = useState([])
  const [loading, setLoading]  = useState(true)
  const [error, setError]      = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [sumR, secR, delR] = await Promise.allSettled([
        axios.get('/api/bhavcopy/summary', { timeout: 30000 }),
        axios.get('/api/bhavcopy/sectors',  { timeout: 30000 }),
        axios.get('/api/bhavcopy/delivery?limit=20', { timeout: 30000 }),
      ])

      if (sumR.status === 'fulfilled' && sumR.value.data?.success) {
        setSummary(sumR.value.data)
      } else {
        const errMsg = sumR.reason?.message || sumR.value?.data?.error || 'Failed to fetch summary'
        setError(errMsg)
      }
      if (secR.status === 'fulfilled' && secR.value.data?.success) setSectors(secR.value.data.data || [])
      if (delR.status === 'fulfilled' && delR.value.data?.success) setDelivery(delR.value.data.data || [])

      setLastRefresh(new Date().toLocaleTimeString('en-IN'))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleRefresh = async () => {
    setLoading(true)
    try { await axios.post('/api/bhavcopy/refresh', {}, { timeout: 5000 }) } catch (_) {}
    await load()
  }

  return (
    <div className="page">
      {/* Page header */}
      <div style={{ marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'flex-end', flexWrap:'wrap', gap:10 }}>
        <div>
          <div className="page-title">📥 NSE Bhavcopy Dashboard</div>
          <div className="page-sub">
            Daily end-of-day data from NSE India · Equity EQ Series · No dummy data
            {lastRefresh && <span style={{ marginLeft:10 }}>· Last fetched: {lastRefresh}</span>}
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {summary?.tradeDate && (
            <span className="pill neutral">Trade Date: {summary.tradeDate}</span>
          )}
          <button className="btn btn-ghost btn-sm" onClick={handleRefresh} disabled={loading}>
            {loading ? 'Fetching…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && !summary && (
        <div className="card" style={{ padding:32 }}>
          <Spin />
          <div style={{ textAlign:'center', color:'var(--muted)', fontSize:12, marginTop:12 }}>
            Downloading NSE Bhavcopy ZIP from NSE archives… this takes ~10–15 seconds on first load.
          </div>
        </div>
      )}

      {/* Error state — informative, no silent fallback */}
      {error && !loading && (
        <ErrBlock
          msg={error}
          onRetry={handleRefresh}
        />
      )}

      {/* ── Summary cards ── */}
      {summary && (
        <>
          <div className="grid-4" style={{ marginBottom:16 }}>
            <MetricCard label="Total Turnover" value={fmtCr(summary.totalTurnoverCr)} sub={`${summary.totalSymbols?.toLocaleString()} symbols traded`} />
            <MetricCard label="Advances" value={summary.advances?.toLocaleString()} sub={`${summary.declines?.toLocaleString()} declines · ${summary.unchanged?.toLocaleString()} unchanged`} color={GREEN} />
            <MetricCard label="Declines" value={summary.declines?.toLocaleString()} sub={`A/D Ratio: ${summary.adRatio ?? '—'}`} color={RED} />
            <MetricCard label="A/D Ratio" value={summary.adRatio ?? '—'} sub={summary.adRatio >= 1 ? '● Breadth Positive' : '● Breadth Negative'} color={summary.adRatio >= 1 ? GREEN : RED} />
          </div>

          {/* ── Breadth + Sectors ── */}
          <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:16, marginBottom:16 }}>
            {/* A/D Donut */}
            <div className="card">
              <div className="card-label">Market Breadth</div>
              <div className="card-title" style={{ marginBottom:14 }}>Advance / Decline</div>
              <ADChart advances={summary.advances} declines={summary.declines} unchanged={summary.unchanged} />
            </div>

            {/* Sector chart */}
            <div className="card">
              <div className="card-label">Sector Analysis</div>
              <div className="card-title" style={{ marginBottom:14 }}>Performance & Turnover</div>
              {sectors.length > 0 ? <SectorChart data={sectors} /> : <div style={{color:'var(--muted)',fontSize:12}}>Loading sectors…</div>}
            </div>
          </div>

          {/* ── Delivery chart ── */}
          {delivery.length > 0 && (
            <div className="card" style={{ marginBottom:16 }}>
              <div className="card-label">Delivery Analysis</div>
              <div className="card-title" style={{ marginBottom:14 }}>Top 15 High Delivery % Stocks</div>
              <DeliveryChart rows={delivery} />
            </div>
          )}

          {/* ── Data tables ── */}
          <TablesSection tradeDate={summary.tradeDate} />
        </>
      )}

      {/* Data attribution */}
      <div style={{ marginTop:24, fontSize:11, color:'var(--muted)', textAlign:'center' }}>
        Data sourced from NSE India public Bhavcopy archives · {summary?.source} · Updated post-market close (~18:30 IST)
      </div>
    </div>
  )
}
