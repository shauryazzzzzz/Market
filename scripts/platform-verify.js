/**
 * platform-verify.js  v2 — PARALLEL edition
 * ────────────────────────────────────────────
 * • All 3 backends started simultaneously (in-process, different ports)
 * • All 3 frontend builds run in parallel (child_process)
 * • Health poll interval: 300ms (was 1500ms)
 * • No sequential waiting — everything that can run in parallel does
 * • Exits 0 = all pass, 1 = any fail
 *
 * Usage:  node scripts/platform-verify.js   (from tradingview-economy/)
 */
'use strict';

const http  = require('http');
const path  = require('path');
const { execSync, exec } = require('child_process');

// ── ANSI ──────────────────────────────────────────────────────────────────────
const G  = s => `\x1b[32m${s}\x1b[0m`;
const R  = s => `\x1b[31m${s}\x1b[0m`;
const Y  = s => `\x1b[33m${s}\x1b[0m`;
const D  = s => `\x1b[2m${s}\x1b[0m`;
const B  = s => `\x1b[1m${s}\x1b[0m`;
const C  = s => `\x1b[36m${s}\x1b[0m`;
const pad = (s, n) => String(s).padEnd(n);

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function httpGet(url, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error(`Timeout`)); });
    req.on('error', reject);
  });
}

function httpPost(url, body, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = require('url').parse(url);
    const opts = { ...u, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } };
    const req = http.request(opts, (res) => {
      let b = '';
      res.on('data', d => b += d);
      res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('POST timeout')); });
    req.on('error', reject);
    req.write(data); req.end();
  });
}

function tryJSON(s) { try { return JSON.parse(s); } catch { return null; } }

// ── Wait for health (fast 300ms poll) ─────────────────────────────────────────
async function waitHealth(url, name, maxMs = 120000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    try {
      const r = await httpGet(url, 2500);
      if (r.status === 200 && tryJSON(r.body)?.status === 'ok') {
        return { ok: true, ms: Date.now() - t0 };
      }
    } catch {}
    await new Promise(r => setTimeout(r, 300)); // fast poll
  }
  return { ok: false, ms: maxMs };
}

// ── Parallel npm build via child_process ─────────────────────────────────────
function buildFrontend(cwd, name) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const proc = exec('npm run build', { cwd, timeout: 180000 }, (err, stdout, stderr) => {
      const elapsed = Date.now() - t0;
      if (err) {
        resolve({ ok: false, name, elapsed, error: (stdout + stderr).slice(0, 300) });
      } else {
        resolve({ ok: true, name, elapsed });
      }
    });
  });
}

// ── Test one endpoint ─────────────────────────────────────────────────────────
async function testEndpoint(t) {
  const t0 = Date.now();
  try {
    const r = t.method === 'POST'
      ? await httpPost(t.url, t.body || {}, 30000)
      : await httpGet(t.url, 12000);

    const elapsed = Date.now() - t0;
    if (r.body?.trim().startsWith('<'))
      return { id: t.id, pass: false, reason: 'HTML (static middleware intercept)', elapsed };

    const data = tryJSON(r.body);
    if (!data) return { id: t.id, pass: false, reason: `Bad JSON: ${String(r.body).slice(0,60)}`, elapsed };

    const ok = (t.allowedStatus || [200,201]).includes(r.status);
    if (!ok) return { id: t.id, pass: false, reason: `HTTP ${r.status}: ${data.error||''}`, elapsed };

    const missing = (t.need || []).filter(k => !(k in data));
    if (missing.length) return { id: t.id, pass: false, reason: `Missing fields: ${missing.join(',')}`, elapsed };

    if (t.assert && !t.assert(data))
      return { id: t.id, pass: false, reason: 'Assertion failed', elapsed };

    return { id: t.id, pass: true, elapsed };
  } catch (e) {
    return { id: t.id, pass: false, reason: e.message, elapsed: Date.now() - t0 };
  }
}

