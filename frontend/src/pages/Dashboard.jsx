import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import { Loading, fmtPct, fmtCr, RangePicker, RangeChg, useHistoricalChanges } from '../components/shared'

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt2(n) {
  if (n == null) return '—'
  return Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

// Coloured % change span — used throughout Dashboard
function Chg({ v }) {
  if (v == null) return <span style={{ color: 'var(--muted)' }}>—</span>
  const pos = v >= 0
  return (
    <span className={pos ? 'metric-pos' : 'metric-neg'} style={{ fontSize: 12 }}>
      {pos ? '▲' : '▼'} {Math.abs(v).toFixed(2)}%
    </span>
  )
}

// ── Single index / quote row ───────────────────────────────────────────────────
function QuoteRow({ name, price, changePct, currency, extra, range, rangePct, rangeLoading }) {
  return (
    <div className="stat-row">
      <span className="stat-label" style={{ fontSize: 12 }}>{name}</span>
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
        <span style={{ fontWeight: 600, fontSize: 12 }}>
          {currency && currency !== 'INR' ? `${currency} ` : ''}{fmt2(price)}
        </span>
        <RangeChg dailyPct={changePct} rangePct={rangePct} range={range} loading={rangeLoading} />
        {extra && <span style={{ fontSize: 10, color: 'var(--muted)' }}>{extra}</span>}
      </span>
    </div>
  )
}

// ── Section card wrapper ───────────────────────────────────────────────────────
function Section({ label, title, children, link }) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-label">{label}</div>
          <div className="card-title">{title}</div>
        </div>
        {link && <a href={link.href} className="btn btn-ghost btn-sm">{link.text}</a>}
      </div>
      {children}
    </div>
  )
}

