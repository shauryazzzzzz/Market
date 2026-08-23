import { useState, useEffect, useCallback, useRef } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import axios from 'axios'
import './index.css'
import DummyDataBanner from './components/DummyDataBanner'

// Pages
import Dashboard           from './pages/Dashboard'
import Markets             from './pages/Markets'
import Screener            from './pages/Screener'
import Fundamentals        from './pages/Fundamentals'
import TechnicalPage       from './pages/TechnicalPage'
import IPOCalendar         from './pages/IPOCalendar'
import Strategies          from './pages/Strategies'
import NewsPage            from './pages/NewsPage'
import FinancialMonitorPage from './pages/FinancialMonitorPage'
import NewsMapPage         from './pages/NewsMapPage'
import StockDeepDive       from './pages/StockDeepDive'
import PeerComparison      from './pages/PeerComparison'
import PortfolioPage       from './pages/PortfolioPage'
import DCFPage             from './pages/DCFPage'
import AdvancedScreener    from './pages/AdvancedScreener'
import SankeyPage          from './pages/SankeyPage'

// ── Live ticker hook — fetches real data from /api/quotes/ticker ──────────────
function useLiveTicker() {
  const [items, setItems]   = useState([])
  const [isLive, setIsLive] = useState(null) // null = loading, true = live, false = dummy

  const fetch = useCallback(async () => {
    try {
      const r = await axios.get('/api/quotes/ticker', { timeout: 10000 })
      const { tickers, isLive: live } = r.data
      if (live && tickers?.length > 0) {
        setItems(tickers)
        setIsLive(true)
        return
      }
    } catch { /* fall through */ }
    // All sources failed — show dummy with banner
    setItems([
      { name: 'NIFTY 50',   value: '—', change: '—', pos: true },
      { name: 'SENSEX',     value: '—', change: '—', pos: true },
      { name: 'BANK NIFTY', value: '—', change: '—', pos: true },
      { name: 'GOLD',       value: '—', change: '—', pos: true },
      { name: 'USD/INR',    value: '—', change: '—', pos: false },
      { name: 'CRUDE',      value: '—', change: '—', pos: true },
      { name: 'VIX',        value: '—', change: '—', pos: false },
    ])
    setIsLive(false)
  }, [])

  useEffect(() => {
    fetch()
    // Refresh every 60 seconds
    const id = setInterval(fetch, 60_000)
    return () => clearInterval(id)
  }, [fetch])

  return { items, isLive }
}

