/**
 * services/fundamentals-csv.js — tradingview-economy
 *
 * Parses the Screener.in export (data/screener.csv) and exposes rich analysis.
 * All 60 columns are mapped; no field is silently dropped.
 *
 * CSV columns (all 60):
 *  0  Name                           30 Dividend yield
 *  1  BSE Code                       31 EVEBITDA
 *  2  NSE Code                       32 Promoter holding
 *  3  Industry                       33 FII holding
 *  4  Current Price                  34 DII holding
 *  5  Last result date               35 Public holding
 *  6  Market Capitalization          36 Debt
 *  7  Return on equity               37 Sales
 *  8  Average return on equity 3Years 38 Operating profit
 *  9  Average return on equity 5Years 39 Operating profit growth
 * 10  Profit growth                  40 OPM
 * 11  Profit growth 3Years           41 Profit after tax
 * 12  Profit growth 5Years           42 NPM last year
 * 13  Sales growth                   43 Sales latest quarter
 * 14  Sales growth 3Years            44 QoQ Sales
 * 15  Sales growth 5Years            45 YOY Quarterly sales growth
 * 16  Return over 3months            46 OPM latest quarter
 * 17  Return over 6months            47 Operating profit latest quarter
 * 18  Return over 1year              48 NPM latest quarter
 * 19  Return over 3years             49 Profit after tax latest quarter
 * 20  Return over 5years             50 YOY Quarterly profit growth
 * 21  Possible growth if touches 52 week high  51 QoQ Profits
 * 22  wrt Graham Price               52 Cash from operations last year
 * 23  Piotroski score                53 Net cash flow last year
 * 24  Price to Sales                 54 PE to 3PE
 * 25  Price to book value            55 ROE TO 3ROE
 * 26  PE wrt Industry                56 PE TO 5 PE
 * 27  Price to Earning               57 RO3 TO 5 ROE
 * 28  PEG Ratio                      58 PE TO 7 PE
 * 29  Debt to equity                 59 ROE TO 7 ROE
 */
'use strict';

const fs   = require('fs');
const path = require('path');

// ── Resolve correct CSV path (supports both filenames for backward compat) ─────
const POSSIBLE_PATHS = [
  path.join(__dirname, '..', 'data', 'screener.csv'),
  path.join(__dirname, '..', 'data', 'Raw data', 'screener.csv'),
  path.join(__dirname, '..', 'data', 'screener 16 Aug.csv'),
];
const CSV_PATH = POSSIBLE_PATHS.find(p => fs.existsSync(p)) || POSSIBLE_PATHS[0];

// ── CSV parser (handles quoted fields) ────────────────────────────────────────
function parseCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { result.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  result.push(cur.trim());
  return result;
}

function parseNumber(v) {
  if (v == null || v === '' || v === '-') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function parseDate(v) {
  if (!v || v.trim() === '') return null;
  const s = v.trim();
  // Format: YYYYMM (e.g. 202606 = June 2026)
  if (/^\d{6}$/.test(s)) {
    const yr = s.slice(0, 4);
    const mo = s.slice(4, 6);
    return `${yr}-${mo}`;
  }
  return s;
}

// ── Load & parse CSV (5-min in-memory cache) ──────────────────────────────────
let _cache    = null;
let _cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

function loadCSV() {
  if (_cache && (Date.now() - _cacheTime) < CACHE_TTL) return _cache;
  if (!fs.existsSync(CSV_PATH)) {
    console.warn('[fundamentals-csv] CSV not found at', CSV_PATH);
    return [];
  }
  const raw     = fs.readFileSync(CSV_PATH, 'utf8');
  const lines   = raw.split('\n').filter(l => l.trim());
  const headers = parseCSVLine(lines[0]);

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    if (vals.length < 5) continue;
    const row = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });
    rows.push(row);
  }

  _cache     = rows;
  _cacheTime = Date.now();
  return rows;
}

