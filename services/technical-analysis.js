/**
 * services/technical-analysis.js — tradingview-economy
 * Pure-JS technical analysis engine.
 * Inputs: array of OHLCV candles [ { open, high, low, close, volume, date } ]
 * Outputs: comprehensive indicator set + signal confluence + recommendation
 */
'use strict';

// ── Helpers ──────────────────────────────────────────────────────────────────
const avg = arr => arr.reduce((s, v) => s + v, 0) / arr.length;
const last = arr => arr[arr.length - 1];
const closes = candles => candles.map(c => c.close);
const highs   = candles => candles.map(c => c.high);
const lows    = candles => candles.map(c => c.low);
const volumes = candles => candles.map(c => c.volume || 0);

// ── Moving Averages ───────────────────────────────────────────────────────────

function sma(prices, period) {
  if (prices.length < period) return null;
  return avg(prices.slice(-period));
}

function ema(prices, period) {
  if (prices.length < period) return null;
  const k = 2 / (period + 1);
  let result = avg(prices.slice(0, period));
  for (let i = period; i < prices.length; i++) {
    result = prices[i] * k + result * (1 - k);
  }
  return result;
}

function vwap(candles) {
  let cumTPV = 0, cumVol = 0;
  for (const c of candles) {
    const tp = (c.high + c.low + c.close) / 3;
    cumTPV += tp * (c.volume || 1);
    cumVol += (c.volume || 1);
  }
  return cumVol > 0 ? cumTPV / cumVol : null;
}