function TickerStrip() {
  const { items, isLive } = useLiveTicker()
  const doubled = [...items, ...items]
  return (
    <>
      <DummyDataBanner show={isLive === false} />
      <div className="ticker-strip">
        {isLive === true && (
          <span style={{ fontSize: 10, color: 'var(--positive)', padding: '0 8px', flexShrink: 0, alignSelf: 'center', letterSpacing: '.4px', fontWeight: 700 }}>● LIVE</span>
        )}
        <div className="ticker-inner">
          {doubled.map((t, i) => (
            <div className="ticker-item" key={i}>
              <span className="ticker-name">{t.name}</span>
              <span className="ticker-val">{t.value}</span>
              <span className={t.pos ? 'metric-pos' : 'metric-neg'}>{t.change}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ── Market status (IST) ───────────────────────────────────────────────────────
function marketStatus() {
  const now = new Date()
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const h = ist.getHours(), m = ist.getMinutes(), day = ist.getDay()
  const minsSinceMidnight = h * 60 + m
  const isWeekday = day >= 1 && day <= 5
  if (isWeekday && minsSinceMidnight >= 555 && minsSinceMidnight <= 930) return 'open'
  if (isWeekday && minsSinceMidnight >= 540 && minsSinceMidnight < 555) return 'pre'
  return 'closed'
}

// ── Global stock search bar ───────────────────────────────────────────────────
function StockSearchBar() {
  const navigate   = useNavigate()
  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState([])
  const [open,     setOpen]     = useState(false)
  const [loading,  setLoading]  = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const search = useCallback(async (q) => {
    if (q.length < 1) { setResults([]); setOpen(false); return }
    setLoading(true)
    try {
      const r = await axios.get(`/api/stock/search-suggest?q=${encodeURIComponent(q)}`)
      setResults(r.data?.data || [])
      setOpen(true)
    } catch { setResults([]) }
    setLoading(false)
  }, [])

  const go = (nseCode) => {
    navigate(`/stock/${nseCode}`)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && query.trim()) {
      // Navigate to the top suggestion or the raw query
      const top = results[0]
      if (top?.nseCode) go(top.nseCode)
      else navigate(`/stock/${query.trim().toUpperCase()}`)
      setQuery('')
      setOpen(false)
    }
    if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        className="input"
        style={{ width: 220, fontSize: 12, padding: '5px 10px' }}
        placeholder="🔍 Search stock…"
        value={query}
        onChange={e => { setQuery(e.target.value); search(e.target.value) }}
        onKeyDown={handleKey}
        onFocus={() => results.length > 0 && setOpen(true)}
      />
      {loading && (
        <div style={{ position: 'absolute', right: 8, top: 7, fontSize: 10, color: 'var(--muted)' }}>…</div>
      )}
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, width: 300, zIndex: 300, marginTop: 4,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 8, boxShadow: 'var(--shadow)', maxHeight: 280, overflowY: 'auto',
        }}>
          {results.map((r, i) => (
            <div key={i}
              style={{ padding: '8px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: 12 }}
              onMouseDown={() => go(r.nseCode)}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ fontWeight: 600 }}>{r.name}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{r.nseCode} · {r.industry}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TopBar() {
  const status = marketStatus()
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-icon">🧞</span>
        <div>
          <div className="brand-name">Aladdin Investing</div>
          <div className="brand-sub">AI-Powered Investor Platform</div>
        </div>
      </div>

      <nav className="topnav">
        <NavLink to="/">Dashboard</NavLink>
        <NavLink to="/markets">Markets</NavLink>
        <NavLink to="/news">News</NavLink>
        <NavLink to="/newsmap">📡 NewsMap</NavLink>
        <NavLink to="/fundamentals">Fundamentals</NavLink>
        <NavLink to="/technical">Technical</NavLink>
        <NavLink to="/screener">Screener</NavLink>
        <NavLink to="/advanced-screener">🏆 GS Screener</NavLink>
        <NavLink to="/sankey">📊 Sankey</NavLink>
        <NavLink to="/compare">Compare</NavLink>
        <NavLink to="/portfolio">💼 Portfolio</NavLink>
        <NavLink to="/dcf">🧮 DCF</NavLink>
        <NavLink to="/monitor">📊 Monitor</NavLink>
        <NavLink to="/ipo">IPO</NavLink>
        <NavLink to="/strategies">Strategies</NavLink>
      </nav>

      <div className="topbar-right">
        <StockSearchBar />
        <span className={`pill ${status === 'open' ? 'positive' : status === 'pre' ? 'warning' : 'negative'}`}>
          {status === 'open' ? '● Market Open' : status === 'pre' ? '◐ Pre-Market' : '○ Market Closed'}
        </span>
      </div>
    </header>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <TopBar />
        <TickerStrip />
        <Routes>
          <Route path="/"              element={<Dashboard />} />
          <Route path="/markets"       element={<Markets />} />
          <Route path="/news"          element={<NewsPage />} />
          <Route path="/newsmap"       element={<NewsMapPage />} />
          <Route path="/fundamentals"  element={<Fundamentals />} />
          <Route path="/technical"     element={<TechnicalPage />} />
          <Route path="/screener"      element={<Screener />} />
          <Route path="/compare"       element={<PeerComparison />} />
          <Route path="/stock/:symbol" element={<StockDeepDive />} />
          <Route path="/portfolio"         element={<PortfolioPage />} />
          <Route path="/dcf"               element={<DCFPage />} />
          <Route path="/monitor"           element={<FinancialMonitorPage />} />
          <Route path="/ipo"               element={<IPOCalendar />} />
          <Route path="/strategies"        element={<Strategies />} />
          <Route path="/advanced-screener" element={<AdvancedScreener />} />
          <Route path="/sankey"            element={<SankeyPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
