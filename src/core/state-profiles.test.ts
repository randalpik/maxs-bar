import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  state, loadProfiles, upsertProfile, deleteProfile, setProfilePlacement,
  setCurrentProfile, setOnMutate, PROFILES_KEY, PROFILE_SEL_KEY,
} from './state';
import { CATEGORIES_ID, HOME_ID, makeProfile } from '../profiles/profiles';

/* state.ts only touches localStorage inside functions, so a per-test stub is enough
 * for exercising the load-time migration and the profile mutators in node. */
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

let store: Map<string, string>;

beforeEach(() => {
  store = stubStorage();
  state.profiles = {};
  state.profileId = CATEGORIES_ID;
  state.stocked = new Set();
  state.stockTs = {};
});

afterEach(() => { setOnMutate(null); });

describe('loadProfiles migration', () => {
  it('first run migrates stockTs loc/pos into Home and persists the map', () => {
    state.stockTs = {
      gin: { on: true, ts: 100, loc: 'bar-top', pos: 1 },
      lime: { on: true, ts: 10 },
    };
    loadProfiles();
    expect(state.profiles[HOME_ID]!.placements).toEqual({ gin: { cat: 'bar-top', pos: 1, ts: 100 } });
    expect(store.has(PROFILES_KEY)).toBe(true);
  });

  it('is idempotent — a later load does not re-migrate', () => {
    state.stockTs = { gin: { on: true, ts: 100, loc: 'bar-top', pos: 1 } };
    loadProfiles();
    delete state.profiles[HOME_ID]!.placements['gin'];
    localStorage.setItem(PROFILES_KEY, JSON.stringify(state.profiles));
    loadProfiles();
    expect(state.profiles[HOME_ID]!.placements).toEqual({});
  });

  it('re-creates Home if missing and validates the stored selection', () => {
    localStorage.setItem(PROFILES_KEY, JSON.stringify({}));
    localStorage.setItem(PROFILE_SEL_KEY, 'gone');
    loadProfiles();
    expect(state.profiles[HOME_ID]).toBeDefined();
    expect(state.profileId).toBe(CATEGORIES_ID);
  });

  it('keeps a stored selection that points at a live profile', () => {
    const p = makeProfile('Store');
    localStorage.setItem(PROFILES_KEY, JSON.stringify({ [p.id]: p }));
    localStorage.setItem(PROFILE_SEL_KEY, p.id);
    loadProfiles();
    expect(state.profileId).toBe(p.id);
  });
});

describe('profile mutators', () => {
  it('upsertProfile stamps a fresh meta ts', () => {
    const before = Date.now();
    upsertProfile(makeProfile('Store'));
    const saved = Object.values(state.profiles)[0]!;
    expect(saved.ts).toBeGreaterThanOrEqual(before);
  });

  it('deleteProfile tombstones, drops placements and reselects Categories', () => {
    const p = makeProfile('Store');
    p.placements['gin'] = { cat: 'aisle', pos: 0, ts: 1 };
    upsertProfile(p);
    setCurrentProfile(p.id);
    deleteProfile(p.id);
    expect(state.profiles[p.id]!.deleted).toBe(true);
    expect(state.profiles[p.id]!.placements).toEqual({});
    expect(state.profileId).toBe(CATEGORIES_ID);
  });

  it('deleteProfile refuses Home', () => {
    loadProfiles();
    deleteProfile(HOME_ID);
    expect(state.profiles[HOME_ID]!.deleted).toBeUndefined();
  });

  it('setProfilePlacement stamps each placement and fires the profiles mutation', () => {
    loadProfiles();
    const kinds: string[] = [];
    setOnMutate(k => kinds.push(k));
    const before = Date.now();
    setProfilePlacement(HOME_ID, [{ key: 'gin', cat: 'bar-top', pos: 0 }, { key: 'rum', cat: 'bar-top', pos: 1 }]);
    const home = state.profiles[HOME_ID]!;
    expect(home.placements['gin']!.ts).toBeGreaterThanOrEqual(before);
    expect(home.placements['rum']).toMatchObject({ cat: 'bar-top', pos: 1 });
    expect(kinds).toEqual(['profiles']);
  });

  it('setCurrentProfile persists but never fires the mutation hook (not synced)', () => {
    const kinds: string[] = [];
    setOnMutate(k => kinds.push(k));
    setCurrentProfile(HOME_ID);
    expect(state.profileId).toBe(HOME_ID);
    expect(store.get(PROFILE_SEL_KEY)).toBe(HOME_ID);
    expect(kinds).toEqual([]);
  });
});
