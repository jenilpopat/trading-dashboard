import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DailyPnlPoint } from '../types';
import { formatMoney } from '../format';

interface Props {
  data: DailyPnlPoint[];
}

/**
 * "Daily P&L" section: a bar chart of net P&L per day over the past year.
 * Positive days are green, negative days red, each with a vertical gradient
 * fill and rounded tops. With ~365 points we hide most X-axis labels for
 * readability and rely on the tooltip for exact values.
 */
export function DailyPnlChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <section>
        <h2>Daily P&amp;L</h2>
        <p className="muted">No daily P&amp;L data available.</p>
      </section>
    );
  }

  return (
    <section>
      <h2>Daily P&amp;L (past year)</h2>
      <div className="chart-panel">
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <defs>
                <linearGradient id="barGreen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1fe08f" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#16c784" stopOpacity={0.45} />
                </linearGradient>
                <linearGradient id="barRed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ea3943" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#ff5a63" stopOpacity={0.95} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="rgba(255,255,255,0.06)"
              />
              <XAxis
                dataKey="date"
                // ~365 labels would be unreadable — show roughly one per month.
                interval={Math.max(0, Math.floor(data.length / 12) - 1)}
                tick={{ fontSize: 11, fill: '#8b93a7' }}
                stroke="rgba(255,255,255,0.1)"
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#8b93a7' }}
                stroke="rgba(255,255,255,0.1)"
                tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                formatter={(value: number) => [formatMoney(value), 'Net P&L']}
              />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
              <Bar dataKey="netPnl" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                {/* Colour each bar by sign using recharts' cell fill callback. */}
                {data.map((d) => (
                  <Cell
                    key={d.date}
                    fill={d.netPnl >= 0 ? 'url(#barGreen)' : 'url(#barRed)'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
