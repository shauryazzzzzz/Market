/**
 * NseDataPage.jsx — NSE Raw Data Explorer
 * Route: /nse-data
 *
 * Two top-level view modes (tabs):
 *   1. MERGED  — consolidated tables joined on NSE Symbol or ISIN primary key
 *      • NSE_SYMBOL group: all symbol-keyed sheets merged into one wide table
 *      • ISIN group:       all ISIN-keyed sheets merged into one wide table
 *      • STANDALONE:       sheets with no joinable key, shown individually
 *   2. RAW SHEETS — original 41-sheet per-tab view (with AI header badge,
 *      metadata row suppression already applied server-side)
 *
 * AI header inference: IBM watsonx Mistral Small (free, IBM-first) → Gemini 2.5-flash
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import axios from 'axios'
import { Loading, ErrorBox } from '../components/shared'

const PAGE_SIZE = 100

// ── helpers ───────────────────────────────────────────────────────────────────

function looksNumeric(v) {
  if (v == null || v === '') return false
  return /^-?[\d,]+(\.\d+)?%?$/.test(String(v).trim())
}

function sheetHint(name) {
  const map = {
    'google-sheet-main':               'Full stock screener — 90+ ratios, scores, fundamentals',
    'screener':                        'Screener.in export — fundamentals & growth metrics',
    'sec_bhavdata_full_25082026':       'Full NSE CM Bhavcopy — OHLC, delivery %, trades',
    'BhavCopy_NSE_CM_0_0_0_20260825_': 'Detailed NSE CM Bhavcopy (instruments)',
    'NSE_CM_security_25082026':        'Security master — ISIN, series, listing info',
    'bulk':                            'Bulk deals — large block transactions',
    'block':                           'Block deals — institutional block orders',
    'shortselling_25082026':           'Short selling positions by security',
    'PE_250826':                       'Symbol-level P/E ratios',
    'CMVOLT_25082026.CSV':             'Daily & annualised volatility per symbol',
    'CM_52_wk_High_low_25082026':      'Adjusted 52-week high & low prices',
    'MF_VAR_25082026':                 'Mutual Fund VAR, haircut, NAV data',
    'eq_band_changes_25082026':        'Equity band changes (circuit filters)',
    'corpbond25082026':                'Corporate bonds bhavcopy',
    'sme25082026':                     'SME segment bhavcopy',
    'sec_list_25082026':               'Securities surveillance / band list',
    'PR_mcap25082026':                 'Market capitalisation per security',
    'PR_etf25082026':                  'ETF price data',
    'PR_hl25082026':                   '52-week high/low movers',
    'PR_pr25082026':                   'Nifty / index price report',
    'PR_bc25082026':                   'Book closure / ex-date corporate actions',
    'AUB_2026159_25082026':            'Auction Buy report — securities to be auctioned',
    'CM_Latency_stats24082026':        'Capital Market latency stats (microseconds)',
    'APPSEC_COLLVAL_25082026':         'Applicable Securities Collateral Value',
    'CSQR_M2026159_25082026':          'Closing Squared-off Report — auction session',
    'circuit_25082026':                'Market circuit breaker statistics',
  }
  return map[name] || ''
}

// ── AI badge ──────────────────────────────────────────────────────────────────
function AiBadge({ provider, model }) {
  if (!provider || provider === 'fallback') return null
  const isWatsonx = provider === 'watsonx'
  const color = isWatsonx ? '#3fb950' : '#a371f7'
  const label = isWatsonx ? `🤖 IBM watsonx · ${model}` : `🤖 Gemini · ${model}`
  return (
    <span title="Column names inferred by AI — this file has no header row in source data" style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
      background: isWatsonx ? 'rgba(63,185,80,0.12)' : 'rgba(163,113,247,0.15)',
      border: `1px solid ${color}40`, color, cursor: 'help', flexShrink: 0,
    }}>
      {label}
    </span>
  )
}

// ── Suppressed badge ──────────────────────────────────────────────────────────
function SuppressedBadge({ count }) {
  if (!count) return null
  return (
    <span title={`${count} metadata row(s) suppressed (disclaimers, titles, date descriptions)`} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
      background: 'rgba(210,153,34,0.12)', border: '1px solid rgba(210,153,34,0.3)',
      color: 'var(--warning)', cursor: 'help', flexShrink: 0,
    }}>
      ⚠ {count} metadata row{count > 1 ? 's' : ''} suppressed
    </span>
  )
}

// ── Source-sheet chips ─────────────────────────────────────────────────────────
function SourceChips({ sheets }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
      {sheets.map(s => (
        <span key={s} style={{
          padding: '1px 7px', borderRadius: 8, fontSize: 10, fontWeight: 500,
          background: 'rgba(47,129,247,0.12)', border: '1px solid rgba(47,129,247,0.25)',
          color: 'var(--primary)',
        }}>{s}</span>
      ))}
    </div>
  )
}

// ── Reusable full-featured data table ─────────────────────────────────────────
function DataTable({ columns, rows, tableId }) {
  const [search,  setSearch]  = useState('')
  const [page,    setPage]    = useState(1)
  const [sortCol, setSortCol] = useState(null)
  const [sortAsc, setSortAsc] = useState(true)
  const searchRef = useRef(null)

  // Reset page when search changes
  const handleSearch = (e) => { setSearch(e.target.value); setPage(1) }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(row => Object.values(row).some(v => String(v).toLowerCase().includes(q)))
  }, [rows, search])

  const sorted = useMemo(() => {
    if (!sortCol) return filtered
    return [...filtered].sort((a, b) => {
      const av = a[sortCol] ?? '', bv = b[sortCol] ?? ''
      const an = parseFloat(String(av).replace(/,/g, '')), bn = parseFloat(String(bv).replace(/,/g, ''))
      if (!isNaN(an) && !isNaN(bn)) return sortAsc ? an - bn : bn - an
      return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
    })
  }, [filtered, sortCol, sortAsc])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const pageRows   = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleSort = (col) => {
    if (sortCol === col) setSortAsc(p => !p)
    else { setSortCol(col); setSortAsc(true) }
    setPage(1)
  }

  if (!columns || columns.length === 0) return (
    <div style={{ padding: 24, color: 'var(--muted)', fontSize: 13 }}>No data available.</div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <input
          ref={searchRef}
          className="input"
          style={{ width: 260, fontSize: 13 }}
          placeholder="🔍 Filter rows…"
          value={search}
          onChange={handleSearch}
        />
        <span style={{ fontSize: 12, color: 'var(--muted)', flexShrink: 0 }}>
          <strong style={{ color: 'var(--text)' }}>{sorted.length.toLocaleString()}</strong> / {rows.length.toLocaleString()} rows
          {' · '}<strong style={{ color: 'var(--text)' }}>{columns.length}</strong> cols
        </span>
        {sortCol && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setSortCol(null); setSortAsc(true) }}>✕ Sort</button>
        )}
        {search && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setPage(1) }}>✕ Filter</button>
        )}
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)', maxHeight: '60vh' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%', tableLayout: 'auto' }}>
          <thead>
            <tr>
              <th style={thSt('#', true)}><span style={{ color: 'var(--muted)', fontSize: 11 }}>#</span></th>
              {columns.map(col => (
                <th key={col} onClick={() => handleSort(col)} style={thSt(col)} title={`Sort by ${col}`}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}>
                    {col}
                    {sortCol === col
                      ? <span style={{ color: 'var(--primary)', fontSize: 10 }}>{sortAsc ? '↑' : '↓'}</span>
                      : <span style={{ color: 'var(--border)', fontSize: 10 }}>⇅</span>}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr><td colSpan={columns.length + 1} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No rows match.</td></tr>
            ) : pageRows.map((row, ri) => (
              <tr key={ri} style={{ background: ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                <td style={rnSt}>{(page - 1) * PAGE_SIZE + ri + 1}</td>
                {columns.map(col => {
                  const val = row[col] ?? ''
                  return (
                    <td key={col} style={tdSt(looksNumeric(val))} title={String(val)}>
                      {String(val)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(1)}>« First</button>
          <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
          {Array.from({ length: Math.min(9, totalPages) }, (_, i) => {
            let start = Math.max(1, page - 4)
            const end = Math.min(totalPages, start + 8)
            start = Math.max(1, end - 8)
            return start + i
          }).filter(p => p >= 1 && p <= totalPages).map(p => (
            <button key={p} className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPage(p)}>{p}</button>
          ))}
          <button className="btn btn-ghost btn-sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
          <button className="btn btn-ghost btn-sm" disabled={page === totalPages} onClick={() => setPage(totalPages)}>Last »</button>
          <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 6 }}>Page {page}/{totalPages} · {PAGE_SIZE}/page</span>
        </div>
      )}
    </div>
  )
}

// Shared style helpers
const thSt = (col, isNum = false) => ({
  position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg3)',
  padding: '7px 10px', textAlign: isNum ? 'center' : 'left',
  fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px',
  color: 'var(--muted)', borderBottom: '2px solid var(--border)',
  cursor: isNum ? 'default' : 'pointer', userSelect: 'none', whiteSpace: 'nowrap', minWidth: isNum ? 36 : 70,
})
const tdSt = (isNum) => ({
  padding: '5px 10px', borderBottom: '1px solid rgba(48,54,61,0.4)',
  whiteSpace: 'nowrap', textAlign: isNum ? 'right' : 'left',
  fontVariantNumeric: isNum ? 'tabular-nums' : 'normal',
  maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 12,
})
const rnSt = {
  padding: '5px 8px', borderBottom: '1px solid rgba(48,54,61,0.4)',
  textAlign: 'center', color: 'var(--muted)', fontSize: 11,
  fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', minWidth: 36,
}

// ── MergedGroupPanel — renders one merge group (NSE_SYMBOL or ISIN) ───────────
function MergedGroupPanel({ groupKey }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    axios.get(`/api/nse-data/merged?group=${groupKey}`)
      .then(r => {
        if (cancelled) return
        if (r.data.success) setData(r.data)
        else setError(r.data.error || 'Failed to load')
        setLoading(false)
      })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [groupKey])

  if (loading) return <Loading />
  if (error)   return <ErrorBox msg={error} />
  if (!data || !data.columns?.length) return (
    <div style={{ padding: 24, color: 'var(--muted)', fontSize: 13 }}>No data for this group.</div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="pill neutral" style={{ fontSize: 12 }}>
              🔑 Join key: <strong>{data.keyCol}</strong>
            </span>
            <span className="pill neutral" style={{ fontSize: 12 }}>
              📊 {data.rowCount?.toLocaleString()} rows · {data.columnCount} columns
            </span>
            <span className="pill neutral" style={{ fontSize: 12 }}>
              🗂 {data.sourceSheets?.length} source sheets merged
            </span>
          </div>
          <SourceChips sheets={data.sourceSheets || []} />
        </div>
      </div>
      <DataTable columns={data.columns} rows={data.rows} tableId={groupKey} />
    </div>
  )
}

// ── StandalonePanel — index + lazy per-sheet loader ───────────────────────────
function StandalonePanel() {
  const [index,   setIndex]   = useState(null)   // [{ name, rowCount, colCount, aiHeaders }]
  const [active,  setActive]  = useState(null)
  const [loaded,  setLoaded]  = useState({})      // name → { columns, rows, aiHeaders, ... }
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  // Load standalone index
  useEffect(() => {
    axios.get('/api/nse-data/merged?group=STANDALONE')
      .then(r => {
        if (r.data.success) {
          setIndex(r.data.sheets || [])
          if (r.data.sheets?.length > 0) setActive(r.data.sheets[0].name)
        } else {
          setError(r.data.error)
        }
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const activateSheet = useCallback((name) => {
    setActive(name)
    if (loaded[name]) return
    // Lazy load
    axios.get(`/api/nse-data/merged?group=STANDALONE&sheet=${encodeURIComponent(name)}`)
      .then(r => {
        if (r.data.success) {
          setLoaded(prev => ({ ...prev, [name]: r.data }))
        }
      })
      .catch(() => {})
  }, [loaded])

  // Auto-load first sheet
  useEffect(() => {
    if (active && !loaded[active]) activateSheet(active)
  }, [active])

  if (loading) return <Loading />
  if (error)   return <ErrorBox msg={error} />
  if (!index)  return null

  return (
    <div style={{ display: 'flex', gap: 0, height: '65vh', minHeight: 400 }}>
      {/* Mini sidebar */}
      <div style={{ width: 200, flexShrink: 0, borderRight: '1px solid var(--border)', overflowY: 'auto', background: 'var(--bg2)', borderRadius: 'var(--radius) 0 0 var(--radius)', border: '1px solid var(--border)' }}>
        {index.map(s => {
          const isActive = active === s.name
          return (
            <button key={s.name} onClick={() => activateSheet(s.name)}
              style={{ width: '100%', textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid rgba(48,54,61,0.4)', background: isActive ? 'rgba(47,129,247,0.12)' : 'transparent', borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent', cursor: 'pointer' }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg3)' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{ fontSize: 11, fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--primary)' : 'var(--text)', wordBreak: 'break-word' }}>
                {s.name}{s.aiHeaders && <span style={{ color: '#3fb950', marginLeft: 4 }}>🤖</span>}
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{s.rowCount} rows</div>
            </button>
          )
        })}
      </div>
      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '12px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderLeft: 'none', borderRadius: '0 var(--radius) var(--radius) 0' }}>
        {active && (
          <>
            <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{active}</span>
              {sheetHint(active) && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{sheetHint(active)}</span>}
            </div>
            {!loaded[active]
              ? <Loading />
              : (
                <>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {loaded[active].aiHeaders && <AiBadge provider={loaded[active].aiProvider} model={loaded[active].aiModel} />}
                    {loaded[active].suppressed > 0 && <SuppressedBadge count={loaded[active].suppressed} />}
                  </div>
                  <DataTable columns={loaded[active].columns} rows={loaded[active].rows} tableId={active} />
                </>
              )}
          </>
        )}
      </div>
    </div>
  )
}

