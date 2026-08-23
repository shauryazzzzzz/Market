/**
 * IPOCalendar.jsx — live IPO data from /api/quotes/ipo (NSE API)
 * Falls back showing DummyDataBanner if NSE API is unavailable.
 * Historical IPOs (already listed) shown only with factual data; no fabricated GMP.
 */
import { useState, useEffect } from 'react'
import axios from 'axios'
import { Loading } from '../components/shared'
import DummyDataBanner from '../components/DummyDataBanner'

// Recently listed IPOs — issue price & factual subscription data (no GMP speculation).
// Live current price is fetched from Yahoo Finance at runtime in enrichRecentIPOs().
const RECENT_IPOS_BASE = [
  { company: 'Ola Electric Mobility',  nseSymbol: 'OLAELECTRIC.NS', issuePrice: 76,   priceBand: '₹72–76',      issueSize: '₹6,145 Cr',  opens: '2024-08-02', closes: '2024-08-06', subscribed: 4.27  },
  { company: 'Bajaj Housing Finance',  nseSymbol: 'BAJAJHFL.NS',    issuePrice: 70,   priceBand: '₹66–70',      issueSize: '₹6,560 Cr',  opens: '2024-09-09', closes: '2024-09-11', subscribed: 64.49 },
  { company: 'Hyundai India',          nseSymbol: 'HYUNDAI.NS',     issuePrice: 1960, priceBand: '₹1,865–1,960',issueSize: '₹27,870 Cr', opens: '2024-10-15', closes: '2024-10-17', subscribed: 2.37  },
  { company: 'ACME Solar Holdings',    nseSymbol: 'ACMESOLAR.NS',   issuePrice: 289,  priceBand: '₹275–289',    issueSize: '₹2,900 Cr',  opens: '2024-11-06', closes: '2024-11-08', subscribed: 2.75  },
  { company: 'Swiggy',                 nseSymbol: 'SWIGGY.NS',      issuePrice: 390,  priceBand: '₹371–390',    issueSize: '₹11,327 Cr', opens: '2024-11-06', closes: '2024-11-08', subscribed: 3.59  },
  { company: 'NTPC Green Energy',      nseSymbol: 'NTPCGREEN.NS',   issuePrice: 108,  priceBand: '₹102–108',    issueSize: '₹10,000 Cr', opens: '2024-11-19', closes: '2024-11-22', subscribed: 2.55  },
  { company: 'Vishal Mega Mart',       nseSymbol: 'VISHAL.NS',      issuePrice: 78,   priceBand: '₹74–78',      issueSize: '₹8,000 Cr',  opens: '2024-12-11', closes: '2024-12-13', subscribed: 27.27 },
]

const STATUS_BG   = { Listed: 'rgba(63,185,80,.15)',  Open: 'rgba(47,129,247,.15)',  Upcoming: 'rgba(210,153,34,.15)' }
const STATUS_TEXT = { Listed: 'var(--positive)',       Open: 'var(--primary)',         Upcoming: 'var(--warning)'      }

