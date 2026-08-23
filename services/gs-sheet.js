/**
 * services/gs-sheet.js — Google Sheet data service
 * Fetches & indexes the published Google Sheet with 104 columns / 1113 companies.
 * Published URL: https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?output=csv&gid=465031541
 *
 * New metrics vs screener.csv:
 *  - Composite Score (100)      — multi-factor weighted rank (higher = better)
 *  - Leader (101)               — rank / leadership flag
 *  - ROE Score (67)             — normalised ROE quality score
 *  - Profit Growth Score (73)   — short+long profit growth quality
 *  - Sales Growth Score (74)    — short+long sales growth quality
 *  - Return Growth Score (75)   — short+long return quality
 *  - Expected Annual Profit Gr (76) — forward growth estimate
 *  - Market return comparison (77)  — vs benchmark
 *  - ROE jump short/long (78,79)    — ROE acceleration signals
 *  - Profit Jump short/long (80,81) — profit acceleration signals
 *  - Sales Jump short/long (82,83)  — sales acceleration signals
 *  - QoQ/YoY emoji signals (84–91) — 🟢/🔴 momentum signals
 *  - ROE-P/E (92)               — ROE minus P/E (higher = better value)
 *  - PE/ROE (93)                — valuation efficiency (lower = better)
 *  - PE to 3/5/7 yr PE (54,56,58)   — PE vs historical averages
 *  - ROE to 3/5/7 yr ROE (55,57,59) — ROE consistency
 *  - Op profit% (39)             — OPM 1Y growth
 *  - 4*Sales Q-Yr/Yr (68)        — annualised quarterly sales growth
 *  - 4*Op Profit Q-Yr/Yr (69)    — annualised quarterly OP growth
 *  - 4*PAT Q-Yr/Yr (70)          — annualised quarterly PAT growth
 */
'use strict';

const https = require('https');
const PUB_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSmbZPqqmI26zJOIdBVocP_mevHVxyitnOhVizuMZ2JjDS1F2t_0gXTQjag5HO5dTQNSVV1NNlNLYUY/pub?output=csv&single=true&gid=465031541';

// ── Column index map (0-based) ─────────────────────────────────────────────────
const COL = {
  name:           0,
  bseCode:        1,
  nseCode:        2,
  industry:       3,
  price:          4,
  lastResult:     5,
  marCap:         6,
  roe:            7,
  roe3:           8,
  roe5:           9,
  profitGr1:      10,
  profitGr3:      11,
  profitGr5:      12,
  salesGr1:       13,
  salesGr3:       14,
  salesGr5:       15,
  return3m:       16,
  return6m:       17,
  return1y:       18,
  return3y:       19,
  return5y:       20,
  upside52w:      21,
  grahamDiff:     22,
  piotroski:      23,
  ps:             24,
  pb:             25,
  peVsIndustry:   26,
  pe:             27,
  peg:            28,
  de:             29,
  divYield:       30,
  evEbitda:       31,
  promoter:       32,
  fii:            33,
  dii:            34,
  publicHolding:  35,
  debt:           36,
  sales:          37,
  opProfit:       38,
  opProfitGr:     39,
  opm:            40,
  pat:            41,
  npm:            42,
  salesQtr:       43,
  qoqSales:       44,
  yoySalesQtr:    45,
  opmQtr:         46,
  opProfitQtr:    47,
  npmQtr:         48,
  patQtr:         49,
  yoyProfitQtr:   50,
  qoqProfits:     51,
  cashOps:        52,
  netCashFlow:    53,
  peTo3PE:        54,
  roeTo3ROE:      55,
  peTo5PE:        56,
  roeTo5ROE:      57,
  peTo7PE:        58,
  roeTo7ROE:      59,
  debtPerSales:   60,
  opProfitPerSales:61,
  patPerSales:    62,
  salesQAnnu:     63,  // 4*SalesQ/Sales%
  opProfQAnnu:    64,  // 4*OpProfitQ/Sales%
  patQAnnu:       65,  // 4*PATQ/Sales%
  // blank 66
  roeScore:       67,
  salesQYoY:      68,  // 4*Sales Q-Yr/Yr
  opProfQYoY:     69,  // 4*Op Profit Q-Yr/Yr
  patQYoY:        70,  // 4*PAT Q-Yr/Yr
  opmQY:          71,  // OPM Q-Y (quarter-on-year OPM change)
  npmQY:          72,  // NPM Q-Y
  profitGrScore:  73,
  salesGrScore:   74,
  returnGrScore:  75,
  expectedGr:     76,
  mktReturnComp:  77,
  roeJumpShort:   78,
  roeJumpLong:    79,
  profitJumpShort:80,
  profitJumpLong: 81,
  salesJumpShort: 82,
  salesJumpLong:  83,
  qoqSalesNum:    84,
  qoqSalesEmoji:  85,
  yoySalesNum:    86,
  yoySalesEmoji:  87,
  yoyPatNum:      88,
  yoyPatEmoji:    89,
  qoqPatNum:      90,
  qoqPatEmoji:    91,
  roePe:          92,  // ROE - P/E
  peRoe:          93,  // PE/ROE
  peRank:         94,
  pbRank:         95,
  deRank:         96,
  psRank:         97,
  evRank:         98,
  pegRank:        99,
  compositeScore: 100,
  leader:         101,
};

