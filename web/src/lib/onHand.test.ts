import { describe, it, expect } from 'vitest';
import {
  MAX_BOTTLES,
  applyOnHandPatch,
  bottlesOnHand,
  outcomeItems,
  outcomeMessage,
  previewOutcome,
  resetRow,
  rowLeft,
  rowStatus,
  stage,
  stagedBottles,
  toRackRows,
  undoPatchFor,
  type RackRow,
} from './onHand';
import type { CellarEntry } from '../types';

let nextId = 1;
function entry(fields: Partial<CellarEntry> = {}): CellarEntry {
  return {
    id: String(nextId++),
    userId: 'u1',
    kind: 'wine',
    name: 'Bandol Rouge',
    source: 'import',
    savedAt: 1,
    ...fields,
  };
}

function row(onHand: number, drank = 0, gaveAway = 0, fields: Partial<CellarEntry> = {}): RackRow {
  return { entry: entry({ owned: true, bottleCount: onHand, ...fields }), onHand, drank, gaveAway };
}

describe('bottlesOnHand', () => {
  it('matches the server rules', () => {
    expect(MAX_BOTTLES).toBe(99);
    expect(bottlesOnHand({ owned: false, bottleCount: 3 })).toBe(0);
    expect(bottlesOnHand({ owned: undefined })).toBe(0);
    expect(bottlesOnHand({ owned: true })).toBe(1);
    expect(bottlesOnHand({ owned: true, bottleCount: 4 })).toBe(4);
    for (const bad of [0, -1, 2.5, 100]) {
      expect(bottlesOnHand({ owned: true, bottleCount: bad })).toBe(1);
    }
  });
});

describe('previewOutcome', () => {
  it('"Drank it" on the last bottle: off the rack, no count, tasted', () => {
    const e = entry({ owned: true, tasted: false });
    const next = previewOutcome(e, 'drank');
    expect(next.owned).toBe(false);
    expect('bottleCount' in next).toBe(false);
    expect(next.tasted).toBe(true);
  });

  it('"Gave it away" on the last bottle: off the rack, tasted unchanged', () => {
    const e = entry({ owned: true, bottleCount: 1, tasted: false });
    const next = previewOutcome(e, 'gave_away');
    expect(next.owned).toBe(false);
    expect('bottleCount' in next).toBe(false);
    expect(next.tasted).toBe(false);

    const legacy = previewOutcome(entry({ owned: true }), 'gave_away');
    expect('tasted' in legacy).toBe(false);
  });

  it('removes one bottle and stays on hand while bottles remain', () => {
    const e = entry({ owned: true, bottleCount: 3, tasted: false });
    expect(previewOutcome(e, 'drank')).toMatchObject({ owned: true, bottleCount: 2, tasted: true });
    expect(previewOutcome(e, 'gave_away')).toMatchObject({ owned: true, bottleCount: 2, tasted: false });
  });

  it('leaves an entry that is not on hand unchanged', () => {
    const e = entry({ owned: false, tasted: false });
    expect(previewOutcome(e, 'drank')).toBe(e);
  });

  it('never touches notes or identity', () => {
    const e = entry({ owned: true, bottleCount: 2, notes: 'Mine.', producer: 'Tempier' });
    expect(previewOutcome(e, 'drank')).toMatchObject({ notes: 'Mine.', producer: 'Tempier', name: e.name });
  });
});

describe('applyOnHandPatch', () => {
  it('owned false clears the count', () => {
    const next = applyOnHandPatch(entry({ owned: true, bottleCount: 3 }), { owned: false });
    expect(next.owned).toBe(false);
    expect('bottleCount' in next).toBe(false);
  });

  it('owned true takes the patch count, else the current count, else one', () => {
    expect(applyOnHandPatch(entry({ owned: false }), { owned: true, bottleCount: 4 })).toMatchObject({
      owned: true,
      bottleCount: 4,
    });
    expect(applyOnHandPatch(entry({ owned: true, bottleCount: 3 }), { owned: true })).toMatchObject({
      owned: true,
      bottleCount: 3,
    });
    expect(applyOnHandPatch(entry({ owned: false, bottleCount: 5 }), { owned: true })).toMatchObject({
      owned: true,
      bottleCount: 1,
    });
  });

  it('a count alone sets owned true', () => {
    expect(applyOnHandPatch(entry({ owned: true }), { bottleCount: 2 })).toMatchObject({
      owned: true,
      bottleCount: 2,
    });
  });

  it('spreads other fields and leaves on hand alone without on-hand keys', () => {
    const e = entry({ owned: true, bottleCount: 2, tasted: true });
    expect(applyOnHandPatch(e, { tasted: false })).toMatchObject({ owned: true, bottleCount: 2, tasted: false });
    expect(applyOnHandPatch(e, { owned: true, bottleCount: 3, tasted: false })).toMatchObject({
      owned: true,
      bottleCount: 3,
      tasted: false,
    });
  });
});

