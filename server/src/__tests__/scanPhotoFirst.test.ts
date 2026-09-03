/**
 * Unit tests for the photo-first entry-image decision.
 *
 * The rule: a user photo always becomes the entry image (no generation, no
 * allowance). Only a no-photo scan can generate, and only with allowance and
 * a non-low confidence. This is the whole behavioral contract of the change.
 */
import { describe, it, expect } from 'vitest';
import { decideEntryImage } from '../methods/common/reverseScanInternal';

describe('decideEntryImage', () => {
  it('uses the photo whenever one was supplied, regardless of allowance', () => {
    expect(decideEntryImage({ hasPhoto: true, allowed: 0, confidence: 'high' })).toBe('use_photo');
    expect(decideEntryImage({ hasPhoto: true, allowed: 5, confidence: 'medium' })).toBe('use_photo');
  });

  it('uses the photo even at low confidence (using your own photo does not depend on certainty)', () => {
    expect(decideEntryImage({ hasPhoto: true, allowed: 5, confidence: 'low' })).toBe('use_photo');
  });

  it('generates for a no-photo scan with allowance and non-low confidence', () => {
    expect(decideEntryImage({ hasPhoto: false, allowed: 3, confidence: 'high' })).toBe('generate');
    expect(decideEntryImage({ hasPhoto: false, allowed: 1, confidence: 'medium' })).toBe('generate');
  });

  it('generates nothing for a no-photo scan when the allowance is exhausted', () => {
    expect(decideEntryImage({ hasPhoto: false, allowed: 0, confidence: 'high' })).toBe('none');
  });

  it('generates nothing for a no-photo low-confidence scan', () => {
    expect(decideEntryImage({ hasPhoto: false, allowed: 5, confidence: 'low' })).toBe('none');
  });
});
