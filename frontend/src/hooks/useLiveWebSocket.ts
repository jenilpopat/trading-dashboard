import { useEffect, useRef, useState } from 'react';
import type { ConnectionStatus, LivePrice, Tick } from '../types';

const WS_URL =
  import.meta.env.VITE_WS_URL ?? 'wss://mocktrading-silk.vercel.app/ws';

// Reconnect backoff: start at 1s, double each attempt, cap at 15s.
const BASE_RECONNECT_MS = 1_000;
const MAX_RECONNECT_MS = 15_000;
// How often we proactively ping the server to keep the connection alive.
const PING_INTERVAL_MS = 25_000;

interface UseLiveWebSocketResult {
  status: ConnectionStatus;
  prices: Record<string, LivePrice>;
}

/**
 * Robust live-price WebSocket hook.
 *
 * Responsibilities:
 *  - Connect directly to the upstream WS and subscribe to all symbols.
 *  - Drop stale/out-of-order ticks using the monotonic `seq` per symbol.
 *  - Auto-reconnect with exponential backoff and re-subscribe on reconnect.
 *  - Send periodic pings and answer server pings to stay alive.
 *
 * We store mutable connection bits in refs (not state) so reconnect logic
 * doesn't churn React renders; only `status` and `prices` drive the UI.
 */
export function useLiveWebSocket(symbols: string[]): UseLiveWebSocketResult {
  const [status, setStatus] = useState<ConnectionStatus>('Disconnected');
  const [prices, setPrices] = useState<Record<string, LivePrice>>({});

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  // Last seen seq per symbol — the core of stale-tick rejection.
  const lastSeq = useRef<Record<string, number>>({});
  // Keep the latest symbols in a ref so the socket callbacks always subscribe
  // to the current list without re-creating the whole connection.
  const symbolsRef = useRef<string[]>(symbols);
  // Guards against reconnecting after the component has unmounted.
  const closedByUs = useRef(false);

  // Join symbols into a stable key so the effect only re-runs when the actual
  // set of symbols changes, not on every render.
  const symbolsKey = symbols.slice().sort().join(',');

  useEffect(() => {
    symbolsRef.current = symbols;
    closedByUs.current = false;

    // Don't open a socket until we actually have symbols to subscribe to.
    if (symbols.length === 0) return;

    connect();

    // Cleanup: stop timers and close the socket when symbols change/unmount.
    return () => {
      closedByUs.current = true;
      clearTimers();
      wsRef.current?.close();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey]);

  function clearTimers(): void {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    if (pingTimer.current) clearInterval(pingTimer.current);
    reconnectTimer.current = null;
    pingTimer.current = null;
  }

  function subscribeAll(ws: WebSocket): void {
    ws.send(
      JSON.stringify({ action: 'subscribe', symbols: symbolsRef.current }),
    );
  }

  function startPinging(ws: WebSocket): void {
    if (pingTimer.current) clearInterval(pingTimer.current);
    pingTimer.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'ping' }));
      }
    }, PING_INTERVAL_MS);
  }

  function scheduleReconnect(): void {
    if (closedByUs.current) return;
    setStatus('Reconnecting');

    // Exponential backoff with a cap so we don't hammer a down server.
    const delay = Math.min(
      BASE_RECONNECT_MS * 2 ** reconnectAttempts.current,
      MAX_RECONNECT_MS,
    );
    reconnectAttempts.current += 1;
    reconnectTimer.current = setTimeout(connect, delay);
  }

  function connect(): void {
    // Clean up any previous socket first.
    clearTimers();

    let ws: WebSocket;
    try {
      ws = new WebSocket(WS_URL);
    } catch {
      scheduleReconnect();
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttempts.current = 0; // reset backoff on a good connection
      setStatus('Connected');
      subscribeAll(ws);
      startPinging(ws);
    };

    ws.onmessage = (event) => {
      let msg: unknown;
      try {
        msg = JSON.parse(event.data as string);
      } catch {
        return; // ignore non-JSON frames
      }

      const data = msg as { type?: string };
      if (data.type !== 'tick') return; // welcome/subscribed/pong: nothing to do

      const tick = msg as Tick;

      // --- Stale / out-of-order protection ---
      // seq only ever increases per symbol. If we've already seen an equal or
      // higher seq for this symbol, this frame is stale — drop it.
      const prev = lastSeq.current[tick.symbol];
      if (prev !== undefined && tick.seq <= prev) return;
      lastSeq.current[tick.symbol] = tick.seq;

      setPrices((current) => ({
        ...current,
        [tick.symbol]: {
          symbol: tick.symbol,
          price: tick.price,
          basePrice: tick.basePrice,
          seq: tick.seq,
          updatedAt: tick.ts,
        },
      }));
    };

    ws.onclose = () => {
      clearTimers();
      if (!closedByUs.current) scheduleReconnect();
      else setStatus('Disconnected');
    };

    ws.onerror = () => {
      // Let onclose handle the reconnect; just close if still open.
      if (ws.readyState === WebSocket.OPEN) ws.close();
    };
  }

  return { status, prices };
}
