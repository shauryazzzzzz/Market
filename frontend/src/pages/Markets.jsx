/**
 * Markets.jsx — Global Markets
 * Hierarchy: Asset Class (primary) → Geography (secondary) → Sector / Cap filters
 * All asset classes wired to live backend data.
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import axios from 'axios'
import { Loading, fmtCr, RangePicker, RangeChg, useHistoricalChanges } from '../components/shared'
import DummyDataBanner from '../components/DummyDataBanner'

// ── Constants ─────────────────────────────────────────────────────────────────

const ASSET_CLASSES = [
  { id: 'Equity',       label: 'Equity',       icon: '📈' },
  { id: 'Gold',         label: 'Gold',          icon: '🥇' },
  { id: 'Bonds',        label: 'Bonds',         icon: '🏦' },
  { id: 'Govt Bonds',   label: 'Govt Bonds',    icon: '🏛' },
  { id: 'Real Estate',  label: 'Real Estate',   icon: '🏠' },
  { id: 'ETF',          label: 'ETF',           icon: '📦' },
  { id: 'MF',           label: 'MF',            icon: '💼' },
  { id: 'Commodities',  label: 'Commodities',   icon: '⛽' },
]

// Equity geographies
const EQUITY_GEOS = [
  { code: 'IN',   name: 'India',     flag: '🇮🇳', currency: '₹', endpoint: '/api/quotes/india' },
  { code: 'US',   name: 'USA',       flag: '🇺🇸', currency: '$', endpoint: '/api/quotes/us' },
  { code: 'CN',   name: 'China',     flag: '🇨🇳', currency: '$', endpoint: '/api/quotes/country?code=CN' },
  { code: 'JP',   name: 'Japan',     flag: '🇯🇵', currency: '¥', endpoint: '/api/quotes/country?code=JP' },
  { code: 'DE',   name: 'Germany',   flag: '🇩🇪', currency: '€', endpoint: '/api/quotes/country?code=DE' },
  { code: 'BR',   name: 'Brazil',    flag: '🇧🇷', currency: 'R$', endpoint: '/api/quotes/country?code=BR' },
  { code: 'KR',   name: 'Korea',     flag: '🇰🇷', currency: '₩', endpoint: '/api/quotes/country?code=KR' },
]

const SECTORS = ['All', 'Financial', 'Technology', 'Healthcare', 'Consumer', 'Energy', 'Industrials', 'Telecom', 'Auto', 'Metals', 'Real Estate', 'Unknown']
const CAPS    = ['All Caps', 'Large Cap', 'Mid Cap', 'Small Cap']

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt2(n) {
  if (n == null) return '—'
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })
}

function PriceCell({ price, currency }) {
  if (price == null) return <span style={{ color: 'var(--muted)' }}>—</span>
  return <>{currency && currency !== 'USD' ? `${currency} ` : ''}{fmt2(price)}</>
}

// ── Instrument table for non-equity assets (Gold, Bonds, ETF, etc.) ──────────
function InstrumentTable({ items, loading, range, changes, changesLoading }) {
  if (loading) return <Loading />
  if (!items?.length) return (
    <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
      No live data — Yahoo Finance connection required.
    </div>
  )
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Instrument</th>
            <th style={{ textAlign: 'left' }}>Type</th>
            <th style={{ textAlign: 'left' }}>Region</th>
            <th style={{ textAlign: 'right' }}>Price</th>
            <th style={{ textAlign: 'right' }}>Chg {range !== '1D' ? `(${range})` : '(1D)'}</th>
            <th style={{ textAlign: 'right' }}>Day High</th>
            <th style={{ textAlign: 'right' }}>Day Low</th>
            <th style={{ textAlign: 'right' }}>52W High</th>
            <th style={{ textAlign: 'right' }}>52W Low</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.symbol}>
              <td>
                <div style={{ fontWeight: 600 }}>{item.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{item.symbol}</div>
              </td>
              <td style={{ fontSize: 12, color: 'var(--muted)' }}>{item.subtype || '—'}</td>
              <td style={{ fontSize: 12, color: 'var(--muted)' }}>{item.region || '—'}</td>
              <td style={{ textAlign: 'right', fontWeight: 700 }}>
                <PriceCell price={item.price} currency={item.currency} />
                {item.unit && <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 2 }}>/{item.unit}</span>}
              </td>
              <td style={{ textAlign: 'right' }}>
                <RangeChg dailyPct={item.change} rangePct={changes?.[item.symbol]} range={range} loading={changesLoading} />
              </td>
              <td style={{ textAlign: 'right', fontSize: 12 }}>{item.dayHigh != null ? `${item.currency}${fmt2(item.dayHigh)}` : '—'}</td>
              <td style={{ textAlign: 'right', fontSize: 12 }}>{item.dayLow  != null ? `${item.currency}${fmt2(item.dayLow)}`  : '—'}</td>
              <td style={{ textAlign: 'right', fontSize: 12 }}>{item.week52High != null ? `${item.currency}${fmt2(item.week52High)}` : '—'}</td>
              <td style={{ textAlign: 'right', fontSize: 12 }}>{item.week52Low  != null ? `${item.currency}${fmt2(item.week52Low)}`  : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Commodity table ───────────────────────────────────────────────────────────
function CommodityTable({ items, loading, range, changes, changesLoading }) {
  if (loading) return <Loading />
  if (!items?.length) return (
    <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
      Live commodity prices unavailable — Yahoo Finance connection required.
    </div>
  )
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Commodity</th>
            <th style={{ textAlign: 'right' }}>Price</th>
            <th style={{ textAlign: 'right' }}>Chg {range !== '1D' ? `(${range})` : '(1D)'}</th>
            <th style={{ textAlign: 'right' }}>Day High</th>
            <th style={{ textAlign: 'right' }}>Day Low</th>
            <th style={{ textAlign: 'right' }}>52W High</th>
            <th style={{ textAlign: 'right' }}>52W Low</th>
          </tr>
        </thead>
        <tbody>
          {items.map(c => (
            <tr key={c.symbol}>
              <td>
                <div style={{ fontWeight: 600 }}>{c.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.symbol} · {c.currency}</div>
              </td>
              <td style={{ textAlign: 'right', fontWeight: 700 }}>
                {c.price != null ? `${c.currencySymbol}${Number(c.price).toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '—'}
              </td>
              <td style={{ textAlign: 'right' }}>
                <RangeChg dailyPct={c.changePct} rangePct={changes?.[c.symbol]} range={range} loading={changesLoading} />
              </td>
              <td style={{ textAlign: 'right', fontSize: 12 }}>{c.dayHigh != null ? `${c.currencySymbol}${c.dayHigh.toFixed(2)}` : '—'}</td>
              <td style={{ textAlign: 'right', fontSize: 12 }}>{c.dayLow  != null ? `${c.currencySymbol}${c.dayLow.toFixed(2)}`  : '—'}</td>
              <td style={{ textAlign: 'right', fontSize: 12 }}>{c.week52High != null ? `${c.currencySymbol}${c.week52High.toFixed(2)}` : '—'}</td>
              <td style={{ textAlign: 'right', fontSize: 12 }}>{c.week52Low  != null ? `${c.currencySymbol}${c.week52Low.toFixed(2)}`  : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Equity table ──────────────────────────────────────────────────────────────
function EquityTable({ stocks, loading, isLive, geo, range, changes, changesLoading }) {
  if (loading) return <Loading />
  if (!stocks.length) {
    if (!geo?.endpoint) return (
      <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
        Live data for {geo?.name} coming soon.
      </div>
    )
    return (
      <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
        No stocks match. {isLive === false ? 'Live data unavailable.' : 'Try other filters.'}
      </div>
    )
  }
  const currencyLabel = geo?.currency || ''
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Company</th>
            <th>Sector</th>
            <th style={{ textAlign: 'right' }}>Price</th>
            <th style={{ textAlign: 'right' }}>Chg {range !== '1D' ? `(${range})` : '(1D)'}</th>
            <th style={{ textAlign: 'right' }}>Mkt Cap</th>
            <th style={{ textAlign: 'right' }}>P/E</th>
            <th style={{ textAlign: 'right' }}>P/B</th>
            <th style={{ textAlign: 'right' }}>Div %</th>
          </tr>
        </thead>
        <tbody>
          {stocks.map(s => (
            <tr key={s.symbol}>
              <td className="sym">{s.symbol}</td>
              <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</td>
              <td style={{ color: 'var(--muted)', fontSize: 12 }}>{s.sector || '—'}</td>
              <td style={{ textAlign: 'right' }}>
                {s.price != null ? `${currencyLabel}${s.price?.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '—'}
              </td>
              <td style={{ textAlign: 'right' }}>
                <RangeChg dailyPct={s.change} rangePct={changes?.[s.symbol]} range={range} loading={changesLoading} />
              </td>
              <td style={{ textAlign: 'right', fontSize: 12 }}>{s.mktcap ? fmtCr(s.mktcap) : '—'}</td>
              <td style={{ textAlign: 'right' }}>{s.pe?.toFixed(1) ?? '—'}</td>
              <td style={{ textAlign: 'right' }}>{s.pb?.toFixed(1) ?? '—'}</td>
              <td style={{ textAlign: 'right' }}>{s.div?.toFixed(2) ?? '—'}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Markets() {
  // Primary: asset class
  const [assetClass,  setAssetClass]  = useState('Equity')
  // Secondary: geography (equity only)
  const [geoCode,     setGeoCode]     = useState('IN')
  // Filters (equity only)
  const [sector,      setSector]      = useState('All')
  const [cap,         setCap]         = useState('All Caps')
  // Range picker
  const [range,       setRange]       = useState('1D')
  // Data
  const [stocks,      setStocks]      = useState([])
  const [commodities, setCommodities] = useState([])
  const [instruments, setInstruments] = useState([])   // non-equity asset classes
  const [loading,     setLoading]     = useState(false)
  const [isLive,      setIsLive]      = useState(null)
  const [lastFetch,   setLastFetch]   = useState(null)
  const cache = useRef({})

  const isEquity     = assetClass === 'Equity'
  const isCommodity  = assetClass === 'Commodities'
  const isOther      = !isEquity && !isCommodity  // Gold, Bonds, Govt Bonds, Real Estate, ETF, MF

  const geo = EQUITY_GEOS.find(g => g.code === geoCode)

  // ── Fetch based on asset class ──────────────────────────────────────────────
  useEffect(() => {
    const cacheKey = isEquity ? `equity:${geoCode}` : isCommodity ? 'commodities' : `asset:${assetClass}`

    if (cache.current[cacheKey]) {
      const c = cache.current[cacheKey]
      if (isEquity)    { setStocks(c.stocks || []); setIsLive(c.isLive) }
      if (isCommodity) { setCommodities(c.commodities || []); setIsLive(c.isLive) }
      if (isOther)     { setInstruments(c.instruments || []); setIsLive(c.isLive) }
      setLoading(false)
      return
    }

    if (isEquity && !geo?.endpoint) {
      setStocks([]); setIsLive(false); setLoading(false); return
    }

    setLoading(true)

    const url = isEquity
      ? geo.endpoint
      : isCommodity
        ? '/api/quotes/commodities'
        : `/api/quotes/asset-class?class=${encodeURIComponent(assetClass)}`

    axios.get(url, { timeout: 18000 })
      .then(r => {
        if (isEquity) {
          const s = r.data?.stocks || []
          const l = r.data?.isLive || false
          cache.current[cacheKey] = { stocks: s, isLive: l }
          setStocks(s); setIsLive(l)
        } else if (isCommodity) {
          const c = r.data?.commodities || []
          const l = r.data?.isLive || false
          cache.current[cacheKey] = { commodities: c, isLive: l }
          setCommodities(c); setIsLive(l)
        } else {
          const i = r.data?.instruments || []
          const l = r.data?.isLive || false
          cache.current[cacheKey] = { instruments: i, isLive: l }
          setInstruments(i); setIsLive(l)
        }
        setLastFetch(new Date())
        setLoading(false)
      })
      .catch(() => {
        setStocks([]); setCommodities([]); setInstruments([])
        setIsLive(false); setLoading(false)
      })
  }, [assetClass, geoCode]) // eslint-disable-line

  // ── Reset sub-filters when asset class changes ──────────────────────────────
  useEffect(() => {
    setSector('All')
    setCap('All Caps')
    setRange('1D')
  }, [assetClass, geoCode])

  // ── Filter equity stocks ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!isEquity) return stocks
    return stocks.filter(s => {
      if (sector !== 'All' && s.sector !== sector) return false
      if (cap !== 'All Caps' && s.cap !== cap) return false
      return true
    })
  }, [stocks, sector, cap, isEquity])

  // ── Range-change fetching ───────────────────────────────────────────────────
  const equitySymbols = useMemo(() => filtered.map(s => s.symbol), [filtered.map(s=>s.symbol).join(',')]) // eslint-disable-line
  const commSymbols   = useMemo(() => commodities.map(c => c.symbol), [commodities.map(c=>c.symbol).join(',')]) // eslint-disable-line
  const instrSymbols  = useMemo(() => instruments.map(i => i.symbol), [instruments.map(i=>i.symbol).join(',')]) // eslint-disable-line

  const { changes: eqChg,   loading: eqL   } = useHistoricalChanges(isEquity    ? equitySymbols : [], range)
  const { changes: commChg, loading: commL } = useHistoricalChanges(isCommodity ? commSymbols   : [], range)
  const { changes: instrChg,loading: instrL} = useHistoricalChanges(isOther     ? instrSymbols  : [], range)

  // ── Refresh handler ─────────────────────────────────────────────────────────
  const refresh = () => {
    const cacheKey = isEquity ? `equity:${geoCode}` : isCommodity ? 'commodities' : `asset:${assetClass}`
    delete cache.current[cacheKey]
    if (isEquity) { setStocks([]) } else if (isCommodity) { setCommodities([]) } else { setInstruments([]) }
    setAssetClass(a => a)  // trigger re-fetch via useEffect
  }

  // ── Count rows shown ────────────────────────────────────────────────────────
  const rowCount = isEquity ? filtered.length : isCommodity ? commodities.length : instruments.length

  const showDummyBanner = isLive === false &&
    (isEquity ? !!geo?.endpoint : true)

  return (
    <div className="page">
      <DummyDataBanner show={showDummyBanner} />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div className="page-title">Global Markets</div>
          <div className="page-sub">Real-time quotes · Asset Class → Geography → Sector</div>
        </div>
        <div style={{ fontSize: 11, color: isLive ? 'var(--positive)' : 'var(--muted)' }}>
          {isLive ? `● Live · ${lastFetch?.toLocaleTimeString()}` : isLive === false ? '○ No live data' : ''}
        </div>
      </div>

      {/* ── Level 1: Asset Class (PRIMARY) ─────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-label" style={{ marginBottom: 10 }}>Asset Class</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {ASSET_CLASSES.map(a => (
            <button key={a.id}
              className={`btn btn-sm ${assetClass === a.id ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setAssetClass(a.id)}
            >
              {a.icon} {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Level 2: Geography (only for Equity) ───────────────────────────── */}
      {isEquity && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-label" style={{ marginBottom: 10 }}>Geography</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {EQUITY_GEOS.map(g => (
              <button key={g.code}
                className={`btn btn-sm ${geoCode === g.code ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setGeoCode(g.code)}
              >
                {g.flag} {g.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Level 3: Sector + Cap (Equity only) ────────────────────────────── */}
      {isEquity && (
        <div className="grid-2" style={{ marginBottom: 16 }}>
          <div className="card">
            <div className="card-label" style={{ marginBottom: 10 }}>Sector</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {SECTORS.map(s => (
                <button key={s} className={`btn btn-sm ${sector === s ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setSector(s)}>{s}</button>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-label" style={{ marginBottom: 10 }}>Market Cap</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {CAPS.map(c => (
                <button key={c} className={`btn btn-sm ${cap === c ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setCap(c)}>{c}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Results card ───────────────────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-label">
              {ASSET_CLASSES.find(a => a.id === assetClass)?.icon} {assetClass}
              {isEquity && geo ? ` · ${geo.flag} ${geo.name}` : ''}
              {isEquity ? ` · ${sector} · ${cap}` : ''}
            </div>
            <div className="card-title">
              {loading ? 'Loading…' : `${rowCount} instruments`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <RangePicker selected={range} onChange={setRange} />
            <button className="btn btn-ghost btn-sm" onClick={refresh}>↺ Refresh</button>
          </div>
        </div>

        {/* ── Equity view ──────────────────────────────────────────────────── */}
        {isEquity && (
          <EquityTable
            stocks={filtered}
            loading={loading}
            isLive={isLive}
            geo={geo}
            range={range}
            changes={eqChg}
            changesLoading={eqL}
          />
        )}

        {/* ── Commodity view ───────────────────────────────────────────────── */}
        {isCommodity && (
          <CommodityTable
            items={commodities}
            loading={loading}
            range={range}
            changes={commChg}
            changesLoading={commL}
          />
        )}

        {/* ── Other asset class view ────────────────────────────────────────── */}
        {isOther && (
          <InstrumentTable
            items={instruments}
            loading={loading}
            range={range}
            changes={instrChg}
            changesLoading={instrL}
          />
        )}
      </div>
    </div>
  )
}
