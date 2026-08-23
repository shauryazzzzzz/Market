/**
 * FinancialMonitorPage.jsx
 * Embedded integration of the Financial Monitor (NSE 500 DB) into the Aladdin platform.
 * Calls the financial-monitor Express server on port 5000 via /fm-api proxy.
 */
import { useState, useEffect } from 'react'
import axios from 'axios'
import { Loading, ErrorBox, fmtPct, fmtCr } from '../components/shared'
import DummyDataBanner from '../components/DummyDataBanner'

// ── API helpers ───────────────────────────────────────────────────────────────
const fm = (path) => axios.get(`/fm-api${path}`).then(r => r.data)

// ── Sector pill ───────────────────────────────────────────────────────────────
function SectorBadge({ sector }) {
  return (
    <span style={{
      fontSize: 10, padding: '2px 7px', borderRadius: 3,
      background: 'rgba(47,129,247,.12)', color: 'var(--primary)',
      fontWeight: 600, letterSpacing: '.4px', textTransform: 'uppercase'
    }}>{sector || '—'}</span>
  )
}

// ── Stock row ─────────────────────────────────────────────────────────────────
function StockRow({ s }) {
  const chg = parseFloat(s.return_1y) || 0
  return (
    <tr style={{ borderBottom: '1px solid var(--border)', fontSize: 12 }}>
      <td style={{ padding: '8px 6px', fontWeight: 700 }}>{s.ticker}</td>
      <td style={{ padding: '8px 6px', color: 'var(--text)' }}>{s.company_name?.slice(0, 22)}</td>
      <td style={{ padding: '8px 6px' }}><SectorBadge sector={s.sector} /></td>
      <td style={{ padding: '8px 6px', textAlign: 'right' }}>
        {s.current_price ? `₹${parseFloat(s.current_price).toLocaleString()}` : '—'}
      </td>
      <td style={{ padding: '8px 6px', textAlign: 'right' }}>
        {s.pe_ratio ? parseFloat(s.pe_ratio).toFixed(1) : '—'}
      </td>
      <td style={{ padding: '8px 6px', textAlign: 'right' }}>
        {s.roe ? <span className={parseFloat(s.roe) > 15 ? 'metric-pos' : 'metric-neu'}>{parseFloat(s.roe).toFixed(1)}%</span> : '—'}
      </td>
      <td style={{ padding: '8px 6px', textAlign: 'right' }}>
        {s.return_1y != null ? <span className={chg >= 0 ? 'metric-pos' : 'metric-neg'}>{chg >= 0 ? '▲' : '▼'} {Math.abs(chg).toFixed(1)}%</span> : '—'}
      </td>
    </tr>
  )
}

