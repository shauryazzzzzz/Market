'use strict';
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const csvParser = require('csv-parser');
const XLSX = require('xlsx');
const { REPORTS, downloadReports, listDownloadedDates, todayDateStr } = require('./nse-downloader');

const app = express();
const PORT = process.env.BACKEND_PORT || 5001;

// Resolve DATA folder relative to this server file
// Support both: run from funda/ (../../DATA) and run from tradingview-economy/ root (../DATA)
const _candidateData = process.env.DATA_FOLDER
  ? path.resolve(__dirname, process.env.DATA_FOLDER)
  : [
      path.resolve(__dirname, '../../DATA'),   // normal: run from funda/
      path.resolve(__dirname, '../DATA'),       // when required from parent root
      path.resolve(process.cwd(), 'DATA'),      // when cwd is tradingview-economy/
      path.resolve(process.cwd(), '../DATA'),   // fallback
    ].find(p => { const fs2 = require('fs'); return fs2.existsSync(p); }) || path.resolve(__dirname, '../../DATA');
const DATA_DIR = _candidateData;

// ── In-memory index of parsed files ─────────────────────────────────────────
const fileIndex = {};   // filename -> { rows: [], columns: [], error: null }
let indexReady = false;

// ── Derived caches (built after index completes) ───────────────────────────
let _sectorTickerCache = null;   // { map, tickerMeta }
let _fundaCache = {};            // ticker -> fundamentals snapshot
let _sectorMetricsCache = null;  // computed sector aggregates

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// ── Utilities ────────────────────────────────────────────────────────────────
function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (row) => {
        // Normalise header whitespace — some NSE CSVs use "SYMBOL, SERIES, ..."
        // which csv-parser reads as { SYMBOL: ..., ' SERIES': ..., ' CLOSE_PRICE': ... }
        const cleaned = {};
        for (const [k, v] of Object.entries(row)) {
          const key = k.trim();
          cleaned[key] = typeof v === 'string' ? v.trim() : v;
        }
        rows.push(cleaned);
      })
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

function parseXLSX(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const results = {};
  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    results[sheetName] = XLSX.utils.sheet_to_json(ws, { defval: null });
  }
  return results;
}

function parseJSON(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  // Normalize: if parsed has a .value array, use that
  if (parsed && Array.isArray(parsed.value)) return parsed.value;
  if (Array.isArray(parsed)) return parsed;
  return [parsed];
}

// Files to skip: the two giant XLSX files are redundant with the daily CSVs
// and take 30-40s to parse. The CSVs contain identical data at a fraction of the cost.
const SKIP_PATTERNS = [
  /NSE_Combined_.*\.xlsx$/i,
  /Combined_Raw_Data\.xlsx$/i,
];

function shouldSkip(filePath) {
  return SKIP_PATTERNS.some(p => p.test(filePath));
}

function collectCSVFiles(dir) {
  const result = [];
  if (!fs.existsSync(dir)) return result;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectCSVFiles(fullPath));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (['.csv', '.xlsx', '.xls', '.json'].includes(ext) && !shouldSkip(fullPath)) {
        result.push(fullPath);
      }
    }
  }
  return result;
}

// ── Index all DATA files on startup (parallel batch reads) ──────────────────
async function buildIndex() {
  if (!fs.existsSync(DATA_DIR)) {
    console.error(`[FUNDA] DATA folder not found: ${DATA_DIR}`);
    indexReady = true;
    return;
  }

  const files = collectCSVFiles(DATA_DIR);
  console.log(`[FUNDA] Indexing ${files.length} files in parallel from ${DATA_DIR}`);
  const t0 = Date.now();

  // Parse one file, return [relName, entry]
  async function parseOne(filePath) {
    const relName = path.relative(DATA_DIR, filePath).replace(/\\/g, '/');
    const ext = path.extname(filePath).toLowerCase();
    try {
      let rows, columns;
      if (ext === '.csv') {
        rows = await parseCSV(filePath);
        columns = rows.length > 0 ? Object.keys(rows[0]) : [];
        return [relName, { rows, columns, error: null, type: 'csv', path: filePath }];
      } else if (ext === '.xlsx' || ext === '.xls') {
        const sheets = parseXLSX(filePath);
        const firstSheet = Object.keys(sheets)[0];
        rows = sheets[firstSheet] || [];
        columns = rows.length > 0 ? Object.keys(rows[0]) : [];
        return [relName, { rows, columns, sheets: Object.keys(sheets), error: null, type: 'xlsx', path: filePath }];
      } else if (ext === '.json') {
        rows = parseJSON(filePath);
        columns = rows.length > 0 ? Object.keys(rows[0]) : [];
        return [relName, { rows, columns, error: null, type: 'json', path: filePath }];
      }
    } catch (err) {
      return [relName, { rows: [], columns: [], error: err.message, type: ext.slice(1), path: filePath }];
    }
  }

  // Run all file reads in parallel (batches of 12 to avoid fd exhaustion)
  const BATCH = 12;
  for (let i = 0; i < files.length; i += BATCH) {
    const batch = files.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(parseOne));
    for (const [relName, entry] of results) {
      fileIndex[relName] = entry;
    }
  }

  const elapsed = Date.now() - t0;
  indexReady = true;
  console.log(`[FUNDA] Index complete — ${Object.keys(fileIndex).length} files in ${elapsed}ms`);

  // Invalidate derived caches
  _sectorTickerCache = null;
  _fundaCache = {};
  _sectorMetricsCache = null;

  // Build fundamentals via single-pass inverted index (fast)
  setImmediate(() => {
    const t1 = Date.now();
    try {
      const n = buildFundamentalsIndex();
      console.log(`[FUNDA] Fundamentals index: ${n} tickers in ${Date.now() - t1}ms`);
    } catch (e) {
      console.warn('[FUNDA] Fundamentals index error:', e.message);
    }
  });
}

// ── Helper: find ticker across all indexed data ──────────────────────────────
function findTickerRows(symbol) {
  const upperSymbol = symbol.toUpperCase().trim();
  const tickerFields = ['NSE Code', 'BSE Code', 'symbol', 'Symbol', 'SYMBOL', 'TckrSymb',
    'ISIN', 'ScripCode', 'Name', 'NSE_CODE', 'nse_code'];
  const results = [];

  for (const [filename, info] of Object.entries(fileIndex)) {
    if (info.error || !info.rows.length) continue;
    const matchingRows = info.rows.filter(row => {
      return tickerFields.some(field => {
        const val = row[field];
        if (!val) return false;
        return String(val).toUpperCase().trim() === upperSymbol;
      });
    });
    if (matchingRows.length > 0) {
      results.push({ filename, rows: matchingRows, columns: info.columns });
    }
  }
  return results;
}

