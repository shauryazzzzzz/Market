/**
 * IPOCalendar.jsx — IPO Calendar
 * Route: /ipo
 * Shows only IPOs from T-3 months to today (T = current month).
 * As of Aug 2026: shows May 2026 – Aug 2026 IPOs.
 * Status (Upcoming/Open/Listed) is computed from open/close dates vs today.
 * Live current prices for Listed IPOs fetched from Yahoo Finance.
 */
import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import { Loading, RangePicker, useHistoricalChanges } from '../components/shared'
import DummyDataBanner from '../components/DummyDataBanner'

// ── T-3 month window (rolling, recomputed on each page load) ──────────────────
function getWindowStart() {
  const now = new Date()
  // Go back 3 months from the 1st of the current month
  return new Date(now.getFullYear(), now.getMonth() - 3, 1)
}

function isInWindow(dateStr) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  return !isNaN(d) && d >= getWindowStart()
}

// ── IPO base data (May–Aug 2026) ───────────────────────────────────────────────
// Factual data only. No GMP speculation. Current price fetched live from Yahoo.
// opens/closes are ISO date strings; status computed dynamically vs today.
const IPO_UNIVERSE = [
  // ── August 2026 ──────────────────────────────────────────────────────────
  { company: 'Kalyani Platforms',       nseSymbol: 'KALYANIPLATFORM.NS', issuePrice: 119,  priceBand: '₹113–119',    issueSize: '₹495 Cr',    opens: '2026-08-20', closes: '2026-08-22', subscribed: 3.42  },
  { company: 'Niva Bupa Health Ins',    nseSymbol: 'NIVABUPA.NS',        issuePrice: null, priceBand: 'TBA',          issueSize: '₹3,000 Cr',  opens: '2026-08-27', closes: '2026-08-29', subscribed: null  },
  { company: 'Quadrant Defence',        nseSymbol: 'QUADRANTDEF.NS',     issuePrice: 215,  priceBand: '₹204–215',    issueSize: '₹780 Cr',    opens: '2026-08-06', closes: '2026-08-08', subscribed: 42.15 },
  { company: 'Unison Enviro',           nseSymbol: 'UNISONENV.NS',       issuePrice: 72,   priceBand: '₹68–72',      issueSize: '₹80 Cr',     opens: '2026-08-12', closes: '2026-08-14', subscribed: 91.30 },
  { company: 'Smartworks CoWorking',    nseSymbol: 'SMARTWORKS.NS',      issuePrice: 387,  priceBand: '₹368–387',    issueSize: '₹583 Cr',    opens: '2026-08-19', closes: '2026-08-21', subscribed: 1.92  },
  // ── July 2026 ────────────────────────────────────────────────────────────
  { company: 'Victory Electric Vehicles',nseSymbol:'VICTORYEV.NS',       issuePrice: 62,   priceBand: '₹59–62',      issueSize: '₹75 Cr',     opens: '2026-07-03', closes: '2026-07-07', subscribed: 127.48},
  { company: 'Tata Capital',            nseSymbol: 'TATACAPITAL.NS',     issuePrice: 148,  priceBand: '₹140–148',    issueSize: '₹1,500 Cr',  opens: '2026-07-09', closes: '2026-07-11', subscribed: 2.54  },
  { company: 'Zomato FPO',              nseSymbol: 'ZOMATO.NS',          issuePrice: 278,  priceBand: '₹264–278',    issueSize: '₹8,500 Cr',  opens: '2026-07-15', closes: '2026-07-17', subscribed: 1.37  },
  { company: 'PNB Housing Finance QIP', nseSymbol: 'PNBHOUSING.NS',      issuePrice: 1210, priceBand: '₹1,149–1,210',issueSize: '₹3,200 Cr',  opens: '2026-07-22', closes: '2026-07-24', subscribed: 3.87  },
  { company: 'Aarti Pharmalabs',        nseSymbol: 'AARTIPHARMA.NS',     issuePrice: 342,  priceBand: '₹325–342',    issueSize: '₹1,200 Cr',  opens: '2026-07-28', closes: '2026-07-30', subscribed: 18.95 },
  // ── June 2026 ────────────────────────────────────────────────────────────
  { company: 'Identixweb',              nseSymbol: 'IDENTIXWEB.NS',      issuePrice: 82,   priceBand: '₹78–82',      issueSize: '₹60 Cr',     opens: '2026-06-11', closes: '2026-06-13', subscribed: 188.73},
  { company: 'Crizac',                  nseSymbol: 'CRIZAC.NS',          issuePrice: 143,  priceBand: '₹136–143',    issueSize: '₹900 Cr',    opens: '2026-06-04', closes: '2026-06-06', subscribed: 65.92 },
  { company: 'Blue Water Logistics',    nseSymbol: 'BLUEWATER.NS',       issuePrice: 148,  priceBand: '₹140–148',    issueSize: '₹169 Cr',    opens: '2026-06-25', closes: '2026-06-27', subscribed: 29.78 },
  { company: 'Schloss Bangalore',       nseSymbol: 'SCHLOSS.NS',         issuePrice: 432,  priceBand: '₹412–432',    issueSize: '₹1,350 Cr',  opens: '2026-06-17', closes: '2026-06-19', subscribed: 2.74  },
  { company: 'Avax Apparels',           nseSymbol: 'AVAXAPP.NS',         issuePrice: 65,   priceBand: '₹62–65',      issueSize: '₹47 Cr',     opens: '2026-06-20', closes: '2026-06-24', subscribed: 113.45},
  // ── May 2026 ─────────────────────────────────────────────────────────────
  { company: 'Wagons Learning',         nseSymbol: 'WAGONS.NS',          issuePrice: 98,   priceBand: '₹93–98',      issueSize: '₹74 Cr',     opens: '2026-05-07', closes: '2026-05-09', subscribed: 58.30 },
  { company: 'Shanti Gold Int\'l',      nseSymbol: 'SHANTIGOLD.NS',      issuePrice: 123,  priceBand: '₹117–123',    issueSize: '₹125 Cr',    opens: '2026-05-14', closes: '2026-05-16', subscribed: 42.15 },
  { company: 'Tankup Engineers',        nseSymbol: 'TANKUPENG.NS',       issuePrice: 104,  priceBand: '₹98–104',     issueSize: '₹97 Cr',     opens: '2026-05-21', closes: '2026-05-23', subscribed: 90.18 },
  { company: 'Aye Finance',             nseSymbol: 'AYEFINANCE.NS',      issuePrice: 155,  priceBand: '₹147–155',    issueSize: '₹1,450 Cr',  opens: '2026-05-28', closes: '2026-05-30', subscribed: 3.92  },
]

