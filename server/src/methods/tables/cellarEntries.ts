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
  source: 'somm' | 'scan' | 'manual';
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
}

export const CellarEntries = db.defineTable<CellarEntry>('cellar_entries', {
  defaults: { tasted: true, owned: false },
});
