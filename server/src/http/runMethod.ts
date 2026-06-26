import type { Context } from 'hono';
import type { AppEnv } from './types';
import { runWithContext, type StreamEmitter } from '../runtime/context';

// Runs a ported method body inside the AsyncLocalStorage request context, so
// `auth.userId` and `stream()` resolve correctly for this request. `emit` is
// provided only for streaming (SSE) routes.
export function runMethod<T>(
  c: Context<AppEnv>,
  fn: () => Promise<T>,
  emit?: StreamEmitter,
): Promise<T> {
  return runWithContext({ userId: c.get('userId'), emit }, fn);
}
