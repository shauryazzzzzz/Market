/**
 * LiveQuotesPage — Real-time NSE/Global quotes via Yahoo Finance
 * Fetches live price, change %, RSI (server-computed from history), volume, P/E
 * Default tickers: top Indian large-caps. User can add/remove via input.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fmtNum } from './utils';

const API = '/api/funda/live';

// Popular NSE tickers with .NS suffix for Yahoo Finance
const DEFAULT_TICKERS = [
  'RELIANCE.NS','TCS.NS','HDFCBANK.NS','INFY.NS','ICICIBANK.NS',
  'SBIN.NS','WIPRO.NS','AXISBANK.NS','KOTAKBANK.NS','LT.NS',
  'HINDUNILVR.NS','BAJFINANCE.NS','MARUTI.NS','SUNPHARMA.NS','TITAN.NS',
];

function changeBadge(v) {
  const n = parseFloat(v) || 0;
  const color = n >= 0 ? 'var(--up)' : 'var(--down)';
  return <span style={{ color, fontWeight: 700, fontSize: 13 }}>{n >= 0 ? '+' : ''}{n.toFixed(2)}%</span>;
}

function LiveTicker({ q, onRemove }) {
  const isUp = (q.changePct || 0) >= 0;
  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${isUp ? 'rgba(38,166,154,0.25)' : 'rgba(239,83,80,0.25)'}`,
      borderLeft: `3px solid ${isUp ? 'var(--up)' : 'var(--down)'}`,
      borderRadius: 6, padding: '10px 14px',
      display: 'flex', flexDirection: 'column', gap: 4, position: 'relative',
      transition: 'border-color 0.2s',
    }}>
      {onRemove && (
        <button onClick={onRemove} style={{
          position: 'absolute', top: 6, right: 8, background: 'none', border: 'none',
          color: 'var(--muted)', cursor: 'pointer', fontSize: 14, lineHeight: 1,
        }}>×</button>
      )}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', fontFamily: 'var(--mono)' }}>
          {q.symbol?.replace('.NS','').replace('.BO','')}
        </span>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>{q.exchange || ''}</span>
      </div>
      {q.error ? (
        <div style={{ fontSize: 11, color: 'var(--down)' }}>{q.error}</div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--mono)' }}>
              {q.currency === 'INR' ? '₹' : '$'}{fmtNum(q.price, 2)}
            </span>
            {changeBadge(q.changePct)}
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              {q.change >= 0 ? '+' : ''}{fmtNum(q.change, 2)}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 2 }}>
            {[
              { l: 'H', v: fmtNum(q.high, 2) },
              { l: 'L', v: fmtNum(q.low, 2) },
              { l: 'Vol', v: q.volume ? (q.volume / 1e5).toFixed(1) + 'L' : 'N/A' },
              { l: 'P/E', v: fmtNum(q.pe, 1) },
              { l: '52H', v: fmtNum(q.hi52w, 2) },
            ].map(({ l, v }) => (
              <span key={l} style={{ fontSize: 10, color: 'var(--muted)' }}>
                <span style={{ color: 'var(--muted)', opacity: 0.7 }}>{l} </span>
                <span style={{ color: 'var(--text)', fontFamily: 'var(--mono)' }}>{v}</span>
              </span>
            ))}
          </div>
          {q.sector && (
            <span style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{q.sector}</span>
          )}
        </>
      )}
      <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2, opacity: 0.6 }}>
        {q.fetchedAt ? new Date(q.fetchedAt).toLocaleTimeString() : ''}
        {q.live && ' · LIVE'}
      </div>
    </div>
  );
}

export default function LiveQuotesPage() {
  const [tickers, setTickers] = useState(DEFAULT_TICKERS);
  const [quotes, setQuotes]   = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [addInput, setAddInput] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastFetch, setLastFetch] = useState(null);
  const timerRef = useRef(null);

  const fetchAll = useCallback(async (tickerList) => {
    setLoading(true);
    setError(null);
    try {
      const symbols = tickerList.join(',');
      const resp = await fetch(`${API}/quotes?symbols=${encodeURIComponent(symbols)}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const map = {};
      for (const q of (data.quotes || [])) map[q.symbol] = q;
      setQuotes(prev => ({ ...prev, ...map }));
      setLastFetch(new Date().toLocaleTimeString());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => { fetchAll(tickers); }, [tickers.join(',')]);

  // Auto-refresh every 60s
  useEffect(() => {
    if (!autoRefresh) { clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => fetchAll(tickers), 60000);
    return () => clearInterval(timerRef.current);
  }, [autoRefresh, tickers.join(',')]);

  const handleAdd = () => {
    const sym = addInput.trim().toUpperCase();
    if (!sym) return;
    // Auto-append .NS for Indian tickers that look like NSE symbols
    const formatted = sym.includes('.') ? sym : `${sym}.NS`;
    if (!tickers.includes(formatted)) {
      setTickers(prev => [...prev, formatted]);
    }
    setAddInput('');
  };

  const handleRemove = (sym) => setTickers(prev => prev.filter(t => t !== sym));

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8, flexWrap: 'wrap' }}>
        <div>
          <h1 className="section-title" style={{ margin: 0 }}>Live Market Quotes</h1>
          <p style={{ color: 'var(--muted)', fontSize: 11, marginTop: 2 }}>
            Real-time via Yahoo Finance · 1-min cache · {tickers.length} tickers
            {lastFetch && ` · Last: ${lastFetch}`}
          </p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)}
              style={{ accentColor: 'var(--up)', width: 14, height: 14 }} />
            Auto-refresh 60s
          </label>
          <button className="btn-ghost" onClick={() => fetchAll(tickers)} disabled={loading} style={{ fontSize: 12 }}>
            {loading ? '⏳' : '↻'} Refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, background: 'rgba(239,83,80,0.1)', border: '1px solid rgba(239,83,80,0.3)',
          borderRadius: 6, color: '#ef5350', fontSize: 12, marginBottom: 16 }}>
          ⚠ {error} — check if yahoo-finance2 is installed in funda/
        </div>
      )}

      {/* Add ticker */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, maxWidth: 380 }}>
        <input
          className="input"
          placeholder="Add ticker: RELIANCE / AAPL / MSFT"
          value={addInput}
          onChange={e => setAddInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          style={{ fontSize: 12, textTransform: 'uppercase' }}
        />
        <button className="btn-ghost" onClick={handleAdd} style={{ fontSize: 12 }}>+ Add</button>
      </div>

      {/* Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 10,
      }}>
        {tickers.map(sym => (
          <LiveTicker
            key={sym}
            q={quotes[sym] || { symbol: sym, loading: true }}
            onRemove={() => handleRemove(sym)}
          />
        ))}
      </div>

      {/* NSE Top Movers (from local index — instant) */}
      <NseTopMovers />
    </div>
  );
}

