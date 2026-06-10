import { describe, it, expect, afterEach } from 'vitest';
import { state } from '../core/state';
import {
  buildRecipesExport, parseRecipesImport,
  buildIngredientsExport, parseIngredientsImport,
  buildStockExport, parseStockImport,
} from './transfer';

/* The contract for all three formats: import(file) followed by the paired export
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

  it('round-trips locations + positions', () => {
    state.stocked = new Set(['white rum', 'lime', 'gin']);
    state.stockTs = {
      'white rum': { on: true, ts: 1, loc: 'bottom-shelf', pos: 0 },
      gin: { on: true, ts: 1, loc: 'bottom-shelf', pos: 1 },
      lime: { on: true, ts: 1, loc: 'fridge', pos: 0 },
    };
    const file = buildStockExport();
    const known = new Set(['white rum', 'lime', 'gin']);
    const { stocked, placements } = parseStockImport(file, known);
    // Re-apply into a fresh shadow map the way importStockJSON does.
    state.stocked = stocked;
    state.stockTs = {};
    for (const k of stocked) state.stockTs[k] = { on: true, ts: 1 };
    for (const p of placements) state.stockTs[p.key] = { on: true, ts: 1, loc: p.loc, pos: p.pos };
    expect(buildStockExport()).toEqual(file);
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
