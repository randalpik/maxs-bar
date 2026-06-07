import { describe, it, expect, afterEach } from 'vitest';
import { seedClassify, runtimeCatalog, SEED_KEYS, isKnownKey } from './catalog';
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
