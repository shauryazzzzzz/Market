/**
 * Strategies.jsx — strategy showcase with live prices fetched from Yahoo Finance.
 * Strategy composition (sector, P/E targets) is editorial (not financial advice).
 * Live prices replace hardcoded values; DummyDataBanner shown if unavailable.
 */
import { useState, useEffect } from 'react'
import axios from 'axios'
import { Signal, fmtCr, Loading } from '../components/shared'
import DummyDataBanner from '../components/DummyDataBanner'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts'

// Strategy definitions — only symbol + qualitative data; prices fetched live
const STRATEGIES = {
  'blue-chip': {
    name: 'Blue Chip',
    icon: '🏆',
    desc: 'Large, established companies with strong fundamentals and consistent dividends.',
    symbols: ['RELIANCE.NS','TCS.NS','HDFCBANK.NS','INFY.NS','ICICIBANK.NS'],
  },
  'value': {
    name: 'Deep Value',
    icon: '💎',
    desc: 'Undervalued stocks trading below intrinsic value — low P/B and solid balance sheets.',
    symbols: ['VEDL.NS','TATASTEEL.NS','COALINDIA.NS','ONGC.NS','NTPC.NS'],
  },
  'momentum': {
    name: 'Momentum',
    icon: '📈',
    desc: 'High-momentum stocks showing strong price action and above-average volume.',
    symbols: ['TATAMOTORS.NS','TITAN.NS','BAJFINANCE.NS','DIXON.NS','ADANIPORTS.NS'],
  },
  'quant': {
    name: 'Quantitative',
    icon: '🔢',
    desc: 'Multi-factor quant model: high ROE + high ROCE + low debt + pricing power.',
    symbols: ['NESTLEIND.NS','ASIANPAINT.NS','COLPAL.NS','PIDILITIND.NS','TRENT.NS'],
  },
}

const RADAR_AXES = ['Value', 'Growth', 'Quality', 'Momentum', 'Income']

// scoreAxes mirrors StockDeepDive logic — computes 0–10 per axis from CSV fundamentals
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

function StarRating({ rating }) {
  const full  = Math.floor(rating)
  const half  = rating % 1 >= 0.5 ? 1 : 0
  const empty = 5 - full - half
  return <span style={{ fontSize: 12 }}>{'⭐'.repeat(full)}{'½'.repeat(half)}{'☆'.repeat(empty)}</span>
}

