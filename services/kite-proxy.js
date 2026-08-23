/**
 * services/kite-proxy.js — tradingview-economy
 * Node.js proxy that calls kite_bridge.py via spawnSync and returns parsed JSON.
 * All Kite Connect calls are routed through here so React frontend never
 * imports Node.js-only modules.
 */
'use strict';

const { spawnSync } = require('child_process');
const path  = require('path');

const PYTHON = process.env.PYTHON_PATH ||
               'C:\\Users\\SaurabhSolanki\\AppData\\Local\\Programs\\Python\\Python312\\python.exe';

const BRIDGE = path.join(__dirname, 'kite_bridge.py');

/**
 * Run kite_bridge.py with given command and args.
 * @param {string} command
 * @param {string[]} args
 * @returns {{ success: boolean, data?: any, error?: string, loginUrl?: string }}
 */
function runBridge(command, args = []) {
  const result = spawnSync(PYTHON, [BRIDGE, command, ...args], {
    encoding: 'utf8',
    timeout: 15000,
    env: { ...process.env }
  });

  if (result.error) {
    return { success: false, error: `Process error: ${result.error.message}`, code: 'SPAWN_ERROR' };
  }
  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    // stdout may contain our JSON error even on exit code 1
    try {
      const parsed = JSON.parse((result.stdout || '').trim());
      return parsed;
    } catch (_) {
      return { success: false, error: stderr || 'Bridge exited with non-zero status', code: 'BRIDGE_ERROR' };
    }
  }

  try {
    return JSON.parse((result.stdout || '').trim());
  } catch (e) {
    return { success: false, error: `JSON parse error: ${e.message}`, raw: result.stdout, code: 'PARSE_ERROR' };
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Live quote for a single symbol (e.g. 'HDFCBANK') */
function getQuote(symbol) {
  return runBridge('quote', [symbol]);
}

/** Bulk quotes — array of symbols */
function getQuotes(symbols) {
  return runBridge('quotes', [symbols.join(',')]);
}

/** Portfolio holdings */
function getHoldings() {
  return runBridge('holdings', []);
}

/** Open positions (day + net) */
function getPositions() {
  return runBridge('positions', []);
}

/** Last traded prices only */
function getLTP(symbols) {
  return runBridge('ltp', [symbols.join(',')]);
}

/** OHLC snapshot */
function getOHLC(symbols) {
  return runBridge('ohlc', [symbols.join(',')]);
}

/** Full instrument list for exchange ('NSE' / 'BSE') */
function getInstruments(exchange = 'NSE') {
  return runBridge('instruments', [exchange]);
}

module.exports = { getQuote, getQuotes, getHoldings, getPositions, getLTP, getOHLC, getInstruments, runBridge };
