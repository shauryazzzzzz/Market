/**
 * StockDeepDive.jsx — comprehensive stock analysis page
 * Route: /stock/:symbol
 * Data: /api/stock/deep-dive?q=<symbol>  +  /api/stock/price-history?symbol=<NSE>.NS
 *       /api/gs/company?q=<symbol>  (Google Sheet advanced data — Composite Score etc.)
 */
import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import {
  AreaChart, Area, BarChart, Bar, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts'
import { Loading, ErrorBox, Signal, GradeBadge, fmtCr, fmtPct, fmt, RangePicker, useHistoricalChanges } from '../components/shared'

// ── Snowflake axis scoring ────────────────────────────────────────────────────
function scoreAxes(c) {
  if (!c) return { Value: 0, Growth: 0, Quality: 0, Momentum: 0, Income: 0 }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
  const norm  = (v, lo, hi) => clamp(((v - lo) / (hi - lo)) * 10, 0, 10)

  // Value: PE (low=good), PB (low=good), Graham diff (negative=undervalued), EV/EBITDA
  const peScore      = c.pe        != null ? norm(50 - c.pe,   0, 50) : 5
  const pbScore      = c.pb        != null ? norm(10 - c.pb,   0, 10) : 5
  const grahamScore  = c.grahamDiff!= null ? norm(-c.grahamDiff, -100, 100) : 5
  const Value        = parseFloat(((peScore + pbScore + grahamScore) / 3).toFixed(1))

  // Growth: profit/sales growth 3yr and 5yr
  const pg3  = c.profitGrowth3yr != null ? norm(c.profitGrowth3yr,  0, 40) : 5
  const sg3  = c.salesGrowth3yr  != null ? norm(c.salesGrowth3yr,   0, 30) : 5
  const pg5  = c.profitGrowth5yr != null ? norm(c.profitGrowth5yr,  0, 40) : 5
  const Growth = parseFloat(((pg3 + sg3 + pg5) / 3).toFixed(1))

  // Quality: ROE, OPM, Piotroski, D/E (low=good)
  const roeScore  = c.roe          != null ? norm(c.roe,              0, 40) : 5
  const opmScore  = c.opm          != null ? norm(c.opm,              0, 40) : 5
  const pioScore  = c.piotroskiScore!= null? norm(c.piotroskiScore,   0, 9 ) : 5
  const deScore   = c.debtToEquity != null ? norm(3 - c.debtToEquity, 0, 3 ) : 5
  const Quality   = parseFloat(((roeScore + opmScore + pioScore + deScore) / 4).toFixed(1))

  // Momentum: 1yr, 3m, 6m returns
  const r1yr = c.return1yr  != null ? norm(c.return1yr,  -30, 80) : 5
  const r3m  = c.return3m   != null ? norm(c.return3m,   -15, 30) : 5
  const r6m  = c.return6m   != null ? norm(c.return6m,   -20, 50) : 5
  const Momentum = parseFloat(((r1yr + r3m + r6m) / 3).toFixed(1))

  // Income: dividend yield, promoter holding (skin in the game), positive cashflow
  const divScore    = c.dividendYield != null ? norm(c.dividendYield,    0, 8) : 3
  const promScore   = c.promoterHolding!= null? norm(c.promoterHolding, 25, 75) : 5
  const cashScore   = c.cashFromOps   != null ? (c.cashFromOps > 0 ? 7 : 3) : 5
  const Income      = parseFloat(((divScore + promScore + cashScore) / 3).toFixed(1))

  return { Value, Growth, Quality, Momentum, Income }
}

// ── Colour helpers ────────────────────────────────────────────────────────────
const green  = 'var(--positive)'
const red    = 'var(--negative)'
const yellow = 'var(--warning)'
const muted  = 'var(--muted)'

function ratioSignal(val, thresholds) {
  // thresholds: { good, bad, higherIsBetter }
  if (val == null) return muted
  if (thresholds.higherIsBetter) {
    if (val >= thresholds.good) return green
    if (val <= thresholds.bad)  return red
    return yellow
  } else {
    if (val <= thresholds.good) return green
    if (val >= thresholds.bad)  return red
    return yellow
  }
}

// ── Ratio card ────────────────────────────────────────────────────────────────
function RatioCard({ label, value, suffix = '', thresholds, indAvg, fmt: fmtFn }) {
  const color = thresholds ? ratioSignal(value, thresholds) : 'var(--text)'
  const display = value != null ? `${fmtFn ? fmtFn(value) : Number(value).toFixed(1)}${suffix}` : '—'
  const avgDisplay = indAvg != null ? `${Number(indAvg).toFixed(1)}${suffix}` : null
  return (
    <div className="card" style={{ padding: '12px 16px' }}>
      <div className="card-label" style={{ marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{display}</div>
      {avgDisplay && (
        <div style={{ fontSize: 11, color: muted, marginTop: 4 }}>
          Industry avg: <span style={{ color: 'var(--text)' }}>{avgDisplay}</span>
        </div>
      )}
    </div>
  )
}

// ── Earnings surprise badge ───────────────────────────────────────────────────
function SurpriseBadge({ yoyProfitGrowth, qoqProfits }) {
  if (yoyProfitGrowth == null) return <span style={{ color: muted }}>—</span>
  if (yoyProfitGrowth > 15)  return <span className="sig-buy">BEAT</span>
  if (yoyProfitGrowth < -10) return <span className="sig-sell">MISS</span>
  return <span className="sig-hold">IN-LINE</span>
}

// ── Sparkline mini-chart ──────────────────────────────────────────────────────
function Sparkline({ data }) {
  if (!data || data.length < 2) return null
  const first = data[0]?.close
  const last  = data[data.length - 1]?.close
  const color = last >= first ? 'var(--positive)' : 'var(--negative)'
  return (
    <ResponsiveContainer width="100%" height={60}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="spkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="close" stroke={color} fill="url(#spkGrad)" strokeWidth={1.5} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── Snowflake radar ───────────────────────────────────────────────────────────
function SnowflakeRadar({ scores }) {
  const data = Object.entries(scores).map(([axis, value]) => ({ axis, value, fullMark: 10 }))
  return (
    <ResponsiveContainer width="100%" height={240}>
      <RadarChart data={data} margin={{ top: 10, right: 30, left: 30, bottom: 10 }}>
        <PolarGrid stroke="var(--border)" />
        <PolarAngleAxis dataKey="axis" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
        <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
        <Radar name="Score" dataKey="value" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.3} strokeWidth={2} />
        <Tooltip
          contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
          formatter={(v) => [v.toFixed(1), 'Score']}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}

// ── Shareholding doughnut ─────────────────────────────────────────────────────
const DOUGHNUT_COLORS = ['#2f81f7', '#a371f7', '#3fb950', '#d29922']

function ShareholdingDoughnut({ c }) {
  const data = [
    { name: 'Promoter', value: c.promoterHolding ?? 0 },
    { name: 'FII',      value: c.fiiHolding      ?? 0 },
    { name: 'DII',      value: c.diiHolding      ?? 0 },
    { name: 'Public',   value: c.publicHolding    ?? 0 },
  ].filter(d => d.value > 0)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
      <ResponsiveContainer width={160} height={160}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="value">
            {data.map((_, i) => <Cell key={i} fill={DOUGHNUT_COLORS[i % DOUGHNUT_COLORS.length]} />)}
          </Pie>
          <Tooltip
            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
            formatter={(v) => [`${v.toFixed(1)}%`]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.map((d, i) => (
          <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: DOUGHNUT_COLORS[i] }} />
            <span style={{ fontSize: 12, color: muted, width: 70 }}>{d.name}</span>
            <div style={{ flex: 1, background: 'var(--bg3)', borderRadius: 2, height: 4 }}>
              <div style={{ width: `${d.value}%`, height: '100%', background: DOUGHNUT_COLORS[i], borderRadius: 2 }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, width: 45, textAlign: 'right' }}>{d.value.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Valuation signals ─────────────────────────────────────────────────────────
function ValuationLight({ label, condition, detail }) {
  const color = condition === true ? green : condition === false ? red : yellow
  const icon  = condition === true ? '●' : condition === false ? '●' : '●'
  return (
    <div className="stat-row">
      <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color, fontSize: 10 }}>{icon}</span> {label}
      </span>
      <span className="stat-val" style={{ color, fontSize: 12 }}>{detail}</span>
    </div>
  )
}

// ── Price chart section ───────────────────────────────────────────────────────
const PERIODS = ['1m', '3m', '6m', '1y', '3y', '5y']

function PriceChartSection({ nseCode }) {
  const [period, setPeriod] = useState('1y')
  const [hist,   setHist]   = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!nseCode) return
    setLoading(true)
    axios.get(`/api/stock/price-history?symbol=${nseCode}.NS&period=${period}`)
      .then(r => { setHist(r.data?.data || []); setLoading(false) })
      .catch(() => { setHist([]); setLoading(false) })
  }, [nseCode, period])

  const first = hist[0]?.close
  const last  = hist[hist.length - 1]?.close
  const color = !first || last >= first ? 'var(--positive)' : 'var(--negative)'

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Price History</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {PERIODS.map(p => (
            <button key={p} className={`btn btn-sm ${period === p ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setPeriod(p)}>{p.toUpperCase()}</button>
          ))}
        </div>
      </div>
      {loading ? <Loading /> : hist.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: muted }}>No price history available for {nseCode}.NS</div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={hist} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: muted, fontSize: 11 }} tickLine={false}
              tickFormatter={d => d ? d.slice(2) : ''} interval="preserveStartEnd" />
            <YAxis tick={{ fill: muted, fontSize: 11 }} tickLine={false} axisLine={false}
              tickFormatter={v => `₹${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} width={60} />
            <Tooltip
              contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
              formatter={(v) => [`₹${Number(v).toFixed(2)}`, 'Close']}
              labelFormatter={l => l}
            />
            <Area type="monotone" dataKey="close" stroke={color} fill="url(#priceGrad)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ── GrowthRadar: 6-axis radar from Google Sheet scores ────────────────────────
function GrowthRadar({ gs }) {
  if (!gs) return null
  const axes = [
    { axis: 'ROE Score',      value: gs.roeScore       ?? 0 },
    { axis: 'Profit Gr',      value: gs.profitGrScore   ?? 0 },
    { axis: 'Sales Gr',       value: gs.salesGrScore    ?? 0 },
    { axis: 'Return Gr',      value: gs.returnGrScore   ?? 0 },
    { axis: 'Composite',      value: Math.min((gs.compositeScore ?? 0) / 10, 10) },
    { axis: 'Mkt Outperform', value: Math.min(Math.max((gs.mktReturnComp ?? 0) + 5, 0), 10) },
  ]
  return (
    <ResponsiveContainer width="100%" height={220}>
      <RadarChart data={axes} margin={{ top: 10, right: 30, left: 30, bottom: 10 }}>
        <PolarGrid stroke="var(--border)" />
        <PolarAngleAxis dataKey="axis" tick={{ fill: 'var(--muted)', fontSize: 11 }} />
        <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
        <Radar name="GS Score" dataKey="value" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.3} strokeWidth={2} />
        <Tooltip
          contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
          formatter={(v) => [Number(v).toFixed(1), 'Score']}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}

// ── JumpSignals widget ────────────────────────────────────────────────────────
function JumpSignals({ gs }) {
  if (!gs) return null
  const parseJump = (v) => { const n = parseFloat((v || '').toString().replace('%', '')); return isNaN(n) ? null : n }
  const signals = [
    { label: 'ROE Short',     val: parseJump(gs.roeJumpShort),     longVal: parseJump(gs.roeJumpLong) },
    { label: 'ROE Long',      val: parseJump(gs.roeJumpLong),      longVal: null },
    { label: 'Profit Short',  val: parseJump(gs.profitJumpShort),  longVal: parseJump(gs.profitJumpLong) },
    { label: 'Profit Long',   val: parseJump(gs.profitJumpLong),   longVal: null },
    { label: 'Sales Short',   val: parseJump(gs.salesJumpShort),   longVal: parseJump(gs.salesJumpLong) },
    { label: 'Sales Long',    val: parseJump(gs.salesJumpLong),    longVal: null },
  ]
  const fmtJ = (v) => v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
      {signals.map(s => (
        <div key={s.label} style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 14px' }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>{s.label}</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: s.val == null ? 'var(--muted)' : s.val > 0 ? green : red }}>
            {fmtJ(s.val)}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Momentum Emoji Row ────────────────────────────────────────────────────────
function MomentumRow({ gs }) {
  if (!gs) return null
  const signals = [
    { label: 'QoQ Sales',  v: gs.qoqSalesSignal },
    { label: 'YoY Sales',  v: gs.yoySalesSignal },
    { label: 'YoY PAT',    v: gs.yoyPatSignal   },
    { label: 'QoQ PAT',    v: gs.qoqPatSignal   },
  ]
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12 }}>
      {signals.map(s => (
        <div key={s.label} style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22 }}>{s.v === 'up' ? '🟢' : s.v === 'down' ? '🔴' : '⚪'}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{s.label}</div>
        </div>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function StockDeepDive() {
  const { symbol } = useParams()
  const navigate   = useNavigate()

  const [data,    setData]    = useState(null)
  const [gsData,  setGsData]  = useState(null)   // Google Sheet advanced data
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [range,   setRange]   = useState('1D')

  useEffect(() => {
    if (!symbol) return
    setLoading(true)
    setError(null)
    // Fetch both deep-dive and GS data in parallel
    Promise.allSettled([
      axios.get(`/api/stock/deep-dive?q=${encodeURIComponent(symbol)}`),
      axios.get(`/api/gs/company?q=${encodeURIComponent(symbol)}`),
    ]).then(([ddRes, gsRes]) => {
      if (ddRes.status === 'rejected' || !ddRes.value.data.success) {
        throw new Error(ddRes.value?.data?.error || ddRes.reason?.message || 'Not found')
      }
      setData(ddRes.value.data.data)
      if (gsRes.status === 'fulfilled' && gsRes.value.data.success) {
        setGsData(gsRes.value.data.data)
      }
      setLoading(false)
    }).catch(e => { setError(e.message); setLoading(false) })
  }, [symbol])

  if (loading) return <div className="page"><Loading /></div>
  if (error)   return <div className="page"><ErrorBox msg={error} /></div>
  if (!data)   return null

  const { company: c, grade, revenueTrend, profitTrend, marginTrend, peers, industryAvg, livePriceData, sparkline } = data

  // Derive signal
  const pioScore = c.piotroskiScore ?? 0
  const signal   = pioScore >= 7 && (c.roe ?? 0) >= 15 ? 'BUY'
                 : pioScore <= 3 || (c.debtToEquity ?? 0) > 2 ? 'SELL'
                 : 'HOLD'

  const lp     = livePriceData
  const price  = lp?.price ?? c.currentPrice
  const chgPct = lp?.changePct ?? null

  // Historical range change for this single stock
  const nsSym = c.nseCode ? [c.nseCode.includes('.NS') ? c.nseCode : c.nseCode + '.NS'] : []
  const { changes: rangeChg, loading: rangeL } = useHistoricalChanges(nsSym, range)
  const historicalChangePct = nsSym[0] ? rangeChg[nsSym[0]] : null

  const scores    = scoreAxes(c)
  const avgScores = industryAvg
    ? scoreAxes(industryAvg.averages ?? {})
    : null

  const radarData = Object.entries(scores).map(([axis, value]) => ({
    axis,
    value,
    industry: avgScores ? avgScores[axis] : 5,
    fullMark: 10,
  }))

  const ia = industryAvg?.averages ?? {}

  // Valuation conditions
  const valSignals = [
    {
      label: 'PE vs Industry',
      condition: c.peToIndustry != null ? c.peToIndustry < 1 : null,
      detail: c.peToIndustry != null ? `${c.peToIndustry.toFixed(2)}x` : '—',
    },
    {
      label: 'PEG < 1 (growth-adjusted)',
      condition: c.pegRatio != null ? c.pegRatio < 1 : null,
      detail: c.pegRatio != null ? c.pegRatio.toFixed(2) : '—',
    },
    {
      label: 'Below Graham Price',
      condition: c.grahamDiff != null ? c.grahamDiff < 0 : null,
      detail: c.grahamDiff != null ? `${c.grahamDiff.toFixed(1)}%` : '—',
    },
    {
      label: 'PE vs 5Y avg PE',
      condition: c.peTo5PE != null ? c.peTo5PE < 1 : null,
      detail: c.peTo5PE != null ? `${c.peTo5PE.toFixed(2)}x` : '—',
    },
    {
      label: 'ROE vs 5Y avg ROE',
      condition: c.roeTo5ROE != null ? c.roeTo5ROE > 1 : null,
      detail: c.roeTo5ROE != null ? `${c.roeTo5ROE.toFixed(2)}x` : '—',
    },
  ]

  return (
    <div className="page">
      {/* ── 1. Header strip ─────────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div className="page-title" style={{ margin: 0 }}>{c.name}</div>
              <Signal rating={grade?.rating ?? signal} />
              {grade?.grade && <GradeBadge grade={grade.grade} />}
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="sym">{c.nseCode ?? '—'}</span>
              <span style={{ color: muted, fontSize: 12 }}>{c.industry}</span>
              {c.lastResultDate && (
                <span style={{ color: muted, fontSize: 12 }}>Last result: {c.lastResultDate}</span>
              )}
              {lp?.exchangeName && <span style={{ color: muted, fontSize: 12 }}>{lp.exchangeName}</span>}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            {price != null ? (
              <>
                <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1 }}>
                  ₹{Number(price).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: 14, marginTop: 4 }}>
                  {range === '1D' ? (
                    chgPct != null ? (
                      <>
                        <span className={chgPct >= 0 ? 'metric-pos' : 'metric-neg'}>
                          {chgPct >= 0 ? '+' : ''}{chgPct.toFixed(2)}%
                        </span>
                        {lp?.change != null && (
                          <span style={{ color: muted, marginLeft: 6, fontSize: 12 }}>
                            ({lp.change >= 0 ? '+' : ''}{lp.change.toFixed(2)})
                          </span>
                        )}
                      </>
                    ) : null
                  ) : (
                    rangeL ? (
                      <span style={{ color: muted, fontSize: 12 }}>…</span>
                    ) : historicalChangePct != null ? (
                      <span className={historicalChangePct >= 0 ? 'metric-pos' : 'metric-neg'}>
                        {historicalChangePct >= 0 ? '+' : ''}{historicalChangePct.toFixed(2)}% ({range})
                      </span>
                    ) : (
                      <span style={{ color: muted }}>—</span>
                    )
                  )}
                </div>
              </>
            ) : (
              <div style={{ color: muted }}>Price unavailable</div>
            )}
            <div style={{ fontSize: 12, color: muted, marginTop: 4 }}>
              Mkt Cap: <strong style={{ color: 'var(--text)' }}>{fmtCr(c.marketCap)}</strong>
            </div>
            <div style={{ marginTop: 8 }}>
              <RangePicker selected={range} onChange={setRange} />
            </div>
          </div>
        </div>

        {/* Sparkline */}
        {sparkline.length > 2 && (
          <div style={{ marginTop: 10 }}>
            <Sparkline data={sparkline} />
          </div>
        )}

        {/* Quick price stats row */}
        {lp && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            {[
              ['Open',       lp.open   != null ? `₹${lp.open.toFixed(2)}`   : '—'],
              ['Day High',   lp.high   != null ? `₹${lp.high.toFixed(2)}`   : '—'],
              ['Day Low',    lp.low    != null ? `₹${lp.low.toFixed(2)}`    : '—'],
              ['52W High',   lp.week52High != null ? `₹${lp.week52High.toFixed(2)}` : '—'],
              ['52W Low',    lp.week52Low  != null ? `₹${lp.week52Low.toFixed(2)}`  : '—'],
              ['Volume',     lp.volume != null ? (lp.volume / 1e6).toFixed(2) + 'M' : '—'],
            ].map(([l, v]) => (
              <div key={l}>
                <div style={{ fontSize: 10, color: muted, textTransform: 'uppercase', letterSpacing: '.5px' }}>{l}</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{v}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        {/* ── 2. Snowflake health score ──────────────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Health Scorecard</div>
              <div style={{ fontSize: 11, color: muted }}>Radar across 5 axes — each scored 0–10</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary)' }}>
                {Object.values(scores).reduce((a, b) => a + b, 0).toFixed(0)}
                <span style={{ fontSize: 14, color: muted }}>/50</span>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <RadarChart data={radarData} margin={{ top: 10, right: 30, left: 30, bottom: 10 }}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="axis" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
              <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
              <Radar name={c.name} dataKey="value" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.3} strokeWidth={2} />
              {avgScores && (
                <Radar name="Industry" dataKey="industry" stroke="var(--warning)" fill="var(--warning)" fillOpacity={0.1} strokeWidth={1.5} strokeDasharray="4 2" />
              )}
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                formatter={(v) => [Number(v).toFixed(1), '']}
              />
            </RadarChart>
          </ResponsiveContainer>
          <div className="grid-4" style={{ gap: 8, marginTop: 8 }}>
            {Object.entries(scores).map(([k, v]) => (
              <div key={k} style={{ textAlign: 'center', padding: '8px 4px', background: 'var(--bg3)', borderRadius: 6 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: v >= 7 ? green : v >= 4 ? yellow : red }}>{v.toFixed(1)}</div>
                <div style={{ fontSize: 10, color: muted, textTransform: 'uppercase', letterSpacing: '.5px' }}>{k}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 6. Shareholding doughnut ───────────────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Shareholding Pattern</div>
            <span style={{ fontSize: 11, color: muted }}>As of {c.lastResultDate ?? 'latest'}</span>
          </div>
          <ShareholdingDoughnut c={c} />
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div className="stat-row">
              <span className="stat-label">Promoter Holding</span>
              <span className="stat-val" style={{ color: (c.promoterHolding ?? 0) >= 50 ? green : yellow }}>
                {fmt(c.promoterHolding)}%
              </span>
            </div>
            <div className="stat-row">
              <span className="stat-label">FII Holding</span>
              <span className="stat-val">{fmt(c.fiiHolding)}%</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">DII Holding</span>
              <span className="stat-val">{fmt(c.diiHolding)}%</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Public Holding</span>
              <span className="stat-val">{fmt(c.publicHolding)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Ratio scorecard ─────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div className="card-title">Key Ratios</div>
          <span style={{ fontSize: 11, color: muted }}>vs Industry avg in grey</span>
        </div>
        <div className="grid-4" style={{ gap: 10 }}>
          <RatioCard label="P/E Ratio"       value={c.pe}            thresholds={{ good: 20, bad: 50, higherIsBetter: false }} indAvg={ia.pe} />
          <RatioCard label="P/B Ratio"       value={c.pb}            thresholds={{ good: 2, bad: 8, higherIsBetter: false }} indAvg={ia.pb} />
          <RatioCard label="ROE %"           value={c.roe}           thresholds={{ good: 20, bad: 10, higherIsBetter: true }} indAvg={ia.roe}           suffix="%" />
          <RatioCard label="OPM %"           value={c.opm}           thresholds={{ good: 20, bad: 8, higherIsBetter: true }}  indAvg={ia.opm}           suffix="%" />
          <RatioCard label="Debt / Equity"   value={c.debtToEquity}  thresholds={{ good: 0.5, bad: 1.5, higherIsBetter: false }} indAvg={ia.debtToEquity} />
          <RatioCard label="PEG Ratio"       value={c.pegRatio}      thresholds={{ good: 1, bad: 2, higherIsBetter: false }} indAvg={ia.pegRatio} />
          <RatioCard label="EV/EBITDA"       value={c.evEbitda}      thresholds={{ good: 10, bad: 25, higherIsBetter: false }} indAvg={ia.evEbitda} />
          <RatioCard label="Piotroski Score" value={c.piotroskiScore} thresholds={{ good: 7, bad: 4, higherIsBetter: true }} suffix="/9" />
          <RatioCard label="Promoter %"      value={c.promoterHolding} thresholds={{ good: 50, bad: 30, higherIsBetter: true }} suffix="%" />
          <RatioCard label="FII %"           value={c.fiiHolding}    thresholds={{ good: 15, bad: 5, higherIsBetter: true }}  suffix="%" />
          <RatioCard label="Graham Diff %"   value={c.grahamDiff}    thresholds={{ good: -10, bad: 20, higherIsBetter: false }} suffix="%" />
          <RatioCard label="Dividend Yield"  value={c.dividendYield} thresholds={{ good: 2, bad: 0.5, higherIsBetter: true }} indAvg={ia.dividendYield} suffix="%" />
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        {/* ── 4a. Revenue + profit trend ─────────────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Revenue &amp; Profit Growth</div>
            <span style={{ fontSize: 11, color: muted }}>YoY growth rates from CSV</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={[
                { name: '1Y', sales: c.salesGrowth, profit: c.profitGrowth },
                { name: '3Y', sales: c.salesGrowth3yr, profit: c.profitGrowth3yr },
                { name: '5Y', sales: c.salesGrowth5yr, profit: c.profitGrowth5yr },
                { name: 'QoQ', sales: c.qoqSales, profit: c.qoqProfits },
                { name: 'YoY Q', sales: c.yoyQSalesGrowth, profit: c.yoyQProfitGrowth },
              ]}
              margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: muted, fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fill: muted, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                formatter={(v) => v != null ? [`${Number(v).toFixed(1)}%`] : ['—']}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="sales"  name="Sales Growth"  fill="var(--primary)" radius={[3,3,0,0]} maxBarSize={28} />
              <Bar dataKey="profit" name="Profit Growth" fill="var(--accent)"  radius={[3,3,0,0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ── 4b. Margin trend ───────────────────────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Margin Trends</div>
            <span style={{ fontSize: 11, color: muted }}>OPM &amp; NPM — annual vs latest quarter</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={marginTrend}
              margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="period" tick={{ fill: muted, fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fill: muted, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                formatter={(v) => v != null ? [`${Number(v).toFixed(1)}%`] : ['—']}
              />
              <Bar dataKey="value" name="Margin %" radius={[3,3,0,0]} maxBarSize={36}>
                {marginTrend.map((entry, i) => (
                  <Cell key={i} fill={entry.period.startsWith('OPM') ? 'var(--positive)' : 'var(--primary)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="grid-2" style={{ gap: 8, marginTop: 12 }}>
            {[
              ['Sales (Annual ₹Cr)',   c.sales            != null ? `₹${Number(c.sales).toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr` : '—'],
              ['Op. Profit (₹Cr)',     c.operatingProfit  != null ? `₹${Number(c.operatingProfit).toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr` : '—'],
              ['PAT (Annual ₹Cr)',     c.pat              != null ? `₹${Number(c.pat).toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr` : '—'],
              ['Cash from Ops (₹Cr)', c.cashFromOps      != null ? `₹${Number(c.cashFromOps).toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr` : '—'],
            ].map(([l, v]) => (
              <div key={l} className="stat-row">
                <span className="stat-label">{l}</span>
                <span className="stat-val">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Price history chart ─────────────────────────────────────────────── */}
      {c.nseCode && (
        <div style={{ marginBottom: 16 }}>
          <PriceChartSection nseCode={c.nseCode} />
        </div>
      )}

      <div className="grid-2" style={{ marginBottom: 16 }}>
        {/* ── 7. Earnings surprise card ──────────────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Earnings Surprise</div>
            <SurpriseBadge yoyProfitGrowth={c.yoyQProfitGrowth} qoqProfits={c.qoqProfits} />
          </div>
          <div className="stat-row">
            <span className="stat-label">YoY Quarterly Profit Growth</span>
            <span className="stat-val">{fmtPct(c.yoyQProfitGrowth)}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">QoQ Profit Growth</span>
            <span className="stat-val">{fmtPct(c.qoqProfits)}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">YoY Quarterly Sales Growth</span>
            <span className="stat-val">{fmtPct(c.yoyQSalesGrowth)}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">QoQ Sales Growth</span>
            <span className="stat-val">{fmtPct(c.qoqSales)}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Latest Quarter Sales (₹Cr)</span>
            <span className="stat-val">{c.salesQ != null ? `₹${Number(c.salesQ).toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr` : '—'}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Latest Quarter PAT (₹Cr)</span>
            <span className="stat-val">{c.patQ != null ? `₹${Number(c.patQ).toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr` : '—'}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">OPM (Latest Quarter)</span>
            <span className="stat-val">{fmt(c.opmQ)}%</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">NPM (Latest Quarter)</span>
            <span className="stat-val">{fmt(c.npmQ)}%</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Last Result Date</span>
            <span className="stat-val">{c.lastResultDate ?? '—'}</span>
          </div>
        </div>

        {/* ── 8. Valuation signals ────────────────────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Valuation Signals</div>
            <span style={{ fontSize: 11, color: muted }}>Traffic-light system</span>
          </div>
          {valSignals.map(vs => (
            <ValuationLight key={vs.label} label={vs.label} condition={vs.condition} detail={vs.detail} />
          ))}
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div className="stat-row">
              <span className="stat-label">Upside to 52W High</span>
              <span className="stat-val">{fmtPct(c.upside52wHigh)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Return 1Y</span>
              <span className="stat-val">{fmtPct(c.return1yr)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Return 3Y</span>
              <span className="stat-val">{fmtPct(c.return3yr)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Return 5Y</span>
              <span className="stat-val">{fmtPct(c.return5yr)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">PE to 3Y avg PE</span>
              <span className="stat-val">{fmt(c.peTo3PE)}x</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">ROE to 3Y avg ROE</span>
              <span className="stat-val">{fmt(c.roeTo3ROE)}x</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 9. Google Sheet Advanced Panel (Composite Score + GrowthRadar + Jumps) */}
      {gsData && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <div>
              <div className="card-title">Advanced Signals — Google Sheet (104 cols)</div>
              <div style={{ fontSize: 11, color: muted }}>Composite Score · Growth Scores · Jump Signals · Momentum</div>
            </div>
            <a href="/advanced-screener" style={{ fontSize: 12, color: 'var(--accent)' }}>Full Screener →</a>
          </div>

          {/* Composite score + subscores strip */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            {[
              { label: 'Composite Score', val: gsData.compositeScore, max: 100, accent: 'var(--accent)' },
              { label: 'ROE Score',        val: gsData.roeScore,       max: 10,  accent: 'var(--primary)' },
              { label: 'Profit Gr Score',  val: gsData.profitGrScore,  max: 10,  accent: 'var(--positive)' },
              { label: 'Sales Gr Score',   val: gsData.salesGrScore,   max: 10,  accent: 'var(--positive)' },
              { label: 'Return Gr Score',  val: gsData.returnGrScore,  max: 10,  accent: 'var(--warning)' },
              { label: 'vs Market',        val: gsData.mktReturnComp,  max: null, accent: gsData.mktReturnComp >= 0 ? green : red },
            ].map(s => (
              <div key={s.label} style={{
                flex: '1 1 130px', minWidth: 120, background: 'var(--bg3)',
                borderRadius: 8, padding: '10px 14px', borderLeft: `3px solid ${s.accent}`,
              }}>
                <div style={{ fontSize: 10, color: muted, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.accent }}>
                  {s.val != null ? (s.max ? `${s.val.toFixed(0)}${s.max !== 100 ? '' : ''}` : `${s.val > 0 ? '+' : ''}${s.val.toFixed(1)}%`) : '—'}
                  {s.max && s.val != null && <span style={{ fontSize: 11, color: muted, fontWeight: 400 }}>/{s.max}</span>}
                </div>
              </div>
            ))}
          </div>

          <div className="grid-2" style={{ gap: 16 }}>
            {/* Growth Radar */}
            <div>
              <div style={{ fontSize: 12, color: muted, marginBottom: 8, fontWeight: 600 }}>Growth Score Radar</div>
              <GrowthRadar gs={gsData} />
            </div>

            {/* Jump Signals + Momentum */}
            <div>
              <div style={{ fontSize: 12, color: muted, marginBottom: 8, fontWeight: 600 }}>Jump Signals (Acceleration)</div>
              <JumpSignals gs={gsData} />
              <div style={{ fontSize: 12, color: muted, marginTop: 16, marginBottom: 4, fontWeight: 600 }}>QoQ / YoY Momentum</div>
              <MomentumRow gs={gsData} />
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                {[
                  ['Expected Annual Profit Gr', gsData.expectedGr],
                  ['PE to 3Y avg PE',  gsData.peTo3PE  != null ? `${gsData.peTo3PE.toFixed(2)}x` : '—'],
                  ['PE to 5Y avg PE',  gsData.peTo5PE  != null ? `${gsData.peTo5PE.toFixed(2)}x` : '—'],
                  ['ROE to 3Y avg ROE',gsData.roeTo3ROE != null ? `${gsData.roeTo3ROE.toFixed(2)}x` : '—'],
                  ['ROE to 5Y avg ROE',gsData.roeTo5ROE != null ? `${gsData.roeTo5ROE.toFixed(2)}x` : '—'],
                  ['ROE − P/E',        gsData.roePe    != null ? gsData.roePe.toFixed(2) : '—'],
                  ['PE/ROE',           gsData.peRoe    != null ? gsData.peRoe.toFixed(2) : '—'],
                  ['OPM Q-Y change',   gsData.opmQY    != null ? `${gsData.opmQY.toFixed(1)}%` : '—'],
                  ['NPM Q-Y change',   gsData.npmQY    != null ? `${gsData.npmQY.toFixed(1)}%` : '—'],
                ].map(([l, v]) => (
                  <div key={l} className="stat-row">
                    <span className="stat-label">{l}</span>
                    <span className="stat-val">{v ?? '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sankey link */}
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', textAlign: 'right' }}>
            <a href={`/sankey?ticker=${gsData.nseCode || symbol}`}
              style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
              📊 View Financial Flow (Sankey) →
            </a>
          </div>
        </div>
      )}

      {/* ── 5. Peer comparison table ────────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Peer Comparison — {c.industry}</div>
          <Link to="/compare" className="btn btn-ghost btn-sm">Full Comparison →</Link>
        </div>
        {peers.length === 0 ? (
          <div style={{ padding: 24, color: muted, textAlign: 'center' }}>No peers found in same industry</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Company</th>
                  <th style={{ textAlign: 'right' }}>Price ₹</th>
                  <th style={{ textAlign: 'right' }}>P/E</th>
                  <th style={{ textAlign: 'right' }}>ROE %</th>
                  <th style={{ textAlign: 'right' }}>OPM %</th>
                  <th style={{ textAlign: 'right' }}>D/E</th>
                  <th style={{ textAlign: 'right' }}>Piotroski</th>
                  <th style={{ textAlign: 'right' }}>Mkt Cap</th>
                </tr>
              </thead>
              <tbody>
                {/* Current stock first */}
                {[c, ...peers].map((p, i) => {
                  const isSelf = p.nseCode === c.nseCode
                  return (
                    <tr key={p.nseCode ?? i} style={isSelf ? { background: 'rgba(47,129,247,.08)' } : {}}>
                      <td>
                        <Link to={`/stock/${p.nseCode}`} className="sym"
                          style={{ color: isSelf ? 'var(--primary)' : 'var(--text)' }}>
                          {p.name}
                          {isSelf && <span style={{ fontSize: 10, marginLeft: 6, color: 'var(--primary)', fontWeight: 400 }}>◀ current</span>}
                        </Link>
                      </td>
                      <td style={{ textAlign: 'right' }}>{p.currentPrice != null ? `₹${Number(p.currentPrice).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—'}</td>
                      <td style={{ textAlign: 'right' }}>{fmt(p.pe)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <span className={(p.roe ?? 0) >= 15 ? 'metric-pos' : (p.roe ?? 0) >= 10 ? '' : 'metric-neg'}>{fmt(p.roe)}%</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>{fmt(p.opm)}%</td>
                      <td style={{ textAlign: 'right' }}>{fmt(p.debtToEquity)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <span className={(p.piotroskiScore ?? 0) >= 7 ? 'metric-pos' : (p.piotroskiScore ?? 0) >= 4 ? '' : 'metric-neg'}>
                          {p.piotroskiScore ?? '—'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontSize: 12 }}>{fmtCr(p.marketCap)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