export default function Strategies() {
  const [active,      setActive]      = useState('blue-chip')
  const [quotes,      setQuotes]      = useState({})   // symbol → live quote
  const [fundamentals,setFundamentals]= useState({})   // nseCode → CSV data
  const [loading,     setLoading]     = useState(false)
  const [isLive,      setIsLive]      = useState(null)
  const [lastFetch,   setLastFetch]   = useState(null)

  const strat = STRATEGIES[active]

  const loadQuotes = async (syms) => {
    setLoading(true)
    try {
      const r = await axios.get(`/api/quotes/india`, { timeout: 15000 })
      const { stocks = [], isLive: live = false } = r.data
      if (live && stocks.length > 0) {
        const map = {}
        stocks.forEach(s => { map[s.symbol + '.NS'] = s; map[s.symbol] = s })
        setQuotes(map)
        setIsLive(true)
        setLastFetch(new Date())
      } else {
        setIsLive(false)
      }
    } catch {
      setIsLive(false)
    }

    // Load CSV fundamentals for radar (all 5 symbols in parallel)
    const nseCodes = syms.map(s => s.replace('.NS', ''))
    const fundResults = await Promise.allSettled(
      nseCodes.map(code =>
        axios.get(`/api/stock/deep-dive?q=${encodeURIComponent(code)}`, { timeout: 8000 })
          .then(r => ({ code, company: r.data?.data?.company }))
          .catch(() => ({ code, company: null }))
      )
    )
    const fundMap = {}
    fundResults.forEach(r => {
      if (r.status === 'fulfilled' && r.value.company) {
        fundMap[r.value.code] = r.value.company
      }
    })
    setFundamentals(fundMap)
    setLoading(false)
  }

  useEffect(() => { loadQuotes(strat.symbols) }, [active]) // eslint-disable-line

  // Compute radar from real CSV fundamentals (average across all strategy stocks)
  const radarData = RADAR_AXES.map(axis => {
    const scores = strat.symbols.map(sym => {
      const nse = sym.replace('.NS', '')
      return scoreAxes(fundamentals[nse] || null)[axis] ?? 5
    })
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length
    return { subject: axis, value: parseFloat(avg.toFixed(1)) }
  })

  // Enrich strategy stocks with live quotes
  const enriched = strat.symbols.map(sym => {
    const nse = sym.replace('.NS', '')
    const q   = quotes[sym] || quotes[nse]
    return {
      symbol: nse,
      name:   q?.name || nse,
      price:  q?.price,
      change: q?.change,
      mktcap: q?.mktcap,
      pe:     q?.pe,
      pb:     q?.pb,
      div:    q?.div,
      isLive: !!q?.isLive,
    }
  })

  const hasAnyLive = enriched.some(s => s.isLive)

  return (
    <div className="page">
      <DummyDataBanner show={isLive === false} />

      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div className="page-title">Investment Strategies</div>
          <div className="page-sub">Curated systematic strategies · Live prices · Not financial advice</div>
        </div>
        <div style={{ fontSize: 11, color: isLive ? 'var(--positive)' : 'var(--muted)' }}>
          {isLive ? `● Live · ${lastFetch?.toLocaleTimeString()}` : '○ No live data'}
        </div>
      </div>

      {/* Strategy selector */}
      <div className="grid-4" style={{ marginBottom: 18 }}>
        {Object.entries(STRATEGIES).map(([id, s]) => (
          <div key={id} className="card"
            style={{ cursor: 'pointer', border: active === id ? '1px solid var(--primary)' : '1px solid var(--border)' }}
            onClick={() => setActive(id)}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{s.name}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{s.desc.slice(0, 60)}…</div>
          </div>
        ))}
      </div>

      <div className="layout-sidebar">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-label">Strategy</div>
              <div className="card-title">{strat.icon} {strat.name}</div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', maxWidth: 300 }}>{strat.desc}</div>
          </div>

          {loading ? <Loading /> : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th><th>Symbol</th><th>Company</th>
                    <th style={{ textAlign: 'right' }}>Price ₹</th>
                    <th style={{ textAlign: 'right' }}>Chg %</th>
                    <th style={{ textAlign: 'right' }}>Mkt Cap</th>
                    <th style={{ textAlign: 'right' }}>P/E</th>
                    <th style={{ textAlign: 'right' }}>Div %</th>
                  </tr>
                </thead>
                <tbody>
                  {enriched.map((s, i) => (
                    <tr key={s.symbol}>
                      <td style={{ color: 'var(--muted)' }}>{i + 1}</td>
                      <td className="sym">{s.symbol}</td>
                      <td>{s.name}</td>
                      <td style={{ textAlign: 'right' }}>
                        {s.price != null ? `₹${s.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : <span style={{ color: 'var(--muted)' }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {s.change != null
                          ? <span className={s.change >= 0 ? 'metric-pos' : 'metric-neg'}>{s.change >= 0 ? '+' : ''}{s.change.toFixed(2)}%</span>
                          : <span style={{ color: 'var(--muted)' }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'right', fontSize: 12 }}>{s.mktcap ? fmtCr(s.mktcap) : '—'}</td>
                      <td style={{ textAlign: 'right' }}>{s.pe?.toFixed(1) ?? '—'}</td>
                      <td style={{ textAlign: 'right' }}>{s.div?.toFixed(2) ?? '—'}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Radar chart */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 14 }}>Strategy Profile</div>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--muted)', fontSize: 11 }} />
              <Radar dataKey="value" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.2} />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }} />
            </RadarChart>
          </ResponsiveContainer>
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>{strat.desc}</div>
          <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(210,153,34,.1)', borderRadius: 6, fontSize: 11, color: 'var(--warning)', lineHeight: 1.5 }}>
            ⚠ For educational purposes only. Not financial advice. Always do your own research.
          </div>
        </div>
      </div>
    </div>
  )
}
