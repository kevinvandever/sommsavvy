/**
 * Unit tests for buildEditorialPatch, the guard that decides what enrichment
 * is allowed to write to an existing cellar entry.
 *
 * The load-bearing property: enrichment adds editorial context and NEVER
 * rewrites the identity the user confirmed at import. That also keeps it clear
 * of the taste-regen trigger, which watches identity/notes fields.
 */
import { describe, it, expect } from 'vitest';
import { buildEditorialPatch } from '../methods/enrichCellarEntry';

describe('buildEditorialPatch', () => {
  it('maps the editorial fields onto the patch', () => {
    const patch = buildEditorialPatch({
      expect: 'Savory and firm.',
      monocleAside: 'One does prefer the north slope.',
      pairings: ['Lamb', 'Mushroom risotto'],
      valueNote: 'Fair for the depth.',
      occasion: 'A slow Sunday.',
    });
    expect(patch).toEqual({
      whyText: 'Savory and firm.',
      monocleAside: 'One does prefer the north slope.',
      pairings: ['Lamb', 'Mushroom risotto'],
      valueNote: 'Fair for the depth.',
      occasion: 'A slow Sunday.',
    });
  });

  it('never includes identity fields even if the model returns them', () => {
    const patch = buildEditorialPatch({
      expect: 'Savory.',
      // Identity-shaped keys the model might hallucinate into the response.
      ...({
        name: 'Something Else',
        producer: 'Wrong Producer',
        region: 'Nowhere',
        vintage: 1999,
        kind: 'beer',
        tasted: true,
        owned: false,
      } as unknown as Record<string, never>),
    });
    expect(Object.keys(patch)).toEqual(['whyText']);
    expect(patch).not.toHaveProperty('name');
    expect(patch).not.toHaveProperty('producer');
    expect(patch).not.toHaveProperty('region');
    expect(patch).not.toHaveProperty('vintage');
    expect(patch).not.toHaveProperty('kind');
    expect(patch).not.toHaveProperty('tasted');
    expect(patch).not.toHaveProperty('owned');
  });

  it('omits absent, blank, and literal-null fields rather than writing empties', () => {
    const patch = buildEditorialPatch({
      expect: 'Savory.',
      monocleAside: 'null',
      valueNote: '   ',
      occasion: undefined,
    });
    expect(patch).toEqual({ whyText: 'Savory.' });
  });

  it('cleans the pairings list and caps it at five', () => {
    const patch = buildEditorialPatch({
      pairings: ['Lamb', '', '  Duck  ', 42 as unknown as string, 'A', 'B', 'C', 'D'],
    });
    expect(patch.pairings).toEqual(['Lamb', 'Duck', 'A', 'B', 'C']);
  });

  it('omits pairings entirely when nothing usable is returned', () => {
    expect(buildEditorialPatch({ pairings: [] })).toEqual({});
    expect(buildEditorialPatch({ pairings: 'nope' as unknown as string[] })).toEqual({});
  });

  it('returns an empty patch when the model returned nothing usable', () => {
    expect(buildEditorialPatch({})).toEqual({});
  });
});
