/**
 * Markets.jsx — real-time stock + commodity data
 * Equities: Yahoo Finance via /api/quotes/india and /api/quotes/us
 * Commodities: Yahoo Finance via /api/quotes/commodities
 * Shows DummyDataBanner if all live sources fail.
 */
import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { Loading } from '../components/shared'
import DummyDataBanner from '../components/DummyDataBanner'
import { fmtPct, fmtCr } from '../components/shared'

const COUNTRIES = [
  { code: 'IN',   name: 'India',      flag: '🇮🇳', currency: '₹', endpoint: '/api/quotes/india' },
  { code: 'US',   name: 'USA',        flag: '🇺🇸', currency: '$', endpoint: '/api/quotes/us'    },
  { code: 'COMM', name: 'Commodities',flag: '🏗',  currency: '',  endpoint: '/api/quotes/commodities' },
  { code: 'CN', name: 'China',   flag: '🇨🇳', currency: '¥', endpoint: null },
  { code: 'JP', name: 'Japan',   flag: '🇯🇵', currency: '¥', endpoint: null },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', currency: '€', endpoint: null },
  { code: 'BR', name: 'Brazil',  flag: '🇧🇷', currency: 'R$',endpoint: null },
  { code: 'KR', name: 'Korea',   flag: '🇰🇷', currency: '₩', endpoint: null },
]

const ASSETS   = ['Equity', 'Bonds', 'Gold', 'Govt Bonds', 'Real Estate', 'ETF', 'MF']
const SECTORS  = ['All', 'Financial', 'Technology', 'Healthcare', 'Consumer', 'Energy', 'Industrials', 'Telecom', 'Auto', 'Metals', 'Unknown']
const CAPS     = ['All Caps', 'Large Cap', 'Mid Cap', 'Small Cap']

