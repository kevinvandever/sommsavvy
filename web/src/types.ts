// Shared types for SommSavvy frontend.

export type Depth = 'beginner' | 'enthusiast' | 'expert';
export type Kind = 'wine' | 'beer' | 'spirits';
export type Source = 'somm' | 'scan' | 'manual';

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

export type Mode = 'somm' | 'scan';

export interface PocketSommOutput {
  summary: string;
  recommendations: Recommendation[];
}
