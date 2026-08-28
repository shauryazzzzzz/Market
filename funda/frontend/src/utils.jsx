/**
 * Shared utility components and helpers for all chart sections.
 */
import React from 'react';

// ── Skeleton loader ───────────────────────────────────────────────────────────
export function ChartSkeleton({ title }) {
  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <div className="chart-card-title">{title || 'Loading chart…'}</div>
      </div>
      <div className="chart-skeleton">
        <div className="skeleton-bar" style={{ width: '100%', height: 280, borderRadius: 6 }} />
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function EmptyState({ message }) {
  return (
    <div className="chart-card">
      <div className="chart-empty">
        <div style={{ fontSize: 32, marginBottom: 10 }}>📊</div>
        <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', maxWidth: 360 }}>{message}</div>
      </div>
    </div>
  );
}

// ── Loading spinner overlay ───────────────────────────────────────────────────
export function Loading() {
  return (
    <div className="loading-state">
      <div className="spinner" />
      <span>Loading data…</span>
    </div>
  );
}

// ── Error state ───────────────────────────────────────────────────────────────
export function ErrorState({ title, message }) {
  return (
    <div className="error-state">
      <div className="error-title">{title || 'Error'}</div>
      <div className="error-msg">{message}</div>
    </div>
  );
}

// ── PNG Export ────────────────────────────────────────────────────────────────
export function exportChartPNG(chartRef, filename) {
  try {
    const instance = chartRef?.current?.getEchartsInstance?.();
    if (!instance) return;
    const url = instance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#0a0e1a' });
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename || 'chart'}.png`;
    a.click();
  } catch (e) { console.warn('PNG export failed', e); }
}

// ── CSV Export ────────────────────────────────────────────────────────────────
export function exportCSV(data, filename) {
  if (!data?.length) return;
  const keys = Object.keys(data[0]);
  const rows = [keys.join(','), ...data.map(row => keys.map(k => JSON.stringify(row[k] ?? '')).join(','))];
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename || 'data'}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Date range buttons ────────────────────────────────────────────────────────
export function DateRangeSelector({ value, onChange }) {
  const periods = ['1W', '1M', '3M', '6M', '1Y', '5Y', 'all'];
  return (
    <div className="date-range-selector">
      {periods.map(p => (
        <button
          key={p}
          className={`date-range-btn${value === p ? ' active' : ''}`}
          onClick={() => onChange(p)}
        >
          {p === 'all' ? 'MAX' : p}
        </button>
      ))}
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────
export function KpiCard({ label, value, sub, color }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color: color || 'var(--text)', fontSize: 22 }}>
        {value == null ? <span style={{ color: 'var(--muted)', fontSize: 16 }}>N/A</span> : value}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

// ── Section tabs ──────────────────────────────────────────────────────────────
export function SectionTabs({ tabs, active, onChange }) {
  return (
    <div className="section-tabs">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`section-tab${active === tab.id ? ' active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ── Chart color palette (public) ──────────────────────────────────────────────
export const CHART_COLORS = [
  '#00d4ff', '#00ff88', '#ffaa00', '#ff6b6b',
  '#a78bfa', '#34d399', '#f59e0b', '#ec4899',
  '#60a5fa', '#fb923c',
];

// ── Format helpers ────────────────────────────────────────────────────────────
export function fmtNum(v, dec = 2) {
  if (v == null || isNaN(v)) return 'N/A';
  return (+v).toLocaleString(undefined, { maximumFractionDigits: dec });
}

export function fmtPct(v, dec = 1) {
  if (v == null || isNaN(v)) return 'N/A';
  return `${(+v * 100).toFixed(dec)}%`;
}
