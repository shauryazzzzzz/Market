// Shared API hooks
import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'

export function useApi(url, deps = []) {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)

  useEffect(() => {
    if (!url) return
    setLoading(true)
    setError(null)
    axios.get(url)
      .then(r => { setData(r.data); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, deps)  // eslint-disable-line

  return { data, loading, error }
}

export function Loading() {
  return <div className="loading"><div className="spin" /><span>Loading…</span></div>
}

export function ErrorBox({ msg }) {
  return <div className="error-box">⚠ {msg}</div>
}

export function fmt(n, decimals = 2) {
  if (n == null) return '—'
  return Number(n).toFixed(decimals)
}

export function fmtPct(n) {
  if (n == null) return '—'
  const v = Number(n)
  return <span className={v >= 0 ? 'metric-pos' : 'metric-neg'}>{v >= 0 ? '+' : ''}{v.toFixed(2)}%</span>
}

export function fmtCr(n) {
  if (n == null) return '—'
  const v = Number(n)
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L Cr`
  if (v >= 1000)   return `₹${(v / 1000).toFixed(1)}K Cr`
  return `₹${v.toFixed(0)} Cr`
}

export function Signal({ rating }) {
  if (!rating) return null
  const cls = rating === 'BUY' ? 'sig-buy' : rating === 'SELL' ? 'sig-sell' : 'sig-hold'
  return <span className={cls}>{rating}</span>
}

export function GradeBadge({ grade }) {
  if (!grade) return null
  const cls = grade.startsWith('A') ? 'grade-A' : grade.startsWith('B') ? 'grade-B' : 'grade-C'
  return <span className={`grade-badge ${cls}`}>{grade}</span>
}

// ── Time-range selector ───────────────────────────────────────────────────────

/** Canonical range labels and the corresponding price-history period param */
export const RANGES = ['1D', 'W', 'M', '3M', '6M', '1Y', '3Y', '5Y']

const RANGE_TO_PERIOD = {
  '1D': null,   // use live daily change — no fetch needed
  'W':  '1w',
  'M':  '1m',
  '3M': '3m',
  '6M': '6m',
  '1Y': '1y',
  '3Y': '3y',
  '5Y': '5y',
}

/**
 * RangePicker — a row of small toggle buttons (1D / W / M / 3M / 6M / 1Y / 3Y / 5Y).
 * Props:
 *   selected  — current range string (e.g. '1D')
 *   onChange  — callback(range: string)
 *   style     — optional extra container style
 */
export function RangePicker({ selected, onChange, style }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', ...style }}>
      {RANGES.map(r => (
        <button
          key={r}
          className={`btn btn-sm ${selected === r ? 'btn-primary' : 'btn-ghost'}`}
          style={{ minWidth: 36, padding: '2px 8px', fontSize: 11 }}
          onClick={() => onChange(r)}
        >
          {r}
        </button>
      ))}
    </div>
  )
}

/**
 * Compute % change from a price-history array.
 * Returns null if not enough data.
 */
export function calcRangeChange(history) {
  if (!Array.isArray(history) || history.length < 2) return null
  const first = history[0].close
  const last  = history[history.length - 1].close
  if (!first || !last) return null
  return ((last - first) / first) * 100
}

/**
 * Batch-fetch historical change % for multiple symbols at once.
 * Returns a Map<symbol, pct | null>.
 *
 * Usage:
 *   const { changes, loading } = useHistoricalChanges(symbols, range)
 *
 * When range === '1D', returns an empty Map immediately (caller should use live changePct).
 */
export function useHistoricalChanges(symbols, range) {
  const [changes, setChanges] = useState({})
  const [loading, setLoading] = useState(false)
  const cache = useRef({})  // cache[`${symbol}:${range}`] = pct

  useEffect(() => {
    if (range === '1D' || !symbols?.length) {
      setChanges({})
      return
    }
    const period = RANGE_TO_PERIOD[range]
    if (!period) { setChanges({}); return }

    // Determine which symbols still need fetching
    const needed = symbols.filter(s => cache.current[`${s}:${range}`] === undefined)

    setLoading(true)

    const fetchPromises = needed.map(sym =>
      axios.get(`/api/stock/price-history?symbol=${encodeURIComponent(sym)}&period=${period}`)
        .then(r => {
          const pct = calcRangeChange(r.data?.data)
          cache.current[`${sym}:${range}`] = pct
        })
        .catch(() => {
          cache.current[`${sym}:${range}`] = null
        })
    )

    Promise.all(fetchPromises).then(() => {
      // Build result map from cache for ALL requested symbols
      const result = {}
      symbols.forEach(s => {
        const cached = cache.current[`${s}:${range}`]
        result[s] = cached !== undefined ? cached : null
      })
      setChanges(result)
      setLoading(false)
    })
  }, [symbols?.join(','), range]) // eslint-disable-line

  return { changes, loading }
}

/**
 * RangeChg — renders a coloured change % for a single row.
 * Props:
 *   dailyPct   — the always-available daily change (from the live quote)
 *   rangePct   — historical change % from useHistoricalChanges (undefined = not loaded yet)
 *   range      — current range selection
 *   loading    — batch loading state
 */
export function RangeChg({ dailyPct, rangePct, range, loading }) {
  // 1D: always use live daily value
  if (range === '1D') {
    return <ChgSpan v={dailyPct} />
  }
  // Historical fetch in progress
  if (loading && rangePct == null) {
    return <span style={{ color: 'var(--muted)', fontSize: 11 }}>…</span>
  }
  // No data
  if (rangePct == null) {
    return <span style={{ color: 'var(--muted)' }}>—</span>
  }
  return <ChgSpan v={rangePct} />
}

/** Internal helper — coloured ▲/▼ percentage span */
function ChgSpan({ v }) {
  if (v == null) return <span style={{ color: 'var(--muted)' }}>—</span>
  const pos = v >= 0
  return (
    <span className={pos ? 'metric-pos' : 'metric-neg'}>
      {pos ? '▲' : '▼'} {Math.abs(v).toFixed(2)}%
    </span>
  )
}
