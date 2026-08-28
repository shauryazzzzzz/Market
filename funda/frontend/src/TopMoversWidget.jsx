/**
 * TopMoversWidget — Gainers & Losers dual-column panel
 * ChartInk / MoneyControl style: ranked list with ticker badge, % pill, sparkline
 */
import React, { useState, useEffect, useRef } from 'react';
import { fetchMovers } from './api';

// ── Inline SVG sparkline ───────────────────────────────────────────────────────
function Sparkline({ values = [], color, width = 70, height = 28 }) {
  if (!values || values.length < 2) {
    return <svg width={width} height={height} />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const area = [
    `M 0,${height}`,
    `L 0,${((values[0] - min) / range) ? height - ((values[0] - min) / range) * (height - 4) - 2 : height}`,
    ...values.map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `L ${x.toFixed(1)},${y.toFixed(1)}`;
    }),
    `L ${width},${height} Z`,
  ].join(' ');

  return (
    <svg width={width} height={height} style={{ overflow: 'visible', flexShrink: 0 }}>
      <defs>
        <linearGradient id={`sg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sg-${color.replace('#','')})`} />
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Change pill ────────────────────────────────────────────────────────────────
function ChangePill({ value }) {
  const v = parseFloat(value) || 0;
  const up = v >= 0;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 7px',
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 700,
        fontFamily: 'var(--mono)',
        background: up ? 'var(--bull-bg)' : 'var(--bear-bg)',
        color: up ? 'var(--bull)' : 'var(--bear)',
        border: `1px solid ${up ? 'rgba(38,166,154,0.25)' : 'rgba(239,83,80,0.25)'}`,
        minWidth: 58,
        justifyContent: 'center',
        transition: 'all 0.3s',
      }}
    >
      {up ? '▲' : '▼'} {Math.abs(v).toFixed(2)}%
    </span>
  );
}

// ── Mover row ─────────────────────────────────────────────────────────────────
function MoverRow({ rank, item, sparkValues, up }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '24px 1fr auto 70px',
        alignItems: 'center',
        gap: 8,
        padding: '7px 12px',
        borderBottom: '1px solid var(--tv-border2)',
        transition: 'background 0.1s',
        cursor: 'default',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--tv-surface2)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {/* Rank */}
      <span style={{ color: 'var(--tv-text-mute)', fontSize: 10, fontFamily: 'var(--mono)', textAlign: 'right' }}>
        {rank}
      </span>

      {/* Ticker + price */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 12,
            color: 'var(--tv-heading)', letterSpacing: '0.03em',
          }}>
            {item.symbol}
          </span>
          {item.sector && (
            <span style={{ fontSize: 9, color: 'var(--tv-text-mute)', fontStyle: 'italic' }}>
              {item.sector.slice(0, 14)}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tv-text)' }}>
            ₹{item.close != null ? item.close.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
          </span>
          <ChangePill value={item.changePct} />
        </div>
      </div>

      {/* Volume */}
      <div style={{ textAlign: 'right' }}>
        {item.volume != null && (
          <span style={{ fontSize: 9, color: 'var(--tv-text-mute)', fontFamily: 'var(--mono)' }}>
            {item.volume >= 1e7 ? `${(item.volume / 1e7).toFixed(1)}Cr`
              : item.volume >= 1e5 ? `${(item.volume / 1e5).toFixed(0)}L`
              : item.volume.toLocaleString()}
          </span>
        )}
      </div>

      {/* Sparkline */}
      <Sparkline
        values={sparkValues}
        color={up ? 'var(--bull)' : 'var(--bear)'}
        width={70}
        height={28}
      />
    </div>
  );
}

// ── Main widget ───────────────────────────────────────────────────────────────
export default function TopMoversWidget() {
  const [gainers, setGainers] = useState([]);
  const [losers,  setLosers]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState('gainers'); // 'gainers' | 'losers' | 'active'
  const [ts,      setTs]      = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchMovers('gainers', 10),
      fetchMovers('losers',  10),
    ])
      .then(([g, l]) => {
        setGainers(g.data || []);
        setLosers(l.data  || []);
        setTs(g.date || '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const items = tab === 'gainers' ? gainers : losers;
  const isUp  = tab === 'gainers';

  return (
    <div className="analytics-panel" style={{ height: '100%' }}>
      <div className="analytics-panel-header">
        <div style={{ display: 'flex', gap: 4 }}>
          {['gainers', 'losers'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '4px 12px',
                borderRadius: 4,
                border: '1px solid',
                fontSize: 11,
                fontWeight: 600,
                fontFamily: 'var(--font)',
                cursor: 'pointer',
                transition: 'all 0.15s',
                background: tab === t
                  ? (t === 'gainers' ? 'var(--bull-bg)' : 'var(--bear-bg)')
                  : 'transparent',
                color: tab === t
                  ? (t === 'gainers' ? 'var(--bull)' : 'var(--bear)')
                  : 'var(--tv-text-dim)',
                borderColor: tab === t
                  ? (t === 'gainers' ? 'rgba(38,166,154,0.35)' : 'rgba(239,83,80,0.35)')
                  : 'var(--tv-border)',
              }}
            >
              {t === 'gainers' ? '▲ Gainers' : '▼ Losers'}
            </button>
          ))}
        </div>
        {ts && <span style={{ fontSize: 10, color: 'var(--tv-text-mute)' }}>{ts}</span>}
      </div>

      {loading ? (
        <div style={{ padding: 16 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton-bar" style={{ height: 46, marginBottom: 4, borderRadius: 4 }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--tv-text-mute)', fontSize: 12 }}>
          No data available
        </div>
      ) : (
        <div>
          {/* Column headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '24px 1fr auto 70px',
            gap: 8,
            padding: '5px 12px',
            borderBottom: '1px solid var(--tv-border)',
            background: 'var(--tv-surface2)',
          }}>
            {['#', 'Symbol / Price', 'Vol', 'Trend'].map(h => (
              <span key={h} style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--tv-text-mute)' }}>{h}</span>
            ))}
          </div>

          {items.slice(0, 10).map((item, i) => {
            // Generate pseudo-sparkline from changePct (realistic approximation)
            const basePrice = item.prevClose ?? (item.close ?? 100);
            const endPrice  = item.close ?? basePrice;
            const spark = Array.from({ length: 7 }, (_, j) => {
              const t = j / 6;
              const noise = (Math.random() - 0.5) * 0.005 * basePrice;
              return basePrice + (endPrice - basePrice) * t + noise;
            });
            spark[6] = endPrice;

            return (
              <MoverRow
                key={item.symbol}
                rank={i + 1}
                item={item}
                sparkValues={spark}
                up={isUp}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
