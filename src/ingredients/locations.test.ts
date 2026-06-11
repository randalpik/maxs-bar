import { describe, it, expect } from 'vitest';
import { defaultLocationForCat, LOCATION_ORDER } from './locations';

describe('defaultLocationForCat', () => {
  it('maps each category to its location (from the category table)', () => {
    expect(defaultLocationForCat('spirit')).toBe('bottom-shelf');
    expect(defaultLocationForCat('liqueur')).toBe('bottom-shelf');
    expect(defaultLocationForCat('bitters')).toBe('bottom-shelf');
    expect(defaultLocationForCat('extract')).toBe('bottom-shelf');
    expect(defaultLocationForCat('fortified')).toBe('wine-rack');
    expect(defaultLocationForCat('citrus')).toBe('fridge');
    expect(defaultLocationForCat('fruit')).toBe('fridge');
    expect(defaultLocationForCat('mixer')).toBe('fridge');
    expect(defaultLocationForCat('syrup')).toBe('fridge');
    expect(defaultLocationForCat('dairyegg')).toBe('fridge');
    expect(defaultLocationForCat('herbspice')).toBe('pantry');
    expect(defaultLocationForCat('sugar')).toBe('pantry');
  });

  it('maps the food categories (incl. the freezer-defaulted proteins)', () => {
    expect(defaultLocationForCat('produce')).toBe('fridge');
    expect(defaultLocationForCat('condiment')).toBe('fridge');
    expect(defaultLocationForCat('drygood')).toBe('pantry');
    expect(defaultLocationForCat('bakery')).toBe('pantry');
    expect(defaultLocationForCat('snack')).toBe('pantry');
    expect(defaultLocationForCat('protein')).toBe('freezer');
    expect(LOCATION_ORDER).toContain('freezer'); // seeded into the Home profile
  });

  it('falls through to "other" for unknown categories', () => {
    expect(defaultLocationForCat('other')).toBe('other');
    expect(defaultLocationForCat('whatever')).toBe('other');
  });

  it('only ever returns a real location id', () => {
    for (const c of ['spirit', 'fortified', 'citrus', 'herbspice', 'mixer', 'other'])
      expect(LOCATION_ORDER).toContain(defaultLocationForCat(c));
  });
});
