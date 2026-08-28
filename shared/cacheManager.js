'use strict';
/**
 * shared/cacheManager.js
 * Two-tier cache:
 *   - QUARTERLY (disk-persisted, 90-day TTL)  — fundamentals, static reference data
 *   - DAILY (in-memory, keyed by trading date) — quotes, intraday, news
 *
 * Usage:
 *   const cache = require('../shared/cacheManager');
 *   const data = await cache.get('daily', 'quote:RELIANCE', () => fetchLiveQuote('RELIANCE'));
 *   const data = await cache.get('quarterly', 'fundamentals:HDFCBANK', () => fetchFundamentals('HDFCBANK'));
 */

const fs   = require('fs');
const path = require('path');

// ── Disk location for quarterly cache ─────────────────────────────────────────
const CACHE_DIR = path.resolve(__dirname, '../.cache');
if (!fs.existsSync(CACHE_DIR)) {
  try { fs.mkdirSync(CACHE_DIR, { recursive: true }); } catch (_) {}
}

const QUARTERLY_TTL_MS = 90 * 24 * 60 * 60 * 1000;   // 90 days
const DAILY_TTL_MS     = 24 * 60 * 60 * 1000;          // 24 hours (in-memory guard)

// ── In-memory stores ──────────────────────────────────────────────────────────
// Daily cache: key -> { value, expires }
const _dailyStore = new Map();

// Track the current trading date for cache keying
let _tradingDate = _todayKey();

function _todayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

// ── Quarterly (disk) helpers ──────────────────────────────────────────────────
function _diskPath(key) {
  // Sanitise key to a safe filename
  const safe = key.replace(/[^a-zA-Z0-9_\-.:]/g, '_').slice(0, 200);
  return path.join(CACHE_DIR, `${safe}.json`);
}

function _readQuarterly(key) {
  const p = _diskPath(key);
  if (!fs.existsSync(p)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!raw || !raw.expires) return null;
    if (Date.now() > raw.expires) {
      fs.unlinkSync(p);
      return null;
    }
    return raw.value;
  } catch (_) {
    return null;
  }
}

function _writeQuarterly(key, value) {
  const p = _diskPath(key);
  try {
    fs.writeFileSync(p, JSON.stringify({ value, expires: Date.now() + QUARTERLY_TTL_MS }), 'utf8');
  } catch (e) {
    console.warn('[cacheManager] disk write failed:', e.message);
  }
}

// ── Daily (in-memory) helpers ─────────────────────────────────────────────────
// Prefix the store key with the trading date so stale days auto-miss
function _dailyKey(key) {
  return `${_tradingDate}::${key}`;
}

function _readDaily(key) {
  const full = _dailyKey(key);
  const entry = _dailyStore.get(full);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    _dailyStore.delete(full);
    return null;
  }
  return entry.value;
}

function _writeDaily(key, value) {
  _dailyStore.set(_dailyKey(key), { value, expires: Date.now() + DAILY_TTL_MS });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Get a cached value or invoke fetcher() to produce it.
 * @param {'daily'|'quarterly'} tier
 * @param {string} key   cache key (namespaced by caller, e.g. 'quote:RELIANCE')
 * @param {Function} fetcher  async () => value — called only on cache miss
 * @returns {Promise<any>}
 */
async function get(tier, key, fetcher) {
  if (tier === 'quarterly') {
    const cached = _readQuarterly(key);
    if (cached !== null) return cached;
    const value = await fetcher();
    if (value != null) _writeQuarterly(key, value);
    return value;
  } else {
    // daily (in-memory)
    const cached = _readDaily(key);
    if (cached !== null) return cached;
    const value = await fetcher();
    if (value != null) _writeDaily(key, value);
    return value;
  }
}

/**
 * Explicitly set a value in the cache without fetching.
 */
function set(tier, key, value) {
  if (tier === 'quarterly') _writeQuarterly(key, value);
  else _writeDaily(key, value);
}

/**
 * Return cache statistics.
 */
function status() {
  // Count quarterly disk entries
  let quarterlyCount = 0;
  let quarterlyExpired = 0;
  try {
    const files = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'));
    quarterlyCount = files.length;
    files.forEach(f => {
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, f), 'utf8'));
        if (raw && raw.expires && Date.now() > raw.expires) quarterlyExpired++;
      } catch (_) {}
    });
  } catch (_) {}

  const dailyCount = _dailyStore.size;
  const dailyActive = [..._dailyStore.values()].filter(e => Date.now() <= e.expires).length;

  return {
    tradingDate:      _tradingDate,
    quarterly: { totalEntries: quarterlyCount, expiredEntries: quarterlyExpired, ttlDays: 90 },
    daily:     { totalEntries: dailyCount, activeEntries: dailyActive, ttlHours: 24 },
    cacheDir:  CACHE_DIR,
  };
}

/**
 * Invalidate quarterly (disk) cache.
 * @param {string} [key] — if provided, removes only that key's file; otherwise clears all.
 */
function invalidateQuarterly(key) {
  if (key != null) {
    try { fs.unlinkSync(_diskPath(String(key))); } catch (_) {}
    return { cleared: 1 };
  }
  try {
    const files = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'));
    files.forEach(f => { try { fs.unlinkSync(path.join(CACHE_DIR, f)); } catch (_) {} });
    return { cleared: files.length };
  } catch (_) {
    return { cleared: 0 };
  }
}

/**
 * Invalidate daily (in-memory) cache.
 * @param {string} [key] — if provided, removes only that key's entry; otherwise clears all.
 */
function invalidateDaily(key) {
  if (key != null) {
    const full = _dailyKey(String(key));
    _dailyStore.delete(full);
    return { cleared: 1 };
  }
  const count = _dailyStore.size;
  _dailyStore.clear();
  return { cleared: count };
}

/**
 * Override the trading date used as daily cache key prefix.
 * Two-arg legacy form: setResultDate(ticker, isoDate) — silently ignored (ticker-level dates
 * are handled by the quarterly TTL). Single-arg form updates the trading date prefix.
 */
function setResultDate(tickerOrDate, dateStr) {
  // Legacy two-arg call: setResultDate('RELIANCE', '2025-07-15') → no-op
  if (dateStr != null) return;
  _tradingDate = tickerOrDate || _todayKey();
}

/**
 * Get the current trading date key (YYYY-MM-DD).
 */
function tradingDateKey() {
  return _tradingDate;
}

module.exports = { get, set, status, invalidateQuarterly, invalidateDaily, setResultDate, tradingDateKey };
