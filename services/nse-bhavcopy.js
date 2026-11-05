/**
 * services/nse-bhavcopy.js
 * Fetches and parses NSE Equity Bhavcopy (daily end-of-day CSV) directly from
 * NSE India's public download endpoint.
 *
 * Endpoint (public, no auth):
 *   https://nsearchives.nseindia.com/content/historical/EQUITIES/{YYYY}/{MON}/cm{DD}{MON}{YYYY}bhav.csv.zip
 *   Fallback (newer format):
 *   https://www.nseindia.com/api/reports?archives=[{"name":"...","type":"daily","category":"capital-market","section":"equities"}]
 *
 * CSV columns (EQ Bhavcopy):
 *   SYMBOL, SERIES, OPEN, HIGH, LOW, CLOSE, LAST, PREVCLOSE, TOTTRDQTY, TOTTRDVAL,
 *   TIMESTAMP, TOTALTRADES, ISIN
 *
 * Delivery data (CM-UDiFF) merged when available:
 *   SYMBOL, SERIES, QUANTITY_TRADED, DELIVERABLE_QTY, %_DELIV_TO_TRADED_QTY
 *
 * Sector mapping: lightweight static map (500+ stocks → sector).
 */

'use strict';

const https = require('https');
const http  = require('http');
const zlib  = require('zlib');
const path  = require('path');
const fs    = require('fs');

// ── Cache ─────────────────────────────────────────────────────────────────────
let _cache          = null;   // { date, rows, summary, gainers, losers, active, delivery, sectors }
let _cacheDate      = null;   // 'YYYY-MM-DD' string for which the cache is valid
let _fetchInFlight  = null;   // Promise while fetching

// ── Month names NSE uses in URL ───────────────────────────────────────────────
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

// ── Lightweight sector map (top-500 NSE stocks) ───────────────────────────────
const SECTOR_MAP = {
  // Banking & Finance
  HDFCBANK:'Banking',ICICIBANK:'Banking',SBIN:'Banking',KOTAKBANK:'Banking',AXISBANK:'Banking',
  INDUSINDBK:'Banking',BANDHANBNK:'Banking',FEDERALBNK:'Banking',IDFCFIRSTB:'Banking',
  YESBANK:'Banking',PNB:'Banking',BANKBARODA:'Banking',CANBK:'Banking',UNIONBANK:'Banking',
  BAJFINANCE:'Finance',BAJAJFINSV:'Finance',HDFC:'Finance',MUTHOOTFIN:'Finance',
  CHOLAFIN:'Finance',MANAPPURAM:'Finance',LICIHSGFIN:'Finance',RECLTD:'Finance',
  POWERGRID:'Power',NTPC:'Power',ADANIGREEN:'Power',TATAPOWER:'Power',CESC:'Power',
  // IT & Tech
  TCS:'IT',INFY:'IT',WIPRO:'IT',HCLTECH:'IT',TECHM:'IT',LTI:'IT',LTIM:'IT',
  MPHASIS:'IT',PERSISTENT:'IT',COFORGE:'IT',OFSS:'IT',KPITTECH:'IT',
  // Pharma
  SUNPHARMA:'Pharma',DRREDDY:'Pharma',CIPLA:'Pharma',DIVISLAB:'Pharma',BIOCON:'Pharma',
  AUROPHARMA:'Pharma',ALKEM:'Pharma',TORNTPHARM:'Pharma',LUPIN:'Pharma',IPCALAB:'Pharma',
  // Oil & Gas
  RELIANCE:'Oil & Gas',ONGC:'Oil & Gas',IOC:'Oil & Gas',BPCL:'Oil & Gas',
  HINDPETRO:'Oil & Gas',GAIL:'Oil & Gas',OIL:'Oil & Gas',MGL:'Oil & Gas',
  // Auto
  TATAMOTORS:'Auto',MARUTI:'Auto',BAJAJ_AUTO:'Auto',HEROMOTOCO:'Auto',M_M:'Auto',
  EICHERMOT:'Auto',TVSMOTOR:'Auto',BALKRISIND:'Auto',MOTHERSON:'Auto',BHARATFORG:'Auto',
  // FMCG
  HINDUNILVR:'FMCG',ITC:'FMCG',NESTLEIND:'FMCG',BRITANNIA:'FMCG',DABUR:'FMCG',
  GODREJCP:'FMCG',MARICO:'FMCG',COLPAL:'FMCG',EMAMILTD:'FMCG',VBL:'FMCG',
  // Metals & Mining
  TATASTEEL:'Metals',HINDALCO:'Metals',JSWSTEEL:'Metals',SAIL:'Metals',VEDL:'Metals',
  COALINDIA:'Metals',NMDC:'Metals',NATIONALUM:'Metals',HINDZINC:'Metals',
  // Cement
  ULTRACEMCO:'Cement',SHREECEM:'Cement',AMBUJACEM:'Cement',ACC:'Cement',
  DALBHARAT:'Cement',RAMCOCEM:'Cement',HEIDELBERG:'Cement',
  // Infra & Construction
  LT:'Infrastructure',ADANIPORTS:'Infrastructure',IRB:'Infrastructure',NCC:'Infrastructure',
  KNR:'Infrastructure',ASHOKA:'Infrastructure',
  // Real Estate
  DLF:'Real Estate',GODREJPROP:'Real Estate',OBEROIRLTY:'Real Estate',PRESTIGE:'Real Estate',
  PHOENIXLTD:'Real Estate',SOBHA:'Real Estate',
  // Consumer Durables
  TITAN:'Consumer',VOLTAS:'Consumer',HAVELLS:'Consumer',WHIRLPOOL:'Consumer',
  BLUESTARCO:'Consumer',DIXON:'Consumer',AMBER:'Consumer',
  // Telecom
  BHARTIARTL:'Telecom',IDEA:'Telecom',TATACOMM:'Telecom',
  // Chemicals
  PIDILITIND:'Chemicals',SRF:'Chemicals',NAVINFLUOR:'Chemicals',AARTIIND:'Chemicals',
  DEEPAKNTR:'Chemicals',ALKYLAMINE:'Chemicals',
  // Retail
  TRENT:'Retail',DMART:'Retail',NYKAA:'Retail',ZOMATO:'Retail',
  // Insurance
  SBILIFE:'Insurance',HDFCLIFE:'Insurance',ICICIPRULI:'Insurance',STARHEALTH:'Insurance',
  // Paints
  ASIANPAINT:'Paints',BERGEPAINT:'Paints',KANSAINER:'Paints',
};

