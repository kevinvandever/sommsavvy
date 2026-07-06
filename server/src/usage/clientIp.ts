import type { Context } from 'hono';

/**
 * Extract the client IP from the request context.
 *
 * Trusts the rightmost entry in X-Forwarded-For — this is the value appended
 * by the proxy (Railway/Netlify) and cannot be spoofed by the client.
 * Falls back to '127.0.0.1' when no forwarding header is present (dev).
 */
export function getClientIp(c: Context): string {
  const xff = c.req.header('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',');
    const rightmost = (parts[parts.length - 1] ?? '').trim();
    if (rightmost) return rightmost;
  }
  return '127.0.0.1';
}

/**
 * Read the anonymous device token from the X-Anon-Id header.
 * Returns the trimmed value, or null if the header is missing or empty.
 */
export function getAnonToken(c: Context): string | null {
  const value = c.req.header('x-anon-id');
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed || null;
}