// ── Indicator helpers ────────────────────────────────────────────────────────
function calcSMA(prices, period) {
  return prices.map((_, i) => {
    if (i < period - 1) return null;
    const slice = prices.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
}

function calcEMA(prices, period) {
  const k = 2 / (period + 1);
  const result = new Array(prices.length).fill(null);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result[period - 1] = ema;
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
    result[i] = ema;
  }
  return result;
}

function calcRSI(prices, period = 14) {
  const result = new Array(prices.length).fill(null);
  if (prices.length <= period) return result;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period, avgLoss = losses / period;
  result[period] = 100 - 100 / (1 + (avgLoss === 0 ? Infinity : avgGain / avgLoss));
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
    result[i] = 100 - 100 / (1 + (avgLoss === 0 ? Infinity : avgGain / avgLoss));
  }
  return result;
}

function calcMACD(prices, fast = 12, slow = 26, signal = 9) {
  const fastEMA = calcEMA(prices, fast);
  const slowEMA = calcEMA(prices, slow);
  const macdLine = prices.map((_, i) =>
    fastEMA[i] != null && slowEMA[i] != null ? fastEMA[i] - slowEMA[i] : null
  );
  const validMacd = macdLine.map(v => v ?? 0);
  const signalLine = calcEMA(validMacd, signal);
  const histogram = macdLine.map((m, i) =>
    m != null && signalLine[i] != null ? m - signalLine[i] : null
  );
  return { macdLine, signalLine, histogram };
}

function calcBollinger(prices, period = 20, stdDev = 2) {
  const sma = calcSMA(prices, period);
  return prices.map((_, i) => {
    if (sma[i] == null) return { upper: null, middle: null, lower: null };
    const slice = prices.slice(i - period + 1, i + 1);
    const sd = Math.sqrt(slice.reduce((acc, v) => acc + Math.pow(v - sma[i], 2), 0) / period);
    return { upper: sma[i] + stdDev * sd, middle: sma[i], lower: sma[i] - stdDev * sd };
  });
}

// ── Row normalization helpers ─────────────────────────────────────────────────
const SECTOR_FIELDS = ['sector', 'Sector', 'industry', 'Industry', 'SECTOR', 'INDUSTRY', 'Sector Name', 'sectorName'];
const TICKER_FIELDS = ['NSE Code', 'BSE Code', 'symbol', 'Symbol', 'SYMBOL', 'TckrSymb', 'ISIN', 'ScripCode', 'NSE_CODE', 'nse_code', 'Ticker', 'ticker', 'TICKER'];
const NAME_FIELDS   = ['Name', 'name', 'CompanyName', 'Company', 'company', 'COMPANY'];
const CLOSE_FIELDS  = ['Close', 'close', 'CLOSE', 'Adj Close', 'LTP', 'ltp', 'LastPrice', 'ClosePrice'];
const OPEN_FIELDS   = ['Open', 'open', 'OPEN'];
const HIGH_FIELDS   = ['High', 'high', 'HIGH', 'DayHigh'];
const LOW_FIELDS    = ['Low', 'low', 'LOW', 'DayLow'];
const VOL_FIELDS    = ['Volume', 'volume', 'VOLUME', 'Vol', 'TtlTrdQty'];
const DATE_FIELDS   = ['Date', 'date', 'DATE', 'TradeDate', 'TradingDate', 'timestamp'];
const PE_FIELDS     = ['PE', 'P/E', 'pe', 'PERatio', 'PE Ratio', 'pe_ratio'];
const ROE_FIELDS    = ['ROE', 'roe', 'Return on Equity', 'ReturnOnEquity'];
const MCAP_FIELDS   = ['MarketCap', 'Market Cap', 'marketcap', 'mcap', 'Mkt Cap'];
const REV_FIELDS    = ['Revenue', 'revenue', 'Sales', 'NetSales', 'Revenues'];
const EPS_FIELDS    = ['EPS', 'eps', 'BasicEPS', 'DilutedEPS'];

function pickField(row, candidates) {
  for (const f of candidates) if (row[f] != null && row[f] !== '') return row[f];
  return null;
}
function numField(row, candidates) {
  const v = pickField(row, candidates);
  if (v == null) return null;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

function getSectorForRow(row) { return pickField(row, SECTOR_FIELDS); }
function getTickerForRow(row) { return pickField(row, TICKER_FIELDS); }

// Build sector→ticker map across all files (cached)
function buildSectorTickerMap() {
  if (_sectorTickerCache) return _sectorTickerCache;

  const map = {}; // sector -> Set of tickers
  const tickerMeta = {}; // ticker -> { name, sector }

  for (const [, info] of Object.entries(fileIndex)) {
    if (info.error || !info.rows.length) continue;
    for (const row of info.rows) {
      const sector = getSectorForRow(row);
      const ticker = getTickerForRow(row);
      if (!sector || !ticker) continue;
      const s = String(sector).trim();
      const t = String(ticker).toUpperCase().trim();
      if (!s || !t || t.length > 15) continue;
      if (!map[s]) map[s] = new Set();
      map[s].add(t);
      if (!tickerMeta[t]) {
        const name = pickField(row, NAME_FIELDS);
        tickerMeta[t] = { name: name ? String(name) : t, sector: s };
      }
    }
  }

  _sectorTickerCache = { map, tickerMeta };
  return _sectorTickerCache;
}

/**
 * buildFundamentalsIndex — single pass over ALL rows, bucket by ticker.
 * O(total_rows) instead of O(tickers × total_rows).
 * Populates _fundaCache for every ticker found in the data.
 */
function buildFundamentalsIndex() {
  // Merge fields: accumulate the first non-null value per field per ticker
  const tmp = {}; // ticker -> partial result

  for (const [, info] of Object.entries(fileIndex)) {
    if (info.error || !info.rows.length) continue;
    for (const row of info.rows) {
      const t = getTickerForRow(row);
      if (!t) continue;
      const key = String(t).toUpperCase().trim();
      if (!key || key.length > 20) continue;

      if (!tmp[key]) tmp[key] = { pe: null, roe: null, mcap: null, revenue: null, eps: null, name: key, sector: null };
      const r = tmp[key];

      if (r.pe      == null) r.pe      = numField(row, PE_FIELDS);
      if (r.roe     == null) r.roe     = numField(row, ROE_FIELDS);
      if (r.mcap    == null) r.mcap    = numField(row, MCAP_FIELDS);
      if (r.revenue == null) r.revenue = numField(row, REV_FIELDS);
      if (r.eps     == null) r.eps     = numField(row, EPS_FIELDS);
      if (!r.sector) {
        const s = getSectorForRow(row);
        if (s) r.sector = String(s).trim();
      }
      if (!r.name || r.name === key) {
        const n = pickField(row, NAME_FIELDS);
        if (n) r.name = String(n);
      }
    }
  }

  // Commit to cache
  for (const [key, val] of Object.entries(tmp)) {
    _fundaCache[key] = val;
  }
  return Object.keys(tmp).length;
}

// Build fundamental snapshot for a ticker.
// After buildFundamentalsIndex() runs, this is just a cache lookup (O(1)).
// Falls back to linear scan only if called before the index is ready.
function buildFundamentals(symbol) {
  const upperSymbol = symbol.toUpperCase().trim();
  if (_fundaCache[upperSymbol]) return _fundaCache[upperSymbol];

  // Fallback: single-ticker linear scan (used only before index warms up)
  const result = { pe: null, roe: null, mcap: null, revenue: null, eps: null, name: upperSymbol, sector: null };
  for (const [, info] of Object.entries(fileIndex)) {
    if (info.error || !info.rows.length) continue;
    for (const row of info.rows) {
      const t = getTickerForRow(row);
      if (!t || String(t).toUpperCase().trim() !== upperSymbol) continue;
      if (result.pe      == null) result.pe      = numField(row, PE_FIELDS);
      if (result.roe     == null) result.roe     = numField(row, ROE_FIELDS);
      if (result.mcap    == null) result.mcap    = numField(row, MCAP_FIELDS);
      if (result.revenue == null) result.revenue = numField(row, REV_FIELDS);
      if (result.eps     == null) result.eps     = numField(row, EPS_FIELDS);
      if (!result.sector) { const s = getSectorForRow(row); if (s) result.sector = String(s); }
      if (!result.name || result.name === upperSymbol) { const n = pickField(row, NAME_FIELDS); if (n) result.name = String(n); }
    }
  }
  _fundaCache[upperSymbol] = result;
  return result;
}

// Build OHLCV time-series for a ticker
function buildOHLCV(symbol) {
  const upperSymbol = symbol.toUpperCase().trim();
  const points = [];
  for (const [, info] of Object.entries(fileIndex)) {
    if (info.error || !info.rows.length) continue;
    for (const row of info.rows) {
      const t = getTickerForRow(row);
      if (!t || String(t).toUpperCase().trim() !== upperSymbol) continue;
      const date = pickField(row, DATE_FIELDS);
      const close = numField(row, CLOSE_FIELDS);
      if (!date || close == null) continue;
      points.push({
        date: String(date),
        open:  numField(row, OPEN_FIELDS),
        high:  numField(row, HIGH_FIELDS),
        low:   numField(row, LOW_FIELDS),
        close,
        volume: numField(row, VOL_FIELDS),
      });
    }
  }
  points.sort((a, b) => new Date(a.date) - new Date(b.date));
  return points;
}

// ── API Routes ───────────────────────────────────────────────────────────────

// Health
app.get('/api/funda/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'FUNDA',
    port: PORT,
    dataFolder: DATA_DIR,
    dataFolderExists: fs.existsSync(DATA_DIR),
    indexReady,
    filesIndexed: Object.keys(fileIndex).length,
    timestamp: new Date().toISOString()
  });
});