// ── Sub-project definitions ───────────────────────────────────────────────────
function makeProjects() {
  const root = path.resolve(__dirname, '..');
  return [
    {
      name: 'FUNDA', bPort: 5001, fPort: 3001,
      serverPath:   path.join(root, 'funda/server.js'),
      frontendPath: path.join(root, 'funda/frontend'),
      healthUrl:    'http://localhost:5001/api/funda/health',
      envPort:      '5001',
      tests: () => {
        const B = 'http://localhost:5001/api/funda';
        return [
          { id: 'health',         url: `${B}/health`,                            need: ['status','indexReady'] },
          { id: 'summary',        url: `${B}/summary`,                           need: ['filesIndexed','uniqueTickers'] },
          { id: 'sectors',        url: `${B}/sectors`,                           need: ['sectors'], assert: d => Array.isArray(d.sectors) },
          { id: 'sector-metrics', url: `${B}/sector-metrics`,                    need: ['sectors'] },
          { id: 'sankey',         url: `${B}/sankey`,                            need: ['nodes','links'] },
          { id: 'ticker-metrics', url: `${B}/ticker-metrics?tickers=RELIANCE`,   need: ['data'] },
          { id: 'fundamentals',   url: `${B}/fundamentals?tickers=RELIANCE`,     need: ['data'] },
          { id: 'ohlcv',          url: `${B}/ohlcv/RELIANCE`, allowedStatus:[200,404], need:['symbol'] },
          { id: 'movers-gainers', url: `${B}/markets/movers?type=gainers&limit=3`, need: ['data'] },
          { id: 'movers-losers',  url: `${B}/markets/movers?type=losers&limit=3`,  need: ['data'] },
          { id: 'movers-active',  url: `${B}/markets/movers?type=active&limit=3`,  need: ['data'] },
          { id: '52wk-high',      url: `${B}/markets/52wk?type=high&limit=3`,      need: ['data'] },
          { id: '52wk-low',       url: `${B}/markets/52wk?type=low&limit=3`,       need: ['data'] },
          { id: 'bulk-deals',     url: `${B}/markets/bulk-deals`,                  need: ['data'] },
          { id: 'short-selling',  url: `${B}/markets/short-selling`,               need: ['data'] },
          { id: 'volatility',     url: `${B}/markets/volatility?limit=3`,          need: ['data'] },
          { id: 'mkt-overview',   url: `${B}/markets/overview`,                    need: [] },
          { id: 'nse-reports',    url: `${B}/nse/reports`,                         need: ['total','categories'] },
          { id: 'nse-downloaded', url: `${B}/nse/downloaded`,                      need: ['dates'] },
        ];
      },
    },
    {
      name: 'ANALYZER', bPort: 5002, fPort: 3002,
      serverPath:   path.join(root, 'analyzer/server.js'),
      frontendPath: path.join(root, 'analyzer/frontend'),
      healthUrl:    'http://localhost:5002/api/analyzer/health',
      envPort:      '5002',
      tests: () => {
        const B = 'http://localhost:5002/api/analyzer';
        return [
          { id: 'health',          url: `${B}/health`,                                            need: ['status','app'] },
          { id: 'quote',           url: `${B}/quote/MSFT`,       allowedStatus:[200,404,502],     need: [] },
          { id: 'history',         url: `${B}/history/MSFT?period=1mo`, allowedStatus:[200,404,502], need: [] },
          { id: 'technicals',      url: `${B}/technicals/MSFT`,  allowedStatus:[200,404,422,502], need: [] },
          { id: 'cache-status',    url: `${B}/cache-status`,                                      need: ['tradingDate'] },
          { id: 'analyze',         url: `${B}/analyze`, method:'POST', body:{ticker:'MSFT'}, allowedStatus:[200,400,502], need:[] },
          { id: 'compare',         url: `${B}/compare`, method:'POST', body:{tickers:['MSFT','AAPL']}, allowedStatus:[200,400,502], need:[] },
        ];
      },
    },
    {
      name: 'NEWSROOM', bPort: 5003, fPort: 3003,
      serverPath:   path.join(root, 'newsroom/server.js'),
      frontendPath: path.join(root, 'newsroom/frontend'),
      healthUrl:    'http://localhost:5003/api/news/health',
      envPort:      '5003',
      tests: () => {
        const B = 'http://localhost:5003/api/news';
        return [
          { id: 'health',        url: `${B}/health`,                            need: ['status','app'] },
          { id: 'cache-status',  url: `${B}/cache-status`,                      need: ['tradingDate'] },
          { id: 'global-news',   url: `${B}/global`,      allowedStatus:[200,502], need: [] },
          { id: 'sector-tech',   url: `${B}/sector/Technology`, allowedStatus:[200,502], need: [] },
          { id: 'ticker-msft',   url: `${B}/ticker/MSFT`, allowedStatus:[200,502], need: [] },
          { id: 'trending',      url: `${B}/trending`,    allowedStatus:[200,502], need: [] },
        ];
      },
    },
  ];
}

// ── Run tests in parallel ─────────────────────────────────────────────────────
async function runTests(testDefs) {
  const results = await Promise.all(testDefs.map(testEndpoint));
  return results;
}

