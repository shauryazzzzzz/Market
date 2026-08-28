/**
 * Cascading Sector → Ticker multi-select searchable dropdowns.
 * Reads from StoreContext. Updates global selected state.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useStore, useAvailableTickers } from './store.jsx';
import { fetchSectorCatalogue } from './api';

// ── Generic multi-select searchable dropdown ──────────────────────────────────
function MultiSelect({ label, placeholder, options, selected, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase()) ||
    (o.sublabel && o.sublabel.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleItem = (value) => {
    onChange(selected.includes(value)
      ? selected.filter(v => v !== value)
      : [...selected, value]
    );
  };

  const selectAll = () => onChange(options.map(o => o.value));
  const clearAll = () => onChange([]);

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <div className="dropdown-label">{label}</div>
      <div
        className={`dropdown-trigger${open ? ' open' : ''}${disabled ? ' disabled' : ''}`}
        onClick={() => !disabled && setOpen(!open)}
      >
        <span className="dropdown-trigger-text">
          {selected.length === 0
            ? <span style={{ color: 'var(--muted)' }}>{placeholder}</span>
            : selected.length === 1
              ? (options.find(o => o.value === selected[0])?.label || selected[0])
              : <span>{selected.length} selected</span>
          }
        </span>
        <span className="dropdown-arrow">{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div className="dropdown-panel">
          <div className="dropdown-search-wrap">
            <input
              className="dropdown-search"
              placeholder={`Search ${label.toLowerCase()}…`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div className="dropdown-actions">
            <button className="dropdown-action-btn" onClick={selectAll}>All</button>
            <button className="dropdown-action-btn" onClick={clearAll}>Clear</button>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--muted)' }}>
              {selected.length}/{options.length}
            </span>
          </div>
          <div className="dropdown-list">
            {filtered.length === 0 && (
              <div style={{ padding: '10px 14px', color: 'var(--muted)', fontSize: 12 }}>No results</div>
            )}
            {filtered.map(o => (
              <div
                key={o.value}
                className={`dropdown-item${selected.includes(o.value) ? ' selected' : ''}`}
                onClick={() => toggleItem(o.value)}
              >
                <span className="dropdown-check">{selected.includes(o.value) ? '✓' : ''}</span>
                <span className="dropdown-item-label">{o.label}</span>
                {o.sublabel && <span className="dropdown-item-sub">{o.sublabel}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main FilterBar component ──────────────────────────────────────────────────
export default function FilterBar() {
  const { state, dispatch } = useStore();
  const { sectorCatalogue, catalogueLoading, catalogueError, selectedSectors, selectedTickers } = state;
  const availableTickers = useAvailableTickers();

  // Load catalogue on mount
  useEffect(() => {
    if (sectorCatalogue.length > 0) return;
    dispatch({ type: 'SET_CATALOGUE_LOADING', payload: true });
    fetchSectorCatalogue()
      .then(data => dispatch({ type: 'SET_CATALOGUE', payload: data }))
      .catch(e => dispatch({ type: 'SET_CATALOGUE_ERROR', payload: e.message }));
  }, []);

  const sectorOptions = sectorCatalogue.map(s => ({
    value: s.sector,
    label: s.sector,
    sublabel: `${s.tickers.length} tickers`,
  }));

  const tickerOptions = availableTickers.map(t => ({
    value: t.ticker,
    label: t.ticker,
    sublabel: t.name !== t.ticker ? t.name : null,
  }));

  const handleSectorsChange = useCallback((sectors) => {
    dispatch({ type: 'SET_SELECTED_SECTORS', payload: sectors });
  }, [dispatch]);

  const handleTickersChange = useCallback((tickers) => {
    dispatch({ type: 'SET_SELECTED_TICKERS', payload: tickers });
  }, [dispatch]);

  return (
    <div className="filter-bar">
      <div className="filter-bar-inner">
        {catalogueLoading && <div style={{ color: 'var(--muted)', fontSize: 12 }}><div className="spinner" style={{ width: 14, height: 14, display: 'inline-block', marginRight: 6 }} />Loading catalogue…</div>}
        {catalogueError && <div style={{ color: 'var(--negative)', fontSize: 12 }}>⚠ {catalogueError}</div>}
        {!catalogueLoading && !catalogueError && (
          <>
            <MultiSelect
              label="Sector"
              placeholder="Select sector(s)…"
              options={sectorOptions}
              selected={selectedSectors}
              onChange={handleSectorsChange}
            />
            <MultiSelect
              label="Ticker"
              placeholder={selectedSectors.length ? 'Select ticker(s)…' : 'Select a sector first'}
              options={tickerOptions}
              selected={selectedTickers}
              onChange={handleTickersChange}
              disabled={!selectedSectors.length}
            />
          </>
        )}
        <div className="filter-bar-pills">
          {selectedSectors.map(s => (
            <span key={s} className="filter-pill filter-pill-sector" onClick={() => handleSectorsChange(selectedSectors.filter(x => x !== s))}>
              {s} ×
            </span>
          ))}
          {selectedTickers.map(t => (
            <span key={t} className="filter-pill filter-pill-ticker" onClick={() => handleTickersChange(selectedTickers.filter(x => x !== t))}>
              {t} ×
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
