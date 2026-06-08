import { describe, it, expect } from 'vitest';
import type { SyncPayload } from '../core/types';
import { mergePayload, mergeStock, mergeIngredients } from './merge';

/* Merge is the highest-risk part of sync: it must converge regardless of order, never
   clobber a concurrent unrelated edit, and let deletions and legacy data behave sanely. */

const P = (p: Partial<SyncPayload>): SyncPayload => ({
  seedId: 'classics', seedTs: 0, recipeOverrides: {}, ingredients: {}, stockTs: {}, ...p,
});

/** Order-independent canonical form, so we compare merged *state*, not key insertion order. */
const stable = (v: unknown): string =>
  JSON.stringify(v, (_k, val) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.fromEntries(Object.entries(val).sort(([a], [b]) => a.localeCompare(b)))
      : val);
const sameState = (a: SyncPayload, b: SyncPayload) => expect(stable(a)).toBe(stable(b));

describe('recipe merge (LWW by `edited`)', () => {
  it('newer edit wins, and the merge is symmetric', () => {
    const a = P({ recipeOverrides: { daiquiri: { name: 'Daiquiri', recipe: 'OLD', edited: '2026-01-01T00:00:00.000Z' } } });
    const b = P({ recipeOverrides: { daiquiri: { name: 'Daiquiri', recipe: 'NEW', edited: '2026-02-01T00:00:00.000Z' } } });
    expect(mergePayload(a, b).recipeOverrides.daiquiri!.recipe).toBe('NEW');
    sameState(mergePayload(a, b), mergePayload(b, a));
  });

  it('does not clobber a concurrent edit to a different recipe', () => {
    const a = P({ recipeOverrides: { alpha: { recipe: 'A', edited: '2026-01-01T00:00:00.000Z' } } });
    const b = P({ recipeOverrides: { beta: { recipe: 'B', edited: '2026-01-01T00:00:00.000Z' } } });
    const m = mergePayload(a, b).recipeOverrides;
    expect(m.alpha!.recipe).toBe('A');
    expect(m.beta!.recipe).toBe('B');
  });

  it('a later delete beats an earlier edit (and vice-versa)', () => {
    const edit = P({ recipeOverrides: { negroni: { recipe: 'X', edited: '2026-01-01T00:00:00.000Z' } } });
    const del = P({ recipeOverrides: { negroni: { removed: true, edited: '2026-02-01T00:00:00.000Z' } } });
    expect(mergePayload(edit, del).recipeOverrides.negroni!.removed).toBe(true);

    const edit2 = P({ recipeOverrides: { negroni: { recipe: 'Y', edited: '2026-03-01T00:00:00.000Z' } } });
    expect(mergePayload(del, edit2).recipeOverrides.negroni!.recipe).toBe('Y');
  });

  it('a tombstone present on one side only is preserved', () => {
    const del = P({ recipeOverrides: { gimlet: { removed: true, edited: '2026-01-01T00:00:00.000Z' } } });
    const none = P({});
    expect(mergePayload(del, none).recipeOverrides.gimlet!.removed).toBe(true);
    expect(mergePayload(none, del).recipeOverrides.gimlet!.removed).toBe(true);
  });

  it('legacy override with no timestamp loses to a genuine stamped edit', () => {
    const legacy = P({ recipeOverrides: { sour: { recipe: 'LEGACY' } } });            // no `edited` ⇒ ts 0
    const fresh = P({ recipeOverrides: { sour: { recipe: 'FRESH', edited: '2024-01-01T00:00:00.000Z' } } });
    expect(mergePayload(legacy, fresh).recipeOverrides.sour!.recipe).toBe('FRESH');
  });
});

describe('stock merge (un-stock must propagate)', () => {
  it('a later un-stock beats an earlier stock', () => {
    const on = { lime: { on: true, ts: 100 } };
    const off = { lime: { on: false, ts: 200 } };
    expect(mergeStock(on, off).lime!.on).toBe(false);
    expect(mergeStock(off, on).lime!.on).toBe(false);
  });

  it('unions independent keys', () => {
    const m = mergeStock({ rum: { on: true, ts: 1 } }, { gin: { on: true, ts: 1 } });
    expect(m.rum!.on).toBe(true);
    expect(m.gin!.on).toBe(true);
  });
});