// ── Normalise: map ALL 60 CSV columns to a clean object ──────────────────────
function normaliseRow(r) {
  const n = (k) => parseNumber(r[k]);
  return {
    // Identity
    name:               r['Name']                          || '',
    bseCode:            r['BSE Code']                      || '',
    nseCode:            r['NSE Code']                      || '',
    industry:           r['Industry']                      || '',
    currentPrice:       n('Current Price'),
    lastResultDate:     parseDate(r['Last result date']),
    marketCap:          n('Market Capitalization'),        // ₹ Cr

    // ── Profitability ─────────────────────────────────────────────────────────
    roe:                n('Return on equity'),             // %
    roe3yr:             n('Average return on equity 3Years'),
    roe5yr:             n('Average return on equity 5Years'),

    // ── Growth ───────────────────────────────────────────────────────────────
    profitGrowth:       n('Profit growth'),               // TTM YoY %
    profitGrowth3yr:    n('Profit growth 3Years'),
    profitGrowth5yr:    n('Profit growth 5Years'),
    salesGrowth:        n('Sales growth'),                // TTM YoY %
    salesGrowth3yr:     n('Sales growth 3Years'),
    salesGrowth5yr:     n('Sales growth 5Years'),

    // ── Price returns ─────────────────────────────────────────────────────────
    return3m:           n('Return over 3months'),
    return6m:           n('Return over 6months'),
    return1yr:          n('Return over 1year'),
    return3yr:          n('Return over 3years'),
    return5yr:          n('Return over 5years'),

    // ── Technical levels ─────────────────────────────────────────────────────
    upside52wHigh:      n('Possible growth if touches 52 week high'), // % upside to 52w high
    grahamDiff:         n('wrt Graham Price'),            // % above/below Graham intrinsic value

    // ── Quality scores ────────────────────────────────────────────────────────
    piotroskiScore:     n('Piotroski score'),             // 0-9

    // ── Valuation ────────────────────────────────────────────────────────────
    priceToSales:       n('Price to Sales'),
    pb:                 n('Price to book value'),
    peToIndustry:       n('PE wrt Industry'),             // peer-relative PE
    pe:                 n('Price to Earning'),
    pegRatio:           n('PEG Ratio'),
    debtToEquity:       n('Debt to equity'),
    dividendYield:      n('Dividend yield'),              // %
    evEbitda:           n('EVEBITDA'),

    // ── Shareholding pattern ─────────────────────────────────────────────────
    promoterHolding:    n('Promoter holding'),            // %
    fiiHolding:         n('FII holding'),
    diiHolding:         n('DII holding'),
    publicHolding:      n('Public holding'),

    // ── Annual P&L / balance sheet ────────────────────────────────────────────
    debt:               n('Debt'),                        // ₹ Cr
    sales:              n('Sales'),                       // ₹ Cr TTM
    operatingProfit:    n('Operating profit'),            // ₹ Cr
    opGrowth:           n('Operating profit growth'),     // %  ← was missing before
    opm:                n('OPM'),                         // % operating profit margin
    pat:                n('Profit after tax'),            // ₹ Cr
    npm:                n('NPM last year'),               // % net profit margin
    cashFromOps:        n('Cash from operations last year'), // ₹ Cr
    netCashFlow:        n('Net cash flow last year'),     // ₹ Cr

    // ── Latest quarter ────────────────────────────────────────────────────────
    salesQ:             n('Sales latest quarter'),        // ₹ Cr
    qoqSales:           n('QoQ Sales'),                   // % QoQ change
    yoyQSalesGrowth:    n('YOY Quarterly sales growth'),  // % YoY change
    opmQ:               n('OPM latest quarter'),          // % operating margin latest Q
    opProfitQ:          n('Operating profit latest quarter'), // ₹ Cr
    npmQ:               n('NPM latest quarter'),
    patQ:               n('Profit after tax latest quarter'), // ₹ Cr
    yoyQProfitGrowth:   n('YOY Quarterly profit growth'), // % YoY
    qoqProfits:         n('QoQ Profits'),                 // % QoQ

    // ── Relative valuation ratios ─────────────────────────────────────────────
    // These compare current PE/ROE to historical 3/5/7-year averages (expressed as %)
    // >100 = expensive vs history; <100 = cheap
    peTo3PE:            n('PE to 3PE'),
    roeTo3ROE:          n('ROE TO 3ROE'),
    peTo5PE:            n('PE TO 5 PE'),
    roeTo5ROE:          n('RO3 TO 5 ROE'),
    peTo7PE:            n('PE TO 7 PE'),
    roeTo7ROE:          n('ROE TO 7 ROE'),
  };
}

