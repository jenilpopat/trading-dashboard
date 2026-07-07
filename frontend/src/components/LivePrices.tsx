import { useEffect, useRef, useState } from 'react';
import { useLiveWebSocket } from '../hooks/useLiveWebSocket';
import type { Instrument } from '../types';
import { formatMoney } from '../format';

interface Props {
  instruments: Instrument[];
}

/**
 * "Live prices" section.
 * Connects to the upstream WebSocket (via the hook) and renders one card per
 * instrument with the live price and change vs basePrice. Cards briefly flash
 * when their price updates.
 */
export function LivePrices({ instruments }: Props) {
  const symbols = instruments.map((i) => i.symbol);
  const { status, prices } = useLiveWebSocket(symbols);

  return (
    <section>
      <h2>
        Live Prices <span className={`conn conn-${status}`}>{status}</span>
      </h2>
      <div className="live-grid">
        {instruments.map((inst) => (
          <LiveCard
            key={inst.symbol}
            instrument={inst}
            price={prices[inst.symbol]?.price}
            // updatedAt drives the flash animation on change.
            updatedAt={prices[inst.symbol]?.updatedAt}
          />
        ))}
      </div>
    </section>
  );
}

interface CardProps {
  instrument: Instrument;
  price: number | undefined;
  updatedAt: number | undefined;
}

/** A single live-price card with a brief highlight flash on each update. */
function LiveCard({ instrument, price, updatedAt }: CardProps) {
  const [flash, setFlash] = useState(false);
  const prevUpdatedAt = useRef<number | undefined>(undefined);

  useEffect(() => {
    // Only flash when we actually receive a new tick (updatedAt changed).
    if (updatedAt !== undefined && updatedAt !== prevUpdatedAt.current) {
      prevUpdatedAt.current = updatedAt;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 500);
      return () => clearTimeout(t);
    }
  }, [updatedAt]);

  const hasPrice = price !== undefined;
  const change = hasPrice ? price - instrument.basePrice : 0;
  const changePct = hasPrice ? (change / instrument.basePrice) * 100 : 0;
  const cls = change >= 0 ? 'pos' : 'neg';

  return (
    <div className={`live-card ${flash ? 'flash' : ''}`}>
      <div className="symbol">{instrument.symbol}</div>
      <div className="name">{instrument.name}</div>
      <div className="price">
        {hasPrice ? formatMoney(price) : <span className="muted">…</span>}
      </div>
      {hasPrice && (
        <div className={`change ${cls}`}>
          {change >= 0 ? '+' : ''}
          {formatMoney(change)} ({changePct >= 0 ? '+' : ''}
          {changePct.toFixed(2)}%)
        </div>
      )}
    </div>
  );
}