// ── CSV parse ──────────────────────────────────────────────────────────────────
function parseCSVLine(line) {
  const vals = [];
  let cur = '', inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === ',' && !inQ) { vals.push(cur); cur = ''; }
    else cur += ch;
  }
  vals.push(cur);
  return vals;
}

function cleanNum(s) {
  if (!s || s === '' || s === '??' || s === '#REF!' || s === '#N/A') return null;
  // Remove L (lakh crore notation), %, commas
  const cleaned = s.toString().replace(/[L%,₹]/g, '').replace(/[🟢🔴]/g, '').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function cleanStr(s) {
  return (s || '').toString().trim().replace(/^"|"$/g, '');
}

function parseEmoji(s) {
  const v = cleanStr(s);
  if (v.includes('🟢')) return 'up';
  if (v.includes('🔴')) return 'down';
  return null;
}

function parseRow(vals) {
  const n = (i) => cleanNum(vals[i]);
  const s = (i) => cleanStr(vals[i]);
  return {
    name:           s(COL.name),
    bseCode:        s(COL.bseCode),
    nseCode:        s(COL.nseCode),
    industry:       s(COL.industry),
    price:          n(COL.price),
    lastResult:     s(COL.lastResult),
    marCap:         s(COL.marCap),
    roe:            n(COL.roe),
    roe3:           n(COL.roe3),
    roe5:           n(COL.roe5),
    profitGr1:      n(COL.profitGr1),
    profitGr3:      n(COL.profitGr3),
    profitGr5:      n(COL.profitGr5),
    salesGr1:       n(COL.salesGr1),
    salesGr3:       n(COL.salesGr3),
    salesGr5:       n(COL.salesGr5),
    return3m:       n(COL.return3m),
    return6m:       n(COL.return6m),
    return1y:       n(COL.return1y),
    return3y:       n(COL.return3y),
    return5y:       n(COL.return5y),
    upside52w:      n(COL.upside52w),
    grahamDiff:     n(COL.grahamDiff),
    piotroski:      n(COL.piotroski),
    ps:             n(COL.ps),
    pb:             n(COL.pb),
    peVsIndustry:   n(COL.peVsIndustry),
    pe:             n(COL.pe),
    peg:            n(COL.peg),
    de:             n(COL.de),
    divYield:       n(COL.divYield),
    evEbitda:       n(COL.evEbitda),
    promoter:       n(COL.promoter),
    fii:            n(COL.fii),
    dii:            n(COL.dii),
    publicHolding:  n(COL.publicHolding),
    debt:           s(COL.debt),
    sales:          s(COL.sales),
    opProfit:       s(COL.opProfit),
    opProfitGr:     n(COL.opProfitGr),
    opm:            n(COL.opm),
    pat:            s(COL.pat),
    npm:            n(COL.npm),
    salesQtr:       s(COL.salesQtr),
    qoqSales:       n(COL.qoqSales),
    yoySalesQtr:    n(COL.yoySalesQtr),
    opmQtr:         n(COL.opmQtr),
    opProfitQtr:    s(COL.opProfitQtr),
    npmQtr:         n(COL.npmQtr),
    patQtr:         s(COL.patQtr),
    yoyProfitQtr:   n(COL.yoyProfitQtr),
    qoqProfits:     n(COL.qoqProfits),
    cashOps:        s(COL.cashOps),
    netCashFlow:    s(COL.netCashFlow),
    peTo3PE:        n(COL.peTo3PE),
    roeTo3ROE:      n(COL.roeTo3ROE),
    peTo5PE:        n(COL.peTo5PE),
    roeTo5ROE:      n(COL.roeTo5ROE),
    peTo7PE:        n(COL.peTo7PE),
    roeTo7ROE:      n(COL.roeTo7ROE),
    debtPerSales:   s(COL.debtPerSales),
    opProfitPerSales: s(COL.opProfitPerSales),
    patPerSales:    s(COL.patPerSales),
    salesQAnnu:     s(COL.salesQAnnu),
    opProfQAnnu:    s(COL.opProfQAnnu),
    patQAnnu:       s(COL.patQAnnu),
    roeScore:       n(COL.roeScore),
    salesQYoY:      s(COL.salesQYoY),
    opProfQYoY:     s(COL.opProfQYoY),
    patQYoY:        s(COL.patQYoY),
    opmQY:          n(COL.opmQY),
    npmQY:          n(COL.npmQY),
    profitGrScore:  n(COL.profitGrScore),
    salesGrScore:   n(COL.salesGrScore),
    returnGrScore:  n(COL.returnGrScore),
    expectedGr:     s(COL.expectedGr),
    mktReturnComp:  n(COL.mktReturnComp),
    roeJumpShort:   s(COL.roeJumpShort),
    roeJumpLong:    s(COL.roeJumpLong),
    profitJumpShort:s(COL.profitJumpShort),
    profitJumpLong: s(COL.profitJumpLong),
    salesJumpShort: s(COL.salesJumpShort),
    salesJumpLong:  s(COL.salesJumpLong),
    // Emoji signals
    qoqSalesSignal:  parseEmoji(vals[COL.qoqSalesEmoji]),
    yoySalesSignal:  parseEmoji(vals[COL.yoySalesEmoji]),
    yoyPatSignal:    parseEmoji(vals[COL.yoyPatEmoji]),
    qoqPatSignal:    parseEmoji(vals[COL.qoqPatEmoji]),
    // Rank scores
    roePe:          n(COL.roePe),
    peRoe:          n(COL.peRoe),
    peRank:         n(COL.peRank),
    pbRank:         n(COL.pbRank),
    deRank:         n(COL.deRank),
    psRank:         n(COL.psRank),
    evRank:         n(COL.evRank),
    pegRank:        n(COL.pegRank),
    compositeScore: n(COL.compositeScore),
    leader:         s(COL.leader),
  };
}

// ── In-memory cache ────────────────────────────────────────────────────────────
let _cache = null;
let _cacheTime = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30 min

function fetchCSV(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 20000 }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function loadSheet() {
  if (_cache && (Date.now() - _cacheTime) < CACHE_TTL) return _cache;

  // Try live fetch first
  try {
    const csv = await fetchCSV(PUB_CSV_URL);
    const lines = csv.split('\n').filter(l => l.trim());
    if (lines.length < 2) throw new Error('empty');
    const rows = lines.slice(1).map(l => parseRow(parseCSVLine(l))).filter(r => r.name && r.nseCode);
    _cache = rows;
    _cacheTime = Date.now();
    console.log(`[gs-sheet] Loaded ${rows.length} companies from Google Sheet`);
    return rows;
  } catch (e) {
    console.warn('[gs-sheet] Live fetch failed, trying local file:', e.message);
  }

  // Fallback: local cached CSV
  try {
    const fs = require('fs'), path = require('path');
    const localPath = path.join(__dirname, '..', 'data', 'google-sheet-main.csv');
    const csv = fs.readFileSync(localPath, 'utf8');
    const lines = csv.split('\n').filter(l => l.trim());
    const rows = lines.slice(1).map(l => parseRow(parseCSVLine(l))).filter(r => r.name && r.nseCode);
    _cache = rows;
    _cacheTime = Date.now();
    console.log(`[gs-sheet] Loaded ${rows.length} companies from local cache`);
    return rows;
  } catch (e2) {
    throw new Error('gs-sheet: both live and local load failed: ' + e2.message);
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/** All companies — sorted by compositeScore desc by default */
async function getAllGS() {
  const rows = await loadSheet();
  return [...rows].sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0));
}

/** Search by name or NSE code */
async function searchGS(q) {
  const rows = await loadSheet();
  const ql = q.toLowerCase();
  return rows.filter(r =>
    r.nseCode?.toLowerCase().includes(ql) ||
    r.name?.toLowerCase().includes(ql)
  ).slice(0, 20);
}

/** Get single company by NSE code */
async function getCompanyGS(nseCode) {
  const rows = await loadSheet();
  const uc = nseCode.toUpperCase();
  return rows.find(r => r.nseCode?.toUpperCase() === uc) || null;
}

/** Top N by composite score, optional industry filter */
async function topByComposite(n = 50, industry = '') {
  const rows = await loadSheet();
  let filtered = rows.filter(r => r.compositeScore != null);
  if (industry) filtered = filtered.filter(r => r.industry?.toLowerCase().includes(industry.toLowerCase()));
  return filtered.sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0)).slice(0, n);
}