function sectorOf(symbol) {
  return SECTOR_MAP[symbol] || SECTOR_MAP[symbol.replace('-','_')] || 'Others';
}

// ── HTTP helper — NSE requires a cookie session; we do a 2-step GET ───────────
// Step 1: GET nseindia.com homepage to get cookies
// Step 2: Use those cookies on the archive URL
let _nseSessionCookies = '';
let _nseSessionTime    = 0;

async function refreshNseSession() {
  // Only refresh if older than 10 min
  if (_nseSessionCookies && (Date.now() - _nseSessionTime) < 10 * 60 * 1000) return;
  await new Promise((resolve) => {
    const req = https.get('https://www.nseindia.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
      },
      timeout: 10000,
    }, (res) => {
      // Consume body
      res.on('data', () => {});
      res.on('end', () => {
        const setCookie = res.headers['set-cookie'] || [];
        _nseSessionCookies = setCookie.map(c => c.split(';')[0]).join('; ');
        _nseSessionTime = Date.now();
        resolve();
      });
    });
    req.on('error', () => resolve());
    req.on('timeout', () => { req.destroy(); resolve(); });
  });
}

function fetchBytes(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const driver = url.startsWith('https') ? https : http;
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Encoding': 'identity',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.nseindia.com/',
        'Connection': 'keep-alive',
        'Cookie': _nseSessionCookies,
      },
      timeout: timeoutMs,
    };
    const req = driver.get(url, options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchBytes(res.headers.location, timeoutMs).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} from ${url}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error(`Timeout fetching ${url}`)); });
    req.on('error', reject);
  });
}

