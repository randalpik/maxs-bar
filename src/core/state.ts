import type { Recipe, Derived, IngredientOverride, RecipeOverride, StockEntry, SyncPayload, Profile } from './types';
import { parseLine, baseSpirit, estAlcoholOz } from '../parser/parser';
import { parseCSV } from '../parser/csv';
import { resolveSeed, DEFAULT_SEED } from '../recipes/seeds';
import { CATEGORIES_ID, HOME_ID, makeHomeProfile, seedHomeFromStock, foldLegacyPlacements } from '../profiles/profiles';
import { nowISO } from './util';

/* ============================================================
   State + storage
   ============================================================ */
/** Legacy flat-recipe store, read once for migration; no longer written. */
export const KEY = 'backbar.csv.v2';
export const STOCK_KEY = 'backbar.stock.v1';
export const INGREDIENTS_KEY = 'backbar.ingredients.v1';
export const SEED_KEY = 'backbar.seed.v1';
export const RECIPES_KEY = 'backbar.recipes.v1';
/** Sync-only timestamps layered beside the data above (see types: StockEntry, SyncPayload). */
export const STOCK_TS_KEY = 'backbar.stock-ts.v1';
export const SEED_TS_KEY = 'backbar.seed-ts.v1';
/** Store profiles (Home + custom; the 'categories' sentinel is never stored). */
export const PROFILES_KEY = 'backbar.profiles.v1';
/** Current profile selection — per-device view preference, never synced. */
export const PROFILE_SEL_KEY = 'backbar.profile-sel.v1';

/** Shared, mutable app state. */
export const state: {
  records: Recipe[];
  /** Chosen recipe seed id; '' until the user picks one (forces the seed modal). */
  seedId: string;
  mode: 'group' | 'sort';
  key: string;
  query: string;
  page: 'recipes' | 'food' | 'ingredients' | 'syrups';
  stocked: Set<string>;
  /** Tagged-for-purchase keys (a shopping-list flavour of unstocked; never also in
   *  `stocked`). Derived from `stockTs` on load/apply, kept in lockstep by the mutators. */
  pending: Set<string>;
  /** Sync-only shadow of `stocked`/`pending`: per-key {on,pending?,ts} so an un-stock
   *  can win a merge. Kept in lockstep with the Sets by the stock mutators; not read by the UI. */
  stockTs: Record<string, StockEntry>;
  /** Per-ingredient edits, keyed by ingredientKey; layered over parser defaults. */
  ingredients: Record<string, IngredientOverride>;
  /** User recipe diffs vs the resolved seed, keyed by lowercased name. */
  recipeOverrides: Record<string, RecipeOverride>;
  /** Epoch-ms the seed was last chosen (sync LWW for the seedId scalar). */
  seedTs: number;
  /** Store profiles keyed by id (Home + custom, tombstones included); synced. */
  profiles: Record<string, Profile>;
  /** Current ingredients-page profile ('categories' sentinel or a profile id).
   *  Per-device: persisted across reloads but never synced. */
  profileId: string;
} = {
  records: [],
  seedId: '',
  mode: 'sort',
  key: 'base',
  query: '',
  page: 'recipes',
  stocked: new Set(),
  pending: new Set(),
  stockTs: {},
  ingredients: {},
  recipeOverrides: {},
  seedTs: 0,
  profiles: {},
  profileId: CATEGORIES_ID,
};

/** True once the user has chosen a seed (false on a fresh install). */
export function hasSeed(): boolean { return !!state.seedId; }

/* ---- mutation hook: the sync layer (when signed in) observes persisted changes ----
 * A single optional callback, fired at each persistence choke point (save/saveStock/
 * saveIngredients). state.ts never imports the sync layer, so it stays clean and inert
 * logged-out and in tests; main.ts registers the callback only once a session is live.
 * applySyncState() deliberately does NOT fire it (a pulled change must not re-push). */
export type MutationKind = 'recipes' | 'stock' | 'ingredients' | 'profiles';
let onMutate: ((k: MutationKind) => void) | null = null;
export function setOnMutate(cb: ((k: MutationKind) => void) | null): void { onMutate = cb; }
function fireMutate(k: MutationKind): void { try { onMutate?.(k); } catch { /* sync errors never break a save */ } }

