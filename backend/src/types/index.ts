/**
 * Shared TypeScript interfaces used across the backend.
 * These describe both the upstream shapes we consume and the shapes we expose.
 */

/** A single trade as returned by the upstream /api/trades endpoint. */
export interface Trade {
  id: string;
  symbol: string;
  quantity: number;
  buyPrice: number;
  sellPrice: number;
  brokerage: number;
  tradeDate: string; // "YYYY-MM-DD"
  timestamp: number;
}

/** Raw envelope returned by GET /api/trades. */
export interface UpstreamTradesResponse {
  total: number;
  generatedAt: number;
  trades: Trade[];
}

/** An instrument as returned by the upstream /api/instruments endpoint. */
export interface Instrument {
  symbol: string;
  name: string;
  basePrice: number;
}

/** Whether the cached data is currently fresh, being refreshed, or stale. */
export type DataStatus = 'fresh' | 'stale' | 'refreshing';

/** Overall performance summary (GET /api/summary). */
export interface Summary {
  grossPnl: number;
  netPnl: number;
  totalTrades: number;
  totalBrokerage: number;
  winRate: number; // percentage 0..100
  lastUpdated: number | null; // epoch ms when cache was fetched
  dataStatus: DataStatus;
}

/** One row of the per-instrument table (GET /api/instruments-summary). */
export interface InstrumentSummaryRow {
  symbol: string;
  tradeCount: number;
  totalQuantity: number;
  netPnl: number;
}

/** One point of the daily P&L series (GET /api/daily-pnl). */
export interface DailyPnlPoint {
  date: string; // "YYYY-MM-DD"
  netPnl: number;
}

/**
 * Pre-computed aggregates stored alongside the raw trades so that every REST
 * endpoint can respond in O(1) without re-scanning ~50k trades per request.
 */
export interface Aggregates {
  summary: Omit<Summary, 'lastUpdated' | 'dataStatus'>;
  instrumentsSummary: InstrumentSummaryRow[];
  dailyPnl: DailyPnlPoint[];
}

/** The full cache payload we hold in memory and persist to disk. */
export interface CachePayload {
  fetchedAt: number; // epoch ms of the successful fetch
  tradeCount: number;
  trades: Trade[];
  aggregates: Aggregates;
}
