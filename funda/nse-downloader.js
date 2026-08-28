'use strict';
/**
 * NSE Daily Report Downloader
 * ───────────────────────────
 * Implements the full catalogue of NSE All-Reports downloadable files
 * (https://www.nseindia.com/all-reports) with automated date-substitution,
 * cookie-session management and local file storage.
 *
 * Usage (standalone):  node nse-downloader.js [DDMMYYYY]
 * Exported as module:  require('./nse-downloader')
 */

const https   = require('https');
const http    = require('http');
const fs      = require('fs');
const path    = require('path');
const zlib    = require('zlib');
const { URL } = require('url');

// ── Config ────────────────────────────────────────────────────────────────────

const NSE_BASE   = 'https://www.nseindia.com';
const REPORT_URL = `${NSE_BASE}/all-reports`;

/** Root directory where downloaded files are stored.
 *  FUNDA_DATA_DIR env overrides; default: ../../DATA/Raw data */
function getDataDir(dateLabel) {
  const base = process.env.FUNDA_DATA_DIR
    || path.resolve(__dirname, '..', '..', 'DATA', 'Raw data');
  const dir = path.join(base, dateLabel);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ── NSE Report Catalogue ─────────────────────────────────────────────────────
//
// Each entry has:
//   id       — unique slug used in the API
//   name     — human-readable label
//   category — grouping
//   url      — full URL template; {DD}, {MM}, {YYYY}, {DDMMYYYY}, {YYYYMMDD},
//              {YY}, {NNNNN} (day-of-year) are replaced at download time
//   ext      — file extension
//   optional — if true, a 404 is not treated as an error

const REPORTS = [
  // ── Bhavcopy ────────────────────────────────────────────────────────────────
  {
    id: 'bhavcopy_new',
    name: 'Bhavcopy CM (New Format)',
    category: 'Bhavcopy',
    url: `${NSE_BASE}/content/historical/EQUITIES/{YYYY}/{MON}/BhavCopy_NSE_CM_0_0_0_{YYYYMMDD}_F_0000.csv.zip`,
    ext: '.csv.zip',
  },
  {
    id: 'bhavcopy_full',
    name: 'Bhavcopy Full (sec_bhavdata)',
    category: 'Bhavcopy',
    url: `${NSE_BASE}/content/equities/sec_bhavdata_full_{DDMMYYYY}.csv`,
    ext: '.csv',
  },
  {
    id: 'bhavcopy_pr',
    name: 'Price Report (PR)',
    category: 'Bhavcopy',
    url: `${NSE_BASE}/content/equities/pr{DDMMYY}.zip`,
    ext: '.zip',
  },

  // ── Security Info ───────────────────────────────────────────────────────────
  {
    id: 'security_list',
    name: 'Security List',
    category: 'Security Info',
    url: `${NSE_BASE}/content/equities/sec_list_{DDMMYYYY}.csv`,
    ext: '.csv',
  },
  {
    id: 'security_master',
    name: 'Security Master (CM)',
    category: 'Security Info',
    url: `${NSE_BASE}/content/equities/NSE_CM_security_{DDMMYYYY}.csv`,
    ext: '.csv',
  },
  {
    id: 'pe_ratios',
    name: 'P/E Ratios',
    category: 'Security Info',
    url: `${NSE_BASE}/content/equities/PE_{DDMMYY}.csv`,
    ext: '.csv',
  },

  // ── Market Activity ─────────────────────────────────────────────────────────
  {
    id: 'gainers_losers',
    name: 'Top Gainers & Losers',
    category: 'Market Activity',
    url: `${NSE_BASE}/content/equities/gl{DDMMYY}.csv`,
    ext: '.csv',
  },
  {
    id: 'hi_lo_52wk',
    name: '52-Week High / Low',
    category: 'Market Activity',
    url: `${NSE_BASE}/content/equities/CM_52_wk_High_low_{DDMMYYYY}.csv`,
    ext: '.csv',
  },
  {
    id: 'mcap',
    name: 'Market Capitalisation',
    category: 'Market Activity',
    url: `${NSE_BASE}/content/equities/mcap{DDMMYY}.csv`,
    ext: '.csv',
  },
  {
    id: 'top25_traded',
    name: 'Top 25 Most Traded',
    category: 'Market Activity',
    url: `${NSE_BASE}/content/equities/tt{DDMMYY}.csv`,
    ext: '.csv',
  },
  {
    id: 'circuit_breakers',
    name: 'Circuit Breakers',
    category: 'Market Activity',
    url: `${NSE_BASE}/content/equities/circuit_{DDMMYYYY}.csv`,
    ext: '.csv',
    optional: true,
  },
  {
    id: 'band_changes',
    name: 'Band Changes',
    category: 'Market Activity',
    url: `${NSE_BASE}/content/equities/eq_band_changes_{DDMMYYYY}.csv`,
    ext: '.csv',
    optional: true,
  },
  {
    id: 'band_hit',
    name: 'Band Hit',
    category: 'Market Activity',
    url: `${NSE_BASE}/content/equities/bh{DDMMYY}.csv`,
    ext: '.csv',
    optional: true,
  },
  {
    id: 'new_52wk_hl',
    name: 'New 52-Week Highs/Lows',
    category: 'Market Activity',
    url: `${NSE_BASE}/content/equities/hl{DDMMYY}.csv`,
    ext: '.csv',
    optional: true,
  },
  {
    id: 'corp_actions',
    name: 'Corporate Actions',
    category: 'Market Activity',
    url: `${NSE_BASE}/content/equities/bc{DDMMYY}.csv`,
    ext: '.csv',
    optional: true,
  },

  // ── Bulk & Block Deals ──────────────────────────────────────────────────────
  {
    id: 'bulk_deals',
    name: 'Bulk Deals',
    category: 'Bulk & Block',
    url: `${NSE_BASE}/content/equities/bulk.csv`,
    ext: '.csv',
  },
  {
    id: 'block_deals',
    name: 'Block Deals',
    category: 'Bulk & Block',
    url: `${NSE_BASE}/content/equities/block.csv`,
    ext: '.csv',
  },
  {
    id: 'short_selling',
    name: 'Short Selling',
    category: 'Bulk & Block',
    url: `${NSE_BASE}/content/equities/shortselling_{DDMMYYYY}.csv`,
    ext: '.csv',
    optional: true,
  },

  // ── Derivatives Margin / Volatility ─────────────────────────────────────────
  {
    id: 'volatility',
    name: 'CM Volatility (EWMA)',
    category: 'Derivatives / Risk',
    url: `${NSE_BASE}/content/equities/CMVOLT_{DDMMYYYY}.CSV`,
    ext: '.CSV',
  },
  {
    id: 'var_margins',
    name: 'MF VAR Margins',
    category: 'Derivatives / Risk',
    url: `${NSE_BASE}/content/equities/MF_VAR_{DDMMYYYY}.csv`,
    ext: '.csv',
  },
  {
    id: 'collateral_values',
    name: 'Approved Securities Collateral Values',
    category: 'Derivatives / Risk',
    url: `${NSE_BASE}/content/equities/APPSEC_COLLVAL_{DDMMYYYY}.csv`,
    ext: '.csv',
  },
  {
    id: 'stt',
    name: 'STT (Securities Transaction Tax)',
    category: 'Derivatives / Risk',
    url: `${NSE_BASE}/content/equities/C_STT_{DDMMYYYY}.csv`,
    ext: '.csv',
  },
  {
    id: 'stt_indicators',
    name: 'STT Indicators',
    category: 'Derivatives / Risk',
    url: `${NSE_BASE}/content/equities/C_STT_IND_{DDMMYYYY}.csv`,
    ext: '.csv',
  },

  // ── SME & Debt ──────────────────────────────────────────────────────────────
  {
    id: 'sme_bhavcopy',
    name: 'SME Bhavcopy',
    category: 'SME & Debt',
    url: `${NSE_BASE}/content/equities/sme{DDMMYYYY}.csv`,
    ext: '.csv',
    optional: true,
  },
  {
    id: 'sme_bands',
    name: 'SME Bands',
    category: 'SME & Debt',
    url: `${NSE_BASE}/content/equities/sme_bands_complete_{DDMMYYYY}.csv`,
    ext: '.csv',
    optional: true,
  },
  {
    id: 'corp_bonds',
    name: 'Corporate Bonds Bhavcopy',
    category: 'SME & Debt',
    url: `${NSE_BASE}/content/equities/corpbond{DDMMYYYY}.csv`,
    ext: '.csv',
    optional: true,
  },
  {
    id: 'etf',
    name: 'ETF Bhavcopy',
    category: 'SME & Debt',
    url: `${NSE_BASE}/content/equities/etf{DDMMYY}.csv`,
    ext: '.csv',
    optional: true,
  },
];

// ── Date helpers ──────────────────────────────────────────────────────────────

const MON_NAMES = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

function todayDateStr() {
  const d = new Date();
  const dd   = String(d.getDate()).padStart(2, '0');
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return `${dd}${mm}${yyyy}`;
}

function parseDateStr(str) {
  // Accept DDMMYYYY or YYYY-MM-DD
  if (!str || str.length < 8) return null;
  if (str.includes('-')) {
    const [y, m, d] = str.split('-');
    return { dd: d, mm: m, yyyy: y };
  }
  return { dd: str.slice(0, 2), mm: str.slice(2, 4), yyyy: str.slice(4, 8) };
}

function applyDateTokens(template, { dd, mm, yyyy }) {
  const yy  = yyyy.slice(2);
  const mon = MON_NAMES[parseInt(mm, 10) - 1] || 'AUG';
  return template
    .replace(/\{DDMMYYYY\}/g, `${dd}${mm}${yyyy}`)
    .replace(/\{YYYYMMDD\}/g, `${yyyy}${mm}${dd}`)
    .replace(/\{DDMMYY\}/g,   `${dd}${mm}${yy}`)
    .replace(/\{DD\}/g, dd)
    .replace(/\{MM\}/g, mm)
    .replace(/\{MON\}/g, mon)
    .replace(/\{YYYY\}/g, yyyy)
    .replace(/\{YY\}/g, yy);
}

// ── NSE Session ───────────────────────────────────────────────────────────────

const SESSION = { cookies: '', lastInit: 0 };

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Referer': `${NSE_BASE}/`,
};

