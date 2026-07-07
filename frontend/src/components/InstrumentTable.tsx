import { useMemo, useState } from 'react';
import type { InstrumentSummaryRow } from '../types';
import { formatMoney, formatNumber, pnlClass } from '../format';

interface Props {
  rows: InstrumentSummaryRow[];
}

type SortDir = 'asc' | 'desc';

/**
 * "Performance by instrument" table.
 * Sorting by Net P&L is done client-side (the backend returns rows unsorted).
 * Click the Net P&L header to toggle ascending / descending.
 */
export function InstrumentTable({ rows }: Props) {
  const [dir, setDir] = useState<SortDir>('desc');

  const sorted = useMemo(() => {
    // Copy before sorting so we never mutate the prop array.
    return [...rows].sort((a, b) =>
      dir === 'asc' ? a.netPnl - b.netPnl : b.netPnl - a.netPnl,
    );
  }, [rows, dir]);

  const toggle = () => setDir((d) => (d === 'asc' ? 'desc' : 'asc'));

  return (
    <section>
      <h2>Performance by Instrument</h2>
      <table>
        <thead>
          <tr>
            <th>Symbol</th>
            <th className="num">Trades</th>
            <th className="num">Total Quantity</th>
            <th className="num sortable" onClick={toggle}>
              Net P&amp;L {dir === 'asc' ? '▲' : '▼'}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.symbol}>
              <td>{row.symbol}</td>
              <td className="num">{formatNumber(row.tradeCount)}</td>
              <td className="num">{formatNumber(row.totalQuantity)}</td>
              <td className={`num ${pnlClass(row.netPnl)}`}>
                {formatMoney(row.netPnl)}
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={4} className="muted">
                No instrument data available.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
