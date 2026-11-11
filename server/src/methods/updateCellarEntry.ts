import { auth } from '../runtime';
import { CellarEntries } from './tables/cellarEntries';
import type { CellarEntry } from './tables/cellarEntries';
import { runTasteSummaryRegen } from './common/regenerateTasteSummaryInternal';
import { resolveOnHandPatch } from './common/onHand';

interface UpdateInput {
  id: string;
  patch: Partial<Omit<CellarEntry, 'userId' | 'savedAt'>>;
}

export async function updateCellarEntry(input: UpdateInput) {
  if (!auth.userId) {
    throw new Error('Sign in to edit your cellar.');
  }

  const patch = input?.patch;
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new Error('Nothing to update.');
  }

  const existing = await CellarEntries.get(input.id);
  if (!existing || existing.userId !== auth.userId) {
    throw new Error('Entry not found.');
  }

  // Strip any fields a client should never set. `owned` and `bottleCount` are
  // also stripped here and written only through resolveOnHandPatch below, so
  // the two always agree.
  const safe: Partial<CellarEntry> = { ...patch };
  delete (safe as Record<string, unknown>).userId;
  delete (safe as Record<string, unknown>).savedAt;
  delete (safe as Record<string, unknown>).owned;
  delete (safe as Record<string, unknown>).bottleCount;

  if ('owned' in patch || 'bottleCount' in patch) {
    const resolved = resolveOnHandPatch(existing, patch as Record<string, unknown>);
    if (!resolved.ok) throw new Error(resolved.reason);
    // A `bottleCount: undefined` here clears the stored count.
    if (resolved.fields) Object.assign(safe, resolved.fields);
  }

  const entry = await CellarEntries.update(input.id, safe);

  // INVARIANT: Regen fires only for taste-relevant fields. `owned` and
  // `bottleCount` form the owned axis and are deliberately absent from this
  // list: changing ownership or the bottle count must never trigger
  // taste-summary regeneration. See design correctness property 2.
  const profileFields: (keyof CellarEntry)[] = ['notes', 'tastedAt', 'kind', 'producer', 'tasted'];
  if (profileFields.some((k) => k in patch)) {
    const userId = auth.userId;
    runTasteSummaryRegen(userId).catch((err) => {
      console.error('Background taste regen failed:', err);
    });
  }

  return { entry };
}
