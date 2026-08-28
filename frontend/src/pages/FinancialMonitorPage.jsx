/**
 * FinancialMonitorPage.jsx — Financial Monitor
 * Route: /monitor
 * Uses the main tradingview-economy API (port 3001) for all data.
 * No dependency on the external Financial Monitor server (port 5000).
 * Tabs: NSE Stocks | Sectoral | Global Markets | Shockers | AI Sentiment
 */
import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import { Loading, ErrorBox, fmtCr, RangePicker, RangeChg, useHistoricalChanges } from '../components/shared'

// ── Helpers ───────────────────────────────────────────────────────────────────
function pct(v, digits = 1) {
  if (v == null) return '—'
  const n = parseFloat(v)
  if (isNaN(n)) return '—'
  return <span className={n >= 0 ? 'metric-pos' : 'metric-neg'}>{n >= 0 ? '▲' : '▼'} {Math.abs(n).toFixed(digits)}%</span>
}
function money(v, sym = '₹') {
  if (v == null) return '—'
  const n = parseFloat(v)
  return isNaN(n) ? '—' : `${sym}${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

// ── Sector pill ───────────────────────────────────────────────────────────────
function SectorBadge({ sector }) {
  return (
    <span style={{
      fontSize: 10, padding: '2px 7px', borderRadius: 3,
      background: 'rgba(47,129,247,.12)', color: 'var(--primary)',
      fontWeight: 600, letterSpacing: '.4px', textTransform: 'uppercase',
    }}>{sector || '—'}</span>
  )
}

// ── NSE stock table row ───────────────────────────────────────────────────────
function StockRow({ s, range, rangePct, rangeLoading }) {
  return (
    <tr style={{ borderBottom: '1px solid var(--border)', fontSize: 12 }}>
      <td style={{ padding: '7px 8px', fontWeight: 700, color: 'var(--primary)' }}>{s.symbol}</td>
      <td style={{ padding: '7px 8px' }}>{(s.name || '').slice(0, 24)}</td>
      <td style={{ padding: '7px 8px' }}><SectorBadge sector={s.sector} /></td>
      <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 600 }}>
        {s.price ? money(s.price) : '—'}
      </td>
      <td style={{ padding: '7px 8px', textAlign: 'right' }}>
        <RangeChg dailyPct={s.change} rangePct={rangePct} range={range || '1D'} loading={rangeLoading} />
      </td>
      <td style={{ padding: '7px 8px', textAlign: 'right' }}>
        {s.pe != null ? parseFloat(s.pe).toFixed(1) : '—'}
      </td>
      <td style={{ padding: '7px 8px', textAlign: 'right' }}>
        {s.mktcap ? fmtCr(s.mktcap) : '—'}
      </td>
    </tr>
  )
}

// ── Index card ────────────────────────────────────────────────────────────────
function IndexCard({ item, range, rangePct, rangeLoading }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '14px 10px' }}>
      <div className="card-label" style={{ fontSize: 11, marginBottom: 4 }}>{item.name}</div>
      <div style={{ fontSize: 20, fontWeight: 800, margin: '4px 0' }}>
        {item.price != null ? item.price.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—'}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600 }}>
        <RangeChg dailyPct={item.changePct} rangePct={rangePct} range={range || '1D'} loading={rangeLoading} />
      </div>
    </div>
  )
}

// ── Shocker row ───────────────────────────────────────────────────────────────
function ShockerRow({ stock, metric, label, tone }) {
  const val = parseFloat(stock[metric]) || 0
  return (
    <div className="stat-row">
      <div>
        <div style={{ fontWeight: 600, fontSize: 12 }}>{stock.symbol}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{(stock.name || '').slice(0, 20)}</div>
      </div>
      <span className={tone === 'pos' ? 'metric-pos' : 'metric-neg'} style={{ fontSize: 13, fontWeight: 700 }}>
        {val >= 0 ? '+' : ''}{val.toFixed(1)}%
      </span>
    </div>
  )
}

// ── AI Sentiment panel ────────────────────────────────────────────────────────
function AISentimentPanel() {
  const [headlines, setHeadlines] = useState('')
  const [result,    setResult]    = useState(null)
  const [loading,   setLoading]   = useState(false)

  const run = async () => {
    if (!headlines.trim()) return
    setLoading(true)
    try {
      const r = await axios.post('/api/ai/classify-news', { headline: headlines.split('\n')[0] || headlines })
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
        style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6,
          padding: '8px 10px', fontSize: 12, color: 'var(--text)', resize: 'vertical', marginBottom: 8, boxSizing: 'border-box' }}
        placeholder="Paste a market headline to classify…"
        value={headlines}
        onChange={e => setHeadlines(e.target.value)}
      />
      <button className="btn btn-primary btn-sm" onClick={run} disabled={loading}>
        {loading ? 'Analysing…' : 'Run Sentiment AI'}
      </button>
      {result && (
        <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(47,129,247,.07)', borderRadius: 6, fontSize: 13 }}>
          <strong>Category:</strong> {result.category || '—'}<br />
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Provider: {result.provider || '—'}</span>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FinancialMonitorPage() {
  const [stocks,    setStocks]    = useState([])
  const [indices,   setIndices]   = useState([])
  const [global,    setGlobal]    = useState([])
  const [commodities, setCommodities] = useState([])
  const [search,    setSearch]    = useState('')
  const [tab,       setTab]       = useState('stocks')
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [range,     setRange]     = useState('1D')

  useEffect(() => {
    Promise.allSettled([
      axios.get('/api/quotes/india',       { timeout: 20000 }),
      axios.get('/api/quotes/indices',     { timeout: 20000 }),
      axios.get('/api/quotes/global',      { timeout: 20000 }),
      axios.get('/api/quotes/commodities', { timeout: 20000 }),
    ]).then(([stocksRes, indRes, globalRes, commRes]) => {
      if (stocksRes.status === 'fulfilled') {
        setStocks(stocksRes.value.data?.stocks || [])
      } else {
        setError('Could not load stock data from Yahoo Finance')
      }
      if (indRes.status    === 'fulfilled') setIndices(indRes.value.data?.indices || [])
      if (globalRes.status === 'fulfilled') setGlobal(globalRes.value.data?.indices || [])
      if (commRes.status   === 'fulfilled') setCommodities(commRes.value.data?.commodities || [])
      setLoading(false)
    })
  }, [])

  // Search filter on NSE stocks
  const filteredStocks = search.trim().length < 2
    ? stocks
    : stocks.filter(s =>
        s.symbol?.toLowerCase().includes(search.toLowerCase()) ||
        s.name?.toLowerCase().includes(search.toLowerCase()) ||
        s.sector?.toLowerCase().includes(search.toLowerCase())
      )

  // Symbols for historical range fetches
  const stockSymbols = useMemo(() => filteredStocks.map(s => s.symbol), [filteredStocks.map(s=>s.symbol).join(',')]) // eslint-disable-line
  const idxSymbols   = useMemo(() => [...indices, ...global].map(i => i.symbol), [[...indices,...global].map(i=>i.symbol).join(',')]) // eslint-disable-line
  const commSymbols  = useMemo(() => commodities.map(c => c.symbol), [commodities.map(c=>c.symbol).join(',')]) // eslint-disable-line

  const activeStockSymbols = tab === 'stocks'      ? stockSymbols : []
  const activeIdxSymbols   = tab === 'markets'     ? idxSymbols   : []
  const activeCommSymbols  = tab === 'commodities' ? commSymbols  : []

  const { changes: stockChg, loading: stockL } = useHistoricalChanges(activeStockSymbols, range)
  const { changes: idxChg,   loading: idxL   } = useHistoricalChanges(activeIdxSymbols,   range)
  const { changes: commChg,  loading: commL  } = useHistoricalChanges(activeCommSymbols,  range)

  // Compute shockers from loaded stocks
  const topGainers  = [...stocks].filter(s => s.change != null).sort((a, b) => b.change - a.change).slice(0, 8)
  const topLosers   = [...stocks].filter(s => s.change != null).sort((a, b) => a.change - b.change).slice(0, 8)
  const topMktCap   = [...stocks].filter(s => s.mktcap  != null).sort((a, b) => b.mktcap - a.mktcap).slice(0, 8)

  const TABS = [
    { id: 'stocks',   label: '📋 NSE Stocks'      },
    { id: 'markets',  label: '🌍 Indices'          },
    { id: 'commodities', label: '🏗 Commodities'  },
    { id: 'shockers', label: '⚡ Shockers'         },
    { id: 'ai',       label: '🤖 AI Sentiment'     },
  ]

  return (
    <div className="page">
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="page-title">Financial Monitor</div>
          <div className="page-sub">
            NSE stocks · Sectoral indices · Global markets · Live from Yahoo Finance
          </div>
        </div>
        <RangePicker selected={range} onChange={setRange} />
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} className={`btn btn-sm ${tab === t.id ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab(t.id)}>{t.label}
          </button>
        ))}
      </div>

      {loading && <Loading />}
      {error && !loading && <ErrorBox msg={error} />}

      {/* ── Stocks tab ── */}
      {!loading && tab === 'stocks' && (
        <div className="card">
          <div className="card-header">
            <div><div className="card-label">India Equities</div><div className="card-title">NSE Stocks — Live Prices</div></div>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{filteredStocks.length} stocks</span>
          </div>
          <div style={{ marginBottom: 12 }}>
            <input
              className="input"
              style={{ width: 280, fontSize: 12 }}
              placeholder="🔍 Search symbol, name or sector…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  {['Symbol', 'Company', 'Sector', 'Price', `Chg (${range})`, 'P/E', 'Mkt Cap'].map(h => (
                    <th key={h} style={{
                      padding: '8px 8px', textAlign: ['Price', `Chg (${range})`, 'P/E', 'Mkt Cap'].includes(h) ? 'right' : 'left',
                      fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredStocks.length === 0
                  ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>No results</td></tr>
                  : filteredStocks.map((s, i) => <StockRow key={i} s={s} range={range} rangePct={stockChg[s.symbol]} rangeLoading={stockL} />)
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Indices tab ── */}
      {!loading && tab === 'markets' && (
        <>
          {indices.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div className="card-label" style={{ marginBottom: 10, fontSize: 12 }}>NSE/BSE INDICES</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                {indices.map(idx => <IndexCard key={idx.symbol} item={idx} range={range} rangePct={idxChg[idx.symbol]} rangeLoading={idxL} />)}
              </div>
            </div>
          )}
          {global.length > 0 && (
            <div>
              <div className="card-label" style={{ marginBottom: 10, fontSize: 12 }}>GLOBAL INDICES</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                {global.map(idx => <IndexCard key={idx.symbol} item={idx} range={range} rangePct={idxChg[idx.symbol]} rangeLoading={idxL} />)}
              </div>
            </div>
          )}
          {indices.length === 0 && global.length === 0 && (
            <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
              No index data available — server may need a restart to load new routes.
            </div>
          )}
        </>
      )}

      {/* ── Commodities tab ── */}
      {!loading && tab === 'commodities' && (
        <div className="card">
          <div className="card-header">
            <div><div className="card-label">Commodities</div><div className="card-title">Live Commodity Prices</div></div>
          </div>
          {commodities.length === 0
            ? <div style={{ padding: 24, color: 'var(--muted)', textAlign: 'center' }}>No commodity data</div>
            : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      {['Commodity', 'Price', `Chg (${range})`, 'Day High', 'Day Low', '52W High', '52W Low'].map(h => (
                          <th key={h} style={{
                            padding: '8px 8px', textAlign: h === 'Commodity' ? 'left' : 'right',
                            fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px',
                          }}>{h}</th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {commodities.map(c => (
                      <tr key={c.symbol} style={{ borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                        <td style={{ padding: '7px 8px' }}>
                          <div style={{ fontWeight: 600 }}>{c.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--muted)' }}>{c.symbol}</div>
                        </td>
                        <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 700 }}>
                          {c.price != null ? `${c.currencySymbol}${Number(c.price).toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td style={{ padding: '7px 8px', textAlign: 'right' }}>
                          <RangeChg dailyPct={c.changePct} rangePct={commChg[c.symbol]} range={range} loading={commL} />
                        </td>
                        <td style={{ padding: '7px 8px', textAlign: 'right' }}>{c.dayHigh != null ? `${c.currencySymbol}${Number(c.dayHigh).toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '—'}</td>
                        <td style={{ padding: '7px 8px', textAlign: 'right' }}>{c.dayLow  != null ? `${c.currencySymbol}${Number(c.dayLow).toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '—'}</td>
                        <td style={{ padding: '7px 8px', textAlign: 'right' }}>{c.week52High != null ? `${c.currencySymbol}${Number(c.week52High).toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '—'}</td>
                        <td style={{ padding: '7px 8px', textAlign: 'right' }}>{c.week52Low  != null ? `${c.currencySymbol}${Number(c.week52Low).toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </div>
      )}

      {/* ── Shockers tab ── */}
      {!loading && tab === 'shockers' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          <div className="card">
            <div className="card-header">
              <div><div className="card-label">Top Gainers</div><div className="card-title">Best Day Returns</div></div>
            </div>
            {topGainers.length === 0
              ? <div style={{ color: 'var(--muted)', fontSize: 12, padding: '10px 0' }}>No data</div>
              : topGainers.map((s, i) => <ShockerRow key={i} stock={s} metric="change" label="Chg %" tone="pos" />)}
          </div>
          <div className="card">
            <div className="card-header">
              <div><div className="card-label">Top Losers</div><div className="card-title">Worst Day Returns</div></div>
            </div>
            {topLosers.length === 0
              ? <div style={{ color: 'var(--muted)', fontSize: 12, padding: '10px 0' }}>No data</div>
              : topLosers.map((s, i) => <ShockerRow key={i} stock={s} metric="change" label="Chg %" tone="neg" />)}
          </div>
          <div className="card">
            <div className="card-header">
              <div><div className="card-label">Large Caps</div><div className="card-title">By Market Cap</div></div>
            </div>
            {topMktCap.length === 0
              ? <div style={{ color: 'var(--muted)', fontSize: 12, padding: '10px 0' }}>No data</div>
              : topMktCap.map((s, i) => (
                  <div key={i} className="stat-row">
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 12 }}>{s.symbol}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{(s.name || '').slice(0, 20)}</div>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 12 }}>{fmtCr(s.mktcap)}</span>
                  </div>
                ))}
          </div>
        </div>
      )}

      {/* ── AI tab ── */}
      {!loading && tab === 'ai' && <AISentimentPanel />}
    </div>
  )
}
