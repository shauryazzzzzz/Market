import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { Loading, ErrorBox, fmt, fmtPct, fmtCr, Signal, GradeBadge } from '../components/shared'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const METRICS = [
  { key: 'roe',           label: 'Return on Equity' },
  { key: 'profitGrowth',  label: 'Profit Growth %' },
  { key: 'salesGrowth',   label: 'Sales Growth %' },
  { key: 'piotroskiScore', label: 'Piotroski Score' },
  { key: 'opm',           label: 'Operating Margin %' },
]

const TT_STYLE = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }

// ── Helpers ────────────────────────────────────────────────────────────────────

function n(v, decimals = 1) {
  if (v == null) return '—'
  return Number(v).toFixed(decimals)
}

function pct(v) {
  if (v == null) return '—'
  const num = Number(v)
  return <span className={num >= 0 ? 'metric-pos' : 'metric-neg'}>{num >= 0 ? '+' : ''}{num.toFixed(1)}%</span>
}

function pctPlain(v) {
  if (v == null) return '—'
  const num = Number(v)
  return `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`
}

/** Three-period trend spark: renders values for 5Y/3Y/1Y as coloured pills */
function TrendPills({ v5, v3, v1, suffix = '%' }) {
  const periods = [
    { label: '5Y', val: v5 },
    { label: '3Y', val: v3 },
    { label: '1Y', val: v1 },
  ]
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {periods.map(({ label, val }) => (
        <div key={label} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          background: 'var(--bg3)', borderRadius: 6, padding: '4px 10px', minWidth: 54,
        }}>
          <span style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>{label}</span>
          <span style={{
            fontSize: 13, fontWeight: 700,
            color: val == null ? 'var(--muted)' : Number(val) >= 0 ? 'var(--positive)' : 'var(--negative)',
          }}>
            {val != null ? `${Number(val).toFixed(1)}${suffix}` : '—'}
          </span>
        </div>
      ))}
    </div>
  )
}

/** Inline mini bar chart for a trend array [{label, value}] */
function MiniBar({ data, suffix = '%', height = 80 }) {
  if (!data || data.length === 0) return <span style={{ color: 'var(--muted)', fontSize: 12 }}>No data</span>
  const chartData = data.map(p => ({ name: p.label, value: p.value }))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ top: 2, right: 0, left: -20, bottom: 0 }}>
        <XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `${v?.toFixed(0)}${suffix}`} />
        <Tooltip contentStyle={TT_STYLE} formatter={v => [`${v?.toFixed(1)}${suffix}`, '']} />
        <Bar dataKey="value" radius={[3, 3, 0, 0]}>
          {chartData.map((e, i) => (
            <Cell key={i} fill={(e.value ?? 0) >= 0 ? 'var(--positive)' : 'var(--negative)'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Section header with a label separator */
function RatioGroupHeader({ label }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      marginBottom: 10, marginTop: 4,
    }}>
      <span style={{
        fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '.7px', color: 'var(--muted)', whiteSpace: 'nowrap',
      }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  )
}

/** A single labelled ratio row with historical values + optional trend pills */
function RatioRow({ label, currentLabel, current, pills, note }) {
  return (
    <div className="stat-row" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 6, paddingBottom: 8, borderBottom: '1px solid var(--border)', marginBottom: 2 }}>
      <div style={{ minWidth: 180, flex: '0 0 180px' }}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{label}</div>
        {note && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{note}</div>}
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
        {currentLabel && (
          <div style={{ minWidth: 80 }}>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>Current</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{current}</div>
          </div>
        )}
        {pills}
      </div>
    </div>
  )
}

