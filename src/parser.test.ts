import { describe, it, expect } from 'vitest';
import { parseNum, parseIngredient, parseLine, baseSpirit, estAlcoholOz } from './parser';
import { toCSV, parseCSV } from './csv';
import { classicsText } from './seeds/classics';
import { maxsText } from './seeds/maxs-list';
import type { Recipe } from './types';

describe('parseNum', () => {
  it('parses named fractions', () => {
    expect(parseNum('3/4')).toBeCloseTo(0.75);
    expect(parseNum('1/2')).toBeCloseTo(0.5);
    expect(parseNum('5/2')).toBeCloseTo(2.5);
    expect(parseNum('3/2')).toBeCloseTo(1.5);
  });
  it('parses arbitrary fractions and decimals', () => {
    expect(parseNum('7/8')).toBeCloseTo(0.875);
    expect(parseNum('2')).toBe(2);
    expect(parseNum('1.5')).toBe(1.5);
  });
  it('returns null for non-numbers', () => {
    expect(parseNum('lime')).toBeNull();
  });
});

describe('parseIngredient roles & units', () => {
  it('bare quantity defaults to a pour in oz', () => {
    const i = parseIngredient('2 rum');
    expect(i.role).toBe('pour');
    expect(i.unit).toBe('oz');
    expect(i.qty).toBe(2);
    expect(i.cat).toBe('spirit');
    expect(i.fam).toBe('rum');
  });
  it('top prefix → top role', () => {
    expect(parseIngredient('top ginger beer').role).toBe('top');
  });
  it('float prefix → float role', () => {
    const i = parseIngredient('float 1/2 dark rum');
    expect(i.role).toBe('float');
    expect(i.qty).toBeCloseTo(0.5);
    expect(i.fam).toBe('rum');
  });
  it('dash prefix → dash role', () => {
    expect(parseIngredient('dash saline').role).toBe('dash');
  });
  it('bitters classify to bitters role', () => {
    expect(parseIngredient('angostura bitters').role).toBe('bitters');
  });
  it('egg white → egg role', () => {
    const i = parseIngredient('egg white');
    expect(i.role).toBe('egg');
    expect(i.disp).toBe('Egg');
    expect(i.eggMod).toBe('white');
  });
  it('wedges → count role with wedge unit', () => {
    const i = parseIngredient('2 lime wedges');
    expect(i.role).toBe('count');
    expect(i.unit).toBe('wedge');
  });
  it('tsp quantity → measure role', () => {
    const i = parseIngredient('2 tsp brown sugar');
    expect(i.role).toBe('measure');
  });
  it('trailing muddled → muddled role', () => {
    expect(parseIngredient('2 tsp brown sugar muddled').role).toBe('muddled');
  });
  it('citrus juice gains a " juice" suffix, non-citrus juice does not double it', () => {
    expect(parseIngredient('1 lime').disp).toBe('Lime juice');
    // pineapple/cranberry/pomegranate seed disp already ends in "juice"
    expect(parseIngredient('1 pineapple').disp).toBe('Pineapple juice');
    expect(parseIngredient('2 cranberry').disp).toBe('Cranberry juice');
  });
  it('peel/wheel/twist garnishes render in sentence case', () => {
    expect(parseIngredient('orange peel').disp).toBe('Orange peel');
    expect(parseIngredient('lemon wheel').disp).toBe('Lemon wheel');
    expect(parseIngredient('lemon twist').disp).toBe('Lemon twist');
  });
});

describe('parseLine', () => {
  it('returns null without a colon', () => {
    expect(parseLine('no colon here')).toBeNull();
  });
  it('extracts method from trailing parens', () => {
    const p = parseLine('Negroni: 1 gin, 1 sweet vermouth, 1 campari, orange peel (stirred)')!;
    expect(p.name).toBe('Negroni');
    expect(p.method).toBe('stirred');
    expect(p.hasMethod).toBe(true);
    expect(p.ingredients).toHaveLength(4);
  });
  it('defaults method to shaken', () => {
    const p = parseLine('Daiquiri: 2 rum, 3/4 lime, 3/4 syrup')!;
    expect(p.method).toBe('shaken');
    expect(p.hasMethod).toBe(false);
  });

  it('parses every seed line into a named recipe with ingredients', () => {
    const lines = (classicsText + '\n' + maxsText).split('\n').map(l => l.trim()).filter(Boolean);
    expect(lines.length).toBeGreaterThan(30);
    for (const line of lines) {
      const p = parseLine(line);
      expect(p, line).not.toBeNull();
      expect(p!.name.length, line).toBeGreaterThan(0);
      expect(p!.ingredients.length, line).toBeGreaterThan(0);
    }
  });
});

describe('baseSpirit & estAlcoholOz', () => {
  it('picks the dominant spirit family', () => {
    expect(baseSpirit(parseLine('Daiquiri: 2 rum, 3/4 lime, 3/4 syrup')!)).toBe('rum');
    expect(baseSpirit(parseLine('Negroni: 1 gin, 1 sweet vermouth, 1 campari, orange peel (stirred)')!)).toBe('gin');
  });
  it('returns null when there is no spirit', () => {
    expect(baseSpirit(parseLine('Mocktail: 1 lime, 1 simple')!)).toBeNull();
  });
  it('estimates a plausible alcohol volume', () => {
    const alc = estAlcoholOz(parseLine('Daiquiri: 2 rum, 3/4 lime, 3/4 syrup')!);
    // 2 oz rum @ 40% = 0.8 oz pure alcohol
    expect(alc).toBeCloseTo(0.8, 2);
  });
});

describe('CSV round-trip', () => {
  it('preserves fields containing commas, quotes, and newlines', () => {
    const recs: Recipe[] = [
      { name: 'Daiquiri', recipe: '2 rum, 3/4 lime, 3/4 syrup', created: '2020-01-01T00:00:00.000Z', edited: '2020-01-01T00:00:00.000Z', author: '' },
      { name: 'Quote "Test"', recipe: 'a, b, "c"\nd', created: '2021-01-01T00:00:00.000Z', edited: '2021-01-01T00:00:00.000Z', author: 'Max' },
    ];
    const round = parseCSV(toCSV(recs));
    expect(round).toEqual(recs);
  });
  it('defaults author to empty for legacy 4-column CSV', () => {
    const legacy = 'name,recipe,created,edited\nDaiquiri,"2 rum, 3/4 lime",2020-01-01T00:00:00.000Z,2020-01-01T00:00:00.000Z';
    expect(parseCSV(legacy)[0]!.author).toBe('');
  });
});
