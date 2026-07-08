import { auth } from '../runtime';
import { CellarEntries } from './tables/cellarEntries';
import type { CellarEntry } from './tables/cellarEntries';
import { runTasteSummaryRegen } from './common/regenerateTasteSummaryInternal';

interface UpdateInput {
  id: string;
  patch: Partial<Omit<CellarEntry, 'userId' | 'savedAt'>>;
}

export async function updateCellarEntry(input: UpdateInput) {
  if (!auth.userId) {
    throw new Error('Sign in to edit your cellar.');
  }

  const existing = await CellarEntries.get(input.id);
  if (!existing || existing.userId !== auth.userId) {
    throw new Error('Entry not found.');
  }

  // Strip any fields a client should never set.
  const safe: Partial<CellarEntry> = { ...input.patch };
  delete (safe as Record<string, unknown>).userId;
  delete (safe as Record<string, unknown>).savedAt;

  const entry = await CellarEntries.update(input.id, safe);

  // INVARIANT: Regen fires only for taste-relevant fields. `owned` is deliberately
  // excluded — toggling ownership must never trigger taste-summary regeneration.
  // See design correctness property 2.
  const profileFields: (keyof CellarEntry)[] = ['notes', 'tastedAt', 'kind', 'producer', 'tasted'];
  if (profileFields.some((k) => k in input.patch)) {
    const userId = auth.userId;
    runTasteSummaryRegen(userId).catch((err) => {
      console.error('Background taste regen failed:', err);
    });
  }

  return { entry };
}