describe('ingredient merge (union + LWW; reset has no tombstone)', () => {
  it('newer ts wins per key', () => {
    const a = { gin: { color: '#111', ts: 100 } };
    const b = { gin: { color: '#222', ts: 200 } };
    expect(mergeIngredients(a, b).gin!.color).toBe('#222');
  });

  it('a local reset (key dropped) loses to a concurrent remote edit — resurrects', () => {
    const local = {};                                       // reset removed it locally
    const remote = { gin: { color: '#333', ts: 50 } };
    expect(mergeIngredients(local, remote).gin!.color).toBe('#333');
  });
});

describe('seed scalar (LWW by seedTs)', () => {
  it('the more recently chosen seed wins', () => {
    const a = P({ seedId: 'classics', seedTs: 100 });
    const b = P({ seedId: 'maxs-list', seedTs: 200 });
    expect(mergePayload(a, b).seedId).toBe('maxs-list');
    expect(mergePayload(b, a).seedId).toBe('maxs-list');
  });
});

describe('convergence + idempotency', () => {
  const a = P({
    seedId: 'classics', seedTs: 10,
    recipeOverrides: { x: { recipe: 'ax', edited: '2026-01-02T00:00:00.000Z' }, y: { removed: true, edited: '2026-01-05T00:00:00.000Z' } },
    ingredients: { gin: { color: '#a', ts: 10 } },
    stockTs: { lime: { on: true, ts: 10 }, rum: { on: false, ts: 5 } },
  });
  const b = P({
    seedId: 'maxs-list', seedTs: 20,
    recipeOverrides: { x: { recipe: 'bx', edited: '2026-01-01T00:00:00.000Z' }, z: { recipe: 'bz', edited: '2026-01-03T00:00:00.000Z' } },
    ingredients: { gin: { color: '#b', ts: 20 }, lime: { cat: 'citrus', ts: 7 } },
    stockTs: { lime: { on: false, ts: 20 }, rum: { on: true, ts: 1 } },
  });
  const c = P({
    seedId: 'empty', seedTs: 15,
    recipeOverrides: { x: { recipe: 'cx', edited: '2026-01-04T00:00:00.000Z' } },
    ingredients: { lime: { cat: 'fruit', ts: 30 } },
    stockTs: { mint: { on: true, ts: 99 } },
  });

  it('is order-independent for two payloads (commutative)', () => {
    sameState(mergePayload(a, b), mergePayload(b, a));
  });

  it('is associative across three payloads (any grouping/order converges)', () => {
    const left = mergePayload(mergePayload(a, b), c);
    const right = mergePayload(a, mergePayload(b, c));
    const shuffled = mergePayload(mergePayload(c, a), b);
    sameState(left, right);
    sameState(left, shuffled);
  });

  it('is idempotent (re-merging a known side changes nothing)', () => {
    const m = mergePayload(a, b);
    sameState(mergePayload(m, b), m);
    sameState(mergePayload(m, m), m);
  });

  it('the converged result reflects every newest-wins decision', () => {
    const m = mergePayload(mergePayload(a, b), c);
    expect(m.seedId).toBe('maxs-list');                  // seedTs 20 highest
    expect(m.recipeOverrides.x!.recipe).toBe('cx');       // 2026-01-04 newest of ax/bx/cx
    expect(m.recipeOverrides.y!.removed).toBe(true);      // tombstone survives
    expect(m.recipeOverrides.z!.recipe).toBe('bz');       // present in b only
    expect(m.ingredients.gin!.color).toBe('#b');          // ts 20 > 10
    expect(m.ingredients.lime!.cat).toBe('fruit');        // ts 30 newest
    expect(m.stockTs.lime!.on).toBe(false);               // ts 20 un-stock wins
    expect(m.stockTs.rum!.on).toBe(false);                // ts 5 off > ts 1 on
    expect(m.stockTs.mint!.on).toBe(true);                // present in c only
  });
});
