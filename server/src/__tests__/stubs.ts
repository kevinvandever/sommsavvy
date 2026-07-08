/**
 * Shared test stubs for property-based tests.
 *
 * These replace the AI provider layer, database layer, and request context
 * so tests run deterministically without network calls or a real Postgres.
 */
import { vi } from 'vitest';
import type { CellarEntry } from '../methods/tables/cellarEntries';
import type { Hydrated } from '../db/adapter';

// ---------- In-memory cellar store ----------

export interface InMemoryStore {
  entries: Hydrated<CellarEntry>[];
  regenCalls: string[]; // userIds for which regen was invoked
  imageCounter: number;
}

export function createStore(): InMemoryStore {
  return { entries: [], regenCalls: [], imageCounter: 0 };
}

// ---------- Stub: CellarEntries table ----------

let _nextId = 1;

export function stubCellarEntries(store: InMemoryStore) {
  return {
    async push(obj: Partial<CellarEntry>): Promise<Hydrated<CellarEntry>> {
      const id = String(_nextId++);
      const now = Date.now();
      const entry: Hydrated<CellarEntry> = {
        id,
        created_at: now,
        updated_at: now,
        userId: '',
        kind: 'wine',
        name: '',
        source: 'scan',
        savedAt: now,
        tasted: true,
        owned: false,
        ...obj,
      } as Hydrated<CellarEntry>;
      store.entries.push(entry);
      return entry;
    },
    async get(id: string): Promise<Hydrated<CellarEntry> | null> {
      return store.entries.find((e) => e.id === id) ?? null;
    },
    async update(id: string, patch: Partial<CellarEntry>): Promise<Hydrated<CellarEntry>> {
      const idx = store.entries.findIndex((e) => e.id === id);
      if (idx === -1) throw new Error('Entry not found.');
      const existing = store.entries[idx]!;
      const updated = { ...existing, ...patch, updated_at: Date.now() };
      store.entries[idx] = updated;
      return updated;
    },
    async remove(id: string): Promise<{ deleted: boolean }> {
      const before = store.entries.length;
      store.entries = store.entries.filter((e) => e.id !== id);
      return { deleted: store.entries.length < before };
    },
    filter(_pred: unknown, _bindings?: unknown) {
      return {
        sortBy: () => ({ reverse: () => ({ take: () => Promise.resolve(store.entries) }) }),
        count: () => Promise.resolve(store.entries.length),
      };
    },
    async count(): Promise<number> {
      return store.entries.length;
    },
  };
}

// ---------- Stub: runTasteSummaryRegen ----------

export function stubRegen(store: InMemoryStore) {
  return vi.fn(async (userId: string) => {
    store.regenCalls.push(userId);
  });
}

// ---------- Stub: mindstudio AI layer ----------

export interface StubbedAnalysisResponse {
  subjectClass: 'bottle-like' | 'pairing-like' | 'ambiguous' | 'none';
  name?: string;
  kind?: 'wine' | 'beer' | 'spirits';
  producer?: string;
  region?: string;
  vintage?: number;
  confidence?: 'high' | 'medium' | 'low';
}

export function stubMindstudio(analysisResponse: StubbedAnalysisResponse) {
  return {
    async analyzeImage(_args: unknown) {
      return { analysis: JSON.stringify(analysisResponse) };
    },
    async generateText(_args: unknown) {
      return { content: analysisResponse };
    },
    async generateImage(_args: unknown) {
      return { imageUrl: 'https://stub.local/portrait.png' };
    },
    async executeStepBatch(steps: unknown[]) {
      return {
        results: (steps as unknown[]).map(() => ({
          output: { imageUrl: 'https://stub.local/batch.png' },
        })),
      };
    },
    async transcribeAudio(_args: unknown) {
      return { text: 'stubbed transcription' };
    },
  };
}

// ---------- Stub: failing mindstudio (provider error) ----------

export function stubMindstudioFailing(error: Error = new Error('Provider unavailable')) {
  return {
    async analyzeImage() {
      throw error;
    },
    async generateText() {
      throw error;
    },
    async generateImage() {
      throw error;
    },
    async executeStepBatch() {
      throw error;
    },
    async transcribeAudio() {
      throw error;
    },
  };
}

// ---------- Stub: request context ----------

export interface ContextOptions {
  userId?: string;
  clientIp?: string;
  anonToken?: string | null;
}

/**
 * Creates a mock runtime context suitable for use with `runWithContext`.
 */
export function createRequestContext(opts: ContextOptions = {}) {
  return {
    userId: opts.userId,
    emit: vi.fn(),
    clientIp: opts.clientIp ?? '127.0.0.1',
    anonToken: opts.anonToken ?? null,
  };
}

// ---------- Arbitraries (fast-check generators) ----------

import fc from 'fast-check';

/** Valid wine/beer/spirits kind */
export const arbKind = fc.constantFrom('wine', 'beer', 'spirits') as fc.Arbitrary<
  'wine' | 'beer' | 'spirits'
>;

/** Valid subject class */
export const arbSubjectClass = fc.constantFrom(
  'bottle-like',
  'pairing-like',
  'ambiguous',
  'none',
) as fc.Arbitrary<'bottle-like' | 'pairing-like' | 'ambiguous' | 'none'>;

/** A non-empty trimmed name */
export const arbName = fc
  .string({ minLength: 1, maxLength: 100 })
  .filter((s) => s.trim().length > 0);

/** A valid vintage year (1900 to current year + 1) */
export const arbValidVintage = fc.integer({ min: 1900, max: new Date().getFullYear() + 1 });

/** An invalid vintage year (outside the valid range) */
export const arbInvalidVintage = fc.oneof(
  fc.integer({ min: -9999, max: 1899 }),
  fc.integer({ min: new Date().getFullYear() + 2, max: 9999 }),
);

/** A valid cellar entry input for scan saves */
export const arbValidScanInput = fc.record({
  kind: arbKind,
  name: arbName,
  producer: fc.option(arbName, { nil: undefined }),
  region: fc.option(arbName, { nil: undefined }),
  vintage: fc.option(arbValidVintage, { nil: undefined }),
  source: fc.constant('scan' as const),
});

/** Subject class that routes to identify */
export const arbIdentifyClass = fc.constantFrom('bottle-like', 'ambiguous', 'none') as fc.Arbitrary<
  'bottle-like' | 'ambiguous' | 'none'
>;

/** Subject class that routes to pair */
export const arbPairClass = fc.constant('pairing-like') as fc.Arbitrary<'pairing-like'>;
