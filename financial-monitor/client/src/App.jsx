import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import './index.css'

import Dashboard  from './pages/Dashboard'
import Stocks     from './pages/Stocks'
import Markets    from './pages/Markets'
import Shockers   from './pages/Shockers'
import AISentiment from './pages/AISentiment'

function TopBar() {
  const [serverOk, setServerOk] = useState(null)

  useEffect(() => {
    fetch('/api/health').then(r => r.json()).then(d => setServerOk(d.success)).catch(() => setServerOk(false))
  }, [])

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-icon">📊</span>
        <div>
          <div className="brand-name">Financial Monitor</div>
          <div className="brand-sub">NSE 500 · Fundamentals · AI Analysis</div>
        </div>
      </div>

      <nav className="topnav">
        <NavLink to="/"         className={({ isActive }) => isActive ? 'active' : ''}>Dashboard</NavLink>
        <NavLink to="/stocks"   className={({ isActive }) => isActive ? 'active' : ''}>NSE 500 Stocks</NavLink>
        <NavLink to="/markets"  className={({ isActive }) => isActive ? 'active' : ''}>Markets</NavLink>
        <NavLink to="/shockers" className={({ isActive }) => isActive ? 'active' : ''}>⚡ Shockers</NavLink>
        <NavLink to="/ai"       className={({ isActive }) => isActive ? 'active' : ''}>🤖 AI Sentiment</NavLink>
      </nav>

      <div className="topbar-right">
        {serverOk === true  && <span className="dot-live">● API Live</span>}
        {serverOk === false && <span className="dot-closed">○ API Offline</span>}
        <a href="http://localhost:3001/monitor" target="_blank" rel="noopener noreferrer"
          className="btn btn-ghost btn-sm">↗ Aladdin</a>
      </div>
    </header>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <TopBar />
        <Routes>
          <Route path="/"         element={<Dashboard />} />
          <Route path="/stocks"   element={<Stocks />} />
          <Route path="/markets"  element={<Markets />} />
          <Route path="/shockers" element={<Shockers />} />
          <Route path="/ai"       element={<AISentiment />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
