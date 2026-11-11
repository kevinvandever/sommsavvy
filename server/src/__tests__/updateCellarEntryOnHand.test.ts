/**
 * updateCellarEntry and the owned axis.
 *
 * `owned` and `bottleCount` are written only through resolveOnHandPatch, so
 * they always agree, and neither is a taste-profile field. The checks here:
 * - Changes to only owned, only the count, or both never regenerate the taste
 *   profile and never change tasted (a Done-when check for rack check).
 * - The clearing and defaulting rules for the count.
 * - Every rejection leaves the entry unchanged.
 * - The Undo patch restores the earlier state, regenerating only when it
 *   restores tasted.
 * - A notes patch still regenerates, as before.
 *
 * The database and the regeneration helper are stubbed, as in
 * anonSaveContract.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runWithContext } from '../runtime/context';
import { createStore, stubCellarEntries, type InMemoryStore } from './stubs';
import type { CellarEntry } from '../methods/tables/cellarEntries';
import type { Hydrated } from '../db/adapter';

vi.mock('../methods/tables/cellarEntries', () => {
  let _store: InMemoryStore = { entries: [], regenCalls: [], imageCounter: 0 };
  return {
    CellarEntries: {
      get push() { return stubCellarEntries(_store).push; },
      get get() { return stubCellarEntries(_store).get; },
      get update() { return stubCellarEntries(_store).update; },
      get remove() { return stubCellarEntries(_store).remove; },
      get filter() { return stubCellarEntries(_store).filter; },
      get count() { return stubCellarEntries(_store).count; },
    },
    __setStore(s: InMemoryStore) { _store = s; },
  };
});

vi.mock('../methods/common/regenerateTasteSummaryInternal', () => ({
  runTasteSummaryRegen: vi.fn(async () => {}),
}));

const { updateCellarEntry } = await import('../methods/updateCellarEntry');
const { runTasteSummaryRegen } = await import('../methods/common/regenerateTasteSummaryInternal');
const cellarMock = (await import('../methods/tables/cellarEntries')) as unknown as {
  __setStore: (s: InMemoryStore) => void;
};

const regen = vi.mocked(runTasteSummaryRegen);
const USER = 'user-1';

describe('updateCellarEntry on the owned axis', () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = createStore();
    cellarMock.__setStore(store);
    regen.mockClear();
  });

  const seed = (fields: Partial<CellarEntry>): Promise<Hydrated<CellarEntry>> =>
    stubCellarEntries(store).push({ userId: USER, name: 'Bandol Rouge', ...fields });

  const updateAs = (userId: string | undefined, id: string, patch: unknown) =>
    runWithContext({ userId }, () =>
      updateCellarEntry({ id, patch: patch as Partial<CellarEntry> }),
    );
  const update = (id: string, patch: unknown) => updateAs(USER, id, patch);

  const stored = (id: string) => store.entries.find((e) => e.id === id)!;

  describe('never regenerates the taste profile (Done-when)', () => {
    it('for an owned-only change, in either direction', async () => {
      const e = await seed({ owned: false, tasted: false });
      await update(e.id, { owned: true });
      expect(stored(e.id).owned).toBe(true);
      await update(e.id, { owned: false });
      expect(stored(e.id).owned).toBe(false);
      expect(regen).not.toHaveBeenCalled();
      expect(stored(e.id).tasted).toBe(false);
    });

    it('for a count-only change', async () => {
      const e = await seed({ owned: true, tasted: true });
      await update(e.id, { bottleCount: 4 });
      expect(stored(e.id).bottleCount).toBe(4);
      expect(regen).not.toHaveBeenCalled();
      expect(stored(e.id).tasted).toBe(true);
    });

    it('for owned and count together', async () => {
      const e = await seed({ owned: false, tasted: false });
      await update(e.id, { owned: true, bottleCount: 2 });
      expect(stored(e.id)).toMatchObject({ owned: true, bottleCount: 2, tasted: false });
      expect(regen).not.toHaveBeenCalled();
    });
  });

  describe('count rules', () => {
    it('owned false clears the count', async () => {
      const e = await seed({ owned: true, bottleCount: 3 });
      const { entry } = await update(e.id, { owned: false });
      expect(entry.owned).toBe(false);
      expect(entry.bottleCount).toBeUndefined();
      expect(stored(e.id).bottleCount).toBeUndefined();
    });

    it('owned true on an entry off the rack records one bottle', async () => {
      const e = await seed({ owned: false });
      const { entry } = await update(e.id, { owned: true });
      expect(entry).toMatchObject({ owned: true, bottleCount: 1 });
    });

    it('owned true on an entry already on hand keeps its count', async () => {
      const e = await seed({ owned: true, bottleCount: 3 });
      const { entry } = await update(e.id, { owned: true });
      expect(entry).toMatchObject({ owned: true, bottleCount: 3 });
    });

    it('a count on a legacy on-hand entry with no stored count sets it', async () => {
      const e = await seed({ owned: true, source: 'import', tasted: false });
      const { entry } = await update(e.id, { bottleCount: 2 });
      expect(entry).toMatchObject({ owned: true, bottleCount: 2, tasted: false });
    });

    it('a null count on its own changes nothing on hand', async () => {
      const e = await seed({ owned: true, bottleCount: 3 });
      const { entry } = await update(e.id, { bottleCount: null });
      expect(entry).toMatchObject({ owned: true, bottleCount: 3 });
      expect(regen).not.toHaveBeenCalled();
    });
  });

  describe('rejections leave the entry unchanged', () => {
    const rejects = async (
      fields: Partial<CellarEntry>,
      patch: unknown,
      message: string,
    ) => {
      const e = await seed(fields);
      const before = { ...stored(e.id) };
      await expect(update(e.id, patch)).rejects.toThrow(message);
      expect(stored(e.id)).toEqual(before);
      expect(regen).not.toHaveBeenCalled();
    };

    it('an invalid count', async () => {
      for (const bottleCount of [0, 100, 2.5, '3']) {
        await rejects({ owned: true, bottleCount: 2 }, { bottleCount }, 'A bottle count runs from 1 to 99.');
      }
    });

    it('a count on an entry that is not on hand', async () => {
      await rejects({ owned: false }, { bottleCount: 2 }, 'A bottle count needs the bottle on hand.');
    });

    it('a count together with owned false', async () => {
      await rejects(
        { owned: true, bottleCount: 3 },
        { owned: false, bottleCount: 2 },
        'A bottle count needs the bottle on hand.',
      );
    });

    it('a non-boolean owned', async () => {
      await rejects({ owned: false }, { owned: 'yes' }, 'On hand needs to be yes or no.');
    });

    it('a rejected on-hand change also blocks the rest of the patch', async () => {
      await rejects(
        { owned: true, bottleCount: 2, notes: 'Bright.' },
        { notes: 'Changed.', bottleCount: 0 },
        'A bottle count runs from 1 to 99.',
      );
    });

    it('a missing or malformed patch', async () => {
      for (const patch of [undefined, null, 'owned', [{ owned: true }]]) {
        await rejects({ owned: true, bottleCount: 2 }, patch, 'Nothing to update.');
      }
    });

    it("a count change on someone else's entry", async () => {
      const e = await seed({ owned: true, bottleCount: 2 });
      const before = { ...stored(e.id) };
      await expect(updateAs('someone-else', e.id, { bottleCount: 5 })).rejects.toThrow(
        'Entry not found.',
      );
      expect(stored(e.id)).toEqual(before);
    });

    it('a signed-out caller', async () => {
      const e = await seed({ owned: true, bottleCount: 2 });
      const before = { ...stored(e.id) };
      await expect(updateAs(undefined, e.id, { bottleCount: 5 })).rejects.toThrow(
        'Sign in to edit your cellar.',
      );
      expect(stored(e.id)).toEqual(before);
    });
  });

  describe('Undo', () => {
    it('restoring tasted after a "Drank it" restores the state and regenerates', async () => {
      // The entry as "Drank it" left it: one bottle fewer, now tasted.
      const e = await seed({ owned: true, bottleCount: 2, tasted: true });
      const { entry } = await update(e.id, { owned: true, bottleCount: 3, tasted: false });
      expect(entry).toMatchObject({ owned: true, bottleCount: 3, tasted: false });
      expect(regen).toHaveBeenCalledTimes(1);
      expect(regen).toHaveBeenCalledWith(USER);
    });

    it('restoring only on hand and the count does not regenerate', async () => {
      // The entry as "Gave it away" on the last bottle left it.
      const e = await seed({ owned: false, tasted: true });
      const { entry } = await update(e.id, { owned: true, bottleCount: 1 });
      expect(entry).toMatchObject({ owned: true, bottleCount: 1, tasted: true });
      expect(regen).not.toHaveBeenCalled();
    });

    it('undoing a switch-on takes the entry back off the rack without regenerating', async () => {
      const e = await seed({ owned: true, bottleCount: 1 });
      const { entry } = await update(e.id, { owned: false });
      expect(entry.owned).toBe(false);
      expect(entry.bottleCount).toBeUndefined();
      expect(regen).not.toHaveBeenCalled();
    });
  });

  it('a notes patch still regenerates the taste profile', async () => {
    const e = await seed({ owned: true, bottleCount: 2 });
    const { entry } = await update(e.id, { notes: 'Bright and a bit wild.' });
    expect(entry).toMatchObject({ notes: 'Bright and a bit wild.', owned: true, bottleCount: 2 });
    expect(regen).toHaveBeenCalledTimes(1);
  });
});
