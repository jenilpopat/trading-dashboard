import { Router, type Request, type Response } from 'express';
import { tradeCache } from '../services/tradeCache';
import { checkUpstreamHealth } from '../services/upstreamClient';

/**
 * All REST routes. Every "read" endpoint is served from the pre-computed cache,
 * so responses are instant regardless of how slow the upstream is.
 *
 * A tiny async wrapper forwards rejected promises to the error middleware.
 */
const router = Router();

type Handler = (req: Request, res: Response) => Promise<void> | void;
const wrap =
  (fn: Handler) =>
  (req: Request, res: Response, next: (err?: unknown) => void): void => {
    Promise.resolve(fn(req, res)).catch(next);
  };

/** GET /api/summary — overall performance, from pre-computed aggregates. */
router.get(
  '/summary',
  wrap((_req, res) => {
    res.json(tradeCache.getSummary());
  }),
);

/** GET /api/instruments-summary — one row per symbol (frontend does sorting). */
router.get(
  '/instruments-summary',
  wrap((_req, res) => {
    const rows = tradeCache.getCache()?.aggregates.instrumentsSummary ?? [];
    res.json(rows);
  }),
);

/** GET /api/daily-pnl — net P&L per day, sorted ascending by date. */
router.get(
  '/daily-pnl',
  wrap((_req, res) => {
    const series = tradeCache.getCache()?.aggregates.dailyPnl ?? [];
    res.json(series);
  }),
);

/** GET /api/instruments — proxied + cached instruments list. */
router.get(
  '/instruments',
  wrap(async (_req, res) => {
    const instruments = await tradeCache.getInstruments();
    res.json(instruments);
  }),
);

/**
 * POST /api/refresh — trigger a re-fetch from upstream (with retries).
 * If a refresh is already running, report that instead of starting another.
 */
router.post(
  '/refresh',
  wrap(async (_req, res) => {
    if (tradeCache.isRefreshing) {
      res.status(202).json({
        status: 'refreshing',
        message: 'Refresh already in progress',
        summary: tradeCache.getSummary(),
      });
      return;
    }

    try {
      await tradeCache.refresh();
      res.json({ status: 'ok', summary: tradeCache.getSummary() });
    } catch (err) {
      // Upstream failed after all retries — we still hold the old (stale) cache.
      const message = err instanceof Error ? err.message : 'Refresh failed';
      res.status(502).json({
        status: 'error',
        message: `Refresh failed, serving stale data: ${message}`,
        summary: tradeCache.getSummary(),
      });
    }
  }),
);

/** GET /api/health — backend health + cache/upstream status. */
router.get(
  '/health',
  wrap(async (_req, res) => {
    const cache = tradeCache.getCache();
    const upstreamHealthy = await checkUpstreamHealth();
    res.json({
      status: 'ok',
      lastFetched: cache?.fetchedAt ?? null,
      tradeCount: cache?.tradeCount ?? 0,
      dataStatus: tradeCache.dataStatus,
      upstreamHealthy,
    });
  }),
);

export default router;
