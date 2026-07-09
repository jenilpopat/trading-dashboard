import type { Summary } from '../types';
import { formatMoney, formatNumber, formatTime, pnlClass } from '../format';

interface Props {
  summary: Summary;
  onRefresh: () => void;
  refreshing: boolean;
  refreshMessage: string | null;
}

/**
 * "Overall performance" section: five summary cards plus the last-updated time,
 * a data-status pill, and the Refresh button.
 */
export function SummaryCards({
  summary,
  onRefresh,
  refreshing,
  refreshMessage,
}: Props) {
  return (
    <section>
      <h2>Overall Performance</h2>

      <div className="cards">
        <div className={`card ${summary.grossPnl >= 0 ? 'pos-accent' : 'neg-accent'}`}>
          <div className="label">Gross P&amp;L</div>
          <div className={`value ${pnlClass(summary.grossPnl)}`}>
            {formatMoney(summary.grossPnl)}
          </div>
        </div>

        <div className={`card ${summary.netPnl >= 0 ? 'pos-accent' : 'neg-accent'}`}>
          <div className="label">Net P&amp;L</div>
          <div className={`value ${pnlClass(summary.netPnl)}`}>
            {formatMoney(summary.netPnl)}
          </div>
        </div>

        <div className="card">
          <div className="label">Number of Trades</div>
          <div className="value">{formatNumber(summary.totalTrades)}</div>
        </div>

        <div className="card">
          <div className="label">Total Brokerage</div>
          <div className="value">{formatMoney(summary.totalBrokerage)}</div>
        </div>

        <div className="card">
          <div className="label">Win Rate</div>
          <div className="value">{summary.winRate.toFixed(2)}%</div>
        </div>
      </div>

      <div className="toolbar">
        <span className="muted">
          Last updated: {formatTime(summary.lastUpdated)}
        </span>
        <span className={`status-pill status-${summary.dataStatus}`}>
          {summary.dataStatus}
        </span>
        {refreshMessage && <span className="muted">{refreshMessage}</span>}
        <span className="toolbar-spacer" />
        <button onClick={onRefresh} disabled={refreshing}>
          {refreshing ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>
    </section>
  );
}
