// The on-hand rules: how `owned` and `bottleCount` agree, and how a bottle
// outcome ("Drank it", "Gave it away") changes an entry.
//
// Pure, with no runtime imports, so every write path shares one set of rules
// and the rules can be tested without a database. The two writers are
// updateCellarEntry (the switch, the count control, Undo) and
// recordBottleOutcomes (the entry page outcomes and the rack check).
//
// INVARIANT: these rules only ever emit `owned` and `bottleCount`, plus
// `tasted: true` for "Drank it". Nothing here may emit a taste-profile field
// other than that one requested coupling.

export const MAX_BOTTLES = 99;

// An entry's on-hand state just before an outcome, returned so Undo can
// restore it.
export interface OnHandSnapshot {
  owned: true;
  bottleCount: number; // bottles on hand before the outcome, 1..99
  tasted: boolean; // normalized: null reads as true
}

interface OnHandFields {
  owned?: boolean | null;
  bottleCount?: number | null;
}

// True for an integer from 1 to MAX_BOTTLES.
export function isValidBottleCount(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= MAX_BOTTLES;
}

// The effective number of bottles: 0 when the entry is not on hand, otherwise
// the stored count, read as 1 when absent or invalid.
export function bottlesOnHand(e: OnHandFields): number {
  if (e.owned !== true) return 0;
  return isValidBottleCount(e.bottleCount) ? e.bottleCount : 1;
}

export type OnHandResolution =
  | { ok: true; fields: { owned: boolean; bottleCount: number | undefined } | null }
  | { ok: false; reason: string };

const NEEDS_ON_HAND = 'A bottle count needs the bottle on hand.';

// Resolves the on-hand part of an update patch into the `owned` and
// `bottleCount` values to write. Reads only patch.owned and patch.bottleCount;
// undefined and null both count as not provided. `fields: null` means the
// patch makes no on-hand change. A `bottleCount: undefined` in the result
// clears the stored count.
export function resolveOnHandPatch(
  existing: OnHandFields,
  patch: Record<string, unknown>,
): OnHandResolution {
  const owned = patch.owned ?? undefined;
  const count = patch.bottleCount ?? undefined;

  if (owned !== undefined && typeof owned !== 'boolean') {
    return { ok: false, reason: 'On hand needs to be yes or no.' };
  }
  if (count !== undefined && !isValidBottleCount(count)) {
    return { ok: false, reason: 'A bottle count runs from 1 to 99.' };
  }

  if (owned === undefined && count === undefined) return { ok: true, fields: null };

  if (owned === false) {
    if (count !== undefined) return { ok: false, reason: NEEDS_ON_HAND };
    return { ok: true, fields: { owned: false, bottleCount: undefined } };
  }

  if (owned === true) {
    if (count !== undefined) return { ok: true, fields: { owned: true, bottleCount: count } };
    // Turning on an entry that is already on hand keeps its count; turning on
    // one that is not records one bottle.
    const n = bottlesOnHand(existing);
    return { ok: true, fields: { owned: true, bottleCount: n > 0 ? n : 1 } };
  }

  // A count alone. Only an entry already on hand can take one.
  if (bottlesOnHand(existing) === 0) return { ok: false, reason: NEEDS_ON_HAND };
  return { ok: true, fields: { owned: true, bottleCount: count } };
}

export type OutcomeResolution =
  | {
      ok: true;
      patch: { owned: boolean; bottleCount: number | undefined; tasted?: true };
      previous: OnHandSnapshot;
      tastedFlipped: boolean;
    }
  | { ok: false; reason: string };

function isOutcomeCount(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= MAX_BOTTLES;
}

// Applies "Drank it" and "Gave it away" counts to an entry. Each bottle
// removed lowers the count; the last one takes the entry off the rack.
// "Drank it" marks the entry tasted. "Gave it away" leaves tasted out of the
// patch entirely. Never touches notes, identity, or editorial fields.
export function applyOutcome(
  existing: OnHandFields & { tasted?: boolean | null },
  counts: { drank?: unknown; gaveAway?: unknown },
): OutcomeResolution {
  const drank = counts.drank ?? 0;
  const gaveAway = counts.gaveAway ?? 0;
  if (!isOutcomeCount(drank) || !isOutcomeCount(gaveAway) || drank + gaveAway < 1) {
    return { ok: false, reason: 'Nothing to record.' };
  }

  const n = bottlesOnHand(existing);
  if (n === 0) return { ok: false, reason: 'Not on hand anymore.' };
  if (drank + gaveAway > n) return { ok: false, reason: `Only ${n} on hand.` };

  const left = n - drank - gaveAway;
  const patch: { owned: boolean; bottleCount: number | undefined; tasted?: true } = {
    owned: left > 0,
    bottleCount: left > 0 ? left : undefined,
  };
  if (drank >= 1) patch.tasted = true;

  return {
    ok: true,
    patch,
    previous: { owned: true, bottleCount: n, tasted: existing.tasted !== false },
    // A legacy null reads as tasted, so it never flips.
    tastedFlipped: drank >= 1 && existing.tasted === false,
  };
}
