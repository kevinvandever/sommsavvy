/**
 * Unit tests for the on-hand rules shared by updateCellarEntry and
 * recordBottleOutcomes. Pure functions, no mocks.
 *
 * The load-bearing properties:
 * - `owned` and `bottleCount` always agree (a count only while on hand).
 * - On-hand changes never touch `tasted`. The one exception is "Drank it",
 *   which marks the bottle tasted.
 * - An outcome never removes more bottles than are on hand.
 */
import { describe, it, expect } from 'vitest';
import {
  MAX_BOTTLES,
  isValidBottleCount,
  bottlesOnHand,
  resolveOnHandPatch,
  applyOutcome,
} from '../methods/common/onHand';

describe('isValidBottleCount', () => {
  it('accepts whole numbers from 1 to 99', () => {
    expect(MAX_BOTTLES).toBe(99);
    for (const n of [1, 2, 12, 99]) expect(isValidBottleCount(n)).toBe(true);
  });

  it('rejects zero, negatives, fractions, out-of-range values, and non-numbers', () => {
    for (const v of [0, -1, 2.5, 100, NaN, Infinity, '3', null, undefined, true]) {
      expect(isValidBottleCount(v)).toBe(false);
    }
  });
});

describe('bottlesOnHand', () => {
  it('is 0 whenever owned is not true, whatever count is stored', () => {
    for (const owned of [false, null, undefined]) {
      expect(bottlesOnHand({ owned })).toBe(0);
      expect(bottlesOnHand({ owned, bottleCount: 4 })).toBe(0);
      expect(bottlesOnHand({ owned, bottleCount: 0 })).toBe(0);
    }
  });

  it('reads an absent count as one bottle while on hand (legacy and imported rows)', () => {
    expect(bottlesOnHand({ owned: true })).toBe(1);
    expect(bottlesOnHand({ owned: true, bottleCount: null })).toBe(1);
  });

  it('uses a valid stored count while on hand', () => {
    expect(bottlesOnHand({ owned: true, bottleCount: 3 })).toBe(3);
    expect(bottlesOnHand({ owned: true, bottleCount: 99 })).toBe(99);
  });

  it('reads a corrupt stored count as one bottle while on hand', () => {
    for (const bad of [0, -2, 2.5, 100, NaN, '3']) {
      expect(bottlesOnHand({ owned: true, bottleCount: bad as number })).toBe(1);
    }
  });
});

describe('resolveOnHandPatch', () => {
  const onHand3 = { owned: true, bottleCount: 3 };
  const onHandLegacy = { owned: true };
  const offRack = { owned: false };
  const offRackLegacy = { owned: null };

  it('makes no on-hand change when neither key is provided', () => {
    expect(resolveOnHandPatch(onHand3, {})).toEqual({ ok: true, fields: null });
    expect(resolveOnHandPatch(onHand3, { notes: 'x' })).toEqual({ ok: true, fields: null });
  });

  it('treats null and undefined as not provided', () => {
    expect(resolveOnHandPatch(onHand3, { owned: null, bottleCount: null })).toEqual({
      ok: true,
      fields: null,
    });
    expect(resolveOnHandPatch(offRack, { owned: undefined, bottleCount: undefined })).toEqual({
      ok: true,
      fields: null,
    });
    expect(resolveOnHandPatch(onHand3, { owned: null, bottleCount: 5 })).toEqual({
      ok: true,
      fields: { owned: true, bottleCount: 5 },
    });
    expect(resolveOnHandPatch(offRack, { owned: true, bottleCount: null })).toEqual({
      ok: true,
      fields: { owned: true, bottleCount: 1 },
    });
  });

  it('owned false clears the count, whether or not the entry is on hand', () => {
    for (const existing of [onHand3, onHandLegacy, offRack, offRackLegacy]) {
      expect(resolveOnHandPatch(existing, { owned: false })).toEqual({
        ok: true,
        fields: { owned: false, bottleCount: undefined },
      });
    }
  });

  it('rejects owned false together with a count', () => {
    for (const existing of [onHand3, offRack]) {
      expect(resolveOnHandPatch(existing, { owned: false, bottleCount: 2 })).toEqual({
        ok: false,
        reason: 'A bottle count needs the bottle on hand.',
      });
    }
  });

  it('owned true on an entry already on hand keeps its count', () => {
    expect(resolveOnHandPatch(onHand3, { owned: true })).toEqual({
      ok: true,
      fields: { owned: true, bottleCount: 3 },
    });
    expect(resolveOnHandPatch(onHandLegacy, { owned: true })).toEqual({
      ok: true,
      fields: { owned: true, bottleCount: 1 },
    });
  });

  it('owned true on an entry off the rack records one bottle', () => {
    for (const existing of [offRack, offRackLegacy, { owned: false, bottleCount: 7 }]) {
      expect(resolveOnHandPatch(existing, { owned: true })).toEqual({
        ok: true,
        fields: { owned: true, bottleCount: 1 },
      });
    }
  });

  it('owned true with a count sets that count, on or off the rack', () => {
    for (const existing of [onHand3, offRack]) {
      expect(resolveOnHandPatch(existing, { owned: true, bottleCount: 6 })).toEqual({
        ok: true,
        fields: { owned: true, bottleCount: 6 },
      });
    }
  });

  it('a count alone sets the count on an entry already on hand', () => {
    expect(resolveOnHandPatch(onHand3, { bottleCount: 4 })).toEqual({
      ok: true,
      fields: { owned: true, bottleCount: 4 },
    });
    expect(resolveOnHandPatch(onHandLegacy, { bottleCount: 2 })).toEqual({
      ok: true,
      fields: { owned: true, bottleCount: 2 },
    });
  });

  it('rejects a count alone on an entry that is not on hand', () => {
    for (const existing of [offRack, offRackLegacy]) {
      expect(resolveOnHandPatch(existing, { bottleCount: 2 })).toEqual({
        ok: false,
        reason: 'A bottle count needs the bottle on hand.',
      });
    }
  });

  it('rejects a non-boolean owned', () => {
    for (const owned of ['yes', 1, 0, {}]) {
      expect(resolveOnHandPatch(onHand3, { owned })).toEqual({
        ok: false,
        reason: 'On hand needs to be yes or no.',
      });
    }
  });

  it('rejects an invalid count before applying any other rule', () => {
    for (const bottleCount of [0, -1, 100, 2.5, '3']) {
      expect(resolveOnHandPatch(onHand3, { bottleCount })).toEqual({
        ok: false,
        reason: 'A bottle count runs from 1 to 99.',
      });
      expect(resolveOnHandPatch(offRack, { owned: false, bottleCount })).toEqual({
        ok: false,
        reason: 'A bottle count runs from 1 to 99.',
      });
    }
  });

  it('never emits anything other than owned and bottleCount', () => {
    const r = resolveOnHandPatch(onHand3, { owned: true, bottleCount: 2, tasted: false, notes: 'x' });
    expect(r.ok && r.fields && Object.keys(r.fields).sort()).toEqual(['bottleCount', 'owned']);
  });
});

