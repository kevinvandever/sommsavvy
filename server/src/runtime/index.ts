import { currentContext, type StreamPayload } from './context';

// The runtime shim that replaces the ambient `@mindstudio-ai/agent` exports.
// Ported method files import { auth, stream, db } from here instead of the
// platform package. `db` and `mindstudio` live in their own modules and are
// re-exported so call sites have a single import surface.

export { db } from '../db/adapter';
export { mindstudio } from '../ai';

// Request-scoped identity. `auth.userId` reads from AsyncLocalStorage, so it
// reflects whichever request is currently executing. Undefined = anonymous.
export const auth = {
  get userId(): string | undefined {
    return currentContext().userId;
  },
};

// Streams progress to the client during a streaming (SSE) request. Outside a
// streaming request (plain JSON methods, fire-and-forget background tasks)
// there is no emitter bound, so this is a safe no-op.
export async function stream(payload: StreamPayload): Promise<void> {
  const ctx = currentContext();
  await ctx.emit?.(payload);
}

// Request-scoped client IP. Set by the route layer from X-Forwarded-For.
export function getContextIp(): string {
  return currentContext().clientIp ?? '127.0.0.1';
}

// Request-scoped anonymous device token. Set by the route layer from X-Anon-Id.
export function getContextAnonToken(): string | null {
  return currentContext().anonToken ?? null;
}
