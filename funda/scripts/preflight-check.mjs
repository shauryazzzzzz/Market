/**
 * FUNDA Pre-flight Backend Validation Script
 * ────────────────────────────────────────────
 * Tests every API endpoint for:
 *   • HTTP 2xx status
 *   • Non-empty, valid JSON body
 *   • Required top-level fields
 *
 * Usage:
 *   node scripts/preflight-check.mjs              (default: http://localhost:5001)
 *   node scripts/preflight-check.mjs http://localhost:5001
 *
 * Exit code: 0 = all PASS, 1 = any FAIL
 */

const BASE = process.argv[2] || 'http://localhost:5001';
const BASE_API = `${BASE}/api/funda`;

// ANSI colour helpers
const C = {
  green:  s => `\x1b[32m${s}\x1b[0m`,
  red:    s => `\x1b[31m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  cyan:   s => `\x1b[36m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
};

function pad(s, n) { return String(s).padEnd(n); }

// ── Endpoint test definitions ─────────────────────────────────────────────────
const TESTS = [
  {
    id: 'health',
    url: `${BASE_API}/health`,
    method: 'GET',
    desc: 'Server health & index status',
    assert: (d) => d.status === 'ok' && typeof d.filesIndexed === 'number',
    required: ['status', 'indexReady', 'filesIndexed'],
  },
  {
    id: 'summary',
    url: `${BASE_API}/summary`,
    method: 'GET',
    desc: 'Data summary (tickers, sectors, files)',
    assert: (d) => typeof d.filesIndexed === 'number' && typeof d.uniqueTickers === 'number',
    required: ['filesIndexed', 'uniqueTickers', 'uniqueSectors', 'sectors'],
  },
  {
    id: 'sectors',
    url: `${BASE_API}/sectors`,
    method: 'GET',
    desc: 'Sector catalogue with tickers (dropdown data)',
    assert: (d) => Array.isArray(d.sectors),
    required: ['count', 'sectors'],
  },
  {
    id: 'sector_metrics',
    url: `${BASE_API}/sector-metrics`,
    method: 'GET',
    desc: 'Sector-level aggregated metrics (heatmap)',
    assert: (d) => Array.isArray(d.sectors),
    required: ['count', 'sectors'],
  },
  {
    id: 'ticker_metrics_param',
    url: `${BASE_API}/ticker-metrics?tickers=RELIANCE,TCS`,
    method: 'GET',
    desc: 'Ticker metrics by ?tickers param',
    assert: (d) => Array.isArray(d.data),
    required: ['tickers', 'data'],
  },
  {
    id: 'fundamentals',
    url: `${BASE_API}/fundamentals?tickers=RELIANCE,TCS`,
    method: 'GET',
    desc: 'Fundamental data for tickers',
    assert: (d) => Array.isArray(d.data),
    required: ['tickers', 'data'],
  },
  {
    id: 'ohlcv_symbol',
    url: `${BASE_API}/ohlcv/RELIANCE?period=all`,
    method: 'GET',
    desc: 'OHLCV time-series + computed indicators',
    assert: (d) => Array.isArray(d.data) || d.found === false,
    required: ['symbol'],
    allowedStatus: [200, 404],
  },
  {
    id: 'sankey',
    url: `${BASE_API}/sankey`,
    method: 'GET',
    desc: 'Sankey flow data (nodes + links)',
    assert: (d) => Array.isArray(d.nodes) && Array.isArray(d.links),
    required: ['nodes', 'links'],
  },
  {
    id: 'markets_movers_gainers',
    url: `${BASE_API}/markets/movers?type=gainers&limit=5`,
    method: 'GET',
    desc: 'Market movers — top gainers',
    assert: (d) => Array.isArray(d.data),
    required: ['type', 'count', 'data'],
  },
  {
    id: 'markets_movers_losers',
    url: `${BASE_API}/markets/movers?type=losers&limit=5`,
    method: 'GET',
    desc: 'Market movers — top losers',
    assert: (d) => Array.isArray(d.data),
    required: ['type', 'data'],
  },
  {
    id: 'markets_movers_active',
    url: `${BASE_API}/markets/movers?type=active&limit=5`,
    method: 'GET',
    desc: 'Market movers — most active',
    assert: (d) => Array.isArray(d.data),
    required: ['type', 'data'],
  },
  {
    id: 'markets_52wk_high',
    url: `${BASE_API}/markets/52wk?type=high&limit=5`,
    method: 'GET',
    desc: '52-Week High list',
    assert: (d) => Array.isArray(d.data),
    required: ['type', 'count', 'data'],
  },
  {
    id: 'markets_52wk_low',
    url: `${BASE_API}/markets/52wk?type=low&limit=5`,
    method: 'GET',
    desc: '52-Week Low list',
    assert: (d) => Array.isArray(d.data),
    required: ['type', 'count', 'data'],
  },
  {
    id: 'markets_bulk',
    url: `${BASE_API}/markets/bulk-deals`,
    method: 'GET',
    desc: 'Bulk deals',
    assert: (d) => Array.isArray(d.data),
    required: ['count', 'data'],
  },
  {
    id: 'markets_short',
    url: `${BASE_API}/markets/short-selling`,
    method: 'GET',
    desc: 'Short selling data',
    assert: (d) => Array.isArray(d.data),
    required: ['count', 'data'],
  },
  {
    id: 'markets_volatility',
    url: `${BASE_API}/markets/volatility?limit=5`,
    method: 'GET',
    desc: 'Annualised volatility ranking',
    assert: (d) => Array.isArray(d.data),
    required: ['count', 'data'],
  },
  {
    id: 'markets_overview',
    url: `${BASE_API}/markets/overview`,
    method: 'GET',
    desc: 'Market overview (A/D ratio, indices)',
    assert: (d) => d != null,
    required: [],
  },
  {
    id: 'nse_reports',
    url: `${BASE_API}/nse/reports`,
    method: 'GET',
    desc: 'NSE report catalogue',
    assert: (d) => Array.isArray(d.categories) && typeof d.total === 'number',
    required: ['total', 'categories'],
  },
  {
    id: 'nse_downloaded',
    url: `${BASE_API}/nse/downloaded`,
    method: 'GET',
    desc: 'List of previously downloaded dates',
    assert: (d) => Array.isArray(d.dates),
    required: ['count', 'dates'],
  },
  {
    id: 'ticker_404',
    url: `${BASE_API}/ohlcv/__NONEXISTENT__?period=all`,
    method: 'GET',
    desc: 'OHLCV for unknown ticker returns 404 gracefully',
    assert: (d) => d.found === false,
    allowedStatus: [404],
  },
  {
    id: 'fundamentals_empty_param',
    url: `${BASE_API}/fundamentals`,
    method: 'GET',
    desc: 'Fundamentals with no param returns 400',
    assert: (d) => d.error != null,
    allowedStatus: [400],
  },
  {
    id: 'ticker_metrics_bad_param',
    url: `${BASE_API}/ticker-metrics`,
    method: 'GET',
    desc: 'Ticker metrics with no param returns 400',
    assert: (d) => d.error != null,
    allowedStatus: [400],
  },
];

// ── Runner ─────────────────────────────────────────────────────────────────────
let passed = 0, failed = 0, skipped = 0;
const failures = [];

async function runTest(t) {
  const allowedStatus = t.allowedStatus || [200];
  let status, data, elapsed;
  try {
    const start = Date.now();
    const resp = await fetch(t.url, { method: t.method, headers: { Accept: 'application/json' } });
    elapsed = Date.now() - start;
    status  = resp.status;

    const text = await resp.text();
    if (!text.trim()) {
      throw new Error('Empty response body');
    }
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON: ${text.slice(0, 80)}`);
    }
  } catch (err) {
    failed++;
    failures.push({ id: t.id, reason: err.message });
    console.log(`  ${C.red('FAIL')}  ${pad(t.id, 36)} ${C.dim(t.desc)}`);
    console.log(`        ${C.red('→')} ${err.message}`);
    return;
  }

  // Status check
  if (!allowedStatus.includes(status)) {
    failed++;
    const reason = `HTTP ${status} (expected ${allowedStatus.join('|')}): ${JSON.stringify(data).slice(0, 120)}`;
    failures.push({ id: t.id, reason });
    console.log(`  ${C.red('FAIL')}  ${pad(t.id, 36)} ${C.dim(t.desc)}`);
    console.log(`        ${C.red('→')} ${reason}`);
    return;
  }

  // Required fields
  const missing = (t.required || []).filter(k => !(k in data));
  if (missing.length) {
    failed++;
    const reason = `Missing fields: ${missing.join(', ')} in response`;
    failures.push({ id: t.id, reason });
    console.log(`  ${C.red('FAIL')}  ${pad(t.id, 36)} ${C.dim(t.desc)}`);
    console.log(`        ${C.red('→')} ${reason}`);
    return;
  }

  // Custom assert
  if (t.assert && !t.assert(data)) {
    failed++;
    const reason = `Assertion failed. Body: ${JSON.stringify(data).slice(0, 120)}`;
    failures.push({ id: t.id, reason });
    console.log(`  ${C.red('FAIL')}  ${pad(t.id, 36)} ${C.dim(t.desc)}`);
    console.log(`        ${C.red('→')} ${reason}`);
    return;
  }

  passed++;
  console.log(`  ${C.green('PASS')}  ${pad(t.id, 36)} ${C.dim(`${elapsed}ms`)}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log();
  console.log(C.bold(`FUNDA Pre-flight Check — ${BASE_API}`));
  console.log(C.dim(`Running ${TESTS.length} endpoint tests…`));
  console.log('─'.repeat(72));

  for (const t of TESTS) {
    await runTest(t);
  }

  console.log('─'.repeat(72));
  console.log(
    `\n  ${C.green(`${passed} passed`)}  ${failed > 0 ? C.red(`${failed} failed`) : C.dim('0 failed')}  ${C.dim(`of ${TESTS.length} total`)}`
  );

  if (failures.length) {
    console.log(`\n${C.red(C.bold('FAILURES:'))}`);
    failures.forEach(f => console.log(`  • ${C.red(f.id)}: ${f.reason}`));
    console.log();
    process.exit(1);
  } else {
    console.log(`\n  ${C.green(C.bold('✓ ALL CHECKS PASSED — safe to start frontend'))}\n`);
    process.exit(0);
  }
}

main().catch(err => {
  console.error(C.red(`\nPre-flight script crashed: ${err.message}`));
  console.error(C.dim('Is the backend server running on port 5001?\n  cd tradingview-economy/funda && node server.js'));
  process.exit(1);
});
