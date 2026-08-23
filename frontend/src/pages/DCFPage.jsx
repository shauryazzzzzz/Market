/**
 * DCFPage.jsx — Valuation & DCF Calculator
 * Route: /dcf
 * Intrinsic value: Discounted Cash Flow + Graham Number + Lynch PEG + Reverse DCF
 */
import { useState, useCallback, useMemo } from 'react'
import axios from 'axios'
import { Loading, ErrorBox, fmt, fmtCr } from '../components/shared'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Cell, ReferenceLine,
} from 'recharts'

const TT = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }

// ── DCF Engine (pure JS) ──────────────────────────────────────────────────────
function computeDCF({ fcf, growthRateY1to5, growthRateY6to10, terminalGrowth, wacc, sharesOutstanding, netDebt }) {
  const years = 10
  let pv = 0
  let cf = fcf
  for (let y = 1; y <= years; y++) {
    const g = y <= 5 ? growthRateY1to5 / 100 : growthRateY6to10 / 100
    cf = cf * (1 + g)
    pv += cf / Math.pow(1 + wacc / 100, y)
  }
  // Terminal value
  const terminalValue = (cf * (1 + terminalGrowth / 100)) / ((wacc - terminalGrowth) / 100)
  const pvTerminal    = terminalValue / Math.pow(1 + wacc / 100, years)
  const enterpriseValue = pv + pvTerminal
  const equityValue     = Math.max(0, enterpriseValue - netDebt)
  const intrinsicPerShare = sharesOutstanding > 0 ? equityValue / sharesOutstanding : 0

  // Build year-by-year table
  const table = []
  let cf2 = fcf
  for (let y = 1; y <= years; y++) {
    const g = y <= 5 ? growthRateY1to5 / 100 : growthRateY6to10 / 100
    cf2 = cf2 * (1 + g)
    const pvCF = cf2 / Math.pow(1 + wacc / 100, y)
    table.push({ year: `Y${y}`, fcf: Math.round(cf2), pv: Math.round(pvCF) })
  }

  return { intrinsicPerShare, enterpriseValue, pvTerminal, pv, equityValue, table }
}

function grahamNumber(eps, bvps) {
  if (eps <= 0 || bvps <= 0) return null
  return Math.sqrt(22.5 * eps * bvps)
}

function lynchFairValue(eps, growthRate) {
  if (eps <= 0 || growthRate <= 0) return null
  return eps * growthRate  // PEG=1 => fair value = EPS × growth
}

// Reverse DCF: given current price + shares, what growth rate is implied?
function reverseDCF({ price, sharesOutstanding, fcf, wacc, terminalGrowth, netDebt }) {
  // Binary search for growth rate that gives intrinsic = price
  const equity = price * sharesOutstanding - (-netDebt)
  let lo = -10, hi = 100
  for (let iter = 0; iter < 60; iter++) {
    const mid = (lo + hi) / 2
    const res = computeDCF({ fcf, growthRateY1to5: mid, growthRateY6to10: mid / 2, terminalGrowth, wacc, sharesOutstanding, netDebt })
    if (res.equityValue > equity) hi = mid
    else lo = mid
    if (hi - lo < 0.01) break
  }
  return parseFloat(((lo + hi) / 2).toFixed(1))
}

// ── Prefill from API ──────────────────────────────────────────────────────────
async function prefillFromAPI(symbol) {
  const r = await axios.get(`/api/stock/deep-dive?q=${encodeURIComponent(symbol)}`, { timeout: 10000 })
  if (!r.data?.success) throw new Error('Company not found')
  const c = r.data.data?.company
  const live = r.data.data?.livePriceData
  return {
    name:           c.name     || symbol,
    currentPrice:   live?.price || c.currentPrice || 0,
    eps:            c.pat && c.sharesOutstanding ? (c.pat * 10000000) / (c.sharesOutstanding || 1e8) : 0,
    bvps:           c.pb && (live?.price || c.currentPrice) ? (live?.price || c.currentPrice) / (c.pb || 1) : 0,
    fcf:            c.cashFromOps || (c.pat ? c.pat * 10 : 100),  // ₹ Cr → treat as unit
    growthRateY1to5: Math.min(Math.max(c.profitGrowth3yr || 15, 5), 40),
    growthRateY6to10: Math.min(Math.max((c.profitGrowth3yr || 15) / 2, 3), 20),
    industry:       c.industry || '',
    roe:            c.roe || 0,
    pe:             c.pe  || 0,
    piotroski:      c.piotroskiScore || 0,
  }
}