/** Relative valuation row: PE vs 3/5/7 yr avg */
function RelValRow({ label, v3, v5, v7, note }) {
  const fmt1 = (v) => {
    if (v == null) return '—'
    const n = Number(v)
    const cls = n < 90 ? 'metric-pos' : n > 115 ? 'metric-neg' : ''
    return <span className={cls}>{n.toFixed(0)}%</span>
  }
  return (
    <div className="stat-row" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 6, paddingBottom: 8, borderBottom: '1px solid var(--border)', marginBottom: 2 }}>
      <div style={{ minWidth: 180, flex: '0 0 180px' }}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{label}</div>
        {note && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{note}</div>}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {[['vs 3Y avg', v3], ['vs 5Y avg', v5], ['vs 7Y avg', v7]].map(([lbl, val]) => (
          <div key={lbl} style={{ background: 'var(--bg3)', borderRadius: 6, padding: '4px 10px', minWidth: 80, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>{lbl}</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{fmt1(val)}</div>
          </div>
        ))}
        <div style={{ fontSize: 11, color: 'var(--muted)', alignSelf: 'center' }}>100% = at avg · &lt;100% = cheap · &gt;100% = expensive</div>
      </div>
    </div>
  )
}

// ── Full company detail ─────────────────────────────────────────────────────────

