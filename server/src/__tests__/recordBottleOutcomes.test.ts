/**
 * recordBottleOutcomes: how bottles leave the rack.
 *
 * Done-when checks for rack check:
 * - "Drank it" leaves an entry not on hand and tasted.
 * - "Gave it away" leaves it not on hand with tasted unchanged.
 *
 * Also covered: counts, at most one taste regeneration per request and only
 * on a real untasted-to-tasted flip, partial success with every rejection
 * reason, the `previous` snapshot Undo relies on, and the request-level
 * errors. The database, the regeneration helper, and event logging are
 * stubbed, as in anonSaveContract.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runWithContext } from '../runtime/context';
import { createStore, stubCellarEntries, type InMemoryStore } from './stubs';
import type { CellarEntry } from '../methods/tables/cellarEntries';
import type { Hydrated } from '../db/adapter';

vi.mock('../methods/tables/cellarEntries', () => {
  let _store: InMemoryStore = { entries: [], regenCalls: [], imageCounter: 0 };
  // Ids whose write throws, to exercise the per-item failure path.
  let _failing = new Set<string>();
  return {
    CellarEntries: {
      get push() { return stubCellarEntries(_store).push; },
      get get() { return stubCellarEntries(_store).get; },
      get update() {
        const update = stubCellarEntries(_store).update;
        return async (id: string, patch: Record<string, unknown>) => {
          if (_failing.has(id)) throw new Error('connection reset');
          return update(id, patch);
        };
      },
      get remove() { return stubCellarEntries(_store).remove; },
      get filter() { return stubCellarEntries(_store).filter; },
      get count() { return stubCellarEntries(_store).count; },
    },
    __setStore(s: InMemoryStore) {
      _store = s;
      _failing = new Set();
    },
    __failWritesFor(ids: string[]) {
      _failing = new Set(ids);
    },
  };
});

vi.mock('../methods/common/regenerateTasteSummaryInternal', () => ({
  runTasteSummaryRegen: vi.fn(async () => {}),
}));

vi.mock('../observability/events', () => ({
  logEvent: vi.fn(),
  BOTTLE_OUTCOMES: 'bottle_outcomes',
}));

const { recordBottleOutcomes, MAX_OUTCOME_ITEMS } = await import('../methods/recordBottleOutcomes');
const { runTasteSummaryRegen } = await import('../methods/common/regenerateTasteSummaryInternal');
const { logEvent } = await import('../observability/events');
const cellarMock = (await import('../methods/tables/cellarEntries')) as unknown as {
  __setStore: (s: InMemoryStore) => void;
  __failWritesFor: (ids: string[]) => void;
};

const regen = vi.mocked(runTasteSummaryRegen);
const events = vi.mocked(logEvent);
const USER = 'user-1';

type Items = Parameters<typeof recordBottleOutcomes>[0]['items'];

describe('recordBottleOutcomes', () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = createStore();
    cellarMock.__setStore(store);
    regen.mockClear();
    events.mockClear();
  });

  const seed = (fields: Record<string, unknown>): Promise<Hydrated<CellarEntry>> =>
    stubCellarEntries(store).push({
      userId: USER,
      name: 'Bandol Rouge',
      ...(fields as Partial<CellarEntry>),
    });

  const recordAs = (userId: string | undefined, items: unknown, surface?: string) =>
    runWithContext({ userId }, () =>
      recordBottleOutcomes({
        items: items as Items,
        surface: surface as 'entry' | 'rack_check' | undefined,
      }),
    );
  const record = (items: unknown, surface?: string) => recordAs(USER, items, surface);

  const stored = (id: string) => store.entries.find((e) => e.id === id)!;

  describe('"Drank it" (Done-when)', () => {
    it('takes the last bottle off the rack and marks the entry tasted', async () => {
      const e = await seed({
        owned: true,
        tasted: false,
        source: 'import',
        producer: 'Domaine Tempier',
        notes: 'From the club box.',
        whyText: 'Savory and firm.',
      });

      const { applied, rejected } = await record([{ id: e.id, drank: 1 }], 'entry');

      expect(rejected).toEqual([]);
      expect(applied).toHaveLength(1);
      const after = stored(e.id);
      expect(after.owned).toBe(false);
      expect(after.bottleCount).toBeUndefined();
      expect(after.tasted).toBe(true);
      expect(applied[0]!.entry).toEqual(after);
      expect(regen).toHaveBeenCalledTimes(1);
      expect(regen).toHaveBeenCalledWith(USER);

      // Never deletes the entry or touches notes, identity, or editorial fields.
      expect(store.entries).toHaveLength(1);
      expect(after).toMatchObject({
        name: 'Bandol Rouge',
        producer: 'Domaine Tempier',
        notes: 'From the club box.',
        whyText: 'Savory and firm.',
        source: 'import',
      });
    });
  });

  describe('"Gave it away" (Done-when)', () => {
    it('takes the last bottle off the rack and leaves an untasted entry untasted', async () => {
      const e = await seed({ owned: true, tasted: false });

      const { applied, rejected } = await record([{ id: e.id, gaveAway: 1 }]);

      expect(rejected).toEqual([]);
      expect(applied).toHaveLength(1);
      const after = stored(e.id);
      expect(after.owned).toBe(false);
      expect(after.bottleCount).toBeUndefined();
      expect(after.tasted).toBe(false);
      expect(regen).not.toHaveBeenCalled();
    });

    it('leaves a tasted entry tasted', async () => {
      const e = await seed({ owned: true, tasted: true });
      await record([{ id: e.id, gaveAway: 1 }]);
      expect(stored(e.id)).toMatchObject({ owned: false, tasted: true });
      expect(regen).not.toHaveBeenCalled();
    });
  });

  describe('regenerates only on a real untasted-to-tasted flip', () => {
    it('not for "Drank it" on a bottle that is already tasted', async () => {
      const e = await seed({ owned: true, tasted: true });
      await record([{ id: e.id, drank: 1 }]);
      expect(stored(e.id)).toMatchObject({ owned: false, tasted: true });
      expect(regen).not.toHaveBeenCalled();
    });

    it('not for "Drank it" on a legacy entry whose tasted is null', async () => {
      const e = await seed({ owned: true, tasted: null });
      await record([{ id: e.id, drank: 1 }]);
      expect(stored(e.id)).toMatchObject({ owned: false, tasted: true });
      expect(regen).not.toHaveBeenCalled();
    });

    it('once for a whole batch, however many bottles flipped', async () => {
      const a = await seed({ owned: true, tasted: false, name: 'A' });
      const b = await seed({ owned: true, tasted: false, name: 'B' });
      const c = await seed({ owned: true, tasted: false, name: 'C' });

      const { applied } = await record(
        [
          { id: a.id, drank: 1 },
          { id: b.id, drank: 1 },
          { id: c.id, gaveAway: 1 },
        ],
        'rack_check',
      );

      expect(applied.map((x) => x.id)).toEqual([a.id, b.id, c.id]);
      expect(stored(a.id).tasted).toBe(true);
      expect(stored(b.id).tasted).toBe(true);
      expect(stored(c.id).tasted).toBe(false);
      expect(regen).toHaveBeenCalledTimes(1);
      expect(events).toHaveBeenCalledWith('bottle_outcomes', {
        userId: USER,
        surface: 'rack_check',
        applied: 3,
        rejected: 0,
        drank: 2,
        gaveAway: 1,
        tastedFlipped: 2,
      });
    });
  });

  describe('counts', () => {
    it('"Drank it" on one of three bottles leaves two, still on hand, now tasted', async () => {
      const e = await seed({ owned: true, bottleCount: 3, tasted: false });
      await record([{ id: e.id, drank: 1 }]);
      expect(stored(e.id)).toMatchObject({ owned: true, bottleCount: 2, tasted: true });
    });

    it('"Gave it away" on one of two bottles leaves one, tasted unchanged', async () => {
      const e = await seed({ owned: true, bottleCount: 2, tasted: false });
      await record([{ id: e.id, gaveAway: 1 }]);
      expect(stored(e.id)).toMatchObject({ owned: true, bottleCount: 1, tasted: false });
    });

    it('a legacy on-hand entry with no count reads as one bottle and leaves the rack', async () => {
      const e = await seed({ owned: true, tasted: false, source: 'import' });
      await record([{ id: e.id, gaveAway: 1 }]);
      expect(stored(e.id).owned).toBe(false);
      expect(stored(e.id).bottleCount).toBeUndefined();
    });

    it('several bottles of one entry in one item', async () => {
      const e = await seed({ owned: true, bottleCount: 4, tasted: false });
      await record([{ id: e.id, drank: 2, gaveAway: 1 }]);
      expect(stored(e.id)).toMatchObject({ owned: true, bottleCount: 1, tasted: true });
    });
  });

  describe('partial success', () => {
    it('applies the valid rows and reports each rejected row with its reason, unchanged', async () => {
      const good = await seed({ owned: true, bottleCount: 2, tasted: false, name: 'Good' });
      const theirs = await seed({ owned: true, userId: 'someone-else', name: 'Theirs' });
      const overCount = await seed({ owned: true, bottleCount: 2, name: 'Over' });
      const offRack = await seed({ owned: false, name: 'Off' });
      const nothing = await seed({ owned: true, name: 'Nothing' });
      const failing = await seed({ owned: true, name: 'Failing' });
      cellarMock.__failWritesFor([failing.id]);

      const before = new Map(store.entries.map((e) => [e.id, { ...e }]));

      const { applied, rejected } = await record([
        { id: good.id, drank: 1 },
        { id: theirs.id, drank: 1 },
        { id: 'no-such-entry', gaveAway: 1 },
        { id: good.id, gaveAway: 1 },
        { id: overCount.id, drank: 2, gaveAway: 1 },
        { id: offRack.id, drank: 1 },
        { id: '   ', drank: 1 },
        { id: 42, drank: 1 },
        { id: nothing.id, drank: 0, gaveAway: 0 },
        { id: failing.id, gaveAway: 1 },
      ]);

      expect(applied.map((a) => a.id)).toEqual([good.id]);
      expect(rejected).toEqual([
        { id: theirs.id, reason: 'Not in your cellar.' },
        { id: 'no-such-entry', reason: 'Not in your cellar.' },
        { id: good.id, reason: 'Listed twice.' },
        { id: overCount.id, reason: 'Only 2 on hand.' },
        { id: offRack.id, reason: 'Not on hand anymore.' },
        { id: '   ', reason: 'Not a valid entry.' },
        { id: '42', reason: 'Not a valid entry.' },
        { id: nothing.id, reason: 'Nothing to record.' },
        { id: failing.id, reason: 'Could not be updated.' },
      ]);

      // The valid row applied once: the duplicate did not remove a second bottle.
      expect(stored(good.id)).toMatchObject({ owned: true, bottleCount: 1, tasted: true });
      for (const e of [theirs, overCount, offRack, nothing, failing]) {
        expect(stored(e.id)).toEqual(before.get(e.id));
      }
      expect(store.entries).toHaveLength(6);
      expect(regen).toHaveBeenCalledTimes(1);
    });

    it('triggers no regeneration when the only flip was rejected', async () => {
      const off = await seed({ owned: false, tasted: false });
      const { applied, rejected } = await record([{ id: off.id, drank: 1 }]);
      expect(applied).toEqual([]);
      expect(rejected).toEqual([{ id: off.id, reason: 'Not on hand anymore.' }]);
      expect(stored(off.id).tasted).toBe(false);
      expect(regen).not.toHaveBeenCalled();
    });
  });

  it('returns the on-hand state before each outcome, for Undo', async () => {
    const a = await seed({ owned: true, bottleCount: 3, tasted: false, name: 'A' });
    const b = await seed({ owned: true, tasted: null, name: 'B' });
    const c = await seed({ owned: true, bottleCount: 2, tasted: true, name: 'C' });

    const { applied } = await record([
      { id: a.id, drank: 1 },
      { id: b.id, gaveAway: 1 },
      { id: c.id, drank: 1, gaveAway: 1 },
    ]);

    expect(applied.map((x) => x.previous)).toEqual([
      { owned: true, bottleCount: 3, tasted: false },
      { owned: true, bottleCount: 1, tasted: true },
      { owned: true, bottleCount: 2, tasted: true },
    ]);
  });

  it('logs an unknown surface without failing', async () => {
    const e = await seed({ owned: true });
    await record([{ id: e.id, gaveAway: 1 }], 'somewhere');
    expect(events).toHaveBeenCalledWith(
      'bottle_outcomes',
      expect.objectContaining({ surface: 'unknown', applied: 1 }),
    );
  });

  describe('request-level errors write nothing', () => {
    const expectUntouched = (before: Array<Hydrated<CellarEntry>>) => {
      expect(store.entries).toEqual(before);
      expect(regen).not.toHaveBeenCalled();
    };

    it('a signed-out caller', async () => {
      const e = await seed({ owned: true, tasted: false });
      const before = store.entries.map((x) => ({ ...x }));
      await expect(recordAs(undefined, [{ id: e.id, drank: 1 }])).rejects.toThrow(
        'Sign in to edit your cellar.',
      );
      expectUntouched(before);
    });

    it('an empty or missing batch', async () => {
      await seed({ owned: true });
      const before = store.entries.map((x) => ({ ...x }));
      for (const items of [[], undefined, null, 'items']) {
        await expect(record(items)).rejects.toThrow('Nothing to update.');
      }
      expectUntouched(before);
    });

    it('a batch over the limit', async () => {
      const e = await seed({ owned: true, tasted: false });
      const before = store.entries.map((x) => ({ ...x }));
      const items = Array.from({ length: MAX_OUTCOME_ITEMS + 1 }, () => ({ id: e.id, drank: 1 }));
      await expect(record(items)).rejects.toThrow('That is more than 200 at once.');
      expectUntouched(before);
    });
  });
});
