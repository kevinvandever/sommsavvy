import { createClient } from '@mindstudio-ai/interface';
import type {
  CellarEntry,
  Depth,
  Kind,
  PocketSommOutput,
  ScanResult,
  Source,
  User,
} from './types';

// Typed RPC client. Method names use the camelCase export from each method
// file (NOT the kebab-case manifest id).
export const api = createClient<{
  pocketSomm(
    input: { imageUrl?: string; text?: string; depth?: Depth; category?: 'wine' | 'beer' | 'spirits' | 'any' },
  ): Promise<PocketSommOutput>;

  reverseScan(
    input: { imageUrl?: string; text?: string; depth?: Depth },
  ): Promise<ScanResult>;

  transcribeVoice(input: { audioUrl: string }): Promise<{ text: string }>;

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
  }): Promise<{ entry: CellarEntry }>;

  listCellar(input?: { kind?: Kind; search?: string; sort?: 'recent' | 'tasted' }): Promise<{ entries: CellarEntry[] }>;

  getEntry(input: { id: string }): Promise<{ entry: CellarEntry }>;

  updateCellarEntry(input: { id: string; patch: Partial<CellarEntry> }): Promise<{ entry: CellarEntry }>;

  removeCellarEntry(input: { id: string }): Promise<{ deleted: boolean }>;

  getMe(): Promise<{ user: User | null; cellarCount: number; recentEntries: CellarEntry[] }>;

  updateProfile(input: { displayName?: string; depthPreference?: Depth; tasteSeed?: string }): Promise<{ user: User }>;

  regenerateTasteSummary(): Promise<{ ok: boolean }>;
}>();
