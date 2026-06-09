import { describe, it, expect } from 'vitest';
import { defaultLocationForCat, LOCATION_ORDER } from './locations';

describe('defaultLocationForCat', () => {
  it('maps each category bucket to its location', () => {
    expect(defaultLocationForCat('spirit')).toBe('bottom-shelf');
    expect(defaultLocationForCat('liqueur')).toBe('bottom-shelf');
    expect(defaultLocationForCat('bitters')).toBe('bottom-shelf');
    expect(defaultLocationForCat('fortified')).toBe('wine-rack');
    expect(defaultLocationForCat('citrus')).toBe('fridge');
    expect(defaultLocationForCat('fruit')).toBe('fridge');
    expect(defaultLocationForCat('dairy')).toBe('fridge');
    expect(defaultLocationForCat('egg')).toBe('fridge');
    expect(defaultLocationForCat('herb')).toBe('pantry');
    expect(defaultLocationForCat('spice')).toBe('pantry');
    expect(defaultLocationForCat('sugar')).toBe('pantry');
  });

  it('routes extracts to the bottom shelf via the display name (not a raw cat)', () => {
    expect(defaultLocationForCat('liqueur', 'Vanilla extract')).toBe('bottom-shelf');
    expect(defaultLocationForCat('other', 'Almond Extract')).toBe('bottom-shelf');
  });

  it('falls through to "other" for unknown categories', () => {
    expect(defaultLocationForCat('soda')).toBe('other');
    expect(defaultLocationForCat('mixer')).toBe('other');
    expect(defaultLocationForCat('whatever')).toBe('other');
  });

  it('only ever returns a real location id', () => {
    for (const c of ['spirit', 'fortified', 'citrus', 'herb', 'soda', 'other'])
      expect(LOCATION_ORDER).toContain(defaultLocationForCat(c));
  });
});
