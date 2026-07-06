import { AsyncLocalStorage } from 'node:async_hooks';

// Per-request execution context. On the MindStudio platform, `auth.userId`
// and `stream()` were ambient, request-scoped singletons. We reproduce that
// with AsyncLocalStorage so ported method bodies can keep importing `auth`
// and `stream` and have them resolve to the *current* request without
// threading a context argument through every function call.

export type StreamPayload = {
  status?: string;
  partialResult?: unknown;
};

export type StreamEmitter = (payload: StreamPayload) => void | Promise<void>;

export interface RequestContext {
  // The authenticated user's id, or undefined for anonymous callers.
  userId?: string;
  // Set only for streaming (SSE) requests. Undefined otherwise, in which
  // case stream() is a no-op (e.g. plain JSON methods, background tasks).
  emit?: StreamEmitter;
  // Client IP extracted from the request (X-Forwarded-For rightmost or fallback).
  clientIp?: string;
  // Anonymous device token from the X-Anon-Id header, or null if absent.
  anonToken?: string | null;
}

const als = new AsyncLocalStorage<RequestContext>();

// Run `fn` with the given request context bound for its entire async tree.
export function runWithContext<T>(ctx: RequestContext, fn: () => Promise<T>): Promise<T> {
  return als.run(ctx, fn);
}

// Returns the active context, or an empty one when called outside a request
// (e.g. a fire-and-forget background task that escaped the request scope).
export function currentContext(): RequestContext {
  return als.getStore() ?? {};
}
