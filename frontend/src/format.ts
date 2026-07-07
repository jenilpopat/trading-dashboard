/** Small formatting helpers shared across components. */

/** Format a rupee amount with the ₹ symbol and 2 decimals (grouped). */
export function formatMoney(n: number): string {
  return `₹${n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Format a plain number with thousands separators. */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-IN');
}

/** Format an epoch-ms timestamp as a readable local time, or a dash if null. */
export function formatTime(ts: number | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-IN');
}

/** CSS class for a value: green if positive, red if negative. */
export function pnlClass(n: number): string {
  return n >= 0 ? 'pos' : 'neg';
}