// ── Analyst grade — uses all material metrics ─────────────────────────────────
function gradeCompany(c) {
  let score = 0;
  const reasons  = [];
  const warnings = [];

  // ── Profitability (max 5 pts) ─────────────────────────────────────────────
  if (c.roe    !== null && c.roe    > 15)  { score += 2; reasons.push(`ROE ${c.roe.toFixed(1)}% strong`); }
  if (c.roe3yr !== null && c.roe3yr > 15)  { score += 1; reasons.push('Consistent 3-yr ROE > 15%'); }
  if (c.roe5yr !== null && c.roe5yr > 12)  { score += 1; reasons.push(`5-yr avg ROE ${c.roe5yr.toFixed(1)}%`); }
  if (c.npm    !== null && c.npm    > 10)  { score += 1; reasons.push(`Net margin ${c.npm.toFixed(1)}%`); }
  if (c.npm    !== null && c.npm    < 2)   warnings.push(`Thin net margin ${c.npm?.toFixed(1)}%`);

  // ── Growth (max 5 pts) ────────────────────────────────────────────────────
  if (c.profitGrowth  !== null && c.profitGrowth  > 15) { score += 2; reasons.push(`Profit growth ${c.profitGrowth.toFixed(1)}%`); }
  if (c.salesGrowth   !== null && c.salesGrowth   > 10) { score += 1; reasons.push(`Revenue growth ${c.salesGrowth.toFixed(1)}%`); }
  if (c.opGrowth      !== null && c.opGrowth      > 10) { score += 1; reasons.push(`Op profit growth ${c.opGrowth.toFixed(1)}%`); }
  if (c.salesGrowth3yr!== null && c.salesGrowth3yr > 10){ score += 1; reasons.push(`3-yr sales CAGR ${c.salesGrowth3yr.toFixed(1)}%`); }

  // ── Quality / Piotroski (max 3 pts) ──────────────────────────────────────
  if (c.piotroskiScore !== null && c.piotroskiScore >= 7) { score += 2; reasons.push(`Piotroski ${c.piotroskiScore}/9`); }
  else if (c.piotroskiScore !== null && c.piotroskiScore >= 5) { score += 1; }
  if (c.cashFromOps   !== null && c.cashFromOps > 0)    { score += 1; reasons.push('Positive operating cash flow'); }
  if (c.cashFromOps   !== null && c.cashFromOps < 0)    warnings.push('Negative operating cash flow');

  // ── Margins (max 2 pts) ───────────────────────────────────────────────────
  if (c.opm  !== null && c.opm  > 20) { score += 2; reasons.push(`OPM ${c.opm.toFixed(1)}% premium`); }
  else if (c.opm !== null && c.opm > 10) { score += 1; reasons.push(`OPM ${c.opm.toFixed(1)}%`); }
  if (c.opm  !== null && c.opmQ !== null && c.opmQ > c.opm) reasons.push(`Margin expanding (+${(c.opmQ - c.opm).toFixed(1)}pp)`);

  // ── Balance sheet (max 2 pts) ─────────────────────────────────────────────
  if (c.debtToEquity !== null && c.debtToEquity < 0.3)  { score += 2; reasons.push('Debt-free / near debt-free'); }
  else if (c.debtToEquity !== null && c.debtToEquity < 0.7) { score += 1; reasons.push(`D/E ${c.debtToEquity.toFixed(2)} manageable`); }
  else if (c.debtToEquity !== null && c.debtToEquity > 1.5) warnings.push(`High D/E ${c.debtToEquity.toFixed(2)}`);

  // ── Valuation (max 2 pts) ─────────────────────────────────────────────────
  if (c.pe !== null && c.peToIndustry !== null && c.pe < c.peToIndustry)
    { score += 1; reasons.push('PE below industry average'); }
  if (c.pegRatio !== null && c.pegRatio < 1)
    { score += 1; reasons.push(`PEG ${c.pegRatio.toFixed(2)} attractive`); }
  if (c.grahamDiff !== null && c.grahamDiff < -10)
    warnings.push(`${Math.abs(c.grahamDiff).toFixed(0)}% above Graham value`);
  if (c.grahamDiff !== null && c.grahamDiff > 10)
    reasons.push(`${c.grahamDiff.toFixed(0)}% upside to Graham value`);
  if (c.evEbitda !== null && c.evEbitda > 0 && c.evEbitda < 15)
    { score += 1; reasons.push(`EV/EBITDA ${c.evEbitda.toFixed(1)} reasonable`); }

  // ── Shareholding (max 1 pt) ───────────────────────────────────────────────
  if (c.promoterHolding !== null && c.promoterHolding > 50)
    { score += 1; reasons.push(`Promoter ${c.promoterHolding.toFixed(0)}% aligned`); }
  if (c.fiiHolding !== null && c.fiiHolding > 10)
    reasons.push(`FII ${c.fiiHolding.toFixed(1)}% institutional interest`);

  // ── Latest quarter signal ─────────────────────────────────────────────────
  let earningsSurprise = null;
  if (c.yoyQProfitGrowth !== null) {
    earningsSurprise = c.yoyQProfitGrowth > 10 ? 'beat' : c.yoyQProfitGrowth < -5 ? 'miss' : 'in-line';
  }
  if (c.yoyQProfitGrowth !== null && c.yoyQProfitGrowth > 20)
    reasons.push(`Q profit up ${c.yoyQProfitGrowth.toFixed(1)}% YoY`);

  // ── Relative valuation flags ──────────────────────────────────────────────
  if (c.peTo5PE !== null && c.peTo5PE < 90) reasons.push(`PE cheaper than 5-yr avg (${c.peTo5PE.toFixed(0)}%)`);
  if (c.peTo5PE !== null && c.peTo5PE > 130) warnings.push(`PE 30%+ above 5-yr avg`);

  const grade  = score >= 16 ? 'A+' : score >= 12 ? 'A' : score >= 9 ? 'B+' : score >= 6 ? 'B' : score >= 3 ? 'C' : 'D';
  const rating = score >= 12 ? 'BUY' : score >= 7 ? 'HOLD' : 'SELL';

  return { score, maxScore: 21, grade, rating, reasons, warnings, earningsSurprise };
}

