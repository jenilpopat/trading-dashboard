# Real-Time Trading Dashboard

A full-stack dashboard that turns a **slow, heavy, flaky** upstream trades API
into a **fast, always-available** analytics dashboard with **live prices** over
WebSocket.

- **Backend** — Node.js + TypeScript (Express). Caches ~50k trades, pre-computes
  aggregates, survives upstream 503s, and exposes instant REST endpoints.
- **Frontend** — React + TypeScript (Vite). Summary cards, sortable instrument
  table, daily P&L chart, and a robust live-price WebSocket feed.

```
trading-dashboard/
├── backend/     Node.js + Express + TypeScript
├── frontend/    React + TypeScript + Vite
└── README.md
```

---

## Requirements

- **Node.js 18+** (works on 18/20/22).
- npm (bundled with Node).

The apps run **independently**: backend on **port 4000**, frontend on **5173**.

---

## Running locally

### 1. Backend

```bash
cd backend
cp .env.example .env      # (Windows: copy .env.example .env)
npm install
npm run dev               # starts on http://localhost:4000
```

`.env` example:

```env
PORT=4000
UPSTREAM_BASE_URL=https://mocktrading-silk.vercel.app
CORS_ORIGIN=http://localhost:5173
```

On first start the backend tries to load a persisted cache from
`backend/data/trades-cache.json`. If none exists, it fetches trades from upstream
in the background (with retries) — the server starts listening immediately, so
early requests just return an empty/stale response until the first fetch lands.

### 2. Frontend

```bash
cd frontend
cp .env.example .env      # (Windows: copy .env.example .env)
npm install
npm run dev               # starts on http://localhost:5173
```

`.env` example:

```env
VITE_BACKEND_URL=http://localhost:4000
VITE_WS_URL=wss://mocktrading-silk.vercel.app/ws
```

Open **http://localhost:5173**.

> Tip: the first `POST /api/refresh` (Refresh button) can take a few seconds
> because `/api/trades` is genuinely slow — that's expected. Every other endpoint
> responds instantly from cache.

---

## Architecture

### Data flow (REST)

```
upstream /api/trades  ──fetch once (retry+backoff)──►  backend in-memory cache
        (slow, flaky)                                   + data/trades-cache.json (disk)
                                                              │
                                             compute aggregates ONCE at build time
                                                              │
                          ┌───────────────────────────────────┼───────────────────────────┐
                          ▼                                   ▼                             ▼
                  GET /api/summary            GET /api/instruments-summary       GET /api/daily-pnl
                          │                                   │                             │
                          └───────────────► React dashboard (src/api.ts) ◄──────────────────┘
                                              SummaryCards · InstrumentTable · DailyPnlChart
```

The frontend **never** talks to the slow upstream for trade data — only to the
backend, which answers from its pre-computed cache in O(1).

### Data flow (live prices, WebSocket)

```
browser ──wss://…/ws──► upstream WS
   ▲   subscribe(all symbols) / ping
   │
useLiveWebSocket hook  ──ticks (seq-checked)──►  LivePrices cards (flash on update)
```

The instrument **list** comes from the backend (`GET /api/instruments`, cached),
but the browser connects **directly** to the upstream WebSocket for live ticks.

---

## Key design decisions

**Cache + file persistence.** `/api/trades` is slow (seconds), heavy (~50k rows),
and flaky (503s). Fetching it per page load would be unusable, so we fetch it
**once**, hold it in memory, and also write it to
`backend/data/trades-cache.json`. A server restart reloads from disk instead of
hammering the upstream again.

**Retry with exponential backoff.** The upstream intermittently returns 503. On
fetch we retry up to 4 times with 1s → 2s → 4s → 8s delays (only for
503 / network / timeout errors — not for 4xx, which won't self-heal). A 30s
request timeout accommodates the endpoint's slowness. See
`backend/src/services/upstreamClient.ts`.

**Serve stale data when upstream is down.** If every retry fails, we keep serving
the **previous** cache and flip a status flag (`dataStatus: "stale"`). Stale but
available beats a hard error. `POST /api/refresh` reports the failure while reads
keep working.

**In-flight lock (single fetch).** A shared promise guards refreshes: if two
refresh requests arrive together (or the daily cron overlaps a manual refresh),
they **share one** upstream fetch instead of firing two expensive requests. See
`tradeCache.refresh()`.

**Pre-computed aggregates.** Summary, per-instrument rollup, and daily P&L are
computed in a **single pass** at cache-build time and stored alongside the raw
trades. Every REST read then returns a tiny pre-built object instead of scanning
50k rows per request. See `backend/src/services/aggregator.ts`.

**seq-based tick de-duplication.** WebSocket ticks carry a monotonically
increasing `seq` per symbol. The hook tracks the last seq seen for each symbol
and **drops any tick with an equal or lower seq**, so out-of-order or duplicate
frames (common after a reconnect) never move the price backwards. See
`frontend/src/hooks/useLiveWebSocket.ts`.

**Auto-reconnect + keepalive.** On disconnect the hook reconnects with capped
exponential backoff and **re-subscribes to all symbols**. It also sends periodic
`ping`s and answers server pings so the server doesn't drop it. Connection status
(Connected / Reconnecting / Disconnected) is shown on screen.

**Automatic daily refresh.** A `node-cron` job refreshes the cache once a day
(00:05), protected by the same in-flight lock.

---

## Backend API reference

| Method | Path                        | Description                                              |
| ------ | --------------------------- | ------------------------------------------------------- |
| GET    | `/api/summary`              | Gross/Net P&L, trades, brokerage, win rate, status      |
| GET    | `/api/instruments-summary`  | One row per symbol (frontend sorts by Net P&L)          |
| GET    | `/api/daily-pnl`            | `{ date, netPnl }[]` sorted ascending by date           |
| GET    | `/api/instruments`          | Cached upstream instruments list                        |
| POST   | `/api/refresh`              | Re-fetch upstream (retries); rebuild cache              |
| GET    | `/api/health`              | Backend health + cache/upstream status                  |

### Metric definitions

- `grossPnl` = Σ (sellPrice − buyPrice) × quantity
- `netPnl` = grossPnl − Σ brokerage
- `winRate` = trades with per-trade net P&L > 0 ÷ totalTrades × 100

---

## Project layout

```
backend/
├── src/
│   ├── config.ts               env + tuning constants
│   ├── index.ts                Express app, cron, startup
│   ├── types/index.ts          shared interfaces (Trade, Summary, …)
│   ├── routes/index.ts         all REST endpoints
│   ├── middleware/errorHandler.ts
│   └── services/
│       ├── upstreamClient.ts   axios + retry/backoff
│       ├── aggregator.ts       single-pass aggregate computation
│       └── tradeCache.ts       in-memory + disk cache, in-flight lock
└── data/trades-cache.json      persisted cache (generated at runtime)

frontend/
├── src/
│   ├── api.ts                  backend REST client
│   ├── types.ts                shared types
│   ├── format.ts               money/number formatting helpers
│   ├── App.tsx                 page composition + data loading
│   ├── hooks/useLiveWebSocket.ts   robust WS hook
│   └── components/
│       ├── SummaryCards.tsx
│       ├── InstrumentTable.tsx
│       ├── DailyPnlChart.tsx
│       └── LivePrices.tsx
└── vite.config.ts
```

---

## Notes

- Full TypeScript across both apps; `strict` mode on.
- The mock upstream endpoint is only **consumed**, never modified.
- CORS is enabled on the backend for the frontend origin.
