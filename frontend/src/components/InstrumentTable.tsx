import { useMemo, useState } from 'react';
import type { InstrumentSummaryRow } from '../types';
import { formatMoney, formatNumber, pnlClass } from '../format';

interface Props {
  rows: InstrumentSummaryRow[];
}

type SortDir = 'asc' | 'desc';

/**
 * "Performance by instrument" section, rendered as a responsive grid of cards
 * (one per instrument) instead of a table. Sorting by Net P&L is done
 * client-side; the toolbar button toggles ascending / descending.
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

      {sorted.length === 0 ? (
        <p className="muted">No instrument data available.</p>
      ) : (
        <>
          <div className="inst-toolbar">
            <button className="ghost-btn" onClick={toggle}>
              Sort by Net P&amp;L {dir === 'asc' ? '↑ Low first' : '↓ High first'}
            </button>
          </div>

          <div className="inst-grid">
            {sorted.map((row) => {
              const up = row.netPnl >= 0;
              return (
                <div
                  key={row.symbol}
                  className={`inst-card ${up ? 'pos-accent' : 'neg-accent'}`}
                >
                  <div className="inst-card-head">
                    <span className="inst-symbol">{row.symbol}</span>
                    <span className={`inst-badge ${pnlClass(row.netPnl)}`}>
                      {up ? '▲' : '▼'} {formatMoney(row.netPnl)}
                    </span>
                  </div>
                  <div className="inst-meta">
                    <div className="inst-stat">
                      <span className="inst-stat-label">Trades</span>
                      <span className="inst-stat-value">
                        {formatNumber(row.tradeCount)}
                      </span>
                    </div>
                    <div className="inst-stat">
                      <span className="inst-stat-label">Total Qty</span>
                      <span className="inst-stat-value">
                        {formatNumber(row.totalQuantity)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
