/**
 * AdvancedScreener.jsx — Google Sheet powered advanced screener
 * Route: /advanced-screener
 * Data: /api/gs/screener  /api/gs/jumps  /api/gs/all-green  /api/gs/industries
 *
 * Tabs:
 *  1. Composite Rank  — top companies by multi-factor Composite Score
 *  2. Jump Signals    — profit / sales / ROE acceleration
 *  3. All Green 🟢    — all 4 QoQ/YoY momentum signals positive
 *  4. ROE Consistency — ROE above 3/5yr historical averages
 *  5. Custom Filter   — 14 sliders + industry + sort field
 */
import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { Loading, ErrorBox, fmtPct, fmt } from '../components/shared'

// ── Helpers ───────────────────────────────────────────────────────────────────
const pct  = (v) => v != null ? `${v > 0 ? '+' : ''}${v.toFixed(1)}%` : '—'
const num  = (v) => v != null ? v.toFixed(1) : '—'
const str  = (v) => v != null ? v : '—'

function SignalDot({ v }) {
  if (v === 'up')   return <span style={{ color: 'var(--positive)', fontSize: 14 }}>🟢</span>
  if (v === 'down') return <span style={{ color: 'var(--negative)', fontSize: 14 }}>🔴</span>
  return <span style={{ color: 'var(--muted)', fontSize: 11 }}>—</span>
}

function ScoreBadge({ score }) {
  if (score == null) return <span style={{ color: 'var(--muted)' }}>—</span>
  const color = score >= 70 ? 'var(--positive)' : score >= 40 ? 'var(--warning)' : 'var(--negative)'
  return <span style={{ fontWeight: 700, color }}>{score.toFixed(0)}</span>
}

function JumpBadge({ val }) {
  if (val == null) return <span style={{ color: 'var(--muted)' }}>—</span>
  const color = val > 0 ? 'var(--positive)' : 'var(--negative)'
  return <span style={{ color, fontWeight: 600 }}>{val > 0 ? '+' : ''}{val.toFixed(1)}%</span>
}

