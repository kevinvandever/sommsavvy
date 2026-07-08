import type { Depth, PocketSommOutput, ScanResult } from '../types';

// ---------------------------------------------------------------------------
// SSE client for the unified smartScan endpoint.
// Replaces the MindStudio SDK streaming transport with a direct fetch reader.
// ---------------------------------------------------------------------------

const BASE = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8788').replace(/\/$/, '');
const TOKEN_KEY = 'sommsavvy_token';

function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SmartScanRequest {
  imageUrl?: string;
  text?: string;
  depth?: Depth;
  forceMode?: 'identify' | 'pair';
}

export interface RoutingMeta {
  mode: 'identify' | 'pair';
  ambiguous: boolean;
  confidence: 'high' | 'medium' | 'low';
}

export type SmartScanData = ScanResult | PocketSommOutput;

export interface StreamHandlers {
  onStatus?: (text: string) => void;
  onRouting?: (meta: RoutingMeta) => void;
  onPartial?: (data: Partial<SmartScanData>) => void;
  onResult?: (result: {
    mode: 'identify' | 'pair';
    ambiguous: boolean;
    confidence: RoutingMeta['confidence'];
    data: SmartScanData;
  }) => void;
  onError?: (err: { message: string; code?: string }) => void;
}

// ---------------------------------------------------------------------------
// SSE error class
// ---------------------------------------------------------------------------

export class SmartScanError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'SmartScanError';
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Stream implementation
// ---------------------------------------------------------------------------

/**
 * POST to `/api/smartScan` and consume the response as an SSE stream.
 *
 * Rejects with `{ code: 'sign_in_required' }` when the server returns 401
 * before the stream opens, or with a generic friendly message for other
 * non-2xx responses.
 */
export async function streamSmartScan(
  body: SmartScanRequest,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}/api/smartScan`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  });

  // Handle non-2xx before reading the stream body.
  if (!res.ok) {
    if (res.status === 401) {
      throw new SmartScanError('Sign in to continue', 'sign_in_required');
    }
    throw new SmartScanError('Something went wrong. Please try again.');
  }

  if (!res.body) {
    throw new SmartScanError('Something went wrong. Please try again.');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by blank lines (\n\n).
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        processEvent(raw, handlers);
      }
    }

    // Flush any trailing data that wasn't terminated with a blank line.
    if (buffer.trim()) {
      processEvent(buffer, handlers);
    }
  } finally {
    reader.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// Event parsing and classification
// ---------------------------------------------------------------------------

function processEvent(raw: string, handlers: StreamHandlers): void {
  // Extract all `data:` lines from the event block and join their values.
  const dataLines = raw
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart());

  const data = dataLines.join('\n');
  if (!data) return;

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(data);
  } catch {
    // Unparseable event; silently skip.
    return;
  }

  classifyAndDispatch(payload, handlers);
}

function classifyAndDispatch(
  payload: Record<string, unknown>,
  handlers: StreamHandlers,
): void {
  // Error event
  if ('error' in payload) {
    const err = payload.error as { message?: string; code?: string } | undefined;
    handlers.onError?.({
      message: err?.message ?? 'Something went wrong',
      code: err?.code,
    });
    return;
  }

  // Final result event
  if ('result' in payload) {
    handlers.onResult?.(payload.result as {
      mode: 'identify' | 'pair';
      ambiguous: boolean;
      confidence: RoutingMeta['confidence'];
      data: SmartScanData;
    });
    return;
  }

  // Status event: object with a top-level `status` string
  if (typeof payload.status === 'string') {
    handlers.onStatus?.(payload.status);
    return;
  }

  // Partial result events
  if ('partialResult' in payload) {
    const partial = payload.partialResult as Record<string, unknown>;

    // Routing event: partialResult contains `mode`
    if ('mode' in partial) {
      handlers.onRouting?.(partial as unknown as RoutingMeta);
      return;
    }

    // Data partial: partialResult without `mode`
    handlers.onPartial?.(partial as Partial<SmartScanData>);
    return;
  }
}