/** The current working recipe list = resolved seed with user overrides applied. */
export function deriveRecords(): Recipe[] {
  const base = resolveSeed(state.seedId);
  const ov = state.recipeOverrides;
  const out: Recipe[] = [];
  const seen = new Set<string>();
  for (const b of base) {
    const k = b.name.toLowerCase();
    seen.add(k);
    const o = ov[k];
    if (o?.removed) continue;
    if (o) out.push({ name: o.name ?? b.name, recipe: o.recipe ?? b.recipe, author: o.author ?? b.author, created: o.created ?? b.created, edited: o.edited ?? b.edited, recipeType: o.recipeType ?? b.recipeType, foodCat: o.foodCat ?? b.foodCat });
    else out.push(b);
  }
  // User additions: override keys not present in the base (and not tombstones).
  for (const [k, o] of Object.entries(ov)) {
    if (seen.has(k) || o.removed) continue;
    out.push({ name: o.name ?? k, recipe: o.recipe ?? '', author: o.author ?? '', created: o.created ?? '', edited: o.edited ?? '', recipeType: o.recipeType, foodCat: o.foodCat });
  }
  return out;
}

/** Diff the working list against a base seed into a persistable override map.
 *  Tombstones carry an `edited` timestamp so a deletion can compete in a sync merge.
 *  `prev` (the override map being replaced) lets an existing tombstone keep its original
 *  timestamp instead of re-minting on every save — otherwise tombstones would always
 *  look newest and win. A freshly-deleted recipe (no prior tombstone) is stamped now. */
export function diffRecords(records: Recipe[], base: Recipe[], prev: Record<string, RecipeOverride> = state.recipeOverrides): Record<string, RecipeOverride> {
  const baseMap = new Map(base.map(r => [r.name.toLowerCase(), r]));
  const ov: Record<string, RecipeOverride> = {};
  const present = new Set<string>();
  for (const r of records) {
    const k = r.name.toLowerCase();
    present.add(k);
    const b = baseMap.get(k);
    if (!b) ov[k] = { name: r.name, recipe: r.recipe, author: r.author, created: r.created, edited: r.edited, recipeType: r.recipeType, foodCat: r.foodCat }; // addition
    else if (r.recipe !== b.recipe || r.author !== b.author || r.name !== b.name || r.recipeType !== b.recipeType || r.foodCat !== b.foodCat) // edit
      ov[k] = { name: r.name, recipe: r.recipe, author: r.author, created: r.created, edited: r.edited, recipeType: r.recipeType, foodCat: r.foodCat };
  }
  for (const b of base) {
    const k = b.name.toLowerCase();
    if (present.has(k)) continue;
    const p = prev[k];
    ov[k] = { removed: true, edited: p?.removed && p.edited ? p.edited : nowISO() }; // removal
  }
  return ov;
}

export function load(): void {
  loadStock();
  loadIngredients();
  loadProfiles(); // after loadStock: first run migrates stockTs loc/pos into Home
  loadRecipeOverrides();
  state.seedTs = Number(localStorage.getItem(SEED_TS_KEY)) || 0;
  const seed = localStorage.getItem(SEED_KEY);
  if (seed) {
    state.seedId = seed;
    state.records = deriveRecords();
    return;
  }
  // No seed chosen yet — migrate a legacy flat store if present, else first run.
  const legacy = localStorage.getItem(KEY);
  if (legacy) {
    try {
      const recs = parseCSV(legacy);
      if (recs.length) {
        state.seedId = DEFAULT_SEED;
        localStorage.setItem(SEED_KEY, DEFAULT_SEED);
        state.records = recs;
        save(); // diff the old records against the default seed into overrides
        localStorage.removeItem(KEY);
        return;
      }
    } catch { /* fall through to first run */ }
  }
  // First run: leave seedId unset so main.ts forces the seed-choice modal.
  state.seedId = '';
  state.records = [];
}

/** Persist user recipe overrides as the diff of the working list vs the seed. */
export function save(): void {
  state.recipeOverrides = diffRecords(state.records, resolveSeed(state.seedId));
  localStorage.setItem(RECIPES_KEY, JSON.stringify(state.recipeOverrides));
  fireMutate('recipes');
}

