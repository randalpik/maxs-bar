import { describe, it, expect, afterEach } from 'vitest';
import { state } from './state';
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
});

describe('stock list export/import (flat keys)', () => {
  it('round-trips a stocked set against a matching catalog', () => {
    state.stocked = new Set(['white rum', 'lime', 'angostura']);
    const file = buildStockExport();
    const known = new Set(['white rum', 'lime', 'angostura', 'lemon']);
    state.stocked = parseStockImport(file, known);
    expect(buildStockExport()).toEqual(file);
  });

  it('ignores keys with no matching ingredient', () => {
    const known = new Set(['lime', 'lemon']);
    expect([...parseStockImport(['lime', 'xyzzy', 'lemon'], known)].sort()).toEqual(['lemon', 'lime']);
  });

  it('clears prior stock before applying the imported list', () => {
    state.stocked = new Set(['gin', 'tonic']);
    state.stocked = parseStockImport(['lime'], new Set(['lime', 'gin', 'tonic']));
    expect([...state.stocked]).toEqual(['lime']);
  });
});
