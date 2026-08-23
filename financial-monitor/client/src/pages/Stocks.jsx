import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { Loading, ErrorBox, SectorBadge, Change, fmtCr } from '../components/shared'

function StockRow({ s }) {
  return (
    <tr>
      <td style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 12 }}>{s.ticker}</td>
      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{s.company_name}</td>
      <td><SectorBadge sector={s.sector} /></td>
      <td className="right">{s.current_price ? `₹${parseFloat(s.current_price).toLocaleString('en-IN')}` : '—'}</td>
      <td className="right">{fmtCr(s.market_cap)}</td>
      <td className="right">{s.pe_ratio ? parseFloat(s.pe_ratio).toFixed(1) : '—'}</td>
      <td className="right">
        {s.roe
          ? <span className={parseFloat(s.roe) >= 15 ? 'metric-pos' : parseFloat(s.roe) >= 8 ? 'metric-warn' : 'metric-neg'}>
              {parseFloat(s.roe).toFixed(1)}%
            </span>
          : '—'}
      </td>
      <td className="right">
        {s.return_1y != null ? <Change v={s.return_1y} /> : '—'}
      </td>
      <td className="right">{s.nse_rank || '—'}</td>
    </tr>
  )
}

const SORT_OPTIONS = [
  { value: 'nse_rank',     label: 'NSE Rank' },
  { value: 'market_cap',   label: 'Market Cap' },
  { value: 'current_price',label: 'Price' },
]

export default function Stocks() {
  const [stocks, setStocks]       = useState([])
  const [sectors, setSectors]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [search, setSearch]       = useState('')
  const [sectorFilter, setSector] = useState('')
  const [sortBy, setSortBy]       = useState('nse_rank')
  const [page, setPage]           = useState(0)
  const [total, setTotal]         = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMsg, setRefreshMsg] = useState(null)
  const PAGE_SIZE = 50

  const load = useCallback((pg = 0, sec = sectorFilter, q = search, sort = sortBy) => {
    setLoading(true)
    const params = new URLSearchParams({
      limit: PAGE_SIZE, offset: pg * PAGE_SIZE, sortBy: sort, sortOrder: 'ASC'
    })
    if (sec)  params.set('sector', sec)
    if (q)    params.set('search', q)
    axios.get(`/api/stocks?${params}`)
      .then(r => {
        setStocks(r.data?.data || [])
        setTotal(r.data?.pagination?.total || 0)
        setError(null)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [sectorFilter, search, sortBy])

  useEffect(() => {
    axios.get('/api/stocks/sectors/list').then(r => setSectors(r.data?.data || [])).catch(() => {})
  }, [])

  useEffect(() => {
    const t = setTimeout(() => { setPage(0); load(0, sectorFilter, search, sortBy) }, 350)
    return () => clearTimeout(t)
  }, [search, sectorFilter, sortBy])

  const refreshPrices = async () => {
    setRefreshing(true); setRefreshMsg(null)
    try {
      const r = await axios.get('/api/stocks/refresh-prices')
      setRefreshMsg(r.data.message || 'Done')
      load(page)
    } catch (e) {
      setRefreshMsg('Error: ' + e.message)
    }
    setRefreshing(false)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="page">
      <div className="page-title">NSE 500 Stocks</div>
      <div className="page-sub">Full database · {total} stocks · Screener with sector &amp; search filters</div>

      <ErrorBox msg={error} />

      {/* Controls */}
      <div className="search-row">
        <input className="input" style={{ maxWidth: 260 }}
          placeholder="Search by ticker or company…"
          value={search} onChange={e => setSearch(e.target.value)} />

        <select className="input" style={{ maxWidth: 200 }}
          value={sectorFilter} onChange={e => { setSector(e.target.value); setSearch('') }}>
          <option value="">All Sectors</option>
          {sectors.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select className="input" style={{ maxWidth: 160 }}
          value={sortBy} onChange={e => setSortBy(e.target.value)}>
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <button className="btn btn-ghost btn-sm" onClick={refreshPrices} disabled={refreshing}>
          {refreshing ? '⏳ Refreshing…' : '🔄 Refresh Prices'}
        </button>
        {refreshMsg && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{refreshMsg}</span>}
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        {loading ? <div style={{ padding: 32 }}><Loading /></div> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Company</th>
                  <th>Sector</th>
                  <th className="right">Price</th>
                  <th className="right">Mkt Cap</th>
                  <th className="right">P/E</th>
                  <th className="right">ROE</th>
                  <th className="right">1Y Return</th>
                  <th className="right">Rank</th>
                </tr>
              </thead>
              <tbody>
                {stocks.length === 0
                  ? <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>No stocks found</td></tr>
                  : stocks.map(s => <StockRow key={s.ticker} s={s} />)
                }
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => { setPage(0); load(0) }} disabled={page === 0}>«</button>
          <button className="btn btn-ghost btn-sm" onClick={() => { const p=page-1; setPage(p); load(p) }} disabled={page === 0}>‹ Prev</button>
          <span style={{ alignSelf: 'center', fontSize: 12, color: 'var(--muted)' }}>
            Page {page + 1} of {totalPages} · {total} stocks
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => { const p=page+1; setPage(p); load(p) }} disabled={page >= totalPages - 1}>Next ›</button>
          <button className="btn btn-ghost btn-sm" onClick={() => { const p=totalPages-1; setPage(p); load(p) }} disabled={page >= totalPages - 1}>»</button>
        </div>
      )}
    </div>
  )
}
