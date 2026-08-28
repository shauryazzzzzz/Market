import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';

const API = '/api/news';

// ── Helpers ───────────────────────────────────────────────────────────────────
async function apiFetch(url, opts) {
  const resp = await fetch(url, opts);
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
    throw new Error(err.error || `HTTP ${resp.status}`);
  }
  return resp.json();
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function ErrorState({ title, message, url }) {
  return (
    <div className="error-state">
      <div className="error-title">{title || 'Error Loading Data'}</div>
      <div className="error-msg">{message}</div>
      {url && <div className="error-msg" style={{ marginTop: 4, fontSize: 11 }}>Attempted: {url}</div>}
    </div>
  );
}

function Loading() {
  return <div className="loading-state"><div className="spinner" /><span>Fetching live news…</span></div>;
}

// ── News Card ─────────────────────────────────────────────────────────────────
function NewsCard({ article }) {
  return (
    <div className="news-card">
      <div className="news-card-meta">
        <span className="news-source">{article.source}</span>
        <span className="news-time">{timeAgo(article.publishedAt)}</span>
        {article.url && (
          <a href={article.url} target="_blank" rel="noopener noreferrer"
            style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--accent)' }}>
            Read →
          </a>
        )}
      </div>
      <div className="news-headline">{article.headline}</div>
      {article.summary && article.summary !== article.headline && (
        <div className="news-summary">{article.summary?.slice(0, 200)}{article.summary?.length > 200 ? '…' : ''}</div>
      )}
    </div>
  );
}

// ── Pages ─────────────────────────────────────────────────────────────────────

function GlobalFeed() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiFetch(`${API}/global`)
      .then(d => { setArticles(d.articles || []); setFetchedAt(d.fetchedAt); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, []);

  if (loading) return <Loading />;
  if (error) return <ErrorState title="Backend Offline — cannot load real news" message={error} url={`${API}/global`} />;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 className="section-title" style={{ marginBottom: 4 }}>Global Financial Feed</h1>
          <p style={{ color: 'var(--muted)', fontSize: 12 }}>
            {articles.length} articles · Fetched {fetchedAt ? new Date(fetchedAt).toLocaleTimeString() : '—'}
          </p>
        </div>
        <button className="btn" style={{ marginLeft: 'auto' }} onClick={load}>↻ Refresh</button>
      </div>
      {articles.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div className="muted">No articles returned from news API. Check API key configuration.</div>
        </div>
      ) : (
        articles.map((a, i) => <NewsCard key={a.id || i} article={a} />)
      )}
    </div>
  );
}

function SectorNews() {
  const sectors = ['Technology', 'Finance', 'Energy', 'Healthcare', 'Consumer', 'Industrial', 'Real Estate', 'Telecom'];
  const [activeSector, setActiveSector] = useState('Technology');
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback((sector) => {
    setLoading(true);
    setError(null);
    apiFetch(`${API}/sector/${encodeURIComponent(sector)}`)
      .then(d => setArticles(d.articles || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(activeSector); }, [activeSector]);

  return (
    <div>
      <h1 className="section-title">Sector News</h1>
      <p className="section-sub">News filtered by sector from live news APIs</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {sectors.map(s => (
          <button key={s} className="btn" onClick={() => setActiveSector(s)}
            style={{ border: s === activeSector ? '1px solid var(--accent)' : undefined, color: s === activeSector ? 'var(--accent)' : undefined }}>
            {s}
          </button>
        ))}
      </div>

      {loading && <Loading />}
      {error && <ErrorState title={`News unavailable for ${activeSector}`} message={error} />}
      {!loading && !error && articles.map((a, i) => <NewsCard key={a.id || i} article={a} />)}
      {!loading && !error && articles.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div className="muted">No articles found for {activeSector}. Check NEWS_API_KEY in .env</div>
        </div>
      )}
    </div>
  );
}

function TickerNews() {
  const [query, setQuery] = useState('');
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(null);

  const search = async (sym) => {
    if (!sym) return;
    setLoading(true);
    setError(null);
    setArticles([]);
    setSearched(sym);
    try {
      const d = await apiFetch(`${API}/ticker/${encodeURIComponent(sym)}`);
      setArticles(d.articles || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="section-title">Ticker News</h1>
      <p className="section-sub">News specifically about a stock ticker via Finnhub company-news API</p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, maxWidth: 480 }}>
        <input className="input" placeholder="Enter ticker, e.g. AAPL, MSFT, RELIANCE"
          value={query} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search(query.trim().toUpperCase())} />
        <button className="btn btn-primary" onClick={() => search(query.trim().toUpperCase())} disabled={loading || !query.trim()}>
          {loading ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Loading</> : 'Search'}
        </button>
      </div>

      {loading && <Loading />}
      {error && <ErrorState title={`News unavailable for ${searched}`} message={error} />}
      {!loading && !error && articles.length === 0 && searched && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div className="muted">No news found for {searched} in the last 7 days</div>
        </div>
      )}
      {articles.map((a, i) => <NewsCard key={a.id || i} article={a} />)}
    </div>
  );
}

