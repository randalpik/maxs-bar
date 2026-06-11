import { describe, it, expect, afterEach } from 'vitest';
import { state } from '../core/state';
import type { Profile } from '../core/types';
import {
  buildRecipesExport, parseRecipesImport,
  buildIngredientsExport, parseIngredientsImport,
  buildStockExport, parseStockImport,
  buildProfileExport, parseProfileImport, isProfileExport,
} from './transfer';

/* The contract for all the formats: import(file) followed by the paired export
   reproduces the same file, byte-for-byte. */
const bytes = (v: unknown) => JSON.stringify(v, null, 2);

afterEach(() => {
  state.recipeOverrides = {};
  state.ingredients = {};
  state.stocked = new Set();
  state.stockTs = {};
  state.seedId = '';
});

describe('recipes export/import (diff JSON)', () => {
  it('round-trips additions, edits, removals and the seed', () => {
    state.seedId = 'classics';
    state.recipeOverrides = {
      daiquiri: { name: 'Daiquiri', recipe: '2 rum, 1 lime, 3/4 syrup', author: '', created: '2026-01-01', edited: '2026-01-02' },
      'my original': { name: 'My Original', recipe: '2 gin, dash bitters', author: 'Max', created: '2026-02-01', edited: '2026-02-01' },
      negroni: { removed: true },
    };
    const file = buildRecipesExport();
    const { seed, overrides } = parseRecipesImport(file);
    state.seedId = seed!;
    state.recipeOverrides = overrides;
    expect(bytes(buildRecipesExport())).toBe(bytes(file));
  });

  it('round-trips a food recipe (recipeType + foodCat) and leaves cocktails bare', () => {
    state.seedId = 'classics';
    state.recipeOverrides = {
      tacos: { name: 'Tacos', recipe: '3 corn tortilla, pork, pineapple, onion', author: '', created: '2026-03-01', edited: '2026-03-01', recipeType: 'food', foodCat: 'meal' },
      daiquiri: { name: 'Daiquiri', recipe: '2 rum, 1 lime, 3/4 syrup', author: '', created: '', edited: '' },
    };
    const file = buildRecipesExport();
    const taco = file.recipes.find(r => r.name === 'Tacos')!;
    expect(taco.recipeType).toBe('food');
    expect(taco.foodCat).toBe('meal');
    // Cocktails carry neither field.
    const daq = file.recipes.find(r => r.name === 'Daiquiri')!;
    expect('recipeType' in daq).toBe(false);
    expect('foodCat' in daq).toBe(false);
    state.recipeOverrides = parseRecipesImport(file).overrides;
    expect(bytes(buildRecipesExport())).toBe(bytes(file));
  });

  it('sorts recipes by name and removals alphabetically (stable output)', () => {
    state.seedId = 'classics';
    state.recipeOverrides = {
      zombie: { name: 'Zombie', recipe: '2 rum', author: '', created: '', edited: '' },
      alaska: { name: 'Alaska', recipe: '2 gin', author: '', created: '', edited: '' },
    };
    expect(buildRecipesExport().recipes.map(r => r.name)).toEqual(['Alaska', 'Zombie']);
  });
});

describe('ingredients export/import (seed-format diff)', () => {
  it('round-trips an added ingredient, an edited seed ingredient and a removal', () => {
    state.ingredients = {
      yuzu: { disp: 'Yuzu', cat: 'citrus', color: '#e8d44b', shape: 'wheel', abv: 0 },
      bourbon: { disp: 'Bourbon', cat: 'spirit', color: '#000000', shape: 'squircle', abv: 0.45 },
      'light rum': { removed: true },
    };
    const file = buildIngredientsExport();
    state.ingredients = parseIngredientsImport(file);
    expect(bytes(buildIngredientsExport())).toBe(bytes(file));
  });

  it('round-trips user-set umbrellas and aliases', () => {
    state.ingredients = { 'overproof rum': { disp: 'Overproof rum', cat: 'spirit', color: '#C9762F', shape: 'squircle', abv: 0.75, umbrellas: ['rum'], aliases: ['151'] } };
    const file = buildIngredientsExport();
    state.ingredients = parseIngredientsImport(file);
    expect(bytes(buildIngredientsExport())).toBe(bytes(file));
  });

  it('round-trips user-authored forms (incl. a count-unit via "counts as")', () => {
    state.ingredients = {
      bread: {
        disp: 'Bread', cat: 'other', color: '#C9A36A', shape: null, abv: 0,
        forms: [{ keyword: '', role: 'count', unit: 'slice' }],
      },
    };
    const file = buildIngredientsExport();
    state.ingredients = parseIngredientsImport(file);
    expect(bytes(buildIngredientsExport())).toBe(bytes(file));
    expect(state.ingredients.bread!.forms?.[0]!.unit).toBe('slice');
  });
});

