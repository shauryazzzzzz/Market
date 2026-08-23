/**
 * TechnicalPage.jsx — Technical Analysis
 * Fetches REAL OHLCV from /api/stock/price-history, sends to /api/technical/analyse
 * Falls back to synthetic candles if no symbol entered (demo mode)
 */
import { useState, useCallback } from 'react'
import axios from 'axios'
import { Loading, ErrorBox, Signal } from '../components/shared'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell } from 'recharts'

const TT_STYLE = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }
const PERIODS = ['1m', '3m', '6m', '1y', '3y', '5y']

// Generate synthetic OHLCV for demo-only mode
function generateCandles(basePrice = 1000, n = 100) {
  const candles = []
  let price = basePrice
  for (let i = 0; i < n; i++) {
    const change = (Math.random() - 0.48) * price * 0.025
    const open   = price
    price += change
    const close  = price
    const high   = Math.max(open, close) * (1 + Math.random() * 0.01)
    const low    = Math.min(open, close) * (1 - Math.random() * 0.01)
    const volume = Math.round(100000 + Math.random() * 900000)
    const date   = new Date(Date.now() - (n - i) * 86400000).toISOString().split('T')[0]
    candles.push({ open, high, low, close, volume, date })
  }
  return candles
}

function PriceChart({ candles, indicators, isLive }) {
  if (!candles?.length) return null
  const chartData = candles.map(c => ({
    date:  c.date,
    close: parseFloat((c.close || 0).toFixed(2)),
    volume: c.volume,
  }))
  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData}>
          <XAxis dataKey="date" tick={{ fill: 'var(--muted)', fontSize: 10 }} tickFormatter={d => d?.slice(5)} />
          <YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} domain={['auto', 'auto']} />
          <Tooltip contentStyle={TT_STYLE} formatter={v => [`₹${v}`, 'Close']} />
          <Line type="monotone" dataKey="close" stroke="var(--primary)" dot={false} strokeWidth={2} />
          {indicators?.movingAverages?.sma20 && (
            <ReferenceLine y={indicators.movingAverages.sma20} stroke="var(--warning)" strokeDasharray="4 2"
              label={{ value: `SMA20 ₹${indicators.movingAverages.sma20?.toFixed(0)}`, fill: 'var(--warning)', fontSize: 10, position: 'insideTopRight' }} />
          )}
          {indicators?.movingAverages?.sma50 && (
            <ReferenceLine y={indicators.movingAverages.sma50} stroke="var(--accent)" strokeDasharray="4 2"
              label={{ value: `SMA50 ₹${indicators.movingAverages.sma50?.toFixed(0)}`, fill: 'var(--accent)', fontSize: 10, position: 'insideTopLeft' }} />
          )}
          {indicators?.bollingerBands && (
            <>
              <ReferenceLine y={indicators.bollingerBands.upper} stroke="rgba(63,185,80,.5)" strokeDasharray="2 2" />
              <ReferenceLine y={indicators.bollingerBands.lower} stroke="rgba(248,81,73,.5)" strokeDasharray="2 2" />
            </>
          )}
        </LineChart>
      </ResponsiveContainer>
      <ResponsiveContainer width="100%" height={60}>
        <BarChart data={chartData}>
          <XAxis dataKey="date" hide />
          <YAxis hide />
          <Bar dataKey="volume" radius={[1,1,0,0]}>
            {chartData.map((_, i) => <Cell key={i} fill="rgba(47,129,247,.3)" />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {isLive && (
        <div style={{ fontSize: 11, color: 'var(--positive)', marginTop: 6, textAlign: 'right', fontWeight: 700 }}>
          ● Live OHLCV — {candles.length} candles from Yahoo Finance
        </div>
      )}
    </div>
  )
}