// ── RSI ───────────────────────────────────────────────────────────────────────
function rsi(prices, period = 14) {
  if (prices.length <= period) return null;
  const changes = prices.slice(1).map((p, i) => p - prices[i]);
  let gains = 0, losses = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) gains += changes[i];
    else losses -= changes[i];
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period; i < changes.length; i++) {
    const g = changes[i] > 0 ? changes[i] : 0;
    const l = changes[i] < 0 ? -changes[i] : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// ── MACD ─────────────────────────────────────────────────────────────────────
function macd(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (prices.length < slowPeriod + signalPeriod) return null;
  const emaFast   = ema(prices, fastPeriod);
  const emaSlow   = ema(prices, slowPeriod);
  if (emaFast === null || emaSlow === null) return null;
  const macdLine  = emaFast - emaSlow;

  // Build MACD line history for signal calculation
  const macdHistory = [];
  for (let i = slowPeriod - 1; i < prices.length; i++) {
    const slice  = prices.slice(0, i + 1);
    const ef = ema(slice, fastPeriod);
    const es = ema(slice, slowPeriod);
    if (ef !== null && es !== null) macdHistory.push(ef - es);
  }
  const signalLine = ema(macdHistory, signalPeriod);
  const histogram  = signalLine !== null ? macdLine - signalLine : null;

  return { macdLine, signalLine, histogram };
}

// ── Bollinger Bands ───────────────────────────────────────────────────────────
function bollingerBands(prices, period = 20, stdDevMultiplier = 2) {
  if (prices.length < period) return null;
  const slice  = prices.slice(-period);
  const middle = avg(slice);
  const variance = slice.reduce((s, v) => s + Math.pow(v - middle, 2), 0) / period;
  const stdDev = Math.sqrt(variance);
  return {
    upper:  middle + stdDevMultiplier * stdDev,
    middle,
    lower:  middle - stdDevMultiplier * stdDev,
    bandwidth: (stdDevMultiplier * 2 * stdDev) / middle * 100, // % bandwidth
    pctB: (last(prices) - (middle - stdDevMultiplier * stdDev)) / (stdDevMultiplier * 2 * stdDev)
  };
}

// ── Support & Resistance ──────────────────────────────────────────────────────
function supportResistance(candles, lookback = 50) {
  const slice  = candles.slice(-lookback);
  const allHighs = highs(slice);
  const allLows  = lows(slice);
  const currentPrice = last(closes(candles));

  // Pivot-based levels
  const pivotHigh = Math.max(...allHighs);
  const pivotLow  = Math.min(...allLows);
  const pivot     = (pivotHigh + pivotLow + last(closes(slice))) / 3;

  // Classic pivot levels
  const r1 = 2 * pivot - pivotLow;
  const r2 = pivot + (pivotHigh - pivotLow);
  const s1 = 2 * pivot - pivotHigh;
  const s2 = pivot - (pivotHigh - pivotLow);

  // Cluster around current price
  const resistances = [r1, r2, pivotHigh].filter(v => v > currentPrice).sort((a, b) => a - b);
  const supports    = [s1, s2, pivotLow].filter(v => v < currentPrice).sort((a, b) => b - a);

  return {
    pivot,
    resistances: resistances.slice(0, 2),
    supports:    supports.slice(0, 2),
    pivotHigh, pivotLow
  };
}

// ── Volume Analysis ───────────────────────────────────────────────────────────
function volumeAnalysis(candles, period = 20) {
  const vols  = volumes(candles);
  const avgVol = avg(vols.slice(-period));
  const lastVol = last(vols);
  const ratio  = avgVol > 0 ? lastVol / avgVol : 1;
  return {
    avgVolume:      Math.round(avgVol),
    lastVolume:     lastVol,
    volumeRatio:    parseFloat(ratio.toFixed(2)),
    volumeSignal:   ratio > 1.5 ? 'high' : ratio < 0.5 ? 'low' : 'normal'
  };
}

// ── Trend Strength (ADX approximation) ───────────────────────────────────────
function trendStrength(candles, period = 14) {
  if (candles.length < period + 1) return null;
  const slice = candles.slice(-(period + 1));
  let plusDM  = 0, minusDM = 0, trueRange = 0;
  for (let i = 1; i < slice.length; i++) {
    const upMove   = slice[i].high - slice[i - 1].high;
    const downMove = slice[i - 1].low - slice[i].low;
    plusDM  += upMove   > downMove && upMove   > 0 ? upMove   : 0;
    minusDM += downMove > upMove   && downMove > 0 ? downMove : 0;
    const hl = slice[i].high - slice[i].low;
    const hc = Math.abs(slice[i].high - slice[i - 1].close);
    const lc = Math.abs(slice[i].low  - slice[i - 1].close);
    trueRange += Math.max(hl, hc, lc);
  }
  if (trueRange === 0) return null;
  const pdi = (plusDM / trueRange) * 100;
  const mdi = (minusDM / trueRange) * 100;
  const dx  = Math.abs(pdi - mdi) / (pdi + mdi) * 100;
  return {
    adx:      parseFloat(dx.toFixed(2)),
    plusDI:   parseFloat(pdi.toFixed(2)),
    minusDI:  parseFloat(mdi.toFixed(2)),
    trend:    dx > 25 ? (pdi > mdi ? 'strong_uptrend' : 'strong_downtrend') : 'sideways'
  };
}

// ── Candlestick Patterns ──────────────────────────────────────────────────────
function detectPatterns(candles) {
  if (candles.length < 3) return [];
  const patterns = [];
  const c = candles;
  const n = c.length - 1;

  const bodySize = idx => Math.abs(c[idx].close - c[idx].open);
  const range    = idx => c[idx].high - c[idx].low;
  const isGreen  = idx => c[idx].close > c[idx].open;
  const isRed    = idx => c[idx].close < c[idx].open;

  // Doji
  if (bodySize(n) <= range(n) * 0.1) {
    patterns.push({ name: 'Doji', signal: 'neutral', description: 'Indecision — watch for trend reversal' });
  }

  // Hammer / Inverted Hammer (single candle)
  const upperShadow = c[n].high - Math.max(c[n].open, c[n].close);
  const lowerShadow = Math.min(c[n].open, c[n].close) - c[n].low;
  if (lowerShadow >= bodySize(n) * 2 && upperShadow <= bodySize(n) * 0.3 && isRed(n - 1)) {
    patterns.push({ name: 'Hammer', signal: 'bullish', description: 'Potential bullish reversal after downtrend' });
  }
  if (upperShadow >= bodySize(n) * 2 && lowerShadow <= bodySize(n) * 0.3 && isRed(n - 1)) {
    patterns.push({ name: 'Shooting Star', signal: 'bearish', description: 'Potential bearish reversal after uptrend' });
  }

  // Engulfing (2-candle)
  if (n >= 1) {
    if (isRed(n - 1) && isGreen(n) && c[n].open < c[n-1].close && c[n].close > c[n-1].open) {
      patterns.push({ name: 'Bullish Engulfing', signal: 'bullish', description: 'Strong bullish reversal signal' });
    }
    if (isGreen(n - 1) && isRed(n) && c[n].open > c[n-1].close && c[n].close < c[n-1].open) {
      patterns.push({ name: 'Bearish Engulfing', signal: 'bearish', description: 'Strong bearish reversal signal' });
    }
  }

  // Morning Star / Evening Star (3-candle)
  if (n >= 2) {
    if (isRed(n-2) && bodySize(n-1) < bodySize(n-2)*0.3 && isGreen(n) && c[n].close > (c[n-2].open + c[n-2].close)/2) {
      patterns.push({ name: 'Morning Star', signal: 'bullish', description: 'Powerful 3-candle bullish reversal' });
    }
    if (isGreen(n-2) && bodySize(n-1) < bodySize(n-2)*0.3 && isRed(n) && c[n].close < (c[n-2].open + c[n-2].close)/2) {
      patterns.push({ name: 'Evening Star', signal: 'bearish', description: 'Powerful 3-candle bearish reversal' });
    }
  }

  return patterns;
}

// ── Signal Confluence Engine ──────────────────────────────────────────────────
function confluenceSignal(indicators) {
  const { price, sma20, sma50, sma200, ema20, rsiVal, macdData, bb, trend, vol } = indicators;
  const signals = [];
  let bullScore = 0, bearScore = 0;

  // Price vs MAs
  if (sma20 && price > sma20) { bullScore += 1; signals.push({ indicator: 'SMA20', signal: 'bullish', detail: `Price ${((price/sma20-1)*100).toFixed(1)}% above SMA20` }); }
  else if (sma20) { bearScore += 1; signals.push({ indicator: 'SMA20', signal: 'bearish', detail: `Price below SMA20` }); }
  if (sma50 && price > sma50) { bullScore += 1.5; signals.push({ indicator: 'SMA50', signal: 'bullish', detail: `Price above SMA50` }); }
  else if (sma50) { bearScore += 1.5; signals.push({ indicator: 'SMA50', signal: 'bearish', detail: `Price below SMA50` }); }
  if (sma200 && price > sma200) { bullScore += 2; signals.push({ indicator: 'SMA200', signal: 'bullish', detail: 'Price above 200-day MA — long-term uptrend' }); }
  else if (sma200) { bearScore += 2; signals.push({ indicator: 'SMA200', signal: 'bearish', detail: 'Price below 200-day MA — long-term downtrend' }); }

  // Golden/Death Cross
  if (sma50 && sma200) {
    if (sma50 > sma200) { bullScore += 2; signals.push({ indicator: 'Golden Cross', signal: 'bullish', detail: 'SMA50 above SMA200' }); }
    else { bearScore += 2; signals.push({ indicator: 'Death Cross', signal: 'bearish', detail: 'SMA50 below SMA200' }); }
  }

  // RSI
  if (rsiVal !== null) {
    if (rsiVal < 30) { bullScore += 2; signals.push({ indicator: 'RSI', signal: 'bullish', detail: `RSI ${rsiVal.toFixed(1)} — oversold` }); }
    else if (rsiVal > 70) { bearScore += 2; signals.push({ indicator: 'RSI', signal: 'bearish', detail: `RSI ${rsiVal.toFixed(1)} — overbought` }); }
    else signals.push({ indicator: 'RSI', signal: 'neutral', detail: `RSI ${rsiVal.toFixed(1)} — neutral zone` });
  }

  // MACD
  if (macdData) {
    if (macdData.histogram > 0) { bullScore += 1.5; signals.push({ indicator: 'MACD', signal: 'bullish', detail: `Histogram +${macdData.histogram.toFixed(2)}` }); }
    else { bearScore += 1.5; signals.push({ indicator: 'MACD', signal: 'bearish', detail: `Histogram ${macdData.histogram.toFixed(2)}` }); }
  }

  // Bollinger Bands
  if (bb) {
    if (price < bb.lower) { bullScore += 1; signals.push({ indicator: 'Bollinger', signal: 'bullish', detail: 'Price below lower band — potential bounce' }); }
    else if (price > bb.upper) { bearScore += 1; signals.push({ indicator: 'Bollinger', signal: 'bearish', detail: 'Price above upper band — stretched' }); }
    else signals.push({ indicator: 'Bollinger', signal: 'neutral', detail: `Price at ${(bb.pctB*100).toFixed(0)}% of band` });
  }

  // Volume
  if (vol) {
    if (vol.volumeRatio > 1.5) signals.push({ indicator: 'Volume', signal: 'confirmation', detail: `${vol.volumeRatio}x avg volume — strong participation` });
    else if (vol.volumeRatio < 0.5) signals.push({ indicator: 'Volume', signal: 'warning', detail: 'Below average volume — weak move' });
  }

  // Trend strength
  if (trend) {
    if (trend.adx > 25 && trend.plusDI > trend.minusDI) bullScore += 1;
    else if (trend.adx > 25 && trend.plusDI < trend.minusDI) bearScore += 1;
  }

  const total = bullScore + bearScore;
  const bullPct = total > 0 ? bullScore / total : 0.5;
  const recommendation = bullPct >= 0.65 ? 'BUY' : bullPct <= 0.35 ? 'SELL' : 'HOLD';
  const confidence = Math.round(Math.abs(bullPct - 0.5) * 200); // 0–100

  return { recommendation, confidence, bullScore, bearScore, signals };
}

// ── Master analysis function ──────────────────────────────────────────────────
/**
 * @param {Array} candles  - [ { open, high, low, close, volume, date } ]
 * @param {string} symbol
 * @returns {Object}       - full technical analysis report
 */
function analyse(candles, symbol = '') {
  if (!candles || candles.length < 5) {
    return { error: 'Insufficient data — need at least 5 candles', symbol };
  }

  const cl = closes(candles);
  const price = last(cl);

  const indicators = {
    price,
    sma20:  sma(cl, 20),
    sma50:  sma(cl, 50),
    sma200: sma(cl, 200),
    ema20:  ema(cl, 20),
    ema50:  ema(cl, 50),
    vwapVal: vwap(candles),
    rsiVal:  rsi(cl, 14),
    macdData: macd(cl),
    bb:      bollingerBands(cl),
    sr:      supportResistance(candles),
    vol:     volumeAnalysis(candles),
    trend:   trendStrength(candles),
    patterns: detectPatterns(candles)
  };

  const confluence = confluenceSignal(indicators);

  // 52-week metrics
  const allHighs = highs(candles);
  const allLows  = lows(candles);
  const high52w  = Math.max(...allHighs);
  const low52w   = Math.min(...allLows);
  const rangePct = ((price - low52w) / (high52w - low52w) * 100).toFixed(1);

  return {
    symbol,
    price,
    analysedAt: new Date().toISOString(),
    candleCount: candles.length,
    indicators: {
      movingAverages: {
        sma20:  indicators.sma20   !== null ? parseFloat(indicators.sma20.toFixed(2))  : null,
        sma50:  indicators.sma50   !== null ? parseFloat(indicators.sma50.toFixed(2))  : null,
        sma200: indicators.sma200  !== null ? parseFloat(indicators.sma200.toFixed(2)) : null,
        ema20:  indicators.ema20   !== null ? parseFloat(indicators.ema20.toFixed(2))  : null,
        ema50:  indicators.ema50   !== null ? parseFloat(indicators.ema50.toFixed(2))  : null,
        vwap:   indicators.vwapVal !== null ? parseFloat(indicators.vwapVal.toFixed(2)): null
      },
      rsi: indicators.rsiVal !== null ? parseFloat(indicators.rsiVal.toFixed(2)) : null,
      rsiSignal: indicators.rsiVal !== null ? (indicators.rsiVal > 70 ? 'overbought' : indicators.rsiVal < 30 ? 'oversold' : 'neutral') : null,
      macd: indicators.macdData ? {
        macdLine:   parseFloat((indicators.macdData.macdLine  || 0).toFixed(4)),
        signalLine: parseFloat((indicators.macdData.signalLine || 0).toFixed(4)),
        histogram:  parseFloat((indicators.macdData.histogram  || 0).toFixed(4)),
        signal:     (indicators.macdData.histogram || 0) > 0 ? 'bullish' : 'bearish'
      } : null,
      bollingerBands: indicators.bb ? {
        upper:     parseFloat(indicators.bb.upper.toFixed(2)),
        middle:    parseFloat(indicators.bb.middle.toFixed(2)),
        lower:     parseFloat(indicators.bb.lower.toFixed(2)),
        bandwidth: parseFloat(indicators.bb.bandwidth.toFixed(2)),
        pctB:      parseFloat(indicators.bb.pctB.toFixed(3))
      } : null,
      supportResistance: indicators.sr,
      volume:   indicators.vol,
      trendStrength: indicators.trend,
      candlestickPatterns: indicators.patterns
    },
    range52w: { high: parseFloat(high52w.toFixed(2)), low: parseFloat(low52w.toFixed(2)), rangePct: parseFloat(rangePct) },
    confluence
  };
}

module.exports = { analyse, sma, ema, rsi, macd, bollingerBands, vwap, supportResistance, volumeAnalysis, trendStrength, detectPatterns };
