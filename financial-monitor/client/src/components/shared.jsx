/* Shared utility components for Financial Monitor */

export function Loading({ msg = 'Loading…' }) {
  return <div className="loading">⏳ {msg}</div>
}

export function ErrorBox({ msg }) {
  if (!msg) return null
  return (
    <div className="error">
      ⚠️ {msg}
      {msg.includes('5000') && (
        <div style={{ marginTop: 8, fontSize: 11 }}>
          Start the server: <code>cd tradingview-economy/financial-monitor && node server/server.js</code>
        </div>
      )}
    </div>
  )
}

export function SectorBadge({ sector }) {
  return <span className="sector-badge">{sector || '—'}</span>
}

export function Change({ v, suffix = '%', decimals = 2 }) {
  const n = parseFloat(v) || 0
  const cls = n > 0 ? 'metric-pos' : n < 0 ? 'metric-neg' : 'metric-neu'
  const arrow = n > 0 ? '▲' : n < 0 ? '▼' : '→'
  return <span className={cls}>{arrow} {Math.abs(n).toFixed(decimals)}{suffix}</span>
}

export function Price({ v, currency = '₹' }) {
  if (!v && v !== 0) return <span className="metric-neu">—</span>
  const n = parseFloat(v)
  return <span>{currency}{n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
}

export function Pill({ label, tone = 'neu' }) {
  return <span className={`pill ${tone}`}>{label}</span>
}

export function fmtCr(v) {
  if (!v) return '—'
  const n = parseFloat(v)
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L Cr`
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(1)}K Cr`
  return `₹${n.toFixed(0)} Cr`
}