function IPOCard({ ipo, isLive }) {
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>{ipo.company || ipo.companyName}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isLive && <span style={{ fontSize: 9, color: 'var(--positive)', fontWeight: 700 }}>● LIVE</span>}
          <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700,
            background: STATUS_BG[ipo.status] || STATUS_BG.Upcoming, color: STATUS_TEXT[ipo.status] || STATUS_TEXT.Upcoming }}>
            {ipo.status}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[
          ['Price Band',     ipo.priceBand   || ipo.minBidQuantity || '—'],
          ['Issue Size',     ipo.issueSize   || (ipo.issueAmount ? `₹${ipo.issueAmount} Cr` : '—')],
          ['Opens',          ipo.opens       || ipo.openDate || '—'],
          ['Closes',         ipo.closes      || ipo.closeDate || '—'],
          ['Subscribed',     ipo.subscribed  != null ? <span className="metric-pos">{ipo.subscribed}x</span> : '—'],
          ['Listing Price',  ipo.listingPrice != null ? `₹${ipo.listingPrice}` : '—'],
          ['Listing Gain',   ipo.listingGain  != null
            ? <span className={ipo.listingGain >= 0 ? 'metric-pos' : 'metric-neg'}>{ipo.listingGain >= 0 ? '+' : ''}{ipo.listingGain.toFixed(2)}%</span>
            : '—'],
          ['Category',       ipo.category || ipo.series || '—'],
        ].map(([label, val]) => (
          <div key={label} style={{ background: 'var(--bg3)', borderRadius: 6, padding: '8px 10px' }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</div>
            <div style={{ fontWeight: 600, fontSize: 13, marginTop: 2 }}>{val}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function IPOCalendar() {
  const [liveIPOs,   setLiveIPOs]   = useState([])
  const [recentIPOs, setRecentIPOs] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [isLive,     setIsLive]     = useState(null)
  const [pricesLive, setPricesLive] = useState(false)
  const [lastFetch,  setLastFetch]  = useState(null)
  const [filter,     setFilter]     = useState('All')

  // Enrich recent IPOs with live current price from Yahoo Finance
  const enrichRecentIPOs = async () => {
    const enriched = await Promise.all(
      RECENT_IPOS_BASE.map(async (ipo) => {
        let currentPrice = null
        let priceSource  = null
        try {
          const r = await axios.get(`/api/stock/price-history?symbol=${ipo.nseSymbol}&period=1m`, { timeout: 8000 })
          if (r.data?.success && r.data?.data?.length > 0) {
            const last = r.data.data[r.data.data.length - 1]
            currentPrice = last.close
            priceSource  = 'yahoo'
          }
        } catch {}
        const listingGain = currentPrice != null
          ? parseFloat(((currentPrice - ipo.issuePrice) / ipo.issuePrice * 100).toFixed(2))
          : null
        return {
          ...ipo,
          status:       'Listed',
          listingPrice: currentPrice,  // current market price, not snapshot
          listingGain,
          category:     'SME/Mainboard',
          priceSource,
        }
      })
    )
    const anyLive = enriched.some(e => e.priceSource === 'yahoo')
    setRecentIPOs(enriched)
    setPricesLive(anyLive)
  }

  const load = () => {
    setLoading(true)
    Promise.allSettled([
      axios.get('/api/quotes/ipo', { timeout: 12000 }),
      enrichRecentIPOs(),
    ]).then(([nseResult]) => {
      const { data = [], isLive: live = false } = nseResult.status === 'fulfilled'
        ? (nseResult.value?.data || {})
        : {}
      if (live && Array.isArray(data) && data.length > 0) {
        const mapped = data.map(item => ({
          company:      item.companyName || item.name || item.issuerName || '—',
          priceBand:    item.minBidQuantity ? `Min lot: ${item.minBidQuantity}` : item.priceRange || '—',
          issueSize:    item.issueAmount   ? `₹${item.issueAmount} Cr` : '—',
          opens:        item.openDate  || item.biddingStartDate || '—',
          closes:       item.closeDate || item.biddingEndDate   || '—',
          status:       item.status    || 'Upcoming',
          subscribed:   item.subscriptionStatus?.total || null,
          listingPrice: item.listingPrice || null,
          listingGain:  (item.listingPrice && item.cutOffPrice)
                        ? parseFloat(((item.listingPrice - item.cutOffPrice) / item.cutOffPrice * 100).toFixed(2))
                        : null,
          category:     item.series || '—',
          isLive:       true,
        }))
        setLiveIPOs(mapped)
        setIsLive(true)
        setLastFetch(new Date())
      } else {
        setIsLive(false)
      }
      setLoading(false)
    })
  }

  useEffect(() => { load() }, []) // eslint-disable-line

  // Combine: NSE upcoming (if live) + recent listed with live prices
  const allIPOs = [
    ...(isLive && liveIPOs.length > 0 ? liveIPOs : []),
    ...recentIPOs,
  ]

  const shown = allIPOs.filter(i => filter === 'All' || i.status === filter)

  return (
    <div className="page">
      <DummyDataBanner show={isLive === false && !pricesLive} />

      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div className="page-title">IPO Calendar</div>
          <div className="page-sub">
            {isLive
              ? 'Live IPO data from NSE · Recent listings with live Yahoo Finance prices'
              : pricesLive
                ? 'Recent listings with live Yahoo Finance prices · NSE upcoming feed unavailable'
                : 'Recent IPO data · Live price fetch unavailable'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {pricesLive && (
            <span style={{ fontSize: 11, color: 'var(--positive)', fontWeight: 700 }}>● Prices: Yahoo Live</span>
          )}
          <span style={{ fontSize: 11, color: isLive ? 'var(--positive)' : 'var(--muted)' }}>
            {isLive ? `● NSE Live · ${lastFetch?.toLocaleTimeString()}` : '○ NSE feed unavailable'}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={load}>↺ Refresh</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['All', 'Upcoming', 'Open', 'Listed'].map(s => (
          <button key={s} className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(s)}>{s}</button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)', alignSelf: 'center' }}>{shown.length} IPOs</span>
      </div>

      {loading ? <Loading /> : (
        shown.length === 0 ? (
          <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>No IPOs for this filter.</div>
        ) : (
          <>
            {pricesLive && (
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>
                ℹ "Listing Price" for recent IPOs shows current market price from Yahoo Finance (not the original IPO listing day price).
                Listing Gain % = (Current Price − Issue Price) / Issue Price.
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 14 }}>
              {shown.map((ipo, i) => <IPOCard key={i} ipo={ipo} isLive={!!ipo.isLive || !!ipo.priceSource} />)}
            </div>
          </>
        )
      )}
    </div>
  )
}