describe('undoPatchFor', () => {
  it('restores tasted only when the outcome changed it', () => {
    expect(undoPatchFor({ owned: true, bottleCount: 3, tasted: false }, { tasted: true })).toEqual({
      owned: true,
      bottleCount: 3,
      tasted: false,
    });
    expect(undoPatchFor({ owned: true, bottleCount: 1, tasted: true }, { tasted: true })).toEqual({
      owned: true,
      bottleCount: 1,
    });
    expect(undoPatchFor({ owned: true, bottleCount: 2, tasted: false }, { tasted: false })).toEqual({
      owned: true,
      bottleCount: 2,
    });
    // A legacy entry with no tasted value reads as tasted on both sides.
    expect(undoPatchFor({ owned: true, bottleCount: 1, tasted: true }, {})).toEqual({
      owned: true,
      bottleCount: 1,
    });
  });
});

describe('outcomeMessage', () => {
  it('covers each outcome, with and without bottles left', () => {
    expect(outcomeMessage('drank', 0)).toBe('Finished.');
    expect(outcomeMessage('drank', 2)).toBe('One down. 2 left.');
    expect(outcomeMessage('gave_away', 0)).toBe('Off the rack.');
    expect(outcomeMessage('gave_away', 1)).toBe('One given away. 1 left.');
  });
});

describe('rack check staging', () => {
  it('toRackRows keeps on-hand entries only, sorted by name then producer', () => {
    const rows = toRackRows([
      entry({ name: 'syrah', producer: 'Zeta', owned: true, bottleCount: 2 }),
      entry({ name: 'Albariño', owned: true }),
      entry({ name: 'Syrah', producer: 'Alpha', owned: true }),
      entry({ name: 'Barolo', owned: false }),
      entry({ name: 'Cava' }),
    ]);
    expect(rows.map((r) => [r.entry.name, r.entry.producer ?? null, r.onHand])).toEqual([
      ['Albariño', null, 1],
      ['Syrah', 'Alpha', 1],
      ['syrah', 'Zeta', 2],
    ]);
    expect(rows.every((r) => r.drank === 0 && r.gaveAway === 0)).toBe(true);
  });

  it('stage marks one bottle per tap and stops when none are left', () => {
    let r = row(2);
    r = stage(r, 'drank');
    expect([r.drank, r.gaveAway, rowLeft(r)]).toEqual([1, 0, 1]);
    r = stage(r, 'gave_away');
    expect([r.drank, r.gaveAway, rowLeft(r)]).toEqual([1, 1, 0]);
    const stuck = stage(r, 'drank');
    expect(stuck).toBe(r);
    expect(rowLeft(stuck)).toBe(0);
  });

  it('resetRow clears the marks', () => {
    const r = resetRow(row(3, 2, 1));
    expect([r.drank, r.gaveAway, rowLeft(r)]).toEqual([0, 0, 3]);
  });

  it('rowStatus covers unmarked, one-bottle, and larger rows', () => {
    expect(rowStatus(row(1))).toBeNull();
    expect(rowStatus(row(3))).toBeNull();
    expect(rowStatus(row(1, 1, 0))).toBe('Drank it.');
    expect(rowStatus(row(1, 0, 1))).toBe('Gave it away.');
    expect(rowStatus(row(3, 1, 0))).toBe('Drank 1. 2 left.');
    expect(rowStatus(row(3, 0, 1))).toBe('Gave away 1. 2 left.');
    expect(rowStatus(row(3, 1, 1))).toBe('Drank 1, gave away 1. 1 left.');
    expect(rowStatus(row(2, 2, 0))).toBe('Drank 2. None left.');
    expect(rowStatus(row(2, 0, 2))).toBe('Gave away 2. None left.');
  });

  it('outcomeItems sends marked rows only; stagedBottles counts every mark', () => {
    const rows = [row(2, 1, 1), row(1), row(3, 0, 2), row(1, 1, 0)];
    expect(outcomeItems(rows)).toEqual([
      { id: rows[0].entry.id, drank: 1, gaveAway: 1 },
      { id: rows[2].entry.id, drank: 0, gaveAway: 2 },
      { id: rows[3].entry.id, drank: 1, gaveAway: 0 },
    ]);
    expect(stagedBottles(rows)).toBe(5);
    expect(stagedBottles([row(2)])).toBe(0);
    expect(outcomeItems([row(2)])).toEqual([]);
  });
});

describe('copy follows the voice rules', () => {
  it('has no exclamation points or em dashes', () => {
    const lines = [
      outcomeMessage('drank', 0),
      outcomeMessage('drank', 3),
      outcomeMessage('gave_away', 0),
      outcomeMessage('gave_away', 3),
      rowStatus(row(1, 1, 0)),
      rowStatus(row(1, 0, 1)),
      rowStatus(row(4, 1, 2)),
      rowStatus(row(2, 0, 2)),
    ];
    for (const line of lines) {
      expect(line).not.toMatch(/[!\u2014]/);
    }
  });
});
