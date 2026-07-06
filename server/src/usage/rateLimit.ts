// In-memory per-IP sliding-window rate limiter.
// Single-instance only — not shared across processes or restarts.

import { config } from '../config';

const WINDOW_MS = 60_000; // 60-second sliding window

/** IP -> array of request timestamps (epoch ms) within the current window. */
const windows: Map<string, number[]> = new Map();

/**
 * Prune timestamps older than the sliding window from the given array.
 * Mutates in place and returns the pruned array.
 */
function prune(timestamps: number[], now: number): number[] {
  const cutoff = now - WINDOW_MS;
  // Find the first index that's within the window
  let i = 0;
  while (i < timestamps.length && timestamps[i]! <= cutoff) {
    i++;
  }
  if (i > 0) {
    timestamps.splice(0, i);
  }
  return timestamps;
}

/**
 * Check whether the given IP is allowed to make another request.
 * Prunes expired entries on each call to bound memory.
 *
 * Returns `{ allowed: true }` if under the limit, or
 * `{ allowed: false, retryAfterMs }` with the time until the oldest
 * entry in the window expires.
 */
export function checkRateLimit(ip: string): {
  allowed: boolean;
  retryAfterMs?: number;
} {
  const now = Date.now();
  const timestamps = windows.get(ip);

  if (!timestamps || timestamps.length === 0) {
    return { allowed: true };
  }

  prune(timestamps, now);

  if (timestamps.length < config.aiRatePerMin) {
    return { allowed: true };
  }

  // Over the limit — compute how long until the oldest entry expires.
  const oldestInWindow = timestamps[0]!;
  const retryAfterMs = oldestInWindow + WINDOW_MS - now;

  return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 0) };
}

/**
 * Record a request timestamp for the given IP.
 * Call this only when the request is actually proceeding (after the check passes).
 */
export function recordRequest(ip: string): void {
  const now = Date.now();
  let timestamps = windows.get(ip);

  if (!timestamps) {
    timestamps = [];
    windows.set(ip, timestamps);
  }

  timestamps.push(now);
}