// ── Unzip a .zip buffer → first CSV file inside ───────────────────────────────
function unzipFirstFile(buf) {
  return new Promise((resolve, reject) => {
    // Simple ZIP parser — find local file header (PK\x03\x04) and deflate
    // For NSE zips, the file is always deflate-compressed (method 8) or stored (method 0)
    let offset = 0;
    while (offset < buf.length - 30) {
      const sig = buf.readUInt32LE(offset);
      if (sig !== 0x04034b50) { offset++; continue; }
      const method       = buf.readUInt16LE(offset + 8);
      const compSize     = buf.readUInt32LE(offset + 18);
      const nameLen      = buf.readUInt16LE(offset + 26);
      const extraLen     = buf.readUInt16LE(offset + 28);
      const dataStart    = offset + 30 + nameLen + extraLen;
      const compData     = buf.slice(dataStart, dataStart + compSize);
      if (method === 0) {
        return resolve(compData.toString('utf8'));
      } else if (method === 8) {
        zlib.inflateRaw(compData, (err, out) => {
          if (err) return reject(err);
          resolve(out.toString('utf8'));
        });
        return;
      }
      offset++;
    }
    reject(new Error('No deflatable file found in ZIP'));
  });
}

// ── Parse CSV text → array of objects ────────────────────────────────────────
function parseCsv(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < headers.length) continue;
    const row = {};
    headers.forEach((h, idx) => { row[h] = (cols[idx] || '').trim(); });
    rows.push(row);
  }
  return rows;
}

// ── Normalise a raw Bhavcopy CSV row → clean object ──────────────────────────
// Handles both old format (SYMBOL, OPEN, HIGH...) and new NSE format (Symbol, Open Price, High Price...)
function get(raw, ...keys) {
  for (const k of keys) { if (raw[k] != null && raw[k] !== '') return raw[k]; }
  return '';
}
function normaliseRow(raw) {
  const sym    = get(raw, 'SYMBOL','Symbol','symbol').trim().toUpperCase();
  const series = get(raw, 'SERIES','Series','series').trim().toUpperCase();
  // Only EQ and BE series for equity
  if (!['EQ','BE','SM','ST','N1','N2','N3','N4','N5','N6','N7','N8'].includes(series)) return null;

  // New NSE format (post-2024): OPEN_PRICE, HIGH_PRICE, LOW_PRICE, CLOSE_PRICE, PREV_CLOSE, LAST_PRICE
  // Old NSE format: OPEN, HIGH, LOW, CLOSE, PREVCLOSE, LAST
  const open      = parseFloat(get(raw,'OPEN_PRICE','OPEN','Open Price','Open'))      || 0;
  const high      = parseFloat(get(raw,'HIGH_PRICE','HIGH','High Price','High'))      || 0;
  const low       = parseFloat(get(raw,'LOW_PRICE','LOW','Low Price','Low'))          || 0;
  const close     = parseFloat(get(raw,'CLOSE_PRICE','CLOSE','Close Price','Close'))  || 0;
  const last      = parseFloat(get(raw,'LAST_PRICE','LAST','Last Price','Last'))      || close;
  const prevClose = parseFloat(get(raw,'PREV_CLOSE','PREVCLOSE','Prev Close','Previous Close')) || 0;
  // TTL_TRD_QNTY (new) or TOTTRDQTY (old)
  const qty       = parseFloat(get(raw,'TTL_TRD_QNTY','TOTTRDQTY','Total Traded Quantity')) || 0;
  // TURNOVER_LACS (new, in Lakhs) or TOTTRDVAL (old, in Rupees)
  const turnoverLacs = parseFloat(get(raw,'TURNOVER_LACS','TOTTRDVAL','Turnover')) || 0;
  // Normalise to Crores: new format is Lakhs → /100; old format is Rupees → /1e7
  const isNewFormat = raw['TURNOVER_LACS'] != null;
  const val         = isNewFormat ? turnoverLacs * 1e5 : turnoverLacs; // back to Rupees for internal use
  const turnoverCr  = isNewFormat ? +(turnoverLacs / 100).toFixed(2) : +(turnoverLacs / 1e7).toFixed(2);
  const trades    = parseFloat(get(raw,'NO_OF_TRADES','TOTALTRADES','No. of Trades')) || 0;
  const isin      = get(raw,'ISIN','isin').trim();
  const ts        = get(raw,'DATE1','TIMESTAMP','Date','timestamp').trim();
  // Delivery — embedded in new format
  const delivQty  = parseFloat(get(raw,'DELIV_QTY','delivQty')) || 0;
  const delivPct  = parseFloat(get(raw,'DELIV_PER','delivPct')) || 0;

  if (!sym || close <= 0) return null;

  const changePts = prevClose > 0 ? +(close - prevClose).toFixed(2) : 0;
  const changePct = prevClose > 0 ? +((close - prevClose) / prevClose * 100).toFixed(2) : 0;
  const sector = sectorOf(sym);

  return { sym, series, open, high, low, close, last, prevClose, changePts, changePct,
           qty, val, turnoverCr, trades, isin, ts, sector,
           delivQty: delivQty || undefined, delivPct: delivPct || undefined };
}

