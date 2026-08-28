/**
 * Strategies.jsx — Investment strategy showcase
 * Route: /strategies
 * Fetches the FULL ticker universe from /api/gs/screener (1100+ companies),
 * applies per-strategy filters, and displays top N results.
 * No hardcoded 5-ticker limit — the complete database drives all strategies.
 */
import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import { Loading, ErrorBox, fmtCr, RangePicker, RangeChg, useHistoricalChanges } from '../components/shared'
import DummyDataBanner from '../components/DummyDataBanner'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts'

// ── Strategy definitions — filters applied against full GS universe ───────────
const STRATEGIES = {
  'blue-chip': {
    name:  'Blue Chip',
    icon:  '🏆',
    desc:  'Large, established companies with strong fundamentals and consistent dividends.',
    // Filter: high composite score, min market cap, decent ROE
    filter: { minComposite: 60, minROE: 12 },
    sort:   'compositeScore',
    n:      15,
  },
  'value': {
    name:  'Deep Value',
    icon:  '💎',
    desc:  'Undervalued stocks trading below intrinsic value — low P/E, low P/B, solid balance sheets.',
    filter: { maxPE: 15, minROE: 8, maxDE: 1.0 },
    sort:   'compositeScore',
    n:      15,
  },
  'momentum': {
    name:  'Momentum',
    icon:  '📈',
    desc:  'High-momentum stocks showing strong profit acceleration and positive QoQ/YoY signals.',
    filter: { minProfitGr: 15, minSalesGr: 10, allGreen: true },
    sort:   'compositeScore',
    n:      15,
  },
  'quant': {
    name:  'Quantitative',
    icon:  '🔢',
    desc:  'Multi-factor quant model: high ROE + high ROE score + low debt + pricing power.',
    filter: { minROE: 20, minRoeScore: 6, maxDE: 0.5, minOPM: 15 },
    sort:   'roeScore',
    n:      15,
  },
  'quality-growth': {
    name:  'Quality Growth',
    icon:  '🌱',
    desc:  'High-quality businesses with consistent long-term profit and sales growth.',
    filter: { minGrowthScore: 6, minROE: 15, minPiotroski: 5 },
    sort:   'growthScore',
    n:      15,
  },
  'dividend': {
    name:  'High Dividend',
    icon:  '💰',
    desc:  'Companies with high and sustainable dividend yields and strong cash flows.',
    filter: { minROE: 10 },
    sort:   'compositeScore',
    n:      15,
  },
}

const RADAR_AXES = ['Value', 'Growth', 'Quality', 'Momentum', 'Income']

// GS field names: pe, pb, grahamDiff, profitGr3, salesGr3, profitGr5, roe, opm,
//   piotroski, de, return1y, return3m, return6m, divYield, promoter, cashOps
function scoreAxes(c) {
  if (!c) return { Value: 5, Growth: 5, Quality: 5, Momentum: 5, Income: 5 }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
  const norm  = (v, lo, hi) => v != null ? clamp(((v - lo) / (hi - lo)) * 10, 0, 10) : 5

  const Value    = parseFloat(((
    norm(50 - (c.pe          ?? 25),   0, 50) +
    norm(10 - (c.pb          ?? 3),    0, 10) +
    norm(-(c.grahamDiff      ?? 0),  -100, 100)
  ) / 3).toFixed(1))

  const Growth   = parseFloat(((
    norm(c.profitGr3 ?? 10,  0, 40) +
    norm(c.salesGr3  ?? 8,   0, 30) +
    norm(c.profitGr5 ?? 10,  0, 40)
  ) / 3).toFixed(1))

  const Quality  = parseFloat(((
    norm(c.roe          ?? 12,  0, 40) +
    norm(c.opm          ?? 15,  0, 40) +
    norm(c.piotroski    ?? 5,   0, 9 ) +
    norm(3 - (c.de      ?? 0.5), 0, 3)
  ) / 4).toFixed(1))

  const Momentum = parseFloat(((
    norm(c.return1y ?? 10, -30, 80) +
    norm(c.return3m ?? 3,  -15, 30) +
    norm(c.return6m ?? 6,  -20, 50)
  ) / 3).toFixed(1))

  const Income   = parseFloat(((
    norm(c.divYield  ?? 1,  0, 8 ) +
    norm(c.promoter  ?? 50, 25, 75) +
    (parseFloat(c.cashOps) > 0 ? 7 : 3)
  ) / 3).toFixed(1))

  return { Value, Growth, Quality, Momentum, Income }
}