// ── RawSheetTab — the original per-sheet view (Raw Sheets mode) ───────────────
function RawSheetTab({ name, hasAiHeader }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    axios.get(`/api/nse-data/sheet?name=${encodeURIComponent(name)}`)
      .then(r => {
        if (cancelled) return
        if (r.data.success) setData(r.data)
        else setError(r.data.error || 'Failed to load')
        setLoading(false)
      })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [name])

  if (loading) return <Loading />
  if (error)   return <ErrorBox msg={`"${name}": ${error}`} />
  if (!data || !data.columns?.length) return (
    <div style={{ padding: 24, color: 'var(--muted)', fontSize: 13 }}>No data.</div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      {(data.aiHeaders || data.suppressed > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '6px 10px', borderRadius: 'var(--radius)', background: 'rgba(48,54,61,0.3)', border: '1px solid var(--border)' }}>
          {data.aiHeaders   && <AiBadge provider={data.aiProvider} model={data.aiModel} />}
          {data.suppressed  > 0 && <SuppressedBadge count={data.suppressed} />}
          {data.primaryKey?.keyType && (
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              🔑 PK: <strong style={{ color: 'var(--text)' }}>{data.primaryKey.keyCol}</strong>
              <span style={{ marginLeft: 4, padding: '1px 6px', borderRadius: 6, background: 'rgba(47,129,247,0.15)', color: 'var(--primary)', fontSize: 10 }}>{data.primaryKey.keyType}</span>
            </span>
          )}
        </div>
      )}
      <DataTable columns={data.columns} rows={data.rows} tableId={name} />
    </div>
  )
}

