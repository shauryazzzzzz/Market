import { useState } from 'react'
import axios from 'axios'

export default function AISentiment() {
  const [headlines, setHeadlines] = useState('')
  const [result, setResult]       = useState(null)
  const [loading, setLoading]     = useState(false)

  // Stock analysis form
  const [stockForm, setStockForm] = useState({ name: '', symbol: '', pe: '', roe: '', debtEquity: '' })
  const [stockResult, setStockResult] = useState(null)
  const [stockLoading, setStockLoading] = useState(false)

  const runSentiment = async () => {
    if (!headlines.trim()) return
    setLoading(true); setResult(null)
    try {
      const lines = headlines.split('\n').filter(Boolean)
      const r = await axios.post('/api/ai/market-sentiment', { headlines: lines })
      setResult(r.data)
    } catch (e) {
      setResult({ success: false, error: e.message })
    }
    setLoading(false)
  }

  const runStockAnalysis = async () => {
    if (!stockForm.symbol) return
    setStockLoading(true); setStockResult(null)
    try {
      const r = await axios.post('/api/ai/analyze-stock', stockForm)
      setStockResult(r.data)
    } catch (e) {
      setStockResult({ success: false, error: e.message })
    }
    setStockLoading(false)
  }

  const sentTone = (t) => {
    if (!t) return 'metric-neu'
    const lower = t.toLowerCase()
    if (lower.includes('bullish') || lower.includes('positive')) return 'metric-pos'
    if (lower.includes('bearish') || lower.includes('negative')) return 'metric-neg'
    return 'metric-neu'
  }

  return (
    <div className="page">
      <div className="page-title">🤖 AI Analysis</div>
      <div className="page-sub">Market sentiment · Stock analysis · Powered by WatsonX → Gemini → Smart fallback</div>

      <div className="grid-2">
        {/* Market Sentiment */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-label">Market Sentiment</div>
              <div className="card-title">Paste Headlines for AI Analysis</div>
            </div>
            <span style={{ fontSize: 22 }}>📰</span>
          </div>

          <textarea
            rows={6}
            className="input"
            style={{ resize: 'vertical', marginBottom: 12, fontFamily: 'monospace', fontSize: 12 }}
            placeholder={`Paste financial headlines, one per line:\n\nRBI holds rates steady at 6.5%\nNifty hits all-time high of 25,000\nQ3 results: Infosys beats estimates by 8%`}
            value={headlines}
            onChange={e => setHeadlines(e.target.value)}
          />

          <button className="btn btn-primary" onClick={runSentiment} disabled={loading || !headlines.trim()}>
            {loading ? '⏳ Analysing…' : '🤖 Run Sentiment AI'}
          </button>

          {result && (
            <div style={{ marginTop: 16, padding: '14px 16px', background: 'var(--surface2)', borderRadius: 8, borderLeft: '3px solid var(--primary)' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                AI Sentiment Result · Provider: <strong>{result.provider || '—'}</strong>
              </div>
              <div className={sentTone(result.text)} style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
                {result.text || '—'}
              </div>
              {!result.success && result.error && (
                <div style={{ color: 'var(--negative)', fontSize: 12 }}>Error: {result.error}</div>
              )}
            </div>
          )}
        </div>

        {/* Stock Analysis */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-label">Stock Analysis</div>
              <div className="card-title">Fundamental AI Commentary</div>
            </div>
            <span style={{ fontSize: 22 }}>📈</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            {[
              ['Company Name', 'name',        'e.g. Reliance Industries'],
              ['NSE Symbol',   'symbol',       'e.g. RELIANCE'],
              ['P/E Ratio',    'pe',           'e.g. 28.5'],
              ['ROE (%)',      'roe',          'e.g. 18.2'],
              ['Debt/Equity',  'debtEquity',   'e.g. 0.4'],
              ['Revenue Growth %', 'revenueGrowth', 'e.g. 12.3'],
            ].map(([label, key, ph]) => (
              <div key={key}>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{label}</div>
                <input className="input"
                  placeholder={ph}
                  value={stockForm[key] || ''}
                  onChange={e => setStockForm(p => ({ ...p, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>

          <button className="btn btn-primary" onClick={runStockAnalysis} disabled={stockLoading || !stockForm.symbol}>
            {stockLoading ? '⏳ Analysing…' : '🔍 Analyse Stock'}
          </button>

          {stockResult && (
            <div style={{ marginTop: 16, padding: '14px 16px', background: 'var(--surface2)', borderRadius: 8, borderLeft: '3px solid var(--accent)' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                AI Analysis · Provider: <strong>{stockResult.provider || '—'}</strong>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text)' }}>
                {stockResult.text || '—'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tips panel */}
      <div className="card" style={{ marginTop: 4 }}>
        <div className="card-header">
          <div><div className="card-label">How it works</div><div className="card-title">AI Provider Chain</div></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {[
            ['1. IBM WatsonX',  'Granite-3-8B model via IBM Cloud', '#2f81f7'],
            ['2. Google Gemini','gemini-2.0-flash-exp fallback',    '#a371f7'],
            ['3. Smart Fallback','Keyword-based local analysis',    '#3fb950'],
          ].map(([name, desc, color]) => (
            <div key={name} style={{ padding: '12px 14px', background: 'var(--surface2)', borderRadius: 8, borderLeft: `3px solid ${color}` }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{name}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