// ── Revenue & margin trend ────────────────────────────────────────────────────
function revenueTrend(c) {
  return [
    c.salesGrowth5yr  !== null ? { label: '5-yr CAGR',      value: c.salesGrowth5yr  } : null,
    c.salesGrowth3yr  !== null ? { label: '3-yr CAGR',      value: c.salesGrowth3yr  } : null,
    c.salesGrowth     !== null ? { label: 'TTM',            value: c.salesGrowth     } : null,
    c.yoyQSalesGrowth !== null ? { label: 'Latest Q YoY',   value: c.yoyQSalesGrowth } : null,
    c.qoqSales        !== null ? { label: 'Latest Q QoQ',   value: c.qoqSales        } : null,
  ].filter(Boolean);
}

function profitTrend(c) {
  return [
    c.profitGrowth5yr  !== null ? { label: '5-yr CAGR',    value: c.profitGrowth5yr  } : null,
    c.profitGrowth3yr  !== null ? { label: '3-yr CAGR',    value: c.profitGrowth3yr  } : null,
    c.profitGrowth     !== null ? { label: 'TTM',          value: c.profitGrowth     } : null,
    c.yoyQProfitGrowth !== null ? { label: 'Latest Q YoY', value: c.yoyQProfitGrowth } : null,
    c.qoqProfits       !== null ? { label: 'Latest Q QoQ', value: c.qoqProfits       } : null,
  ].filter(Boolean);
}