function IndicatorPanel({ analysis }) {
  if (!analysis) return null
  const { indicators: ind, confluence, range52w } = analysis

  const maRows = [
    ['SMA 20',  ind.movingAverages?.sma20,  analysis.price],
    ['SMA 50',  ind.movingAverages?.sma50,  analysis.price],
    ['SMA 200', ind.movingAverages?.sma200, analysis.price],
    ['EMA 20',  ind.movingAverages?.ema20,  analysis.price],
    ['EMA 50',  ind.movingAverages?.ema50,  analysis.price],
    ['VWAP',    ind.movingAverages?.vwap,   analysis.price],
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Confluence signal */}
      <div className="card" style={{ textAlign: 'center' }}>
        <div className="card-label" style={{ marginBottom: 8 }}>AI Signal Confluence</div>
        <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 4 }}>
          <Signal rating={confluence?.recommendation} />
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>{confluence?.confidence}% confidence</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="metric-pos" style={{ fontWeight: 700 }}>{confluence?.bullScore?.toFixed(1)}</div>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>Bull score</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="metric-neg" style={{ fontWeight: 700 }}>{confluence?.bearScore?.toFixed(1)}</div>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>Bear score</div>
          </div>
        </div>
      </div>

      {/* 52-week range */}
      {range52w && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 10 }}>52-Week Range</div>
          <div className="stat-row">
            <span className="stat-label">52W High</span>
            <span className="metric-neg stat-val">₹{range52w.high}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Current</span>
            <span className="stat-val" style={{ fontWeight: 800 }}>₹{analysis.price?.toFixed(2)}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">52W Low</span>
            <span className="metric-pos stat-val">₹{range52w.low}</span>
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Position in range</div>
            <div className="progress-track">
              <div className="progress-fill" style={{
                width: `${Math.max(0, Math.min(100, ((analysis.price - range52w.low) / (range52w.high - range52w.low)) * 100)).toFixed(0)}%`,
                background: 'var(--primary)'
              }} />
            </div>
          </div>
        </div>
      )}

      {/* Moving averages */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 10 }}>Moving Averages</div>
        {maRows.filter(r => r[1] != null).map(([label, val, price]) => (
          <div className="stat-row" key={label}>
            <span className="stat-label">{label}</span>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span className="stat-val">₹{val?.toFixed(2)}</span>
              <span className={price > val ? 'metric-pos' : 'metric-neg'} style={{ fontSize: 11 }}>{price > val ? '▲' : '▼'}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Momentum */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 10 }}>Momentum</div>
        <div className="stat-row">
          <span className="stat-label">RSI (14)</span>
          <span className={ind.rsi > 70 ? 'metric-neg stat-val' : ind.rsi < 30 ? 'metric-pos stat-val' : 'stat-val'}>{ind.rsi?.toFixed(1)} — {ind.rsiSignal}</span>
        </div>
        {ind.macd && (
          <>
            <div className="stat-row">
              <span className="stat-label">MACD Line</span>
              <span className={ind.macd.macdLine >= 0 ? 'metric-pos stat-val' : 'metric-neg stat-val'}>{ind.macd.macdLine?.toFixed(3)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Signal Line</span>
              <span className="stat-val">{ind.macd.signalLine?.toFixed(3)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Histogram</span>
              <span className={ind.macd.histogram >= 0 ? 'metric-pos stat-val' : 'metric-neg stat-val'}>{ind.macd.histogram?.toFixed(3)}</span>
            </div>
          </>
        )}
        {ind.trendStrength && (
          <>
            <div className="stat-row">
              <span className="stat-label">ADX</span>
              <span className="stat-val">{ind.trendStrength.adx} — {ind.trendStrength.trend}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">+DI / -DI</span>
              <span className="stat-val">{ind.trendStrength.plusDI} / {ind.trendStrength.minusDI}</span>
            </div>
          </>
        )}
      </div>

      {/* Bollinger Bands */}
      {ind.bollingerBands && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 10 }}>Bollinger Bands (20,2)</div>
          <div className="stat-row"><span className="stat-label">Upper</span><span className="metric-neg stat-val">₹{ind.bollingerBands.upper?.toFixed(2)}</span></div>
          <div className="stat-row"><span className="stat-label">Middle</span><span className="stat-val">₹{ind.bollingerBands.middle?.toFixed(2)}</span></div>
          <div className="stat-row"><span className="stat-label">Lower</span><span className="metric-pos stat-val">₹{ind.bollingerBands.lower?.toFixed(2)}</span></div>
          <div className="stat-row"><span className="stat-label">%B</span><span className="stat-val">{(ind.bollingerBands.pctB * 100)?.toFixed(1)}%</span></div>
        </div>
      )}

      {/* Support & Resistance */}
      {ind.supportResistance && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 10 }}>Support & Resistance</div>
          {ind.supportResistance.resistances?.map((r, i) => (
            <div className="stat-row" key={`r${i}`}>
              <span className="stat-label">Resistance {i+1}</span>
              <span className="metric-neg stat-val">₹{r?.toFixed(2)}</span>
            </div>
          ))}
          <div className="stat-row">
            <span className="stat-label">Current Price</span>
            <span className="stat-val" style={{ fontWeight: 800 }}>₹{analysis.price?.toFixed(2)}</span>
          </div>
          {ind.supportResistance.supports?.map((s, i) => (
            <div className="stat-row" key={`s${i}`}>
              <span className="stat-label">Support {i+1}</span>
              <span className="metric-pos stat-val">₹{s?.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Volume */}
      {ind.volume && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 10 }}>Volume Analysis</div>
          <div className="stat-row"><span className="stat-label">Avg Volume</span><span className="stat-val">{(ind.volume.avgVolume/1000).toFixed(0)}K</span></div>
          <div className="stat-row"><span className="stat-label">Last Volume</span><span className="stat-val">{(ind.volume.lastVolume/1000).toFixed(0)}K</span></div>
          <div className="stat-row">
            <span className="stat-label">Volume Ratio</span>
            <span className={ind.volume.volumeRatio > 1.5 ? 'metric-pos stat-val' : ind.volume.volumeRatio < 0.5 ? 'metric-neg stat-val' : 'stat-val'}>{ind.volume.volumeRatio}x — {ind.volume.volumeSignal}</span>
          </div>
        </div>
      )}

      {/* Candlestick Patterns */}
      {ind.candlestickPatterns?.length > 0 && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 10 }}>Candlestick Patterns</div>
          {ind.candlestickPatterns.map((p, i) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid rgba(48,54,61,.5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</span>
                <span className={p.signal === 'bullish' ? 'metric-pos' : p.signal === 'bearish' ? 'metric-neg' : 'metric-neu'} style={{ fontSize: 12 }}>{p.signal}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{p.description}</div>
            </div>
          ))}
        </div>
      )}

      {/* Signals */}
      {confluence?.signals?.length > 0 && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 10 }}>Signal Breakdown</div>
          {confluence.signals.map((s, i) => (
            <div className="stat-row" key={i}>
              <span className="stat-label">{s.indicator}</span>
              <span className={s.signal === 'bullish'||s.signal==='confirmation' ? 'metric-pos' : s.signal === 'bearish'||s.signal==='warning' ? 'metric-neg' : 'metric-neu'}
                style={{ fontSize: 12 }}>{s.signal}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function TechnicalPage() {
  const [symbol,   setSymbol]   = useState('')
  const [period,   setPeriod]   = useState('1y')
  const [analysis, setAnalysis] = useState(null)
  const [candles,  setCandles]  = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [isLive,   setIsLive]   = useState(false)

  const runAnalysis = useCallback(async () => {
    setLoading(true); setError(null); setAnalysis(null); setIsLive(false)
    let ohlcv = null

    // 1. Try real OHLCV from Yahoo Finance
    if (symbol.trim()) {
      try {
        const yfSym = symbol.trim().toUpperCase() + (symbol.includes('.') ? '' : '.NS')
        const r = await axios.get(`/api/stock/price-history?symbol=${encodeURIComponent(yfSym)}&period=${period}`, { timeout: 15000 })
        if (r.data?.success && r.data?.data?.length >= 20) {
          ohlcv = r.data.data
          setIsLive(true)
        }
      } catch (_) { /* fall through to demo */ }
    }

    // 2. Fallback: synthetic demo candles
    if (!ohlcv) {
      ohlcv = generateCandles(1000, 100)
      setIsLive(false)
    }

    setCandles(ohlcv)

    try {
      const r = await axios.post('/api/technical/analyse', {
        symbol: symbol || 'DEMO',
        candles: ohlcv,
      })
      if (r.data?.success) setAnalysis(r.data.data)
      else setError(r.data?.error || 'Analysis failed')
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }, [symbol, period])

  return (
    <div className="page">
      <div style={{ marginBottom: 20 }}>
        <div className="page-title">Technical Analysis</div>
        <div className="page-sub">Real OHLCV via Yahoo Finance · SMA · EMA · RSI · MACD · Bollinger Bands · Support/Resistance · Volume · Candlestick Patterns</div>
      </div>

      {/* Controls */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>NSE Symbol</div>
            <input className="input" placeholder="e.g. TCS, INFY, HDFCBANK" value={symbol}
              onChange={e => setSymbol(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runAnalysis()}
              style={{ width: 180 }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Period</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {PERIODS.map(p => (
                <button key={p} className={`btn btn-sm ${period === p ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setPeriod(p)}>{p}</button>
              ))}
            </div>
          </div>
          <button className="btn btn-primary" onClick={runAnalysis} disabled={loading}>
            {loading ? 'Analysing…' : 'Run Analysis'}
          </button>
          <div style={{ fontSize: 12, color: 'var(--muted)', alignSelf: 'center' }}>
            {symbol ? `Will fetch real candles for ${symbol.toUpperCase()}.NS` : 'Enter a symbol for live data — or run demo mode'}
          </div>
        </div>
      </div>

      {error && <ErrorBox msg={error} />}
      {loading && <Loading />}

      {analysis && !loading && (
        <div className="layout-sidebar">
          {/* Left: Chart */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-label">Price Action {isLive ? '● LIVE' : '◌ DEMO'}</div>
                  <div className="card-title">
                    {analysis.symbol || 'DEMO'} · {analysis.candleCount} candles · ₹{analysis.price?.toFixed(2)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span className="pill" style={{ background: 'rgba(139,148,158,.1)', color: 'var(--muted)' }}>52W H: ₹{analysis.range52w?.high}</span>
                  <span className="pill" style={{ background: 'rgba(139,148,158,.1)', color: 'var(--muted)' }}>52W L: ₹{analysis.range52w?.low}</span>
                </div>
              </div>
              <PriceChart candles={candles} indicators={analysis.indicators} isLive={isLive} />
            </div>
          </div>

          {/* Right: Indicators */}
          <IndicatorPanel analysis={analysis} />
        </div>
      )}

      {!analysis && !loading && !error && (
        <div className="loading" style={{ flexDirection: 'column', gap: 10, height: 280 }}>
          <div style={{ fontSize: 20 }}>📈</div>
          <div>Enter an NSE symbol (e.g. TCS) and click Run Analysis</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Fetches real OHLCV from Yahoo Finance · Computes SMA/EMA · RSI · MACD · Bollinger · S&R · ADX · Volume · Candlestick patterns</div>
        </div>
      )}
    </div>
  )
}
