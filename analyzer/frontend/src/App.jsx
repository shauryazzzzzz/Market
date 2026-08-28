import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, ReferenceLine } from 'recharts';

const API = '/api/analyzer';

// ── Helpers ───────────────────────────────────────────────────────────────────
async function apiFetch(url, opts) {
  const resp = await fetch(url, opts);
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
    throw new Error(err.error || `HTTP ${resp.status}`);
  }
  return resp.json();
}

function fmt(n, decimals = 2) {
  if (n == null || isNaN(n)) return 'N/A';
  return Number(n).toLocaleString('en-IN', { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

function fmtLarge(n) {
  if (n == null || isNaN(n)) return 'N/A';
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e7) return (n / 1e7).toFixed(2) + 'Cr';
  if (n >= 1e5) return (n / 1e5).toFixed(2) + 'L';
  return Number(n).toLocaleString();
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
  return <div className="loading-state"><div className="spinner" /><span>Fetching live data…</span></div>;
}

// ── Shared ticker input bar ───────────────────────────────────────────────────
function TickerBar({ onSearch, placeholder, loading }) {
  const [val, setVal] = useState('');
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 24, maxWidth: 480 }}>
      <input className="input" placeholder={placeholder || 'Enter ticker (e.g. RELIANCE.NS, MSFT)'} value={val}
        onChange={e => setVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && onSearch(val.trim().toUpperCase())}
        style={{ textTransform: 'uppercase' }} />
      <button className="btn btn-primary" onClick={() => onSearch(val.trim().toUpperCase())} disabled={loading || !val.trim()}>
        {loading ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Fetching</> : 'Analyze'}
      </button>
    </div>
  );
}

// ── Pages ─────────────────────────────────────────────────────────────────────

