/**
 * NewsMapPage.jsx
 * Embedded integration of the NewsFeed-Google-AI- mindmap news viewer into the Aladdin platform.
 * Embeds the NewsFeed app in an iframe (port 3002) and adds a teaser card that shows the
 * live RSS feed via the same server's /api/news endpoint (proxied at /nf-api).
 */
import { useState, useEffect } from 'react'
import axios from 'axios'
import { Loading } from '../components/shared'

// ── Hierarchy badge ───────────────────────────────────────────────────────────
function LevelBadge({ level }) {
  const colors = {
    1: '#f59e0b', 2: '#3b82f7', 3: '#22c55e', 4: '#a855f7', 5: '#ef4444'
  }
  const labels = { 1: 'Global', 2: 'Region', 3: 'Sector', 4: 'Stock', 5: 'Detail' }
  return (
    <span style={{
      fontSize: 9, padding: '1px 6px', borderRadius: 3,
      background: (colors[level] || '#888') + '22',
      color: colors[level] || '#888',
      fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase'
    }}>{labels[level] || `L${level}`}</span>
  )
}

// ── Single news node card ─────────────────────────────────────────────────────
function NewsNode({ item }) {
  const chg = parseFloat(item.changePercent) || 0
  return (
    <div className="card" style={{ marginBottom: 10, padding: '12px 14px' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 36, textAlign: 'center' }}>
          <LevelBadge level={item.level} />
          {chg !== 0 && (
            <div style={{ marginTop: 6, fontWeight: 800, fontSize: 14 }}
              className={chg >= 0 ? 'metric-pos' : 'metric-neg'}>
              {chg >= 0 ? '▲' : '▼'}{Math.abs(chg).toFixed(2)}%
            </div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          {item.categoryName && (
            <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>
              {item.categoryName}
            </div>
          )}
          <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.4, marginBottom: 4 }}>
            {item.link
              ? <a href={item.link} target="_blank" rel="noopener noreferrer"
                  style={{ color: 'var(--text)', textDecoration: 'none' }}
                  onMouseEnter={e => e.target.style.color = 'var(--primary)'}
                  onMouseLeave={e => e.target.style.color = 'var(--text)'}
                >{item.title}</a>
              : item.title}
          </div>
          {item.summary && (
            <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>{item.summary}</div>
          )}
          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>
            {item.source && <span style={{ marginRight: 8 }}>📰 {item.source}</span>}
            {item.benchmarkLabel && <span style={{ marginRight: 8 }}>📊 {item.benchmarkLabel}</span>}
          </div>
        </div>
        {item.imageUrl && (
          <img src={item.imageUrl} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
            onError={e => { e.target.style.display = 'none' }} />
        )}
      </div>
    </div>
  )
}

// ── Embedded iframe view ──────────────────────────────────────────────────────
function IframeView() {
  const [loaded, setLoaded] = useState(false)
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div>
          <div className="card-label">Full Interactive App</div>
          <div className="card-title">News MindMap — Google AI / WatsonX</div>
        </div>
        <a href="http://localhost:3002" target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}>
          Open in new tab ↗
        </a>
      </div>
      {!loaded && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          Loading NewsFeed app from <code>localhost:3002</code>…<br />
          <span style={{ fontSize: 11 }}>Make sure it's running: <code>cd NewsFeed-Google-AI- && npm run dev</code></span>
        </div>
      )}
      <iframe
        src="http://localhost:3002"
        title="NewsFeed MindMap"
        style={{ width: '100%', height: 720, border: 'none', display: loaded ? 'block' : 'none' }}
        onLoad={() => setLoaded(true)}
      />
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function NewsMapPage() {
  const [news, setNews]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)
  const [view, setView]     = useState('list') // list | iframe

  useEffect(() => {
    // Try GET /nf-api/news first (maps to /api/news on :3002)
    axios.get('/nf-api/news', { timeout: 15000 })
      .then(r => {
        // Response shape: { items: [...] } or { data: [...] } or array
        const data = Array.isArray(r.data) ? r.data
          : (r.data?.items || r.data?.data || r.data?.newsItems || [])
        if (data.length > 0) {
          setNews(data)
          setLoading(false)
          return
        }
        // Fallback: POST /nf-api/generate-news for live AI hierarchy
        return axios.post('/nf-api/generate-news',
          { dateStr: new Date().toISOString().split('T')[0] },
          { timeout: 20000 }
        ).then(r2 => {
          const d2 = r2.data?.newsItems || r2.data?.items || []
          setNews(d2)
          setLoading(false)
        })
      })
      .catch(() => {
        // Final fallback: try generate-news directly
        axios.post('/nf-api/generate-news',
          { dateStr: new Date().toISOString().split('T')[0] },
          { timeout: 20000 }
        ).then(r3 => {
          const d3 = r3.data?.newsItems || r3.data?.items || []
          setNews(d3)
          setLoading(false)
        }).catch(() => {
          setError('NewsFeed server not running on :3002')
          setNews([])
          setLoading(false)
        })
      })
  }, [])

  const VIEWS = [
    { id: 'list',   label: '📋 News Feed' },
    { id: 'iframe', label: '🗺 MindMap View' },
  ]

  return (
    <div className="page">
      <div style={{ marginBottom: 20 }}>
        <div className="page-title">News MindMap</div>
        <div className="page-sub">AI-generated hierarchy · Google Gemini + WatsonX · RSS live feeds · Mind-map visualisation</div>
      </div>

      {/* View toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {VIEWS.map(v => (
          <button key={v.id} className={`btn btn-sm ${view === v.id ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setView(v.id)}>{v.label}
          </button>
        ))}
        <a href="http://localhost:3002" target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}>
          Open standalone ↗
        </a>
      </div>

      {/* Server offline banner */}
      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(248,81,73,.1)', border: '1px solid rgba(248,81,73,.3)', borderRadius: 6, color: '#f85149', fontSize: 13, marginBottom: 16 }}>
          ⚠️ {error} — Start it with: <code style={{ fontSize: 11 }}>cd tradingview-economy/NewsFeed-Google-AI- && npm run dev</code>
          <br /><span style={{ fontSize: 11 }}>The MindMap view (iframe) will still load once the server is up.</span>
        </div>
      )}

      {/* ── List view ── */}
      {view === 'list' && (
        <>
          {loading && <Loading />}
          {!loading && news.length === 0 && (
            <div className="card">
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--muted)' }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>🗺</div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>No live feed — start the NewsFeed server</div>
                <div style={{ fontSize: 12 }}>
                  Run: <code>cd tradingview-economy/NewsFeed-Google-AI- && npm run dev</code><br />
                  Then switch to <strong>MindMap View</strong> for the full interactive experience.
                </div>
              </div>
            </div>
          )}
          {!loading && news.length > 0 && (
            <>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
                {news.length} items from AI news hierarchy
              </div>
              {news.map((item, i) => <NewsNode key={i} item={item} />)}
            </>
          )}
        </>
      )}

      {/* ── Iframe / MindMap view ── */}
      {view === 'iframe' && <IframeView />}
    </div>
  )
}