// ── Build computed views from normalised rows ─────────────────────────────────
function buildViews(rows) {
  // Sort helpers
  const byChgPct  = (a, b) => b.changePct - a.changePct;
  const byVal     = (a, b) => b.val - a.val;
  const byQty     = (a, b) => b.qty - a.qty;
  const byDelPct  = (a, b) => (b.delivPct || 0) - (a.delivPct || 0);

  const eq = rows.filter(r => r.series === 'EQ');

  const advances  = eq.filter(r => r.changePct > 0).length;
  const declines  = eq.filter(r => r.changePct < 0).length;
  const unchanged = eq.filter(r => r.changePct === 0).length;
  const totalTurnoverCr = +eq.reduce((s, r) => s + r.turnoverCr, 0).toFixed(2);

  // Top 20 gainers / losers (min turnover 1 Cr, price > 10)
  const eligible = eq.filter(r => r.turnoverCr >= 1 && r.close >= 10);
  const gainers  = [...eligible].sort(byChgPct).slice(0, 20);
  const losers   = [...eligible].sort((a,b) => a.changePct - b.changePct).slice(0, 20);
  const byValue  = [...eligible].sort(byVal).slice(0, 20);
  const byVolume = [...eligible].sort(byQty).slice(0, 20);

  // Sector aggregates
  const sectorMap = {};
  eq.forEach(r => {
    const s = r.sector;
    if (!sectorMap[s]) sectorMap[s] = { sector:s, count:0, advances:0, declines:0, turnoverCr:0, totalChangePct:0 };
    sectorMap[s].count++;
    sectorMap[s].turnoverCr   += r.turnoverCr;
    sectorMap[s].totalChangePct += r.changePct;
    if (r.changePct > 0) sectorMap[s].advances++;
    else if (r.changePct < 0) sectorMap[s].declines++;
  });
  const sectors = Object.values(sectorMap).map(s => ({
    ...s,
    turnoverCr: +s.turnoverCr.toFixed(2),
    avgChangePct: s.count > 0 ? +(s.totalChangePct / s.count).toFixed(2) : 0,
  })).sort((a, b) => b.turnoverCr - a.turnoverCr);

  return { advances, declines, unchanged, totalTurnoverCr, gainers, losers, byValue, byVolume, sectors };
}

// ── Try to fetch Bhavcopy for a given date ────────────────────────────────────
async function fetchForDate(d) {
  const dd   = String(d.getDate()).padStart(2, '0');
  const mon  = MONTHS[d.getMonth()];
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth()+1).padStart(2,'0');

  // Refresh NSE session cookies first
  await refreshNseSession();

  // NSE changed their Bhavcopy URL format in 2024.
  // New format: https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_DDMMYYYY.csv
  // Old format: https://nsearchives.nseindia.com/content/historical/EQUITIES/YYYY/MON/cmDDMONYYYYbhav.csv.zip
  const urls = [
    // NEW format (post-2024): direct CSV, no zip
    { url: `https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_${dd}${mm}${yyyy}.csv`, zip: false },
    // OLD format (pre-2024): zip
    { url: `https://nsearchives.nseindia.com/content/historical/EQUITIES/${yyyy}/${mon}/cm${dd}${mon}${yyyy}bhav.csv.zip`, zip: true },
    // NSE API reports endpoint
    { url: `https://www.nseindia.com/api/reports?archives=%5B%7B%22name%22%3A%22CM%20UDiFF%20Combined%20Report%20Daily%22%2C%22type%22%3A%22daily%22%2C%22category%22%3A%22capital-market%22%2C%22section%22%3A%22equities%22%7D%5D&date=${dd}-${mon}-${yyyy}&type=equities&ext=csv`, zip: false },
  ];

  for (const { url, zip } of urls) {
    try {
      const buf = await fetchBytes(url, 20000);
      let csvText;
      if (zip) {
        csvText = await unzipFirstFile(buf);
      } else {
        csvText = buf.toString('utf8');
      }
      // Accept if we got a real CSV (has header row with SYMBOL or Symbol)
      if (csvText && csvText.length > 200 &&
          (csvText.includes('SYMBOL') || csvText.includes('Symbol') ||
           csvText.includes('symbol') || csvText.includes(',SERIES,') || csvText.includes(',Series,'))) {
        return csvText;
      }
    } catch (_) { /* try next URL */ }
  }
  return null;
}

