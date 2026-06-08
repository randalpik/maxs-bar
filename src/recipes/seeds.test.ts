import { describe, it, expect, afterEach } from 'vitest';
import { resolveSeed } from './seeds';
import { state, deriveRecords, diffRecords } from '../core/state';
import type { Recipe } from '../core/types';

const names = (recs: Recipe[]) => recs.map(r => r.name);
const byName = (recs: Recipe[], n: string) => recs.find(r => r.name === n);

afterEach(() => {
  state.seedId = '';
  state.recipeOverrides = {};
});

describe('resolveSeed', () => {
  it('returns an empty list for the empty seed', () => {
    expect(resolveSeed('empty')).toEqual([]);
    expect(resolveSeed('nonexistent')).toEqual([]);
  });

  it('Classics is a non-trivial canonical list', () => {
    const c = resolveSeed('classics');
    expect(c.length).toBeGreaterThan(30);
    expect(names(c)).toContain('Negroni');
  });

  it("Max's List inherits Classics and appends its own drinks", () => {
    const classics = resolveSeed('classics');
    const maxs = resolveSeed('maxs-list');
    expect(maxs.length).toBeGreaterThan(classics.length);
    // every classic survives in Max's List
    for (const n of names(classics)) expect(names(maxs)).toContain(n);
    // and Max's originals are added
    expect(names(maxs)).toContain('Necromancer');
  });

  it('a child line with a matching name overrides the inherited recipe', () => {
    // Negroni exists in Classics; resolution must keep exactly one entry per name.
    const maxs = resolveSeed('maxs-list');
    expect(names(maxs).filter(n => n === 'Negroni')).toHaveLength(1);
  });
});

describe('deriveRecords + diffRecords round-trip', () => {
  it('untouched records produce no overrides', () => {
    state.seedId = 'classics';
    state.recipeOverrides = {};
    const recs = deriveRecords();
    expect(diffRecords(recs, resolveSeed('classics'))).toEqual({});
  });

  it('captures an edit, an addition, and a removal as overrides', () => {
    state.seedId = 'classics';
    const base = resolveSeed('classics');
    const recs = deriveRecords();
    // edit Negroni, add a new drink, remove Daiquiri
    byName(recs, 'Negroni')!.recipe = '1 gin, 1 sweet vermouth, 1 campari, lemon peel (stirred)';
    recs.push({ name: 'Test Original', recipe: '2 gin, 1 lime', created: 'x', edited: 'x', author: 'Me' });
    const noDaiquiri = recs.filter(r => r.name !== 'Daiquiri');

    const ov = diffRecords(noDaiquiri, base);
    // Tombstones now carry an `edited` timestamp so a deletion can win a sync merge.
    expect(ov['daiquiri']?.removed).toBe(true);
    expect(typeof ov['daiquiri']?.edited).toBe('string');
    expect(ov['negroni']?.recipe).toContain('lemon peel');
    expect(ov['test original']?.author).toBe('Me');
    expect(Object.keys(ov)).toHaveLength(3);
  });

  it('user overrides survive a seed switch (apply -> diff -> re-apply)', () => {
    // Start on Classics with an edit + an addition.
    state.seedId = 'classics';
    let recs = deriveRecords();
    byName(recs, 'Negroni')!.recipe = 'EDITED';
    recs.push({ name: 'Test Original', recipe: '2 gin', created: 'x', edited: 'x', author: '' });
    state.recipeOverrides = diffRecords(recs, resolveSeed('classics'));

    // Switch to Max's List: re-derive from the new base with the same overrides.
    state.seedId = 'maxs-list';
    recs = deriveRecords();
    expect(byName(recs, 'Negroni')!.recipe).toBe('EDITED'); // edit persists
    expect(byName(recs, 'Test Original')).toBeTruthy();      // addition persists
    expect(byName(recs, 'Necromancer')).toBeTruthy();        // new base drink appears
  });
});