// ── Commodity table (separate from stock table) ───────────────────────────────
function CommodityTable({ items, loading }) {
  if (loading) return <Loading />
  if (!items?.length) return (
    <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
      Live commodity prices unavailable — Yahoo Finance connection required.
    </div>
  )
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Commodity</th>
            <th style={{ textAlign: 'right' }}>Price</th>
            <th style={{ textAlign: 'right' }}>Change %</th>
            <th style={{ textAlign: 'right' }}>Day High</th>
            <th style={{ textAlign: 'right' }}>Day Low</th>
            <th style={{ textAlign: 'right' }}>52W High</th>
            <th style={{ textAlign: 'right' }}>52W Low</th>
          </tr>
        </thead>
        <tbody>
          {items.map(c => (
            <tr key={c.symbol}>
              <td>
                <div style={{ fontWeight: 600 }}>{c.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.symbol} · {c.currency}</div>
              </td>
              <td style={{ textAlign: 'right', fontWeight: 700 }}>{c.price != null ? `${c.currencySymbol}${Number(c.price).toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '—'}</td>
              <td style={{ textAlign: 'right' }}>
                {c.changePct != null
                  ? <span className={c.changePct >= 0 ? 'metric-pos' : 'metric-neg'}>{c.changePct >= 0 ? '+' : ''}{c.changePct.toFixed(2)}%</span>
                  : '—'}
              </td>
              <td style={{ textAlign: 'right', fontSize: 12 }}>{c.dayHigh != null ? `${c.currencySymbol}${c.dayHigh.toFixed(2)}` : '—'}</td>
              <td style={{ textAlign: 'right', fontSize: 12 }}>{c.dayLow  != null ? `${c.currencySymbol}${c.dayLow.toFixed(2)}`  : '—'}</td>
              <td style={{ textAlign: 'right', fontSize: 12 }}>{c.week52High != null ? `${c.currencySymbol}${c.week52High.toFixed(2)}` : '—'}</td>
              <td style={{ textAlign: 'right', fontSize: 12 }}>{c.week52Low  != null ? `${c.currencySymbol}${c.week52Low.toFixed(2)}`  : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Markets() {
  const [country,     setCountry]     = useState('IN')
  const [asset,       setAsset]       = useState('Equity')
  const [sector,      setSector]      = useState('All')
  const [cap,         setCap]         = useState('All Caps')
  const [stocks,      setStocks]      = useState([])
  const [commodities, setCommodities] = useState([])
  const [loading,     setLoading]     = useState(false)
  const [isLive,      setIsLive]      = useState(null)
  const [lastFetch,   setLastFetch]   = useState(null)
  const cache = useRef({})

  const curr = COUNTRIES.find(c => c.code === country)

  useEffect(() => {
    if (!curr?.endpoint) {
      setStocks([]); setCommodities([])
      setIsLive(false); setLoading(false)
      return
    }

    if (cache.current[country]) {
      const cached = cache.current[country]
      if (country === 'COMM') { setCommodities(cached.commodities || []); setIsLive(cached.isLive) }
      else { setStocks(cached.stocks || []); setIsLive(cached.isLive) }
      setLoading(false)
      return
    }

    setLoading(true)
    axios.get(curr.endpoint, { timeout: 15000 })
      .then(r => {
        if (country === 'COMM') {
          const { commodities: c = [], isLive: l = false } = r.data
          cache.current[country] = { commodities: c, isLive: l }
          setCommodities(c)
          setIsLive(l)
        } else {
          const { stocks: s = [], isLive: l = false } = r.data
          cache.current[country] = { stocks: s, isLive: l }
          setStocks(s)
          setIsLive(l)
        }
        setLastFetch(new Date())
        setLoading(false)
      })
      .catch(() => {
        setStocks([]); setCommodities([])
        setIsLive(false); setLoading(false)
      })
  }, [country]) // eslint-disable-line

  const filtered = stocks.filter(s => {
    if (sector !== 'All' && s.sector !== sector) return false
    if (cap !== 'All Caps' && s.cap !== cap) return false
    return true
  })

  return (
    <div className="page">
      <DummyDataBanner show={isLive === false && curr?.endpoint != null} />

      <div style={{ marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div className="page-title">Global Markets</div>
          <div className="page-sub">Real-time quotes · Yahoo Finance · Geography → Asset Class → Sector → Cap</div>
        </div>
        <div style={{ fontSize: 11, color: isLive ? 'var(--positive)' : 'var(--muted)' }}>
          {isLive ? `● Live · ${lastFetch?.toLocaleTimeString()}` : curr?.endpoint ? '○ No live data' : '○ Not yet connected'}
        </div>
      </div>

      {/* Level 1: Country */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-label" style={{ marginBottom: 10 }}>Geography</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {COUNTRIES.map(c => (
            <button key={c.code}
              className={`btn btn-sm ${country === c.code ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setCountry(c.code)}
            >
              {c.flag} {c.name}{!c.endpoint ? ' (soon)' : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Level 2: Asset class */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-label" style={{ marginBottom: 10 }}>Asset Class</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {ASSETS.map(a => (
            <button key={a} className={`btn btn-sm ${asset === a ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setAsset(a)}>{a}</button>
          ))}
        </div>
      </div>

      {/* Level 3 + 4: Sector + Cap */}
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-label" style={{ marginBottom: 10 }}>Sector</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SECTORS.map(s => (
              <button key={s} className={`btn btn-sm ${sector === s ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSector(s)}>{s}</button>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-label" style={{ marginBottom: 10 }}>Market Cap</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {CAPS.map(c => (
              <button key={c} className={`btn btn-sm ${cap === c ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setCap(c)}>{c}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-label">
              {curr?.flag} {curr?.name}{country !== 'COMM' ? ` · ${asset} · ${sector} · ${cap}` : ' · Live Prices'}
            </div>
            <div className="card-title">
              {loading ? 'Loading…' : country === 'COMM' ? `${commodities.length} instruments` : `${filtered.length} stocks`}
            </div>
          </div>
          {curr?.endpoint && (
            <button className="btn btn-ghost btn-sm"
              onClick={() => { delete cache.current[country]; setCountry(c => c) }}>
              ↺ Refresh
            </button>
          )}
        </div>

        {/* Commodity view */}
        {country === 'COMM' && <CommodityTable items={commodities} loading={loading} />}

        {/* Equity view */}
        {country !== 'COMM' && (
          loading ? <Loading /> : (
            !curr?.endpoint ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                Live data for {curr?.name} coming soon. Select India, USA, or Commodities for real-time quotes.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Symbol</th><th>Company</th><th>Sector</th>
                      <th style={{ textAlign: 'right' }}>Price</th>
                      <th style={{ textAlign: 'right' }}>Change %</th>
                      <th style={{ textAlign: 'right' }}>Mkt Cap</th>
                      <th style={{ textAlign: 'right' }}>P/E</th>
                      <th style={{ textAlign: 'right' }}>P/B</th>
                      <th style={{ textAlign: 'right' }}>Div %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>
                        No stocks match. {isLive === false ? 'Live data unavailable.' : 'Try other filters.'}
                      </td></tr>
                    ) : filtered.map(s => (
                      <tr key={s.symbol}>
                        <td className="sym">{s.symbol}</td>
                        <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</td>
                        <td style={{ color: 'var(--muted)', fontSize: 12 }}>{s.sector}</td>
                        <td style={{ textAlign: 'right' }}>
                          {curr.currency}{s.price?.toLocaleString('en-IN', { maximumFractionDigits: 2 }) ?? '—'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {s.change != null
                            ? <span className={s.change >= 0 ? 'metric-pos' : 'metric-neg'}>{s.change >= 0 ? '+' : ''}{s.change.toFixed(2)}%</span>
                            : '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontSize: 12 }}>{s.mktcap ? fmtCr(s.mktcap) : '—'}</td>
                        <td style={{ textAlign: 'right' }}>{s.pe?.toFixed(1) ?? '—'}</td>
                        <td style={{ textAlign: 'right' }}>{s.pb?.toFixed(1) ?? '—'}</td>
                        <td style={{ textAlign: 'right' }}>{s.div?.toFixed(2) ?? '—'}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )
        )}
      </div>
    </div>
  )
}