async function initSession(log) {
  if (Date.now() - SESSION.lastInit < 5 * 60 * 1000) return; // reuse for 5 min
  log?.('[NSE] Initializing session…');
  return new Promise((resolve) => {
    const req = https.get(NSE_BASE, { headers: HEADERS }, (res) => {
      const setCookie = res.headers['set-cookie'] || [];
      SESSION.cookies = setCookie.map(c => c.split(';')[0]).join('; ');
      SESSION.lastInit = Date.now();
      log?.('[NSE] Session ready');
      // drain body
      res.on('data', () => {});
      res.on('end', resolve);
    });
    req.on('error', () => resolve());
    req.setTimeout(10000, () => { req.destroy(); resolve(); });
  });
}

// ── Download a single URL to disk ─────────────────────────────────────────────

function downloadFile(url, destPath, optional, log) {
  return new Promise((resolve) => {
    const parsed   = new URL(url);
    const protocol = parsed.protocol === 'https:' ? https : http;
    const reqHeaders = { ...HEADERS, Cookie: SESSION.cookies };

    const doRequest = (targetUrl, redirectCount = 0) => {
      if (redirectCount > 5) return resolve({ ok: false, status: 'too many redirects' });

      const parsedTarget = new URL(targetUrl);
      const opts = {
        hostname: parsedTarget.hostname,
        path: parsedTarget.pathname + parsedTarget.search,
        headers: reqHeaders,
        timeout: 30000,
      };

      const req = protocol.get(opts, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.on('data', () => {});
          res.on('end', () => doRequest(res.headers.location, redirectCount + 1));
          return;
        }

        if (res.statusCode === 404) {
          res.on('data', () => {});
          res.on('end', () => resolve({ ok: optional, status: 404, skipped: optional }));
          return;
        }

        if (res.statusCode !== 200) {
          res.on('data', () => {});
          res.on('end', () => resolve({ ok: false, status: res.statusCode }));
          return;
        }

        // Handle gzip/deflate
        let stream = res;
        const enc = res.headers['content-encoding'];
        if (enc === 'gzip')      stream = res.pipe(zlib.createGunzip());
        else if (enc === 'br')   stream = res.pipe(zlib.createBrotliDecompress());
        else if (enc === 'deflate') stream = res.pipe(zlib.createInflate());

        const file = fs.createWriteStream(destPath);
        stream.pipe(file);
        stream.on('error', (e) => resolve({ ok: false, status: e.message }));
        file.on('finish', () => {
          const stat = fs.statSync(destPath);
          resolve({ ok: true, status: 200, bytes: stat.size, path: destPath });
        });
        file.on('error', (e) => resolve({ ok: false, status: e.message }));
      });

      req.on('error', (e) => resolve({ ok: false, status: e.message }));
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 'timeout' }); });
    };

    doRequest(url);
  });
}

