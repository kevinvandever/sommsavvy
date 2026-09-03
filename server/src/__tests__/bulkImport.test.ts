/**
 * Unit tests for the bulk-import building blocks:
 * - normalizeItem: coercion of untrusted model output to the app's field rules
 * - validate:      the same field rules saveCellarEntry applies, per row
 *
 * These are the pure, high-risk units. The auth/vision/db orchestration is
 * integration-level; here we lock down the normalization and validation that
 * keep bad rows out of the cellar. No network or provider calls.
 */
import { describe, it, expect } from 'vitest';
import { normalizeItem } from '../methods/parseCellarDocument';
import { validate, type BulkEntryInput } from '../methods/saveCellarEntriesBulk';

const NEXT_YEAR = new Date().getFullYear() + 1;

describe('normalizeItem', () => {
  it('passes through a clean, complete row', () => {
    const out = normalizeItem({
      name: 'Bandol Rouge',
      kind: 'wine',
      producer: 'Domaine Tempier',
      region: 'Bandol',
      vintage: 2020,
      abv: 13.5,
      confidence: 'high',
    });
    expect(out).toEqual({
      name: 'Bandol Rouge',
      kind: 'wine',
      producer: 'Domaine Tempier',
      region: 'Bandol',
      vintage: 2020,
      abv: 13.5,
      confidence: 'high',
    });
  });

  it('drops rows without a usable name', () => {
    expect(normalizeItem({ kind: 'wine' })).toBeNull();
    expect(normalizeItem({ name: '   ', kind: 'wine' })).toBeNull();
    expect(normalizeItem(null)).toBeNull();
    expect(normalizeItem('nope')).toBeNull();
  });

  it('falls back to wine and lowers confidence when kind is unknown', () => {
    const out = normalizeItem({ name: 'Mystery', kind: 'cider', confidence: 'high' });
    expect(out!.kind).toBe('wine');
    expect(out!.confidence).toBe('low');
  });

  it('lowers confidence when kind is missing entirely', () => {
    const out = normalizeItem({ name: 'Mystery', confidence: 'high' });
    expect(out!.kind).toBe('wine');
    expect(out!.confidence).toBe('low');
  });

  it('nulls out-of-range and unparseable vintages', () => {
    expect(normalizeItem({ name: 'A', kind: 'wine', vintage: 1850 })!.vintage).toBeNull();
    expect(normalizeItem({ name: 'A', kind: 'wine', vintage: NEXT_YEAR + 5 })!.vintage).toBeNull();
    expect(normalizeItem({ name: 'A', kind: 'wine', vintage: 'nope' })!.vintage).toBeNull();
    expect(normalizeItem({ name: 'A', kind: 'wine' })!.vintage).toBeNull();
  });

  it('accepts a numeric-string vintage in range', () => {
    expect(normalizeItem({ name: 'A', kind: 'wine', vintage: '2019' })!.vintage).toBe(2019);
  });

  it('treats the literal string "null" and blanks as absent', () => {
    const out = normalizeItem({ name: 'A', kind: 'wine', producer: 'null', region: '  ' });
    expect(out!.producer).toBeNull();
    expect(out!.region).toBeNull();
  });

  it('nulls an out-of-range abv', () => {
    expect(normalizeItem({ name: 'A', kind: 'wine', abv: 250 })!.abv).toBeNull();
    expect(normalizeItem({ name: 'A', kind: 'wine', abv: 12 })!.abv).toBe(12);
  });

  it('caps long strings at 200 characters', () => {
    const long = 'x'.repeat(400);
    const out = normalizeItem({ name: long, kind: 'wine', producer: long });
    expect(out!.name).toHaveLength(200);
    expect(out!.producer).toHaveLength(200);
  });

  it('defaults confidence to medium when absent or unrecognized', () => {
    expect(normalizeItem({ name: 'A', kind: 'wine' })!.confidence).toBe('medium');
    expect(normalizeItem({ name: 'A', kind: 'wine', confidence: 'certain' })!.confidence).toBe('medium');
  });
});

describe('validate', () => {
  const ok: BulkEntryInput = { name: 'Bandol', kind: 'wine' };

  it('accepts a minimal valid row', () => {
    expect(validate(ok)).toBeNull();
  });

  it('requires a name', () => {
    expect(validate({ ...ok, name: '' })).toMatch(/name/i);
    expect(validate({ ...ok, name: '   ' })).toMatch(/name/i);
  });

  it('requires a valid kind', () => {
    expect(validate({ ...ok, kind: 'cider' as unknown as 'wine' })).toMatch(/wine, beer, or spirits/i);
  });

  it('bounds the vintage but allows it to be absent', () => {
    expect(validate({ ...ok, vintage: 2020 })).toBeNull();
    expect(validate({ ...ok, vintage: undefined })).toBeNull();
    expect(validate({ ...ok, vintage: 1899 })).toMatch(/vintage/i);
    expect(validate({ ...ok, vintage: NEXT_YEAR + 1 })).toMatch(/vintage/i);
    expect(validate({ ...ok, vintage: NaN })).toMatch(/vintage/i);
  });

  it('bounds abv but allows it to be absent', () => {
    expect(validate({ ...ok, abv: 13 })).toBeNull();
    expect(validate({ ...ok, abv: undefined })).toBeNull();
    expect(validate({ ...ok, abv: -1 })).toMatch(/abv/i);
    expect(validate({ ...ok, abv: 101 })).toMatch(/abv/i);
  });

  it('rejects a non-object row', () => {
    expect(validate(null as unknown as BulkEntryInput)).toBeTruthy();
  });
});
