/**
 * FUNDA API Service Layer
 * ────────────────────────
 * • All HTTP calls are here — no component talks to the backend directly.
 * • Response shapes are NORMALIZED here so the rest of the UI always sees
 *   consistent field names regardless of server evolution.
 * • No raw response objects are ever forwarded unchanged.
 */

const BASE = '/api/funda';

// ── Core fetch helper ─────────────────────────────────────────────────────────

async function apiFetch(url, options = {}) {
  const resp = await fetch(url, { headers: { Accept: 'application/json' }, ...options });
  if (!resp.ok) {
    let errMsg = `HTTP ${resp.status}`;
    try { const e = await resp.json(); errMsg = e.error || e.message || errMsg; } catch {}
    throw new Error(errMsg);
  }
  return resp.json();
}

// ── Normalization helpers ─────────────────────────────────────────────────────

/** Normalize a single mover row from /markets/movers */
function normalizeMoverRow(r) {
  return {
    symbol:     r.ticker   || r.symbol   || '',
    close:      r.close    ?? null,
    prevClose:  r.prev     ?? r.prevClose ?? null,
    open:       r.open     ?? null,
    high:       r.high     ?? null,
    low:        r.low      ?? null,
    changePct:  r.chgPct   ?? r.changePct ?? null,
    changeAbs:  r.chgAbs   ?? r.changeAbs ?? null,
    volume:     r.volume   ?? r.vol       ?? null,
    turnover:   r.turnover ?? r.turn      ?? null,
    trades:     r.trades   ?? null,
    delivPct:   r.delivPct ?? r.deliv     ?? null,
    pe:         r.pe       ?? null,
    volatility: r.annVol   ?? r.volatility ?? null,
    mcap:       r.mcap     ?? null,
    sector:     r.sector   ?? '',
  };
}

/** Normalize a single 52-week H/L row */
function normalize52WkRow(r) {
  return {
    symbol:   r.ticker  || r.symbol  || '',
    close:    r.close   ?? null,
    changePct: r.chgPct ?? r.changePct ?? null,
    high52w:  r.hi52    ?? r.high52w  ?? null,
    low52w:   r.lo52    ?? r.low52w   ?? null,
    hiDate:   r.hiDate  ?? '',
    loDate:   r.loDate  ?? '',
    nearHigh: (r.close != null && r.hi52 != null && r.hi52 > 0)
      ? +((r.close / r.hi52) * 100 - 100).toFixed(2)
      : (r.nearHigh ?? null),
  };
}

/** Normalize a bulk-deal row */
function normalizeBulkRow(r) {
  return {
    symbol:  r.ticker || r.symbol || '',
    name:    r.name   || '',
    client:  r.client || r.ClientName || '',
    buySell: r.side   || r.buySell || '',
    qty:     r.qty    ?? null,
    price:   r.price  ?? null,
    date:    r.date   || '',
  };
}

/** Normalize a short-selling row */
function normalizeShortRow(r) {
  return {
    symbol: r.ticker || r.symbol || '',
    name:   r.name   || '',
    qty:    r.qty    ?? null,
    price:  r.price  ?? null,
    client: r.client || '',
    date:   r.date   || '',
  };
}

/** Normalize a volatility row */
function normalizeVoltRow(r) {
  return {
    symbol:     r.ticker    || r.symbol    || '',
    volatility: r.annVol    ?? r.volatility ?? null,
    close:      r.close     ?? null,
    prevClose:  r.prevClose ?? null,
    dailyVol:   r.dailyVol  ?? null,
    date:       r.date      || '',
    // Compute fake changePct from close/prevClose if available
    changePct:  (r.close != null && r.prevClose != null && r.prevClose !== 0)
      ? +((r.close - r.prevClose) / r.prevClose * 100).toFixed(2)
      : null,
  };
}

/** Normalize market overview */
function normalizeOverview(d) {
  return {
    date:           d.date           || 'N/A',
    totalSecurities: d.totalEquities ?? d.totalSecurities ?? 0,
    advances:       d.advancers      ?? d.advances        ?? 0,
    declines:       d.decliners      ?? d.declines        ?? 0,
    unchanged:      d.unchanged      ?? 0,
    adRatio:        d.advanceDeclineRatio ?? d.adRatio ?? null,
    avgChangePct:   d.avgChangePct   ?? null,
    totalTurnoverCr: d.totalTurnoverCr ?? null,
    indices:        d.indices        || [],
  };
}

