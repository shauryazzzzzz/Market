import { useState, useEffect } from 'react'
import axios from 'axios'
import { Loading, ErrorBox, SectorBadge, Change } from '../components/shared'

function ShockerCard({ title, label, rows, valueKey, tone }) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-label">{label}</div>
          <div className="card-title">{title}</div>
        </div>
        <span style={{ fontSize: 22 }}>{tone === 'pos' ? '🚀' : '📦'}</span>
      </div>
      {!rows?.length
        ? <div className="loading" style={{ padding: 12 }}>No data — DB may need trading_data</div>
        : rows.map((r, i) => (
          <div className="stat-row" key={i}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{r.ticker}</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                <SectorBadge sector={r.sector} />
                {r.current_price && <span style={{ fontSize: 11, color: 'var(--muted)' }}>₹{parseFloat(r.current_price).toLocaleString('en-IN')}</span>}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className={tone === 'pos' ? 'metric-pos' : 'metric-neg'} style={{ fontWeight: 700, fontSize: 14 }}>
                {parseFloat(r[valueKey] || 0).toFixed(1)}%
              </span>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>
                {valueKey === 'high_52w_potential' ? 'to 52W High' :
                 valueKey === 'momentum_return'    ? '1Y Return' :
                 valueKey === 'delivery_percentage' ? 'Delivery' : valueKey}
              </div>
            </div>
          </div>
        ))
      }
    </div>
  )
}

export default function Shockers() {
  const [data, setData]     = useState({ high: [], low: [], momentum: [], volume: [], results: null })
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    Promise.allSettled([
      axios.get('/api/markets/shockers/near-52w-high?limit=10'),
      axios.get('/api/markets/shockers/near-52w-low?limit=10'),
      axios.get('/api/markets/shockers/momentum?limit=10'),
      axios.get('/api/markets/shockers/volume?limit=10'),
      axios.get('/api/markets/shockers/results'),
    ]).then(([h, l, m, v, r]) => {
      setData({
        high:     h.status === 'fulfilled' ? h.value.data?.data || [] : [],
        low:      l.status === 'fulfilled' ? l.value.data?.data || [] : [],
        momentum: m.status === 'fulfilled' ? m.value.data?.data || [] : [],
        volume:   v.status === 'fulfilled' ? v.value.data?.data || [] : [],
        results:  r.status === 'fulfilled' ? r.value.data?.data : null,
      })
      if (h.status === 'rejected') setError('Financial Monitor API not reachable on :5000')
      setLoading(false)
    })
  }, [])

  return (
    <div className="page">
      <div className="page-title">⚡ Stock Shockers</div>
      <div className="page-sub">Breakout watch · Momentum leaders · Volume alerts · Results surprises</div>

      <ErrorBox msg={error} />

      {loading ? <Loading /> : (
        <>
          <div className="grid-2">
            <ShockerCard title="Breakout Watch"  label="Near 52-Week High" rows={data.high}     valueKey="high_52w_potential"  tone="pos" />
            <ShockerCard title="Oversold Zone"   label="Near 52-Week Low"  rows={data.low}      valueKey="high_52w_potential"  tone="neg" />
          </div>
          <div className="grid-2">
            <ShockerCard title="Strong Movers"   label="Momentum Stocks"   rows={data.momentum} valueKey="momentum_return"     tone="pos" />
            <ShockerCard title="High Delivery"   label="Volume Shockers"   rows={data.volume}   valueKey="delivery_percentage" tone="pos" />
          </div>

          {data.results && (
            <div className="grid-2">
              <div className="card">
                <div className="card-header">
                  <div><div className="card-label">Earnings Beat</div><div className="card-title">Positive Surprises</div></div>
                  <span style={{ fontSize: 22 }}>🏆</span>
                </div>
                {data.results.positive?.map((r, i) => (
                  <div className="stat-row" key={i}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{r.ticker}</div>
                      <SectorBadge sector={r.sector} />
                    </div>
                    <span className="metric-pos" style={{ fontWeight: 700 }}>+{parseFloat(r.profit_growth_1y || 0).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
              <div className="card">
                <div className="card-header">
                  <div><div className="card-label">Earnings Miss</div><div className="card-title">Negative Surprises</div></div>
                  <span style={{ fontSize: 22 }}>⚠️</span>
                </div>
                {data.results.negative?.map((r, i) => (
                  <div className="stat-row" key={i}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{r.ticker}</div>
                      <SectorBadge sector={r.sector} />
                    </div>
                    <span className="metric-neg" style={{ fontWeight: 700 }}>{parseFloat(r.profit_growth_1y || 0).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
