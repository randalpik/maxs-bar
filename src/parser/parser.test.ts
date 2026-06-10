import { describe, it, expect, afterEach } from 'vitest';
import { parseNum, parseIngredient, parseLine, baseSpirit, estAlcoholOz, setUnits, BASE_UNITS } from './parser';
import { amountTag } from '../ingredients/icons';
import { ingredientKey } from '../ingredients/ingredients';
import { toCSV, parseCSV } from './csv';
import { classicsText } from '../recipes/seeds/classics';
import { maxsText } from '../recipes/seeds/maxs-list';
import type { Recipe } from '../core/types';

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
    expect(i.fam).toBe('cane');
  });
  it('top prefix → top role', () => {
    expect(parseIngredient('top ginger beer').role).toBe('top');
  });
  it('float prefix → float process over a normal pour', () => {
    const i = parseIngredient('float 1/2 dark rum');
    expect(i.role).toBe('pour');
    expect(i.process).toBe('float');
    expect(i.qty).toBeCloseTo(0.5);
    expect(i.fam).toBe('cane');
  });
  it('dash prefix → dash role', () => {
    expect(parseIngredient('dash saline').role).toBe('dash');
  });
  it('bitters default to a dash (no prefix needed) via the category default form', () => {
    const i = parseIngredient('angostura bitters');
    expect(i.role).toBe('dash');
    expect(i.disp).toBe('Angostura bitters');
    expect(amountTag(i).amount).toBe('dash');
  });
  it('egg is a bare count; white/yolk show the keyword in the name', () => {
    const plain = parseIngredient('egg');
    expect(plain.role).toBe('count');
    expect(plain.disp).toBe('Egg');
    expect(amountTag(plain).amount).toBe('1'); // bare number, no "whole"
    const white = parseIngredient('egg white');
    expect(white.role).toBe('count');
    expect(white.disp).toBe('Egg white');
    expect(amountTag(white).amount).toBe('1');
    const yolk = parseIngredient('2 egg yolk');
    expect(yolk.disp).toBe('Egg yolk');
    expect(amountTag(yolk).amount).toBe('2');
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
  it('muddle is a process, orthogonal to the measure — the amount still resolves', () => {
    // tsp sugar muddled → still a measure, with a muddle process
    const s = parseIngredient('2 tsp brown sugar muddled');
    expect(s.role).toBe('measure');
    expect(s.process).toBe('muddle');
    // lime wedges muddled → still a count of wedges, muddle process
    const w = parseIngredient('4 lime wedges muddled');
    expect(w.role).toBe('count');
    expect(w.unit).toBe('wedge');
    expect(w.disp).toBe('Lime');
    expect(w.process).toBe('muddle');
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

describe('process words (garnish/grate/muddle) vs the amount', () => {
  const at = (t: string) => amountTag(parseIngredient(t));
  it('garnish items carry a real amount + a garnish process tag', () => {
    expect(at('mint')).toEqual({ amount: '1 sprig', tag: 'garnish' });
    expect(at('cherry')).toEqual({ amount: '1', tag: 'garnish' });
    expect(at('candied ginger')).toEqual({ amount: '1 piece', tag: 'garnish' });
    expect(at('orange peel')).toEqual({ amount: '1', tag: 'garnish' });
  });
  it('nutmeg uses its own grate process + pinch unit (pluralised correctly)', () => {
    expect(at('nutmeg')).toEqual({ amount: '1 pinch', tag: 'grate' });
    expect(at('2 nutmeg')).toEqual({ amount: '2 pinches', tag: 'grate' }); // not "pinchs"
  });
  it('muddle (a process) overrides the default garnish but keeps the amount', () => {
    expect(at('muddled mint')).toEqual({ amount: '1 sprig', tag: 'muddle' });
    expect(at('muddled raspberry')).toEqual({ amount: '1', tag: 'muddle' });
  });
});

describe('stock-key folding (every form → one identity)', () => {
  it('folds citrus and egg forms onto the base key', () => {
    for (const t of ['lime', '1 lime', 'lime juice', '2 lime wedges', 'lime peel'])
      expect(ingredientKey(parseIngredient(t)), t).toBe('lime');
    for (const t of ['egg', 'egg white', 'egg yolk'])
      expect(ingredientKey(parseIngredient(t)), t).toBe('egg');
  });
});

describe('data-driven units (setUnits registry)', () => {
  afterEach(() => setUnits(BASE_UNITS)); // restore the base set after each registry tweak

  it('a discrete leading unit (volOz null) → count, with a pluralised amount tag', () => {
    setUnits([...BASE_UNITS, { id: 'slice', volOz: null }]);
    const one = parseIngredient('1 slice bread');
    expect(one.role).toBe('count');
    expect(one.unit).toBe('slice');
    expect(amountTag(one).amount).toBe('1 slice');
    expect(parseIngredient('2 slice bread').qty).toBe(2);
    expect(amountTag(parseIngredient('2 slice bread')).amount).toBe('2 slices');
    expect(estAlcoholOz(parseLine('Toast: 1 slice bread')!)).toBe(0); // discrete units add no volume
  });

  it('a volumetric unit feeds the alcohol estimate by its oz-per-unit', () => {
    setUnits([...BASE_UNITS, { id: 'shot', volOz: 1.5 }]);
    // 1.5 oz rum @ 40% = 0.6 oz pure alcohol
    expect(estAlcoholOz(parseLine('Shot: 1 shot rum')!)).toBeCloseTo(0.6, 2);
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
    expect(baseSpirit(parseLine('Daiquiri: 2 rum, 3/4 lime, 3/4 syrup')!)).toBe('cane');
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