/** Switch the active seed, re-deriving records so untouched base recipes track
 *  the new seed while the user's adds/edits/removals carry over. Caller renders.
 *  Stamps seedTs so the choice can win a sync merge; save() fires the mutate hook. */
export function switchSeed(id: string): void {
  state.seedId = id;
  state.seedTs = Date.now();
  localStorage.setItem(SEED_KEY, id);
  localStorage.setItem(SEED_TS_KEY, String(state.seedTs));
  state.records = deriveRecords();
  save();
}

export function loadRecipeOverrides(): void {
  try {
    const raw = localStorage.getItem(RECIPES_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object') state.recipeOverrides = obj;
  } catch { /* keep empty */ }
}

/** Factory reset: wipe all persisted state (recipes, ingredient edits, stock,
 *  and the seed choice) back to a clean install. Caller re-renders and forces
 *  the seed-choice modal, since seedId is now unset. */
export function resetAll(): void {
  for (const k of [KEY, STOCK_KEY, STOCK_TS_KEY, INGREDIENTS_KEY, SEED_KEY, SEED_TS_KEY, RECIPES_KEY, PROFILES_KEY, PROFILE_SEL_KEY]) localStorage.removeItem(k);
  state.stocked = new Set();
  state.stockTs = {};
  state.ingredients = {};
  state.recipeOverrides = {};
  state.seedId = '';
  state.seedTs = 0;
  state.records = [];
  state.profiles = { [HOME_ID]: makeHomeProfile() };
  state.profileId = CATEGORIES_ID;
}

/** True when the device holds user data beyond the bare on-startup seed — any recipe
 *  override, stocked item, or ingredient edit. Gates the destructive sign-in warning:
 *  signing in adopts the account's state exactly and discards whatever this returns. */
export function hasLocalData(): boolean {
  return Object.keys(state.recipeOverrides).length > 0
    || state.stocked.size > 0
    || Object.keys(state.ingredients).length > 0;
}

/** Snapshot the five user-state slices + their sync timestamps as a wire payload. */
export function buildSyncState(): SyncPayload {
  return {
    seedId: state.seedId,
    seedTs: state.seedTs,
    recipeOverrides: state.recipeOverrides,
    ingredients: state.ingredients,
    stockTs: state.stockTs,
    profiles: state.profiles,
  };
}

/** Replace all local user state with a payload (a merged or pulled snapshot) and persist
 *  it, WITHOUT firing the mutate hook — a pulled change must not bounce back as a push.
 *  Rebuilds derived records and the stocked Set; the caller reconciles stock and renders. */
export function applySyncState(p: SyncPayload): void {
  state.seedId = p.seedId;
  state.seedTs = p.seedTs;
  state.recipeOverrides = p.recipeOverrides ?? {};
  state.ingredients = p.ingredients ?? {};
  state.stockTs = p.stockTs ?? {};
  deriveStockSets();
  state.profiles = p.profiles ?? {};
  // A pre-profiles device's payload still carries stock loc/pos: ensure Home exists
  // and fold those legacy placements in (newer-ts only, so real placements win).
  if (!state.profiles[HOME_ID]) state.profiles[HOME_ID] = makeHomeProfile();
  foldLegacyPlacements(state.profiles[HOME_ID]!, state.stockTs);
  if (state.profileId !== CATEGORIES_ID && !(state.profiles[state.profileId] && !state.profiles[state.profileId]!.deleted))
    setCurrentProfile(CATEGORIES_ID);   // current selection was deleted on another device
  localStorage.setItem(SEED_KEY, state.seedId);
  localStorage.setItem(SEED_TS_KEY, String(state.seedTs));
  localStorage.setItem(RECIPES_KEY, JSON.stringify(state.recipeOverrides));
  localStorage.setItem(INGREDIENTS_KEY, JSON.stringify(state.ingredients));
  localStorage.setItem(STOCK_KEY, JSON.stringify([...state.stocked]));
  localStorage.setItem(STOCK_TS_KEY, JSON.stringify(state.stockTs));
  localStorage.setItem(PROFILES_KEY, JSON.stringify(state.profiles));
  state.records = deriveRecords();
}

/** Rebuild the runtime `stocked`/`pending` Sets from the shadow map (the richer
 *  representation): `on` ⇒ stocked, `pending` (and not `on`) ⇒ pending, else unstocked. */
function deriveStockSets(): void {
  state.stocked = new Set(Object.entries(state.stockTs).filter(([, e]) => e.on).map(([k]) => k));
  state.pending = new Set(Object.entries(state.stockTs).filter(([, e]) => !e.on && e.pending).map(([k]) => k));
}

/** Stocked ingredient keys, persisted separately from recipes. */
export function loadStock(): void {
  try {
    const raw = localStorage.getItem(STOCK_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) state.stocked = new Set(arr.filter((x): x is string => typeof x === 'string'));
    }
  } catch { /* keep empty set */ }
  loadStockTs();
  deriveStockSets();   // shadow map is authoritative; recovers pending too
}