function CompanyDetail({ data }) {
  if (!data) return null
  const { company: c, grade, revenueTrend, profitTrend, marginTrend, aiSummary } = data

  // Build chart data for bars
  const salesChart  = revenueTrend?.map(p => ({ name: p.label, value: p.value })) || []
  const profitChart = profitTrend?.map(p => ({ name: p.label, value: p.value })) || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Header card ─────────────────────────────────────────────────────── */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <GradeBadge grade={grade.grade} />
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{c.name}</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>{c.nseCode} · {c.industry}</div>
            <div style={{ marginTop: 6, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Signal rating={grade.rating} />
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Score {grade.score}/{grade.maxScore}</span>
              {c.piotroskiScore != null && <span style={{ fontSize: 12, color: 'var(--muted)' }}>Piotroski {c.piotroskiScore}/9</span>}
              {c.lastResultDate && <span style={{ fontSize: 12, color: 'var(--muted)' }}>Last result: {c.lastResultDate}</span>}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 700, fontSize: 22 }}>₹{c.currentPrice?.toFixed(2) ?? '—'}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{fmtCr(c.marketCap)}</div>
          </div>
        </div>

        {/* AI Summary */}
        {aiSummary && (
          <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(47,129,247,.08)', borderRadius: 8, borderLeft: '3px solid var(--primary)', fontSize: 13, lineHeight: 1.6 }}>
            💡 {aiSummary}
          </div>
        )}

        {/* Grade reasons */}
        {grade.reasons?.length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {grade.reasons.map((r, i) => (
              <span key={i} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 4, background: 'rgba(63,185,80,.12)', color: 'var(--positive)' }}>✓ {r}</span>
            ))}
          </div>
        )}
        {grade.warnings?.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {grade.warnings.map((w, i) => (
              <span key={i} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 4, background: 'rgba(248,81,73,.1)', color: 'var(--negative)' }}>⚠ {w}</span>
            ))}
          </div>
        )}
      </div>

      {/* ── Snapshot metrics grid ────────────────────────────────────────────── */}
      <div className="grid-4">
        {[
          ['P/E',        c.pe?.toFixed(1)     ?? '—'],
          ['P/B',        c.pb?.toFixed(1)     ?? '—'],
          ['PEG',        c.pegRatio?.toFixed(2)?? '—'],
          ['EV/EBITDA',  c.evEbitda?.toFixed(1)?? '—'],
          ['ROE (1Y)',   c.roe != null        ? `${c.roe.toFixed(1)}%`        : '—'],
          ['ROE (3Y)',   c.roe3yr != null     ? `${c.roe3yr.toFixed(1)}%`     : '—'],
          ['ROE (5Y)',   c.roe5yr != null     ? `${c.roe5yr.toFixed(1)}%`     : '—'],
          ['OPM',        c.opm != null        ? `${c.opm.toFixed(1)}%`        : '—'],
          ['NPM',        c.npm != null        ? `${c.npm.toFixed(1)}%`        : '—'],
          ['D/E',        c.debtToEquity?.toFixed(2) ?? '—'],
          ['Div Yield',  c.dividendYield != null ? `${c.dividendYield.toFixed(1)}%` : '—'],
          ['Promoter',   c.promoterHolding != null ? `${c.promoterHolding.toFixed(1)}%` : '—'],
          ['FII',        c.fiiHolding != null ? `${c.fiiHolding.toFixed(1)}%` : '—'],
          ['DII',        c.diiHolding != null ? `${c.diiHolding.toFixed(1)}%` : '—'],
          ['Graham Diff',c.grahamDiff != null ? `${c.grahamDiff.toFixed(1)}%`  : '—'],
          ['Piotroski',  c.piotroskiScore != null ? `${c.piotroskiScore}/9`    : '—'],
        ].map(([label, val]) => (
          <div className="card" key={label} style={{ padding: '12px 14px' }}>
            <div className="card-label">{label}</div>
            <div style={{ fontWeight: 700, fontSize: 17, marginTop: 4 }}>{val}</div>
          </div>
        ))}
      </div>

      {/* ── Sales Growth & Profit Growth trend charts ─────────────────────── */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-label">Revenue</div>
              <div className="card-title">Sales Growth Trend</div>
            </div>
          </div>
          {salesChart.length > 0
            ? <MiniBar data={salesChart} suffix="%" height={120} />
            : <div className="loading" style={{ height: 120 }}>No trend data</div>}
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-label">Earnings</div>
              <div className="card-title">Profit Growth Trend</div>
            </div>
          </div>
          {profitChart.length > 0
            ? <MiniBar data={profitChart} suffix="%" height={120} />
            : <div className="loading" style={{ height: 120 }}>No trend data</div>}
        </div>
      </div>

      {/* ── Historical Ratios Comparison ─────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-label">Historical Ratios</div>
            <div className="card-title">All Key Financial Ratios — Multi-Period Comparison</div>
          </div>
        </div>

        {/* PROFITABILITY ─────────────────────────────────────────────────────── */}
        <RatioGroupHeader label="Profitability & Returns" />

        <RatioRow
          label="Return on Equity (ROE)"
          currentLabel="1Y"
          current={c.roe != null ? `${n(c.roe)}%` : '—'}
          note="Net profit ÷ shareholders' equity"
          pills={<TrendPills v5={c.roe5yr} v3={c.roe3yr} v1={c.roe} suffix="%" />}
        />

        <RatioRow
          label="Operating Profit Margin (OPM)"
          currentLabel="Annual"
          current={c.opm != null ? `${n(c.opm)}%` : '—'}
          note={`Latest Q: ${c.opmQ != null ? n(c.opmQ) + '%' : '—'} · Trend: ${marginTrend?.direction ?? '—'}`}
          pills={
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[['Annual', c.opm], ['Latest Q', c.opmQ]].map(([lbl, val]) => (
                <div key={lbl} style={{ background: 'var(--bg3)', borderRadius: 6, padding: '4px 10px', minWidth: 72, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>{lbl}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: val == null ? 'var(--muted)' : 'var(--text)' }}>
                    {val != null ? `${n(val)}%` : '—'}
                  </div>
                </div>
              ))}
              {marginTrend?.direction && (
                <div style={{
                  alignSelf: 'center', fontSize: 12, fontWeight: 600,
                  color: marginTrend.direction === 'expanding' ? 'var(--positive)'
                       : marginTrend.direction === 'compressing' ? 'var(--negative)' : 'var(--muted)',
                }}>
                  {marginTrend.direction === 'expanding' ? '▲ Expanding' : marginTrend.direction === 'compressing' ? '▼ Compressing' : '— Stable'}
                </div>
              )}
            </div>
          }
        />

        <RatioRow
          label="Net Profit Margin (NPM)"
          currentLabel="Annual"
          current={c.npm != null ? `${n(c.npm)}%` : '—'}
          note={`Latest Q: ${c.npmQ != null ? n(c.npmQ) + '%' : '—'}`}
          pills={
            <div style={{ display: 'flex', gap: 6 }}>
              {[['Annual', c.npm], ['Latest Q', c.npmQ]].map(([lbl, val]) => (
                <div key={lbl} style={{ background: 'var(--bg3)', borderRadius: 6, padding: '4px 10px', minWidth: 72, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>{lbl}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: val == null ? 'var(--muted)' : 'var(--text)' }}>
                    {val != null ? `${n(val)}%` : '—'}
                  </div>
                </div>
              ))}
            </div>
          }
        />

        <RatioRow
          label="Operating Profit Growth"
          currentLabel="Annual"
          current={c.opGrowth != null ? `${n(c.opGrowth)}%` : '—'}
          note="YoY change in EBIT"
          pills={null}
        />

        {/* GROWTH ─────────────────────────────────────────────────────────────── */}
        <RatioGroupHeader label="Growth" />

        <RatioRow
          label="Profit After Tax (PAT) Growth"
          currentLabel="TTM"
          current={c.profitGrowth != null ? `${n(c.profitGrowth)}%` : '—'}
          note="Profit after tax year-over-year change"
          pills={<TrendPills v5={c.profitGrowth5yr} v3={c.profitGrowth3yr} v1={c.profitGrowth} suffix="%" />}
        />

        <RatioRow
          label="Sales / Revenue Growth"
          currentLabel="TTM"
          current={c.salesGrowth != null ? `${n(c.salesGrowth)}%` : '—'}
          note="Revenue year-over-year change"
          pills={<TrendPills v5={c.salesGrowth5yr} v3={c.salesGrowth3yr} v1={c.salesGrowth} suffix="%" />}
        />

        <RatioRow
          label="Quarterly Profit (YoY)"
          currentLabel="Latest Q"
          current={c.yoyQProfitGrowth != null ? `${n(c.yoyQProfitGrowth)}%` : '—'}
          note={`QoQ: ${c.qoqProfits != null ? n(c.qoqProfits) + '%' : '—'}`}
          pills={
            <div style={{ display: 'flex', gap: 6 }}>
              {[['YoY', c.yoyQProfitGrowth], ['QoQ', c.qoqProfits]].map(([lbl, val]) => (
                <div key={lbl} style={{ background: 'var(--bg3)', borderRadius: 6, padding: '4px 10px', minWidth: 72, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>{lbl}</div>
                  <div style={{
                    fontSize: 13, fontWeight: 700,
                    color: val == null ? 'var(--muted)' : val >= 0 ? 'var(--positive)' : 'var(--negative)',
                  }}>
                    {val != null ? `${val >= 0 ? '+' : ''}${n(val)}%` : '—'}
                  </div>
                </div>
              ))}
              {grade.earningsSurprise && (
                <div style={{
                  alignSelf: 'center', padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                  background: grade.earningsSurprise === 'beat' ? 'rgba(63,185,80,.15)'
                            : grade.earningsSurprise === 'miss' ? 'rgba(248,81,73,.12)' : 'rgba(139,148,158,.12)',
                  color: grade.earningsSurprise === 'beat' ? 'var(--positive)'
                       : grade.earningsSurprise === 'miss' ? 'var(--negative)' : 'var(--muted)',
                }}>{grade.earningsSurprise}</div>
              )}
            </div>
          }
        />

        <RatioRow
          label="Quarterly Sales (YoY)"
          currentLabel="Latest Q"
          current={c.yoyQSalesGrowth != null ? `${n(c.yoyQSalesGrowth)}%` : '—'}
          note={`QoQ: ${c.qoqSales != null ? n(c.qoqSales) + '%' : '—'}`}
          pills={
            <div style={{ display: 'flex', gap: 6 }}>
              {[['YoY', c.yoyQSalesGrowth], ['QoQ', c.qoqSales]].map(([lbl, val]) => (
                <div key={lbl} style={{ background: 'var(--bg3)', borderRadius: 6, padding: '4px 10px', minWidth: 72, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>{lbl}</div>
                  <div style={{
                    fontSize: 13, fontWeight: 700,
                    color: val == null ? 'var(--muted)' : val >= 0 ? 'var(--positive)' : 'var(--negative)',
                  }}>
                    {val != null ? `${val >= 0 ? '+' : ''}${n(val)}%` : '—'}
                  </div>
                </div>
              ))}
            </div>
          }
        />

        {/* PRICE RETURNS ──────────────────────────────────────────────────────── */}
        <RatioGroupHeader label="Price Returns" />

        <RatioRow
          label="Stock Price Return"
          currentLabel="1Y"
          current={c.return1yr != null ? `${n(c.return1yr)}%` : '—'}
          note="Absolute price return over period"
          pills={
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[['3M', c.return3m], ['6M', c.return6m], ['1Y', c.return1yr], ['3Y', c.return3yr], ['5Y', c.return5yr]].map(([lbl, val]) => (
                <div key={lbl} style={{ background: 'var(--bg3)', borderRadius: 6, padding: '4px 10px', minWidth: 54, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>{lbl}</div>
                  <div style={{
                    fontSize: 13, fontWeight: 700,
                    color: val == null ? 'var(--muted)' : val >= 0 ? 'var(--positive)' : 'var(--negative)',
                  }}>
                    {val != null ? `${val >= 0 ? '+' : ''}${n(val)}%` : '—'}
                  </div>
                </div>
              ))}
            </div>
          }
        />

        {/* LEVERAGE ───────────────────────────────────────────────────────────── */}
        <RatioGroupHeader label="Leverage & Balance Sheet" />

        <RatioRow
          label="Debt to Equity (D/E)"
          currentLabel="Current"
          current={c.debtToEquity?.toFixed(2) ?? '—'}
          note="Lower is better · &lt;0.3 = strong · &gt;1.5 = high"
          pills={
            <div style={{
              padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
              background: c.debtToEquity == null ? 'var(--bg3)'
                : c.debtToEquity < 0.3 ? 'rgba(63,185,80,.12)' : c.debtToEquity > 1.5 ? 'rgba(248,81,73,.12)' : 'rgba(210,153,34,.12)',
              color: c.debtToEquity == null ? 'var(--muted)'
                : c.debtToEquity < 0.3 ? 'var(--positive)' : c.debtToEquity > 1.5 ? 'var(--negative)' : 'var(--warning)',
            }}>
              {c.debtToEquity == null ? '—'
                : c.debtToEquity < 0.3 ? '✓ Low Debt' : c.debtToEquity > 1.5 ? '⚠ High Debt' : '~ Moderate'}
            </div>
          }
        />

        <RatioRow
          label="Cash from Operations"
          currentLabel="Annual"
          current={c.cashFromOps != null ? `₹${Number(c.cashFromOps).toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr` : '—'}
          note="Positive = cash-generative business"
          pills={
            c.cashFromOps != null ? (
              <div style={{
                padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                background: c.cashFromOps > 0 ? 'rgba(63,185,80,.12)' : 'rgba(248,81,73,.1)',
                color: c.cashFromOps > 0 ? 'var(--positive)' : 'var(--negative)',
              }}>
                {c.cashFromOps > 0 ? '✓ Positive Cash Flow' : '⚠ Negative Cash Flow'}
              </div>
            ) : null
          }
        />

        {/* VALUATION ──────────────────────────────────────────────────────────── */}
        <RatioGroupHeader label="Valuation" />

        <RatioRow
          label="Price / Earnings (P/E)"
          currentLabel="Current"
          current={c.pe?.toFixed(1) ?? '—'}
          note={`Industry P/E: ${c.peToIndustry?.toFixed(1) ?? '—'} · PEG: ${c.pegRatio?.toFixed(2) ?? '—'}`}
          pills={
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[['P/E', c.pe], ['P/B', c.pb], ['P/S', c.priceToSales], ['EV/EBITDA', c.evEbitda]].map(([lbl, val]) => (
                <div key={lbl} style={{ background: 'var(--bg3)', borderRadius: 6, padding: '4px 10px', minWidth: 72, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>{lbl}</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{val != null ? n(val, 1) : '—'}</div>
                </div>
              ))}
            </div>
          }
        />

        <RatioRow
          label="Graham Intrinsic Value"
          currentLabel="Diff %"
          current={c.grahamDiff != null ? `${n(c.grahamDiff)}%` : '—'}
          note="Negative = below Graham price (undervalued); Positive = above"
          pills={
            c.grahamDiff != null ? (
              <div style={{
                padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                background: c.grahamDiff < 0 ? 'rgba(63,185,80,.12)' : 'rgba(248,81,73,.1)',
                color: c.grahamDiff < 0 ? 'var(--positive)' : 'var(--negative)',
              }}>
                {c.grahamDiff < 0 ? `✓ ${Math.abs(c.grahamDiff).toFixed(0)}% below Graham — Undervalued` : `${c.grahamDiff.toFixed(0)}% above Graham value`}
              </div>
            ) : null
          }
        />

        {/* RELATIVE VALUATION ────────────────────────────────────────────────── */}
        <RatioGroupHeader label="Relative to Historical Averages" />

        <RelValRow
          label="P/E vs Historical P/E"
          v3={c.peTo3PE}
          v5={c.peTo5PE}
          v7={c.peTo7PE}
          note="Current PE expressed as % of 3/5/7-year average PE"
        />

        <RelValRow
          label="ROE vs Historical ROE"
          v3={c.roeTo3ROE}
          v5={c.roeTo5ROE}
          v7={c.roeTo7ROE}
          note="Current ROE expressed as % of 3/5/7-year average ROE"
        />

        {/* SHAREHOLDING ───────────────────────────────────────────────────────── */}
        <RatioGroupHeader label="Shareholding Pattern" />

        <RatioRow
          label="Shareholding Pattern"
          currentLabel={null}
          current={null}
          note="As of latest disclosure"
          pills={
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                ['Promoter', c.promoterHolding],
                ['FII',      c.fiiHolding],
                ['DII',      c.diiHolding],
                ['Public',   c.publicHolding],
              ].map(([lbl, val]) => (
                <div key={lbl} style={{ background: 'var(--bg3)', borderRadius: 6, padding: '4px 10px', minWidth: 72, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>{lbl}</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{val != null ? `${n(val)}%` : '—'}</div>
                </div>
              ))}
            </div>
          }
        />

        {/* QUARTERLY SNAPSHOT ─────────────────────────────────────────────────── */}
        <RatioGroupHeader label="Latest Quarter Snapshot" />

        <RatioRow
          label="Revenue (Quarterly)"
          currentLabel="Latest Q"
          current={c.salesQ != null ? `₹${Number(c.salesQ).toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr` : '—'}
          note={`YoY: ${c.yoyQSalesGrowth != null ? n(c.yoyQSalesGrowth) + '%' : '—'} · QoQ: ${c.qoqSales != null ? n(c.qoqSales) + '%' : '—'}`}
          pills={null}
        />

        <RatioRow
          label="PAT (Quarterly)"
          currentLabel="Latest Q"
          current={c.patQ != null ? `₹${Number(c.patQ).toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr` : '—'}
          note={`YoY: ${c.yoyQProfitGrowth != null ? n(c.yoyQProfitGrowth) + '%' : '—'} · QoQ: ${c.qoqProfits != null ? n(c.qoqProfits) + '%' : '—'}`}
          pills={null}
        />

        <RatioRow
          label="OPM (Quarterly)"
          currentLabel="Latest Q"
          current={c.opmQ != null ? `${n(c.opmQ)}%` : '—'}
          note={`Annual OPM: ${c.opm != null ? n(c.opm) + '%' : '—'}`}
          pills={null}
        />

        <RatioRow
          label="NPM (Quarterly)"
          currentLabel="Latest Q"
          current={c.npmQ != null ? `${n(c.npmQ)}%` : '—'}
          note={`Annual NPM: ${c.npm != null ? n(c.npm) + '%' : '—'}`}
          pills={null}
        />

        {/* DIVIDEND ───────────────────────────────────────────────────────────── */}
        <RatioGroupHeader label="Income" />

        <RatioRow
          label="Dividend Yield"
          currentLabel="Current"
          current={c.dividendYield != null ? `${n(c.dividendYield)}%` : '—'}
          note="Annual dividend / current price"
          pills={null}
        />

      </div>
      {/* end Historical Ratios card */}

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
