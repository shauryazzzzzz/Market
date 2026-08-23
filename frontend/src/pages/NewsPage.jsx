import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import { Loading, ErrorBox, Signal } from '../components/shared'

const FEEDS = [
  { id: 'all',    label: 'All News' },
  { id: 'india',  label: '🇮🇳 India' },
  { id: 'global', label: '🌍 Global' },
  { id: 'beat',   label: '▲ Bullish' },
  { id: 'bear',   label: '▼ Bearish' },
  { id: 'high',   label: '🔥 High Impact' },
]

const SECTORS = [
  'All Sectors', 'Banking', 'IT', 'Pharma', 'FMCG',
  'Auto', 'Metals', 'Energy', 'Infra', 'Realty',
]

function NewsCard({ item }) {
  const sentClass = item.sentiment === 'positive' ? 'metric-pos' : item.sentiment === 'negative' ? 'metric-neg' : 'metric-neu'
  const dirLabel  = item.direction === 'bullish' ? '▲ Bullish' : item.direction === 'bearish' ? '▼ Bearish' : '→ Neutral'
  const dirClass  = item.direction === 'bullish' ? 'metric-pos' : item.direction === 'bearish' ? 'metric-neg' : 'metric-neu'

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Score column */}
        <div style={{ minWidth: 52, textAlign: 'center', paddingTop: 4 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)' }}>{(item.impactScore || 0).toFixed(1)}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Impact</div>
          <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700 }} className={sentClass}>
            {item.confidence}%
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>confidence</div>
        </div>

        {/* Content */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {item.affected?.sectors?.slice(0,3).map((s, i) => (
              <span key={i} className="news-tag">{s}</span>
            ))}
            {item.affected?.geographies?.slice(0,2).map((g, i) => (
              <span key={i} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 3, background: 'rgba(163,113,247,.12)', color: 'var(--accent)' }}>{g}</span>
            ))}
          </div>

          <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.4, marginBottom: 8 }}>{item.title}</div>

          {item.keyTakeaway && item.keyTakeaway !== item.title && (
            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, padding: '8px 12px', background: 'rgba(47,129,247,.07)', borderRadius: 6, borderLeft: '3px solid var(--primary)', marginBottom: 8 }}>
              💡 {item.keyTakeaway}
            </div>
          )}

          {/* Affected assets */}
          {item.affected?.assetClasses?.length > 0 && (
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>
              <span style={{ marginRight: 6 }}>Asset classes:</span>
              {item.affected.assetClasses.join(', ')}
            </div>
          )}

          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--muted)' }}>
            <span>{item.source}</span>
            <span className={sentClass}>{item.sentiment}</span>
            <span className={dirClass}>{dirLabel}</span>
            {item.pubDate && <span>{new Date(item.pubDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
          </div>
        </div>
      </div>

      {/* Impact bar */}
      <div className="impact-bar" style={{ marginTop: 12 }}>
        <div className="impact-fill" style={{ width: `${Math.min((item.impactScore || 0) * 10, 100)}%` }} />
      </div>
    </div>
  )
}

function HeatmapPanel({ data }) {
  if (!data) return null
  const { geos, sectors, grid } = data
  // Show top 5 geos and 6 sectors for readability
  const showGeos    = geos?.slice(0, 5) || []
  const showSectors = sectors?.slice(0, 6) || []

  const cellColor = (cell) => {
    if (!cell?.count) return 'transparent'
    const s = cell.sentiment || 0
    if (s > 0.2)  return `rgba(63,185,80,${Math.min(0.15 + s * 0.3, 0.8)})`
    if (s < -0.2) return `rgba(248,81,73,${Math.min(0.15 + Math.abs(s) * 0.3, 0.8)})`
    return `rgba(47,129,247,${Math.min(0.1 + cell.count * 0.05, 0.4)})`
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr>
            <th style={{ padding: '6px 8px', color: 'var(--muted)', textAlign: 'left' }}>Region ↓ Sector →</th>
            {showSectors.map(s => (
              <th key={s} style={{ padding: '6px 8px', color: 'var(--muted)', fontWeight: 600 }}>{s}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {showGeos.map(g => (
            <tr key={g}>
              <td style={{ padding: '6px 8px', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>{g}</td>
              {showSectors.map(s => {
                const cell = grid?.[g]?.[s] || {}
                return (
                  <td key={s} style={{ padding: '6px', textAlign: 'center' }}>
                    <div className="heatmap-cell" style={{ background: cellColor(cell), minHeight: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      {cell.count > 0 ? (
                        <>
                          <div>{cell.count}</div>
                          <div style={{ fontSize: 10, marginTop: 1 }}>{cell.avgImpact?.toFixed(1)}</div>
                        </>
                      ) : <div style={{ color: 'var(--border)' }}>—</div>}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function NewsPage() {
  const [news,    setNews]    = useState([])
  const [heatmap, setHeatmap] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('all')
  const [sector,  setSector]  = useState('All Sectors')
  const [search,  setSearch]  = useState('')
  const [error,   setError]   = useState(null)
  const [sortBy,  setSortBy]  = useState('impact')   // 'impact' | 'time'
  const [pinned,  setPinned]  = useState([])          // pinned item indices

  const load = useCallback(async () => {
    setLoading(true)
    const [n, h] = await Promise.allSettled([
      axios.get('/api/news/feed?max=50'),
      axios.get('/api/news/heatmap'),
    ])
    if (n.status === 'fulfilled') setNews(n.value.data?.data || [])
    else setError(n.reason?.message)
    if (h.status === 'fulfilled') setHeatmap(h.value.data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, []) // eslint-disable-line

  const filtered = news.filter(item => {
    // Tab filter
    if (filter === 'india')  return item.affected?.geographies?.includes('India')
    if (filter === 'global') return item.affected?.geographies?.includes('Global') || item.affected?.geographies?.includes('US')
    if (filter === 'beat')   return item.direction === 'bullish'
    if (filter === 'bear')   return item.direction === 'bearish'
    if (filter === 'high')   return (item.impactScore || 0) >= 6
    // Sector filter
    if (sector !== 'All Sectors') {
      const sec = sector.toLowerCase()
      if (!item.affected?.sectors?.some(s => s.toLowerCase().includes(sec))) return false
    }
    // Text search
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      const inTitle = (item.title || '').toLowerCase().includes(q)
      const inTakeaway = (item.keyTakeaway || '').toLowerCase().includes(q)
      const inSectors = (item.affected?.sectors || []).join(' ').toLowerCase().includes(q)
      if (!inTitle && !inTakeaway && !inSectors) return false
    }
    return true
  })

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'impact') return (b.impactScore || 0) - (a.impactScore || 0)
    // time sort — use pubDate
    return new Date(b.pubDate || 0) - new Date(a.pubDate || 0)
  })

  // Sentiment stats
  const bull = news.filter(n => n.direction === 'bullish').length
  const bear = news.filter(n => n.direction === 'bearish').length
  const ratio = news.length ? ((bull / news.length) * 100).toFixed(0) : 50

  return (
    <div className="page">
      <div style={{ marginBottom: 20 }}>
        <div className="page-title">News Intelligence Engine</div>
        <div className="page-sub">AI-scored financial news · Impact analysis · Sector mapping · Key takeaways</div>
      </div>

      {error && <ErrorBox msg={error} />}

      {/* Sentiment summary strip */}
      {!loading && news.length > 0 && (
        <div className="grid-4" style={{ marginBottom: 18 }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <div className="card-label">Market Mood</div>
            <div className="big-value metric-pos" style={{ fontSize: 20, marginTop: 6 }}>{ratio}%</div>
            <div className="sub-value">Bullish stories</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div className="card-label">Total Stories</div>
            <div className="big-value" style={{ fontSize: 20, marginTop: 6 }}>{news.length}</div>
            <div className="sub-value">Last refresh</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div className="card-label">Bullish / Bearish</div>
            <div className="big-value" style={{ fontSize: 20, marginTop: 6 }}>
              <span className="metric-pos">{bull}</span> / <span className="metric-neg">{bear}</span>
            </div>
            <div className="sub-value">Signal count</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div className="card-label">High Impact</div>
            <div className="big-value" style={{ fontSize: 20, marginTop: 6 }}>
              {news.filter(n => (n.impactScore || 0) >= 6).length}
            </div>
            <div className="sub-value">Score ≥ 6.0</div>
          </div>
        </div>
      )}

      {/* Heatmap */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-header">
          <div><div className="card-label">News Impact Heatmap</div><div className="card-title">Geography × Sector Coverage</div></div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Green = bullish · Red = bearish</div>
            <button className="btn btn-sm btn-ghost" onClick={load}>⟳ Refresh</button>
          </div>
        </div>
        {loading ? <Loading /> : <HeatmapPanel data={heatmap} />}
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {FEEDS.map(f => (
          <button key={f.id} className={`btn btn-sm ${filter === f.id ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter(f.id)}>{f.label}
          </button>
        ))}
      </div>

      {/* Second filter row: sectors + search + sort */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="input" style={{ width: 150, padding: '5px 10px', fontSize: 12 }}
          value={sector} onChange={e => setSector(e.target.value)}>
          {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input className="input" placeholder="🔍 Search headlines…" value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 220, fontSize: 12, padding: '5px 10px' }} />
        <div style={{ display: 'flex', gap: 4 }}>
          <button className={`btn btn-sm ${sortBy === 'impact' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setSortBy('impact')}>Sort: Impact</button>
          <button className={`btn btn-sm ${sortBy === 'time' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setSortBy('time')}>Sort: Latest</button>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>
          {sorted.length} stories
        </div>
      </div>

      {/* News list */}
      {loading ? <Loading /> : (
        sorted.length === 0
          ? <div className="loading">No stories match this filter</div>
          : sorted.map((item, i) => <NewsCard key={i} item={item} />)
      )}
    </div>
  )
}