// ── Sortable column table ─────────────────────────────────────────────────────
function SortableTable({ rows, columns, defaultSort }) {
  const [sort, setSort] = useState(defaultSort || columns[0]?.key)
  const [asc,  setAsc]  = useState(false)

  const sorted = [...rows].sort((a, b) => {
    const av = a[sort] ?? -Infinity
    const bv = b[sort] ?? -Infinity
    if (typeof av === 'string') return asc ? av.localeCompare(bv) : bv.localeCompare(av)
    return asc ? av - bv : bv - av
  })

  const toggle = (key) => {
    if (sort === key) setAsc(p => !p)
    else { setSort(key); setAsc(false) }
  }

  return (
    <div className="table-wrap" style={{ overflowX: 'auto' }}>
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: 28, textAlign: 'center' }}>#</th>
            {columns.map(c => (
              <th key={c.key} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => toggle(c.key)}>
                {c.label}{sort === c.key ? (asc ? ' ↑' : ' ↓') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={r.nseCode || i}>
              <td style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 11 }}>{i + 1}</td>
              {columns.map(c => (
                <td key={c.key} style={{ whiteSpace: 'nowrap' }}>
                  {c.render ? c.render(r[c.key], r) : str(r[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── COLS: Composite tab ───────────────────────────────────────────────────────
const COMPOSITE_COLS = [
  { key: 'name',          label: 'Company',      render: (v, r) => (
    <a href={`/stock/${r.nseCode}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>{v}</a>
  )},
  { key: 'nseCode',       label: 'NSE',          render: v => <span style={{ color: 'var(--muted)', fontSize: 11 }}>{v}</span> },
  { key: 'industry',      label: 'Industry',     render: v => <span style={{ fontSize: 11 }}>{v}</span> },
  { key: 'compositeScore',label: 'Score',        render: v => <ScoreBadge score={v} /> },
  { key: 'pe',            label: 'P/E',          render: v => num(v) },
  { key: 'roe',           label: 'ROE%',         render: v => pct(v) },
  { key: 'profitGrScore', label: 'ProfGr Score', render: v => num(v) },
  { key: 'salesGrScore',  label: 'SalesGr Score',render: v => num(v) },
  { key: 'roeScore',      label: 'ROE Score',    render: v => num(v) },
  { key: 'return1y',      label: '1Y Return',    render: v => pct(v) },
  { key: 'mktReturnComp', label: 'vs Market',    render: v => pct(v) },
  { key: 'qoqSalesSignal',label: 'QoQ Sales',    render: v => <SignalDot v={v} /> },
  { key: 'qoqPatSignal',  label: 'QoQ PAT',      render: v => <SignalDot v={v} /> },
  { key: 'yoySalesSignal',label: 'YoY Sales',    render: v => <SignalDot v={v} /> },
  { key: 'yoyPatSignal',  label: 'YoY PAT',      render: v => <SignalDot v={v} /> },
]

// ── COLS: Jump Signals tab ────────────────────────────────────────────────────
const JUMP_COLS = [
  { key: 'name',         label: 'Company',      render: (v, r) => (
    <a href={`/stock/${r.nseCode}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>{v}</a>
  )},
  { key: 'nseCode',      label: 'NSE',          render: v => <span style={{ color: 'var(--muted)', fontSize: 11 }}>{v}</span> },
  { key: 'industry',     label: 'Industry',     render: v => <span style={{ fontSize: 11 }}>{v}</span> },
  { key: 'compositeScore',label: 'Score',       render: v => <ScoreBadge score={v} /> },
  { key: 'shortVal',     label: 'Short Jump',   render: v => <JumpBadge val={v} /> },
  { key: 'longVal',      label: 'Long Jump',    render: v => <JumpBadge val={v} /> },
  { key: 'roe',          label: 'ROE%',         render: v => pct(v) },
  { key: 'profitGr1',    label: 'Profit Gr 1Y', render: v => pct(v) },
  { key: 'salesGr1',     label: 'Sales Gr 1Y',  render: v => pct(v) },
  { key: 'return1y',     label: '1Y Return',    render: v => pct(v) },
  { key: 'pe',           label: 'P/E',          render: v => num(v) },
]

// ── COLS: All-Green tab ───────────────────────────────────────────────────────
const GREEN_COLS = [
  { key: 'name',          label: 'Company',      render: (v, r) => (
    <a href={`/stock/${r.nseCode}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>{v}</a>
  )},
  { key: 'nseCode',       label: 'NSE',          render: v => <span style={{ color: 'var(--muted)', fontSize: 11 }}>{v}</span> },
  { key: 'industry',      label: 'Industry',     render: v => <span style={{ fontSize: 11 }}>{v}</span> },
  { key: 'compositeScore',label: 'Score',        render: v => <ScoreBadge score={v} /> },
  { key: 'qoqSalesSignal',label: 'QoQ Sales',    render: v => <SignalDot v={v} /> },
  { key: 'yoySalesSignal',label: 'YoY Sales',    render: v => <SignalDot v={v} /> },
  { key: 'yoyPatSignal',  label: 'YoY PAT',      render: v => <SignalDot v={v} /> },
  { key: 'qoqPatSignal',  label: 'QoQ PAT',      render: v => <SignalDot v={v} /> },
  { key: 'profitGr1',     label: 'Profit Gr 1Y', render: v => pct(v) },
  { key: 'salesGr1',      label: 'Sales Gr 1Y',  render: v => pct(v) },
  { key: 'roe',           label: 'ROE%',         render: v => pct(v) },
  { key: 'return1y',      label: '1Y Return',    render: v => pct(v) },
  { key: 'expectedGr',    label: 'Exp Gr',       render: v => str(v) },
]

// ── COLS: ROE Consistency ─────────────────────────────────────────────────────
const ROE_COLS = [
  { key: 'name',       label: 'Company',    render: (v, r) => (
    <a href={`/stock/${r.nseCode}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>{v}</a>
  )},
  { key: 'nseCode',    label: 'NSE',        render: v => <span style={{ color: 'var(--muted)', fontSize: 11 }}>{v}</span> },
  { key: 'industry',   label: 'Industry',   render: v => <span style={{ fontSize: 11 }}>{v}</span> },
  { key: 'roeScore',   label: 'ROE Score',  render: v => num(v) },
  { key: 'roe',        label: 'ROE (Now)',  render: v => pct(v) },
  { key: 'roe3',       label: 'ROE 3Y Avg', render: v => pct(v) },
  { key: 'roe5',       label: 'ROE 5Y Avg', render: v => pct(v) },
  { key: 'roeTo3ROE',  label: 'vs 3Y avg%', render: v => num(v) },
  { key: 'roeTo5ROE',  label: 'vs 5Y avg%', render: v => num(v) },
  { key: 'compositeScore', label: 'Score',  render: v => <ScoreBadge score={v} /> },
  { key: 'pe',         label: 'P/E',        render: v => num(v) },
  { key: 'roePe',      label: 'ROE-P/E',    render: v => num(v) },
]

// ── Default filters ───────────────────────────────────────────────────────────
const DEFAULT_FILTERS = {
  industry: '', minComposite: '', minROE: '', maxPE: '',
  minProfitGr: '', minSalesGr: '', maxDE: '', minOPM: '',
  minPiotroski: '', minPromoter: '', minReturn1y: '',
  minGrowthScore: '', minSalesScore: '', minRoeScore: '',
  allGreen: false,
}

const SORT_FIELDS = [
  { value: 'compositeScore', label: 'Composite Score' },
  { value: 'roeScore',       label: 'ROE Score' },
  { value: 'profitGrScore',  label: 'Profit Growth Score' },
  { value: 'salesGrScore',   label: 'Sales Growth Score' },
  { value: 'returnGrScore',  label: 'Return Growth Score' },
  { value: 'roe',            label: 'ROE %' },
  { value: 'return1y',       label: '1Y Return' },
  { value: 'mktReturnComp',  label: 'vs Market Return' },
  { value: 'pe',             label: 'P/E (lowest first)' },
  { value: 'roePe',          label: 'ROE - P/E' },
  { value: 'piotroski',      label: 'Piotroski Score' },
]

// ── Custom filter tab ─────────────────────────────────────────────────────────
function CustomFilterTab({ industries }) {
  const [filters,   setFilters]   = useState(DEFAULT_FILTERS)
  const [sortField, setSortField] = useState('compositeScore')
  const [results,   setResults]   = useState([])
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)
  const [ran,       setRan]       = useState(false)

  const set = (k, v) => setFilters(p => ({ ...p, [k]: v }))

  const run = async () => {
    setLoading(true); setError(null)
    try {
      const toNum = (v) => v !== '' ? parseFloat(v) : undefined
      const body = {
        filters: {
          industry:       filters.industry,
          minComposite:   toNum(filters.minComposite),
          minROE:         toNum(filters.minROE),
          maxPE:          toNum(filters.maxPE),
          minProfitGr:    toNum(filters.minProfitGr),
          minSalesGr:     toNum(filters.minSalesGr),
          maxDE:          toNum(filters.maxDE),
          minOPM:         toNum(filters.minOPM),
          minPiotroski:   toNum(filters.minPiotroski),
          minPromoter:    toNum(filters.minPromoter),
          minReturn1y:    toNum(filters.minReturn1y),
          minGrowthScore: toNum(filters.minGrowthScore),
          minSalesScore:  toNum(filters.minSalesScore),
          minRoeScore:    toNum(filters.minRoeScore),
          allGreen:       filters.allGreen,
        },
        sortField,
        n: 100,
      }
      const r = await axios.post('/api/gs/screener', body)
      setResults(r.data?.data || [])
      setRan(true)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  const reset = () => { setFilters(DEFAULT_FILTERS); setResults([]); setRan(false) }

  const FilterInput = ({ label, k, placeholder }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 130 }}>
      <label style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</label>
      <input className="input" style={{ fontSize: 12, padding: '4px 8px' }}
        placeholder={placeholder || ''}
        value={filters[k]} onChange={e => set(k, e.target.value)} />
    </div>
  )

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          {/* Industry */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 180 }}>
            <label style={{ fontSize: 11, color: 'var(--muted)' }}>Industry</label>
            <select className="input" style={{ fontSize: 12, padding: '4px 8px' }}
              value={filters.industry} onChange={e => set('industry', e.target.value)}>
              <option value="">All Industries</option>
              {industries.map(ind => <option key={ind} value={ind}>{ind}</option>)}
            </select>
          </div>
          <FilterInput label="Min Composite Score" k="minComposite" placeholder="e.g. 60" />
          <FilterInput label="Min ROE (%)"         k="minROE"        placeholder="e.g. 15" />
          <FilterInput label="Max P/E"             k="maxPE"         placeholder="e.g. 30" />
          <FilterInput label="Min Profit Gr 1Y (%)"k="minProfitGr"   placeholder="e.g. 15" />
          <FilterInput label="Min Sales Gr 1Y (%)" k="minSalesGr"    placeholder="e.g. 10" />
          <FilterInput label="Max D/E"             k="maxDE"         placeholder="e.g. 1" />
          <FilterInput label="Min OPM (%)"         k="minOPM"        placeholder="e.g. 15" />
          <FilterInput label="Min Piotroski"       k="minPiotroski"  placeholder="e.g. 6" />
          <FilterInput label="Min Promoter (%)"    k="minPromoter"   placeholder="e.g. 50" />
          <FilterInput label="Min 1Y Return (%)"   k="minReturn1y"   placeholder="e.g. 10" />
          <FilterInput label="Min Growth Score"    k="minGrowthScore"placeholder="e.g. 5" />
          <FilterInput label="Min Sales Score"     k="minSalesScore" placeholder="e.g. 5" />
          <FilterInput label="Min ROE Score"       k="minRoeScore"   placeholder="e.g. 5" />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
          {/* All-green toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={filters.allGreen}
              onChange={e => set('allGreen', e.target.checked)} />
            <span>All 4 momentum signals 🟢</span>
          </label>
          {/* Sort by */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>Sort by</label>
            <select className="input" style={{ fontSize: 12, padding: '4px 8px' }}
              value={sortField} onChange={e => setSortField(e.target.value)}>
              {SORT_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={run} disabled={loading}>
            {loading ? 'Scanning…' : '🔍 Run Screener'}
          </button>
          <button className="btn" onClick={reset} style={{ fontSize: 12 }}>Reset</button>
        </div>
      </div>

      {error   && <ErrorBox msg={error} />}
      {loading && <Loading />}

      {ran && !loading && (
        <div>
          <div style={{ marginBottom: 10, fontSize: 13, color: 'var(--muted)' }}>
            {results.length} companies matched · sorted by <strong>{sortField}</strong>
          </div>
          {results.length === 0
            ? <div className="card" style={{ textAlign: 'center', color: 'var(--muted)' }}>No companies match these filters</div>
            : <SortableTable rows={results} columns={COMPOSITE_COLS} defaultSort={sortField} />
          }
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function AdvancedScreener() {
  const [tab,         setTab]        = useState('composite')
  const [industries,  setIndustries] = useState([])
  const [jumpType,    setJumpType]   = useState('profit')

  // Per-tab data
  const [compositeData, setCompositeData] = useState([])
  const [jumpData,      setJumpData]      = useState([])
  const [greenData,     setGreenData]     = useState([])
  const [roeData,       setRoeData]       = useState([])

  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [loaded,  setLoaded]  = useState({})

  // ── Load industries once ──────────────────────────────────────────────────
  useEffect(() => {
    axios.get('/api/gs/industries').then(r => setIndustries(r.data?.data || [])).catch(() => {})
  }, [])

  // ── Load data per tab ──────────────────────────────────────────────────────
  const loadTab = useCallback(async (t, jType = jumpType) => {
    if (loaded[t === 'jumps' ? `jumps-${jType}` : t]) return
    setLoading(true); setError(null)
    try {
      if (t === 'composite') {
        const r = await axios.get('/api/gs/top?n=100')
        setCompositeData(r.data?.data || [])
      } else if (t === 'jumps') {
        const r = await axios.get(`/api/gs/jumps?type=${jType}&n=50`)
        setJumpData(r.data?.data || [])
        setLoaded(p => ({ ...p, [`jumps-${jType}`]: true }))
        setLoading(false); return
      } else if (t === 'green') {
        const r = await axios.get('/api/gs/all-green?n=50')
        setGreenData(r.data?.data || [])
      } else if (t === 'roe') {
        const r = await axios.get('/api/gs/roe-consistency?n=50')
        setRoeData(r.data?.data || [])
      }
      setLoaded(p => ({ ...p, [t]: true }))
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }, [loaded, jumpType])

  useEffect(() => { if (tab !== 'custom') loadTab(tab) }, [tab])

  const handleJumpType = (jt) => {
    setJumpType(jt)
    setLoaded(p => ({ ...p, [`jumps-${jt}`]: false }))
    loadTab('jumps', jt)
  }

  const TABS = [
    { key: 'composite', label: '🏆 Composite Rank' },
    { key: 'jumps',     label: '🚀 Jump Signals' },
    { key: 'green',     label: '🟢 All Green' },
    { key: 'roe',       label: '📈 ROE Consistency' },
    { key: 'custom',    label: '⚙️ Custom Filter' },
  ]

  return (
    <div className="page-container">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Advanced Screener</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
          Powered by 104-column Google Sheet · {compositeData.length || '1,113'} companies · Composite Score, Jump Signals & Momentum
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 18, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.key}
            className={`btn ${tab === t.key ? 'btn-primary' : ''}`}
            style={{ fontSize: 12 }}
            onClick={() => setTab(t.key)}
          >{t.label}</button>
        ))}
      </div>

      {/* Jump type selector */}
      {tab === 'jumps' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Jump type:</span>
          {['profit', 'sales', 'roe'].map(jt => (
            <button key={jt}
              className={`btn ${jumpType === jt ? 'btn-primary' : ''}`}
              style={{ fontSize: 12 }}
              onClick={() => handleJumpType(jt)}
            >{jt.charAt(0).toUpperCase() + jt.slice(1)}</button>
          ))}
        </div>
      )}

      {error   && <ErrorBox msg={error} />}
      {loading && <Loading />}

      {/* Tab content */}
      {!loading && !error && (
        <>
          {tab === 'composite' && compositeData.length > 0 && (
            <SortableTable rows={compositeData} columns={COMPOSITE_COLS} defaultSort="compositeScore" />
          )}
          {tab === 'jumps' && jumpData.length > 0 && (
            <>
              <div style={{ marginBottom: 10, fontSize: 13, color: 'var(--muted)' }}>
                Companies with both short-term <em>and</em> long-term {jumpType} acceleration (both &gt; 0%)
              </div>
              <SortableTable rows={jumpData} columns={JUMP_COLS} defaultSort="shortVal" />
            </>
          )}
          {tab === 'green' && greenData.length > 0 && (
            <>
              <div style={{ marginBottom: 10, fontSize: 13, color: 'var(--muted)' }}>
                All 4 momentum signals green: QoQ Sales 🟢 · YoY Sales 🟢 · YoY PAT 🟢 · QoQ PAT 🟢
              </div>
              <SortableTable rows={greenData} columns={GREEN_COLS} defaultSort="compositeScore" />
            </>
          )}
          {tab === 'roe' && roeData.length > 0 && (
            <>
              <div style={{ marginBottom: 10, fontSize: 13, color: 'var(--muted)' }}>
                ROE consistently above 3-year and 5-year historical averages — compounders
              </div>
              <SortableTable rows={roeData} columns={ROE_COLS} defaultSort="roeScore" />
            </>
          )}
          {tab === 'custom' && (
            <CustomFilterTab industries={industries} />
          )}
        </>
      )}
    </div>
  )
}
