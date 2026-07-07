import cors from 'cors';
import express from 'express';
import cron from 'node-cron';
import { config } from './config';
import { errorHandler, notFound } from './middleware/errorHandler';
import routes from './routes';
import { tradeCache } from './services/tradeCache';

/**
 * Backend entry point.
 * Wires up Express, mounts routes, loads the cache, and schedules the daily
 * automatic refresh.
 */
async function main(): Promise<void> {
  const app = express();

  // Allow the frontend dev server to call us from the browser.
  app.use(cors({ origin: config.corsOrigin.split(',') }));
  app.use(express.json());

  // Small request logger for visibility during development.
  app.use((req, _res, next) => {
    console.log(`[http] ${req.method} ${req.url}`);
    next();
  });

  app.use('/api', routes);
  app.use(notFound);
  app.use(errorHandler);

  // --- Warm the cache before/while serving traffic ---
  // 1) Try to load a persisted cache from disk (instant, survives restarts).
  await tradeCache.loadFromDisk();
  // 2) If nothing was on disk, kick off an initial fetch in the background so
  //    the server starts listening immediately rather than blocking on the
  //    slow upstream. Reads before it completes get an empty/stale response.
  void tradeCache.ensureLoaded();

  // --- Automatic daily refresh ---
  // Runs at 00:05 every day. node-cron handles the scheduling; the in-flight
  // lock in the cache guarantees this never collides with a manual refresh.
  cron.schedule('5 0 * * *', () => {
    console.log('[cron] Daily refresh triggered.');
    tradeCache
      .refresh()
      .catch((err) =>
        console.error('[cron] Daily refresh failed:', err.message),
      );
  });

  app.listen(config.port, () => {
    console.log(`[server] Backend listening on http://localhost:${config.port}`);
    console.log(`[server] Upstream: ${config.upstreamBaseUrl}`);
  });
}

main().catch((err) => {
  console.error('[fatal] Failed to start server:', err);
  process.exit(1);
});
