// Shared API hooks
import { useState, useEffect } from 'react'
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