function NseTopMovers() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const [tab, setTab]       = useState('gainers');

  useEffect(() => {
    fetch(`${API}/nse-top?limit=10`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  const tabs = [
    { id: 'gainers', label: '▲ Gainers' },
    { id: 'losers',  label: '▼ Losers'  },
    { id: 'active',  label: '⚡ Active'  },
  ];

  return (
    <div className="chart-card" style={{ marginTop: 20 }}>
      <div className="chart-card-header">
        <div className="chart-card-title">NSE Top Movers — Today (Local Index)</div>
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>From bhavdata file · instant</span>
      </div>
      <div className="section-tabs" style={{ padding: 0, marginBottom: 8 }}>
        {tabs.map(t => (
          <button key={t.id} className={`section-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {loading && <div style={{ padding: 20, color: 'var(--muted)', fontSize: 12 }}>Loading…</div>}
      {error && <div style={{ padding: 12, color: 'var(--down)', fontSize: 12 }}>⚠ {error}</div>}
      {data && !loading && (
        <div style={{ overflowX: 'auto' }}>
          <table className="analytics-table">
            <thead>
              <tr>
                {['Symbol','Close','Chg %','Volume','Deliv %','Sector'].map(h => (
                  <th key={h} style={{ fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data[tab] || []).map((r, i) => (
                <tr key={r.symbol || i} className={i % 2 === 0 ? '' : 'row-alt'}>
                  <td style={{ fontWeight: 700, fontSize: 12 }}>{r.symbol}</td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>₹{fmtNum(r.close, 2)}</td>
                  <td>{changeBadge(r.changePct)}</td>
                  <td style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {r.volume ? (r.volume / 1e5).toFixed(1) + 'L' : '—'}
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {r.delivPct != null ? r.delivPct.toFixed(1) + '%' : '—'}
                  </td>
                  <td style={{ fontSize: 10, color: 'var(--muted)' }}>{r.sector || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