/** Top N by any numeric field */
async function topByField(field, n = 50, ascending = false, industry = '') {
  const rows = await loadSheet();
  let filtered = rows.filter(r => r[field] != null && !isNaN(r[field]));
  if (industry) filtered = filtered.filter(r => r.industry?.toLowerCase().includes(industry.toLowerCase()));
  filtered.sort((a, b) => ascending ? (a[field] - b[field]) : (b[field] - a[field]));
  return filtered.slice(0, n);
}

/** Jump signals — companies with strong short+long acceleration in profit/sales/ROE */
async function jumpSignals(type = 'profit', n = 30) {
  const rows = await loadSheet();
  const shortKey = type === 'profit' ? 'profitJumpShort' : type === 'sales' ? 'salesJumpShort' : 'roeJumpShort';
  const longKey  = type === 'profit' ? 'profitJumpLong'  : type === 'sales' ? 'salesJumpLong'  : 'roeJumpLong';
  // Parse jump values (strip %)
  const parsed = rows.map(r => ({
    ...r,
    _shortVal: cleanNum(r[shortKey]),
    _longVal:  cleanNum(r[longKey]),
  })).filter(r => r._shortVal != null && r._longVal != null);

  // Both short & long positive = acceleration
  const accelerating = parsed.filter(r => r._shortVal > 0 && r._longVal > 0)
    .sort((a, b) => (b._shortVal + b._longVal) - (a._shortVal + a._longVal))
    .slice(0, n);

  return accelerating.map(r => ({ ...r, shortVal: r._shortVal, longVal: r._longVal }));
}