/** Load the sync shadow map, migrating from the bare Set (legacy installs) when absent:
 *  each currently-stocked key gets {on:true, ts:0}, so it loads but loses to any genuine
 *  remote edit. */
function loadStockTs(): void {
  try {
    const raw = localStorage.getItem(STOCK_TS_KEY);
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === 'object') {
        const out: Record<string, StockEntry> = {};
        for (const [k, v] of Object.entries(obj as Record<string, Partial<StockEntry>>))
          if (v && typeof v.on === 'boolean') {
            const e: StockEntry = { on: v.on, ts: Number(v.ts) || 0 };
            if (v.pending) e.pending = true;
            if (typeof v.loc === 'string') e.loc = v.loc;
            if (typeof v.pos === 'number') e.pos = v.pos;
            out[k] = e;
          }
        state.stockTs = out;
        return;
      }
    }
  } catch { /* fall through to migration */ }
  state.stockTs = {};
  for (const k of state.stocked) state.stockTs[k] = { on: true, ts: 0 };
}

/** Reconcile the shadow map to the Set, stamping now for any key whose on-state changed.
 *  Centralising it here means every stock mutator (toggle, reconcileStock prune, import)
 *  keeps the shadow correct just by editing `state.stocked` and calling saveStock. */
function syncStockTs(): void {
  const now = Date.now();
  for (const k of state.stocked) { const e = state.stockTs[k]; if (!e?.on) state.stockTs[k] = { on: true, ts: now }; }
  for (const k of state.pending) { const e = state.stockTs[k]; if (e?.on || !e?.pending) state.stockTs[k] = { on: false, pending: true, ts: now }; }
  for (const [k, e] of Object.entries(state.stockTs))
    if ((e.on || e.pending) && !state.stocked.has(k) && !state.pending.has(k)) state.stockTs[k] = { on: false, ts: now };
}

export function saveStock(): void {
  syncStockTs();
  localStorage.setItem(STOCK_KEY, JSON.stringify([...state.stocked]));
  localStorage.setItem(STOCK_TS_KEY, JSON.stringify(state.stockTs));
  fireMutate('stock');
}

/** Does the current profile collapse the toggle to two states? The categories
 *  sentinel (and any missing profile) allows Pending. */
export function currentSkipPending(): boolean {
  return state.profiles[state.profileId]?.skipPending ?? false;
}

/** Advance one ingredient through the stock cycle on click. Full cycle (Pending allowed):
 *  stocked → unstocked → pending → stocked. Skip-pending (store) profiles: any non-stocked
 *  state → stocked, stocked → unstocked. */
export function cycleStock(key: string): void {
  const stocked = state.stocked.has(key), pending = state.pending.has(key);
  state.stocked.delete(key); state.pending.delete(key);
  if (currentSkipPending()) {
    if (!stocked) state.stocked.add(key);          // unstocked|pending → stocked; stocked → unstocked
  } else {
    if (stocked) { /* → unstocked */ }
    else if (pending) state.stocked.add(key);      // pending → stocked
    else state.pending.add(key);                   // unstocked → pending
  }
  saveStock();
}

