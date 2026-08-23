/**
 * SankeyPage.jsx — SankeyMATIC-style Financial Flow Diagram
 * Route: /sankey?ticker=TCS
 *
 * Architecture:
 *   1. Ticker selector  — searchable multi-select from /api/gs/tickers (all 1,113 companies)
 *   2. Data layer       — /api/gs/sankey-data?q=<nseCode> → { revenue, opExpenses, opProfit,
 *                         taxAndInterest, pat, dividends, retained, cashOps, capex, fcf, … }
 *   3. Sankey renderer  — pure SVG, no external Sankey library.
 *                         Uses iterative node placement and cubic-bezier link paths.
 *   4. Modes:
 *        "absolute"  — raw ₹ Cr values (default)
 *        "percent"   — everything normalised to Revenue = 100%  (overlay comparison)
 *   5. DummyDataBanner  — shown when all flow values are null/zero
 *
 * Flow mapping (income-statement waterfall):
 *   Revenue ──► Operating Expenses [revenue - opProfit]
 *   Revenue ──► Operating Profit   [opProfit]
 *   Operating Profit ──► Tax & Interest  [opProfit - pat]
 *   Operating Profit ──► PAT            [pat]
 *   PAT ──► Dividends  [dividends]  (if > 0)
 *   PAT ──► Retained   [retained]
 *   PAT ──► Cash Ops   [cashOps]    (if > 0 and separate from retained)
 *
 * Note: GS sheet has no dedicated Gross Profit / COGS / Interest / Tax split columns.
 * We derive: opExpenses = revenue − opProfit; taxAndInterest = opProfit − pat.
 * If a field is null it is omitted from the chart (no broken flows).
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { Loading, ErrorBox } from '../components/shared'
import DummyDataBanner from '../components/DummyDataBanner'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const MAX_TICKERS = 4

// Per-ticker accent colours
const TICKER_COLORS = ['#2f81f7', '#a371f7', '#3fb950', '#d29922']

// Node fill colours keyed by node id
const NODE_COLORS = {
  revenue:        '#2f81f7',
  opExpenses:     '#8b949e',
  opProfit:       '#3fb950',
  taxAndInterest: '#f85149',
  pat:            '#a371f7',
  dividends:      '#d29922',
  retained:       '#2f81f7',
  cashOps:        '#58a6ff',
  capex:          '#e3b341',
  fcf:            '#3fb950',
}

const NODE_LABELS = {
  revenue:        'Revenue',
  opExpenses:     'Op. Expenses',
  opProfit:       'Op. Profit',
  taxAndInterest: 'Tax & Interest',
  pat:            'PAT',
  dividends:      'Dividends',
  retained:       'Retained',
  cashOps:        'Cash from Ops',
  capex:          'CapEx',
  fcf:            'Free Cash Flow',
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting helpers
// ─────────────────────────────────────────────────────────────────────────────
function fmtCr(v, pctBase) {
  if (v == null) return '—'
  if (pctBase != null && pctBase > 0) return `${((v / pctBase) * 100).toFixed(1)}%`
  if (Math.abs(v) >= 100000) return `₹${(v / 100000).toFixed(1)}L Cr`
  if (Math.abs(v) >= 1000)   return `₹${(v / 1000).toFixed(1)}K Cr`
  return `₹${v.toFixed(0)} Cr`
}

function fmtPct(v) {
  if (v == null) return '—'
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}%`
}

// ─────────────────────────────────────────────────────────────────────────────
// Build the list of Sankey nodes + links from the API data object
// Returns: { nodes: [{id, label, color, value}], links: [{source, target, value, color}] }
// ─────────────────────────────────────────────────────────────────────────────
function buildFlows(data, mode) {
  const base = mode === 'percent' ? (data.revenue || 1) : null

  // Normalise a value (absolute or percentage of revenue)
  const val = (v) => {
    if (v == null || v <= 0) return null
    return base ? (v / base) * 100 : v
  }

  // Raw data; all in ₹ Cr
  const revenue        = val(data.revenue)
  const opExpenses     = val(data.opExpenses)
  const opProfit       = val(data.opProfit)
  const taxAndInterest = val(data.taxAndInterest)
  const pat            = val(data.pat)
  const dividends      = val(data.dividends)
  const retained       = val(data.retained)
  // Cash flow branch — only if cashOps is separate from retained
  const cashOps        = (data.cashOps != null && data.cashOps > 0) ? val(data.cashOps) : null
  const capex          = val(data.capex)
  const fcf            = val(data.fcf)

  const nodes = []
  const links = []
  const addNode = (id, v) => { if (v != null) nodes.push({ id, label: NODE_LABELS[id], color: NODE_COLORS[id], value: v }) }
  const addLink = (src, tgt, v, color) => { if (v != null && v > 0) links.push({ source: src, target: tgt, value: v, color }) }

  // Level 0: Revenue
  addNode('revenue', revenue)

  // Level 1: Revenue splits
  addNode('opExpenses', opExpenses)
  addNode('opProfit', opProfit)
  addLink('revenue', 'opExpenses', opExpenses, NODE_COLORS.opExpenses + 'aa')
  addLink('revenue', 'opProfit',   opProfit,   NODE_COLORS.opProfit   + 'aa')

  // Level 2: Op Profit splits
  addNode('taxAndInterest', taxAndInterest)
  addNode('pat', pat)
  addLink('opProfit', 'taxAndInterest', taxAndInterest, NODE_COLORS.taxAndInterest + 'aa')
  addLink('opProfit', 'pat',            pat,            NODE_COLORS.pat            + 'aa')

  // Level 3: PAT splits
  if (dividends != null) {
    addNode('dividends', dividends)
    addLink('pat', 'dividends', dividends, NODE_COLORS.dividends + 'aa')
  }
  if (retained != null) {
    addNode('retained', retained)
    addLink('pat', 'retained', retained, NODE_COLORS.retained + 'aa')
  }

  // Cash flow branch (separate from PAT split if available)
  if (cashOps != null && !dividends && !retained) {
    addNode('cashOps', cashOps)
    addLink('pat', 'cashOps', cashOps, NODE_COLORS.cashOps + 'aa')
  }
  if (fcf != null && fcf !== cashOps) {
    addNode('fcf', fcf)
    // CapEx node
    if (capex != null) {
      addNode('capex', capex)
      addLink('cashOps', 'capex', capex, NODE_COLORS.capex + 'aa')
      addLink('cashOps', 'fcf',   fcf,   NODE_COLORS.fcf   + 'aa')
    }
  }

  return { nodes, links }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure-SVG Sankey layout engine
//
// Columns are assigned by BFS level from 'revenue'.
// Node height = proportional to value.
// Links are cubic-bezier paths with width proportional to flow value.
// ─────────────────────────────────────────────────────────────────────────────
function layoutSankey(nodes, links, svgW, svgH) {
  if (!nodes.length) return { posNodes: [], posLinks: [] }

  const NODE_W   = 20
  const V_PAD    = 10  // vertical padding between nodes in the same column
  const H_PAD    = 0   // horizontal padding at edges

  // Assign columns by BFS from revenue
  const colMap = {}
  const adjOut = {}
  nodes.forEach(n => { colMap[n.id] = -1; adjOut[n.id] = [] })
  links.forEach(l => { if (adjOut[l.source]) adjOut[l.source].push(l.target) })

  // Find root (revenue or first node)
  const root = nodes.find(n => n.id === 'revenue') || nodes[0]
  colMap[root.id] = 0
  const queue = [root.id]
  while (queue.length) {
    const cur = queue.shift()
    ;(adjOut[cur] || []).forEach(tgt => {
      if (colMap[tgt] === -1 || colMap[tgt] < colMap[cur] + 1) {
        colMap[tgt] = colMap[cur] + 1
        queue.push(tgt)
      }
    })
  }
  // Any unvisited nodes: put in last col
  nodes.forEach(n => { if (colMap[n.id] === -1) colMap[n.id] = 3 })

  const numCols = Math.max(...Object.values(colMap)) + 1
  const colW    = (svgW - H_PAD * 2 - NODE_W) / Math.max(numCols - 1, 1)

  // Group nodes by column
  const byCol = {}
  nodes.forEach(n => {
    const c = colMap[n.id]
    if (!byCol[c]) byCol[c] = []
    byCol[c].push(n)
  })

  // Total value in each col (for scaling)
  const colTotals = {}
  Object.entries(byCol).forEach(([c, ns]) => {
    colTotals[c] = ns.reduce((s, n) => s + (n.value || 0), 0)
  })

  // Scale factor: use max column total to fill available height
  const usableH    = svgH - V_PAD * (nodes.length + 2)
  const maxTotal   = Math.max(...Object.values(colTotals), 1)
  const scaleFactor = usableH / maxTotal

  // Position nodes within each column
  const posNodes = {}
  Object.entries(byCol).forEach(([c, ns]) => {
    const x    = H_PAD + parseInt(c) * colW
    let   yOff = V_PAD
    ns.forEach(n => {
      const h = Math.max((n.value || 0) * scaleFactor, 6)
      posNodes[n.id] = { ...n, x, y: yOff, w: NODE_W, h, col: parseInt(c) }
      yOff += h + V_PAD
    })
  })

  // Build link paths with offsets (track outgoing/incoming offset per node)
  const outOffset = {}  // how far down the right edge of source node we've drawn
  const inOffset  = {}  // how far down the left edge of target node we've drawn
  nodes.forEach(n => { outOffset[n.id] = 0; inOffset[n.id] = 0 })

  const posLinks = links
    .filter(l => posNodes[l.source] && posNodes[l.target] && l.value > 0)
    .map(l => {
      const src = posNodes[l.source]
      const tgt = posNodes[l.target]
      const lh  = Math.max(l.value * scaleFactor, 2)  // link height

      const x0 = src.x + src.w
      const x1 = tgt.x
      const y0 = src.y + outOffset[l.source]
      const y1 = tgt.y + inOffset[l.target]
      const cx = (x0 + x1) / 2

      const path = [
        `M ${x0} ${y0}`,
        `C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`,
        `L ${x1} ${y1 + lh}`,
        `C ${cx} ${y1 + lh}, ${cx} ${y0 + lh}, ${x0} ${y0 + lh}`,
        'Z',
      ].join(' ')

      outOffset[l.source] += lh
      inOffset[l.target]  += lh

      return { ...l, path, x0, y0, x1, y1, lh }
    })

  return { posNodes: Object.values(posNodes), posLinks }
}

// ─────────────────────────────────────────────────────────────────────────────
// Single SankeyDiagram component — renders one ticker's chart
// ─────────────────────────────────────────────────────────────────────────────
function SankeyDiagram({ result, mode, accentColor, svgW = 780, svgH = 320 }) {
  const { ticker, name, industry, lastResult, data } = result

  const { nodes, links } = useMemo(() => buildFlows(data, mode), [data, mode])

  // Detect empty / all-null data
  const hasData = nodes.some(n => n.value > 0)

  const { posNodes, posLinks } = useMemo(
    () => layoutSankey(nodes, links, svgW, svgH),
    [nodes, links, svgW, svgH]
  )

  // Tooltip state
  const [tooltip, setTooltip] = useState(null)

  const base = mode === 'percent' ? (data.revenue || 1) : null

  return (
    <div style={{
      background: 'var(--bg2)', border: `2px solid ${accentColor}44`,
      borderRadius: 12, overflow: 'hidden',
    }}>
      {/* Panel header */}
      <div style={{
        padding: '12px 18px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
      }}>
        <div>
          <span style={{ fontWeight: 800, fontSize: 16, color: accentColor }}>{ticker}</span>
          <span style={{ fontSize: 13, color: 'var(--muted)', marginLeft: 8 }}>{name}</span>
          <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>· {industry}</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
          {lastResult ? `Period: ${lastResult}` : 'Annual P&L'}
          {mode === 'percent' && <span style={{ marginLeft: 8, color: 'var(--warning)', fontWeight: 600 }}>% of Revenue</span>}
        </div>
      </div>

      {/* DummyDataBanner if no real data */}
      <DummyDataBanner show={!hasData} />

      {hasData ? (
        <div style={{ position: 'relative', padding: '8px 4px' }}>
          <svg
            viewBox={`0 0 ${svgW} ${svgH}`}
            style={{ width: '100%', height: 'auto', maxHeight: svgH, overflow: 'visible', display: 'block' }}
          >
            {/* Links (flows) */}
            {posLinks.map((l, i) => (
              <path
                key={i}
                d={l.path}
                fill={l.color}
                opacity={0.5}
                style={{ cursor: 'default' }}
                onMouseEnter={(e) => setTooltip({
                  x: e.clientX, y: e.clientY,
                  label: `${NODE_LABELS[l.source]} → ${NODE_LABELS[l.target]}`,
                  value: fmtCr(l.value * (base ? (data.revenue / 100) : 1), base ? data.revenue : null),
                  raw:   l.value,
                })}
                onMouseLeave={() => setTooltip(null)}
              />
            ))}

            {/* Nodes */}
            {posNodes.map(n => (
              <g key={n.id}
                onMouseEnter={(e) => setTooltip({
                  x: e.clientX, y: e.clientY,
                  label: n.label,
                  value: fmtCr(n.value * (base ? (data.revenue / 100) : 1), null),
                  raw:   n.value,
                })}
                onMouseLeave={() => setTooltip(null)}
              >
                <rect
                  x={n.x} y={n.y} width={n.w} height={n.h}
                  fill={n.color} rx={3} opacity={0.95}
                />
                {/* Label: right of node for cols 0-1, left for cols 2+ */}
                {n.col <= 1 ? (
                  <text
                    x={n.x + n.w + 6} y={n.y + n.h / 2}
                    fill="var(--text)" fontSize={11} dominantBaseline="middle"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {n.label}
                    <tspan fill="var(--muted)" fontSize={10}> {
                      mode === 'percent'
                        ? `${n.value.toFixed(1)}%`
                        : fmtCr(n.value)
                    }</tspan>
                  </text>
                ) : (
                  <text
                    x={n.x - 6} y={n.y + n.h / 2}
                    textAnchor="end" fill="var(--text)" fontSize={11} dominantBaseline="middle"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {n.label}
                    <tspan fill="var(--muted)" fontSize={10}> {
                      mode === 'percent'
                        ? `${n.value.toFixed(1)}%`
                        : fmtCr(n.value)
                    }</tspan>
                  </text>
                )}
              </g>
            ))}
          </svg>

          {/* SVG Tooltip (portal-free, positioned via fixed) */}
          {tooltip && (
            <div style={{
              position: 'fixed', left: tooltip.x + 14, top: tooltip.y - 10, zIndex: 9000,
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
              padding: '8px 12px', fontSize: 12, boxShadow: 'var(--shadow)', pointerEvents: 'none',
            }}>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{tooltip.label}</div>
              <div style={{ color: 'var(--muted)' }}>{tooltip.value}</div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          No financial flow data available for {ticker}
        </div>
      )}

      {/* Key stats footer */}
      <div style={{
        padding: '10px 18px', borderTop: '1px solid var(--border)',
        display: 'flex', gap: 16, flexWrap: 'wrap',
      }}>
        {[
          ['Revenue',   fmtCr(data.revenue)],
          ['Op. Profit',fmtCr(data.opProfit)],
          ['OPM',       data.opm    != null ? `${data.opm.toFixed(1)}%` : '—'],
          ['PAT',       fmtCr(data.pat)],
          ['NPM',       data.npm    != null ? `${data.npm.toFixed(1)}%` : '—'],
          ['ROE',       data.roe    != null ? `${data.roe.toFixed(1)}%` : '—'],
          ['Sales Gr',  fmtPct(data.salesGr1)],
          ['P/E',       data.pe     != null ? data.pe.toFixed(1) : '—'],
        ].map(([l, v]) => (
          <div key={l} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px' }}>{l}</div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Ticker search / multi-select input
// ─────────────────────────────────────────────────────────────────────────────
function TickerSelector({ allTickers, selected, onAdd, onRemove }) {
  const [query,    setQuery]    = useState('')
  const [showList, setShowList] = useState(false)
  const wrapRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowList(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const filtered = useMemo(() => {
    if (!query && !showList) return []
    const q = query.toLowerCase()
    return allTickers
      .filter(t => !selected.includes(t.nseCode))
      .filter(t => !q || t.nseCode.toLowerCase().includes(q) || t.name.toLowerCase().includes(q))
      .slice(0, 30)
  }, [query, allTickers, selected, showList])

  const select = (nseCode) => {
    if (selected.length >= MAX_TICKERS) return
    onAdd(nseCode)
    setQuery('')
    setShowList(false)
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', flex: '0 0 auto' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Selected chips */}
        {selected.map((t, i) => (
          <div key={t} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: TICKER_COLORS[i] + '22',
            border: `1px solid ${TICKER_COLORS[i]}88`,
            borderRadius: 20, padding: '3px 10px 3px 12px', fontSize: 12, fontWeight: 700,
            color: TICKER_COLORS[i],
          }}>
            {t}
            <button onClick={() => onRemove(t)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--muted)', fontSize: 14, lineHeight: 1, padding: '0 0 0 4px',
            }}>✕</button>
          </div>
        ))}

        {/* Input */}
        {selected.length < MAX_TICKERS && (
          <input
            className="input"
            style={{ fontSize: 13, padding: '6px 12px', width: 200 }}
            placeholder={selected.length === 0 ? '🔍 Search ticker or company…' : '+ Add more…'}
            value={query}
            onChange={e => { setQuery(e.target.value); setShowList(true) }}
            onFocus={() => setShowList(true)}
            onKeyDown={e => {
              if (e.key === 'Enter' && filtered[0]) select(filtered[0].nseCode)
              if (e.key === 'Escape') setShowList(false)
            }}
          />
        )}
      </div>

      {/* Dropdown list */}
      {showList && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4,
          width: 340, maxHeight: 300, overflowY: 'auto', zIndex: 500,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 10, boxShadow: 'var(--shadow)',
        }}>
          {filtered.map(t => (
            <div key={t.nseCode}
              style={{
                padding: '8px 14px', cursor: 'pointer',
                borderBottom: '1px solid var(--border)', fontSize: 12,
              }}
              onMouseDown={() => select(t.nseCode)}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{t.nseCode}</span>
              <span style={{ marginLeft: 8 }}>{t.name}</span>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{t.industry}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Comparison table (shown when ≥ 2 tickers loaded)
// ─────────────────────────────────────────────────────────────────────────────
function ComparisonTable({ results }) {
  if (results.length < 2) return null
  const ROWS = [
    { key: 'revenue',        label: 'Revenue (₹ Cr)',    fmt: fmtCr },
    { key: 'opExpenses',     label: 'Op. Expenses',      fmt: fmtCr },
    { key: 'opProfit',       label: 'Op. Profit',        fmt: fmtCr },
    { key: 'opm',            label: 'OPM %',             fmt: (v) => v != null ? `${v.toFixed(1)}%` : '—' },
    { key: 'taxAndInterest', label: 'Tax & Interest',    fmt: fmtCr },
    { key: 'pat',            label: 'PAT',               fmt: fmtCr },
    { key: 'npm',            label: 'NPM %',             fmt: (v) => v != null ? `${v.toFixed(1)}%` : '—' },
    { key: 'cashOps',        label: 'Cash from Ops',     fmt: fmtCr },
    { key: 'fcf',            label: 'Free Cash Flow',    fmt: fmtCr },
    { key: 'salesGr1',       label: 'Sales Growth 1Y',   fmt: fmtPct },
    { key: 'profitGr1',      label: 'Profit Growth 1Y',  fmt: fmtPct },
    { key: 'roe',            label: 'ROE %',             fmt: (v) => v != null ? `${v.toFixed(1)}%` : '—' },
    { key: 'pe',             label: 'P/E',               fmt: (v) => v != null ? v.toFixed(1) : '—' },
    { key: 'compositeScore', label: 'Composite Score',   fmt: (v) => v != null ? v.toFixed(0) : '—' },
  ]

  return (
    <div className="card" style={{ marginTop: 20, overflowX: 'auto' }}>
      <div className="card-header">
        <div className="card-title">Side-by-Side Comparison</div>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>★ = best value in row</span>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Metric</th>
            {results.map((r, i) => (
              <th key={r.ticker} style={{ color: TICKER_COLORS[i] }}>
                {r.ticker}<br />
                <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--muted)' }}>{r.name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map(row => {
            const vals = results.map(r => r.data[row.key])
            const nums = vals.map(v => (v != null && !isNaN(v)) ? v : null)
            // For "best": higher is better for most; lower for tax, pe, expenses
            const lowerBetter = ['taxAndInterest', 'opExpenses', 'pe'].includes(row.key)
            const validNums   = nums.filter(v => v != null)
            const bestVal     = validNums.length ? (lowerBetter ? Math.min(...validNums) : Math.max(...validNums)) : null

            return (
              <tr key={row.key}>
                <td style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 600 }}>{row.label}</td>
                {results.map((r, i) => {
                  const v       = r.data[row.key]
                  const isBest  = v != null && bestVal != null && v === bestVal
                  return (
                    <td key={r.ticker} style={{
                      fontWeight: isBest ? 700 : 400,
                      color: isBest ? 'var(--positive)' : 'var(--text)',
                      whiteSpace: 'nowrap',
                    }}>
                      {row.fmt(v)}
                      {isBest && <span style={{ fontSize: 10, marginLeft: 4, color: 'var(--positive)' }}>★</span>}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main SankeyPage
// ─────────────────────────────────────────────────────────────────────────────
export default function SankeyPage() {
  const [searchParams]                  = useSearchParams()

  // All tickers from GS for autocomplete
  const [allTickers,   setAllTickers]   = useState([])
  const [tickersLoaded,setTickersLoaded]= useState(false)

  // Selected ticker NSE codes (up to MAX_TICKERS)
  const [selected,     setSelected]     = useState([])

  // Per-ticker fetched results: { [nseCode]: { loading, error, result } }
  const [tickerData,   setTickerData]   = useState({})

  // View mode: 'absolute' | 'percent'
  const [mode,         setMode]         = useState('absolute')

  // ── Load all tickers once ──────────────────────────────────────────────────
  useEffect(() => {
    axios.get('/api/gs/tickers')
      .then(r => { setAllTickers(r.data?.data || []); setTickersLoaded(true) })
      .catch(() => setTickersLoaded(true))
  }, [])

  // ── Pre-fill ticker from URL ?ticker=TCS ──────────────────────────────────
  useEffect(() => {
    const t = searchParams.get('ticker')
    if (t && tickersLoaded) addTicker(t.toUpperCase())
  }, [tickersLoaded])  // eslint-disable-line

  // ── Fetch Sankey data for a ticker ────────────────────────────────────────
  const fetchTicker = useCallback(async (nseCode) => {
    setTickerData(prev => ({ ...prev, [nseCode]: { loading: true, error: null, result: null } }))
    try {
      const r = await axios.get(`/api/gs/sankey-data?q=${encodeURIComponent(nseCode)}`)
      if (!r.data.success) throw new Error(r.data.error || 'Not found')
      setTickerData(prev => ({ ...prev, [nseCode]: { loading: false, error: null, result: r.data } }))
    } catch (e) {
      setTickerData(prev => ({ ...prev, [nseCode]: { loading: false, error: e.message, result: null } }))
    }
  }, [])

  const addTicker = useCallback((nseCode) => {
    if (!nseCode || selected.includes(nseCode) || selected.length >= MAX_TICKERS) return
    setSelected(prev => [...prev, nseCode])
    fetchTicker(nseCode)
  }, [selected, fetchTicker])

  const removeTicker = useCallback((nseCode) => {
    setSelected(prev => prev.filter(t => t !== nseCode))
    setTickerData(prev => { const n = { ...prev }; delete n[nseCode]; return n })
  }, [])

  // ── Compute loaded results in selection order ─────────────────────────────
  const loadedResults = selected
    .filter(t => tickerData[t]?.result)
    .map((t, i) => ({ ...tickerData[t].result, _idx: i }))

  // ── Grid layout: 1 col if 1, 2 cols if 2-4 ──────────────────────────────
  const gridCols = selected.length <= 1 ? '1fr' : '1fr 1fr'

  return (
    <div className="page">
      {/* Page heading */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
              📊 Financial Flow — SankeyMATIC
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
              P&amp;L waterfall: Revenue → Op. Expenses / Op. Profit → Tax &amp; Interest / PAT → Retained / Dividends.
              Up to {MAX_TICKERS} companies side-by-side from the 104-column FUNDA sheet.
            </p>
          </div>
          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: 4, alignSelf: 'center' }}>
            <button
              className={`btn btn-sm ${mode === 'absolute' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setMode('absolute')}
            >₹ Absolute</button>
            <button
              className={`btn btn-sm ${mode === 'percent' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setMode('percent')}
            >% of Revenue</button>
          </div>
        </div>
      </div>

      {/* Ticker selector */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
            Select companies
            <span style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: 6, fontSize: 12 }}>
              (up to {MAX_TICKERS})
            </span>
          </div>
          {!tickersLoaded
            ? <span style={{ fontSize: 12, color: 'var(--muted)' }}>Loading ticker list…</span>
            : <TickerSelector
                allTickers={allTickers}
                selected={selected}
                onAdd={addTicker}
                onRemove={removeTicker}
              />
          }
        </div>
        {selected.length > 0 && (
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>
            <strong>Mode:</strong> {mode === 'absolute' ? 'Absolute ₹ Cr values' : 'Normalised — all flows as % of Revenue (useful for comparison)'}
            {selected.length > 1 && mode === 'percent' && (
              <span style={{ color: 'var(--warning)', marginLeft: 8 }}>
                ● Overlay comparison active — node sizes normalised for visual parity
              </span>
            )}
          </div>
        )}
      </div>

      {/* Empty state */}
      {selected.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Search and select a stock ticker above</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
            The Sankey diagram will show how Revenue flows through Operating Expenses, Operating Profit,
            Tax &amp; Interest, PAT, and finally into Retained Earnings or Dividends.
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Examples: <span style={{ color: 'var(--primary)', cursor: 'pointer' }} onMouseDown={() => addTicker('TCS')}>TCS</span>
            {' · '}<span style={{ color: 'var(--primary)', cursor: 'pointer' }} onMouseDown={() => addTicker('RELIANCE')}>RELIANCE</span>
            {' · '}<span style={{ color: 'var(--primary)', cursor: 'pointer' }} onMouseDown={() => addTicker('INFY')}>INFY</span>
            {' · '}<span style={{ color: 'var(--primary)', cursor: 'pointer' }} onMouseDown={() => addTicker('HDFCBANK')}>HDFCBANK</span>
          </div>
        </div>
      )}

      {/* Sankey diagrams grid */}
      {selected.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 16 }}>
          {selected.map((nseCode, i) => {
            const state = tickerData[nseCode]
            if (!state || state.loading) {
              return (
                <div key={nseCode} className="card">
                  <div style={{ fontWeight: 700, color: TICKER_COLORS[i], marginBottom: 8 }}>{nseCode}</div>
                  <Loading />
                </div>
              )
            }
            if (state.error) {
              return (
                <div key={nseCode} className="card">
                  <div style={{ fontWeight: 700, color: TICKER_COLORS[i], marginBottom: 8 }}>{nseCode}</div>
                  <ErrorBox msg={state.error} />
                  <button className="btn btn-sm btn-ghost" style={{ marginTop: 8, fontSize: 12 }}
                    onClick={() => fetchTicker(nseCode)}>Retry</button>
                </div>
              )
            }
            if (!state.result) return null
            return (
              <SankeyDiagram
                key={nseCode}
                result={state.result}
                mode={mode}
                accentColor={TICKER_COLORS[i]}
                svgW={selected.length <= 1 ? 860 : 500}
                svgH={selected.length <= 1 ? 340 : 280}
              />
            )
          })}
        </div>
      )}

      {/* Comparison table */}
      {loadedResults.length >= 2 && (
        <ComparisonTable results={loadedResults} />
      )}

      {/* Data note */}
      {selected.length > 0 && (
        <div style={{ marginTop: 16, fontSize: 11, color: 'var(--muted)', lineHeight: 1.7 }}>
          <strong>Data source:</strong> Published Google Sheet FUNDA tab (104 columns, 1,113 companies) via /api/gs/sankey-data ·
          <strong> Derived fields:</strong> Op. Expenses = Revenue − Op. Profit · Tax &amp; Interest = Op. Profit − PAT ·
          CapEx ≈ Cash from Ops − Net Cash Flow · Dividends = Div. Yield × Mkt Cap (estimate).
          Null or negative flows are omitted from the diagram.
        </div>
      )}
    </div>
  )
}