function AnalyzerHome() {
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
  if (error) return <ErrorState title="Backend Offline — cannot load real data" message={error} url={`${API}/health`} />;

  return (
    <div>
      <h1 className="section-title">ANALYZER</h1>
      <p className="section-sub">Live AI-powered stock analysis using real-time market data</p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">LLM Backend</div>
          <div className="stat-value" style={{ fontSize: 20, marginTop: 8 }}>
            {health.watsonxConfigured
              ? <span className="pos">IBM watsonx ✓</span>
              : health.icaConfigured
                ? <span className="pos">ICA ✓</span>
                : health.geminiConfigured
                  ? <span className="warning">Gemini (fallback)</span>
                  : <span className="neg">Not Configured</span>}
          </div>
          <div className="stat-sub">{health.primaryModel || health.llmBackend || 'IBM watsonx.ai'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Market Data</div>
          <div className="stat-value" style={{ fontSize: 20, marginTop: 8 }}>
            {health.yahooFinance === 'ok' ? <span className="pos">Yahoo Finance ✓</span> : <span className="neg">Error</span>}
          </div>
          <div className="stat-sub">Live quotes & history</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Server Port</div>
          <div className="stat-value" style={{ fontSize: 20, marginTop: 8, fontFamily: 'var(--mono)' }}>5002</div>
          <div className="stat-sub">{new Date(health.timestamp).toLocaleTimeString()}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Available Features</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginTop: 4 }}>
          {[
            { label: 'Live Quote', desc: 'Real-time price, volume, P/E' },
            { label: 'LLM Deep Dive', desc: 'AI analysis grounded in live data' },
            { label: 'Technical Chart', desc: 'Candlestick + indicators from OHLCV' },
            { label: 'Indicators', desc: 'RSI, MACD, EMA, Bollinger Bands' },
            { label: 'Compare Stocks', desc: 'AI comparative analysis' },
            { label: 'LLM Chat', desc: 'Ask questions with live context' }
          ].map(f => (
            <div key={f.label} style={{ padding: 14, background: 'var(--surface2)', borderRadius: 6, border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 600, color: 'var(--accent)', fontSize: 13, marginBottom: 4 }}>{f.label}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16, fontSize: 12, color: 'var(--muted)', lineHeight: 1.8 }}>
        <div className="card-title">Important Notes</div>
        <ul style={{ paddingLeft: 20 }}>
          <li>NSE stocks: append <code style={{ background: 'var(--surface2)', padding: '1px 6px', borderRadius: 4, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>.NS</code> (e.g. RELIANCE.NS, HDFCBANK.NS)</li>
          <li>US stocks: use plain symbol (e.g. MSFT, AAPL, TSLA)</li>
          <li>All analysis is grounded in real fetched data — no fabrication</li>
          <li>If any API fails, you will see an explicit error — no fallback fake data</li>
        </ul>
      </div>
    </div>
  );
}

function DeepDive() {
  const [symbol, setSymbol] = useState('');
  const [quote, setQuote] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const analyze = useCallback(async (sym) => {
    if (!sym) return;
    setSymbol(sym);
    setLoading(true);
    setError(null);
    setQuote(null);
    setAnalysis(null);
    try {
      const [q, a] = await Promise.all([
        apiFetch(`${API}/quote/${sym}`),
        apiFetch(`${API}/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker: sym, analysisType: 'comprehensive' })
        })
      ]);
      setQuote(q);
      setAnalysis(a);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const change = quote ? (quote.change || 0) : 0;
  const changePos = change >= 0;

  return (
    <div>
      <h1 className="section-title">Deep Dive Analysis</h1>
      <p className="section-sub">AI-powered analysis using live quote + real technical indicators</p>

      <TickerBar onSearch={analyze} loading={loading} placeholder="e.g. RELIANCE.NS, HDFCBANK.NS, MSFT" />

      {loading && <Loading />}

      {error && <ErrorState title="Analysis Failed — cannot load real data" message={error} url={`${API}/analyze`} />}

      {quote && !loading && (
        <div className="stats-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">{quote.name || quote.symbol}</div>
            <div className="stat-value" style={{ fontSize: 24 }}>{fmt(quote.price)}</div>
            <div className={changePos ? 'pos' : 'neg'} style={{ fontSize: 13, marginTop: 4 }}>
              {changePos ? '+' : ''}{fmt(quote.change)} ({fmt(quote.changePercent)}%)
            </div>
            <div className="stat-sub">{quote.currency} · {quote.exchange}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Market Cap</div>
            <div className="stat-value" style={{ fontSize: 22 }}>{fmtLarge(quote.marketCap)}</div>
            <div className="stat-sub">P/E: {fmt(quote.pe)} · EPS: {fmt(quote.eps)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">52-Week Range</div>
            <div className="stat-value" style={{ fontSize: 18 }}>{fmt(quote.fiftyTwoWeekLow)} – {fmt(quote.fiftyTwoWeekHigh)}</div>
            <div className="stat-sub">Current: {fmt(quote.price)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Volume</div>
            <div className="stat-value" style={{ fontSize: 22 }}>{fmtLarge(quote.volume)}</div>
            <div className="stat-sub">Open: {fmt(quote.open)} · Prev Close: {fmt(quote.previousClose)}</div>
          </div>
        </div>
      )}

      {analysis && !loading && (
        <div>
          {analysis.technicals && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-title">Technical Indicators (from {analysis.technicals.dataPoints} days of real data)</div>
              <div className="stats-grid" style={{ marginBottom: 0 }}>
                {[
                  { label: 'RSI (14)', value: analysis.technicals.rsi != null ? fmt(analysis.technicals.rsi, 1) : 'N/A',
                    color: analysis.technicals.rsi > 70 ? 'var(--negative)' : analysis.technicals.rsi < 30 ? 'var(--positive)' : 'var(--text)' },
                  { label: 'EMA 20', value: fmt(analysis.technicals.ema20) },
                  { label: 'EMA 50', value: fmt(analysis.technicals.ema50) },
                  { label: 'BB Upper', value: fmt(analysis.technicals.bb?.upper) },
                  { label: 'BB Middle', value: fmt(analysis.technicals.bb?.middle) },
                  { label: 'BB Lower', value: fmt(analysis.technicals.bb?.lower) },
                ].map(ind => (
                  <div key={ind.label} className="stat-card">
                    <div className="stat-label">{ind.label}</div>
                    <div className="stat-value" style={{ fontSize: 20, color: ind.color || 'var(--text)' }}>{ind.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-title">
              AI Analysis · {analysis.dataSource} · {new Date(analysis.analyzedAt).toLocaleString()}
            </div>
            <div className="analysis-output">{analysis.analysis}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function TechnicalChart() {
  const [history, setHistory] = useState(null);
  const [technicals, setTechnicals] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('6mo');

  const fetch_ = useCallback(async (sym) => {
    if (!sym) return;
    setLoading(true);
    setError(null);
    setHistory(null);
    setTechnicals(null);
    try {
      const [h, t] = await Promise.all([
        apiFetch(`${API}/history/${sym}?period=${period}`),
        apiFetch(`${API}/technicals/${sym}`)
      ]);
      setHistory(h);
      setTechnicals(t);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [period]);

  const chartData = history ? history.data.map(d => ({
    date: d.date,
    close: d.close,
    high: d.high,
    low: d.low,
    open: d.open,
    volume: d.volume
  })) : [];

  return (
    <div>
      <h1 className="section-title">Technical Chart</h1>
      <p className="section-sub">Real OHLCV data from Yahoo Finance</p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, maxWidth: 360 }}>
          <TickerBar onSearch={fetch_} loading={loading} placeholder="e.g. HDFCBANK.NS, AAPL" />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['1mo', '3mo', '6mo', '1y', '2y'].map(p => (
            <button key={p} className="btn" onClick={() => setPeriod(p)}
              style={{ border: p === period ? '1px solid var(--accent)' : undefined, color: p === period ? 'var(--accent)' : undefined }}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {loading && <Loading />}
      {error && <ErrorState title="Chart Data Failed" message={error} />}

      {history && !loading && (
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-title">{history.symbol} · Close Price ({history.count} trading days)</div>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fill: 'var(--muted)', fontSize: 11 }} tickLine={false}
                  tickFormatter={d => d.slice(5)} interval={Math.floor(chartData.length / 8)} />
                <YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} tickLine={false}
                  domain={['auto', 'auto']} tickFormatter={v => fmt(v, 0)} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: 'var(--muted)' }}
                  itemStyle={{ color: 'var(--accent)' }}
                  formatter={v => [fmt(v), 'Close']} />
                <Line type="monotone" dataKey="close" stroke="var(--accent)" dot={false} strokeWidth={2} />
                {technicals?.ema20 && <ReferenceLine y={technicals.ema20} stroke="#ffaa00" strokeDasharray="4 2" label={{ value: 'EMA20', fill: '#ffaa00', fontSize: 10 }} />}
                {technicals?.ema50 && <ReferenceLine y={technicals.ema50} stroke="var(--positive)" strokeDasharray="4 2" label={{ value: 'EMA50', fill: 'var(--positive)', fontSize: 10 }} />}
                {technicals?.bollingerBands && (
                  <>
                    <ReferenceLine y={technicals.bollingerBands.upper} stroke="var(--muted)" strokeDasharray="2 2" />
                    <ReferenceLine y={technicals.bollingerBands.lower} stroke="var(--muted)" strokeDasharray="2 2" />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {technicals && (
            <div className="card">
              <div className="card-title">Computed Indicators ({technicals.dataPoints} data points)</div>
              <div className="stats-grid">
                {[
                  { label: 'RSI (14)', value: fmt(technicals.rsi14, 1), color: technicals.rsi14 > 70 ? 'var(--negative)' : technicals.rsi14 < 30 ? 'var(--positive)' : 'var(--text)', note: technicals.rsi14 > 70 ? 'Overbought' : technicals.rsi14 < 30 ? 'Oversold' : 'Neutral' },
                  { label: 'EMA 20', value: fmt(technicals.ema20) },
                  { label: 'EMA 50', value: fmt(technicals.ema50) },
                  { label: 'EMA 200', value: fmt(technicals.ema200) || 'Insufficient data' },
                  { label: 'MACD Line', value: technicals.macd ? fmt(technicals.macd.macdLine, 4) : 'N/A' },
                  { label: 'ATR (14)', value: fmt(technicals.atr14, 2) },
                  { label: 'BB Upper', value: fmt(technicals.bollingerBands?.upper) },
                  { label: 'BB Lower', value: fmt(technicals.bollingerBands?.lower) },
                ].map(ind => (
                  <div key={ind.label} className="stat-card">
                    <div className="stat-label">{ind.label}</div>
                    <div className="stat-value" style={{ fontSize: 18, color: ind.color || 'var(--text)' }}>{ind.value}</div>
                    {ind.note && <div className="stat-sub">{ind.note}</div>}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
                Calculated from real historical data fetched {new Date(technicals.fetchedAt).toLocaleString()}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ComparativeAnalysis() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const compare = async () => {
    const tickers = input.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
    if (tickers.length < 2) { setError('Enter at least 2 comma-separated tickers'); return; }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await apiFetch(`${API}/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers })
      });
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="section-title">Comparative Analysis</h1>
      <p className="section-sub">AI comparison of multiple stocks using live data</p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, maxWidth: 600 }}>
        <input className="input" placeholder="e.g. HDFCBANK.NS, ICICIBANK.NS, SBIN.NS" value={input}
          onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && compare()} />
        <button className="btn btn-primary" onClick={compare} disabled={loading || !input.trim()}>
          {loading ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Comparing</> : 'Compare'}
        </button>
      </div>

      {loading && <Loading />}
      {error && <ErrorState title="Comparison Failed" message={error} />}

      {result && !loading && (
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-title">Live Quotes Used as Context</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Symbol</th><th>Price</th><th>P/E</th><th>Market Cap</th></tr>
                </thead>
                <tbody>
                  {result.quotes.map(q => (
                    <tr key={q.symbol}>
                      <td style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{q.symbol}</td>
                      <td style={{ fontFamily: 'var(--mono)' }}>{fmt(q.price)}</td>
                      <td style={{ fontFamily: 'var(--mono)' }}>{fmt(q.pe)}</td>
                      <td style={{ fontFamily: 'var(--mono)' }}>{fmtLarge(q.marketCap)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <div className="card-title">AI Comparative Analysis · {new Date(result.analyzedAt).toLocaleString()}</div>
            <div className="analysis-output">{result.analysis}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function LLMChat() {
  const [ticker, setTicker] = useState('');
  const [activeTicker, setActiveTicker] = useState(null);
  const [quote, setQuote] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadTicker = async (sym) => {
    setLoading(true);
    setError(null);
    setQuote(null);
    setMessages([]);
    try {
      const q = await apiFetch(`${API}/quote/${sym}`);
      setQuote(q);
      setActiveTicker(sym);
      setMessages([{ role: 'system', text: `Context loaded: ${sym} at ${fmt(q.price)} ${q.currency}. P/E: ${fmt(q.pe)}. 52w High: ${fmt(q.fiftyTwoWeekHigh)}. Ask me anything about this stock.` }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !activeTicker) return;
    const userMsg = { role: 'user', text: input };
    setMessages(m => [...m, userMsg]);
    const q = input;
    setInput('');
    setLoading(true);

    try {
      const data = await apiFetch(`${API}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: activeTicker, analysisType: q })
      });
      setMessages(m => [...m, { role: 'assistant', text: data.analysis, timestamp: data.analyzedAt }]);
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', text: `Error: ${e.message}`, error: true }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="section-title">LLM Chat</h1>
      <p className="section-sub">Chat with AI about a stock using live market data as context</p>

      {!activeTicker && (
        <div style={{ maxWidth: 480, marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <input className="input" placeholder="Load a ticker first, e.g. RELIANCE.NS"
              value={ticker} onChange={e => setTicker(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadTicker(ticker.trim().toUpperCase())} />
            <button className="btn btn-primary" onClick={() => loadTicker(ticker.trim().toUpperCase())} disabled={loading || !ticker.trim()}>
              {loading ? <div className="spinner" style={{ width: 14, height: 14 }} /> : 'Load'}
            </button>
          </div>
          {error && <ErrorState title="Cannot load ticker data" message={error} />}
        </div>
      )}

      {activeTicker && quote && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '10px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
            <span className="badge badge-accent" style={{ fontFamily: 'var(--mono)', fontSize: 14, padding: '4px 10px' }}>{activeTicker}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 600 }}>{fmt(quote.price)} {quote.currency}</span>
            <span className={quote.change >= 0 ? 'pos' : 'neg'}>{quote.change >= 0 ? '+' : ''}{fmt(quote.changePercent)}%</span>
            <span className="muted" style={{ marginLeft: 'auto', fontSize: 12 }}>Live context loaded</span>
            <button className="btn" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => { setActiveTicker(null); setQuote(null); setMessages([]); }}>Clear</button>
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, minHeight: 320, maxHeight: 480, overflowY: 'auto', padding: 16, marginBottom: 12 }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                marginBottom: 16,
                textAlign: m.role === 'user' ? 'right' : 'left'
              }}>
                <div style={{ display: 'inline-block', maxWidth: '80%', padding: '10px 14px', borderRadius: 8,
                  background: m.role === 'user' ? 'rgba(0,212,255,0.1)' : m.error ? 'rgba(255,68,68,0.1)' : 'var(--surface2)',
                  border: `1px solid ${m.role === 'user' ? 'rgba(0,212,255,0.2)' : 'var(--border)'}`,
                  fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', textAlign: 'left',
                  color: m.role === 'system' ? 'var(--muted)' : m.error ? 'var(--negative)' : 'var(--text)'
                }}>
                  {m.text}
                </div>
                {m.timestamp && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>{new Date(m.timestamp).toLocaleTimeString()}</div>}
              </div>
            ))}
            {loading && <div className="loading-state" style={{ padding: 16 }}><div className="spinner" /><span>Generating response…</span></div>}
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <input className="input" placeholder={`Ask about ${activeTicker}…`} value={input}
              onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} />
            <button className="btn btn-primary" onClick={sendMessage} disabled={loading || !input.trim()}>Send</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Layout ─────────────────────────────────────────────────────────────────────
const navItems = [
  { to: '/home', label: '🏠 Home' },
  { to: '/deepdive', label: '🔬 Deep Dive' },
  { to: '/chart', label: '📈 Technical Chart' },
  { to: '/compare', label: '⚖️ Compare Stocks' },
  { to: '/chat', label: '💬 LLM Chat' },
];

function Layout({ children }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <span className="topbar-brand">ANALYZER</span>
        <span className="topbar-badge">:3002 / :5002</span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>AI-Powered Stock Analysis · Live Data</span>
      </header>
      <div className="main-layout">
        <nav className="sidebar">
          <div className="sidebar-section">
            <div className="sidebar-section-title">Analysis Tools</div>
            {navItems.map(n => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
                {n.label}
              </NavLink>
            ))}
          </div>
          <div className="sidebar-section" style={{ marginTop: 24, padding: '0 20px' }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.7 }}>
              <div style={{ fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Data Source</div>
              <div>Yahoo Finance (live)</div>
              <div>IBM watsonx.ai (primary)</div>
              <div>ICA → Gemini (fallback)</div>
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
          <Route path="/home" element={<AnalyzerHome />} />
          <Route path="/deepdive" element={<DeepDive />} />
          <Route path="/chart" element={<TechnicalChart />} />
          <Route path="/compare" element={<ComparativeAnalysis />} />
          <Route path="/chat" element={<LLMChat />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
