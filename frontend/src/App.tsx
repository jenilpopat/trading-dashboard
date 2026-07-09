import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { DailyPnlChart } from './components/DailyPnlChart';
import { InstrumentTable } from './components/InstrumentTable';
import { LivePrices } from './components/LivePrices';
import { SummaryCards } from './components/SummaryCards';
import type {
  DailyPnlPoint,
  Instrument,
  InstrumentSummaryRow,
  Summary,
} from './types';

/**
 * Single-page dashboard.
 * Loads all REST data from the backend on mount, wires up the Refresh button,
 * and renders the four sections. Each section has its own loading/error state.
 */
export default function App() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [instrumentRows, setInstrumentRows] = useState<InstrumentSummaryRow[]>(
    [],
  );
  const [dailyPnl, setDailyPnl] = useState<DailyPnlPoint[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  /** Load every dashboard dataset from the backend in parallel. */
  const loadAll = useCallback(async () => {
    setError(null);
    try {
      const [s, rows, daily, insts] = await Promise.all([
        api.getSummary(),
        api.getInstrumentsSummary(),
        api.getDailyPnl(),
        api.getInstruments(),
      ]);
      setSummary(s);
      setInstrumentRows(rows);
      setDailyPnl(daily);
      setInstruments(insts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  /**
   * Trigger a backend refresh, then reload all dashboard data.
   * Handles the "refresh already in progress" case (backend returns 202 with a
   * "refreshing" status) and the error case (stale data still served) cleanly.
   */
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshMessage(null);
    try {
      const res = await api.refresh();
      if (res.status === 'refreshing') {
        setRefreshMessage('A refresh is already in progress — please wait.');
      } else {
        setRefreshMessage('Data refreshed.');
      }
      // Reload all sections regardless, to reflect the newest cache.
      await loadAll();
    } catch (err) {
      // Backend responds non-2xx when upstream failed after all retries; it is
      // still serving stale data, so surface the message but keep the UI.
      setRefreshMessage(
        err instanceof Error ? err.message : 'Refresh failed (showing stale data)',
      );
      await loadAll();
    } finally {
      setRefreshing(false);
    }
  }, [loadAll]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="logo">📈</div>
          <div>
            <h1>Real-Time Trading Dashboard</h1>
            <p className="subtitle">
              Cached trade analytics + live prices over WebSocket
            </p>
          </div>
        </div>
      </header>

      {loading && <p className="muted">Loading dashboard…</p>}
      {error && (
        <p className="error">
          Failed to load dashboard: {error}. Is the backend running?
        </p>
      )}

      {!loading && !error && summary && (
        <>
          <SummaryCards
            summary={summary}
            onRefresh={handleRefresh}
            refreshing={refreshing}
            refreshMessage={refreshMessage}
          />
          <InstrumentTable rows={instrumentRows} />
          <DailyPnlChart data={dailyPnl} />
          {/* Live prices connect directly to the upstream WS from the browser. */}
          <LivePrices instruments={instruments} />
        </>
      )}
    </div>
  );
}
