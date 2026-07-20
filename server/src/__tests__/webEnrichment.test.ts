/**
 * Unit tests for the scan web-enrichment building blocks:
 * - parseWebSearchResults: defensive parsing of varied provider shapes
 * - buildSearchQuery: identity-to-query composition
 *
 * These are the pure, high-risk units. The gate/fallback behavior in
 * runEnrichment composes these with config + network and is exercised at the
 * integration level; here we lock down the parsing and query logic that bugs
 * tend to hide in. No network or provider calls are made.
 */
import { describe, it, expect } from 'vitest';
import { parseWebSearchResults } from '../ai/webSearch';
import { buildSearchQuery } from '../methods/common/reverseScanInternal';
import type { ScanResult } from '../methods/common/reverseScanInternal';

describe('parseWebSearchResults', () => {
  it('parses the You.com "results" + "snippets[]" shape', () => {
    const body = {
      results: [
        {
          title: 'Domaine Tempier Bandol',
          url: 'https://example.com/a',
          snippets: ['A savory Mourvedre-driven red.', 'Ages beautifully.'],
        },
      ],
    };
    const out = parseWebSearchResults(body, 5);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      title: 'Domaine Tempier Bandol',
      url: 'https://example.com/a',
      snippet: 'A savory Mourvedre-driven red. Ages beautifully.',
    });
  });

  it('parses the alternate "hits" container with a single "snippet" string', () => {
    const body = {
      hits: [{ title: 'T', url: 'https://x', snippet: 'one passage' }],
    };
    const out = parseWebSearchResults(body, 5);
    expect(out).toEqual([{ title: 'T', url: 'https://x', snippet: 'one passage' }]);
  });

  it('falls back to "description" when no snippet fields exist', () => {
    const body = { results: [{ title: 'T', url: 'https://x', description: 'desc text' }] };
    const out = parseWebSearchResults(body, 5);
    expect(out[0]!.snippet).toBe('desc text');
  });

  it('caps at maxResults', () => {
    const body = {
      results: Array.from({ length: 10 }, (_, i) => ({
        title: `t${i}`,
        url: `https://x/${i}`,
        snippet: 's',
      })),
    };
    expect(parseWebSearchResults(body, 3)).toHaveLength(3);
  });

  it('skips entries with neither title nor snippet', () => {
    const body = { results: [{ url: 'https://x' }, { title: 'keep', snippet: 's' }] };
    const out = parseWebSearchResults(body, 5);
    expect(out).toHaveLength(1);
    expect(out[0]!.title).toBe('keep');
  });

  it('returns [] for malformed or empty bodies', () => {
    expect(parseWebSearchResults(null, 5)).toEqual([]);
    expect(parseWebSearchResults('not json', 5)).toEqual([]);
    expect(parseWebSearchResults({}, 5)).toEqual([]);
    expect(parseWebSearchResults({ results: 'nope' }, 5)).toEqual([]);
  });
});

describe('buildSearchQuery', () => {
  const base = (over: Partial<ScanResult> = {}): ScanResult => ({
    name: 'Bandol Rouge',
    kind: 'wine',
    producer: 'Domaine Tempier',
    region: 'Bandol',
    vintage: 2020,
    abv: 13.5,
    expect: '',
    monocleAside: null,
    pairings: [],
    valueNote: '',
    occasion: '',
    confidence: 'high',
    ...over,
  });

  it('composes producer, name, and vintage with a wine suffix', () => {
    const q = buildSearchQuery(base());
    expect(q).toBe('Domaine Tempier Bandol Rouge 2020 wine tasting notes review price');
  });

  it('omits null identity parts without leaving gaps', () => {
    const q = buildSearchQuery(base({ producer: null, vintage: null }));
    expect(q).toBe('Bandol Rouge wine tasting notes review price');
  });

  it('uses a kind-specific suffix for beer and spirits', () => {
    expect(buildSearchQuery(base({ kind: 'beer' }))).toContain('beer review tasting notes');
    expect(buildSearchQuery(base({ kind: 'spirits' }))).toContain('spirit review tasting notes');
  });
});
