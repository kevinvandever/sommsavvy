import { auth } from '../runtime';
import { CellarEntries, type CellarEntry } from './tables/cellarEntries';
import type { Hydrated } from '../db/adapter';
import { runTasteSummaryRegen } from './common/regenerateTasteSummaryInternal';
import { applyOutcome, type OnHandSnapshot } from './common/onHand';
import { logEvent, BOTTLE_OUTCOMES } from '../observability/events';

// Records how bottles left the rack: "Drank it" or "Gave it away". One method
// serves both the entry page (one item) and the rack check (every marked row),
// so both share one code path.
//
// Three properties this method upholds deliberately:
//
// 1. THE SERVER OWNS THE DECREMENT. Each item is applied to the stored count,
//    never to the client's copy, so a stale screen cannot remove more bottles
//    than are on hand.
//
// 2. PARTIAL SUCCESS. One bad row (missing, someone else's, already off the
//    rack, over the count) is reported in `rejected` and the rest still apply.
//
// 3. AT MOST ONE TASTE REGENERATION PER REQUEST, and only when an entry
//    actually went from untasted to tasted. "Gave it away", and "Drank it" on
//    a bottle that was already tasted, change nothing the profile reads.

export const MAX_OUTCOME_ITEMS = 200;

export interface BottleOutcomeItem {
  id: string;
  drank?: number;
  gaveAway?: number;
}

export interface RecordBottleOutcomesInput {
  items: BottleOutcomeItem[];
  surface?: 'entry' | 'rack_check'; // observability only
}

export interface RecordBottleOutcomesResult {
  applied: Array<{ id: string; entry: Hydrated<CellarEntry>; previous: OnHandSnapshot }>;
  rejected: Array<{ id: string; reason: string }>;
}

export async function recordBottleOutcomes(
  input: RecordBottleOutcomesInput,
): Promise<RecordBottleOutcomesResult> {
  if (!auth.userId) {
    throw new Error('Sign in to edit your cellar.');
  }
  const userId = auth.userId;

  const items: unknown[] = Array.isArray(input?.items) ? input.items : [];
  if (items.length === 0) {
    throw new Error('Nothing to update.');
  }
  if (items.length > MAX_OUTCOME_ITEMS) {
    throw new Error(`That is more than ${MAX_OUTCOME_ITEMS} at once.`);
  }

  const applied: RecordBottleOutcomesResult['applied'] = [];
  const rejected: RecordBottleOutcomesResult['rejected'] = [];
  const seen = new Set<string>();
  let drankTotal = 0;
  let gaveAwayTotal = 0;
  let flippedCount = 0;

  for (const raw of items) {
    const item = (raw && typeof raw === 'object' ? raw : {}) as Partial<BottleOutcomeItem>;
    const id = typeof item.id === 'string' ? item.id.trim() : '';
    if (!id || id.length > 100) {
      rejected.push({ id: String(item.id ?? '').slice(0, 100), reason: 'Not a valid entry.' });
      continue;
    }
    if (seen.has(id)) {
      rejected.push({ id, reason: 'Listed twice.' });
      continue;
    }
    seen.add(id);

    try {
      const existing = await CellarEntries.get(id);
      // Someone else's entry reads the same as a missing one, so its
      // existence is not revealed.
      if (!existing || existing.userId !== userId) {
        rejected.push({ id, reason: 'Not in your cellar.' });
        continue;
      }

      const outcome = applyOutcome(existing, item);
      if (!outcome.ok) {
        rejected.push({ id, reason: outcome.reason });
        continue;
      }

      // A `bottleCount: undefined` in the patch clears the stored count.
      const entry = await CellarEntries.update(id, outcome.patch);
      applied.push({ id, entry, previous: outcome.previous });
      drankTotal += item.drank ?? 0;
      gaveAwayTotal += item.gaveAway ?? 0;
      if (outcome.tastedFlipped) flippedCount++;
    } catch (err) {
      console.error('Bottle outcome failed:', { entryId: id }, err);
      rejected.push({ id, reason: 'Could not be updated.' });
    }
  }

  // One regeneration for the whole request, and only on a real tasted flip.
  // Fire-and-forget: the outcome stands even if regeneration fails.
  if (flippedCount > 0) {
    runTasteSummaryRegen(userId).catch((err) => {
      console.error('Background taste regen failed:', err);
    });
  }

  logEvent(BOTTLE_OUTCOMES, {
    userId,
    surface:
      input?.surface === 'entry' || input?.surface === 'rack_check' ? input.surface : 'unknown',
    applied: applied.length,
    rejected: rejected.length,
    drank: drankTotal,
    gaveAway: gaveAwayTotal,
    tastedFlipped: flippedCount,
  });

  return { applied, rejected };
}
