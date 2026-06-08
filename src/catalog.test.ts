import { describe, it, expect, afterEach } from 'vitest';
import { seedClassify, runtimeCatalog, SEED_KEYS, isKnownKey } from './catalog';
import { buildStockCtx, isAvailable } from './ingredients';
import { parseIngredient } from './parser';
import { state } from './state';

const keys = (records = []) => new Set(runtimeCatalog(records).entries.map(e => e.key));

describe('seedClassify', () => {
  it('resolves a known name from the seed (incl. generics)', () => {
    const rum = seedClassify('rum');
    expect(rum.cat).toBe('spirit');
    expect(rum.fam).toBe('rum');
    expect(seedClassify('lime').cat).toBe('citrus');
  });
  it('falls back to unknown + sentence-case for unrecognised names', () => {
    const u = seedClassify('moonpetal cordial');
    expect(u.cat).toBe('unknown');
    expect(u.disp).toBe('Moonpetal cordial');
    expect(u.abv).toBe(0);
  });
});

describe('runtimeCatalog', () => {
  afterEach(() => { state.ingredients = {}; });

  it('is the seed when there are no overrides', () => {
    expect(keys()).toEqual(SEED_KEYS);
    expect(SEED_KEYS.has('light rum')).toBe(true);
  });
  it('drops removed seed ingredients', () => {
    state.ingredients = { 'light rum': { removed: true } };
    expect(keys().has('light rum')).toBe(false);
  });
  it('appends user-added ingredients (keys absent from the seed)', () => {
    state.ingredients = { yuzu: { disp: 'Yuzu', cat: 'citrus', color: '#e8d44b', shape: 'wheel' } };
    const e = runtimeCatalog([]).entries.find(x => x.key === 'yuzu')!;
    expect(e.disp).toBe('Yuzu');
    expect(e.shape).toBe('wheel');
  });
  it('derives a user-added ingredient\'s umbrella from its category', () => {
    state.ingredients = {
      'agave syrup': { disp: 'Agave syrup', cat: 'syrup' },   // contributes to the syrup umbrella
      'shrub x': { disp: 'Shrub X', cat: 'mixer' },           // no umbrella -> self-scoped
    };
    const cat = runtimeCatalog([]);
    expect(cat.entries.find(x => x.key === 'agave syrup')!.umbrella).toBe('syrup');
    expect(cat.entries.find(x => x.key === 'shrub x')!.umbrella).toBe('self:shrub x');
  });

  it('hides effective generics and satisfies them via a stocked child', () => {
    const keys = new Set(runtimeCatalog([]).entries.map(e => e.key));
    expect(keys.has('rum')).toBe(false);       // generic parent hidden from stock
    expect(keys.has('light rum')).toBe(true);  // its children shown
    const ctx = buildStockCtx(runtimeCatalog([]), new Set(['light rum']));
    expect(isAvailable(parseIngredient('2 rum'), ctx)).toBe(true);        // generic matched by child
    expect(isAvailable(parseIngredient('2 dark rum'), ctx)).toBe(false);  // specific not stocked
  });

  it('stores the raw seed category (display grouping is render-time only)', () => {
    const cat = runtimeCatalog([]);
    expect(cat.entries.find(e => e.key === 'milk')?.cat).toBe('dairy');        // not 'dairyegg'
    expect(cat.entries.find(e => e.key === 'ginger beer')?.cat).toBe('soda');  // not 'mixer'
    expect(cat.entries.find(e => e.key === 'nutmeg')?.cat).toBe('spice');      // not 'herbspice'
  });

  it('applies an abv override to the classifier and the catalog entry', () => {
    state.ingredients = { bourbon: { abv: 0.5 } };
    expect(seedClassify('bourbon').abv).toBe(0.5);              // feeds the alcohol estimate
    expect(runtimeCatalog([]).entries.find(x => x.key === 'bourbon')?.abv).toBe(0.5);
  });

  it('a hand-added shelf syrup (maple) joins the syrup umbrella', () => {
    const e = runtimeCatalog([]).entries.find(x => x.key === 'maple syrup');
    expect(e?.umbrellas).toContain('syrup');
    const ctx = buildStockCtx(runtimeCatalog([]), new Set(['maple syrup']));
    expect(isAvailable(parseIngredient('3/4 syrup'), ctx)).toBe(true);
  });
});

describe('isKnownKey', () => {
  afterEach(() => { state.ingredients = {}; });
  it('flags seed/generic keys and additions as taken', () => {
    expect(isKnownKey('rum')).toBe(true);       // generic class key
    expect(isKnownKey('light rum')).toBe(true);  // seed entry
    expect(isKnownKey('yuzu')).toBe(false);
    state.ingredients = { yuzu: { disp: 'Yuzu' } };
    expect(isKnownKey('yuzu')).toBe(true);
  });
});