// ── Main download orchestrator ────────────────────────────────────────────────

/**
 * Download a set of NSE reports for a given date.
 * @param {string} dateStr  - DDMMYYYY or YYYY-MM-DD, defaults to today
 * @param {string[]} ids    - report IDs to download; empty = all
 * @param {Function} log    - optional logger  (msg, level) => void
 * @param {Function} onProgress - optional progress callback (report, result) => void
 * @returns {Promise<{date, results: [{id,name,status,bytes,path}]}>}
 */
async function downloadReports(dateStr, ids = [], log = null, onProgress = null) {
  const ds = dateStr || todayDateStr();
  const parsed = parseDateStr(ds);
  if (!parsed) throw new Error(`Invalid date: ${ds}`);

  const dateLabel = `${parsed.dd}-${parsed.mm}-${parsed.yyyy}`;
  const dir = getDataDir(dateLabel);

  log?.(`[NSE] Downloading reports for ${dateLabel} → ${dir}`);
  await initSession(log);

  const toDownload = ids.length
    ? REPORTS.filter(r => ids.includes(r.id))
    : REPORTS;

  const results = [];

  for (const report of toDownload) {
    const resolvedUrl = applyDateTokens(report.url, parsed);
    const filename    = path.basename(new URL(resolvedUrl).pathname);
    const destPath    = path.join(dir, filename);

    // Skip if already downloaded and non-empty
    if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
      log?.(`[NSE] ↷ ${report.id} (already exists)`);
      results.push({ id: report.id, name: report.name, category: report.category,
                     status: 'cached', bytes: fs.statSync(destPath).size, path: destPath });
      onProgress?.(report, { status: 'cached' });
      continue;
    }

    log?.(`[NSE] ↓ ${report.id}  ${resolvedUrl}`);
    const result = await downloadFile(resolvedUrl, destPath, report.optional, log);

    const entry = {
      id:       report.id,
      name:     report.name,
      category: report.category,
      url:      resolvedUrl,
      status:   result.ok ? (result.skipped ? 'skipped' : 'ok') : `error: ${result.status}`,
      bytes:    result.bytes || 0,
      path:     result.ok && !result.skipped ? destPath : null,
    };

    results.push(entry);
    onProgress?.(report, result);

    // Polite delay between requests
    await new Promise(r => setTimeout(r, 400));
  }

  const ok      = results.filter(r => r.status === 'ok').length;
  const cached  = results.filter(r => r.status === 'cached').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const errors  = results.filter(r => r.status.startsWith('error')).length;

  log?.(`[NSE] Done — ${ok} downloaded, ${cached} cached, ${skipped} skipped, ${errors} errors`);
  return { date: dateLabel, dir, results, ok, cached, skipped, errors };
}

