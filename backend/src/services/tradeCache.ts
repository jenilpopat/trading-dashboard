import fs from 'fs/promises';
import path from 'path';
import { config } from '../config';
import { computeAggregates } from './aggregator';
import { fetchInstruments, fetchTrades } from './upstreamClient';
import type {
  CachePayload,
  DataStatus,
  Instrument,
  Summary,
} from '../types';

/**
 * TradeCache is the single source of truth for all dashboard data.
 *
 * Design goals:
 *  - Never hit the slow /api/trades on a page load. Fetch once, cache in memory,
 *    and persist to disk so the cache survives a restart.
 *  - Pre-compute all aggregates at build time so REST reads are O(1).
 *  - Serve stale data when the upstream is down (stale-but-available > nothing).
 *  - Never run two upstream fetches at once (in-flight lock / shared promise).
 */
class TradeCache {
  // The current cached payload (null until first successful load/fetch).
  private cache: CachePayload | null = null;

  // In-memory instruments cache (rarely changes).
  private instruments: Instrument[] | null = null;

  // Whether the most recent refresh attempt failed (so data is stale).
  private isStale = false;

  // Shared promise for an in-flight fetch. If a second refresh arrives while
  // one is running, both callers await THIS same promise instead of firing a
  // second expensive upstream request.
  private inFlight: Promise<CachePayload> | null = null;

  /** True while a refresh is currently running. */
  get isRefreshing(): boolean {
    return this.inFlight !== null;
  }

  /**
   * Load a persisted cache from disk on startup (if it exists).
   * This means a server restart doesn't force a slow upstream fetch.
   */
  async loadFromDisk(): Promise<void> {
    try {
      const raw = await fs.readFile(config.cacheFilePath, 'utf-8');
      const parsed = JSON.parse(raw) as CachePayload;
      this.cache = parsed;
      // Data loaded from disk is "stale" until we confirm a fresh fetch, but
      // it's fully usable. We mark it not-stale here because it was valid when
      // written; the daily scheduler / manual refresh will update it.
      this.isStale = false;
      console.log(
        `[cache] Loaded ${parsed.tradeCount} trades from disk (fetched ${new Date(
          parsed.fetchedAt,
        ).toISOString()})`,
      );
    } catch {
      // No cache file yet — that's fine, we'll fetch on demand.
      console.log('[cache] No persisted cache found on disk.');
    }
  }

  /** Persist the current cache to disk (best-effort; failure is non-fatal). */
  private async saveToDisk(payload: CachePayload): Promise<void> {
    try {
      await fs.mkdir(path.dirname(config.cacheFilePath), { recursive: true });
      await fs.writeFile(
        config.cacheFilePath,
        JSON.stringify(payload),
        'utf-8',
      );
      console.log('[cache] Persisted cache to disk.');
    } catch (err) {
      console.error('[cache] Failed to persist cache to disk:', err);
    }
  }

  /**
   * Refresh the cache from upstream.
   *
   * Uses the in-flight lock: the first caller kicks off the real fetch and
   * stores the promise; any concurrent caller receives the same promise. This
   * guarantees only one heavy /api/trades request is ever in flight.
   *
   * On failure: keeps the existing cache, marks it stale, and re-throws so the
   * caller (e.g. POST /api/refresh) can report the error — but reads still work.
   */
  async refresh(): Promise<CachePayload> {
    if (this.inFlight) {
      console.log('[cache] Refresh already in progress — sharing that fetch.');
      return this.inFlight;
    }

    this.inFlight = this.doRefresh();
    try {
      return await this.inFlight;
    } finally {
      // Always clear the lock, whether the fetch succeeded or failed.
      this.inFlight = null;
    }
  }

  /** The actual fetch + aggregate + persist work (wrapped by refresh()). */
  private async doRefresh(): Promise<CachePayload> {
    try {
      const response = await fetchTrades();

      // Build aggregates ONCE, here, so reads never re-scan the trades.
      const aggregates = computeAggregates(response.trades);

      const payload: CachePayload = {
        fetchedAt: Date.now(),
        tradeCount: response.trades.length,
        trades: response.trades,
        aggregates,
      };

      this.cache = payload;
      this.isStale = false;
      await this.saveToDisk(payload);
      console.log(`[cache] Refreshed: ${payload.tradeCount} trades.`);
      return payload;
    } catch (err) {
      // Upstream failed after all retries. Keep whatever we already have but
      // flag it as stale so the status field tells the truth.
      this.isStale = true;
      console.error('[cache] Refresh failed; serving existing cache as stale.');
      throw err;
    }
  }

  /**
   * Ensure we have SOME data. Called on startup: if disk had nothing, do an
   * initial fetch. Failures are swallowed here so the server still boots and
   * can serve empty/stale responses plus a status flag.
   */
  async ensureLoaded(): Promise<void> {
    if (this.cache) return;
    try {
      await this.refresh();
    } catch {
      console.warn(
        '[cache] Initial fetch failed. Server is up but has no data yet.',
      );
    }
  }

  /** Current data status used across the summary and health endpoints. */
  get dataStatus(): DataStatus {
    if (this.isRefreshing) return 'refreshing';
    return this.isStale ? 'stale' : 'fresh';
  }

  /** The full cached payload (or null if we never got any data). */
  getCache(): CachePayload | null {
    return this.cache;
  }

  /** Summary endpoint payload, assembled from pre-computed aggregates. */
  getSummary(): Summary {
    const agg = this.cache?.aggregates.summary;
    return {
      grossPnl: agg?.grossPnl ?? 0,
      netPnl: agg?.netPnl ?? 0,
      totalTrades: agg?.totalTrades ?? 0,
      totalBrokerage: agg?.totalBrokerage ?? 0,
      winRate: agg?.winRate ?? 0,
      lastUpdated: this.cache?.fetchedAt ?? null,
      dataStatus: this.dataStatus,
    };
  }

  /** Get instruments, caching the upstream list in memory on first call. */
  async getInstruments(): Promise<Instrument[]> {
    if (this.instruments) return this.instruments;
    this.instruments = await fetchInstruments();
    console.log(`[cache] Cached ${this.instruments.length} instruments.`);
    return this.instruments;
  }
}

// Single shared instance for the whole process.
export const tradeCache = new TradeCache();