// ── RawSheetsView — the full 41-sheet sidebar+tab layout ─────────────────────
function RawSheetsView({ sheets }) {
  const [active,    setActive]    = useState(sheets[0]?.name || null)
  const [loaded,    setLoaded]    = useState(() => new Set([sheets[0]?.name].filter(Boolean)))
  const [tabSearch, setTabSearch] = useState('')

  const activateTab = useCallback((name) => {
    setActive(name)
    setLoaded(prev => { const s = new Set(prev); s.add(name); return s })
  }, [])

  const visibleSheets = useMemo(() => {
    const q = tabSearch.trim().toLowerCase()
    return q ? sheets.filter(s => s.name.toLowerCase().includes(q)) : sheets
  }, [sheets, tabSearch])

  return (
    <div style={{ display: 'flex', gap: 0, height: 'calc(100vh - 230px)', minHeight: 500 }}>
      {/* Sidebar */}
      <div style={{ width: 230, flexShrink: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto', background: 'var(--bg2)', borderRadius: 'var(--radius) 0 0 var(--radius)', border: '1px solid var(--border)' }}>
        <div style={{ padding: '8px 8px 6px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg2)', zIndex: 3 }}>
          <input className="input" style={{ width: '100%', fontSize: 12 }} placeholder="🔍 Find sheet…" value={tabSearch} onChange={e => setTabSearch(e.target.value)} />
        </div>
        {visibleSheets.map(sheet => {
          const isActive = active === sheet.name
          return (
            <button key={sheet.name} onClick={() => activateTab(sheet.name)} title={sheetHint(sheet.name) || sheet.name}
              style={{ width: '100%', textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid rgba(48,54,61,0.4)', background: isActive ? 'rgba(47,129,247,0.12)' : 'transparent', borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent', cursor: 'pointer', transition: 'background .1s' }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg3)' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{ fontSize: 12, fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--primary)' : 'var(--text)', wordBreak: 'break-word', lineHeight: 1.3 }}>
                {sheet.name}
                {sheet.hasAiHeader && <span title="AI-inferred headers" style={{ marginLeft: 4, fontSize: 10, color: '#3fb950' }}>🤖</span>}
                {sheet.hasMetadataSkip && <span title="Metadata rows suppressed" style={{ marginLeft: 3, fontSize: 10, color: 'var(--warning)' }}>⚠</span>}
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                {sheet.rowCount.toLocaleString()} rows · {sheet.colCount} cols
              </div>
            </button>
          )
        })}
        {visibleSheets.length === 0 && <div style={{ padding: 12, fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>No match</div>}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '12px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderLeft: 'none', borderRadius: '0 var(--radius) var(--radius) 0' }}>
        {active ? (
          <>
            <div style={{ marginBottom: 10, display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{active}</h2>
              {sheetHint(active) && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{sheetHint(active)}</span>}
            </div>
            {[...loaded].map(name => {
              const sm = sheets.find(s => s.name === name)
              return (
                <div key={name} style={{ display: name === active ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                  <RawSheetTab name={name} hasAiHeader={sm?.hasAiHeader || false} />
                </div>
              )
            })}
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--muted)', fontSize: 13 }}>
            Select a sheet from the left panel
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function NseDataPage() {
  const [sheets,  setSheets]  = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [view,    setView]    = useState('merged')   // 'merged' | 'raw'
  const [mergedGroup, setMergedGroup] = useState('NSE_SYMBOL')  // NSE_SYMBOL | ISIN | STANDALONE

  // Load sheet index on mount (lightweight — no parsing)
  useEffect(() => {
    axios.get('/api/nse-data/sheets')
      .then(r => {
        if (r.data.success) setSheets(r.data.sheets)
        else setError(r.data.error || 'Failed to load sheet list')
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  if (loading) return (
    <div className="page"><div className="page-title">📋 NSE Data Explorer</div><Loading /></div>
  )
  if (error) return (
    <div className="page"><div className="page-title">📋 NSE Data Explorer</div><ErrorBox msg={error} /></div>
  )

  return (
    <div className="page" style={{ maxWidth: '100%', padding: '14px 18px' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h1 className="page-title" style={{ margin: 0, fontSize: 19 }}>📋 NSE Data Explorer</h1>
          <span className="pill neutral">{sheets.length} sheets · Combined_Raw_Data.xlsx</span>
          <span className="pill neutral" style={{ background: 'rgba(63,185,80,0.1)', color: 'var(--positive)', border: '1px solid rgba(63,185,80,0.3)' }}>
            🤖 IBM watsonx Mistral → Gemini 2.5
          </span>
        </div>
        <p className="page-sub" style={{ marginTop: 4 }}>
          All NSE market data for 25-Aug-2026. Metadata rows auto-suppressed · AI headers inferred for headerless files · Sheets joined by primary key.
        </p>
      </div>

      {/* ── Top-level view switcher ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, borderBottom: '2px solid var(--border)', paddingBottom: 0 }}>
        {[
          { id: 'merged', label: '🔗 Merged Tables', desc: 'Sheets joined by NSE Symbol / ISIN' },
          { id: 'raw',    label: '📄 Raw Sheets',    desc: 'All 41 original sheets individually' },
        ].map(({ id, label, desc }) => (
          <button key={id} onClick={() => setView(id)} title={desc}
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: view === id ? 700 : 400, borderBottom: view === id ? '2px solid var(--primary)' : '2px solid transparent', marginBottom: -2, color: view === id ? 'var(--primary)' : 'var(--muted)', background: 'none', cursor: 'pointer', transition: 'color .15s' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── MERGED VIEW ── */}
      {view === 'merged' && (
        <div>
          {/* Group sub-tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {[
              { id: 'NSE_SYMBOL', label: '📈 NSE Symbol', desc: 'All symbol-keyed sheets merged into one wide table' },
              { id: 'ISIN',       label: '🔢 ISIN',       desc: 'All ISIN-keyed sheets merged' },
              { id: 'STANDALONE', label: '📋 Standalone',  desc: 'Sheets with no joinable key' },
            ].map(({ id, label, desc }) => (
              <button key={id} onClick={() => setMergedGroup(id)} title={desc}
                className={`btn btn-sm ${mergedGroup === id ? 'btn-primary' : 'btn-ghost'}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Group content */}
          {mergedGroup === 'NSE_SYMBOL' && (
            <div>
              <div style={{ marginBottom: 10, padding: '8px 12px', background: 'rgba(47,129,247,0.06)', border: '1px solid rgba(47,129,247,0.2)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--muted)' }}>
                <strong style={{ color: 'var(--text)' }}>NSE Symbol merge group</strong> — all sheets sharing a <code>Symbol</code> / <code>NSE Code</code> column are left-joined on that key into one wide table.
                Columns from later sheets are prefixed with their source sheet name to avoid collisions.
              </div>
              <MergedGroupPanel groupKey="NSE_SYMBOL" />
            </div>
          )}

          {mergedGroup === 'ISIN' && (
            <div>
              <div style={{ marginBottom: 10, padding: '8px 12px', background: 'rgba(163,113,247,0.06)', border: '1px solid rgba(163,113,247,0.2)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--muted)' }}>
                <strong style={{ color: 'var(--text)' }}>ISIN merge group</strong> — all sheets sharing an <code>ISIN</code> column are left-joined on that key.
              </div>
              <MergedGroupPanel groupKey="ISIN" />
            </div>
          )}

          {mergedGroup === 'STANDALONE' && (
            <div>
              <div style={{ marginBottom: 10, padding: '8px 12px', background: 'rgba(139,148,158,0.08)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--muted)' }}>
                <strong style={{ color: 'var(--text)' }}>Standalone sheets</strong> — no joinable primary key detected.
                Includes narrative text files (announcements, readme), market-wide statistics, and deal reports.
              </div>
              <StandalonePanel />
            </div>
          )}
        </div>
      )}

      {/* ── RAW SHEETS VIEW ── */}
      {view === 'raw' && <RawSheetsView sheets={sheets} />}
    </div>
  )
}