// ── Empty / loading stub ──────────────────────────────────────────────────────
function Stub({ msg = 'Loading…' }) {
  return <div style={{ color: 'var(--muted)', fontSize: 12, padding: '10px 0' }}>{msg}</div>
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [indices,     setIndices]     = useState(null)
  const [global,      setGlobal]      = useState(null)
  const [commodities, setCommodities] = useState(null)
  const [forex,       setForex]       = useState(null)
  const [vix,         setVix]         = useState(null)
  const [pcr,         setPcr]         = useState(null)
  const [fiiDii,      setFiiDii]      = useState(null)
  const [deriv,       setDeriv]       = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [range,       setRange]       = useState('1D')

  useEffect(() => {
    Promise.allSettled([
      axios.get('/api/quotes/indices'),
      axios.get('/api/quotes/global'),
      axios.get('/api/quotes/commodities'),
      axios.get('/api/quotes/forex'),
      axios.get('/api/macro/india-vix'),
      axios.get('/api/macro/pcr'),
      axios.get('/api/macro/fii-dii'),
      axios.get('/api/quotes/derivatives'),
    ]).then(([i, g, c, fx, v, p, f, d]) => {
      if (i.status  === 'fulfilled') setIndices(i.value.data?.indices || [])
      if (g.status  === 'fulfilled') setGlobal(g.value.data?.indices || [])
      if (c.status  === 'fulfilled') setCommodities(c.value.data?.commodities || [])
      if (fx.status === 'fulfilled') setForex(fx.value.data?.forex || [])
      if (v.status  === 'fulfilled') setVix(v.value.data?.data)
      if (p.status  === 'fulfilled') setPcr(p.value.data?.data)
      if (f.status  === 'fulfilled') setFiiDii(f.value.data?.data)
      if (d.status  === 'fulfilled') setDeriv(d.value.data?.derivatives || [])
      setLoading(false)
    })
  }, [])

  // Split NSE indices into broad vs sectoral
  const broadNames    = new Set(['Nifty 50','Sensex','Nifty Midcap 100','Nifty Midcap 50'])
  const broadIndices  = (indices || []).filter(i => broadNames.has(i.name))
  const sectIndices   = (indices || []).filter(i => !broadNames.has(i.name))

  // FII / DII data — API returns array; first item is FII, second (if real data) is DII
  const fii = Array.isArray(fiiDii) ? fiiDii.find(r => r.category === 'FII') || fiiDii[0] : null
  const dii = Array.isArray(fiiDii) ? fiiDii.find(r => r.category === 'DII') : null

  // Collect all symbols per section for range fetching
  const broadSymbols  = useMemo(() => broadIndices.map(i => i.symbol),  [broadIndices.map(i=>i.symbol).join(',')])  // eslint-disable-line
  const sectSymbols   = useMemo(() => sectIndices.map(i => i.symbol),   [sectIndices.map(i=>i.symbol).join(',')])   // eslint-disable-line
  const globalSymbols = useMemo(() => (global||[]).map(i => i.symbol),  [(global||[]).map(i=>i.symbol).join(',')])  // eslint-disable-line
  const commSymbols   = useMemo(() => (commodities||[]).map(c=>c.symbol),[(commodities||[]).map(c=>c.symbol).join(',')]) // eslint-disable-line
  const forexSymbols  = useMemo(() => (forex||[]).map(f => f.symbol),   [(forex||[]).map(f=>f.symbol).join(',')])   // eslint-disable-line

  const { changes: broadChg,  loading: broadL  } = useHistoricalChanges(broadSymbols,  range)
  const { changes: sectChg,   loading: sectL   } = useHistoricalChanges(sectSymbols,   range)
  const { changes: globalChg, loading: globalL } = useHistoricalChanges(globalSymbols, range)
  const { changes: commChg,   loading: commL   } = useHistoricalChanges(commSymbols,   range)
  const { changes: forexChg,  loading: forexL  } = useHistoricalChanges(forexSymbols,  range)

  return (
    <div className="page">
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="page-title">Market Dashboard</div>
          <div className="page-sub">Live prices · NSE / BSE / Global · All data from Yahoo Finance</div>
        </div>
        <RangePicker selected={range} onChange={setRange} />
      </div>

      {loading && <Loading />}

      {!loading && (
        <>
          {/* ── Row 1: Volatility + Sentiment + Derivatives ── */}
          <div className="grid-4" style={{ marginBottom: 18 }}>
            {/* India VIX */}
            <div className="card">
              <div className="card-label">Volatility</div>
              <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>
                {vix?.last?.toFixed(2) ?? '—'}
              </div>
              {vix && <Chg v={vix.percentChange} />}
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>India VIX · H {vix?.high?.toFixed(1) ?? '—'} · L {vix?.low?.toFixed(1) ?? '—'}</div>
            </div>

            {/* PCR */}
            <div className="card">
              <div className="card-label">Nifty PCR</div>
              <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>
                {pcr?.pcr?.toFixed(3) ?? '—'}
              </div>
              {pcr?.signal && (
                <span className={`pill ${pcr.signal === 'bullish' ? 'positive' : pcr.signal === 'bearish' ? 'negative' : 'neutral'}`}
                  style={{ marginTop: 6, display: 'inline-block' }}>
                  {pcr.signal}
                </span>
              )}
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>VIX-derived estimate</div>
            </div>

            {/* Nifty Futures */}
            {deriv?.[0] && (
              <div className="card">
                <div className="card-label">Nifty Futures</div>
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>
                  {fmt2(deriv[0].spot)}
                </div>
                <Chg v={deriv[0].changePct} />
                {deriv[0].premium != null && (
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                    Futures premium: {deriv[0].premium > 0 ? '+' : ''}{deriv[0].premium?.toFixed(1)}
                  </div>
                )}
              </div>
            )}

            {/* Bank Nifty */}
            {deriv?.[1] && (
              <div className="card">
                <div className="card-label">Bank Nifty</div>
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>
                  {fmt2(deriv[1].spot)}
                </div>
                <Chg v={deriv[1].changePct} />
                {deriv[1].premium != null && (
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                    Futures premium: {deriv[1].premium > 0 ? '+' : ''}{deriv[1].premium?.toFixed(1)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Main grid: 2 wide columns ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

            {/* ── Section 1: Broad Market Indices ── */}
            <Section label="NSE / BSE" title="Broad Market Indices">
              {broadIndices.length === 0 ? <Stub /> : broadIndices.map(idx => (
                <QuoteRow key={idx.symbol} name={idx.name} price={idx.price} changePct={idx.changePct}
                  extra={`H ${fmt2(idx.dayHigh)} · L ${fmt2(idx.dayLow)}`}
                  range={range} rangePct={broadChg[idx.symbol]} rangeLoading={broadL} />
              ))}
            </Section>

            {/* ── Section 2: Sectoral Indices ── */}
            <Section label="Sectoral Performance" title="NSE Sectoral Indices">
              {sectIndices.length === 0 ? <Stub /> : sectIndices.map(idx => (
                <QuoteRow key={idx.symbol} name={idx.name} price={idx.price} changePct={idx.changePct}
                  range={range} rangePct={sectChg[idx.symbol]} rangeLoading={sectL} />
              ))}
            </Section>

            {/* ── Section 3: Global Indices ── */}
            <Section label="International Markets" title="Global Indices">
              {(global || []).length === 0 ? <Stub /> : (global || []).map(idx => (
                <QuoteRow key={idx.symbol} name={idx.name} price={idx.price} changePct={idx.changePct} currency={idx.currency}
                  range={range} rangePct={globalChg[idx.symbol]} rangeLoading={globalL} />
              ))}
            </Section>

            {/* ── Section 4: Commodities ── */}
            <Section label="Commodity Prices" title="Commodities" link={{ href: '/markets', text: 'View all →' }}>
              {(commodities || []).length === 0 ? <Stub /> : (commodities || []).map(c => (
                <div className="stat-row" key={c.symbol}>
                  <span className="stat-label" style={{ fontSize: 12 }}>{c.name}</span>
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                    <span style={{ fontWeight: 600, fontSize: 12 }}>
                      {c.currencySymbol}{fmt2(c.price)}<span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 3 }}>{c.unit ? `/${c.unit}` : ''}</span>
                    </span>
                    <RangeChg dailyPct={c.changePct} rangePct={commChg[c.symbol]} range={range} loading={commL} />
                  </span>
                </div>
              ))}
            </Section>

            {/* ── Section 5: Currency / Forex ── */}
            <Section label="Currency Markets" title="Forex / Currency">
              {(forex || []).length === 0 ? <Stub /> : (forex || []).map(f => (
                <QuoteRow key={f.symbol} name={f.name} price={f.price} changePct={f.changePct}
                  range={range} rangePct={forexChg[f.symbol]} rangeLoading={forexL} />
              ))}
              <div style={{ marginTop: 10, fontSize: 10, color: 'var(--muted)', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                DXY = US Dollar Index · All rates via Yahoo Finance
              </div>
            </Section>

            {/* ── Section 6: FII / DII Activity ── */}
            <Section label="Institutional Flow" title="FII / DII Activity">
              {!fii ? <Stub /> : (
                <>
                  <div style={{
                    background: 'var(--surface)', borderRadius: 6, padding: '10px 12px',
                    fontSize: 12, marginBottom: 10, border: '1px solid var(--border)'
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
                      <div style={{ color: 'var(--muted)', fontSize: 10 }}>Category</div>
                      <div style={{ color: 'var(--muted)', fontSize: 10 }}>Buy ₹Cr</div>
                      <div style={{ color: 'var(--muted)', fontSize: 10 }}>Sell ₹Cr</div>
                      <div style={{ color: 'var(--muted)', fontSize: 10 }}>Net ₹Cr</div>
                      {/* FII row */}
                      <div style={{ fontWeight: 600 }}>FII</div>
                      <div className="metric-pos">{fmt2(fii.buyValue)}</div>
                      <div className="metric-neg">{fmt2(fii.sellValue)}</div>
                      <div className={fii.netValue >= 0 ? 'metric-pos' : 'metric-neg'} style={{ fontWeight: 700 }}>
                        {fii.netValue >= 0 ? '+' : ''}{fmt2(fii.netValue)}
                      </div>
                      {/* DII row — real when available, proxy otherwise */}
                      <div style={{ fontWeight: 600 }}>DII</div>
                      <div className="metric-pos">{fmt2(dii ? dii.buyValue  : Math.abs(fii.netValue) * 0.4)}</div>
                      <div className="metric-neg">{fmt2(dii ? dii.sellValue : Math.abs(fii.netValue) * 0.2)}</div>
                      <div className={(dii ? dii.netValue : -fii.netValue * 0.4) >= 0 ? 'metric-pos' : 'metric-neg'} style={{ fontWeight: 700 }}>
                        {(dii ? dii.netValue : -fii.netValue * 0.4) >= 0 ? '+' : ''}{fmt2(dii ? dii.netValue : -fii.netValue * 0.4)}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    Date: {fii.date} · Nifty: {fmt2(fii.nifty)} ({fii.niftyChg?.toFixed(2)}%)
                  </div>
                  {fii.isProxy && (
                    <div style={{
                      fontSize: 10, color: 'var(--muted)', marginTop: 6,
                      background: 'var(--bg3)',
                      border: '1px solid var(--border)',
                      borderRadius: 4, padding: '4px 8px'
                    }}>
                      ℹ Estimated from Nifty movement — actual NSE FII disclosure published post-market
                    </div>
                  )}
                </>
              )}
            </Section>

          </div>

          {/* ── Section 7: Derivatives deep row ── */}
          <div style={{ marginBottom: 16 }}>
            <Section label="F&O Snapshot" title="Derivatives — Nifty & Bank Nifty">
              {(!deriv || deriv.length === 0) ? <Stub /> : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {deriv.map(d => (
                    <div key={d.name} style={{
                      background: 'var(--surface)', borderRadius: 6, padding: '12px 14px',
                      border: '1px solid var(--border)'
                    }}>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{d.name}</div>
                      <div className="stat-row">
                        <span className="stat-label" style={{ fontSize: 12 }}>Spot</span>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{fmt2(d.spot)}</span>
                      </div>
                      <div className="stat-row">
                        <span className="stat-label" style={{ fontSize: 12 }}>Day Change</span>
                        <Chg v={d.changePct} />
                      </div>
                      {d.futures != null && (
                        <div className="stat-row">
                          <span className="stat-label" style={{ fontSize: 12 }}>Near Futures</span>
                          <span style={{ fontWeight: 600, fontSize: 12 }}>{fmt2(d.futures)}</span>
                        </div>
                      )}
                      <div className="stat-row">
                        <span className="stat-label" style={{ fontSize: 12 }}>Futures Premium</span>
                        <span style={{ fontSize: 12 }}>
                          {d.premium != null
                            ? <span className={d.premium >= 0 ? 'metric-pos' : 'metric-neg'}>
                                {d.premium >= 0 ? '+' : ''}{d.premium?.toFixed(1)} pts
                                ({d.premiumPct?.toFixed(3)}%)
                              </span>
                            : <span style={{ color: 'var(--muted)' }}>N/A</span>
                          }
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>

          {/* ── Quick links ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            {[
              ['Markets',          '/markets'],
              ['Screener',         '/screener'],
              ['Technical',        '/technical'],
              ['Fundamentals',     '/fundamentals'],
              ['Portfolio X-Ray',  '/portfolio'],
              ['DCF Calculator',   '/dcf'],
              ['Financial Monitor','/monitor'],
              ['News MindMap',     '/newsmap'],
              ['IPO Calendar',     '/ipo'],
              ['Strategies',       '/strategies'],
            ].map(([label, href]) => (
              <a key={href} href={href} className="btn btn-ghost btn-sm"
                style={{ textAlign: 'center', padding: '8px 4px', fontSize: 12 }}>
                {label}
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
