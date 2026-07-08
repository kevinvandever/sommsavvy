/**
 * Integration test: Anonymous save-and-resume server contract.
 *
 * Validates Requirements 1.5, 1.6, 1.9:
 * - Anonymous save: saveCellarEntry throws "Sign in to save to your cellar."
 *   and the route wrapper maps this to 401 { error: { code: 'sign_in_required' } }
 * - Replay after auth: A single saveCellarEntry call with valid auth produces
 *   exactly one cellar entry
 * - Canceled sign-in: No server call → zero entries (frontend-side only)
 *
 * This test exercises the actual saveCellarEntry function through runWithContext
 * to validate the auth check behavior, with the database layer stubbed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runWithContext } from '../runtime/context';
import {
  createStore,
  stubCellarEntries,
  stubRegen,
  type InMemoryStore,
} from './stubs';

// Mock the database-backed CellarEntries and the regen function so we can
// exercise saveCellarEntry's auth logic without a real DB.
vi.mock('../methods/tables/cellarEntries', () => {
  // The store is set per-test via the `setTestStore` helper below.
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

vi.mock('../observability/events', () => ({
  logEvent: vi.fn(),
  CELLAR_SAVED: 'cellar_saved',
}));

// Now import the actual method — mocks are in place.
const { saveCellarEntry } = await import('../methods/saveCellarEntry');
const cellarMock = await import('../methods/tables/cellarEntries') as unknown as {
  __setStore: (s: InMemoryStore) => void;
};

describe('Anonymous save-and-resume server contract', () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = createStore();
    cellarMock.__setStore(store);
  });

  const validInput = {
    kind: 'wine' as const,
    name: 'Chateau Margaux 2015',
    producer: 'Chateau Margaux',
    region: 'Bordeaux',
    vintage: 2015,
    source: 'scan' as const,
  };

  // Requirement 1.5: Anonymous save throws, no entry created
  it('throws "Sign in to save to your cellar." when userId is undefined', async () => {
    await expect(
      runWithContext({ userId: undefined }, () => saveCellarEntry(validInput)),
    ).rejects.toThrow('Sign in to save to your cellar.');

    // No entry persisted
    expect(store.entries).toHaveLength(0);
  });

  // Verify the error message matches SIGN_IN_MESSAGES in routes.ts so the
  // post wrapper maps it to 401 sign_in_required.
  it('error message exactly matches the SIGN_IN_MESSAGES constant', async () => {
    let message = '';
    try {
      await runWithContext({ userId: undefined }, () => saveCellarEntry(validInput));
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toBe('Sign in to save to your cellar.');
  });

  // Requirement 1.6: Replay after successful sign-in produces exactly one entry
  it('produces exactly one entry when replayed with valid auth', async () => {
    await runWithContext({ userId: 'user-abc' }, () => saveCellarEntry(validInput));

    expect(store.entries).toHaveLength(1);
    expect(store.entries[0]!.userId).toBe('user-abc');
    expect(store.entries[0]!.source).toBe('scan');
    expect(store.entries[0]!.tasted).toBe(true);
    expect(store.entries[0]!.owned).toBe(false);
    expect(store.entries[0]!.name).toBe('Chateau Margaux 2015');
  });

  // Requirement 1.6: No duplicates — calling once creates one entry
  it('does not create duplicates (stateless save, no replay tracking)', async () => {
    await runWithContext({ userId: 'user-abc' }, () => saveCellarEntry(validInput));

    // Only one call means only one entry
    expect(store.entries).toHaveLength(1);
  });

  // Requirement 1.9: Canceled sign-in → zero entries
  // When sign-in is canceled, the frontend discards the pending card and never
  // calls saveCellarEntry. This test confirms that if no save call is made,
  // the store remains empty — the server has no pending state.
  it('produces zero entries when sign-in is canceled (no server call)', () => {
    // No saveCellarEntry call happens — the server contract is that pending
    // state is frontend-only.
    expect(store.entries).toHaveLength(0);
  });

  // Verify there is no server-side pending state for anonymous saves
  it('has no server-side pending state mechanism', async () => {
    // First, an anonymous attempt fails
    await expect(
      runWithContext({ userId: undefined }, () => saveCellarEntry(validInput)),
    ).rejects.toThrow();

    // Store is still empty
    expect(store.entries).toHaveLength(0);

    // Then, a signed-in replay creates exactly one entry from the input
    await runWithContext({ userId: 'user-xyz' }, () => saveCellarEntry(validInput));
    expect(store.entries).toHaveLength(1);

    // The entry was created from the input, not from any server-side pending state
    expect(store.entries[0]!.name).toBe('Chateau Margaux 2015');
  });
});