describe('applyOutcome', () => {
  it('"Drank it" on the last bottle takes the entry off the rack and marks it tasted', () => {
    const r = applyOutcome({ owned: true, tasted: false }, { drank: 1 });
    expect(r).toEqual({
      ok: true,
      patch: { owned: false, bottleCount: undefined, tasted: true },
      previous: { owned: true, bottleCount: 1, tasted: false },
      tastedFlipped: true,
    });
  });

  it('"Gave it away" on the last bottle takes the entry off the rack and leaves tasted out of the patch', () => {
    const r = applyOutcome({ owned: true, bottleCount: 1, tasted: false }, { gaveAway: 1 });
    expect(r).toEqual({
      ok: true,
      patch: { owned: false, bottleCount: undefined },
      previous: { owned: true, bottleCount: 1, tasted: false },
      tastedFlipped: false,
    });
    expect(r.ok && 'tasted' in r.patch).toBe(false);
  });

  it('removes one bottle and keeps the entry on hand while bottles remain', () => {
    const drank = applyOutcome({ owned: true, bottleCount: 3, tasted: true }, { drank: 1 });
    expect(drank.ok && drank.patch).toEqual({ owned: true, bottleCount: 2, tasted: true });

    const gave = applyOutcome({ owned: true, bottleCount: 3, tasted: false }, { gaveAway: 1, drank: 0 });
    expect(gave.ok && gave.patch).toEqual({ owned: true, bottleCount: 2 });
  });

  it('applies a mixed outcome in one step', () => {
    const r = applyOutcome({ owned: true, bottleCount: 2, tasted: false }, { drank: 1, gaveAway: 1 });
    expect(r).toEqual({
      ok: true,
      patch: { owned: false, bottleCount: undefined, tasted: true },
      previous: { owned: true, bottleCount: 2, tasted: false },
      tastedFlipped: true,
    });

    const partial = applyOutcome({ owned: true, bottleCount: 5 }, { drank: 2, gaveAway: 1 });
    expect(partial.ok && partial.patch).toEqual({ owned: true, bottleCount: 2, tasted: true });
  });

  it('flips tasted only when it was explicitly false', () => {
    const flip = (tasted: boolean | null | undefined) => {
      const r = applyOutcome({ owned: true, tasted }, { drank: 1 });
      return r.ok && r.tastedFlipped;
    };
    expect(flip(false)).toBe(true);
    expect(flip(true)).toBe(false);
    expect(flip(null)).toBe(false); // legacy null reads as tasted
    expect(flip(undefined)).toBe(false);

    const gave = applyOutcome({ owned: true, tasted: false }, { gaveAway: 1 });
    expect(gave.ok && gave.tastedFlipped).toBe(false);
  });

  it('snapshots the state before the outcome, with tasted normalized', () => {
    const legacy = applyOutcome({ owned: true, tasted: null }, { gaveAway: 1 });
    expect(legacy.ok && legacy.previous).toEqual({ owned: true, bottleCount: 1, tasted: true });

    const counted = applyOutcome({ owned: true, bottleCount: 4, tasted: false }, { drank: 1 });
    expect(counted.ok && counted.previous).toEqual({ owned: true, bottleCount: 4, tasted: false });
  });

  it('rejects an outcome with nothing to record', () => {
    for (const counts of [
      {},
      { drank: 0 },
      { drank: 0, gaveAway: 0 },
      { drank: -1 },
      { drank: 1.5 },
      { gaveAway: '1' },
      { drank: 100 },
      { drank: null, gaveAway: null },
    ]) {
      expect(applyOutcome({ owned: true, bottleCount: 3 }, counts)).toEqual({
        ok: false,
        reason: 'Nothing to record.',
      });
    }
  });

  it('rejects an outcome on an entry that is not on hand', () => {
    for (const existing of [{ owned: false }, { owned: null }, { owned: false, bottleCount: 3 }]) {
      expect(applyOutcome(existing, { drank: 1 })).toEqual({
        ok: false,
        reason: 'Not on hand anymore.',
      });
    }
  });

  it('rejects removing more bottles than are on hand', () => {
    expect(applyOutcome({ owned: true, bottleCount: 2 }, { drank: 2, gaveAway: 1 })).toEqual({
      ok: false,
      reason: 'Only 2 on hand.',
    });
    expect(applyOutcome({ owned: true }, { gaveAway: 2 })).toEqual({
      ok: false,
      reason: 'Only 1 on hand.',
    });
  });
});
