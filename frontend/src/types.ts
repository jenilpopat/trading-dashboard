/** Shapes returned by the backend REST API and the WebSocket feed. */

export type DataStatus = 'fresh' | 'stale' | 'refreshing';

export interface Summary {
  grossPnl: number;
  netPnl: number;
  totalTrades: number;
  totalBrokerage: number;
  winRate: number;
  lastUpdated: number | null;
  dataStatus: DataStatus;
}

export interface InstrumentSummaryRow {
  symbol: string;
  tradeCount: number;
  totalQuantity: number;
  netPnl: number;
}

export interface DailyPnlPoint {
  date: string;
  netPnl: number;
}

export interface Instrument {
  symbol: string;
  name: string;
  basePrice: number;
}

/** A live-price tick received over the WebSocket. */
export interface Tick {
  type: 'tick';
  seq: number;
  symbol: string;
  price: number;
  basePrice: number;
  ts: number;
}

/** Connection status shown in the Live Prices header. */
export type ConnectionStatus = 'Connected' | 'Reconnecting' | 'Disconnected';

/** Per-symbol live state kept by the WebSocket hook. */
export interface LivePrice {
  symbol: string;
  price: number;
  basePrice: number;
  seq: number;
  updatedAt: number; // used to flash the card on update
}
