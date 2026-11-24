import React, { useMemo, useState } from 'react';
import { TrendingUp, IndianRupee, ShoppingBag, Percent, Award } from 'lucide-react';
import { addDays, todayStr, formatCurrency } from '../api.js';

function getBookingDate(b) {
  return b.functionDate || (b.createdAt ? b.createdAt.slice(0, 10) : todayStr());
}

function getWeekKey(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay() || 7; // 1=Mon..7=Sun
  dt.setUTCDate(dt.getUTCDate() - (day - 1));
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function SalesAnalytics({ bookings }) {
  const today = todayStr();
  const [period, setPeriod] = useState('monthly'); // 'daily' | 'weekly' | 'monthly' | 'range'
  const [rangeStart, setRangeStart] = useState(addDays(today, -30));
  const [rangeEnd, setRangeEnd] = useState(today);
  const [hoveredIdx, setHoveredIdx] = useState(null);

  // Filter non-cancelled bookings by selected timeframe
  const filteredBookings = useMemo(() => {
    const valid = (bookings || []).filter((b) => b.status !== 'Cancelled');
    let start = null;
    let end = null;

    if (period === 'daily') {
      start = addDays(today, -13); // last 14 days
      end = addDays(today, 30);
    } else if (period === 'weekly') {
      start = addDays(today, -56); // last 8 weeks
      end = addDays(today, 30);
    } else if (period === 'monthly') {
      start = addDays(today, -180); // last 6 months
      end = addDays(today, 60);
    } else if (period === 'range') {
      start = rangeStart;
      end = rangeEnd;
    }

    return valid.filter((b) => {
      const d = getBookingDate(b);
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });
  }, [bookings, period, rangeStart, rangeEnd, today]);

  // KPI Metrics
  const kpis = useMemo(() => {
    const totalRevenue = filteredBookings.reduce((sum, b) => sum + Number(b.finalPrice || 0), 0);
    const totalDiscount = filteredBookings.reduce((sum, b) => sum + Number(b.discountAmount || 0), 0);
    const count = filteredBookings.length;
    const avgOrder = count > 0 ? totalRevenue / count : 0;
    return { totalRevenue, totalDiscount, count, avgOrder };
  }, [filteredBookings]);

  // Chart Series grouped by Day / Week / Month
  const chartData = useMemo(() => {
    const buckets = new Map();
    const groupMode = period === 'monthly' ? 'month' : period === 'weekly' ? 'week' : 'day';

    for (const b of filteredBookings) {
      const d = getBookingDate(b);
      let key = d;
      let label = d.slice(5); // MM-DD
      if (groupMode === 'week') {
        key = getWeekKey(d);
        label = `Wk ${key.slice(5)}`;
      } else if (groupMode === 'month') {
        key = d.slice(0, 7); // YYYY-MM
        label = key;
      }

      const prev = buckets.get(key) || { key, label, revenue: 0, count: 0 };
      prev.revenue += Number(b.finalPrice || 0);
      prev.count += 1;
      buckets.set(key, prev);
    }

    return Array.from(buckets.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [filteredBookings, period]);

  const maxRevenue = useMemo(
    () => Math.max(1, ...chartData.map((d) => d.revenue)),
    [chartData]
  );

  // Category Breakdown (Dress vs Jewelry)
  const categoryStats = useMemo(() => {
    const map = { Dress: { revenue: 0, count: 0 }, Jewelry: { revenue: 0, count: 0 } };
    for (const b of filteredBookings) {
      const cat = b.productCategory === 'Jewelry' ? 'Jewelry' : 'Dress';
      map[cat].revenue += Number(b.finalPrice || 0);
      map[cat].count += 1;
    }
    const total = map.Dress.revenue + map.Jewelry.revenue || 1;
    return [
      { name: 'Dress', ...map.Dress, pct: Math.round((map.Dress.revenue / total) * 100), color: '#8f1d35' },
      { name: 'Jewelry', ...map.Jewelry, pct: Math.round((map.Jewelry.revenue / total) * 100), color: '#b48332' }
    ];
  }, [filteredBookings]);

  // Top Rented Products
  const topProducts = useMemo(() => {
    const map = new Map();
    for (const b of filteredBookings) {
      const key = b.productId || b.productName;
      const prev = map.get(key) || {
        name: b.productName || 'Item',
        category: b.productCategory || '',
        revenue: 0,
        count: 0
      };
      prev.revenue += Number(b.finalPrice || 0);
      prev.count += 1;
      map.set(key, prev);
    }
    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [filteredBookings]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Period Selector Bar */}
      <div
        className="card"
        style={{
          padding: '14px 18px',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12
        }}
      >
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { id: 'daily', label: 'Daily' },
            { id: 'weekly', label: 'Weekly' },
            { id: 'monthly', label: 'Monthly' },
            { id: 'range', label: 'Custom Range' }
          ].map((opt) => (
            <button
              key={opt.id}
              className={`btn btn-sm ${period === opt.id ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setPeriod(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {period === 'range' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="date"
              style={{ padding: '7px 10px', borderRadius: 9, border: '1px solid var(--border)' }}
              value={rangeStart}
              onChange={(e) => setRangeStart(e.target.value)}
            />
            <span style={{ color: 'var(--ink-muted)' }}>to</span>
            <input
              type="date"
              style={{ padding: '7px 10px', borderRadius: 9, border: '1px solid var(--border)' }}
              value={rangeEnd}
              onChange={(e) => setRangeEnd(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ink-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
            <span>Total Revenue</span>
            <IndianRupee size={16} color="var(--gold)" />
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 700, marginTop: 6, color: 'var(--gold-dark)' }}>
            {formatCurrency(kpis.totalRevenue)}
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ink-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
            <span>Total Bookings</span>
            <ShoppingBag size={16} color="var(--ink)" />
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 700, marginTop: 6 }}>{kpis.count}</div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ink-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
            <span>Avg. Booking Value</span>
            <TrendingUp size={16} color="var(--emerald)" />
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 700, marginTop: 6 }}>{formatCurrency(kpis.avgOrder)}</div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ink-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
            <span>Total Discounts</span>
            <Percent size={16} color="var(--crimson)" />
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 700, marginTop: 6, color: 'var(--emerald)' }}>
            {formatCurrency(kpis.totalDiscount)}
          </div>
        </div>
      </div>

      {/* Revenue Bar Chart */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0 }}>
            Revenue Trend ({period === 'daily' ? 'Daily' : period === 'weekly' ? 'Weekly' : period === 'monthly' ? 'Monthly' : `${rangeStart} → ${rangeEnd}`})
          </h3>
          {hoveredIdx !== null && chartData[hoveredIdx] && (
            <span className="badge badge-gold">
              {chartData[hoveredIdx].label}: {formatCurrency(chartData[hoveredIdx].revenue)} ({chartData[hoveredIdx].count} booking{chartData[hoveredIdx].count === 1 ? '' : 's'})
            </span>
          )}
        </div>

        {chartData.length === 0 ? (
          <p style={{ color: 'var(--ink-muted)', margin: '24px 0', textAlign: 'center' }}>
            No booking data in this timeframe yet.
          </p>
        ) : (
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <svg
              viewBox={`0 0 ${Math.max(560, chartData.length * 72)} 240`}
              style={{ width: '100%', height: 240, display: 'block' }}
            >
              {/* Horizontal grid lines */}
              {[0.25, 0.5, 0.75, 1].map((frac) => {
                const y = 195 - frac * 160;
                return (
                  <g key={frac}>
                    <line x1="20" x2={Math.max(540, chartData.length * 72 - 20)} y1={y} y2={y} stroke="#ebe3d7" strokeDasharray="4 4" />
                  </g>
                );
              })}

              {chartData.map((d, idx) => {
                const slotW = Math.max(520, chartData.length * 72 - 40) / chartData.length;
                const barW = Math.min(44, slotW * 0.58);
                const x = 20 + idx * slotW + (slotW - barW) / 2;
                const barH = Math.max(6, (d.revenue / maxRevenue) * 160);
                const y = 195 - barH;
                const isHovered = hoveredIdx === idx;

                return (
                  <g
                    key={d.key}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    style={{ cursor: 'pointer' }}
                  >
                    <rect
                      x={x}
                      y={y}
                      width={barW}
                      height={barH}
                      rx={6}
                      fill={isHovered ? '#8c621d' : '#b48332'}
                    />
                    <text
                      x={x + barW / 2}
                      y={y - 6}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="600"
                      fill="#6b5e54"
                    >
                      {d.revenue >= 1000 ? `₹${(d.revenue / 1000).toFixed(1)}k` : `₹${d.revenue}`}
                    </text>
                    <text
                      x={x + barW / 2}
                      y={216}
                      textAnchor="middle"
                      fontSize="11"
                      fill="#6b5e54"
                    >
                      {d.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>

      {/* Category Breakdown & Top Products */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 18 }}>
        <div className="card">
          <h3 style={{ marginTop: 0, marginBottom: 14 }}>Sales by Category</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {categoryStats.map((cat) => (
              <div key={cat.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem', marginBottom: 6 }}>
                  <strong>{cat.name} ({cat.count})</strong>
                  <span>{formatCurrency(cat.revenue)} ({cat.pct}%)</span>
                </div>
                <div style={{ height: 10, background: 'var(--surface-soft)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${cat.pct}%`, height: '100%', background: cat.color, borderRadius: 999 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Award size={18} color="var(--gold)" /> Top Rented Products
          </h3>
          {topProducts.length === 0 ? (
            <p style={{ color: 'var(--ink-muted)', margin: 0 }}>No rentals in this period.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topProducts.map((p, idx) => (
                <div
                  key={p.name}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 10px',
                    borderRadius: 10,
                    background: 'var(--surface-soft)'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                      {idx + 1}. {p.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
                      {p.category} · {p.count} booking{p.count === 1 ? '' : 's'}
                    </div>
                  </div>
                  <strong style={{ color: 'var(--gold-dark)' }}>{formatCurrency(p.revenue)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