/* ---- store profiles ----
 * Home + custom profiles, persisted as one map and synced (per-profile meta LWW,
 * per-placement LWW — see merge.ts). The current *selection* is a per-device view
 * preference: persisted so it survives reload, deliberately never synced. */

/** Load profiles, creating + migrating Home from the legacy stockTs loc/pos fields
 *  on the first run of this version (gated on the key's absence, so it can't
 *  double-migrate). Home is re-created if ever missing; the stored selection is
 *  dropped if it no longer points at a live profile. */
export function loadProfiles(): void {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === 'object') state.profiles = obj;
    } else {
      state.profiles = { [HOME_ID]: seedHomeFromStock(state.stockTs) };
      localStorage.setItem(PROFILES_KEY, JSON.stringify(state.profiles));
    }
  } catch { state.profiles = {}; }
  if (!state.profiles[HOME_ID]) state.profiles[HOME_ID] = makeHomeProfile();
  const sel = localStorage.getItem(PROFILE_SEL_KEY);
  const live = sel !== null && (sel === CATEGORIES_ID || (state.profiles[sel] && !state.profiles[sel].deleted));
  state.profileId = live ? sel! : CATEGORIES_ID;
}

export function saveProfiles(): void {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(state.profiles));
  fireMutate('profiles');
}

/** Create or replace a profile, stamping its meta `ts` so the edit wins a merge. */
export function upsertProfile(p: Profile): void {
  state.profiles[p.id] = { ...p, ts: Date.now() };
  saveProfiles();
}

/** Tombstone a custom profile (Home refuses), dropping its placements to keep the
 *  blob small; reselects Categories if it was current. */
export function deleteProfile(id: string): void {
  const p = state.profiles[id];
  if (!p || id === HOME_ID) return;
  state.profiles[id] = { ...p, deleted: true, ts: Date.now(), placements: {} };
  if (state.profileId === id) setCurrentProfile(CATEGORIES_ID);
  saveProfiles();
}

/** Assign placements within a profile (Location mode drag / profile import).
 *  Stamps a fresh ts on each so the placement wins a merge. Unlike the old
 *  stock placement this has no stocked-only gate: with hide-unstocked off,
 *  unstocked ingredients keep and change placement too. */
export function setProfilePlacement(profileId: string, updates: Array<{ key: string; cat: string; pos: number }>): void {
  const p = state.profiles[profileId];
  if (!p || p.deleted) return;
  const now = Date.now();
  for (const { key, cat, pos } of updates) p.placements[key] = { cat, pos, ts: now };
  saveProfiles();
}

/** Switch the ingredients-page profile. A view preference — no mutate fire. */
export function setCurrentProfile(id: string): void {
  state.profileId = id;
  localStorage.setItem(PROFILE_SEL_KEY, id);
}

/** Per-ingredient overrides, persisted separately from recipes and stock. */
export function loadIngredients(): void {
  try {
    const raw = localStorage.getItem(INGREDIENTS_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object') state.ingredients = obj;
  } catch { /* keep empty */ }
}

export function saveIngredients(): void {
  localStorage.setItem(INGREDIENTS_KEY, JSON.stringify(state.ingredients));
  fireMutate('ingredients');
}

/** Merge a patch into an ingredient's override (dropping keys set back to undefined),
 *  stamping `ts` for sync LWW. `ts` is sync bookkeeping, not content, so it's excluded
 *  from the emptiness test — an override that clears every real field is still deleted. */
export function setIngredientOverride(key: string, patch: IngredientOverride): void {
  const next: IngredientOverride = { ...state.ingredients[key], ...patch };
  for (const k of Object.keys(next) as (keyof IngredientOverride)[]) if (next[k] === undefined) delete next[k];
  delete next.ts;
  if (Object.keys(next).length) state.ingredients[key] = { ...next, ts: Date.now() };
  else delete state.ingredients[key];
  saveIngredients();
}

export function resetIngredientOverride(key: string): void {
  delete state.ingredients[key];
  saveIngredients();
}

export function derive(rec: Recipe): Derived {
  const p = parseLine(`${rec.name}: ${rec.recipe}`, rec.recipeType ?? 'cocktail')!;
  return { rec, p, base: baseSpirit(p), alc: estAlcoholOz(p) };
}