// Sectors with their tickers (cascading dropdown data)
app.get('/api/funda/sectors', (req, res) => {
  if (!indexReady) return res.status(503).json({ error: 'Index not ready yet' });
  const { map, tickerMeta } = buildSectorTickerMap();
  const sectors = Object.entries(map)
    .filter(([s]) => s && s !== 'undefined')
    .map(([sector, tickerSet]) => ({
      sector,
      tickers: [...tickerSet].sort().map(t => ({ ticker: t, name: tickerMeta[t]?.name || t }))
    }))
    .sort((a, b) => a.sector.localeCompare(b.sector));
  res.json({ count: sectors.length, sectors });
});

// Fundamental data for one or more tickers
app.get('/api/funda/fundamentals', (req, res) => {
  if (!indexReady) return res.status(503).json({ error: 'Index not ready yet' });
  const tickers = (req.query.tickers || '').split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
  if (!tickers.length) return res.status(400).json({ error: 'Provide ?tickers=SYM1,SYM2' });
  const data = tickers.map(t => buildFundamentals(t));
  res.json({ tickers, data });
});

// OHLCV data for one ticker with optional period filter
app.get('/api/funda/ohlcv/:symbol', (req, res) => {
  if (!indexReady) return res.status(503).json({ error: 'Index not ready yet' });
  const symbol = req.params.symbol.toUpperCase().trim();
  const period = req.query.period || 'all'; // 1W,1M,3M,6M,1Y,5Y,all

  let points = buildOHLCV(symbol);
  if (!points.length) {
    return res.status(404).json({ symbol, found: false, message: `No OHLCV data found for ${symbol}` });
  }

  if (period !== 'all') {
    const now = new Date();
    const cutoffs = { '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365, '5Y': 1825 };
    const days = cutoffs[period];
    if (days) {
      const cutoff = new Date(now - days * 86400000);
      points = points.filter(p => new Date(p.date) >= cutoff);
    }
  }

  const closes = points.map(p => p.close);
  const rsi = calcRSI(closes);
  const { macdLine, signalLine, histogram } = calcMACD(closes);
  const boll = calcBollinger(closes);

  const enriched = points.map((p, i) => ({
    ...p,
    rsi:         rsi[i],
    macd:        macdLine[i],
    macdSignal:  signalLine[i],
    macdHist:    histogram[i],
    bollUpper:   boll[i]?.upper,
    bollMiddle:  boll[i]?.middle,
    bollLower:   boll[i]?.lower,
  }));

  res.json({ symbol, period, count: enriched.length, data: enriched });
});

// Sector-level aggregated metrics for heatmap (cached after first computation)
app.get('/api/funda/sector-metrics', (req, res) => {
  if (!indexReady) return res.status(503).json({ error: 'Index not ready yet' });

  if (_sectorMetricsCache) {
    return res.json({ count: _sectorMetricsCache.length, sectors: _sectorMetricsCache });
  }

  const { map } = buildSectorTickerMap();
  const sectorMetrics = [];

  for (const [sector, tickerSet] of Object.entries(map)) {
    if (!sector || sector === 'undefined') continue;
    const tickers = [...tickerSet];
    const fundamentals = tickers.map(t => buildFundamentals(t));

    const avgOf = (field) => {
      const vals = fundamentals.map(f => f[field]).filter(v => v != null);
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };

    sectorMetrics.push({
      sector,
      tickerCount: tickers.length,
      avgPE:      avgOf('pe'),
      avgROE:     avgOf('roe'),
      avgMcap:    avgOf('mcap'),
      avgRevenue: avgOf('revenue'),
      avgEPS:     avgOf('eps'),
    });
  }

  sectorMetrics.sort((a, b) => a.sector.localeCompare(b.sector));
  _sectorMetricsCache = sectorMetrics;
  res.json({ count: sectorMetrics.length, sectors: sectorMetrics });
});

// Ticker-level metrics for intra-sector heatmap
app.get('/api/funda/ticker-metrics', (req, res) => {
  if (!indexReady) return res.status(503).json({ error: 'Index not ready yet' });
  const sector = req.query.sector;
  const tickersParam = req.query.tickers;

  let tickers = [];
  if (tickersParam) {
    tickers = tickersParam.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
  } else if (sector) {
    const { map } = buildSectorTickerMap();
    tickers = [...(map[sector] || new Set())];
  } else {
    return res.status(400).json({ error: 'Provide ?sector=NAME or ?tickers=SYM1,SYM2' });
  }

  const data = tickers.map(t => buildFundamentals(t));
  res.json({ sector: sector || null, tickers, data });
});

// Sankey data: Sectors → Sub-sectors / Tickers weighted by mcap
app.get('/api/funda/sankey', (req, res) => {
  if (!indexReady) return res.status(503).json({ error: 'Index not ready yet' });
  const { map } = buildSectorTickerMap();
  const nodes = [];
  const links = [];
  const nodeIndex = {};

  const addNode = (name) => {
    if (nodeIndex[name] == null) { nodeIndex[name] = nodes.length; nodes.push({ name }); }
    return nodeIndex[name];
  };

  for (const [sector, tickerSet] of Object.entries(map)) {
    if (!sector || sector === 'undefined') continue;
    const sIdx = addNode(sector);
    const tickers = [...tickerSet].slice(0, 20); // cap at 20 per sector for readability
    for (const t of tickers) {
      const funda = buildFundamentals(t);
      const weight = funda.mcap || funda.revenue || 1;
      const tIdx = addNode(t);
      links.push({ source: sIdx, target: tIdx, value: Math.max(weight, 1) });
    }
  }

  res.json({ nodes, links });
});

// Summary of all tickers (backward compat)
app.get('/api/funda/summary', (req, res) => {
  if (!indexReady) return res.status(503).json({ error: 'Index not ready yet' });

  const sectors = new Set();
  const tickers = new Set();

  for (const [, info] of Object.entries(fileIndex)) {
    if (info.error || !info.rows.length) continue;
    for (const row of info.rows) {
      const s = getSectorForRow(row);
      const t = getTickerForRow(row);
      if (s) sectors.add(String(s).trim());
      if (t) tickers.add(String(t).toUpperCase().trim());
    }
  }

  const summary = {
    filesIndexed: Object.keys(fileIndex).length,
    totalUniqueRows: Object.values(fileIndex).reduce((a, b) => a + b.rows.length, 0),
    uniqueTickers: tickers.size,
    tickerSample: [...tickers].filter(t => t.length > 0 && t.length <= 12).slice(0, 50),
    uniqueSectors: sectors.size,
    sectors: [...sectors].filter(s => s).sort(),
    indexedFiles: Object.keys(fileIndex).map(f => ({
      name: f,
      rows: fileIndex[f].rows.length,
      error: fileIndex[f].error
    }))
  };
  res.json(summary);
});

// Ticker search (backward compat — data still hidden behind visual layer in frontend)
app.get('/api/funda/ticker/:symbol', (req, res) => {
  if (!indexReady) return res.status(503).json({ error: 'Index not ready yet' });
  const symbol = req.params.symbol;
  if (!symbol || symbol.length < 1) return res.status(400).json({ error: 'Symbol required' });

  const funda = buildFundamentals(symbol);
  const ohlcv = buildOHLCV(symbol).slice(-30);
  if (!funda.pe && !funda.roe && !ohlcv.length) {
    return res.status(404).json({ symbol, found: false, message: `No data found for "${symbol}"` });
  }
  res.json({ symbol, found: true, fundamentals: funda, recentOHLCV: ohlcv });
});

// ── Markets / Movers API ─────────────────────────────────────────────────────

// Helper: read bhavdata from indexed files
function getBhavdata() {
  for (const [, info] of Object.entries(fileIndex)) {
    if (info.error || !info.rows.length) continue;
    const first = info.rows[0];
    if (first['SYMBOL'] && first['CLOSE_PRICE'] !== undefined) return info.rows;
    if (first['SYMBOL'] && first['LAST_PRICE'] !== undefined) return info.rows;
  }
  // fallback: look for sec_bhavdata
  for (const [name, info] of Object.entries(fileIndex)) {
    if (name.toLowerCase().includes('bhav') && info.rows.length > 0) return info.rows;
  }
  return [];
}

function getPEData() {
  for (const [name, info] of Object.entries(fileIndex)) {
    if ((name.toLowerCase().includes('pe_') || name.toLowerCase().includes('/pe')) && info.rows.length > 0) return info.rows;
  }
  return [];
}

function getVolatilityData() {
  for (const [name, info] of Object.entries(fileIndex)) {
    if (name.toLowerCase().includes('cmvolt') || name.toLowerCase().includes('volt')) {
      if (info.rows.length > 0) return info.rows;
    }
  }
  return [];
}

function getMcapData() {
  for (const [name, info] of Object.entries(fileIndex)) {
    if (name.toLowerCase().includes('mcap') && info.rows.length > 0) return info.rows;
  }
  return [];
}

function getBulkData() {
  for (const [name, info] of Object.entries(fileIndex)) {
    if (name.toLowerCase().includes('bulk') && info.rows.length > 0) return info.rows;
  }
  return [];
}

function getShortData() {
  for (const [name, info] of Object.entries(fileIndex)) {
    if (name.toLowerCase().includes('short') && info.rows.length > 0) return info.rows;
  }
  return [];
}

function getGainersLosers() {
  for (const [name, info] of Object.entries(fileIndex)) {
    if ((name.toLowerCase().includes('/gl') || name.toLowerCase().includes('gainers') || name.toLowerCase().includes('gain_loss'))
        && info.rows.length > 0) return info.rows;
  }
  return [];
}

function get52WkHL() {
  for (const [name, info] of Object.entries(fileIndex)) {
    if (name.toLowerCase().includes('52') && info.rows.length > 0) return info.rows;
  }
  return [];
}

function numOrNull(v) {
  if (v == null || v === '' || v === '-') return null;
  const n = parseFloat(String(v).replace(/,/g, '').trim());
  return isNaN(n) ? null : n;
}

// GET /api/funda/markets/movers?type=gainers|losers|active&limit=50
app.get('/api/funda/markets/movers', (req, res) => {
  if (!indexReady) return res.status(503).json({ error: 'Index not ready' });
  const type  = req.query.type || 'gainers';
  const limit = Math.min(200, parseInt(req.query.limit) || 50);

  const bhav = getBhavdata();
  if (!bhav.length) return res.json({ type, count: 0, data: [] });

  const rows = bhav.map(r => {
    const sym    = r['SYMBOL']  || r['Symbol'] || r['symbol'] || '';
    const series = r['SERIES']  || r['Series'] || 'EQ';
    const close  = numOrNull(r['CLOSE_PRICE']  || r['Close'] || r['LAST_PRICE'] || r['LastPrice']);
    const prev   = numOrNull(r['PREV_CLOSE']   || r['PrevClose'] || r['PREV_CL_PR']);
    const open   = numOrNull(r['OPEN_PRICE']   || r['Open']);
    const high   = numOrNull(r['HIGH_PRICE']   || r['High']);
    const low    = numOrNull(r['LOW_PRICE']    || r['Low']);
    const vol    = numOrNull(r['TTL_TRD_QNTY'] || r['Volume'] || r['NET_TRDQTY']);
    const turn   = numOrNull(r['TURNOVER_LACS'] || r['Turnover'] || r['NET_TRDVAL']);
    const trades = numOrNull(r['NO_OF_TRADES']  || r['Trades']);
    const deliv  = numOrNull(r['DELIV_PER']    || r['DelivPer']);
    const chgPct = (close != null && prev != null && prev !== 0)
      ? +((close - prev) / prev * 100).toFixed(2) : null;
    const chgAbs = (close != null && prev != null) ? +(close - prev).toFixed(2) : null;
    return { sym, series, close, prev, open, high, low, vol, turn, trades, deliv, chgPct, chgAbs };
  }).filter(r => r.sym && r.series === 'EQ' && r.close != null && r.chgPct != null);

  let sorted;
  if (type === 'gainers') sorted = [...rows].sort((a, b) => (b.chgPct ?? -999) - (a.chgPct ?? -999));
  else if (type === 'losers')  sorted = [...rows].sort((a, b) => (a.chgPct ?? 999)  - (b.chgPct ?? 999));
  else sorted = [...rows].sort((a, b) => (b.turn ?? 0) - (a.turn ?? 0)); // most active

  const pe    = getPEData();
  const peMap = {};
  pe.forEach(r => {
    const s = r['SYMBOL'] || r['Symbol'] || '';
    const v = numOrNull(r['SYMBOL P/E'] || r['PE'] || r['ADJUSTED P/E']);
    if (s && v != null) peMap[s.trim()] = v;
  });

  const vol2 = getVolatilityData();
  const voltMap = {};
  vol2.forEach(r => {
    const s = r['Symbol'] || r['SYMBOL'] || '';
    const v = numOrNull(r['Underlying Annualised Volatility (F) = E*Sqrt(365)'] || r['AnnVol'] || r['VolAnn']);
    if (s && v != null) voltMap[s.trim()] = v;
  });

  const mcap = getMcapData();
  const mcapMap = {};
  mcap.forEach(r => {
    const s = (r['Symbol'] || r['SYMBOL'] || '').trim();
    const v = numOrNull(r['Market Cap(Rs.)'] || r['MarketCap'] || r['MCAP']);
    if (s && v != null) mcapMap[s] = v;
  });

  const result = sorted.slice(0, limit).map(r => ({
    ticker:    r.sym,
    close:     r.close,
    prev:      r.prev,
    open:      r.open,
    high:      r.high,
    low:       r.low,
    chgPct:    r.chgPct,
    chgAbs:    r.chgAbs,
    volume:    r.vol,
    turnover:  r.turn,
    trades:    r.trades,
    delivPct:  r.deliv,
    pe:        peMap[r.sym] ?? null,
    annVol:    voltMap[r.sym] != null ? +(voltMap[r.sym] * 100).toFixed(2) : null,
    mcap:      mcapMap[r.sym] ?? null,
  }));

  res.json({ type, date: bhav[0]?.['DATE1'] || bhav[0]?.['Trade Date'] || 'latest', count: result.length, data: result });
});

// GET /api/funda/markets/52wk?type=high|low
app.get('/api/funda/markets/52wk', (req, res) => {
  if (!indexReady) return res.status(503).json({ error: 'Index not ready' });
  const type  = req.query.type || 'high';
  const limit = Math.min(200, parseInt(req.query.limit) || 50);
  const rows  = get52WkHL();
  if (!rows.length) return res.json({ type, count: 0, data: [] });

  const bhav = getBhavdata();
  const closeMap = {};
  bhav.forEach(r => {
    const s = (r['SYMBOL'] || r['Symbol'] || '').trim();
    const c = numOrNull(r['CLOSE_PRICE'] || r['LAST_PRICE']);
    if (s && c) closeMap[s] = c;
  });

  const result = rows
    .map(r => {
      const sym   = (r['SYMBOL'] || r['Symbol'] || '').trim().replace(/"/g, '');
      const hi52  = numOrNull(r['Adjusted_52_Week_High'] || r['52_Wk_H'] || r['HIGH_52']);
      const lo52  = numOrNull(r['Adjusted_52_Week_Low']  || r['52_Wk_L'] || r['LOW_52']);
      const close = closeMap[sym] ?? null;
      const hiDt  = r['52_Week_High_Date'] || r['52Wk_High_Date'] || '';
      const loDt  = r['52_Week_Low_DT']    || r['52Wk_Low_Date']  || '';
      return { ticker: sym, close, hi52, lo52, hiDate: hiDt, loDate: loDt };
    })
    .filter(r => r.ticker && r.ticker.length >= 2 && r.ticker !== '-')
    .filter(r => type === 'high' ? r.hi52 != null : r.lo52 != null)
    .sort((a, b) => type === 'high'
      ? (b.hi52 ?? 0) - (a.hi52 ?? 0)
      : (a.lo52 ?? 999999) - (b.lo52 ?? 999999))
    .slice(0, limit);

  res.json({ type, count: result.length, data: result });
});

// GET /api/funda/markets/bulk-deals
app.get('/api/funda/markets/bulk-deals', (req, res) => {
  if (!indexReady) return res.status(503).json({ error: 'Index not ready' });
  const rows = getBulkData();
  const data = rows.map(r => ({
    date:     r['Date'] || r['Trade Date'] || '',
    ticker:   (r['Symbol'] || r['SYMBOL'] || '').trim(),
    name:     r['Security Name'] || r['Name'] || '',
    client:   r['Client Name'] || r['ClientName'] || '',
    side:     r['Buy/Sell'] || r['BuySell'] || '',
    qty:      numOrNull(r['Quantity Traded'] || r['Qty']),
    price:    numOrNull(r['Trade Price / Wght. Avg. Price'] || r['Price']),
  })).filter(r => r.ticker);
  res.json({ count: data.length, data });
});

// GET /api/funda/markets/short-selling
app.get('/api/funda/markets/short-selling', (req, res) => {
  if (!indexReady) return res.status(503).json({ error: 'Index not ready' });
  const rows = getShortData();
  const data = rows.map(r => ({
    date:   r['Trade Date'] || '',
    ticker: (r['Symbol Name'] || r['SYMBOL'] || '').trim(),
    name:   r['Security Name'] || '',
    qty:    numOrNull(r['Quantity'] || r['Qty']),
  })).filter(r => r.ticker);
  res.json({ count: data.length, data });
});

// GET /api/funda/markets/volatility?limit=50
app.get('/api/funda/markets/volatility', (req, res) => {
  if (!indexReady) return res.status(503).json({ error: 'Index not ready' });
  const limit = Math.min(200, parseInt(req.query.limit) || 50);
  const rows = getVolatilityData();
  const data = rows.map(r => ({
    date:    r['Date'] || '',
    ticker:  (r['Symbol'] || r['SYMBOL'] || '').trim(),
    close:   numOrNull(r['Underlying Close Price (A)'] || r['Close']),
    prevClose: numOrNull(r['Underlying Previous Day Close Price (B)'] || r['PrevClose']),
    dailyVol:  numOrNull(r['Current Day Underlying Daily Volatility (E) = Sqrt(0.995*D*D + 0.005*C*C)'] || r['DailyVol']),
    annVol:  numOrNull(r['Underlying Annualised Volatility (F) = E*Sqrt(365)'] || r['AnnVol']),
  }))
  .filter(r => r.ticker && r.annVol != null)
  .sort((a, b) => (b.annVol ?? 0) - (a.annVol ?? 0))
  .slice(0, limit);
  res.json({ count: data.length, data });
});

// GET /api/funda/markets/overview — indices + summary stats
app.get('/api/funda/markets/overview', (req, res) => {
  if (!indexReady) return res.status(503).json({ error: 'Index not ready' });
  const bhav = getBhavdata();
  if (!bhav.length) return res.json({ indices: [], stats: {} });

  const equityRows = bhav.filter(r => (r['SERIES'] || r['Series'] || '') === 'EQ');
  const closes = equityRows.map(r => numOrNull(r['CLOSE_PRICE'] || r['LAST_PRICE'])).filter(v => v != null);
  const prevs  = equityRows.map(r => numOrNull(r['PREV_CLOSE']  || r['PREV_CL_PR'])).filter(v => v != null);

  const chgPcts = equityRows.map(r => {
    const c = numOrNull(r['CLOSE_PRICE'] || r['LAST_PRICE']);
    const p = numOrNull(r['PREV_CLOSE']  || r['PREV_CL_PR']);
    return c != null && p != null && p !== 0 ? (c - p) / p * 100 : null;
  }).filter(v => v != null);

  const advancers = chgPcts.filter(v => v > 0).length;
  const decliners = chgPcts.filter(v => v < 0).length;
  const unchanged = chgPcts.filter(v => v === 0).length;

  // Pull indices from nse-stocks.json or market-indices.json if indexed
  const indices = [];
  for (const [name, info] of Object.entries(fileIndex)) {
    if (name.toLowerCase().includes('indices') || name.toLowerCase().includes('market-indices')) {
      info.rows.forEach(r => {
        const n = r['name'] || r['Name'] || r['INDEX'] || r['index'] || '';
        const v = numOrNull(r['value'] || r['Value'] || r['LAST'] || r['last']);
        const c = numOrNull(r['pChange'] || r['pchange'] || r['PERCENT_CHANGE'] || r['change']);
        if (n && v) indices.push({ name: n, value: v, chgPct: c });
      });
    }
  }

  res.json({
    date: bhav[0]?.['DATE1'] || bhav[0]?.['Trade Date'] || 'latest',
    totalEquities: equityRows.length,
    advancers, decliners, unchanged,
    advanceDeclineRatio: decliners > 0 ? +(advancers / decliners).toFixed(2) : null,
    avgClose: closes.length ? +(closes.reduce((a, b) => a + b, 0) / closes.length).toFixed(2) : null,
    indices,
  });
});

// ── NSE Downloader API ────────────────────────────────────────────────────────

// GET /api/funda/nse/reports — catalogue of available report types
app.get('/api/funda/nse/reports', (_req, res) => {
  const categories = [...new Set(REPORTS.map(r => r.category))];
  const grouped = categories.map(cat => ({
    category: cat,
    reports: REPORTS.filter(r => r.category === cat).map(r => ({
      id: r.id, name: r.name, ext: r.ext, optional: !!r.optional,
    })),
  }));
  res.json({ total: REPORTS.length, categories: grouped });
});

// GET /api/funda/nse/downloaded — list of already-downloaded date folders
app.get('/api/funda/nse/downloaded', (_req, res) => {
  try {
    const dates = listDownloadedDates();
    res.json({ count: dates.length, dates });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Streaming download progress via SSE
const downloadJobs = {};   // jobId -> { status, progress[] }

// POST /api/funda/nse/download  { date?: 'DDMMYYYY', ids?: [...] }
app.post('/api/funda/nse/download', express.json(), (req, res) => {
  const { date, ids } = req.body || {};
  const dateStr = date || todayDateStr();
  const jobId   = `${dateStr}_${Date.now()}`;

  downloadJobs[jobId] = { status: 'running', dateStr, progress: [], startedAt: new Date().toISOString() };

  res.json({ jobId, dateStr, message: 'Download started. Poll /api/funda/nse/job/:id for progress.' });

  // Run in background
  downloadReports(dateStr, ids || [], (msg) => {
    downloadJobs[jobId].progress.push(msg);
  }, (report, result) => {
    downloadJobs[jobId].progress.push({
      id:     report.id,
      name:   report.name,
      status: result.ok ? (result.skipped ? 'skipped' : 'ok') : `error`,
      bytes:  result.bytes || 0,
    });
  }).then((summary) => {
    downloadJobs[jobId].status = 'done';
    downloadJobs[jobId].summary = summary;
    // Trigger re-index on completion
    buildIndex().catch(() => {});
  }).catch((e) => {
    downloadJobs[jobId].status = 'error';
    downloadJobs[jobId].error = e.message;
  });
});

// GET /api/funda/nse/job/:id
app.get('/api/funda/nse/job/:id', (req, res) => {
  const job = downloadJobs[req.params.id];
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

// ── Live Quotes API (Yahoo Finance — real-time, no static data) ──────────────
// Lazy-loaded to avoid slowing startup
let _yf = null;
function getYF() {
  if (!_yf) {
    try {
      const mod = require('yahoo-finance2');
      const Cls = mod.default || mod;
      // v4+ exports a class that must be instantiated; v2 exported a singleton object
      _yf = (typeof Cls === 'function') ? new Cls({ suppressNotices: ['yahooSurvey', 'ripHistorical'] }) : Cls;
      if (_yf.suppressNotices) _yf.suppressNotices(['yahooSurvey', 'ripHistorical']);
    } catch (e) {
      console.warn('[FUNDA] yahoo-finance2 not available:', e.message);
    }
  }
  return _yf;
}

// In-memory quote cache: key → { data, ts }
const _quoteCache = {};
const QUOTE_TTL = 60 * 1000; // 1 minute

async function getLiveQuote(symbol) {
  const key = symbol.toUpperCase();
  const cached = _quoteCache[key];
  if (cached && Date.now() - cached.ts < QUOTE_TTL) return cached.data;

  const yf = getYF();
  if (!yf) throw new Error('yahoo-finance2 not installed');

  const q = await yf.quote(key);
  if (!q || !q.regularMarketPrice) throw new Error(`No data for ${symbol}`);

  const data = {
    symbol: key,
    name:   q.longName || q.shortName || key,
    price:  q.regularMarketPrice,
    change: +(q.regularMarketChange || 0).toFixed(2),
    changePct: +(q.regularMarketChangePercent || 0).toFixed(2),
    open:   q.regularMarketOpen,
    high:   q.regularMarketDayHigh,
    low:    q.regularMarketDayLow,
    prevClose: q.regularMarketPreviousClose,
    volume: q.regularMarketVolume,
    mcap:   q.marketCap,
    pe:     q.trailingPE,
    eps:    q.epsTrailingTwelveMonths,
    hi52w:  q.fiftyTwoWeekHigh,
    lo52w:  q.fiftyTwoWeekLow,
    currency: q.currency,
    exchange: q.fullExchangeName,
    fetchedAt: new Date().toISOString(),
    live: true,
  };
  _quoteCache[key] = { data, ts: Date.now() };
  return data;
}

// GET /api/funda/live/quote/:symbol — single ticker live quote
app.get('/api/funda/live/quote/:symbol', async (req, res) => {
  const sym = req.params.symbol.toUpperCase().trim();
  try {
    const data = await getLiveQuote(sym);
    // Merge with fundamentals from local index (sector etc.)
    const funda = _fundaCache[sym] || {};
    res.json({ ...data, sector: funda.sector || null, roe: funda.roe || null });
  } catch (e) {
    res.status(502).json({ error: e.message, symbol: sym, live: false });
  }
});

// GET /api/funda/live/quotes?symbols=RELIANCE.NS,TCS.NS,INFY.NS
// Batch up to 20 tickers in one call
app.get('/api/funda/live/quotes', async (req, res) => {
  const rawList = (req.query.symbols || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean).slice(0, 20);
  if (!rawList.length) return res.status(400).json({ error: 'Provide ?symbols=SYM1,SYM2' });

  const results = await Promise.allSettled(rawList.map(sym => getLiveQuote(sym)));
  const quotes = results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { symbol: rawList[i], error: r.reason?.message || 'failed', live: false }
  );
  res.json({ count: quotes.length, quotes, fetchedAt: new Date().toISOString() });
});

// GET /api/funda/live/history/:symbol?period=6mo&interval=1d
app.get('/api/funda/live/history/:symbol', async (req, res) => {
  const sym    = req.params.symbol.toUpperCase().trim();
  const period = req.query.period   || '6mo';
  const interval = req.query.interval || '1d';
  try {
    const yf = getYF();
    if (!yf) throw new Error('yahoo-finance2 not installed');
    if (yf.suppressNotices) yf.suppressNotices(['ripHistorical']);

    // Use chart() which is the supported API in v3
    const periodMap = { '1mo':30,'3mo':90,'6mo':180,'1y':365,'2y':730,'5y':1825 };
    const days = periodMap[period] || 180;
    const period1 = new Date(Date.now() - days * 86400000);

    let raw;
    try {
      // v3: use chart
      raw = await yf.chart(sym, { period1, interval });
      const quotes = raw?.quotes || [];
      const data = quotes.map(q => ({
        date:   q.date ? q.date.toISOString().split('T')[0] : null,
        open:   q.open, high: q.high, low: q.low, close: q.close, volume: q.volume
      })).filter(q => q.date && q.close != null);
      return res.json({ symbol: sym, period, interval, count: data.length, data, live: true });
    } catch {
      // v2 fallback
      raw = await yf.historical(sym, { period1, interval });
      const data = (raw || []).map(d => ({
        date:   d.date?.toISOString().split('T')[0] || '',
        open: d.open, high: d.high, low: d.low, close: d.close, volume: d.volume
      })).filter(q => q.date && q.close != null);
      return res.json({ symbol: sym, period, interval, count: data.length, data, live: true });
    }
  } catch (e) {
    res.status(502).json({ error: e.message, symbol: sym });
  }
});

// GET /api/funda/live/nse-top — top NSE movers from static index (fast, no external call)
// Returns pre-computed gainers/losers/active using already-indexed bhavdata
app.get('/api/funda/live/nse-top', (req, res) => {
  if (!indexReady) return res.status(503).json({ error: 'Index not ready' });
  const limit = Math.min(50, parseInt(req.query.limit) || 10);

  // Re-use the already-computed movers from in-memory index — instant
  function fastMovers(type) {
    const bhav = getBhavdata();
    if (!bhav.length) return [];
    return bhav
      .map(r => {
        const sym   = (r['SYMBOL'] || '').trim();
        const close = numOrNull(r['CLOSE_PRICE'] || r['LAST_PRICE']);
        const prev  = numOrNull(r['PREV_CLOSE']  || r['PREV_CL_PR']);
        const vol   = numOrNull(r['TTL_TRD_QNTY']);
        const turn  = numOrNull(r['TURNOVER_LACS']);
        const deliv = numOrNull(r['DELIV_PER']);
        const chgPct = close != null && prev && prev !== 0 ? +((close-prev)/prev*100).toFixed(2) : null;
        return { sym, close, prev, vol, turn, deliv, chgPct, series: r['SERIES'] };
      })
      .filter(r => r.sym && r.series === 'EQ' && r.chgPct != null);
  }

  const rows = fastMovers();
  const gainers = [...rows].sort((a,b) => b.chgPct - a.chgPct).slice(0, limit);
  const losers  = [...rows].sort((a,b) => a.chgPct - b.chgPct).slice(0, limit);
  const active  = [...rows].sort((a,b) => (b.turn||0) - (a.turn||0)).slice(0, limit);

  const fmt = r => ({
    symbol: r.sym, close: r.close, prevClose: r.prev,
    changePct: r.chgPct, volume: r.vol, delivPct: r.deliv,
    pe: _quoteCache[r.sym]?.data?.pe ?? (_fundaCache[r.sym]?.pe ?? null),
    sector: _fundaCache[r.sym]?.sector ?? null,
  });

  res.json({ gainers: gainers.map(fmt), losers: losers.map(fmt), active: active.map(fmt), fetchedAt: new Date().toISOString() });
});

// ── Live OHLCV + Indicators endpoint ────────────────────────────────────────
// GET /api/funda/live/indicators/:symbol?period=6mo&interval=1d
// Returns full OHLCV array pre-enriched with RSI, MACD, Bollinger — all computed server-side.
// This is the canonical data source for ALL technical charts (B + D sections).
app.get('/api/funda/live/indicators/:symbol', async (req, res) => {
  const sym      = req.params.symbol.toUpperCase().trim();
  const period   = req.query.period   || '6mo';
  const interval = req.query.interval || '1d';

  try {
    const yf = getYF();
    if (!yf) throw new Error('yahoo-finance2 not installed');

    const periodMap = { '1W':7,'1M':30,'3M':90,'6M':180,'1Y':365,'2Y':730,'5Y':1825,'all':365*5 };
    const periodAlias = { '1W':'1W','1M':'1M','3M':'3M','6M':'6M','1Y':'1Y','5Y':'5Y','all':'all' };
    const key = periodAlias[period] || period;
    const days = periodMap[key] || 180;
    const period1 = new Date(Date.now() - days * 86400000);

    let rows = [];
    try {
      const result = await yf.chart(sym, { period1, interval });
      rows = (result?.quotes || []).filter(d => d.close != null);
      rows = rows.map(d => ({
        date:   (d.date instanceof Date ? d.date : new Date(d.date)).toISOString().split('T')[0],
        open: d.open, high: d.high, low: d.low, close: d.close, volume: d.volume,
      }));
    } catch (_) {
      const hist = await yf.historical(sym, { period1, interval }) || [];
      rows = hist.map(d => ({
        date:   (d.date instanceof Date ? d.date : new Date(d.date)).toISOString().split('T')[0],
        open: d.open, high: d.high, low: d.low, close: d.close, volume: d.volume,
      }));
    }

    if (!rows.length) return res.status(404).json({ error: `No data for ${sym}` });

    // ── Compute indicators ──────────────────────────────────────────────────
    const closes = rows.map(r => r.close);
    const highs  = rows.map(r => r.high  ?? r.close);
    const lows   = rows.map(r => r.low   ?? r.close);

    // RSI(14) — Wilder smoothing
    const rsiArr = Array(rows.length).fill(null);
    if (closes.length >= 15) {
      let avgG = 0, avgL = 0;
      for (let i = 1; i <= 14; i++) {
        const d = closes[i] - closes[i-1];
        if (d >= 0) avgG += d; else avgL -= d;
      }
      avgG /= 14; avgL /= 14;
      rsiArr[14] = avgL === 0 ? 100 : +(100 - 100 / (1 + avgG / avgL)).toFixed(2);
      for (let i = 15; i < closes.length; i++) {
        const d = closes[i] - closes[i-1];
        avgG = (avgG * 13 + Math.max(d, 0)) / 14;
        avgL = (avgL * 13 + Math.max(-d, 0)) / 14;
        rsiArr[i] = avgL === 0 ? 100 : +(100 - 100 / (1 + avgG / avgL)).toFixed(2);
      }
    }

    // EMA helper
    const ema = (arr, p) => {
      const k = 2 / (p + 1), out = Array(arr.length).fill(null);
      let seed = arr.slice(0, p).filter(v => v != null);
      if (seed.length < p) return out;
      let val = seed.reduce((a, b) => a + b, 0) / p;
      out[p - 1] = val;
      for (let i = p; i < arr.length; i++) {
        val = arr[i] * k + val * (1 - k);
        out[i] = +val.toFixed(4);
      }
      return out;
    };

    // MACD(12,26,9)
    const ema12 = ema(closes, 12);
    const ema26 = ema(closes, 26);
    const macdRaw = ema12.map((v, i) => (v != null && ema26[i] != null) ? +(v - ema26[i]).toFixed(4) : null);
    const signal  = ema(macdRaw.map(v => v ?? 0), 9);
    const macdHist = macdRaw.map((v, i) => (v != null && signal[i] != null) ? +(v - signal[i]).toFixed(4) : null);

    // Bollinger Bands(20, 2σ)
    const bollUpper = Array(rows.length).fill(null);
    const bollMiddle = Array(rows.length).fill(null);
    const bollLower  = Array(rows.length).fill(null);
    for (let i = 19; i < closes.length; i++) {
      const slice = closes.slice(i - 19, i + 1);
      const mean = slice.reduce((a, b) => a + b, 0) / 20;
      const std  = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / 20);
      bollMiddle[i] = +mean.toFixed(2);
      bollUpper[i]  = +(mean + 2 * std).toFixed(2);
      bollLower[i]  = +(mean - 2 * std).toFixed(2);
    }

    // ATR(14)
    const atrArr = Array(rows.length).fill(null);
    if (rows.length > 14) {
      const trs = rows.map((r, i) => {
        if (i === 0) return r.high - r.low;
        return Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i-1]), Math.abs(lows[i] - closes[i-1]));
      });
      let atr = trs.slice(0, 14).reduce((a, b) => a + b, 0) / 14;
      atrArr[13] = +atr.toFixed(4);
      for (let i = 14; i < trs.length; i++) {
        atr = (atr * 13 + trs[i]) / 14;
        atrArr[i] = +atr.toFixed(4);
      }
    }

    const enriched = rows.map((r, i) => ({
      ...r,
      rsi:        rsiArr[i],
      macd:       macdRaw[i],
      macdSignal: signal[i],
      macdHist:   macdHist[i],
      bollUpper:  bollUpper[i],
      bollMiddle: bollMiddle[i],
      bollLower:  bollLower[i],
      atr:        atrArr[i],
    }));

    res.json({ symbol: sym, period, interval, count: enriched.length, data: enriched, fetchedAt: new Date().toISOString() });
  } catch (e) {
    res.status(502).json({ error: e.message, symbol: sym });
  }
});

// ── Sector Treemap endpoint ──────────────────────────────────────────────────
// GET /api/funda/treemap
// Returns all tickers with mcap, chgPct, sector — for TradingView-style heatmap treemap.
// Uses bhavdata (chgPct) + mcap file + fundamentals index (sector).
app.get('/api/funda/treemap', (req, res) => {
  if (!indexReady) return res.status(503).json({ error: 'Index not ready' });

  const bhav = getBhavdata();
  const mcapData = getMcapData();
  const peData = getPEData();

  // Build quick-lookup maps — accept EQ series or rows without a SERIES column
  const chgMap  = {};
  const closeMap = {};
  bhav.forEach(r => {
    const s = (r['SYMBOL'] || r['Symbol'] || '').trim();
    if (!s) return;
    const series = (r['SERIES'] || r['Series'] || 'EQ').trim();
    if (series && series !== 'EQ' && series !== '') return;
    const close = numOrNull(r['CLOSE_PRICE'] || r['LAST_PRICE'] || r['Close'] || r['LTP']);
    const prev  = numOrNull(r['PREV_CLOSE']  || r['PREV_CL_PR'] || r['Prev Close']);
    const chg   = close != null && prev && prev !== 0 ? +((close - prev) / prev * 100).toFixed(2) : null;
    if (s && close != null) closeMap[s] = close;
    if (s && chg != null)   chgMap[s]   = chg;
  });

  const mcapMap = {};
  mcapData.forEach(r => {
    const s = (r['Symbol'] || r['SYMBOL'] || '').trim();
    const v = numOrNull(r['Market Cap(Rs.)'] || r['MarketCap'] || r['MCAP']);
    if (s && v != null) mcapMap[s] = v;
  });

  const peMap = {};
  peData.forEach(r => {
    const s = (r['SYMBOL'] || r['Symbol'] || '').trim();
    const v = numOrNull(r['SYMBOL P/E'] || r['PE'] || r['ADJUSTED P/E']);
    if (s && v != null) peMap[s] = v;
  });

  // Collect all tickers with sector from fundamentals cache
  const { map: sectorMap, tickerMeta } = buildSectorTickerMap();
  const items = [];

  for (const [sector, tickerSet] of Object.entries(sectorMap)) {
    if (!sector || sector === 'undefined') continue;
    for (const ticker of tickerSet) {
      const chg   = chgMap[ticker];
      const mcap  = mcapMap[ticker] || _fundaCache[ticker]?.mcap || null;
      const close = closeMap[ticker] || null;
      const pe    = peMap[ticker]    || _fundaCache[ticker]?.pe  || null;
      // Include tickers we at least know the sector of
      items.push({
        ticker,
        name:    tickerMeta[ticker]?.name || ticker,
        sector,
        mcap,
        close,
        chgPct:  chg  ?? null,
        pe,
      });
    }
  }

  res.json({ count: items.length, items, fetchedAt: new Date().toISOString() });
});

// Serve frontend build
const frontendBuild = path.join(__dirname, 'frontend', 'dist');
if (fs.existsSync(frontendBuild)) {
  app.use(express.static(frontendBuild, { index: false }));
  app.get(/^(?!\/(api)\/).*$/, (req, res) => {
    res.sendFile(path.join(frontendBuild, 'index.html'));
  });
}

// ── Start ────────────────────────────────────────────────────────────────────
buildIndex().then(() => {
  app.listen(PORT, () => {
    console.log(`[FUNDA] Backend running on http://localhost:${PORT}`);
    console.log(`[FUNDA] DATA folder: ${DATA_DIR}`);
  });
});
