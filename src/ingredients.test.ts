import { describe, it, expect, afterEach } from 'vitest';
import { buildCatalog, buildStockCtx, missingCount, effectiveChip } from './ingredients';
import { derive, state } from './state';
import { parseIngredient } from './parser';
import type { Recipe } from './types';

const rec = (name: string, recipe: string): Recipe => ({ name, recipe, created: '', edited: '', author: '' });

describe('missingCount', () => {
  it('counts every distinct ingredient when nothing is stocked', () => {
    const recs = [rec('Daiquiri', '2 rum, 3/4 lime, 3/4 syrup')];
    const ctx = buildStockCtx(buildCatalog(recs), new Set());
    expect(missingCount(derive(recs[0]!).p.ingredients, ctx)).toBe(3);
  });

  it('drops to zero once everything is stocked', () => {
    const recs = [rec('Daiquiri', '2 rum, 3/4 lime, 3/4 syrup')];
    const ctx = buildStockCtx(buildCatalog(recs), new Set(['rum', 'lime', 'syrup']));
    expect(missingCount(derive(recs[0]!).p.ingredients, ctx)).toBe(0);
  });

  it('dedupes by stock identity (lime juice + lime wedge = one missing item)', () => {
    const recs = [rec('Test', '3/4 lime, 1 lime wedge')];
    const ctx = buildStockCtx(buildCatalog(recs), new Set());
    expect(missingCount(derive(recs[0]!).p.ingredients, ctx)).toBe(1);
  });
});

describe('ingredient overrides', () => {
  afterEach(() => { state.ingredients = {}; });

  it('buildCatalog applies disp/cat overrides without changing the stock key', () => {
    state.ingredients = { rum: { disp: 'White rum', cat: 'liqueur' } };
    const e = buildCatalog([rec('Daiquiri', '2 rum, 3/4 lime, 3/4 syrup')]).entries.find(x => x.key === 'rum')!;
    expect(e.key).toBe('rum');
    expect(e.disp).toBe('White rum');
    expect(e.cat).toBe('liqueur');
  });

  it('effectiveChip applies overrides to a recipe ingredient, defaulting unset fields', () => {
    state.ingredients = { rum: { disp: 'White rum', color: '#ffffff' } };
    const eff = effectiveChip(parseIngredient('2 rum'));
    expect(eff.disp).toBe('White rum');
    expect(eff.color).toBe('#ffffff');
    expect(eff.shape).toBe('squircle'); // shape not overridden -> parser default
  });
});
