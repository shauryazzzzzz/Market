/**
 * run-preflight.js
 * Starts the FUNDA server in-process, waits for readiness, tests all endpoints, exits.
 * Run: node scripts/run-preflight.js
 */
'use strict';

// ── Inline HTTP GET helper (no external deps) ─────────────────────────────────
const http = require('http');
function httpGet(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error(`Timeout ${url}`)); });
    req.on('error', reject);
  });
}

// ── Colors ────────────────────────────────────────────────────────────────────
const G = s => `\x1b[32m${s}\x1b[0m`;
const R = s => `\x1b[31m${s}\x1b[0m`;
const D = s => `\x1b[2m${s}\x1b[0m`;
const B = s => `\x1b[1m${s}\x1b[0m`;

const BASE = 'http://localhost:5001/api/funda';

const TESTS = [
  { id: 'health',           url: `${BASE}/health`,                           need: ['status','indexReady'] },
  { id: 'summary',          url: `${BASE}/summary`,                          need: ['filesIndexed','uniqueTickers'] },
  { id: 'sectors',          url: `${BASE}/sectors`,                          need: ['sectors'] },
  { id: 'sector-metrics',   url: `${BASE}/sector-metrics`,                   need: ['sectors'] },
  { id: 'sankey',           url: `${BASE}/sankey`,                           need: ['nodes','links'] },
  { id: 'ticker-metrics',   url: `${BASE}/ticker-metrics?tickers=RELIANCE`,  need: ['data'] },
  { id: 'fundamentals',     url: `${BASE}/fundamentals?tickers=RELIANCE`,    need: ['data'] },
  { id: 'ohlcv',            url: `${BASE}/ohlcv/RELIANCE`,                   ok404: true, need: ['symbol'] },
  { id: 'movers-gainers',   url: `${BASE}/markets/movers?type=gainers&limit=5`, need: ['data'] },
  { id: 'movers-losers',    url: `${BASE}/markets/movers?type=losers&limit=5`,  need: ['data'] },
  { id: 'movers-active',    url: `${BASE}/markets/movers?type=active&limit=5`,  need: ['data'] },
  { id: '52wk-high',        url: `${BASE}/markets/52wk?type=high&limit=5`,   need: ['data'] },
  { id: '52wk-low',         url: `${BASE}/markets/52wk?type=low&limit=5`,    need: ['data'] },
  { id: 'bulk-deals',       url: `${BASE}/markets/bulk-deals`,               need: ['data'] },
  { id: 'short-selling',    url: `${BASE}/markets/short-selling`,            need: ['data'] },
  { id: 'volatility',       url: `${BASE}/markets/volatility?limit=5`,       need: ['data'] },
  { id: 'mkt-overview',     url: `${BASE}/markets/overview`,                 need: [] },
  { id: 'nse-reports',      url: `${BASE}/nse/reports`,                      need: ['total','categories'] },
  { id: 'nse-downloaded',   url: `${BASE}/nse/downloaded`,                   need: ['dates'] },
];

async function waitReady(maxMs = 90000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    try {
      const r = await httpGet(`${BASE}/health`, 3000);
      if (r.status === 200) {
        const d = JSON.parse(r.body);
        if (d.indexReady) return { ok: true, elapsed: Date.now() - t0 };
      }
    } catch {}
    await new Promise(r => setTimeout(r, 1500));
    process.stdout.write('.');
  }
  return { ok: false };
}

async function runTests() {
  const results = [];
  for (const t of TESTS) {
    const t0 = Date.now();
    try {
      const r = await httpGet(t.url, 10000);
      const elapsed = Date.now() - t0;

      if (r.body.trim().startsWith('<')) {
        results.push({ id: t.id, pass: false, reason: `HTML returned (not JSON) — static middleware intercept`, elapsed });
        continue;
      }

      let data;
      try { data = JSON.parse(r.body); }
      catch { results.push({ id: t.id, pass: false, reason: `Invalid JSON`, elapsed }); continue; }

      const goodStatus = t.ok404 ? [200, 404].includes(r.status) : r.status < 300;
      if (!goodStatus) {
        results.push({ id: t.id, pass: false, reason: `HTTP ${r.status}: ${data.error || ''}`, elapsed });
        continue;
      }

      const missing = (t.need || []).filter(k => !(k in data));
      if (missing.length) {
        results.push({ id: t.id, pass: false, reason: `Missing fields: ${missing.join(', ')}`, elapsed });
        continue;
      }

      results.push({ id: t.id, pass: true, elapsed });
    } catch (e) {
      results.push({ id: t.id, pass: false, reason: e.message, elapsed: Date.now() - t0 });
    }
  }
  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────
// Load server in-process on different port to avoid conflicts
process.env.BACKEND_PORT = '5001';

// Start server module
console.log(B('\n── FUNDA Pre-flight ─────────────────────────────────────'));
console.log(D('Loading server…'));

// Require the server (it calls app.listen internally)
try {
  require('../server');
} catch (e) {
  console.error(R(`Failed to load server.js: ${e.message}`));
  process.exit(1);
}

(async () => {
  process.stdout.write('\nWaiting for backend + index ');
  const { ok, elapsed } = await waitReady();
  console.log('');

  if (!ok) {
    console.error(R('Server did not become ready in 90s'));
    process.exit(1);
  }
  console.log(G(`✓ Ready in ${(elapsed/1000).toFixed(1)}s\n`));

  // Extra wait for prewarm
  await new Promise(r => setTimeout(r, 3000));

  console.log(B('─'.repeat(60)));
  const results = await runTests();

  let passed = 0, failed = 0;
  for (const r of results) {
    if (r.pass) {
      console.log(`  ${G('PASS')}  ${r.id.padEnd(22)} ${D(r.elapsed + 'ms')}`);
      passed++;
    } else {
      console.log(`  ${R('FAIL')}  ${r.id.padEnd(22)} ${R('→ ' + r.reason)}`);
      failed++;
    }
  }

  console.log(B('\n' + '─'.repeat(60)));
  console.log(`  ${G(passed + ' passed')}  ${failed > 0 ? R(failed + ' failed') : D('0 failed')}`);

  if (failed > 0) {
    console.log(R('\n✗ Fix failures before starting frontend\n'));
    process.exit(1);
  } else {
    console.log(G('\n✓ ALL PASS — safe to start frontend\n'));
    process.exit(0);
  }
})();
