import axios, { AxiosError } from 'axios';
import { config } from '../config';
import type { Instrument, UpstreamTradesResponse } from '../types';

/**
 * Thin client around the upstream mock trading API.
 *
 * The main job here is resilience: /api/trades is slow, heavy, and sometimes
 * returns 503. We wrap it in a retry-with-exponential-backoff loop so a single
 * flaky response doesn't fail the whole refresh.
 */

const http = axios.create({
  baseURL: config.upstreamBaseUrl,
  timeout: config.upstreamTimeoutMs,
});

/** Simple promise-based sleep used between retries. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Decide whether a failed request is worth retrying.
 * We retry on: network errors (no response), timeouts, and 503 responses.
 * We do NOT retry on things like 400/404 — those won't fix themselves.
 */
function isRetryable(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const axErr = error as AxiosError;

  // Timeout or connection error -> no response object.
  if (axErr.code === 'ECONNABORTED' || axErr.code === 'ETIMEDOUT') return true;
  if (!axErr.response) return true; // network / DNS / refused

  // Upstream is temporarily unavailable.
  return axErr.response.status === 503;
}

/**
 * Fetch the full trades payload from upstream with retry + exponential backoff.
 *
 * Backoff schedule with defaults (maxRetries=4, baseBackoffMs=1000):
 *   attempt 1 fails -> wait 1s
 *   attempt 2 fails -> wait 2s
 *   attempt 3 fails -> wait 4s
 *   attempt 4 fails -> wait 8s
 *   attempt 5 fails -> give up and throw
 */
export async function fetchTrades(): Promise<UpstreamTradesResponse> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const started = Date.now();
      const { data } = await http.get<UpstreamTradesResponse>('/api/trades');
      console.log(
        `[upstream] /api/trades OK: ${data.total} trades in ${
          Date.now() - started
        }ms (attempt ${attempt + 1})`,
      );
      return data;
    } catch (error) {
      lastError = error;
      const retryable = isRetryable(error);
      const message = axios.isAxiosError(error) ? error.message : String(error);

      // If this was the last attempt, or the error isn't retryable, stop.
      if (attempt === config.maxRetries || !retryable) {
        console.error(
          `[upstream] /api/trades failed permanently (attempt ${
            attempt + 1
          }): ${message}`,
        );
        break;
      }

      // Exponential backoff: baseBackoffMs * 2^attempt.
      const delay = config.baseBackoffMs * 2 ** attempt;
      console.warn(
        `[upstream] /api/trades failed (attempt ${
          attempt + 1
        }): ${message}. Retrying in ${delay}ms...`,
      );
      await sleep(delay);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Failed to fetch trades from upstream');
}

/** Fetch the instruments list (fast, rarely fails — a single attempt is fine). */
export async function fetchInstruments(): Promise<Instrument[]> {
  const { data } = await http.get<Instrument[]>('/api/instruments');
  return data;
}

/** Ping upstream health. Returns true if it reports healthy, false otherwise. */
export async function checkUpstreamHealth(): Promise<boolean> {
  try {
    const res = await http.get('/api/health', { timeout: 5_000 });
    return res.status >= 200 && res.status < 300;
  } catch {
    return false;
  }
}