function marginTrend(c) {
  const expansion = (c.opm !== null && c.opmQ !== null)
    ? parseFloat((c.opmQ - c.opm).toFixed(2)) : null;
  return {
    annualOPM:   c.opm,
    latestQOPM:  c.opmQ,
    annualNPM:   c.npm,
    latestQNPM:  c.npmQ,
    expansion,
    direction: expansion !== null
      ? (expansion > 0 ? 'expanding' : expansion < 0 ? 'compressing' : 'stable')
      : 'unknown'
  };
}

// ── AI summary prompt — all key metrics ──────────────────────────────────────
async function aiSummary(c, grade) {
  const { askAI } = require('./watsonx');
  const prompt = [
    `Summarize the financial health of ${c.name} (${c.nseCode}, ${c.industry}) in 2 sentences for a veteran investor.`,
    `Annual: ROE=${c.roe}% (3yr=${c.roe3yr}%), Profit growth=${c.profitGrowth}% (3yr=${c.profitGrowth3yr}%),`,
    `  Sales growth=${c.salesGrowth}% (3yr=${c.salesGrowth3yr}%), OPM=${c.opm}% (latest Q OPM=${c.opmQ}%),`,
    `  PE=${c.pe}, PEG=${c.pegRatio}, P/B=${c.pb}, EV/EBITDA=${c.evEbitda},`,
    `  D/E=${c.debtToEquity}, Cash from ops=₹${c.cashFromOps}Cr, Piotroski=${c.piotroskiScore}/9,`,
    `  Promoter=${c.promoterHolding}%, FII=${c.fiiHolding}%, Graham diff=${c.grahamDiff}%,`,
    `Latest Q: Sales=${c.salesQ ? '₹'+c.salesQ+'Cr' : '?'} (YoY=${c.yoyQSalesGrowth}%, QoQ=${c.qoqSales}%),`,
    `  PAT Q=₹${c.patQ}Cr (YoY=${c.yoyQProfitGrowth}%, QoQ=${c.qoqProfits}%).`,
    `Grade: ${grade.grade}, Rating: ${grade.rating}. Key: ${grade.reasons.slice(0,3).join('; ')}.`
  ].join(' ');
  const result = await askAI(prompt, { maxTokens: 150, temperature: 0.2, fallbackKey: 'financial' });
  return result.text || `${c.name} shows ${grade.rating} characteristics. ${grade.reasons.slice(0,2).join('. ')}.`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Return all companies normalised */
function getAllCompanies() {
  return loadCSV().map(normaliseRow);
}

/** Search by NSE/BSE code or name */
function searchCompany(query) {
  const q = query.toLowerCase();
  return getAllCompanies().filter(c =>
    c.nseCode.toLowerCase().includes(q) ||
    c.bseCode.toLowerCase().includes(q) ||
    c.name.toLowerCase().includes(q)
  );
}

/** Full company analysis with AI summary */
async function analyseCompany(query, withAI = true) {
  const matches = searchCompany(query);
  if (!matches.length) return null;
  const c      = matches[0];
  const grade  = gradeCompany(c);
  const rev    = revenueTrend(c);
  const profit = profitTrend(c);
  const margin = marginTrend(c);
  const summary = withAI
    ? await aiSummary(c, grade)
    : `${c.name} — ${grade.rating} (score ${grade.score}/${grade.maxScore})`;
  return { company: c, grade, revenueTrend: rev, profitTrend: profit, marginTrend: margin, aiSummary: summary };
}

/** Top N companies by any metric key */
function topByMetric(metric, n = 20, minMarketCap = 500) {
  return getAllCompanies()
    .filter(c => c[metric] !== null && (c.marketCap || 0) >= minMarketCap)
    .sort((a, b) => (b[metric] || 0) - (a[metric] || 0))
    .slice(0, n);
}

/** Earnings surprise report */
function earningsSurpriseReport() {
  return getAllCompanies()
    .filter(c => c.yoyQProfitGrowth !== null && c.nseCode && c.name)
    .map(c => {
      const g = gradeCompany(c);
      return {
        name: c.name, nseCode: c.nseCode, industry: c.industry,
        yoyQProfitGrowth: c.yoyQProfitGrowth,
        qoqProfits:       c.qoqProfits,
        yoyQSalesGrowth:  c.yoyQSalesGrowth,
        salesQ:           c.salesQ,
        patQ:             c.patQ,
        opmQ:             c.opmQ,
        surprise:         g.earningsSurprise,
        currentPrice:     c.currentPrice,
        marketCap:        c.marketCap,
        lastResultDate:   c.lastResultDate,
      };
    })
    .sort((a, b) => Math.abs(b.yoyQProfitGrowth) - Math.abs(a.yoyQProfitGrowth));
}

/** Industry-level aggregated comparison */
function industryComparison(industry) {
  const companies = getAllCompanies().filter(c =>
    c.industry.toLowerCase().includes(industry.toLowerCase())
  );
  if (!companies.length) return null;

  const avg = key => {
    const vals = companies.map(c => c[key]).filter(v => v !== null);
    return vals.length ? parseFloat((vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2)) : null;
  };

  return {
    industry,
    count: companies.length,
    avgPE: avg('pe'), avgPB: avg('pb'), avgROE: avg('roe'), avgROE3yr: avg('roe3yr'),
    avgProfitGrowth: avg('profitGrowth'), avgProfitGrowth3yr: avg('profitGrowth3yr'),
    avgSalesGrowth:  avg('salesGrowth'),  avgSalesGrowth3yr:  avg('salesGrowth3yr'),
    avgOPM: avg('opm'), avgNPM: avg('npm'), avgOpGrowth: avg('opGrowth'),
    avgDebtToEquity: avg('debtToEquity'),
    avgEvEbitda:     avg('evEbitda'),
    avgPiotroski:    avg('piotroskiScore'),
    avgPromoterHolding: avg('promoterHolding'),
    avgDividendYield:   avg('dividendYield'),
    avgPegRatio:        avg('pegRatio'),
    avgYoyQProfitGrowth: avg('yoyQProfitGrowth'),
    avgYoyQSalesGrowth:  avg('yoyQSalesGrowth'),
    companies: companies.map(c => ({
      name: c.name, nseCode: c.nseCode,
      pe: c.pe, pb: c.pb, roe: c.roe, opm: c.opm, npm: c.npm,
      profitGrowth: c.profitGrowth, salesGrowth: c.salesGrowth,
      piotroskiScore: c.piotroskiScore, debtToEquity: c.debtToEquity,
      yoyQProfitGrowth: c.yoyQProfitGrowth, lastResultDate: c.lastResultDate,
      marketCap: c.marketCap, currentPrice: c.currentPrice,
      ...gradeCompany(c)
    }))
  };
}

/**
 * List all distinct industries.
 */
function getIndustryList() {
  const set = new Set();
  getAllCompanies().forEach(c => { if (c.industry) set.add(c.industry); });
  return [...set].sort();
}

/**
 * Multi-factor deep screener.
 * All params optional; defaults allow everything through.
 *
 * @param {object} filters
 *   minROE, maxPE, minProfitGrowth, minSalesGrowth, maxDebtToEquity,
 *   minOPM, minPiotroski, minPromoterHolding, minMarketCap, maxMarketCap,
 *   minDividendYield, maxPegRatio, industry (partial string),
 *   minReturn1yr, maxReturn1yr, minCashFromOps, minPatQ (latest Q PAT),
 *   maxEvEbitda, minPB, maxPB, minYoyQProfitGrowth,
 *   belowGraham (bool — only stocks trading below Graham value)
 * @param {string} sortBy   any normalised key, default 'piotroskiScore'
 * @param {number} n        max results, default 50
 */
function deepScreener(filters = {}, sortBy = 'piotroskiScore', n = 50) {
  const {
    minROE            = -Infinity,
    maxPE             = Infinity,
    minProfitGrowth   = -Infinity,
    minSalesGrowth    = -Infinity,
    maxDebtToEquity   = Infinity,
    minOPM            = -Infinity,
    minPiotroski      = 0,
    minPromoterHolding= -Infinity,
    minMarketCap      = 0,
    maxMarketCap      = Infinity,
    minDividendYield  = -Infinity,
    maxPegRatio       = Infinity,
    industry          = '',
    minReturn1yr      = -Infinity,
    maxReturn1yr      = Infinity,
    minCashFromOps    = -Infinity,
    minPatQ           = -Infinity,
    maxEvEbitda       = Infinity,
    minPB             = -Infinity,
    maxPB             = Infinity,
    minYoyQProfitGrowth = -Infinity,
    belowGraham       = false,
  } = filters;

  return getAllCompanies()
    .filter(c => {
      if (c.roe              !== null && c.roe              < minROE)             return false;
      if (c.pe               !== null && c.pe               > maxPE)              return false;
      if (c.profitGrowth     !== null && c.profitGrowth     < minProfitGrowth)    return false;
      if (c.salesGrowth      !== null && c.salesGrowth      < minSalesGrowth)     return false;
      if (c.debtToEquity     !== null && c.debtToEquity     > maxDebtToEquity)    return false;
      if (c.opm              !== null && c.opm              < minOPM)             return false;
      if (c.piotroskiScore   !== null && c.piotroskiScore   < minPiotroski)       return false;
      if (c.promoterHolding  !== null && c.promoterHolding  < minPromoterHolding) return false;
      if ((c.marketCap || 0) < minMarketCap)                                      return false;
      if ((c.marketCap || Infinity) > maxMarketCap)                               return false;
      if (c.dividendYield    !== null && c.dividendYield    < minDividendYield)   return false;
      if (c.pegRatio         !== null && c.pegRatio         > maxPegRatio)        return false;
      if (c.return1yr        !== null && c.return1yr        < minReturn1yr)       return false;
      if (c.return1yr        !== null && c.return1yr        > maxReturn1yr)       return false;
      if (c.cashFromOps      !== null && c.cashFromOps      < minCashFromOps)     return false;
      if (c.patQ             !== null && c.patQ             < minPatQ)            return false;
      if (c.evEbitda         !== null && c.evEbitda > 0 && c.evEbitda > maxEvEbitda) return false;
      if (c.pb               !== null && c.pb               < minPB)              return false;
      if (c.pb               !== null && c.pb               > maxPB)              return false;
      if (c.yoyQProfitGrowth !== null && c.yoyQProfitGrowth < minYoyQProfitGrowth) return false;
      if (belowGraham && (c.grahamDiff === null || c.grahamDiff <= 0))            return false;
      if (industry && !c.industry.toLowerCase().includes(industry.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => ((b[sortBy] || 0) - (a[sortBy] || 0)))
    .slice(0, n)
    .map(c => ({ ...c, grade: gradeCompany(c) }));
}

/**
 * Compare multiple stocks side-by-side.
 * @param {string[]} queries  array of NSE codes / names
 */
function compareStocks(queries) {
  return queries.map(q => {
    const matches = searchCompany(q);
    if (!matches.length) return { query: q, found: false };
    const c = matches[0];
    return { ...c, grade: gradeCompany(c), found: true };
  });
}

/**
 * Industry leaderboard — top N companies per industry by a given metric.
 * Returns a map: industry → [top companies]
 */
function industryLeaderboard(metric = 'roe', topN = 3, minMarketCap = 100) {
  const companies = getAllCompanies().filter(c => c[metric] !== null && (c.marketCap || 0) >= minMarketCap);
  const byIndustry = {};
  companies.forEach(c => {
    if (!byIndustry[c.industry]) byIndustry[c.industry] = [];
    byIndustry[c.industry].push(c);
  });
  const result = {};
  Object.entries(byIndustry).forEach(([ind, list]) => {
    result[ind] = list
      .sort((a, b) => (b[metric] || 0) - (a[metric] || 0))
      .slice(0, topN)
      .map(c => ({
        name: c.name, nseCode: c.nseCode, currentPrice: c.currentPrice,
        marketCap: c.marketCap, [metric]: c[metric],
        pe: c.pe, roe: c.roe, opm: c.opm, piotroskiScore: c.piotroskiScore,
        lastResultDate: c.lastResultDate,
      }));
  });
  return result;
}

/**
 * Value stocks screen — Graham / PEG / low-PE relative to history.
 */
function valueStocks(n = 20, minMarketCap = 500) {
  return getAllCompanies()
    .filter(c =>
      c.marketCap >= minMarketCap &&
      c.pe        !== null && c.pe   > 0 && c.pe   < 30 &&
      c.pb        !== null && c.pb   > 0 && c.pb   < 4  &&
      c.roe       !== null && c.roe  > 10
    )
    .sort((a, b) => {
      // Composite: low PE + high ROE + positive cash flow
      const scoreA = (a.roe || 0) - (a.pe || 50) + (a.cashFromOps !== null && a.cashFromOps > 0 ? 5 : 0);
      const scoreB = (b.roe || 0) - (b.pe || 50) + (b.cashFromOps !== null && b.cashFromOps > 0 ? 5 : 0);
      return scoreB - scoreA;
    })
    .slice(0, n)
    .map(c => ({ ...c, grade: gradeCompany(c) }));
}

/**
 * Dividend / income stocks screen.
 */
function dividendStocks(n = 20, minYield = 1.5, minMarketCap = 500) {
  return getAllCompanies()
    .filter(c =>
      c.marketCap    !== null && c.marketCap    >= minMarketCap &&
      c.dividendYield !== null && c.dividendYield >= minYield    &&
      c.debtToEquity !== null && c.debtToEquity <= 1.0
    )
    .sort((a, b) => (b.dividendYield || 0) - (a.dividendYield || 0))
    .slice(0, n)
    .map(c => ({ ...c, grade: gradeCompany(c) }));
}

/**
 * Quality growth stocks — high Piotroski + high ROE + positive cash flow.
 */
function qualityGrowthStocks(n = 20, minMarketCap = 500) {
  return getAllCompanies()
    .filter(c =>
      c.marketCap      !== null && c.marketCap      >= minMarketCap &&
      c.piotroskiScore !== null && c.piotroskiScore >= 6            &&
      c.roe            !== null && c.roe             >= 12           &&
      c.cashFromOps    !== null && c.cashFromOps     > 0
    )
    .sort((a, b) => ((b.piotroskiScore || 0) * 2 + (b.roe || 0)) - ((a.piotroskiScore || 0) * 2 + (a.roe || 0)))
    .slice(0, n)
    .map(c => ({ ...c, grade: gradeCompany(c) }));
}

// ── Expose all metric keys available for sorting/filtering ───────────────────
const SORTABLE_METRICS = [
  'roe','roe3yr','roe5yr','profitGrowth','profitGrowth3yr','profitGrowth5yr',
  'salesGrowth','salesGrowth3yr','salesGrowth5yr',
  'return3m','return6m','return1yr','return3yr','return5yr',
  'piotroskiScore','pe','pb','pegRatio','priceToSales',
  'debtToEquity','dividendYield','evEbitda',
  'opm','npm','opGrowth','cashFromOps','netCashFlow',
  'marketCap','currentPrice',
  'promoterHolding','fiiHolding','diiHolding',
  'yoyQProfitGrowth','yoyQSalesGrowth','qoqProfits','qoqSales',
  'patQ','salesQ','opmQ','opProfitQ',
  'upside52wHigh','grahamDiff',
  'peTo3PE','peTo5PE','peTo7PE','roeTo3ROE','roeTo5ROE','roeTo7ROE',
];

module.exports = {
  getAllCompanies, searchCompany, analyseCompany,
  topByMetric, earningsSurpriseReport,
  industryComparison, getIndustryList,
  deepScreener, compareStocks,
  industryLeaderboard, valueStocks, dividendStocks, qualityGrowthStocks,
  gradeCompany, revenueTrend, profitTrend, marginTrend,
  SORTABLE_METRICS,
};