// ── Catalogue & Dropdowns ─────────────────────────────────────────────────────

export async function fetchSectorCatalogue() {
  const data = await apiFetch(`${BASE}/sectors`);
  return data.sectors || [];
}

export async function fetchSummary() {
  return apiFetch(`${BASE}/summary`);
}

// ── Fundamentals ──────────────────────────────────────────────────────────────

export async function fetchFundamentals(tickers) {
  if (!tickers || !tickers.length) return [];
  const data = await apiFetch(`${BASE}/fundamentals?tickers=${tickers.join(',')}`);
  return data.data || [];
}

// ── OHLCV + Indicators ────────────────────────────────────────────────────────
// Routes through the live indicators endpoint (Yahoo Finance + server-computed MACD/RSI/Bollinger).
// Period param: '1W' | '1M' | '3M' | '6M' | '1Y' | '5Y' | 'all'
// Maps UI period labels to the API's expected period strings.
const PERIOD_MAP = {
  '1W': '1W', '1M': '1M', '3M': '3M', '6M': '6M',
  '1Y': '1Y', '5Y': '5Y', 'all': 'all',
  // Legacy aliases the old endpoint used:
  '3M': '3M', '6M': '6M',
};

export async function fetchOHLCV(symbol, period = '1Y') {
  if (!symbol) return [];
  const p = PERIOD_MAP[period] || period;
  try {
    const data = await apiFetch(`${BASE}/live/indicators/${encodeURIComponent(symbol)}?period=${p}`);
    return data.data || [];
  } catch (e) {
    if (e.message.startsWith('HTTP 404') || e.message.includes('No data')) return [];
    throw e;
  }
}

// ── Treemap data for sector heatmap ─────────────────────────────────────────
export async function fetchTreemapData() {
  const d = await apiFetch(`${BASE}/treemap`);
  return d.items || [];
}

// ── Heatmap data ──────────────────────────────────────────────────────────────

export async function fetchSectorMetrics() {
  const data = await apiFetch(`${BASE}/sector-metrics`);
  return data.sectors || [];
}

export async function fetchTickerMetrics(sector, tickers) {
  const params = tickers && tickers.length
    ? `?tickers=${tickers.join(',')}`
    : `?sector=${encodeURIComponent(sector || '')}`;
  const data = await apiFetch(`${BASE}/ticker-metrics${params}`);
  return data.data || [];
}

// ── Sankey ────────────────────────────────────────────────────────────────────

export async function fetchSankeyData() {
  return apiFetch(`${BASE}/sankey`);
}

// ── Health ────────────────────────────────────────────────────────────────────

export async function fetchHealth() {
  return apiFetch(`${BASE}/health`);
}

// ── Markets / Movers — with full field normalization ──────────────────────────

export async function fetchMovers(type = 'gainers', limit = 100) {
  const d = await apiFetch(`${BASE}/markets/movers?type=${type}&limit=${limit}`);
  return {
    date:  d.date || 'latest',
    count: d.count || 0,
    data:  (d.data || []).map(normalizeMoverRow),
  };
}

export async function fetch52WkHL(type = 'high', limit = 100) {
  const d = await apiFetch(`${BASE}/markets/52wk?type=${type}&limit=${limit}`);
  return (d.data || []).map(normalize52WkRow);
}

export async function fetchBulkDeals() {
  const d = await apiFetch(`${BASE}/markets/bulk-deals`);
  return (d.data || []).map(normalizeBulkRow);
}

export async function fetchShortSelling() {
  const d = await apiFetch(`${BASE}/markets/short-selling`);
  return (d.data || []).map(normalizeShortRow);
}

export async function fetchVolatility(limit = 100) {
  const d = await apiFetch(`${BASE}/markets/volatility?limit=${limit}`);
  return (d.data || []).map(normalizeVoltRow);
}

export async function fetchMarketOverview() {
  const d = await apiFetch(`${BASE}/markets/overview`);
  return normalizeOverview(d);
}

// ── Live Quotes (Yahoo Finance via funda backend) ─────────────────────────────

/** Fetch a single live quote for a symbol (e.g. "RELIANCE.NS") */
export async function fetchLiveQuote(symbol) {
  const d = await apiFetch(`${BASE}/live/quote/${encodeURIComponent(symbol)}`);
  return normalizeQuote(d);
}

