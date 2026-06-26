import { db, auth } from '../runtime';
import { CellarEntries } from './tables/cellarEntries';
import { runTasteSummaryRegen } from './common/regenerateTasteSummaryInternal';

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
  });

  // Fire-and-forget regenerate the taste summary. The user does not wait for it.
  const userId = auth.userId;
  runTasteSummaryRegen(userId).catch((err) => {
    console.error('Background taste regen failed:', err);
  });

  return { entry };
}
