import path from 'path';
import dotenv from 'dotenv';

// Load variables from a local .env file (if present) into process.env.
dotenv.config();

/**
 * Centralised, typed configuration for the whole backend.
 * Everything that might change per-environment lives here so the rest of the
 * code never touches process.env directly.
 */
export const config = {
  // HTTP server port.
  port: Number(process.env.PORT ?? 4000),

  // Upstream mock trading API base URL.
  upstreamBaseUrl:
    process.env.UPSTREAM_BASE_URL ?? 'https://mocktrading-silk.vercel.app',

  // Origin(s) allowed to call this backend from a browser.
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',

  // Where the on-disk cache lives so it survives a server restart.
  cacheFilePath: path.resolve(__dirname, '..', 'data', 'trades-cache.json'),

  // A committed snapshot loaded at boot when no runtime cache exists yet (e.g.
  // a fresh deploy on an ephemeral filesystem). Guarantees instant first-load
  // data; it's superseded by the first successful refresh.
  seedFilePath: path.resolve(__dirname, '..', 'data', 'trades-seed.json'),

  // --- Retry / timeout tuning for the flaky /api/trades endpoint ---
  // The endpoint is slow, so give it a generous timeout.
  upstreamTimeoutMs: 30_000,
  // Up to 4 retries with exponential backoff: 1s, 2s, 4s, 8s.
  maxRetries: 4,
  baseBackoffMs: 1_000,

  // Automatic refresh cadence: once a day (in milliseconds).
  autoRefreshIntervalMs: 24 * 60 * 60 * 1000,
} as const;