// ── Delivery data fetcher ─────────────────────────────────────────────────────
async function fetchDelivery(d) {
  const dd   = String(d.getDate()).padStart(2, '0');
  const mon  = MONTHS[d.getMonth()];
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth()+1).padStart(2,'0');

  // MTO (Margin Trade Obligation) / Delivery data
  const url = `https://nsearchives.nseindia.com/archives/deliveries/${yyyy}/${mon}/MTO_${dd}${mm}${yyyy}.DAT`;
  try {
    const buf = await fetchBytes(url, 12000);
    const text = buf.toString('utf8');
    // MTO format: Record Type(2), Sr No(5), Symbol(10), Series(2), Qty Traded, Deliverable Qty, % Deliv
    const delivMap = {};
    text.trim().split('\n').forEach(line => {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length < 7 || parts[0] !== '20') return;
      const sym = parts[2].trim().toUpperCase();
      const series = parts[3].trim().toUpperCase();
      const qtyTraded = parseFloat(parts[4]) || 0;
      const delivQty  = parseFloat(parts[5]) || 0;
      const delivPct  = parseFloat(parts[6]) || 0;
      if (series === 'EQ') delivMap[sym] = { delivQty, delivPct };
    });
    return delivMap;
  } catch (_) { return {}; }
}

// ── Main exported function ─────────────────────────────────────────────────────
/**
 * getBhavData()
 * Returns the latest available Bhavcopy data. Caches for the calendar day.
 * Returns { date, tradeDate, rows, summary, gainers, losers, byValue, byVolume, sectors, source, error }
 */
async function getBhavData() {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Return cached data if same day
  if (_cache && _cacheDate === todayStr) return _cache;

  // Deduplicate parallel calls
  if (_fetchInFlight) return _fetchInFlight;

  _fetchInFlight = (async () => {
    // Establish NSE session before any fetches
    await refreshNseSession();

    // Try last 5 trading days (skip weekends + holidays)
    let csvText = null;
    let tradeDate = null;

    for (let back = 0; back <= 6; back++) {
      const d = new Date(today);
      d.setDate(d.getDate() - back);
      // Skip Sunday(0) and Saturday(6)
      if (d.getDay() === 0 || d.getDay() === 6) continue;

      csvText = await fetchForDate(d);
      if (csvText && csvText.includes('SYMBOL')) {
        tradeDate = d.toISOString().split('T')[0];
        break;
      }
    }

    if (!csvText || !csvText.includes('SYMBOL')) {
      // Return structured error — never return dummy data
      const err = { success: false, error: 'Bhavcopy unavailable — NSE archives may be delayed. Try again after 18:30 IST.', rows: [], date: todayStr };
      _fetchInFlight = null;
      return err;
    }

    // Parse CSV
    const rawRows = parseCsv(csvText);

    // Fetch delivery data (best-effort)
    const delivMap = await fetchDelivery(new Date(tradeDate));

    // Normalise
    const rows = rawRows.map(normaliseRow).filter(Boolean).map(r => {
      const d = delivMap[r.sym];
      if (d) { r.delivQty = d.delivQty; r.delivPct = d.delivPct; }
      return r;
    });

    const views = buildViews(rows);

    const result = {
      success: true,
      date: todayStr,
      tradeDate,
      source: 'NSE Bhavcopy (nsearchives.nseindia.com)',
      totalSymbols: rows.length,
      ...views,
      rows,   // full dataset (use sparingly — large)
    };

    _cache = result;
    _cacheDate = todayStr;
    _fetchInFlight = null;
    return result;
  })();

  return _fetchInFlight;
}

/** Invalidate cache (called manually or on demand) */
function invalidateCache() { _cache = null; _cacheDate = null; }

module.exports = { getBhavData, invalidateCache };