/** Momentum signals — all 4 QoQ/YoY signals green */
async function allGreenSignals(n = 30) {
  const rows = await loadSheet();
  return rows
    .filter(r => r.qoqSalesSignal === 'up' && r.yoySalesSignal === 'up' && r.yoyPatSignal === 'up' && r.qoqPatSignal === 'up')
    .sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0))
    .slice(0, n);
}

/** Industry leaderboard by composite score */
async function industryLeaders() {
  const rows = await loadSheet();
  const byIndustry = {};
  for (const r of rows) {
    if (!r.industry || !r.compositeScore) continue;
    if (!byIndustry[r.industry] || r.compositeScore > byIndustry[r.industry].compositeScore) {
      byIndustry[r.industry] = r;
    }
  }
  return Object.values(byIndustry).sort((a, b) => b.compositeScore - a.compositeScore);
}

/** ROE consistency — ROE higher than 3/5/7 year averages */
async function roeConsistency(n = 50) {
  const rows = await loadSheet();
  return rows
    .filter(r => r.roeTo3ROE != null && r.roeTo5ROE != null && r.roe != null)
    .filter(r => r.roeTo3ROE > 95 && r.roeTo5ROE > 90)  // current ROE ≥ historical averages
    .sort((a, b) => (b.roeScore ?? 0) - (a.roeScore ?? 0))
    .slice(0, n);
}