function ImpactAnalyzer() {
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const analyze = async () => {
    if (!headline.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await apiFetch(`${API}/impact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headline: headline.trim(), body: body.trim() })
      });
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const dirColor = (d) => d === 'bullish' ? 'var(--positive)' : d === 'bearish' ? 'var(--negative)' : 'var(--muted)';
  const chipClass = (d) => d === 'bullish' ? 'impact-chip chip-bull' : d === 'bearish' ? 'impact-chip chip-bear' : 'impact-chip chip-neutral';

  return (
    <div>
      <h1 className="section-title">Impact Analyzer</h1>
      <p className="section-sub">Paste a news headline — AI returns structured market impact analysis</p>

      <div style={{ maxWidth: 700, marginBottom: 24 }}>
        <input className="input" placeholder="News headline, e.g. 'RBI raises repo rate by 25 bps to 6.75%'"
          value={headline} onChange={e => setHeadline(e.target.value)} style={{ marginBottom: 10 }} />
        <textarea className="input" placeholder="Optional: paste full article body for more accurate analysis"
          value={body} onChange={e => setBody(e.target.value)}
          style={{ minHeight: 100, resize: 'vertical', fontFamily: 'var(--font)', marginBottom: 10 }} />
        <button className="btn btn-primary" onClick={analyze} disabled={loading || !headline.trim()}>
          {loading ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Analyzing</> : '⚡ Analyze Impact'}
        </button>
      </div>

      {loading && <Loading />}
      {error && <ErrorState title="Impact Analysis Failed" message={error} />}

      {result && !loading && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">Headline Analyzed</div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>{result.headline}</div>
            <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ fontWeight: 700, color: dirColor(result.impact.overallSignal), fontSize: 14 }}>
                ● {result.impact.overallSignal?.toUpperCase()}
              </span>
              <span className="badge badge-neutral">Confidence: {result.impact.confidenceLevel}</span>
              <span className="badge badge-neutral">{result.impact.timeframe}</span>
              <span className="muted" style={{ fontSize: 11, marginLeft: 'auto' }}>{new Date(result.analyzedAt).toLocaleString()}</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {[
              { label: 'Affected Tickers', items: result.impact.affectedTickers, key: 'symbol' },
              { label: 'Affected Sectors', items: result.impact.affectedSectors, key: 'sector' },
              { label: 'Indices Impact', items: result.impact.affectedIndices, key: 'index' },
              { label: 'Commodities', items: result.impact.commodityImpact, key: 'commodity' },
              { label: 'Currencies', items: result.impact.currencyImpact, key: 'currency' },
            ].filter(g => g.items?.length > 0).map(group => (
              <div key={group.label} className="card">
                <div className="card-title">{group.label}</div>
                {group.items.map((item, i) => (
                  <div key={i} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: i < group.items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--text)' }}>{item[group.key]}</span>
                      <span className={chipClass(item.direction)}>{item.direction}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{item.reason}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-title">Analyst Reasoning</div>
            <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.8 }}>{result.impact.reasoning}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function TrendingTopics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiFetch(`${API}/trending`)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const treeData = data?.trending
    ? [{ name: 'Trending Topics', children: data.trending.map(t => ({ name: t.topic, size: t.count })) }]
    : [];

  const COLORS = ['#00d4ff', '#00ff88', '#ffaa00', '#7c5cd8', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dfe6e9'];

  return (
    <div>
      <h1 className="section-title">Trending Topics</h1>
      <p className="section-sub">Most frequent terms extracted from live financial news headlines</p>

      {loading && <Loading />}
      {error && <ErrorState title="Could not fetch trending data" message={error} />}

      {data && !loading && (
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-title">Topic Frequency Map ({data.articleCount} articles analyzed)</div>
            <ResponsiveContainer width="100%" height={300}>
              <Treemap data={treeData} dataKey="size" aspectRatio={4 / 3}
                content={({ x, y, width, height, name, index }) => (
                  <g>
                    <rect x={x} y={y} width={width} height={height}
                      fill={COLORS[index % COLORS.length]} fillOpacity={0.8}
                      stroke="var(--bg)" strokeWidth={2} rx={4} />
                    {width > 50 && height > 20 && (
                      <text x={x + width / 2} y={y + height / 2} textAnchor="middle"
                        dominantBaseline="middle" fill="#0a0e1a" fontSize={Math.min(13, width / 5)}
                        fontWeight={600} fontFamily="IBM Plex Sans">
                        {name}
                      </text>
                    )}
                  </g>
                )} />
            </ResponsiveContainer>
          </div>

          <div className="card">
            <div className="card-title">Top 20 Terms</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
              {data.trending.map((t, i) => (
                <div key={t.topic} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--surface2)', borderRadius: 6, border: '1px solid var(--border)' }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: COLORS[i % COLORS.length] }}>{t.topic}</span>
                  <span className="badge badge-neutral">{t.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NewsroomHealth() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiFetch(`${API}/health`)
      .then(setHealth)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (error) return <ErrorState title="Backend Offline" message={error} url={`${API}/health`} />;

  return (
    <div>
      <h1 className="section-title">NEWSROOM</h1>
      <p className="section-sub">Global financial news intelligence · Port {health.port}</p>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Gemini LLM</div>
          <div className="stat-value" style={{ fontSize: 18, marginTop: 8 }}>{health.apiKeys.gemini ? <span className="pos">✓ Active</span> : <span className="neg">Not Set</span>}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">NewsAPI</div>
          <div className="stat-value" style={{ fontSize: 18, marginTop: 8 }}>{health.apiKeys.newsApi ? <span className="pos">✓ Active</span> : <span className="neg">Not Set</span>}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Finnhub</div>
          <div className="stat-value" style={{ fontSize: 18, marginTop: 8 }}>{health.apiKeys.finnhub === true ? <span className="pos">✓ Active</span> : <span className="warning">Sandbox</span>}</div>
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">API Key Setup Instructions</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.8 }}>
          <p>Configure keys in <code style={{ background: 'var(--surface2)', padding: '1px 6px', borderRadius: 4, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>newsroom/.env</code>:</p>
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            <li><strong style={{ color: 'var(--text)' }}>GEMINI_API_KEY</strong> — for Impact Analysis (Google AI Studio, free tier)</li>
            <li><strong style={{ color: 'var(--text)' }}>NEWS_API_KEY</strong> — for Global/Sector feeds (newsapi.org, free tier)</li>
            <li><strong style={{ color: 'var(--text)' }}>FINNHUB_API_KEY</strong> — for company-specific news (finnhub.io, free tier)</li>
          </ul>
          <p style={{ marginTop: 8 }}>Without keys: Finnhub sandbox is used for ticker news. LLM features require Gemini key.</p>
        </div>
      </div>
    </div>
  );
}

// ── Layout ─────────────────────────────────────────────────────────────────────
const navItems = [
  { to: '/home', label: '🏠 Home' },
  { to: '/global', label: '🌍 Global Feed' },
  { to: '/sector', label: '🏭 Sector News' },
  { to: '/ticker', label: '🔍 Ticker News' },
  { to: '/impact', label: '⚡ Impact Analyzer' },
  { to: '/trending', label: '📊 Trending Topics' },
];

function Layout({ children }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <span className="topbar-brand">NEWSROOM</span>
        <span className="topbar-badge">:3003 / :5003</span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>Financial News Intelligence · Live APIs</span>
      </header>
      <div className="main-layout">
        <nav className="sidebar">
          <div className="sidebar-section">
            <div className="sidebar-section-title">News Feeds</div>
            {navItems.map(n => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
                {n.label}
              </NavLink>
            ))}
          </div>
          <div className="sidebar-section" style={{ marginTop: 24, padding: '0 20px' }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.7 }}>
              <div style={{ fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Data Source</div>
              <div>Finnhub (sandbox/live)</div>
              <div>NewsAPI.org</div>
              <div>Google Gemini 1.5</div>
            </div>
          </div>
        </nav>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<NewsroomHealth />} />
          <Route path="/global" element={<GlobalFeed />} />
          <Route path="/sector" element={<SectorNews />} />
          <Route path="/ticker" element={<TickerNews />} />
          <Route path="/impact" element={<ImpactAnalyzer />} />
          <Route path="/trending" element={<TrendingTopics />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
