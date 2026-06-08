import { describe, it, expect, afterEach } from 'vitest';
import { buildIngredientsExport } from './ingredients-export';
import { state } from './state';

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

  it('emits an edited seed ingredient, preserving its raw category and structured fields', () => {
    state.ingredients = { bourbon: { disp: 'Bourbon', cat: 'spirit', color: '#000000', shape: 'squircle', abv: 0.45 } };
    const { ingredients } = buildIngredientsExport();
    expect(ingredients).toHaveLength(1);
    expect(ingredients[0]).toMatchObject({ key: 'bourbon', color: '#000000', abv: 0.45, fam: 'whiskey', umbrellas: ['whiskey'] });
  });

  it('skips a no-op edit (all fields equal to the seed, in display-category space)', () => {
    // cranberry seeds as raw cat "fruit" but the modal shows it as "mixer"; a save with
    // no real change writes cat:"mixer" — this must NOT count as a diff.
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