/** Multi-score screener: filter + sort by any field */
async function advancedScreener(filters = {}, sortField = 'compositeScore', n = 100) {
  const rows = await loadSheet();
  const toNum = (v) => v != null && !isNaN(v) ? parseFloat(v) : null;

  let results = rows.filter(r => {
    if (filters.industry && !r.industry?.toLowerCase().includes(filters.industry.toLowerCase())) return false;
    if (filters.minComposite != null  && (r.compositeScore ?? 0) < filters.minComposite) return false;
    if (filters.minROE != null        && (r.roe ?? 0) < filters.minROE) return false;
    if (filters.maxPE != null         && r.pe != null && r.pe > filters.maxPE) return false;
    if (filters.minProfitGr != null   && (r.profitGr1 ?? -999) < filters.minProfitGr) return false;
    if (filters.minSalesGr != null    && (r.salesGr1 ?? -999) < filters.minSalesGr) return false;
    if (filters.maxDE != null         && r.de != null && r.de > filters.maxDE) return false;
    if (filters.minOPM != null        && (r.opm ?? 0) < filters.minOPM) return false;
    if (filters.minPiotroski != null  && (r.piotroski ?? 0) < filters.minPiotroski) return false;
    if (filters.minPromoter != null   && (r.promoter ?? 0) < filters.minPromoter) return false;
    if (filters.minReturn1y != null   && (r.return1y ?? -999) < filters.minReturn1y) return false;
    if (filters.minGrowthScore != null&& (r.profitGrScore ?? 0) < filters.minGrowthScore) return false;
    if (filters.minSalesScore != null && (r.salesGrScore ?? 0) < filters.minSalesScore) return false;
    if (filters.minRoeScore != null   && (r.roeScore ?? 0) < filters.minRoeScore) return false;
    if (filters.allGreen === true &&
        !(r.qoqSalesSignal === 'up' && r.yoySalesSignal === 'up' &&
          r.yoyPatSignal === 'up' && r.qoqPatSignal === 'up')) return false;
    return true;
  });

  results.sort((a, b) => {
    const av = a[sortField] ?? -Infinity;
    const bv = b[sortField] ?? -Infinity;
    return bv - av;
  });

  return results.slice(0, n);
}

/** Get all unique industries */
async function getIndustries() {
  const rows = await loadSheet();
  return [...new Set(rows.map(r => r.industry).filter(Boolean))].sort();
}

/** Force refresh from Google Sheets */
async function refresh() {
  _cache = null;
  _cacheTime = 0;
  return loadSheet();
}

module.exports = {
  getAllGS, searchGS, getCompanyGS, topByComposite, topByField,
  jumpSignals, allGreenSignals, industryLeaders, roeConsistency,
  advancedScreener, getIndustries, refresh, loadSheet,
};
