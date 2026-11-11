import { db } from '../../runtime';

// One row per saved drink in a user's cellar.
export interface CellarEntry {
  userId: string;
  kind: 'wine' | 'beer' | 'spirits';
  name: string;
  producer?: string;
  region?: string;
  vintage?: number;
  abv?: number;
  photoUrl?: string;
  // 'import' marks rows created by bulk document import: AI-parsed, owned,
  // and untasted. Distinct from 'manual' (hand-typed) so imported rows stay
  // identifiable for later review.
  source: 'somm' | 'scan' | 'manual' | 'import';
  notes?: string;
  // Editorial extras carried over from the AI return so the entry detail
  // page has rich context without a follow-up call.
  whyText?: string;
  monocleAside?: string;
  pairings?: string[];
  occasion?: string;
  valueNote?: string;
  tastedAt?: number; // unix ms; distinct from savedAt
  savedAt: number; // unix ms; default sort key
  // Two independent dimensions. tasted: has the user experienced this? Drives
  // the taste profile, defaults true (null treated as true). owned: does the
  // user physically hold it unopened? Drives inventory features, defaults
  // false (null treated as false).
  tasted?: boolean;
  owned?: boolean;
  // Bottles physically on hand. Meaningful only while owned is true: a whole
  // number from 1 to 99, read as 1 when absent (legacy and bulk-imported rows).
  // While owned is not true it reads as 0 and is cleared on the next on-hand
  // write. Part of the owned axis: changing it never triggers a taste regen.
  // An inventory quantity, never a rating.
  bottleCount?: number;
}

export const CellarEntries = db.defineTable<CellarEntry>('cellar_entries', {
  defaults: { tasted: true, owned: false },
});
