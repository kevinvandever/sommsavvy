import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  CellarEntry,
  Depth,
  PocketSommOutput,
  ResultMode,
  RoutingMeta,
  ScanResult,
  User,
} from './types';

// Global frontend state. The store holds:
// - The current user (or null if anonymous)
// - The cellar (loaded once on app boot)
// - The depth preference
// - Routing state from the smartScan SSE stream (resultMode, ambiguous, confidence)
// - The active result we're displaying (so /result has something to show)
// - Session context (imageUrl/text) for the current scan, memory-only
// - A pending unsaved entry waiting for auth (the "save while logged out"
//   pattern from the spec)
// - The film grain / theme preference (persisted in localStorage)

export interface ScanSession {
  imageUrl?: string; // uploaded image URL for the current scan
  text?: string; // typed/transcribed text for the current scan
}

export type SmartScanData = ScanResult | PocketSommOutput;

interface PendingSave {
  // What the user wanted to save before they hit auth. Re-fired after auth.
  payload: Parameters<typeof import('./api').api.saveCellarEntry>[0];
}

interface Store {
  // Identity
  user: User | null;
  cellarCount: number;
  // True once the initial auth-state-changed callback has fired. Until this
  // is true, route components shouldn't make decisions based on user being
  // null (it just means we don't know yet). Prevents the cellar empty-state
  // flashing for an authenticated user during boot.
  booted: boolean;
  setBooted: (b: boolean) => void;
  setUser: (user: User | null, cellarCount?: number) => void;

  // Cellar (loaded once, mutated optimistically)
  cellar: CellarEntry[];
  setCellar: (entries: CellarEntry[]) => void;
  upsertEntry: (entry: CellarEntry) => void;
  removeEntry: (id: string) => void;
  patchEntry: (id: string, patch: Partial<CellarEntry>) => void;

  // Home preferences
  depth: Depth;
  setDepth: (d: Depth) => void;

  // Theme
  theme: 'midnight' | 'day';
  toggleTheme: () => void;

  // Routing state from the smartScan SSE stream
  resultMode: ResultMode | null;
  ambiguous: boolean;
  confidence: 'high' | 'medium' | 'low' | null;

  // Active result (ScanResult when identify, PocketSommOutput when pair)
  result: SmartScanData | null;
  setRouting: (meta: RoutingMeta) => void;
  setResult: (data: SmartScanData) => void;

  // Session context for the current scan (memory-only, never persisted)
  session: ScanSession | null;
  setSession: (s: ScanSession | null) => void;

  // Clears result, routing, and session when navigating back to Home
  clearScan: () => void;

  // Stream error surfaced on the Result screen (set by Home or override flows)
  scanError: string | null;
  setScanError: (msg: string | null) => void;

  // Pending save through auth
  pendingSave: PendingSave | null;
  setPendingSave: (s: PendingSave | null) => void;

  // First-launch flag
  hasSeenWelcome: boolean;
  markWelcomeSeen: () => void;
}

export const useStore = create<Store>()(
  persist(
    (set) => ({
      user: null,
      cellarCount: 0,
      booted: false,
      setBooted: (b) => set({ booted: b }),
      setUser: (user, cellarCount) =>
        set((s) => ({ user, cellarCount: typeof cellarCount === 'number' ? cellarCount : s.cellarCount })),

      cellar: [],
      setCellar: (entries) =>
        set({ cellar: entries.slice().sort((a, b) => b.savedAt - a.savedAt), cellarCount: entries.length }),
      upsertEntry: (entry) =>
        set((s) => {
          const idx = s.cellar.findIndex((e) => e.id === entry.id);
          const next = idx >= 0 ? s.cellar.map((e, i) => (i === idx ? entry : e)) : [entry, ...s.cellar];
          return { cellar: next, cellarCount: next.length };
        }),
      removeEntry: (id) =>
        set((s) => {
          const next = s.cellar.filter((e) => e.id !== id);
          return { cellar: next, cellarCount: next.length };
        }),
      patchEntry: (id, patch) =>
        set((s) => ({
          cellar: s.cellar.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })),

      depth: 'enthusiast',
      setDepth: (d) => set({ depth: d }),

      theme: 'midnight',
      toggleTheme: () => set((s) => ({ theme: s.theme === 'midnight' ? 'day' : 'midnight' })),

      // Routing state
      resultMode: null,
      ambiguous: false,
      confidence: null,

      // Active result
      result: null,
      setRouting: (meta) =>
        set({
          resultMode: meta.mode,
          ambiguous: meta.ambiguous,
          confidence: meta.confidence,
        }),
      setResult: (data) => set({ result: data }),

      // Session context
      session: null,
      setSession: (s) => set({ session: s }),

      // Clear all scan state (called when navigating back to Home)
      clearScan: () =>
        set({
          resultMode: null,
          ambiguous: false,
          confidence: null,
          result: null,
          session: null,
          scanError: null,
        }),

      // Stream error surfaced on the Result screen
      scanError: null,
      setScanError: (msg) => set({ scanError: msg }),

      pendingSave: null,
      setPendingSave: (s) => set({ pendingSave: s }),

      hasSeenWelcome: false,
      markWelcomeSeen: () => set({ hasSeenWelcome: true }),
    }),
    {
      name: 'sommsavvy-store',
      // Only persist a small slice. The cellar and live results stay in
      // memory; re-fetched on boot.
      partialize: (s) => ({
        depth: s.depth,
        theme: s.theme,
        hasSeenWelcome: s.hasSeenWelcome,
      }),
    },
  ),
);
