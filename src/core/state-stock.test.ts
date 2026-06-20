import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { state, cycleStock, loadStock, setOnMutate, STOCK_KEY, STOCK_TS_KEY } from './state';
import { CATEGORIES_ID } from '../profiles/profiles';
import type { Profile } from './types';

/* Per-test localStorage stub (same approach as state-profiles.test.ts). */
function stubStorage(): Map<string, string> {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
  };
  return store;
}

const storeProfile = (over: Partial<Profile> = {}): Profile => ({
  id: 'store', name: 'Store', ts: 0, cats: [], hideUnstocked: false, hideOther: false,
  skipPending: false, placements: {}, ...over,
});

beforeEach(() => {
  stubStorage();
  state.profiles = {};
  state.profileId = CATEGORIES_ID;   // sentinel allows Pending (skipPending false)
  state.stocked = new Set();
  state.pending = new Set();
  state.stockTs = {};
});

afterEach(() => setOnMutate(null));

describe('cycleStock — full cycle (Pending allowed)', () => {
  it('unstocked → pending → stocked → unstocked', () => {
    cycleStock('gin');
    expect(state.pending.has('gin')).toBe(true);
    expect(state.stocked.has('gin')).toBe(false);

    cycleStock('gin');
    expect(state.stocked.has('gin')).toBe(true);
    expect(state.pending.has('gin')).toBe(false);

    cycleStock('gin');
    expect(state.stocked.has('gin')).toBe(false);
    expect(state.pending.has('gin')).toBe(false);
  });

  it('writes pending as {on:false, pending:true} in the shadow map', () => {
    cycleStock('gin');
    expect(state.stockTs['gin']).toMatchObject({ on: false, pending: true });
  });
});

describe('cycleStock — skip-pending profile (2-state)', () => {
  beforeEach(() => {
    state.profiles = { store: storeProfile({ skipPending: true }) };
    state.profileId = 'store';
  });

  it('any non-stocked click → stocked, stocked → unstocked', () => {
    cycleStock('gin');
    expect(state.stocked.has('gin')).toBe(true);
    cycleStock('gin');
    expect(state.stocked.has('gin')).toBe(false);
    expect(state.pending.has('gin')).toBe(false);
  });

  it('a pending item (made elsewhere) clicks straight to stocked', () => {
    state.pending.add('rum');
    cycleStock('rum');
    expect(state.stocked.has('rum')).toBe(true);
    expect(state.pending.has('rum')).toBe(false);
  });
});

describe('stock persistence round-trip', () => {
  it('loadStock recovers pending from the shadow map (and keeps the flag)', () => {
    localStorage.setItem(STOCK_KEY, JSON.stringify(['gin']));
    localStorage.setItem(STOCK_TS_KEY, JSON.stringify({
      gin: { on: true, ts: 1 },
      rum: { on: false, pending: true, ts: 2 },
    }));
    state.stocked = new Set();
    state.pending = new Set();
    state.stockTs = {};

    loadStock();
    expect([...state.stocked]).toEqual(['gin']);
    expect([...state.pending]).toEqual(['rum']);
    expect(state.stockTs['rum']).toMatchObject({ on: false, pending: true });
  });
});