export default function Strategies() {
  const [active,      setActive]      = useState('blue-chip')
  const [universe,    setUniverse]    = useState([])  // full GS universe
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [liveQuotes,  setLiveQuotes]  = useState({})  // symbol → live price data
  const [quotesLive,  setQuotesLive]  = useState(false)
  const [lastFetch,   setLastFetch]   = useState(null)
  const [range,       setRange]       = useState('1D')

  const strat = STRATEGIES[active]

  // Load FULL universe once on mount
  useEffect(() => {
    setLoading(true)
    setError(null)
    axios.get('/api/gs/screener?n=500', { timeout: 20000 })
      .then(r => {
        if (r.data?.success) {
          setUniverse(r.data.data || [])
        } else {
          setError(r.data?.error || 'Failed to load universe')
        }
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  // Load live quotes (Yahoo) once
  useEffect(() => {
    axios.get('/api/quotes/india', { timeout: 20000 })
      .then(r => {
        if (r.data?.stocks?.length > 0) {
          const map = {}
          r.data.stocks.forEach(s => {
            map[s.symbol]        = s
            map[s.symbol + '.NS'] = s
          })
          setLiveQuotes(map)
          setQuotesLive(true)
          setLastFetch(new Date())
        }
      })
      .catch(() => {})
  }, [])

  // Apply strategy filters to full universe.
  // GS field names: roe, pe, de (debt/equity), profitGr1, salesGr1, opm, piotroski,
  //   roeScore, profitGrScore, compositeScore, qoqSalesEmoji, yoySalesEmoji, qoqPatEmoji, yoyPatEmoji
  const stratResults = useMemo(() => {
    if (!universe.length) return []
    const f = strat.filter
    let filtered = universe.filter(c => {
      if (f.minComposite   != null && (c.compositeScore ?? 0)  < f.minComposite)  return false
      if (f.minROE         != null && (c.roe            ?? 0)  < f.minROE)        return false
      if (f.maxPE          != null && c.pe  != null && c.pe    > f.maxPE)         return false
      if (f.maxDE          != null && c.de  != null && c.de    > f.maxDE)         return false
      if (f.minProfitGr    != null && (c.profitGr1      ?? -Infinity) < f.minProfitGr)  return false
      if (f.minSalesGr     != null && (c.salesGr1       ?? -Infinity) < f.minSalesGr)   return false
      if (f.minOPM         != null && (c.opm             ?? 0)  < f.minOPM)       return false
      if (f.minPiotroski   != null && (c.piotroski       ?? 0)  < f.minPiotroski) return false
      if (f.minRoeScore    != null && (c.roeScore        ?? 0)  < f.minRoeScore)  return false
      if (f.minGrowthScore != null && (c.profitGrScore   ?? 0)  < f.minGrowthScore) return false
      if (f.allGreen === true) {
        // gs-sheet stores parsed emoji signals as qoqSalesSignal, yoySalesSignal, etc. (value: 'up' | 'down' | null)
        const signals = [c.qoqSalesSignal, c.yoySalesSignal, c.yoyPatSignal, c.qoqPatSignal]
        const greenCount = signals.filter(s => s === 'up').length
        if (greenCount < 2) return false
      }
      return true
    })
    // Map sort field names to actual GS schema field names
    const sortField = strat.sort === 'growthScore' ? 'profitGrScore' : strat.sort
    filtered.sort((a, b) => (b[sortField] ?? 0) - (a[sortField] ?? 0))
    return filtered.slice(0, strat.n)
  }, [universe, active]) // eslint-disable-line

  // Range-change fetching for result symbols
  const resultSymbols = useMemo(() => stratResults.map(c => c.nseCode).filter(Boolean), [stratResults.map(c=>c.nseCode).join(',')]) // eslint-disable-line
  const { changes: rangeChg, loading: rangeL } = useHistoricalChanges(
    resultSymbols.map(s => s.includes('.NS') ? s : s + '.NS'),
    range
  )

  // Radar: average strategy axis scores
  const radarData = RADAR_AXES.map(axis => {
    if (!stratResults.length) return { subject: axis, value: 5 }
    const avg = stratResults.reduce((sum, c) => sum + (scoreAxes(c)[axis] ?? 5), 0) / stratResults.length
    return { subject: axis, value: parseFloat(avg.toFixed(1)) }
  })

  return (
    <div className="page">
      <DummyDataBanner show={!quotesLive && !loading} />

      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="page-title">Investment Strategies</div>
          <div className="page-sub">
            {universe.length > 0
              ? `Full universe: ${universe.length} companies · Filtered to top ${strat.n} · Not financial advice`
              : 'Loading ticker universe…'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <RangePicker selected={range} onChange={setRange} />
          <div style={{ fontSize: 11, color: quotesLive ? 'var(--positive)' : 'var(--muted)' }}>
            {quotesLive ? `● Live · ${lastFetch?.toLocaleTimeString()}` : '○ Prices unavailable'}
          </div>
        </div>
      </div>

      {/* Strategy selector */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 18 }}>
        {Object.entries(STRATEGIES).map(([id, s]) => (
          <div key={id} className="card"
            style={{ cursor: 'pointer', border: active === id ? '1px solid var(--primary)' : '1px solid var(--border)', padding: '12px 14px' }}
            onClick={() => setActive(id)}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{s.name}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{s.desc.slice(0, 55)}…</div>
          </div>
        ))}
      </div>

      {loading && <Loading />}
      {error && <ErrorBox msg={error} />}

      {!loading && !error && (
        <div className="layout-sidebar">
          {/* Main table */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-label">Strategy Results</div>
                <div className="card-title">{strat.icon} {strat.name} — {stratResults.length} stocks</div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', maxWidth: 260, textAlign: 'right' }}>{strat.desc}</div>
            </div>

            {stratResults.length === 0 ? (
              <div style={{ padding: '24px 0', color: 'var(--muted)', fontSize: 13, textAlign: 'center' }}>
                No companies match this strategy's filters in the current dataset.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>#</th>
                      <th style={{ textAlign: 'left' }}>Symbol</th>
                      <th style={{ textAlign: 'left' }}>Company</th>
                      <th style={{ textAlign: 'right' }}>Price ₹</th>
                      <th style={{ textAlign: 'right' }}>Chg {range !== '1D' ? `(${range})` : '(1D)'}</th>
                      <th style={{ textAlign: 'right' }}>Mkt Cap</th>
                      <th style={{ textAlign: 'right' }}>P/E</th>
                      <th style={{ textAlign: 'right' }}>ROE %</th>
                      <th style={{ textAlign: 'right' }}>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stratResults.map((c, i) => {
                      const sym   = c.nseCode
                      const live  = liveQuotes[sym] || liveQuotes[sym + '.NS']
                      const price = live?.price ?? c.currentPrice
                      const chg   = live?.change

                      return (
                        <tr key={sym || i}>
                          <td style={{ color: 'var(--muted)', fontSize: 11 }}>{i + 1}</td>
                          <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{sym || '—'}</td>
                          <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.name || '—'}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {price != null
                              ? `₹${Number(price).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
                              : <span style={{ color: 'var(--muted)' }}>—</span>}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <RangeChg
                              dailyPct={chg}
                              rangePct={rangeChg[(sym?.includes('.NS') ? sym : sym + '.NS') || '']}
                              range={range}
                              loading={rangeL}
                            />
                          </td>
                          <td style={{ textAlign: 'right', fontSize: 12 }}>
                            {live?.mktcap ? fmtCr(live.mktcap) : c.marCap ? c.marCap : '—'}
                          </td>
                          <td style={{ textAlign: 'right' }}>{c.pe?.toFixed(1) ?? '—'}</td>
                          <td style={{ textAlign: 'right' }}>
                            {c.roe != null
                              ? <span className={c.roe >= 15 ? 'metric-pos' : 'metric-neu'}>{c.roe.toFixed(1)}%</span>
                              : '—'}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>
                            {c.compositeScore?.toFixed(0) ?? '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(210,153,34,.1)', borderRadius: 6, fontSize: 11, color: 'var(--warning)' }}>
              ⚠ For educational purposes only. Not financial advice. Always do your own research.
            </div>
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

            {/* Filter summary */}
            <div style={{ marginTop: 16 }}>
              <div className="card-label" style={{ marginBottom: 8 }}>Active Filters</div>
              {Object.entries(strat.filter).map(([k, v]) => (
                <div key={k} className="stat-row" style={{ fontSize: 12 }}>
                  <span className="stat-label">{k}</span>
                  <span style={{ fontWeight: 600 }}>{String(v)}</span>
                </div>
              ))}
              <div className="stat-row" style={{ fontSize: 12 }}>
                <span className="stat-label">Universe</span>
                <span style={{ fontWeight: 600 }}>{universe.length} companies</span>
              </div>
              <div className="stat-row" style={{ fontSize: 12 }}>
                <span className="stat-label">After filters</span>
                <span style={{ fontWeight: 600, color: 'var(--positive)' }}>{stratResults.length} match</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
