import type { NextFunction, Request, Response } from 'express';

/**
 * Central error-handling middleware.
 * Any error thrown in a route (or passed to next(err)) ends up here so we can
 * log it once and return a consistent JSON shape to the client.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const message = err instanceof Error ? err.message : 'Unknown error';
  console.error('[error]', message);
  res.status(500).json({ error: message });
}

/** 404 handler for unmatched routes. */
export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Not found' });
}