// ── Global market card ────────────────────────────────────────────────────────
function GlobalCard({ item }) {
  const chg = parseFloat(item.change) || 0
  return (
    <div className="card" style={{ textAlign: 'center', padding: '14px 10px' }}>
      <div className="card-label" style={{ fontSize: 11 }}>{item.name}</div>
      <div style={{ fontSize: 20, fontWeight: 800, margin: '6px 0' }}>
        {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
      </div>
      <div className={chg >= 0 ? 'metric-pos' : 'metric-neg'} style={{ fontSize: 12, fontWeight: 600 }}>
        {chg >= 0 ? '▲' : '▼'} {Math.abs(chg).toFixed(2)}%
      </div>
    </div>
  )
}

// ── Shocker table ─────────────────────────────────────────────────────────────
function ShockerTable({ title, rows, valueKey, valueLabel, tone }) {
  if (!rows?.length) return <div className="loading" style={{ padding: 12 }}>No data</div>
  return (
    <div>
      <div style={{ fontSize: 11, color: tone === 'pos' ? 'var(--positive)' : 'var(--negative)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.5px' }}>{title}</div>
      {rows.map((r, i) => (
        <div className="stat-row" key={i}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 12 }}>{r.ticker}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{r.sector}</div>
          </div>
          <span className={tone === 'pos' ? 'metric-pos' : 'metric-neg'} style={{ fontSize: 12, fontWeight: 700 }}>
            {parseFloat(r[valueKey] || 0).toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  )
}

// ── AI Sentiment panel ────────────────────────────────────────────────────────
function AISentimentPanel() {
  const [headlines, setHeadlines] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const run = async () => {
    if (!headlines.trim()) return
    setLoading(true)
    try {
      const r = await axios.post('/fm-api/ai/market-sentiment', {
        headlines: headlines.split('\n').filter(Boolean)
      })
      setResult(r.data)
    } catch (e) {
      setResult({ success: false, error: e.message })
    }
    setLoading(false)
  }

  return (
    <div className="card">
      <div className="card-header">
        <div><div className="card-label">AI Analysis</div><div className="card-title">Market Sentiment (WatsonX)</div></div>
      </div>
      <textarea
        rows={4}
        style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', fontSize: 12, color: 'var(--text)', resize: 'vertical', marginBottom: 8, boxSizing: 'border-box' }}
        placeholder="Paste headlines (one per line)…"
        value={headlines}
        onChange={e => setHeadlines(e.target.value)}
      />
      <button className="btn btn-primary btn-sm" onClick={run} disabled={loading}>
        {loading ? 'Analysing…' : 'Run Sentiment AI'}
      </button>
      {result && (
        <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(47,129,247,.07)', borderRadius: 6, fontSize: 13 }}>
          <strong>Sentiment:</strong> {result.text || result.sentiment || '—'}<br />
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Provider: {result.provider || '—'}</span>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FinancialMonitorPage() {
  const [stocks, setStocks]       = useState([])
  const [globalMkts, setGlobal]   = useState(null)
  const [sectoral, setSectoral]   = useState([])
  const [shockers, setShockers]   = useState({ near52High: [], momentum: [], volume: [] })
  const [sectors, setSectors]     = useState([])
  const [search, setSearch]       = useState('')
  const [sectorFilter, setSectorFilter] = useState('')
  const [sortBy, setSortBy]       = useState('nse_rank')
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [tab, setTab]             = useState('stocks') // stocks | markets | shockers | ai

  useEffect(() => {
    Promise.allSettled([
      fm('/stocks?limit=50&sortBy=nse_rank'),
      fm('/markets/global'),
      fm('/markets/sectoral-indices'),
      fm('/stocks/sectors/list'),
      fm('/markets/shockers/near-52w-high?limit=8'),
      fm('/markets/shockers/momentum?limit=8'),
      fm('/markets/shockers/volume?limit=8'),
    ]).then(([s, g, sec, slist, h, m, v]) => {
      if (s.status === 'fulfilled')   setStocks(s.value.data || [])
      else setError('Financial Monitor server not running on :5000')
      if (g.status === 'fulfilled')   setGlobal(g.value.data)
      if (sec.status === 'fulfilled') setSectoral(sec.value.data || [])
      if (slist.status === 'fulfilled') setSectors(slist.value.data || [])
      if (h.status === 'fulfilled')   setShockers(p => ({ ...p, near52High: h.value.data || [] }))
      if (m.status === 'fulfilled')   setShockers(p => ({ ...p, momentum: m.value.data || [] }))
      if (v.status === 'fulfilled')   setShockers(p => ({ ...p, volume: v.value.data || [] }))
      setLoading(false)
    })
  }, [])

  // Live search
  useEffect(() => {
    if (search.length < 2) return
    const t = setTimeout(() => {
      fm(`/stocks/search?q=${encodeURIComponent(search)}&limit=30`)
        .then(r => setStocks(r.data || []))
        .catch(() => {})
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  // Sector filter
  useEffect(() => {
    if (!sectorFilter) return
    fm(`/stocks/sector/${encodeURIComponent(sectorFilter)}`)
      .then(r => setStocks(r.data || []))
      .catch(() => {})
  }, [sectorFilter])

  const TABS = [
    { id: 'stocks',   label: '📋 NSE 500 Stocks' },
    { id: 'markets',  label: '🌍 Global Markets' },
    { id: 'shockers', label: '⚡ Stock Shockers' },
    { id: 'ai',       label: '🤖 AI Sentiment' },
  ]

  return (
    <div className="page">
      <DummyDataBanner show={!!error && stocks.length === 0} />
      <div style={{ marginBottom: 20 }}>
        <div className="page-title">Financial Monitor</div>
        <div className="page-sub">NSE 500 stock database · Global markets · AI-powered stock analysis · WatsonX sentiment</div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(248,81,73,.1)', border: '1px solid rgba(248,81,73,.3)', borderRadius: 6, color: '#f85149', fontSize: 13, marginBottom: 16 }}>
          ⚠️ {error} — Start it with: <code style={{ fontSize: 11 }}>cd financial-monitor && npm start</code>
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} className={`btn btn-sm ${tab === t.id ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab(t.id)}>{t.label}
          </button>
        ))}
      </div>

      {loading && <Loading />}

      {/* ── Stocks tab ── */}
      {!loading && tab === 'stocks' && (
        <div className="card">
          <div className="card-header">
            <div><div className="card-label">NSE 500 Database</div><div className="card-title">Stock Screener</div></div>
          </div>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <input
              style={{ flex: 1, minWidth: 180, padding: '7px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, color: 'var(--text)' }}
              placeholder="Search by ticker or name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select
              style={{ padding: '7px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, color: 'var(--text)' }}
              value={sectorFilter}
              onChange={e => { setSectorFilter(e.target.value); setSearch('') }}
            >
              <option value="">All Sectors</option>
              {sectors.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  {['Ticker', 'Company', 'Sector', 'Price', 'PE', 'ROE', '1Y Rtn'].map(h => (
                    <th key={h} style={{ padding: '8px 6px', textAlign: h === 'Ticker' || h === 'Company' || h === 'Sector' ? 'left' : 'right', fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stocks.length === 0
                  ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>No stocks found — is the Financial Monitor server running on :5000?</td></tr>
                  : stocks.map((s, i) => <StockRow key={i} s={s} />)
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Global Markets tab ── */}
      {!loading && tab === 'markets' && globalMkts && (
        <>
          <div className="grid-4" style={{ marginBottom: 18 }}>
            {Object.values(globalMkts).map((item, i) => <GlobalCard key={i} item={item} />)}
          </div>
          {sectoral.length > 0 && (
            <div className="card">
              <div className="card-header">
                <div><div className="card-label">Sectoral Performance</div><div className="card-title">NSE Sector Returns</div></div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      {['Sector', 'Stocks', 'Avg Return', 'Avg PE', 'Avg ROE', 'Mkt Cap (Cr)'].map(h => (
                        <th key={h} style={{ padding: '8px 6px', textAlign: h === 'Sector' ? 'left' : 'right', fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sectoral.map((s, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 6px', fontWeight: 600 }}>{s.sector}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'right' }}>{s.stock_count}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                          <span className={parseFloat(s.avg_return) >= 0 ? 'metric-pos' : 'metric-neg'}>
                            {parseFloat(s.avg_return || 0).toFixed(1)}%
                          </span>
                        </td>
                        <td style={{ padding: '8px 6px', textAlign: 'right' }}>{parseFloat(s.avg_pe || 0).toFixed(1)}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'right' }}>{parseFloat(s.avg_roe || 0).toFixed(1)}%</td>
                        <td style={{ padding: '8px 6px', textAlign: 'right' }}>{fmtCr(s.total_market_cap)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Shockers tab ── */}
      {!loading && tab === 'shockers' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          <div className="card">
            <div className="card-header"><div><div className="card-label">Near 52W High</div><div className="card-title">Breakout Watch</div></div></div>
            <ShockerTable title="Near 52-Week High" rows={shockers.near52High} valueKey="high_52w_potential" valueLabel="Upside %" tone="pos" />
          </div>
          <div className="card">
            <div className="card-header"><div><div className="card-label">Momentum</div><div className="card-title">Strong Movers</div></div></div>
            <ShockerTable title="Momentum Stocks" rows={shockers.momentum} valueKey="momentum_return" valueLabel="Return %" tone="pos" />
          </div>
          <div className="card">
            <div className="card-header"><div><div className="card-label">Volume</div><div className="card-title">High Delivery</div></div></div>
            <ShockerTable title="Volume Shockers" rows={shockers.volume} valueKey="delivery_percentage" valueLabel="Delivery %" tone="pos" />
          </div>
        </div>
      )}

      {/* ── AI tab ── */}
      {!loading && tab === 'ai' && <AISentimentPanel />}
    </div>
  )
}
