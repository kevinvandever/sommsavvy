// Shared types for SommSavvy frontend.

export type Depth = 'beginner' | 'enthusiast' | 'expert';
export type Kind = 'wine' | 'beer' | 'spirits';
export type Source = 'somm' | 'scan' | 'manual' | 'import';

export interface User {
  id: string;
  email: string;
  displayName?: string;
  depthPreference?: Depth;
  // User's self-described taste, captured optionally during welcome. The
  // backend feeds this verbatim to the regeneration step as foundational
  // context so the user's own words keep shaping the profile.
  tasteSeed?: string;
  tasteSummary?: string;
  tasteSummaryUpdatedAt?: number;
  created_at?: number;
}

export interface CellarEntry {
  id: string;
  userId: string;
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
  savedAt: number;
  created_at?: number;
  // Two independent dimensions. tasted defaults true (null treated as true);
  // owned defaults false (null treated as false). See Tasted & Owned.
  tasted?: boolean;
  owned?: boolean;
  // Bottles physically on hand. Meaningful only while owned is true: a whole
  // number from 1 to 99, read as 1 when absent (legacy and bulk-imported rows).
  // While owned is not true it reads as 0 and is cleared on the next on-hand
  // write. Part of the owned axis: changing it never triggers a taste regen.
  // An inventory quantity, never a rating.
  bottleCount?: number;
}

// An entry's on-hand state just before a bottle outcome, returned by
// recordBottleOutcomes so Undo can restore it.
export interface OnHandSnapshot {
  owned: true;
  bottleCount: number; // bottles on hand before the outcome, 1..99
  tasted: boolean; // normalized: null reads as true
}

export interface Recommendation {
  name: string;
  kind: Kind;
  producer: string | null;
  region: string | null;
  vintage: number | null;
  abv: number | null;
  why: string;
  monocleAside: string | null;
  priceTier: '$' | '$$' | '$$$' | '$$$$';
  pairings: string[];
  photoUrl?: string;
}

export interface ScanResult {
  name: string;
  kind: Kind;
  producer: string | null;
  region: string | null;
  vintage: number | null;
  abv: number | null;
  expect: string;
  monocleAside: string | null;
  pairings: string[];
  valueNote: string;
  occasion: string;
  confidence: 'high' | 'medium' | 'low';
  photoUrl?: string;
}

export type ResultMode = 'identify' | 'pair';

export interface RoutingMeta {
  mode: 'identify' | 'pair';
  ambiguous: boolean;
  confidence: 'high' | 'medium' | 'low';
}

export interface SmartScanResult {
  mode: 'identify' | 'pair';
  ambiguous: boolean;
  confidence: 'high' | 'medium' | 'low';
  data: ScanResult | PocketSommOutput;
}

export interface PocketSommOutput {
  summary: string;
  recommendations: Recommendation[];
}
