import { describe, it, expect } from 'vitest';
import { monogramFor } from './monogram';

describe('monogramFor', () => {
  it('skips a leading vintage year (the case that showed a bare "2")', () => {
    expect(monogramFor({ name: '2022 Toscana Rosso' })).toBe('T');
  });

  it('uses the first letter of a normal name', () => {
    expect(monogramFor({ name: 'Bandol Rouge' })).toBe('B');
  });

  it('skips leading punctuation and whitespace', () => {
    expect(monogramFor({ name: '  "Reserva" Tinto' })).toBe('R');
  });

  it('handles accented and non-Latin first letters', () => {
    expect(monogramFor({ name: 'Étoile Blanc' })).toBe('É');
    expect(monogramFor({ name: '2019 Éclat' })).toBe('É');
  });

  it('falls back to the producer when the name has no letters', () => {
    expect(monogramFor({ name: '2022', producer: 'Cuna' })).toBe('C');
    expect(monogramFor({ name: '1996 —', producer: 'Vietti' })).toBe('V');
  });

  it('returns null when no letter exists anywhere, so the caller can show a glyph', () => {
    expect(monogramFor({ name: '2022' })).toBeNull();
    expect(monogramFor({ name: '2022', producer: '2019' })).toBeNull();
    expect(monogramFor({ name: '' })).toBeNull();
  });
});
