// Fetch-based API client for SommSavvy.
// Replaces the @mindstudio-ai/interface createClient with direct fetch wrappers
// to the self-hosted Hono backend.

import type {
  CellarEntry,
  Depth,
  Kind,
  PocketSommOutput,
  ScanResult,
  Source,
  User,
} from './types';
import {
  streamSmartScan,
  type SmartScanRequest,
  type StreamHandlers,
} from './lib/sse';

// ---------------------------------------------------------------------------
// Configuration
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
// Sign-in signal error
// ---------------------------------------------------------------------------

export class SignInRequiredError extends Error {
  code = 'sign_in_required' as const;
  constructor(message = 'Sign in to save to your cellar.') {
    super(message);
    this.name = 'SignInRequiredError';
  }
}

// ---------------------------------------------------------------------------
// Generic JSON POST helper
// ---------------------------------------------------------------------------

async function rpc<I, O>(path: string, input?: I): Promise<O> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}/api${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input ?? {}),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null) as {
      error?: { code?: string; message?: string };
    } | null;

    // Surface sign_in_required so callers can trigger the auth flow.
    if (res.status === 401 || body?.error?.code === 'sign_in_required') {
      throw new SignInRequiredError(body?.error?.message);
    }

    throw new Error(body?.error?.message ?? 'Something went wrong.');
  }

  return res.json() as Promise<O>;
}

// ---------------------------------------------------------------------------
// RPC method wrappers
// ---------------------------------------------------------------------------

export const api = {
  saveCellarEntry(input: {
    kind: Kind;
    name: string;
    producer?: string;
    region?: string;
    vintage?: number;
    abv?: number;
    photoUrl?: string;
    source: Source;
    notes?: string;
    whyText?: string;
    monocleAside?: string;
    pairings?: string[];
    occasion?: string;
    valueNote?: string;
    tastedAt?: number;
  }): Promise<{ entry: CellarEntry }> {
    return rpc('/saveCellarEntry', input);
  },

  listCellar(input?: {
    kind?: Kind;
    search?: string;
    sort?: 'recent' | 'tasted';
  }): Promise<{ entries: CellarEntry[] }> {
    return rpc('/listCellar', input);
  },

  // Natural-language search over the user's own cellar. Returns a ranked
  // subset with a short reason per entry, or a keyword-filtered set when the
  // backend falls back (usedFallback: true).
  searchCellar(input: {
    query: string;
    kind?: Kind;
    owned?: boolean;
  }): Promise<{ matches: Array<{ entry: CellarEntry; reason: string }>; usedFallback: boolean }> {
    return rpc('/searchCellar', input);
  },

  getEntry(input: { id: string }): Promise<{ entry: CellarEntry }> {
    return rpc('/getEntry', input);
  },

  updateCellarEntry(input: {
    id: string;
    patch: Partial<CellarEntry>;
  }): Promise<{ entry: CellarEntry }> {
    return rpc('/updateCellarEntry', input);
  },

  removeCellarEntry(input: { id: string }): Promise<{ deleted: boolean }> {
    return rpc('/removeCellarEntry', input);
  },

  getMe(): Promise<{ user: User | null; cellarCount: number; recentEntries: CellarEntry[] }> {
    return rpc('/getMe');
  },

  updateProfile(input: {
    displayName?: string;
    depthPreference?: Depth;
    tasteSeed?: string;
  }): Promise<{ user: User }> {
    return rpc('/updateProfile', input);
  },

  regenerateTasteSummary(): Promise<{ ok: boolean }> {
    return rpc('/regenerateTasteSummary');
  },

  transcribeVoice(input: { audioUrl: string }): Promise<{ text: string }> {
    return rpc('/transcribeVoice', input);
  },

  // ---------------------------------------------------------------------------
  // Unified smart scan — delegates to the SSE streaming client.
  // ---------------------------------------------------------------------------

  smartScan(
    body: SmartScanRequest,
    handlers: StreamHandlers,
    signal?: AbortSignal,
  ): Promise<void> {
    return streamSmartScan(body, handlers, signal);
  },
};

// Re-export types consumers may need from the SSE client.
export type { SmartScanRequest, StreamHandlers } from './lib/sse';
export type { RoutingMeta, SmartScanData, SmartScanError } from './lib/sse';
