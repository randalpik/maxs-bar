import { describe, it, expect } from 'vitest';
import { iconFor } from './icons';
import { parseIngredient } from './parser';

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
  it('citrus: juice & wheel are circles, peel & twist are spirals, wedges iconless', () => {
    expect(shapeOf('3/4 lime')).toBe('circle');
    expect(shapeOf('lemon wheel')).toBe('circle');
    expect(shapeOf('orange peel')).toBe('twist');
    expect(shapeOf('lemon twist')).toBe('twist');
    expect(shapeOf('2 lime wedges')).toBeNull();
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
});
