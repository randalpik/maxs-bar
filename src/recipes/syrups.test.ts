import { describe, it, expect } from 'vitest';
import { parseSyrups, SYRUPS_TXT } from './syrups';

describe('parseSyrups', () => {
  it('parses every line into a named syrup with steps', () => {
    const syrups = parseSyrups();
    expect(syrups.length).toBe(SYRUPS_TXT.split('\n').filter(Boolean).length);
    for (const s of syrups) {
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.steps.length).toBeGreaterThan(0);
    }
  });
  it('splits a multi-step recipe on commas and capitalises each step', () => {
    const cinnamon = parseSyrups().find(s => s.name === 'Cinnamon')!;
    expect(cinnamon.steps[0]).toMatch(/^Bring 1 L water and 12\.5 g saigon cinnamon to boil/);
    expect(cinnamon.steps.length).toBeGreaterThan(1);
    expect(cinnamon.steps.every(s => /^[A-Z0-9]/.test(s))).toBe(true);
  });
});