// ── Verify one project (awaited in parallel at top level) ────────────────────
async function verifyProject(project) {
  const log = [];
  const emit = (s) => { log.push(s); };

  emit(`\n${'═'.repeat(60)}`);
  emit(`  ${B(C(project.name))}  :${project.bPort} → :${project.fPort}`);
  emit('═'.repeat(60));

  // ── Load server module ────────────────────────────────────────────────────
  // Set port env before require so the module picks it up
  process.env.BACKEND_PORT = project.envPort;
  let alreadyUp = false;
  try {
    const ping = await httpGet(project.healthUrl, 1000);
    if (ping.status === 200) alreadyUp = true;
  } catch {}

  if (!alreadyUp) {
    try { require(project.serverPath); }
    catch (e) {
      emit(`  ${R('Server load error:')} ${e.message}`);
      return { project, backendOk: false, tests: [], buildOk: false, log };
    }
  } else {
    emit(`  ${Y('Already running on :' + project.bPort)}`);
  }

  // ── Wait for ready ────────────────────────────────────────────────────────
  emit(`  Waiting for health…`);
  const { ok: backendOk, ms } = await waitHealth(project.healthUrl, project.name, 120000);
  if (!backendOk) {
    emit(`  ${R('TIMEOUT — backend did not become ready in 120s')}`);
    return { project, backendOk: false, tests: [], buildOk: false, log };
  }
  emit(`  ${G(`✓ Backend ready in ${(ms/1000).toFixed(1)}s`)}`);

  // ── Run all endpoint tests in parallel ────────────────────────────────────
  emit(`\n  ${B('Pre-flight tests')} (parallel)`);
  const testDefs = project.tests();
  const testResults = await runTests(testDefs);

  let passed = 0;
  for (const r of testResults) {
    if (r.pass) {
      emit(`  ${G('PASS')}  ${pad(r.id, 20)} ${D(r.elapsed + 'ms')}`);
      passed++;
    } else {
      emit(`  ${R('FAIL')}  ${pad(r.id, 20)} ${R('→ ' + r.reason)}`);
    }
  }
  emit(`  → ${passed}/${testDefs.length} passed`);

  return {
    project,
    backendOk,
    backendMs: ms,
    tests: testResults,
    passed,
    total: testDefs.length,
    buildOk: false, // will be set by parallel build step
    log,
  };
}

