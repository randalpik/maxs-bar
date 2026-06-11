import { describe, it, expect } from 'vitest';
import { isValidPayload } from './payload';

/* The server treats the payload as opaque; this guards the top-level shape check,
   in particular that `profiles` stays OPTIONAL — pre-profiles clients must keep
   validating — while a malformed one is still rejected. */

const base = { seedId: 'classics', seedTs: 0, recipeOverrides: {}, ingredients: {}, stockTs: {} };

describe('isValidPayload', () => {
  it('accepts a payload without profiles (pre-profiles client)', () => {
    expect(isValidPayload(base)).toBe(true);
  });

  it('accepts a payload with a profiles map', () => {
    expect(isValidPayload({ ...base, profiles: { home: { id: 'home' } } })).toBe(true);
  });

  it('rejects a non-object profiles field', () => {
    expect(isValidPayload({ ...base, profiles: [] })).toBe(false);
    expect(isValidPayload({ ...base, profiles: 'junk' })).toBe(false);
  });

  it('still rejects junk at the top level', () => {
    expect(isValidPayload(null)).toBe(false);
    expect(isValidPayload({ ...base, stockTs: 'nope' })).toBe(false);
  });
});
