// Local replacement for `@mindstudio-ai/interface`. Provides the same three
// exports the app imports — `createClient`, `auth`, `platform` — but talks to
// our own Hono backend over HTTP instead of the MindStudio platform.
//
// Wired in via a Vite alias + tsconfig path so existing imports
// (`from '@mindstudio-ai/interface'`) resolve here unchanged.

const BASE = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8788').replace(/\/$/, '');
const TOKEN_KEY = 'sommsavvy_token';

// ---- Session token (persisted in localStorage) ----

function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore storage failures */
  }
}

function authHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// Error carrying the backend's machine `code` so the UI can branch on it
// (e.g. AuthSheet checks e.code === 'invalid_code').
class ApiError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

async function readError(res: Response): Promise<ApiError> {
  const data = (await res.json().catch(() => null)) as
    | { error?: { code?: string; message?: string } }
    | null;
  const e = data?.error;
  return new ApiError(e?.message ?? `Request failed (${res.status})`, e?.code);
}

// ---- RPC client ----

// Methods that stream over SSE. They always use the streaming transport,
// regardless of whether the caller passed stream options.
const STREAMING_METHODS = new Set(['pocketSomm', 'reverseScan']);

interface StreamOpts {
  stream?: boolean;
  onStreamData?: (data: { status?: string; partialResult?: unknown }) => void;
}

async function callJson(method: string, input: unknown): Promise<unknown> {
  const res = await fetch(`${BASE}/api/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input ?? {}),
  });
  if (!res.ok) throw await readError(res);
  return res.json();
}

// Reads the SSE response body, forwarding { status } / { partialResult }
// events to onStreamData and resolving with the final { result } payload.
async function callStream(
  method: string,
  input: unknown,
  onStreamData?: StreamOpts['onStreamData'],
): Promise<unknown> {
  const res = await fetch(`${BASE}/api/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input ?? {}),
  });
  if (!res.ok || !res.body) throw await readError(res);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult: unknown;
  let streamError: ApiError | null = null;

  const handleEvent = (raw: string) => {
    const data = raw
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trimStart())
      .join('\n');
    if (!data) return;
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(data);
    } catch {
      return;
    }
    if ('result' in payload) finalResult = payload.result;
    else if ('error' in payload) {
      const err = payload.error as { code?: string; message?: string };
      streamError = new ApiError(err?.message ?? 'Request failed', err?.code);
    } else {
      onStreamData?.(payload as { status?: string; partialResult?: unknown });
    }
  };

  // SSE events are separated by a blank line (\n\n).
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      handleEvent(buffer.slice(0, idx));
      buffer = buffer.slice(idx + 2);
    }
  }
  if (buffer.trim()) handleEvent(buffer);

  if (streamError) throw streamError;
  return finalResult;
}

// Returns a Proxy whose every property is a callable RPC method. Streaming
// methods accept an optional second argument with { onStreamData }.
export function createClient<T extends Record<string, unknown>>(): T {
  return new Proxy(
    {},
    {
      get(_target, prop: string) {
        return (input?: unknown, opts?: StreamOpts) => {
          if (STREAMING_METHODS.has(prop) || opts?.stream) {
            return callStream(prop, input, opts?.onStreamData);
          }
          return callJson(prop, input);
        };
      },
    },
  ) as T;
}

// ---- Auth ----

type AuthListener = (state: { userId: string | null }) => void;
const listeners = new Set<AuthListener>();

// Decode the user id from the JWT payload without verifying (display only).
function userIdFromToken(): string | null {
  const t = getToken();
  if (!t) return null;
  try {
    const payload = JSON.parse(atob(t.split('.')[1] ?? ''));
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

function notify(): void {
  const state = { userId: userIdFromToken() };
  for (const l of listeners) l(state);
}

export const auth = {
  // Subscribe to auth changes. Fires once immediately with the current state
  // so the app can settle its initial boot, then on every login/logout.
  onAuthStateChanged(cb: AuthListener): () => void {
    listeners.add(cb);
    cb({ userId: userIdFromToken() });
    return () => listeners.delete(cb);
  },

  async sendEmailCode(email: string): Promise<{ verificationId: string }> {
    const res = await fetch(`${BASE}/auth/send-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) throw await readError(res);
    return res.json();
  },

  async verifyEmailCode(verificationId: string, code: string): Promise<void> {
    const res = await fetch(`${BASE}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verificationId, code }),
    });
    if (!res.ok) throw await readError(res);
    const data = (await res.json()) as { token: string };
    setToken(data.token);
    notify();
  },

  async logout(): Promise<void> {
    setToken(null);
    notify();
  },
};

// ---- Platform (file uploads) ----

export const platform = {
  // Uploads a file to the backend and returns its public URL.
  async uploadFile(file: File): Promise<string> {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${BASE}/upload`, {
      method: 'POST',
      headers: { ...authHeaders() }, // let the browser set the multipart boundary
      body: form,
    });
    if (!res.ok) throw await readError(res);
    const data = (await res.json()) as { url: string };
    return data.url;
  },
};
