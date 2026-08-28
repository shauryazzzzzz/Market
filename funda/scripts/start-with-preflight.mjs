/**
 * FUNDA Startup Script
 * ─────────────────────
 * 1. Starts the backend Express server (funda/server.js)
 * 2. Waits for it to be ready (polls /api/funda/health)
 * 3. Runs the full pre-flight endpoint test suite
 * 4. Exits 0 (all pass) or 1 (failures found)
 *
 * Usage:  node scripts/start-with-preflight.mjs
 *   Or add to package.json scripts:  "preflight": "node scripts/start-with-preflight.mjs"
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.resolve(__dirname, '..', 'server.js');
const preflightPath = path.resolve(__dirname, 'preflight-check.mjs');
const PORT = process.env.BACKEND_PORT || 5001;
const BASE = `http://localhost:${PORT}`;

// ANSI helpers
const C = {
  green:  s => `\x1b[32m${s}\x1b[0m`,
  red:    s => `\x1b[31m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  cyan:   s => `\x1b[36m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
};

async function waitForBackend(maxWaitMs = 120_000) {
  const start = Date.now();
  console.log(C.dim(`Waiting for backend on ${BASE}/api/funda/health…`));
  while (Date.now() - start < maxWaitMs) {
    try {
      const resp = await fetch(`${BASE}/api/funda/health`, { signal: AbortSignal.timeout(3000) });
      if (resp.ok) {
        const d = await resp.json();
        if (d.indexReady) {
          console.log(C.green(`✓ Backend ready — ${d.filesIndexed} files indexed`));
          return true;
        }
        process.stdout.write('.');
      }
    } catch { /* not ready yet */ }
    await new Promise(r => setTimeout(r, 1500));
  }
  return false;
}

async function runPreflight() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [preflightPath, BASE], {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..'),
    });
    child.on('close', code => resolve(code === 0));
  });
}

async function main() {
  console.log(C.bold('\n── FUNDA Pre-flight + Startup ─────────────────────────────'));

  // Start server as child process
  console.log(C.dim(`\nStarting backend: node ${serverPath}`));
  const server = spawn(process.execPath, [serverPath], {
    stdio: 'inherit',
    env: { ...process.env },
    cwd: path.resolve(__dirname, '..'),
  });

  server.on('error', err => {
    console.error(C.red(`Failed to start server: ${err.message}`));
    process.exit(1);
  });

  // Wait for index to be ready
  const ready = await waitForBackend();
  if (!ready) {
    console.error(C.red('\n✗ Backend did not become ready within 120 seconds'));
    server.kill();
    process.exit(1);
  }

  // Give pre-warm a moment to finish
  await new Promise(r => setTimeout(r, 2000));

  // Run pre-flight checks
  console.log(C.bold('\n── Running pre-flight endpoint tests ──────────────────────'));
  const allPassed = await runPreflight();

  if (!allPassed) {
    console.error(C.red('\n✗ Pre-flight checks failed. Fix backend before starting frontend.\n'));
    server.kill();
    process.exit(1);
  }

  console.log(C.green(C.bold('\n✓ All pre-flight checks passed.\n')));
  console.log(C.dim('Backend is running. Start frontend with:'));
  console.log(C.cyan('  cd frontend && npm run dev\n'));

  // Keep server running
  process.on('SIGINT', () => { server.kill(); process.exit(0); });
  process.on('SIGTERM', () => { server.kill(); process.exit(0); });
}

main().catch(err => {
  console.error(C.red(`Startup failed: ${err.message}`));
  process.exit(1);
});