// ── Main — all parallel ───────────────────────────────────────────────────────
(async () => {
  const T_START = Date.now();
  const projects = makeProjects();

  console.log(B('\n╔══════════════════════════════════════════════════════════╗'));
  console.log(B('║  PLATFORM VERIFY v2 — ALL PARALLEL                      ║'));
  console.log(B('╚══════════════════════════════════════════════════════════╝\n'));
  console.log(D('  Starting all 3 backends simultaneously + parallel builds…\n'));

  // ── PHASE 1: Start all backends in parallel + kick off builds in parallel ──
  // Backends load via require() — they're synchronous to load but async to serve
  // We interleave: load all 3, then wait for all 3 health checks simultaneously
  const PROJECTS = projects;

  // Load all 3 server modules immediately (non-blocking — they just call app.listen)
  // Use setImmediate between each to allow event loop to breathe
  process.env.BACKEND_PORT = PROJECTS[0].envPort;
  try { require(PROJECTS[0].serverPath); } catch (e) { console.error(R(`FUNDA load error: ${e.message}`)); }

  await new Promise(r => setImmediate(r)); // yield

  process.env.BACKEND_PORT = PROJECTS[1].envPort;
  try { require(PROJECTS[1].serverPath); } catch (e) { console.error(R(`ANALYZER load error: ${e.message}`)); }

  await new Promise(r => setImmediate(r)); // yield

  process.env.BACKEND_PORT = PROJECTS[2].envPort;
  try { require(PROJECTS[2].serverPath); } catch (e) { console.error(R(`NEWSROOM load error: ${e.message}`)); }

  // ── PHASE 2: All 3 health checks + all 3 builds run simultaneously ──────────
  console.log(D('  Waiting for all 3 health checks + running builds in parallel…\n'));

  const [
    [h1, h2, h3],
    [b1, b2, b3],
  ] = await Promise.all([
    // Health checks in parallel
    Promise.all(PROJECTS.map(p => waitHealth(p.healthUrl, p.name, 120000))),
    // Frontend builds in parallel (child processes — don't block event loop)
    Promise.all(PROJECTS.map(p => buildFrontend(p.frontendPath, p.name))),
  ]);

  const healthResults = [h1, h2, h3];
  const buildResults  = [b1, b2, b3];

  // ── PHASE 3: Run all endpoint tests (all 3 projects in parallel) ────────────
  const allTestSuites = await Promise.all(
    PROJECTS.map(async (p, i) => {
      if (!healthResults[i].ok) {
        return { project: p, passed: 0, total: p.tests().length, testResults: [] };
      }
      const testDefs = p.tests();
      const testResults = await Promise.all(testDefs.map(testEndpoint));
      return { project: p, passed: testResults.filter(r => r.pass).length, total: testDefs.length, testResults };
    })
  );

  // ── Print per-project results ──────────────────────────────────────────────
  for (let i = 0; i < PROJECTS.length; i++) {
    const p    = PROJECTS[i];
    const h    = healthResults[i];
    const bld  = buildResults[i];
    const ts   = allTestSuites[i];
    const name = C(B(p.name));

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  ${name}  :${p.bPort} (backend)  :${p.fPort} (frontend)`);
    console.log('═'.repeat(60));

    console.log(`  Backend: ${h.ok ? G(`✓ Ready in ${(h.ms/1000).toFixed(1)}s`) : R('✗ TIMEOUT')}`);
    console.log(`  Build:   ${bld.ok ? G(`✓ ${(bld.elapsed/1000).toFixed(1)}s`) : R(`✗ FAILED — ${bld.error?.slice(0,120)||''}`)}`);

    if (h.ok) {
      console.log(`  Tests:`);
      for (const r of ts.testResults) {
        console.log(`    ${r.pass ? G('PASS') : R('FAIL')}  ${pad(r.id,20)} ${r.pass ? D(r.elapsed+'ms') : R('→ '+r.reason)}`);
      }
      console.log(`  → ${ts.passed}/${ts.total} passed`);
    }
  }

  // ── Final report table ─────────────────────────────────────────────────────
  const totalMs = Date.now() - T_START;

  console.log(`\n\n${'═'.repeat(100)}`);
  console.log(B('  FINAL VERIFICATION REPORT'));
  console.log(`  Total time: ${(totalMs/1000).toFixed(1)}s`);
  console.log('═'.repeat(100));
  console.log(`\n  ${pad('Sub-Project',14)} ${pad('Backend',20)} ${pad('Pre-flight',20)} ${pad('Build',16)} Frontend`);
  console.log(`  ${'-'.repeat(90)}`);

  let allPass = true;
  const mdRows = [];

  for (let i = 0; i < PROJECTS.length; i++) {
    const p   = PROJECTS[i];
    const h   = healthResults[i];
    const bld = buildResults[i];
    const ts  = allTestSuites[i];

    const backendStr  = h.ok   ? G(`✅ PASS (${(h.ms/1000).toFixed(1)}s)`)     : R('❌ TIMEOUT');
    const testsStr    = h.ok   ? (ts.passed === ts.total ? G(`✅ ${ts.passed}/${ts.total} PASS`) : R(`❌ ${ts.passed}/${ts.total}`)) : R('❌ N/A');
    const buildStr    = bld.ok ? G('✅ SUCCESS')                                : R('❌ FAILED');
    const frontendStr = bld.ok ? G(`http://localhost:${p.bPort}`)               : Y(`http://localhost:${p.fPort} (dev)`);

    console.log(`  ${pad(p.name,14)} ${pad(backendStr,36)} ${pad(testsStr,30)} ${pad(buildStr,22)} ${frontendStr}`);

    if (!h.ok || !bld.ok || ts.passed < ts.total) allPass = false;

    // Strip ANSI for markdown
    const s = x => x.replace(/\x1b\[[0-9;]*m/g, '');
    mdRows.push(`| ${p.name} | ${s(backendStr)} | ${s(testsStr)} | ${s(buildStr)} | ${s(frontendStr)} |`);
  }

  console.log(B('\n  Markdown:\n'));
  console.log('  | Sub-Project | Backend Health | Pre-flight Tests | Build Status | Frontend URL |');
  console.log('  |---|---|---|---|---|');
  mdRows.forEach(r => console.log('  ' + r));

  console.log('');
  if (allPass) {
    console.log(G(B('  ✓ ALL SUB-PROJECTS VERIFIED\n')));
    console.log(D('  Servers stay running. Open in browser:'));
    PROJECTS.forEach(p => console.log(C(`    http://localhost:${p.bPort}  (${p.name})`)));
    process.exit(0);
  } else {
    console.log(R(B('  ✗ SOME CHECKS FAILED\n')));
    process.exit(1);
  }
})();