/** Fetch multiple live quotes at once — pass array of symbols */
export async function fetchLiveQuotes(symbols) {
  if (!symbols || !symbols.length) return [];
  const d = await apiFetch(`${BASE}/live/quotes?symbols=${encodeURIComponent(symbols.join(','))}`);
  return (d.quotes || []).map(normalizeQuote);
}

/** Fetch OHLCV price history for a symbol from Yahoo Finance */
export async function fetchLiveHistory(symbol, period = '1y') {
  const d = await apiFetch(`${BASE}/live/history/${encodeURIComponent(symbol)}?period=${period}`);
  return d.data || [];
}

/** Fetch NSE top movers from local bhavdata index (instant — no external call) */
export async function fetchNseTop(limit = 10) {
  const d = await apiFetch(`${BASE}/live/nse-top?limit=${limit}`);
  return {
    gainers: (d.gainers || []).map(normalizeMoverRow),
    losers:  (d.losers  || []).map(normalizeMoverRow),
    active:  (d.active  || []).map(normalizeMoverRow),
  };
}

/** Normalize a single live quote response */
function normalizeQuote(q) {
  return {
    symbol:    q.symbol    || '',
    name:      q.name      || q.shortName || '',
    price:     q.price     ?? q.regularMarketPrice ?? null,
    change:    q.change    ?? q.regularMarketChange ?? null,
    changePct: q.changePct ?? q.regularMarketChangePercent ?? null,
    open:      q.open      ?? q.regularMarketOpen ?? null,
    high:      q.high      ?? q.regularMarketDayHigh ?? null,
    low:       q.low       ?? q.regularMarketDayLow ?? null,
    prevClose: q.prevClose ?? q.regularMarketPreviousClose ?? null,
    volume:    q.volume    ?? q.regularMarketVolume ?? null,
    pe:        q.pe        ?? q.trailingPE ?? null,
    hi52w:     q.hi52w     ?? q.fiftyTwoWeekHigh ?? null,
    lo52w:     q.lo52w     ?? q.fiftyTwoWeekLow ?? null,
    mcap:      q.mcap      ?? q.marketCap ?? null,
    currency:  q.currency  || 'INR',
    exchange:  q.exchange  || '',
    sector:    q.sector    || '',
    fetchedAt: q.fetchedAt || new Date().toISOString(),
    live:      q.live      ?? true,
    error:     q.error     || null,
  };
}

// ── NSE Downloader ────────────────────────────────────────────────────────────

/**
 * Returns a normalized flat-list catalogue:
 * { total, reports: [ { id, name, category, ext, optional, description } ] }
 */
export async function fetchNseReportsCatalogue() {
  const d = await apiFetch(`${BASE}/nse/reports`);
  // Server returns { total, categories: [{category, reports:[]}] }
  // We flatten to { total, reports: [...] } with category embedded per item
  const flat = [];
  for (const cat of (d.categories || [])) {
    for (const r of (cat.reports || [])) {
      flat.push({
        id:          r.id,
        name:        r.name,
        category:    cat.category,
        format:      r.ext || '',
        description: r.optional ? 'Optional — may not be available for all dates' : '',
        optional:    !!r.optional,
      });
    }
  }
  return { total: d.total || flat.length, reports: flat };
}

export async function fetchNseDownloadedDates() {
  const d = await apiFetch(`${BASE}/nse/downloaded`);
  return d.dates || [];
}

export async function startNseDownload(date, ids = []) {
  const resp = await fetch(`${BASE}/nse/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, ids }),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

export async function pollNseJob(jobId) {
  const d = await apiFetch(`${BASE}/nse/job/${jobId}`);
  // Normalize job progress: server stores progress as mixed array of strings + objects
  // Convert all entries to display strings
  const log = (d.progress || []).map(entry => {
    if (typeof entry === 'string') return entry;
    if (typeof entry === 'object' && entry !== null) {
      const icon = entry.status === 'ok' ? '✅' : entry.status === 'skipped' ? '⏭' : '❌';
      const bytes = entry.bytes ? ` (${(entry.bytes / 1024).toFixed(1)} KB)` : '';
      return `${icon} ${entry.name}${bytes}`;
    }
    return String(entry);
  });
  return {
    status:    d.status,
    progress:  d.progress?.length ? Math.round((d.progress.length / Math.max(d.progress.length + 1, 1)) * 100) : null,
    log,
    summary:   d.summary,
    error:     d.error,
  };
}
