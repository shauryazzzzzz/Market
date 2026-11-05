/**
 * services/kite-proxy.js — tradingview-economy
 * Node.js proxy that calls kite_bridge.py via spawnSync and returns parsed JSON.
 * All Kite Connect calls are routed through here so React frontend never
 * imports Node.js-only modules.
 */
'use strict';

const { spawnSync } = require('child_process');
const path  = require('path');

// ── Input sanitization ────────────────────────────────────────────────────────
// NSE/BSE symbols are 1–20 uppercase alphanumeric chars, hyphens, and dots.
// Exchange names are 'NSE' or 'BSE'. Reject anything else before it reaches Python.
const SYMBOL_RE   = /^[A-Z0-9\-\.]{1,20}$/;
const EXCHANGE_RE = /^(NSE|BSE)$/;

/**
 * Validate and normalise a single trading symbol.
 * Throws a TypeError if the value is invalid.
 */
function validateSymbol(sym) {
  const s = String(sym || '').trim().toUpperCase();
  if (!SYMBOL_RE.test(s)) throw new TypeError(`Invalid symbol: "${sym}"`);
  return s;
}

/**
 * Validate a comma-joined list of symbols (e.g. "RELIANCE,TCS").
 * Returns a cleaned array. Throws TypeError on any bad entry.
 */
function validateSymbols(raw) {
  return String(raw || '').split(',').filter(Boolean).map(validateSymbol);
}

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
  try { symbol = validateSymbol(symbol); } catch (e) { return { success: false, error: e.message, code: 'INVALID_INPUT' }; }
  return runBridge('quote', [symbol]);
}

/** Bulk quotes — array of symbols */
function getQuotes(symbols) {
  try { symbols = validateSymbols(symbols.join(',')); } catch (e) { return { success: false, error: e.message, code: 'INVALID_INPUT' }; }
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
  try { symbols = validateSymbols(symbols.join(',')); } catch (e) { return { success: false, error: e.message, code: 'INVALID_INPUT' }; }
  return runBridge('ltp', [symbols.join(',')]);
}

/** OHLC snapshot */
function getOHLC(symbols) {
  try { symbols = validateSymbols(symbols.join(',')); } catch (e) { return { success: false, error: e.message, code: 'INVALID_INPUT' }; }
  return runBridge('ohlc', [symbols.join(',')]);
}

/** Full instrument list for exchange ('NSE' / 'BSE') */
function getInstruments(exchange = 'NSE') {
  const ex = String(exchange || 'NSE').trim().toUpperCase();
  if (!EXCHANGE_RE.test(ex)) return { success: false, error: `Invalid exchange: "${exchange}"`, code: 'INVALID_INPUT' };
  return runBridge('instruments', [ex]);
}

module.exports = { getQuote, getQuotes, getHoldings, getPositions, getLTP, getOHLC, getInstruments, runBridge };
