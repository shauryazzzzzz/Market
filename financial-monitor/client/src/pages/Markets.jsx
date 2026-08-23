import { useState, useEffect } from 'react'
import axios from 'axios'
import { Loading, ErrorBox, Change, fmtCr } from '../components/shared'

function GlobalCard({ name, value, change }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{name}</div>
      <div className="kpi-value" style={{ fontSize: 20 }}>
        {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
      </div>
      <div className="kpi-change"><Change v={change} /></div>
    </div>
  )
}

function SectorTable({ rows }) {
  if (!rows?.length) return <div className="loading">No sectoral data — DB may be empty</div>
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Sector</th>
          <th className="right">Stocks</th>
          <th className="right">Avg Return</th>
          <th className="right">Avg P/E</th>
          <th className="right">Avg ROE</th>
          <th className="right">Total Mkt Cap</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td style={{ fontWeight: 600, fontSize: 12 }}>{r.sector}</td>
            <td className="right">{r.stock_count}</td>
            <td className="right"><Change v={r.avg_return} /></td>
            <td className="right">{r.avg_pe ? parseFloat(r.avg_pe).toFixed(1) : '—'}</td>
            <td className="right">{r.avg_roe ? <span className={parseFloat(r.avg_roe) >= 15 ? 'metric-pos' : 'metric-neu'}>{parseFloat(r.avg_roe).toFixed(1)}%</span> : '—'}</td>
            <td className="right">{fmtCr(r.total_market_cap)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function Markets() {
  const [global, setGlobal]     = useState(null)
  const [sectoral, setSectoral] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => {
    Promise.allSettled([
      axios.get('/api/markets/global'),
      axios.get('/api/markets/sectoral-indices'),
    ]).then(([g, s]) => {
      if (g.status === 'fulfilled') setGlobal(g.value.data?.data)
      else setError('Financial Monitor API not responding on :5000')
      if (s.status === 'fulfilled') setSectoral(s.value.data?.data || [])
      setLoading(false)
    })
  }, [])

  return (
    <div className="page">
      <div className="page-title">🌍 Market Overview</div>
      <div className="page-sub">Global indices · India VIX · NSE sectoral performance</div>

      <ErrorBox msg={error} />

      {/* Global indices */}
      <div className="card-header" style={{ marginBottom: 10 }}>
        <div><div className="card-label">Global Indices</div><div className="card-title">Key market benchmarks</div></div>
      </div>
      {loading ? <Loading /> : global && (
        <div className="grid-4" style={{ marginBottom: 24 }}>
          {Object.values(global).map((item, i) => (
            <GlobalCard key={i} name={item.name} value={item.value} change={item.change} />
          ))}
        </div>
      )}

      {/* Sectoral performance */}
      <div className="card">
        <div className="card-header">
          <div><div className="card-label">Sector Performance</div><div className="card-title">NSE 500 Sector Returns</div></div>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{sectoral.length} sectors</span>
        </div>
        {loading ? <Loading /> : (
          sectoral.length === 0
            ? <div className="loading" style={{ padding: 16 }}>No sectoral data in DB yet — add stocks via CSV import</div>
            : <div style={{ overflowX: 'auto' }}><SectorTable rows={sectoral} /></div>
        )}
      </div>
    </div>
  )
}
