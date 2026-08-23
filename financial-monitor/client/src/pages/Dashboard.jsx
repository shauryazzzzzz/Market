import { useState, useEffect } from 'react'
import axios from 'axios'
import { Loading, ErrorBox, SectorBadge, Change, fmtCr } from '../components/shared'

function KpiCard({ label, value, sub, tone }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${tone || ''}`}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{sub}</div>}
    </div>
  )
}

function TopStocksTable({ stocks }) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Ticker</th>
          <th>Company</th>
          <th><SectorBadge sector="Sector" /></th>
          <th className="right">Price</th>
          <th className="right">Mkt Cap</th>
          <th className="right">P/E</th>
          <th className="right">ROE</th>
          <th className="right">1Y Rtn</th>
        </tr>
      </thead>
      <tbody>
        {stocks.map((s, i) => {
          const chg = parseFloat(s.return_1y) || 0
          return (
            <tr key={s.ticker}>
              <td style={{ color: 'var(--muted)', fontSize: 11 }}>{s.nse_rank || i + 1}</td>
              <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{s.ticker}</td>
              <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.company_name}</td>
              <td><SectorBadge sector={s.sector} /></td>
              <td className="right">{s.current_price ? `₹${parseFloat(s.current_price).toLocaleString('en-IN')}` : '—'}</td>
              <td className="right">{fmtCr(s.market_cap)}</td>
              <td className="right">{s.pe_ratio ? parseFloat(s.pe_ratio).toFixed(1) : '—'}</td>
              <td className="right">
                {s.roe ? <span className={parseFloat(s.roe) >= 15 ? 'metric-pos' : 'metric-neu'}>{parseFloat(s.roe).toFixed(1)}%</span> : '—'}
              </td>
              <td className="right">
                {s.return_1y != null ? <Change v={chg} /> : '—'}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export default function Dashboard() {
  const [stocks, setStocks]   = useState([])
  const [sectors, setSectors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    Promise.allSettled([
      axios.get('/api/stocks?limit=20&sortBy=nse_rank'),
      axios.get('/api/stocks/sectors/list'),
    ]).then(([s, sec]) => {
      if (s.status === 'fulfilled')   setStocks(s.value.data?.data || [])
      else setError('Cannot reach Financial Monitor API on :5000')
      if (sec.status === 'fulfilled') setSectors(sec.value.data?.data || [])
      setLoading(false)
    })
  }, [])

  const totalStocks = 1298
  const sectorCount = sectors.length
  const avgPE = stocks.length
    ? (stocks.reduce((a, s) => a + (parseFloat(s.pe_ratio) || 0), 0) / stocks.filter(s => s.pe_ratio).length).toFixed(1)
    : '—'
  const positiveCount = stocks.filter(s => parseFloat(s.return_1y) > 0).length

  return (
    <div className="page">
      <div className="page-title">📊 NSE 500 Dashboard</div>
      <div className="page-sub">Financial Monitor · Live fundamentals · AI-powered analysis</div>

      <ErrorBox msg={error} />

      {/* KPI strip */}
      <div className="grid-4">
        <KpiCard label="Total Stocks"    value={totalStocks}  sub="NSE 500 universe"        />
        <KpiCard label="Sectors"         value={sectorCount}  sub="Distinct industries"      />
        <KpiCard label="Avg P/E (top 20)" value={avgPE}       sub="Top 20 by rank"           />
        <KpiCard label="Positive 1Y"     value={`${positiveCount}/${stocks.length}`} sub="Of loaded stocks" tone="metric-pos" />
      </div>

      {/* Top 20 stocks table */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-label">Top 20 by NSE Rank</div>
            <div className="card-title">Large Cap Leaders</div>
          </div>
          <a href="/stocks" style={{ fontSize: 12, color: 'var(--primary)' }}>View all 1298 →</a>
        </div>
        {loading ? <Loading /> : <div style={{ overflowX: 'auto' }}><TopStocksTable stocks={stocks} /></div>}
      </div>

      {/* Sector pills */}
      {sectors.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div><div className="card-label">All Sectors</div><div className="card-title">{sectors.length} sectors in NSE 500</div></div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {sectors.map(s => <SectorBadge key={s} sector={s} />)}
          </div>
        </div>
      )}
    </div>
  )
}
