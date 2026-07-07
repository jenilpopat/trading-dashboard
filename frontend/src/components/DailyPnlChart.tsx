import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
 * Positive days are green, negative days red. With ~365 points we hide most
 * X-axis labels for readability and rely on the tooltip for exact values.
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
      <div style={{ width: '100%', height: 320 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              // ~365 labels would be unreadable — show roughly one per month.
              interval={Math.max(0, Math.floor(data.length / 12) - 1)}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              formatter={(value: number) => [formatMoney(value), 'Net P&L']}
            />
            <Bar dataKey="netPnl" isAnimationActive={false}>
              {/* Colour each bar by sign using recharts' cell fill callback. */}
              {data.map((d) => (
                <Cell key={d.date} fill={d.netPnl >= 0 ? '#128a3a' : '#c0392b'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
