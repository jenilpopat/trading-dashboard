import type {
  Aggregates,
  DailyPnlPoint,
  InstrumentSummaryRow,
  Trade,
} from '../types';

/**
 * Net P&L of a single trade.
 * Gross = (sellPrice - buyPrice) * quantity, then subtract that trade's brokerage.
 * A trade is a "win" when this value is > 0.
 */
function tradeNetPnl(trade: Trade): number {
  const gross = (trade.sellPrice - trade.buyPrice) * trade.quantity;
  return gross - trade.brokerage;
}

/**
 * Compute ALL aggregates in a single pass over the trades array.
 *
 * WHY one pass: the upstream returns ~50,000 trades. We only ever want to walk
 * that array once — at cache-build time — and store the results. Every REST
 * endpoint then reads a tiny pre-computed object instead of re-scanning 50k rows
 * on every request. This keeps API responses effectively O(1).
 */
export function computeAggregates(trades: Trade[]): Aggregates {
  let grossPnl = 0;
  let totalBrokerage = 0;
  let winningTrades = 0;

  // Accumulators keyed by symbol (per-instrument table).
  const bySymbol = new Map<
    string,
    { tradeCount: number; totalQuantity: number; netPnl: number }
  >();

  // Accumulator keyed by tradeDate (daily P&L series).
  const byDate = new Map<string, number>();

  for (const trade of trades) {
    const gross = (trade.sellPrice - trade.buyPrice) * trade.quantity;
    const net = gross - trade.brokerage;

    grossPnl += gross;
    totalBrokerage += trade.brokerage;
    if (net > 0) winningTrades += 1;

    // Per-symbol rollup.
    const sym = bySymbol.get(trade.symbol) ?? {
      tradeCount: 0,
      totalQuantity: 0,
      netPnl: 0,
    };
    sym.tradeCount += 1;
    sym.totalQuantity += trade.quantity;
    sym.netPnl += net;
    bySymbol.set(trade.symbol, sym);

    // Per-day rollup.
    byDate.set(trade.tradeDate, (byDate.get(trade.tradeDate) ?? 0) + net);
  }

  const totalTrades = trades.length;
  const netPnl = grossPnl - totalBrokerage;
  // Guard against divide-by-zero when there are no trades.
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

  const instrumentsSummary: InstrumentSummaryRow[] = Array.from(
    bySymbol.entries(),
  ).map(([symbol, v]) => ({
    symbol,
    tradeCount: v.tradeCount,
    totalQuantity: v.totalQuantity,
    // Round money to 2 decimals to avoid floating-point noise in the response.
    netPnl: round2(v.netPnl),
  }));

  const dailyPnl: DailyPnlPoint[] = Array.from(byDate.entries())
    .map(([date, net]) => ({ date, netPnl: round2(net) }))
    // Sort ascending by date so the frontend chart reads left-to-right in time.
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    summary: {
      grossPnl: round2(grossPnl),
      netPnl: round2(netPnl),
      totalTrades,
      totalBrokerage: round2(totalBrokerage),
      winRate: round2(winRate),
    },
    instrumentsSummary,
    dailyPnl,
  };
}

/** Round to 2 decimal places (all money values are rupees with 2 decimals). */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Exported for potential unit tests / reuse.
export { tradeNetPnl };
