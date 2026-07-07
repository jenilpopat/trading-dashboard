import type {
  DailyPnlPoint,
  Instrument,
  InstrumentSummaryRow,
  Summary,
} from './types';

/**
 * Tiny API client for all backend calls.
 * Every dashboard section goes through here, so the backend URL and error
 * handling live in exactly one place.
 */

const BASE = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:4000';

/** Generic typed GET/POST helper that throws on non-2xx responses. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    // Try to surface the backend's error message if there is one.
    let detail = '';
    try {
      const body = (await res.json()) as { message?: string; error?: string };
      detail = body.message ?? body.error ?? '';
    } catch {
      /* body wasn't JSON — ignore */
    }
    throw new Error(detail || `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

/** Response shape from POST /api/refresh. */
export interface RefreshResponse {
  status: 'ok' | 'refreshing' | 'error';
  message?: string;
  summary: Summary;
}

export const api = {
  getSummary: () => request<Summary>('/api/summary'),
  getInstrumentsSummary: () =>
    request<InstrumentSummaryRow[]>('/api/instruments-summary'),
  getDailyPnl: () => request<DailyPnlPoint[]>('/api/daily-pnl'),
  getInstruments: () => request<Instrument[]>('/api/instruments'),
  refresh: () => request<RefreshResponse>('/api/refresh', { method: 'POST' }),
};