// ── Summary of downloaded dates ───────────────────────────────────────────────

function listDownloadedDates() {
  const base = process.env.FUNDA_DATA_DIR
    || path.resolve(__dirname, '..', '..', 'DATA', 'Raw data');
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base, { withFileTypes: true })
    .filter(e => e.isDirectory() && /^\d{2}-\d{2}-\d{4}$/.test(e.name))
    .map(e => {
      const dir   = path.join(base, e.name);
      const files = fs.readdirSync(dir).filter(f => !f.startsWith('.'));
      const total = files.reduce((acc, f) => {
        try { return acc + fs.statSync(path.join(dir, f)).size; } catch { return acc; }
      }, 0);
      return { date: e.name, files: files.length, bytes: total, dir };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

module.exports = { REPORTS, downloadReports, listDownloadedDates, todayDateStr, parseDateStr };

// ── CLI ───────────────────────────────────────────────────────────────────────
if (require.main === module) {
  const dateArg = process.argv[2] || todayDateStr();
  downloadReports(dateArg, [], console.log).then(({ ok, errors }) => {
    console.log(`\n✅  ${ok} reports downloaded — ${errors} errors`);
    process.exit(errors > 0 ? 1 : 0);
  }).catch(e => { console.error(e); process.exit(1); });
}
