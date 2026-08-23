#!/usr/bin/env python3
"""
services/kite_bridge.py — tradingview-economy
Zerodha Kite Connect bridge: fetches live Indian market data
and outputs JSON to stdout for the Node.js proxy to consume.

Usage (called by Node.js via child_process.spawnSync):
  python kite_bridge.py <command> [args...]

Commands:
  quote     SYMBOL         — live quote for a single symbol
  quotes    SYM1,SYM2,...  — bulk quotes (max 500)
  holdings                 — portfolio holdings
  positions                — open positions (day + net)
  instruments exchange     — full instrument dump for NSE/BSE
  ltp       SYM1,SYM2,...  — last traded price only
  ohlc      SYM1,SYM2,...  — OHLC snapshot

Authentication:
  Kite requires a two-step login. On first run, set:
    KITE_API_KEY     in .env
    KITE_API_SECRET  in .env
    KITE_ACCESS_TOKEN in .env  (generated daily via login flow)

  Access token expires daily at 6 AM IST. The Node.js server is
  responsible for refreshing it and updating .env / env var.
"""

import sys
import os
import json

# ── Load env ────────────────────────────────────────────────────────────────
script_dir = os.path.dirname(os.path.abspath(__file__))
project_dir = os.path.join(script_dir, '..')

def load_dotenv(path):
    """Minimal .env loader (no pip dep needed)."""
    env_path = os.path.join(path, '.env')
    if not os.path.exists(env_path):
        return
    with open(env_path, 'r') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

load_dotenv(project_dir)

API_KEY      = os.environ.get('KITE_API_KEY', '')
API_SECRET   = os.environ.get('KITE_API_SECRET', '')
ACCESS_TOKEN = os.environ.get('KITE_ACCESS_TOKEN', '')

# ── Error helper ─────────────────────────────────────────────────────────────
def err(msg, code='KITE_ERROR'):
    print(json.dumps({'success': False, 'error': msg, 'code': code}))
    sys.exit(1)

# ── Try to import kiteconnect ─────────────────────────────────────────────────
try:
    from kiteconnect import KiteConnect
except ImportError:
    err('kiteconnect not installed. Run: pip install kiteconnect', 'IMPORT_ERROR')

# ── Init kite client ─────────────────────────────────────────────────────────
if not API_KEY:
    err('KITE_API_KEY not set in .env', 'AUTH_ERROR')

kite = KiteConnect(api_key=API_KEY)

if ACCESS_TOKEN:
    kite.set_access_token(ACCESS_TOKEN)
else:
    # Return login URL so Node.js can surface it to the user
    print(json.dumps({
        'success': False,
        'error': 'KITE_ACCESS_TOKEN not set',
        'loginUrl': kite.login_url(),
        'code': 'NO_ACCESS_TOKEN'
    }))
    sys.exit(1)

# ── Command handlers ──────────────────────────────────────────────────────────

def cmd_quote(args):
    if not args:
        err('quote requires SYMBOL argument')
    symbol = args[0].upper()
    exchange = 'NSE' if ':' not in symbol else symbol.split(':')[0]
    sym = symbol if ':' in symbol else f'NSE:{symbol}'
    data = kite.ltp([sym])
    quote_data = kite.quote([sym])
    result = quote_data.get(sym, {})
    print(json.dumps({'success': True, 'symbol': symbol, 'data': result}))


def cmd_quotes(args):
    if not args:
        err('quotes requires comma-separated symbols')
    raw_syms = [s.strip().upper() for s in args[0].split(',')]
    syms = [f'NSE:{s}' if ':' not in s else s for s in raw_syms]
    data = kite.quote(syms)
    print(json.dumps({'success': True, 'count': len(data), 'data': data}))


def cmd_holdings(args):
    data = kite.holdings()
    # Enrich with key metrics
    enriched = []
    for h in data:
        enriched.append({
            'symbol':          h.get('tradingsymbol'),
            'exchange':        h.get('exchange'),
            'quantity':        h.get('quantity'),
            'averagePrice':    h.get('average_price'),
            'lastPrice':       h.get('last_price'),
            'pnl':             h.get('pnl'),
            'dayChange':       h.get('day_change'),
            'dayChangePct':    h.get('day_change_percentage'),
            'isin':            h.get('isin'),
            'product':         h.get('product'),
            'currentValue':    round(h.get('quantity', 0) * h.get('last_price', 0), 2),
            'investedValue':   round(h.get('quantity', 0) * h.get('average_price', 0), 2),
            'returnPct':       round(((h.get('last_price', 0) - h.get('average_price', 0)) / max(h.get('average_price', 1), 0.01)) * 100, 2)
        })
    print(json.dumps({'success': True, 'count': len(enriched), 'data': enriched}))


def cmd_positions(args):
    data = kite.positions()
    print(json.dumps({'success': True, 'data': {
        'day': data.get('day', []),
        'net': data.get('net', [])
    }}))


def cmd_ltp(args):
    if not args:
        err('ltp requires comma-separated symbols')
    raw_syms = [s.strip().upper() for s in args[0].split(',')]
    syms = [f'NSE:{s}' if ':' not in s else s for s in raw_syms]
    data = kite.ltp(syms)
    simplified = {k: v.get('last_price') for k, v in data.items()}
    print(json.dumps({'success': True, 'data': simplified}))


def cmd_ohlc(args):
    if not args:
        err('ohlc requires comma-separated symbols')
    raw_syms = [s.strip().upper() for s in args[0].split(',')]
    syms = [f'NSE:{s}' if ':' not in s else s for s in raw_syms]
    data = kite.ohlc(syms)
    print(json.dumps({'success': True, 'data': data}))


def cmd_instruments(args):
    exchange = args[0].upper() if args else 'NSE'
    data = kite.instruments(exchange)
    # Return only equities to keep payload small
    equities = [
        {'symbol': i['tradingsymbol'], 'name': i.get('name'), 'isin': i.get('isin'),
         'lot_size': i.get('lot_size'), 'instrument_type': i.get('instrument_type')}
        for i in data if i.get('instrument_type') == 'EQ'
    ]
    print(json.dumps({'success': True, 'exchange': exchange, 'count': len(equities), 'data': equities[:500]}))


# ── Dispatch ──────────────────────────────────────────────────────────────────
COMMANDS = {
    'quote':       cmd_quote,
    'quotes':      cmd_quotes,
    'holdings':    cmd_holdings,
    'positions':   cmd_positions,
    'ltp':         cmd_ltp,
    'ohlc':        cmd_ohlc,
    'instruments': cmd_instruments
}

if __name__ == '__main__':
    if len(sys.argv) < 2:
        err('Usage: kite_bridge.py <command> [args...]', 'USAGE_ERROR')
    command = sys.argv[1].lower()
    handler = COMMANDS.get(command)
    if not handler:
        err(f'Unknown command: {command}. Valid: {", ".join(COMMANDS.keys())}', 'UNKNOWN_CMD')
    try:
        handler(sys.argv[2:])
    except Exception as exc:
        err(str(exc), 'RUNTIME_ERROR')
