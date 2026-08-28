/**
 * NsePage — NSE All-Reports daily downloader.
 * Features:
 *   - Date picker (defaults to today)
 *   - Report catalogue grouped by category (checkbox multi-select with Select All / Deselect All per group)
 *   - Download trigger → live streaming job log via polling
 *   - Progress bar per active download job
 *   - Downloaded dates history chips (shows which dates have been downloaded before)
 *   - Re-index button to trigger backend file re-scan
 * No raw backend data exposed — only visual status and progress.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchNseReportsCatalogue,
  fetchNseDownloadedDates,
  startNseDownload,
  pollNseJob,
} from './api';
import { Loading, ErrorState } from './utils';

// ── Helpers ───────────────────────────────────────────────────────────────────
function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function fmtBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

// ── Catalogue group component ─────────────────────────────────────────────────
function CatalogueGroup({ group, reports, selected, onToggle }) {
  const groupIds = reports.map(r => r.id);
  const allSelected = groupIds.every(id => selected.has(id));
  const noneSelected = groupIds.every(id => !selected.has(id));

  const toggleAll = () => {
    if (allSelected) groupIds.forEach(id => onToggle(id, false));
    else groupIds.forEach(id => onToggle(id, true));
  };

  const groupColors = {
    'Bhavcopy': '#00d4ff',
    'Market Activity': '#00ff88',
    'Security Info': '#a78bfa',
    'Bulk / Block Deals': '#ffaa00',
    'Derivatives & Risk': '#ff6b6b',
    'SME / Debt': '#34d399',
  };
  const accent = groupColors[group] || '#00d4ff';

  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 8, border: `1px solid var(--border)`,
      marginBottom: 12, overflow: 'hidden',
    }}>
      {/* Group header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', borderBottom: '1px solid var(--border)',
        borderLeft: `3px solid ${accent}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{group}</span>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{reports.length} reports</span>
          <span style={{ fontSize: 11, color: accent }}>
            {groupIds.filter(id => selected.has(id)).length} selected
          </span>
        </div>
        <button
          className="btn-ghost"
          style={{ fontSize: 11 }}
          onClick={toggleAll}
        >
          {allSelected ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      {/* Report items */}
      <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {reports.map(r => (
          <label key={r.id} style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
            padding: '6px 0', borderBottom: '1px solid var(--border)',
            opacity: selected.has(r.id) ? 1 : 0.7, transition: 'opacity 0.15s',
          }}>
            <input
              type="checkbox"
              checked={selected.has(r.id)}
              onChange={e => onToggle(r.id, e.target.checked)}
              style={{ marginTop: 2, accentColor: accent, width: 14, height: 14, flexShrink: 0 }}
            />
            <div>
              <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: selected.has(r.id) ? 600 : 400 }}>
                {r.name}
              </div>
              {r.description && (
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{r.description}</div>
              )}
              {r.format && (
                <span style={{
                  fontSize: 10, background: 'var(--border)', borderRadius: 3,
                  padding: '1px 5px', color: 'var(--muted)', marginTop: 3, display: 'inline-block',
                }}>
                  {r.format}
                </span>
              )}
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

