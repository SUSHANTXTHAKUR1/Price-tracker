import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { TrendingUp, Calendar, AlertCircle } from 'lucide-react';

export default function PriceStockChart({ product, history = [] }) {
  if (!product) return null;

  const chartData = history.map((h) => {
    const d = new Date(h.recorded_at);
    return {
      timestamp: h.recorded_at,
      timeFormatted: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      dateFormatted: d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
      price: Number(h.price),
      mrp: h.mrp ? Number(h.mrp) : null,
      stock: Number(h.stock)
    };
  });

  const currency = history[0]?.currency || 'INR';

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: '24px', marginBottom: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <TrendingUp size={18} color="var(--accent-secondary)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
              Price & Stock History: {product.product_name}
            </h3>
          </div>
          <span className="option-badge" style={{ margin: 0 }}>
            Option: {product.selected_option_label || product.selected_option}
          </span>
        </div>

        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {chartData.length} data point{chartData.length !== 1 ? 's' : ''} recorded
        </div>
      </div>

      {chartData.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          <AlertCircle size={28} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
          <p>No historical data points yet for this product.</p>
          <p style={{ fontSize: '0.78rem' }}>Trigger a scrape or wait for scheduled cron to record price trends.</p>
        </div>
      ) : (
        <div style={{ height: '280px', width: '100%', marginTop: '10px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="timeFormatted"
                stroke="var(--text-muted)"
                fontSize={11}
                tickLine={false}
              />
              <YAxis
                stroke="var(--text-muted)"
                fontSize={11}
                tickLine={false}
                domain={['auto', 'auto']}
                tickFormatter={(val) => `₹${val}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#111827',
                  borderColor: 'rgba(255,255,255,0.15)',
                  borderRadius: '10px',
                  color: '#ffffff',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
                }}
                formatter={(value, name) => {
                  if (name === 'price') return [`₹${value.toLocaleString()}`, 'Selling Price'];
                  if (name === 'stock') return [`${value} units`, 'In Stock'];
                  return [value, name];
                }}
                labelFormatter={(label, payload) => {
                  if (payload && payload[0]) {
                    const d = new Date(payload[0].payload.timestamp);
                    return `${d.toLocaleDateString()} at ${d.toLocaleTimeString()}`;
                  }
                  return label;
                }}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke="#6366f1"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#priceGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
