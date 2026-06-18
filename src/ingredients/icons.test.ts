import { describe, it, expect } from 'vitest';
import { icon, iconFor, amountTag } from './icons';
import { parseIngredient } from '../parser/parser';

const shapeOf = (raw: string) => iconFor(parseIngredient(raw));

describe('iconFor mapping', () => {
  it('extracts, solutions and tinctures use the dropper', () => {
    expect(shapeOf('1/4 arugula extract')).toBe('dropper');
    expect(shapeOf('dash saline')).toBe('dropper'); // classifies as "Saline solution"
  });
  it('one-off solids', () => {
    expect(shapeOf('egg white')).toBe('egg');
    expect(shapeOf('2 tsp brown sugar')).toBe('cube');
    expect(shapeOf('muddled mint')).toBe('sprig');
    expect(shapeOf('nutmeg')).toBe('seed');
  });
  it('fruit garnishes', () => {
    expect(shapeOf('cherry')).toBe('cherry');
    expect(shapeOf('muddled raspberry')).toBe('berry');
  });
  it('citrus: juice = circle, wheel = ring, peel/twist = curl, wedge = segment', () => {
    expect(shapeOf('3/4 lime')).toBe('circle');
    expect(shapeOf('lemon wheel')).toBe('wheel');
    expect(shapeOf('orange peel')).toBe('twist');
    expect(shapeOf('lemon twist')).toBe('twist');
    expect(shapeOf('2 lime wedges')).toBe('wedge');
  });
  it('candied ginger gets the ginger icon', () => {
    expect(shapeOf('candied ginger')).toBe('ginger');
  });
  it('muddled wedges keep the wedge icon + count amount, with a muddle tag', () => {
    const i = parseIngredient('4 lime wedges muddled');
    expect(iconFor(i)).toBe('wedge');             // not iconless
    expect(amountTag(i)).toEqual({ amount: '4 wedges', tag: 'muddle' });
  });
  it('muddled also tags an otherwise-amountless garnish without changing its icon', () => {
    const m = parseIngredient('muddled mint');
    expect(iconFor(m)).toBe('sprig');
    expect(amountTag(m).tag).toBe('muddle');
  });
  it('non-alcoholic, non-citrus liquids fall under droplet', () => {
    expect(shapeOf('top milk')).toBe('droplet');
    expect(shapeOf('1 espresso')).toBe('droplet');
    expect(shapeOf('top soda')).toBe('droplet');
  });
  it('spirits and liqueurs keep their shapes', () => {
    expect(shapeOf('2 rum')).toBe('squircle');
    expect(shapeOf('1 campari')).toBe('hexagon');
  });
  it('brews (beer, cider) get the can icon', () => {
    expect(shapeOf('1 beer')).toBe('can');
    expect(shapeOf('1 cider')).toBe('can');
  });
  it('every food shape is drawn, not the default-circle fallback', () => {
    const fallback = icon('__nonexistent__', '#000');
    for (const s of ['jar', 'box', 'bag', 'loaf', 'shaker', 'cheese', 'patty', 'block', 'squeeze', 'cylinder',
                     'mushroom', 'pepper', 'onion', 'avocado'])
      expect(icon(s, '#000'), s).not.toBe(fallback);
  });
});