// ── Job log component ─────────────────────────────────────────────────────────
function JobLog({ log, progress, status }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  const statusColor = {
    running: '#00d4ff',
    done: '#00ff88',
    error: '#ef5350',
    idle: 'var(--muted)',
  }[status] || 'var(--muted)';

  return (
    <div style={{
      background: '#0a0c14', border: '1px solid var(--border)', borderRadius: 8,
      overflow: 'hidden', marginTop: 16,
    }}>
      {/* Log header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {status === 'running' && (
            <div style={{
              width: 8, height: 8, borderRadius: '50%', background: '#00d4ff',
              animation: 'pulse 1s infinite',
            }} />
          )}
          <span style={{ fontSize: 12, fontWeight: 600, color: statusColor }}>
            {status === 'running' ? 'Downloading…' :
              status === 'done' ? '✅ Complete' :
                status === 'error' ? '❌ Error' : 'Job Log'}
          </span>
        </div>
        {progress != null && (
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{progress}%</span>
        )}
      </div>

      {/* Progress bar */}
      {progress != null && (
        <div style={{ height: 3, background: 'var(--border)' }}>
          <div style={{
            height: '100%', width: `${progress}%`,
            background: status === 'error' ? '#ef5350' : '#00d4ff',
            transition: 'width 0.3s ease',
          }} />
        </div>
      )}

      {/* Log lines */}
      <div style={{
        padding: 12, maxHeight: 280, overflowY: 'auto',
        fontFamily: 'Consolas, "Courier New", monospace', fontSize: 12,
        lineHeight: 1.6, color: '#c9d1d9',
      }}>
        {log.length === 0 ? (
          <span style={{ color: 'var(--muted)' }}>Waiting for job to start…</span>
        ) : log.map((line, i) => {
          const isError = /error|fail|❌/i.test(line);
          const isSuccess = /✅|done|complete|saved/i.test(line);
          return (
            <div key={i} style={{ color: isError ? '#ef5350' : isSuccess ? '#00ff88' : undefined }}>
              {line}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ── Downloaded dates history ──────────────────────────────────────────────────
function DownloadedHistory({ dates, onSelect }) {
  if (!dates.length) return (
    <div style={{ color: 'var(--muted)', fontSize: 12, fontStyle: 'italic' }}>
      No previously downloaded dates found.
    </div>
  );

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {dates.slice().reverse().map(d => (
        <button
          key={d}
          className="btn-ghost"
          style={{ fontSize: 12, padding: '4px 10px' }}
          onClick={() => onSelect(d)}
          title="Click to load this date"
        >
          📅 {d}
        </button>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function NsePage() {
  const [date, setDate] = useState(todayStr());
  const [catalogue, setCatalogue] = useState(null);
  const [catLoading, setCatLoading] = useState(true);
  const [catError, setCatError] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [downloadedDates, setDownloadedDates] = useState([]);
  const [jobId, setJobId] = useState(null);
  const [log, setLog] = useState([]);
  const [progress, setProgress] = useState(null);
  const [jobStatus, setJobStatus] = useState('idle');
  const [downloading, setDownloading] = useState(false);
  const pollRef = useRef(null);

  // Load catalogue
  useEffect(() => {
    fetchNseReportsCatalogue()
      .then(data => {
        setCatalogue(data);
        // Pre-select all by default
        if (data?.reports) {
          setSelected(new Set(data.reports.map(r => r.id)));
        }
      })
      .catch(e => setCatError(e.message))
      .finally(() => setCatLoading(false));
    fetchNseDownloadedDates().then(setDownloadedDates).catch(() => {});
  }, []);

  // Poll job
  useEffect(() => {
    if (!jobId) return;
    pollRef.current = setInterval(async () => {
      try {
        const job = await pollNseJob(jobId);
        setLog(job.log || []);
        setProgress(job.progress ?? null);
        setJobStatus(job.status);
        if (job.status === 'done' || job.status === 'error') {
          clearInterval(pollRef.current);
          setDownloading(false);
          // refresh downloaded dates
          fetchNseDownloadedDates().then(setDownloadedDates).catch(() => {});
        }
      } catch {
        clearInterval(pollRef.current);
        setDownloading(false);
        setJobStatus('error');
      }
    }, 1200);
    return () => clearInterval(pollRef.current);
  }, [jobId]);

  const handleToggle = useCallback((id, checked) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  }, []);

  const handleSelectAll = () => {
    if (catalogue?.reports) setSelected(new Set(catalogue.reports.map(r => r.id)));
  };
  const handleDeselectAll = () => setSelected(new Set());

  const handleDownload = async () => {
    if (!selected.size) return;
    setDownloading(true);
    setLog([]);
    setProgress(0);
    setJobStatus('running');
    try {
      const res = await startNseDownload(date, [...selected]);
      setJobId(res.jobId);
    } catch (e) {
      setLog([`❌ Failed to start download: ${e.message}`]);
      setJobStatus('error');
      setDownloading(false);
    }
  };

  // Group catalogue
  const groups = React.useMemo(() => {
    if (!catalogue?.reports) return {};
    const g = {};
    catalogue.reports.forEach(r => {
      const cat = r.category || 'General';
      if (!g[cat]) g[cat] = [];
      g[cat].push(r);
    });
    return g;
  }, [catalogue]);

  const totalReports = catalogue?.reports?.length || 0;
  const selectedCount = selected.size;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
        <h1 className="section-title" style={{ margin: 0 }}>NSE Reports Downloader</h1>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>
          nseindia.com/all-reports
        </span>
      </div>
      <p className="section-sub" style={{ marginBottom: 20 }}>
        Select a date and choose which NSE reports to download. Files are saved to DATA/&lt;date&gt;/ and auto-indexed.
      </p>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Left panel: date + controls */}
        <div style={{ minWidth: 280, maxWidth: 320, flex: '0 0 300px' }}>
          {/* Date selector */}
          <div className="chart-card" style={{ marginBottom: 16 }}>
            <div className="chart-card-header">
              <div className="chart-card-title">📅 Download Date</div>
            </div>
            <div style={{ padding: '8px 0' }}>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 6,
                  border: '1px solid var(--border)', background: 'var(--surface)',
                  color: 'var(--text)', fontSize: 14, boxSizing: 'border-box',
                }}
              />
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                NSE reports are available for trading days only. Weekends / holidays may return empty files.
              </div>
            </div>
          </div>

          {/* Selection summary */}
          <div className="chart-card" style={{ marginBottom: 16 }}>
            <div className="chart-card-header">
              <div className="chart-card-title">Selection</div>
            </div>
            <div style={{ padding: '4px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 24, fontWeight: 700, color: '#00d4ff' }}>{selectedCount}</span>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>of {totalReports} reports</span>
              </div>
              {/* Mini progress bar */}
              <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, marginBottom: 12 }}>
                <div style={{
                  height: '100%', borderRadius: 2,
                  width: totalReports ? `${(selectedCount / totalReports) * 100}%` : '0%',
                  background: '#00d4ff', transition: 'width 0.3s ease',
                }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-ghost" style={{ flex: 1, fontSize: 12 }} onClick={handleSelectAll}>Select All</button>
                <button className="btn-ghost" style={{ flex: 1, fontSize: 12 }} onClick={handleDeselectAll}>Clear</button>
              </div>
            </div>
          </div>

          {/* Download button */}
          <button
            onClick={handleDownload}
            disabled={downloading || selectedCount === 0}
            style={{
              width: '100%', padding: '12px 0',
              background: downloading ? 'var(--border)' : (selectedCount === 0 ? 'var(--border)' : '#00d4ff'),
              color: downloading || selectedCount === 0 ? 'var(--muted)' : '#0a0e1a',
              border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14,
              cursor: downloading || selectedCount === 0 ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
              marginBottom: 12,
            }}
          >
            {downloading ? '⏳ Downloading…' : `⬇ Download ${selectedCount} Report${selectedCount !== 1 ? 's' : ''}`}
          </button>

          {/* Previously downloaded dates */}
          <div className="chart-card">
            <div className="chart-card-header">
              <div className="chart-card-title">📁 Previously Downloaded</div>
            </div>
            <DownloadedHistory dates={downloadedDates} onSelect={setDate} />
          </div>
        </div>

        {/* Right panel: catalogue + log */}
        <div style={{ flex: 1, minWidth: 300 }}>
          {/* Catalogue */}
          {catLoading && <Loading />}
          {catError && <ErrorState title="Catalogue Error" message={catError} />}
          {!catLoading && !catError && (
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 12,
              }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  Report Catalogue
                  <span style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: 8 }}>
                    {Object.keys(groups).length} categories · {totalReports} reports
                  </span>
                </span>
              </div>
              {Object.entries(groups).map(([group, reports]) => (
                <CatalogueGroup
                  key={group}
                  group={group}
                  reports={reports}
                  selected={selected}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          )}

          {/* Job log — shown while active or after completion */}
          {(jobId || log.length > 0) && (
            <JobLog log={log} progress={progress} status={jobStatus} />
          )}

          {/* Post-download summary */}
          {jobStatus === 'done' && (
            <div style={{
              marginTop: 16, padding: 16,
              background: 'rgba(0,255,136,0.07)', border: '1px solid rgba(0,255,136,0.3)',
              borderRadius: 8,
            }}>
              <div style={{ fontWeight: 700, color: '#00ff88', marginBottom: 6 }}>
                ✅ Download Complete
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                Files have been saved to the DATA folder. The backend will auto-index new files on next data load.
                Navigate to <strong style={{ color: 'var(--text)' }}>Markets</strong> or{' '}
                <strong style={{ color: 'var(--text)' }}>Overview</strong> to see updated data.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
