import { describe, it, expect } from 'vitest';
import { buildCatalog, buildStockCtx, missingCount } from './ingredients';
import { derive } from './state';
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
