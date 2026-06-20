import { describe, it, expect } from 'vitest';
import type { Profile, StockEntry } from '../core/types';
import {
  HOME_ID, OTHER_CAT,
  makeHomeProfile, makeProfile, profileCats, catLabel, isReservedCat, sameCat,
  effectiveCat, seedHomeFromStock, foldLegacyPlacements,
} from './profiles';
import { LOCATION_ORDER } from '../ingredients/locations';

const custom = (over: Partial<Profile> = {}): Profile => ({
  id: 'p-test', name: 'Liquor store', ts: 0, cats: ['aisle 1', 'aisle 2'],
  hideUnstocked: false, hideOther: false, skipPending: false, placements: {}, ...over,
});

describe('home profile', () => {
  it('seeds from the physical locations, Other excluded', () => {
    const h = makeHomeProfile();
    expect(h.id).toBe(HOME_ID);
    expect(h.cats).toEqual(LOCATION_ORDER.filter(id => id !== OTHER_CAT));
    expect(h.cats).not.toContain(OTHER_CAT);
    expect(h.hideUnstocked).toBe(false);
    expect(h.hideOther).toBe(false);
  });

  it('profileCats appends the implicit Other last', () => {
    const h = makeHomeProfile();
    const cats = profileCats(h);
    expect(cats[cats.length - 1]).toBe(OTHER_CAT);
    expect(cats.filter(c => c === OTHER_CAT)).toHaveLength(1);
  });
});

describe('makeProfile', () => {
  it('starts empty (just the implicit Other) with distinct ids', () => {
    const a = makeProfile('Groceries'), b = makeProfile('Groceries');
    expect(a.cats).toEqual([]);
    expect(profileCats(a)).toEqual([OTHER_CAT]);
    expect(a.id).not.toBe(b.id);
  });
});

describe('catLabel / isReservedCat / sameCat', () => {
  it('labels known location ids, renders custom names verbatim', () => {
    expect(catLabel('fridge')).toBe('Fridge');
    expect(catLabel(OTHER_CAT)).toBe('Other');
    expect(catLabel('Aisle 3')).toBe('Aisle 3');
  });

  it('reserves only "other" (any case/whitespace)', () => {
    expect(isReservedCat('other')).toBe(true);
    expect(isReservedCat(' Other ')).toBe(true);
    expect(isReservedCat('Fridge')).toBe(false);
  });

  it('sameCat matches by label, case-insensitively', () => {
    expect(sameCat('fridge', 'Fridge')).toBe(true);     // Home id vs custom aisle
    expect(sameCat('Aisle 1', 'aisle 1')).toBe(true);
    expect(sameCat('fridge', 'pantry')).toBe(false);
  });
});

describe('effectiveCat', () => {
  it('explicit placement wins over the Home default location', () => {
    const h = makeHomeProfile();
    h.placements['gin'] = { cat: 'bar-top', pos: 0, ts: 1 };
    expect(effectiveCat(h, 'gin', 'bottom-shelf')).toBe('bar-top');
  });

  it('falls back to the ingredient default location, then Other', () => {
    const h = makeHomeProfile();
    expect(effectiveCat(h, 'gin', 'bottom-shelf')).toBe('bottom-shelf');
    expect(effectiveCat(h, 'gin', undefined)).toBe(OTHER_CAT);
  });

  it('matches the default location in ANY profile with a label-equivalent category', () => {
    const p = custom({ cats: ['Snacks', 'Fridge'] });
    expect(effectiveCat(p, 'lime', 'fridge')).toBe('Fridge');   // returns the profile's own string
    expect(effectiveCat(p, 'gin', 'bottom-shelf')).toBe(OTHER_CAT); // no equivalent aisle
  });

  it('demotes to Other when the resolved category is no longer listed', () => {
    const p = custom();
    p.placements['gin'] = { cat: 'aisle 9', pos: 0, ts: 1 };           // removed aisle
    expect(effectiveCat(p, 'gin')).toBe(OTHER_CAT);
    const h = makeHomeProfile();
    h.cats = h.cats.filter(c => c !== 'wine-rack');
    expect(effectiveCat(h, 'sherry', 'wine-rack')).toBe(OTHER_CAT);    // defaultLoc at removed cat
  });

  it('an explicit Other placement stays Other', () => {
    const p = custom();
    p.placements['gin'] = { cat: OTHER_CAT, pos: 2, ts: 1 };
    expect(effectiveCat(p, 'gin')).toBe(OTHER_CAT);
  });
});

describe('migration', () => {
  const stockTs: Record<string, StockEntry> = {
    gin: { on: true, ts: 100, loc: 'bar-top', pos: 2 },
    rum: { on: true, ts: 50, loc: 'top-shelf' },          // no pos → 0
    lime: { on: true, ts: 10 },                            // never placed → no placement
    vermouth: { on: false, ts: 200, loc: 'fridge', pos: 1 }, // unstocked but placed → kept
  };

  it('seedHomeFromStock folds loc/pos keeping each entry timestamp', () => {
    const h = seedHomeFromStock(stockTs);
    expect(h.placements).toEqual({
      gin: { cat: 'bar-top', pos: 2, ts: 100 },
      rum: { cat: 'top-shelf', pos: 0, ts: 50 },
      vermouth: { cat: 'fridge', pos: 1, ts: 200 },
    });
  });

  it('foldLegacyPlacements only overwrites with a strictly newer ts', () => {
    const h = makeHomeProfile();
    h.placements['gin'] = { cat: 'bottom-shelf', pos: 0, ts: 150 };  // newer than legacy 100
    h.placements['rum'] = { cat: 'pantry', pos: 3, ts: 20 };         // older than legacy 50
    foldLegacyPlacements(h, stockTs);
    expect(h.placements['gin']).toEqual({ cat: 'bottom-shelf', pos: 0, ts: 150 });
    expect(h.placements['rum']).toEqual({ cat: 'top-shelf', pos: 0, ts: 50 });
    expect(h.placements['vermouth']).toEqual({ cat: 'fridge', pos: 1, ts: 200 });
    expect(h.placements['lime']).toBeUndefined();
  });
});
