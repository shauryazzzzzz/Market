import { useState, useEffect } from 'react'
import axios from 'axios'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts'
import { Loading, ErrorBox, fmtPct, fmtCr, Signal } from '../components/shared'

// ── Macro stat card ──────────────────────────────────────────────────────────
function MacroCard({ label, value, change, detail, tone }) {
  return (
    <div className="card">
      <div className="card-label">{label}</div>
      <div className="big-value" style={{ fontSize: 22, marginTop: 6 }}>{value}</div>
      {change != null && <div className={change >= 0 ? 'metric-pos' : 'metric-neg'} style={{ fontSize: 13, marginTop: 2 }}>
        {change >= 0 ? '▲' : '▼'} {Math.abs(change)}%
      </div>}
      {detail && <div className="sub-value" style={{ marginTop: 6 }}>{detail}</div>}
    </div>
  )
}

// ── News feed mini ───────────────────────────────────────────────────────────
function NewsPreview({ items }) {
  if (!items?.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.slice(0, 5).map((n, i) => (
        <div className="news-card" key={i}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div>
              <div className="news-tag">{n.affected?.sectors?.[0] || n.source || 'Markets'}</div>
              <div className="news-title">{n.title}</div>
              <div className="news-meta">
                <span>{n.source}</span>
                <span className={n.sentiment === 'positive' ? 'metric-pos' : n.sentiment === 'negative' ? 'metric-neg' : 'metric-neu'}>
                  {n.sentiment}
                </span>
              </div>
            </div>
            <div style={{ minWidth: 36, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Impact</div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{(n.impactScore || 0).toFixed(1)}</div>
            </div>
          </div>
          <div className="impact-bar">
            <div className="impact-fill" style={{ width: `${Math.min((n.impactScore || 0) * 10, 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Earnings surprise widget ─────────────────────────────────────────────────
function EarningsSurprise({ items }) {
  if (!items?.length) return <div className="loading" style={{ padding: 16 }}>No data</div>
  const beats = items.filter(x => x.surprise === 'beat').slice(0, 5)
  const misses = items.filter(x => x.surprise === 'miss').slice(0, 5)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div>
        <div style={{ fontSize: 11, color: 'var(--positive)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.6px' }}>Earnings Beats</div>
        {beats.map((b, i) => (
          <div className="stat-row" key={i}>
            <span className="stat-label" style={{ fontSize: 12 }}>{b.nseCode || b.name?.slice(0,12)}</span>
            <span className="metric-pos" style={{ fontSize: 12, fontWeight: 600 }}>+{(b.yoyQProfitGrowth || 0).toFixed(1)}%</span>
          </div>
        ))}
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--negative)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.6px' }}>Earnings Misses</div>
        {misses.map((m, i) => (
          <div className="stat-row" key={i}>
            <span className="stat-label" style={{ fontSize: 12 }}>{m.nseCode || m.name?.slice(0,12)}</span>
            <span className="metric-neg" style={{ fontSize: 12, fontWeight: 600 }}>{(m.yoyQProfitGrowth || 0).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Top ROE companies ────────────────────────────────────────────────────────
function TopROE({ items }) {
  if (!items?.length) return null
  const chartData = items.slice(0, 10).map(c => ({ name: c.nseCode || c.name?.slice(0,8), roe: c.roe }))
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
        <XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 10 }} />
        <YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} />
        <Tooltip
          contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
          formatter={v => [`${v.toFixed(1)}%`, 'ROE']}
        />
        <Bar dataKey="roe" radius={[3,3,0,0]}>
          {chartData.map((_, i) => (
            <Cell key={i} fill={i < 3 ? 'var(--positive)' : 'var(--primary)'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [news, setNews]       = useState(null)
  const [earnings, setEarnings] = useState(null)
  const [topRoe, setTopRoe]   = useState(null)
  const [vix, setVix]         = useState(null)
  const [pcr, setPcr]         = useState(null)
  const [fiiDii, setFiiDii]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.allSettled([
      axios.get('/api/news/feed?max=10'),
      axios.get('/api/fundamentals/earnings-surprise?type=all'),
      axios.get('/api/fundamentals/top?metric=roe&n=10&minCap=500'),
      axios.get('/api/macro/india-vix'),
      axios.get('/api/macro/pcr'),
      axios.get('/api/macro/fii-dii'),
    ]).then(([n, e, r, v, p, f]) => {
      if (n.status === 'fulfilled') setNews(n.value.data?.data || [])
      if (e.status === 'fulfilled') setEarnings(e.value.data?.data || [])
      if (r.status === 'fulfilled') setTopRoe(r.value.data?.data || [])
      if (v.status === 'fulfilled') setVix(v.value.data?.data)
      if (p.status === 'fulfilled') setPcr(p.value.data?.data)
      if (f.status === 'fulfilled') setFiiDii(f.value.data?.data)
      setLoading(false)
    })
  }, [])

  const macroStats = [
    { label: 'India VIX', value: vix?.last?.toFixed(2) || '—', change: vix?.percentChange, detail: 'Volatility index — fear gauge' },
    { label: 'Nifty PCR', value: pcr?.pcr?.toFixed(3) || '—', detail: pcr ? `Signal: ${pcr.signal} (VIX-derived estimate)` : 'Options put-call ratio' },
    { label: 'FII Net ₹Cr', value: fiiDii ? (Array.isArray(fiiDii) ? fiiDii[0]?.netValue?.toFixed(0) : '—') : '—', detail: '⚠ Index-movement proxy — NSE FII API blocked server-side' },
    { label: 'Nifty Change', value: fiiDii ? (Array.isArray(fiiDii) ? `${fiiDii[0]?.niftyChg?.toFixed(2)}%` : '—') : '—', detail: fiiDii?.[0]?.nifty ? `Nifty 50: ${fiiDii[0].nifty?.toFixed(0)}` : 'Live from Yahoo' },
  ]

  return (
    <div className="page">
      <div style={{ marginBottom: 20 }}>
        <div className="page-title">Investor Dashboard</div>
        <div className="page-sub">Bloomberg-style overview · All data auto-refreshed · AI-scored</div>
      </div>

      {loading && <Loading />}

      {!loading && (
        <>
          {/* Macro row */}
          <div className="grid-4" style={{ marginBottom: 18 }}>
            {macroStats.map((s, i) => <MacroCard key={i} {...s} />)}
          </div>

          {/* Main content */}
          <div className="layout-sidebar" style={{ marginBottom: 18 }}>
            {/* Left: News + Earnings */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="card">
                <div className="card-header">
                  <div><div className="card-label">AI News Intelligence</div><div className="card-title">Top Impact News</div></div>
                  <a href="/news" className="btn btn-ghost btn-sm">View all →</a>
                </div>
                <NewsPreview items={news} />
              </div>

              <div className="card">
                <div className="card-header">
                  <div><div className="card-label">Quarterly Results</div><div className="card-title">Earnings Surprise Tracker</div></div>
                  <a href="/fundamentals" className="btn btn-ghost btn-sm">Full analysis →</a>
                </div>
                <EarningsSurprise items={earnings} />
              </div>
            </div>

            {/* Right sidebar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="card">
                <div className="card-header">
                  <div><div className="card-label">Fundamentals</div><div className="card-title">Top ROE Companies</div></div>
                </div>
                <TopROE items={topRoe} />
                {topRoe?.slice(0,5).map((c, i) => (
                  <div className="stat-row" key={i}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 12 }}>{c.nseCode || c.name?.slice(0,14)}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.industry?.slice(0,24)}</div>
                    </div>
                    <span className="metric-pos" style={{ fontWeight: 700 }}>{(c.roe || 0).toFixed(1)}%</span>
                  </div>
                ))}
              </div>

              <div className="card">
                <div className="card-header">
                  <div><div className="card-label">Quick Links</div><div className="card-title">Platform Features</div></div>
                </div>
                {[
                  ['📊 Markets', '/markets'],
                  ['🔍 Screener', '/screener'],
                  ['📈 Technical', '/technical'],
                  ['📋 Fundamentals', '/fundamentals'],
                  ['💼 Portfolio X-Ray', '/portfolio'],
                  ['🧮 DCF Calculator', '/dcf'],
                  ['🏦 Financial Monitor', '/monitor'],
                  ['📡 News MindMap', '/newsmap'],
                  ['🚀 IPO Calendar', '/ipo'],
                  ['🎯 Strategies', '/strategies'],
                ].map(([label, href]) => (
                  <a key={href} href={href} style={{ display: 'block', padding: '9px 0', borderBottom: '1px solid var(--border)', fontSize: 13, color: 'var(--text)', transition: 'color .15s' }}
                    onMouseEnter={e => e.target.style.color = 'var(--primary)'}
                    onMouseLeave={e => e.target.style.color = 'var(--text)'}
                  >{label}</a>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
