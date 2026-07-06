import type { Context } from 'hono';
import type { AppEnv } from './types';
import { runWithContext, type StreamEmitter } from '../runtime/context';

// Runs a ported method body inside the AsyncLocalStorage request context, so
// `auth.userId` and `stream()` resolve correctly for this request. `emit` is
// provided only for streaming (SSE) routes. `clientIp` and `anonToken` are
// read from the Hono context variables (set by the route layer) and threaded
// through for usage guardrail checks inside methods.
export function runMethod<T>(
  c: Context<AppEnv>,
  fn: () => Promise<T>,
  emit?: StreamEmitter,
): Promise<T> {
  return runWithContext(
    {
      userId: c.get('userId'),
      emit,
      clientIp: c.get('clientIp'),
      anonToken: c.get('anonToken'),
    },
    fn,
  );
}