describe('stock list export/import (keys + locations)', () => {
  it('round-trips a plain stocked set (no placements) against a matching catalog', () => {
    state.stocked = new Set(['white rum', 'lime', 'angostura']);
    const file = buildStockExport();
    const known = new Set(['white rum', 'lime', 'angostura', 'lemon']);
    const { stocked, placements } = parseStockImport(file, known);
    state.stocked = stocked;
    expect(placements).toEqual([]);
    expect(buildStockExport()).toEqual(file);
  });

  it('no longer emits loc/pos (placement lives in profiles) but still reads old files', () => {
    state.stocked = new Set(['white rum', 'lime']);
    state.stockTs = {
      'white rum': { on: true, ts: 1, loc: 'bottom-shelf', pos: 0 },
      lime: { on: true, ts: 1, loc: 'fridge', pos: 0 },
    };
    expect(buildStockExport()).toEqual([{ key: 'lime' }, { key: 'white rum' }]); // bare keys, sorted
    // An old-format file's placements still come back, for the Home-profile fold.
    const old = [{ key: 'white rum', loc: 'bottom-shelf', pos: 0 }, { key: 'lime', loc: 'fridge', pos: 0 }];
    const { stocked, placements } = parseStockImport(old, new Set(['white rum', 'lime']));
    expect([...stocked].sort()).toEqual(['lime', 'white rum']);
    expect(placements).toEqual(old);
  });

  it('accepts the legacy flat string[] form', () => {
    const known = new Set(['lime', 'lemon']);
    const { stocked, placements } = parseStockImport(['lime', 'xyzzy', 'lemon'], known);
    expect([...stocked].sort()).toEqual(['lemon', 'lime']);
    expect(placements).toEqual([]);
  });

  it('ignores keys with no matching ingredient', () => {
    const known = new Set(['lime', 'lemon']);
    const { stocked } = parseStockImport([{ key: 'lime', loc: 'fridge', pos: 0 }, { key: 'xyzzy', loc: 'fridge', pos: 1 }], known);
    expect([...stocked].sort()).toEqual(['lime']);
  });
});

describe('profile export/import (single profile JSON)', () => {
  const profile: Profile = {
    id: 'p-test', name: 'Liquor store', ts: 123,
    cats: ['spirits aisle', 'mixers aisle'],
    hideUnstocked: true, hideOther: false,
    placements: {
      gin: { cat: 'spirits aisle', pos: 1, ts: 5 },
      rum: { cat: 'spirits aisle', pos: 0, ts: 5 },
      tonic: { cat: 'mixers aisle', pos: 0, ts: 5 },
      'cocktail onion': { cat: 'other', pos: 0, ts: 5 },
    },
  };

  it('round-trips cats, flags and placements; drops id/timestamps/stock', () => {
    const file = buildProfileExport(profile);
    expect(isProfileExport(file)).toBe(true);
    expect('id' in file).toBe(false);
    expect(file.placements.map(p => p.key)).toEqual(['rum', 'gin', 'tonic', 'cocktail onion']); // (cat order, pos, key)
    const known = new Set(['gin', 'rum', 'tonic', 'cocktail onion']);
    const parsed = parseProfileImport(file, known);
    const reimported: Profile = {
      id: 'p-new', name: parsed.name, ts: 0, cats: parsed.cats,
      hideUnstocked: parsed.hideUnstocked, hideOther: parsed.hideOther,
      placements: Object.fromEntries(parsed.placements.map(pl => [pl.key, { cat: pl.cat, pos: pl.pos, ts: 0 }])),
    };
    expect(bytes(buildProfileExport(reimported))).toBe(bytes(file));
  });

  it('skips placements for ingredients the catalog does not know', () => {
    const file = buildProfileExport(profile);
    const parsed = parseProfileImport(file, new Set(['gin', 'tonic']));
    expect(parsed.placements.map(p => p.key).sort()).toEqual(['gin', 'tonic']);
    expect(parsed.cats).toEqual(profile.cats);   // cats import verbatim regardless
  });

  it('drops a reserved/duplicate category but keeps the rest', () => {
    const junk = { name: ' My store ', cats: ['Aisle 1', 'other', 'aisle 1', 'Aisle 2'], placements: [] };
    const parsed = parseProfileImport(junk as never, new Set());
    expect(parsed.name).toBe('My store');
    expect(parsed.cats).toEqual(['Aisle 1', 'Aisle 2']);
  });

  it('rejects junk shapes', () => {
    expect(isProfileExport(null)).toBe(false);
    expect(isProfileExport({ name: 'x' })).toBe(false);
    expect(isProfileExport({ cats: [], placements: [] })).toBe(true);
  });
});
