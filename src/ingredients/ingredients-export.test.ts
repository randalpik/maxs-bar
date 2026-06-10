import { describe, it, expect, afterEach } from 'vitest';
import { buildIngredientsExport } from './ingredients-export';
import { state } from '../core/state';

describe('buildIngredientsExport (seed-format diff)', () => {
  afterEach(() => { state.ingredients = {}; });

  it('emits nothing when there are no overrides', () => {
    expect(buildIngredientsExport()).toEqual({ ingredients: [], removed: [] });
  });

  it('emits an added ingredient as a full seed-format entry', () => {
    state.ingredients = { yuzu: { disp: 'Yuzu', cat: 'citrus', color: '#e8d44b', shape: 'wheel', abv: 0 } };
    const { ingredients } = buildIngredientsExport();
    expect(ingredients).toHaveLength(1);
    expect(ingredients[0]).toMatchObject({ key: 'yuzu', disp: 'Yuzu', cat: 'citrus', color: '#e8d44b', shape: 'wheel', abv: 0 });
  });

  it('round-trips user-set umbrellas and aliases on an added ingredient', () => {
    state.ingredients = { 'overproof rum': { disp: 'Overproof rum', cat: 'spirit', umbrellas: ['rum'], aliases: ['151'] } };
    const { ingredients } = buildIngredientsExport();
    expect(ingredients[0]).toMatchObject({ key: 'overproof rum', cat: 'spirit', umbrellas: ['rum'], aliases: ['151'] });
  });

  it('emits an edited seed ingredient as key + only the changed fields', () => {
    // Override matches the seed on disp/cat/shape; only color and abv differ, so the
    // diff should carry just those — not the full entry, not the unchanged umbrellas.
    state.ingredients = { bourbon: { disp: 'Bourbon', cat: 'spirit', color: '#000000', shape: 'squircle', abv: 0.45 } };
    const { ingredients } = buildIngredientsExport();
    expect(ingredients).toHaveLength(1);
    expect(ingredients[0]).toEqual({ key: 'bourbon', color: '#000000', abv: 0.45 });
  });

  it('skips a no-op edit (override fields all equal to the seed)', () => {
    // The modal now stores the raw category (same namespace as the seed), so a save
    // with no real change writes the seed's own values — this must NOT count as a diff.
    state.ingredients = { cranberry: { disp: 'Cranberry juice', cat: 'mixer', color: '#B5293A', shape: 'droplet', abv: 0 } };
    expect(buildIngredientsExport().ingredients).toHaveLength(0);
  });

  it('lists removed seed ingredients separately', () => {
    state.ingredients = { 'light rum': { removed: true }, yuzu: { disp: 'Yuzu' } };
    const { ingredients, removed } = buildIngredientsExport();
    expect(removed).toEqual(['light rum']);
    expect(ingredients.map(i => i.key)).toEqual(['yuzu']);
  });
});