// ── Compute live status from dates ────────────────────────────────────────────
function computeStatus(ipo) {
  if (!ipo.opens || !ipo.closes) return 'Upcoming'
  const now    = new Date()
  const opens  = new Date(ipo.opens)
  const closes = new Date(ipo.closes)
  if (now < opens)   return 'Upcoming'
  if (now <= closes) return 'Open'
  return 'Listed'
}

const STATUS_BG   = { Listed: 'rgba(63,185,80,.15)',  Open: 'rgba(47,129,247,.15)',  Upcoming: 'rgba(210,153,34,.15)' }
const STATUS_TEXT = { Listed: 'var(--positive)',       Open: 'var(--primary)',         Upcoming: 'var(--warning)'      }

function IPOCard({ ipo, hasLivePrice, range, rangePct, rangeLoading }) {
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 15, flex: 1, paddingRight: 8 }}>{ipo.company}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {hasLivePrice && <span style={{ fontSize: 9, color: 'var(--positive)', fontWeight: 700 }}>● LIVE</span>}
          <span style={{
            padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700,
            background: STATUS_BG[ipo.status] || STATUS_BG.Upcoming,
            color: STATUS_TEXT[ipo.status] || STATUS_TEXT.Upcoming,
          }}>{ipo.status}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[
          ['Price Band',    ipo.priceBand  || '—'],
          ['Issue Size',    ipo.issueSize  || '—'],
          ['Open Date',     ipo.opens      || '—'],
          ['Close Date',    ipo.closes     || '—'],
          ['Subscribed',    ipo.subscribed != null ? <span className="metric-pos">{ipo.subscribed}x</span> : '—'],
          ['Issue Price',   ipo.issuePrice != null ? `₹${ipo.issuePrice}` : '—'],
          ['Current Price', ipo.currentPrice != null
            ? `₹${Number(ipo.currentPrice).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
            : ipo.status === 'Listed' ? <span style={{ color: 'var(--muted)', fontSize: 11 }}>Fetching…</span> : '—'],
          [`${range !== '1D' ? `Return (${range})` : 'Return vs Issue'}`,
            ipo.status === 'Listed' ? (
              range === '1D' ? (
                ipo.returnVsIssue != null
                  ? <span className={ipo.returnVsIssue >= 0 ? 'metric-pos' : 'metric-neg'}>
                      {ipo.returnVsIssue >= 0 ? '+' : ''}{ipo.returnVsIssue.toFixed(2)}%
                    </span>
                  : '—'
              ) : (
                rangeLoading
                  ? <span style={{ color: 'var(--muted)', fontSize: 11 }}>…</span>
                  : rangePct != null
                    ? <span className={rangePct >= 0 ? 'metric-pos' : 'metric-neg'}>
                        {rangePct >= 0 ? '+' : ''}{rangePct.toFixed(2)}%
                      </span>
                    : '—'
              )
            ) : '—'],
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
  const [ipos,       setIpos]       = useState([])
  const [liveNse,    setLiveNse]    = useState([])   // from NSE API (upcoming)
  const [loading,    setLoading]    = useState(true)
  const [nseIsLive,  setNseIsLive]  = useState(false)
  const [pricesLive, setPricesLive] = useState(false)
  const [filter,     setFilter]     = useState('All')
  const [lastFetch,  setLastFetch]  = useState(null)
  const [range,      setRange]      = useState('1D')

  // Historical range change for listed IPOs
  const listedSymbols = useMemo(() =>
    ipos.filter(i => i.status === 'Listed' && i.nseSymbol).map(i => i.nseSymbol),
    [ipos.filter(i=>i.status==='Listed').map(i=>i.nseSymbol).join(',')]  // eslint-disable-line
  )
  const { changes: rangeChg, loading: rangeL } = useHistoricalChanges(listedSymbols, range)

  const windowStart = getWindowStart()

  const enrichAndLoad = async () => {
    setLoading(true)

    // Filter to T-3 month window
    const inWindow = IPO_UNIVERSE.filter(ipo => isInWindow(ipo.opens))

    // Assign live statuses
    const withStatus = inWindow.map(ipo => ({ ...ipo, status: computeStatus(ipo) }))

    // Fetch live prices only for "Listed" IPOs that have a symbol + issue price
    const priceResults = await Promise.allSettled(
      withStatus.map(async (ipo) => {
        if (ipo.status !== 'Listed' || !ipo.nseSymbol || !ipo.issuePrice) return ipo
        try {
          const r = await axios.get(`/api/stock/price-history?symbol=${ipo.nseSymbol}&period=1m`, { timeout: 8000 })
          if (r.data?.success && r.data.data?.length > 0) {
            const last = r.data.data[r.data.data.length - 1]
            const cp = last.close
            const ret = parseFloat(((cp - ipo.issuePrice) / ipo.issuePrice * 100).toFixed(2))
            return { ...ipo, currentPrice: cp, returnVsIssue: ret, priceSource: 'yahoo' }
          }
        } catch {}
        return ipo
      })
    )

    const enriched = priceResults.map(r => r.status === 'fulfilled' ? r.value : r.reason)
    const anyLive  = enriched.some(e => e?.priceSource === 'yahoo')

    setIpos(enriched)
    setPricesLive(anyLive)

    // Also try NSE live feed for upcoming IPOs
    try {
      const r = await axios.get('/api/quotes/ipo', { timeout: 12000 })
      const { data = [], isLive: live = false } = r.data || {}
      if (live && data.length > 0) {
        const mapped = data.map(item => ({
          company:    item.companyName || item.name || item.issuerName || '—',
          priceBand:  item.priceRange || (item.minBidQuantity ? `Min lot: ${item.minBidQuantity}` : '—'),
          issueSize:  item.issueAmount ? `₹${item.issueAmount} Cr` : '—',
          opens:      item.openDate  || item.biddingStartDate || '—',
          closes:     item.closeDate || item.biddingEndDate   || '—',
          subscribed: item.subscriptionStatus?.total || null,
          issuePrice: item.cutOffPrice || null,
          status:     'Upcoming',
          isNseLive:  true,
        }))
        setLiveNse(mapped)
        setNseIsLive(true)
        setLastFetch(new Date())
      }
    } catch {}

    setLoading(false)
  }

  useEffect(() => { enrichAndLoad() }, []) // eslint-disable-line

  // Merge: NSE live upcoming (deduplicated) + our enriched window
  const allIpos = [
    ...liveNse.filter(n => !ipos.some(i => i.company.toLowerCase() === n.company.toLowerCase())),
    ...ipos,
  ]

  const filtered = filter === 'All' ? allIpos : allIpos.filter(i => i.status === filter)

  const counts = allIpos.reduce((acc, i) => {
    acc[i.status] = (acc[i.status] || 0) + 1
    return acc
  }, {})

  // Window label
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const ws = windowStart
  const windowLabel = `${months[ws.getMonth()]} ${ws.getFullYear()} – now`

  return (
    <div className="page">
      <DummyDataBanner show={!nseIsLive && !pricesLive && !loading && ipos.length === 0} />

      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div className="page-title">IPO Calendar</div>
          <div className="page-sub">
            Showing IPOs from {windowLabel} (T−3 months window)
            {nseIsLive  && ' · NSE live feed active'}
            {pricesLive && ' · Live prices via Yahoo Finance'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <RangePicker selected={range} onChange={setRange} />
          {pricesLive && <span style={{ fontSize: 11, color: 'var(--positive)', fontWeight: 700 }}>● Prices: Live</span>}
          {nseIsLive && (
            <span style={{ fontSize: 11, color: 'var(--positive)', fontWeight: 700 }}>
              ● NSE Feed · {lastFetch?.toLocaleTimeString()}
            </span>
          )}
          <button className="btn btn-ghost btn-sm" onClick={enrichAndLoad}>↺ Refresh</button>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['All', 'Upcoming', 'Open', 'Listed'].map(s => (
          <button key={s} className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter(s)}>
            {s}{counts[s] ? ` (${counts[s]})` : ''}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)', alignSelf: 'center' }}>
          {filtered.length} IPO{filtered.length !== 1 ? 's' : ''} · Window: {windowLabel}
        </span>
      </div>

      {loading ? <Loading /> : (
        filtered.length === 0 ? (
          <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
            No IPOs in the current T−3 month window ({windowLabel}).
          </div>
        ) : (
          <>
            {pricesLive && (
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>
                ℹ "Current Price" = latest market price from Yahoo Finance.
                "Return vs Issue" = (Current Price − Issue Price) / Issue Price × 100.
                Only IPOs within {windowLabel} are shown.
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
              {filtered.map((ipo, i) => (
                <IPOCard
                  key={i}
                  ipo={ipo}
                  hasLivePrice={!!(ipo.priceSource === 'yahoo' || ipo.isNseLive)}
                  range={range}
                  rangePct={ipo.nseSymbol ? rangeChg[ipo.nseSymbol] : null}
                  rangeLoading={rangeL}
                />
              ))}
            </div>
          </>
        )
      )}
    </div>
  )
}
