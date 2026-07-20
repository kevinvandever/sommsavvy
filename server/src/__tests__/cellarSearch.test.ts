/**
 * Unit tests for the cellar-search building blocks:
 * - resolveMatches: grounding guard (drop hallucinated ids), dedupe, ordering
 * - keywordFallback: substring match parity with listCellar
 *
 * These are the high-risk pure units. The auth/load/interpret orchestration in
 * searchCellar composes these with the db and the AI provider and is exercised
 * at the integration level; here we lock down the logic that guarantees results
 * are always the user's own bottles and never fabricated.
 */
import { describe, it, expect } from 'vitest';
import { resolveMatches, keywordFallback } from '../methods/searchCellar';
import type { CellarEntry } from '../methods/tables/cellarEntries';
import type { Hydrated } from '../db/adapter';

type Entry = Hydrated<CellarEntry>;

function entry(id: string, over: Partial<CellarEntry> = {}): Entry {
  return {
    id,
    created_at: 0,
    updated_at: 0,
    userId: 'u1',
    kind: 'wine',
    name: `Wine ${id}`,
    source: 'scan',
    savedAt: 0,
    ...over,
  } as Entry;
}

describe('resolveMatches', () => {
  const candidates = [entry('a'), entry('b'), entry('c')];

  it('resolves ids to entries and preserves the model ordering', () => {
    const out = resolveMatches(
      [
        { id: 'c', reason: 'third but ranked first' },
        { id: 'a', reason: 'ranked second' },
      ],
      candidates,
    );
    expect(out.map((m) => m.entry.id)).toEqual(['c', 'a']);
    expect(out[0]!.reason).toBe('third but ranked first');
  });

  it('drops ids not present in the candidate set (hallucination guard)', () => {
    const out = resolveMatches(
      [{ id: 'a' }, { id: 'zzz-not-real' }, { id: 'b' }],
      candidates,
    );
    expect(out.map((m) => m.entry.id)).toEqual(['a', 'b']);
  });

  it('de-duplicates repeated ids', () => {
    const out = resolveMatches([{ id: 'a' }, { id: 'a' }], candidates);
    expect(out).toHaveLength(1);
  });

  it('tolerates missing or non-string reasons and ids', () => {
    const out = resolveMatches(
      [{ id: 'a' }, { id: 42 as unknown as string }, { reason: 'no id' }],
      candidates,
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.entry.id).toBe('a');
    expect(out[0]!.reason).toBe('');
  });

  it('returns an empty list when nothing was selected', () => {
    expect(resolveMatches([], candidates)).toEqual([]);
  });
});

describe('keywordFallback', () => {
  const candidates = [
    entry('a', { name: 'Bandol Rouge', producer: 'Domaine Tempier', region: 'Provence' }),
    entry('b', { name: 'Chablis', producer: 'Raveneau', notes: 'crisp, mineral, oysters' }),
    entry('c', { name: 'Barolo', producer: 'Vietti', region: 'Piedmont' }),
  ];

  it('matches across name, producer, region, and notes', () => {
    expect(keywordFallback('tempier', candidates).map((m) => m.entry.id)).toEqual(['a']);
    expect(keywordFallback('piedmont', candidates).map((m) => m.entry.id)).toEqual(['c']);
    expect(keywordFallback('oysters', candidates).map((m) => m.entry.id)).toEqual(['b']);
  });

  it('is case-insensitive and returns empty reasons', () => {
    const out = keywordFallback('BAROLO', candidates);
    expect(out).toHaveLength(1);
    expect(out[0]!.reason).toBe('');
  });

  it('returns nothing when no substring matches', () => {
    expect(keywordFallback('salmon dinner', candidates)).toEqual([]);
  });
});
