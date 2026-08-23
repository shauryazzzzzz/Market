import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { Loading, ErrorBox, fmt, fmtPct, fmtCr, Signal, GradeBadge } from '../components/shared'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Cell } from 'recharts'

const METRICS = [
  { key: 'roe',           label: 'Return on Equity' },
  { key: 'profitGrowth',  label: 'Profit Growth %' },
  { key: 'salesGrowth',   label: 'Sales Growth %' },
  { key: 'piotroskiScore', label: 'Piotroski Score' },
  { key: 'opm',           label: 'Operating Margin %' },
]

const TT_STYLE = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }

function CompanyDetail({ data }) {
  if (!data) return null
  const { company: c, grade, revenueTrend, marginTrend, aiSummary } = data

  const revenueChart = revenueTrend?.map(p => ({ name: p.label, value: p.value })) || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <GradeBadge grade={grade.grade} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{c.name}</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>{c.nseCode} · {c.industry}</div>
            <div style={{ marginTop: 6, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Signal rating={grade.rating} />
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Score {grade.score}/21</span>
              {c.piotroskiScore != null && <span style={{ fontSize: 12, color: 'var(--muted)' }}>Piotroski {c.piotroskiScore}/9</span>}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 700, fontSize: 20 }}>₹{c.currentPrice?.toFixed(2)}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{fmtCr(c.marketCap)}</div>
          </div>
        </div>

        {/* AI Summary */}
        {aiSummary && (
          <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(47,129,247,.08)', borderRadius: 8, borderLeft: '3px solid var(--primary)', fontSize: 13, lineHeight: 1.6 }}>
            💡 {aiSummary}
          </div>
        )}

        {/* Reasons */}
        {grade.reasons?.length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {grade.reasons.map((r, i) => (
              <span key={i} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 4, background: 'rgba(63,185,80,.12)', color: 'var(--positive)' }}>✓ {r}</span>
            ))}
          </div>
        )}
      </div>

      {/* Key metrics grid */}
      <div className="grid-4">
        {[
          ['P/E', c.pe],
          ['P/B', c.pb],
          ['ROE', c.roe != null ? `${c.roe.toFixed(1)}%` : '—'],
          ['ROE 3yr', c.roe3yr != null ? `${c.roe3yr.toFixed(1)}%` : '—'],
          ['Debt/Eq', c.debtToEquity],
          ['OPM', c.opm != null ? `${c.opm.toFixed(1)}%` : '—'],
          ['Div Yield', c.dividendYield != null ? `${c.dividendYield.toFixed(1)}%` : '—'],
          ['Promoter', c.promoterHolding != null ? `${c.promoterHolding.toFixed(1)}%` : '—'],
          ['FII', c.fiiHolding != null ? `${c.fiiHolding.toFixed(1)}%` : '—'],
          ['DII', c.diiHolding != null ? `${c.diiHolding.toFixed(1)}%` : '—'],
          ['EV/EBITDA', c.evEbitda],
          ['PEG', c.pegRatio],
        ].map(([label, val]) => (
          <div className="card" key={label} style={{ padding: '12px 14px' }}>
            <div className="card-label">{label}</div>
            <div style={{ fontWeight: 700, fontSize: 17, marginTop: 4 }}>{typeof val === 'number' ? val.toFixed(2) : (val || '—')}</div>
          </div>
        ))}
      </div>

      {/* Revenue trend chart */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header"><div><div className="card-label">Revenue</div><div className="card-title">Sales Growth Trend</div></div></div>
          {revenueChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={revenueChart}>
                <XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} />
                <Tooltip contentStyle={TT_STYLE} formatter={v => [`${v?.toFixed(1)}%`, 'Growth']} />
                <Bar dataKey="value" radius={[3,3,0,0]}>
                  {revenueChart.map((e, i) => <Cell key={i} fill={e.value >= 0 ? 'var(--positive)' : 'var(--negative)'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="loading" style={{ height: 140 }}>No trend data</div>}
        </div>

        <div className="card">
          <div className="card-header"><div><div className="card-label">Margins</div><div className="card-title">Operating Margin</div></div></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8 }}>
            <div className="stat-row">
              <span className="stat-label">Annual OPM</span>
              <span className="stat-val">{marginTrend?.annualOPM != null ? `${marginTrend.annualOPM.toFixed(1)}%` : '—'}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Latest Q OPM</span>
              <span className="stat-val">{marginTrend?.latestQOPM != null ? `${marginTrend.latestQOPM.toFixed(1)}%` : '—'}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Direction</span>
              <span className={marginTrend?.direction === 'expanding' ? 'metric-pos' : marginTrend?.direction === 'compressing' ? 'metric-neg' : 'stat-val'}>
                {marginTrend?.direction || '—'}
              </span>
            </div>
            <div className="stat-row">
              <span className="stat-label">YoY Q Profit Growth</span>
              <span className={c.yoyQProfitGrowth >= 0 ? 'metric-pos stat-val' : 'metric-neg stat-val'}>
                {c.yoyQProfitGrowth != null ? `${c.yoyQProfitGrowth.toFixed(1)}%` : '—'}
              </span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Earnings Surprise</span>
              <span className={grade.earningsSurprise === 'beat' ? 'metric-pos stat-val' : grade.earningsSurprise === 'miss' ? 'metric-neg stat-val' : 'stat-val'}>
                {grade.earningsSurprise || '—'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Fundamentals() {
  const [query, setQuery]       = useState('')
  const [suggestions, setSug]   = useState([])
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [topMetric, setTopMetric] = useState('roe')
  const [topData, setTopData]   = useState([])
  const [topLoading, setTopLoading] = useState(true)
  const [surpData, setSurpData] = useState([])
  const [activeTab, setActiveTab] = useState('search') // search | top | surprise

  // Load top companies on mount and metric change
  useEffect(() => {
    setTopLoading(true)
    axios.get(`/api/fundamentals/top?metric=${topMetric}&n=20&minCap=500`)
      .then(r => { setTopData(r.data?.data || []); setTopLoading(false) })
      .catch(() => setTopLoading(false))
  }, [topMetric])

  // Load earnings surprise once
  useEffect(() => {
    axios.get('/api/fundamentals/earnings-surprise?type=all')
      .then(r => setSurpData(r.data?.data?.slice(0, 50) || []))
      .catch(() => {})
  }, [])

  // Autocomplete search
  useEffect(() => {
    if (query.length < 2) { setSug([]); return }
    const t = setTimeout(() => {
      axios.get(`/api/fundamentals/search?q=${encodeURIComponent(query)}`)
        .then(r => setSug(r.data?.data?.slice(0, 8) || []))
        .catch(() => setSug([]))
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  const analyse = useCallback(async (q) => {
    setLoading(true); setError(null); setSug([]); setAnalysis(null)
    try {
      const r = await axios.get(`/api/fundamentals/analyse?q=${encodeURIComponent(q)}`)
      if (r.data?.success) setAnalysis(r.data.data)
      else setError(r.data?.error || 'Not found')
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }, [])

  return (
    <div className="page">
      <div style={{ marginBottom: 20 }}>
        <div className="page-title">Fundamental Analysis</div>
        <div className="page-sub">Powered by Screener.in export · 60+ metrics · AI-generated summaries · Earnings surprise detection</div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {[['search','🔍 Company Search'],['top','🏆 Top Companies'],['surprise','⚡ Earnings Surprise']].map(([id,label]) => (
          <button key={id} className={`btn btn-sm ${activeTab===id?'btn-primary':'btn-ghost'}`} onClick={()=>setActiveTab(id)}>{label}</button>
        ))}
      </div>

      {/* Search tab */}
      {activeTab === 'search' && (
        <>
          <div style={{ position: 'relative', maxWidth: 520, marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <input className="input" style={{ flex: 1 }} placeholder="Search by NSE code or company name (e.g. TCS, Infosys)"
                value={query} onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && analyse(query)}
              />
              <button className="btn btn-primary" onClick={() => analyse(query)}>Analyse</button>
            </div>
            {suggestions.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 80, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, zIndex: 50, boxShadow: 'var(--shadow)' }}>
                {suggestions.map((s, i) => (
                  <div key={i} style={{ padding: '9px 14px', cursor: 'pointer', fontSize: 13, borderBottom: i < suggestions.length-1 ? '1px solid var(--border)' : 'none' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    onClick={() => { setQuery(s.nseCode || s.name); analyse(s.nseCode || s.name); }}>
                    <span style={{ fontWeight: 700 }}>{s.nseCode}</span>
                    <span style={{ color: 'var(--muted)', marginLeft: 10 }}>{s.name}</span>
                    <span style={{ float: 'right', fontSize: 11, color: 'var(--muted)' }}>{s.industry}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <ErrorBox msg={error} />}
          {loading ? <Loading /> : analysis && <CompanyDetail data={analysis} />}
          {!loading && !analysis && !error && (
            <div className="loading" style={{ flexDirection: 'column', gap: 8 }}>
              <div>🔍 Search for any NSE-listed company to see its full fundamental analysis</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Try: TCS, HDFCBANK, RELIANCE, INFY, NESTLEIND</div>
            </div>
          )}
        </>
      )}

      {/* Top companies tab */}
      {activeTab === 'top' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {METRICS.map(m => (
              <button key={m.key} className={`btn btn-sm ${topMetric===m.key?'btn-primary':'btn-ghost'}`}
                onClick={() => setTopMetric(m.key)}>{m.label}</button>
            ))}
          </div>
          {topLoading ? <Loading /> : (
            <div className="card">
              <div className="card-header"><div className="card-title">Top 20 by {METRICS.find(m=>m.key===topMetric)?.label}</div></div>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead><tr><th>#</th><th>Company</th><th>NSE</th><th>Industry</th><th>{METRICS.find(m=>m.key===topMetric)?.label}</th><th>P/E</th><th>ROE</th><th>Mkt Cap</th><th>Rating</th></tr></thead>
                  <tbody>
                    {topData.map((c, i) => {
                      const g = { rating: (c.roe||0)>15&&(c.pe||99)<25?'BUY':(c.roe||0)>10?'HOLD':'SELL' }
                      return (
                        <tr key={i} style={{ cursor: 'pointer' }} onClick={() => { setActiveTab('search'); setQuery(c.nseCode||c.name); analyse(c.nseCode||c.name); }}>
                          <td style={{ color: 'var(--muted)' }}>{i+1}</td>
                          <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</td>
                          <td className="sym">{c.nseCode}</td>
                          <td style={{ color: 'var(--muted)', fontSize: 12 }}>{c.industry?.slice(0,20)}</td>
                          <td style={{ fontWeight: 700 }}>{c[topMetric] != null ? c[topMetric].toFixed(1) : '—'}</td>
                          <td>{c.pe?.toFixed(1) || '—'}</td>
                          <td className={c.roe >= 15 ? 'metric-pos' : ''}>{c.roe?.toFixed(1) || '—'}%</td>
                          <td style={{ fontSize: 12 }}>{fmtCr(c.marketCap)}</td>
                          <td><Signal rating={g.rating} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Earnings surprise tab */}
      {activeTab === 'surprise' && (
        <div className="card">
          <div className="card-header"><div className="card-title">Earnings Surprise Report</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>YoY quarterly profit growth · {surpData.length} companies</div></div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Company</th><th>NSE</th><th>Industry</th><th>YoY Q Profit Δ</th><th>Verdict</th><th>Price</th><th>Mkt Cap</th></tr></thead>
              <tbody>
                {surpData.map((s, i) => (
                  <tr key={i} style={{ cursor: 'pointer' }} onClick={() => { setActiveTab('search'); setQuery(s.nseCode||s.name); analyse(s.nseCode||s.name); }}>
                    <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</td>
                    <td className="sym">{s.nseCode}</td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>{s.industry?.slice(0,20)}</td>
                    <td><span className={s.yoyQProfitGrowth >= 0 ? 'metric-pos' : 'metric-neg'}>{s.yoyQProfitGrowth >= 0 ? '+' : ''}{s.yoyQProfitGrowth?.toFixed(1)}%</span></td>
                    <td><span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                      background: s.surprise==='beat'?'rgba(63,185,80,.2)':s.surprise==='miss'?'rgba(248,81,73,.2)':'rgba(139,148,158,.15)',
                      color: s.surprise==='beat'?'var(--positive)':s.surprise==='miss'?'var(--negative)':'var(--muted)' }}>
                      {s.surprise}</span></td>
                    <td>₹{s.currentPrice?.toFixed(2) || '—'}</td>
                    <td style={{ fontSize: 12 }}>{fmtCr(s.marketCap)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
