import { db, auth } from '../runtime';
import { CellarEntries } from './tables/cellarEntries';
import { runTasteSummaryRegen } from './common/regenerateTasteSummaryInternal';
import { logEvent, CELLAR_SAVED } from '../observability/events';

/**
 * Save input contract (Requirements 4.1, 4.4):
 * All five Identity_Fields (name, producer, region, vintage, kind) are accepted
 * directly from the client. The save persists the client-supplied (edited) values,
 * not the original model guess. Re-fetch via getEntry returns these persisted values.
 */
interface SaveInput {
  kind: 'wine' | 'beer' | 'spirits';
  name: string;
  producer?: string;
  region?: string;
  vintage?: number;
  abv?: number;
  photoUrl?: string;
  source: 'somm' | 'scan' | 'manual';
  notes?: string;
  whyText?: string;
  monocleAside?: string;
  pairings?: string[];
  occasion?: string;
  valueNote?: string;
  tastedAt?: number;
  tasted?: boolean;
  owned?: boolean;
}

export async function saveCellarEntry(input: SaveInput) {
  if (!auth.userId) {
    throw new Error('Sign in to save to your cellar.');
  }

  if (!input.name?.trim()) {
    throw new Error('Need a name to save this one.');
  }
  if (!['wine', 'beer', 'spirits'].includes(input.kind)) {
    throw new Error('Pick wine, beer, or spirits.');
  }

  if (input.vintage != null) {
    const maxYear = new Date().getFullYear() + 1;
    if (input.vintage < 1900 || input.vintage > maxYear) {
      throw new Error(
        `Vintage must be a year between 1900 and ${maxYear}.`
      );
    }
  }

  // For the scan path, explicitly set tasted/owned so behavior does not rely
  // on table defaults alone. Other paths pass through whatever the caller sent
  // (falling back to table defaults when undefined).
  const tasted = input.source === 'scan' ? true : input.tasted;
  const owned = input.source === 'scan' ? false : input.owned;

  const entry = await CellarEntries.push({
    userId: auth.userId,
    kind: input.kind,
    name: input.name.trim(),
    producer: input.producer?.trim() || undefined,
    region: input.region?.trim() || undefined,
    vintage: input.vintage,
    abv: input.abv,
    photoUrl: input.photoUrl?.trim() || undefined,
    source: input.source,
    notes: input.notes?.trim() || undefined,
    whyText: input.whyText?.trim() || undefined,
    monocleAside: input.monocleAside?.trim() || undefined,
    pairings: input.pairings?.length ? input.pairings : undefined,
    occasion: input.occasion?.trim() || undefined,
    valueNote: input.valueNote?.trim() || undefined,
    tastedAt: input.tastedAt,
    savedAt: db.now(),
    tasted,
    owned,
  });

  logEvent(CELLAR_SAVED, { userId: auth.userId, entryId: entry.id });

  // INVARIANT: Taste regen fires only on saves (here), removes, profile-relevant
  // updates, and explicit user refresh. It derives from tasted entries only and is
  // never triggered by toggling `owned`. See design correctness property 2.
  const userId = auth.userId;
  runTasteSummaryRegen(userId).catch((err) => {
    console.error('Background taste regen failed:', err);
  });

  return { entry };
}