// ── Gauge component ───────────────────────────────────────────────────────────
function ValuationGauge({ current, intrinsic, label }) {
  if (!intrinsic || intrinsic <= 0) return null
  const margin  = ((intrinsic - current) / intrinsic) * 100
  const isUnder = margin > 0
  const pct = Math.abs(margin).toFixed(1)
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <div className="card-label" style={{ marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: isUnder ? 'var(--positive)' : 'var(--negative)' }}>
        ₹{intrinsic.toFixed(2)}
      </div>
      <div style={{ fontSize: 13, marginTop: 4 }} className={isUnder ? 'metric-pos' : 'metric-neg'}>
        {isUnder ? `↓ Undervalued by ${pct}%` : `↑ Overvalued by ${pct}%`}
      </div>
      <div style={{ marginTop: 10 }}>
        <div className="progress-track">
          <div className="progress-fill" style={{
            width: `${Math.min(Math.abs(margin), 100)}%`,
            background: isUnder ? 'var(--positive)' : 'var(--negative)',
          }} />
        </div>
      </div>
    </div>
  )
}

export default function DCFPage() {
  const [symbol,  setSymbol]  = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [prefilled, setPrefilled] = useState(false)

  // DCF inputs
  const [inputs, setInputs] = useState({
    name:             '',
    currentPrice:     2000,
    fcf:              500,       // ₹ Cr base FCF
    growthRateY1to5:  15,        // % per year for years 1–5
    growthRateY6to10: 8,         // % per year for years 6–10
    terminalGrowth:   4,         // % terminal growth rate
    wacc:             12,        // % discount rate
    sharesOutstanding: 35,       // Crore shares
    netDebt:          0,         // ₹ Cr (positive = debt; negative = cash)
    eps:              60,        // ₹
    bvps:             400,       // ₹
  })

  const set = (k, v) => setInputs(prev => ({ ...prev, [k]: v }))

  // Auto-prefill from API
  const prefill = useCallback(async () => {
    if (!symbol.trim()) return
    setLoading(true); setError(null)
    try {
      const data = await prefillFromAPI(symbol.trim())
      setInputs(prev => ({
        ...prev,
        name:             data.name,
        currentPrice:     data.currentPrice || prev.currentPrice,
        fcf:              data.fcf || prev.fcf,
        growthRateY1to5:  data.growthRateY1to5 || prev.growthRateY1to5,
        growthRateY6to10: data.growthRateY6to10 || prev.growthRateY6to10,
        eps:              data.eps  || prev.eps,
        bvps:             data.bvps || prev.bvps,
      }))
      setPrefilled(true)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [symbol])

  // Computed valuations
  const dcf = useMemo(() => computeDCF({
    fcf:              parseFloat(inputs.fcf),
    growthRateY1to5:  parseFloat(inputs.growthRateY1to5),
    growthRateY6to10: parseFloat(inputs.growthRateY6to10),
    terminalGrowth:   parseFloat(inputs.terminalGrowth),
    wacc:             parseFloat(inputs.wacc),
    sharesOutstanding: parseFloat(inputs.sharesOutstanding) * 1e7,  // Cr → count
    netDebt:          parseFloat(inputs.netDebt) * 1e7,
  }), [inputs])

  const graham = useMemo(() => grahamNumber(parseFloat(inputs.eps), parseFloat(inputs.bvps)), [inputs])
  const lynch  = useMemo(() => lynchFairValue(parseFloat(inputs.eps), parseFloat(inputs.growthRateY1to5)), [inputs])

  const implied = useMemo(() => reverseDCF({
    price:            parseFloat(inputs.currentPrice),
    fcf:              parseFloat(inputs.fcf),
    wacc:             parseFloat(inputs.wacc),
    terminalGrowth:   parseFloat(inputs.terminalGrowth),
    sharesOutstanding: parseFloat(inputs.sharesOutstanding) * 1e7,
    netDebt:          parseFloat(inputs.netDebt) * 1e7,
  }), [inputs])

  const intrinsicDCF = dcf.intrinsicPerShare / 1e7  // back to ₹ per share (FCF was in Cr)

  return (
    <div className="page">
      <div style={{ marginBottom: 20 }}>
        <div className="page-title">Valuation & DCF Calculator</div>
        <div className="page-sub">10-year Discounted Cash Flow · Graham Number · Lynch PEG · Reverse DCF · Margin of Safety</div>
      </div>

      {/* Prefill bar */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Auto-fill from CSV (NSE code)</div>
            <input className="input" placeholder="e.g. TCS, HDFCBANK" value={symbol}
              onChange={e => setSymbol(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && prefill()}
              style={{ width: 200 }} />
          </div>
          <button className="btn btn-primary" onClick={prefill} disabled={loading}>
            {loading ? 'Loading…' : '⚡ Auto-Fill'}
          </button>
          {prefilled && <span className="pill positive">✓ Pre-filled: {inputs.name}</span>}
          <div style={{ fontSize: 12, color: 'var(--muted)', alignSelf: 'center' }}>
            Or enter inputs manually below
          </div>
        </div>
      </div>

      {error && <ErrorBox msg={error} />}

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 16, alignItems: 'start' }}>
        {/* ── Inputs panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card">
            <div className="card-title" style={{ marginBottom: 14 }}>DCF Inputs</div>

            {[
              ['Current Price (₹)', 'currentPrice'],
              ['Base FCF (₹ Cr)', 'fcf'],
              ['Growth Y1–5 (%)', 'growthRateY1to5'],
              ['Growth Y6–10 (%)', 'growthRateY6to10'],
              ['Terminal Growth (%)', 'terminalGrowth'],
              ['WACC / Discount Rate (%)', 'wacc'],
              ['Shares Outstanding (Cr)', 'sharesOutstanding'],
              ['Net Debt (₹ Cr)', 'netDebt'],
            ].map(([label, key]) => (
              <div key={key} className="stat-row">
                <span className="stat-label">{label}</span>
                <input className="input" type="number" value={inputs[key]}
                  onChange={e => set(key, e.target.value)}
                  style={{ width: 110, textAlign: 'right', padding: '4px 8px' }} />
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-title" style={{ marginBottom: 14 }}>Graham / Lynch Inputs</div>
            {[
              ['EPS (₹ per share)', 'eps'],
              ['Book Value/Share (₹)', 'bvps'],
            ].map(([label, key]) => (
              <div key={key} className="stat-row">
                <span className="stat-label">{label}</span>
                <input className="input" type="number" value={inputs[key]}
                  onChange={e => set(key, e.target.value)}
                  style={{ width: 110, textAlign: 'right', padding: '4px 8px' }} />
              </div>
            ))}
          </div>
        </div>

        {/* ── Results panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Valuation gauges */}
          <div className="grid-3">
            <ValuationGauge current={parseFloat(inputs.currentPrice)} intrinsic={intrinsicDCF} label="DCF Intrinsic Value" />
            <ValuationGauge current={parseFloat(inputs.currentPrice)} intrinsic={graham} label="Graham Number" />
            <ValuationGauge current={parseFloat(inputs.currentPrice)} intrinsic={lynch} label="Lynch Fair Value (PEG=1)" />
          </div>

          {/* Reverse DCF */}
          <div className="card">
            <div className="card-label">Reverse DCF</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 8 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--warning)' }}>{implied}%</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                growth rate implied by current price of ₹{parseFloat(inputs.currentPrice).toFixed(0)}
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
              {implied > parseFloat(inputs.growthRateY1to5)
                ? `Market expects ${implied}% — your estimate is ${inputs.growthRateY1to5}% → stock may be OVERVALUED`
                : `Market expects ${implied}% — your estimate is ${inputs.growthRateY1to5}% → stock may be UNDERVALUED`}
            </div>
          </div>

          {/* Summary breakdown */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 12 }}>DCF Breakdown</div>
            <div className="stat-row"><span className="stat-label">PV of FCF (10 years)</span><span className="stat-val">₹{fmtCr(dcf.pv)}</span></div>
            <div className="stat-row"><span className="stat-label">PV of Terminal Value</span><span className="stat-val">₹{fmtCr(dcf.pvTerminal)}</span></div>
            <div className="stat-row"><span className="stat-label">Enterprise Value</span><span className="stat-val">₹{fmtCr(dcf.enterpriseValue)}</span></div>
            <div className="stat-row"><span className="stat-label">Net Debt</span><span className="stat-val">₹{fmtCr(parseFloat(inputs.netDebt) * 1e7)}</span></div>
            <div className="stat-row"><span className="stat-label">Equity Value</span><span className="stat-val">₹{fmtCr(dcf.equityValue)}</span></div>
            <div className="stat-row">
              <span className="stat-label">Intrinsic Per Share (DCF)</span>
              <span className="stat-val" style={{ fontWeight: 800, color: 'var(--primary)' }}>₹{intrinsicDCF.toFixed(2)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Current Price</span>
              <span className="stat-val" style={{ fontWeight: 800 }}>₹{parseFloat(inputs.currentPrice).toFixed(2)}</span>
            </div>
          </div>

          {/* FCF year-by-year chart */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 12 }}>10-Year Projected FCF vs. Present Value</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={dcf.table}>
                <XAxis dataKey="year" tick={{ fill: 'var(--muted)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} tickFormatter={v => `₹${(v/1e7).toFixed(0)}Cr`} />
                <Tooltip contentStyle={TT} formatter={(v, n) => [`₹${(v/1e7).toFixed(0)} Cr`, n === 'fcf' ? 'Projected FCF' : 'PV of FCF']} />
                <Bar dataKey="fcf" fill="var(--primary)" opacity={0.5} name="fcf" radius={[3,3,0,0]} />
                <Bar dataKey="pv"  fill="var(--positive)"             name="pv"  radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
