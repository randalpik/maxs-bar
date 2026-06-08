import type { Recipe, Derived, IngredientOverride, RecipeOverride, StockEntry, SyncPayload } from './types';
import { parseLine, baseSpirit, estAlcoholOz } from '../parser/parser';
import { parseCSV } from '../parser/csv';
import { resolveSeed, DEFAULT_SEED } from '../recipes/seeds';
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

/** Shared, mutable app state — replaces the prototype's module-level globals. */
export const state: {
  records: Recipe[];
  /** Chosen recipe seed id; '' until the user picks one (forces the seed modal). */
  seedId: string;
  mode: 'group' | 'sort';
  key: string;
  query: string;
  page: 'recipes' | 'ingredients' | 'syrups';
  stocked: Set<string>;
  /** Sync-only shadow of `stocked`: per-key {on,ts} so an un-stock can win a merge.
   *  Kept in lockstep with the Set by the stock mutators; not read by the UI. */
  stockTs: Record<string, StockEntry>;
  /** Per-ingredient edits, keyed by ingredientKey; layered over parser defaults. */
  ingredients: Record<string, IngredientOverride>;
  /** User recipe diffs vs the resolved seed, keyed by lowercased name. */
  recipeOverrides: Record<string, RecipeOverride>;
  /** Epoch-ms the seed was last chosen (sync LWW for the seedId scalar). */
  seedTs: number;
} = {
  records: [],
  seedId: '',
  mode: 'group',
  key: 'spirit',
  query: '',
  page: 'recipes',
  stocked: new Set(),
  stockTs: {},
  ingredients: {},
  recipeOverrides: {},
  seedTs: 0,
};

/** True once the user has chosen a seed (false on a fresh install). */
export function hasSeed(): boolean { return !!state.seedId; }

/* ---- mutation hook: the sync layer (when signed in) observes persisted changes ----
 * A single optional callback, fired at each persistence choke point (save/saveStock/
 * saveIngredients). state.ts never imports the sync layer, so it stays clean and inert
 * logged-out and in tests; main.ts registers the callback only once a session is live.
 * applySyncState() deliberately does NOT fire it (a pulled change must not re-push). */
export type MutationKind = 'recipes' | 'stock' | 'ingredients';
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
    if (o) out.push({ name: o.name ?? b.name, recipe: o.recipe ?? b.recipe, author: o.author ?? b.author, created: o.created ?? b.created, edited: o.edited ?? b.edited });
    else out.push(b);
  }
  // User additions: override keys not present in the base (and not tombstones).
  for (const [k, o] of Object.entries(ov)) {
    if (seen.has(k) || o.removed) continue;
    out.push({ name: o.name ?? k, recipe: o.recipe ?? '', author: o.author ?? '', created: o.created ?? '', edited: o.edited ?? '' });
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
    if (!b) ov[k] = { name: r.name, recipe: r.recipe, author: r.author, created: r.created, edited: r.edited }; // addition
    else if (r.recipe !== b.recipe || r.author !== b.author || r.name !== b.name) // edit
      ov[k] = { name: r.name, recipe: r.recipe, author: r.author, created: r.created, edited: r.edited };
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
  for (const k of [KEY, STOCK_KEY, STOCK_TS_KEY, INGREDIENTS_KEY, SEED_KEY, SEED_TS_KEY, RECIPES_KEY]) localStorage.removeItem(k);
  state.stocked = new Set();
  state.stockTs = {};
  state.ingredients = {};
  state.recipeOverrides = {};
  state.seedId = '';
  state.seedTs = 0;
  state.records = [];
}

/** True when the device holds user data beyond the bare on-startup seed — any recipe
 *  override, stocked item, or ingredient edit. Gates the destructive sign-in warning:
 *  signing in adopts the account's state exactly and discards whatever this returns. */
export function hasLocalData(): boolean {
  return Object.keys(state.recipeOverrides).length > 0
    || state.stocked.size > 0
    || Object.keys(state.ingredients).length > 0;
}

/** Snapshot the four user-state slices + their sync timestamps as a wire payload. */
export function buildSyncState(): SyncPayload {
  return {
    seedId: state.seedId,
    seedTs: state.seedTs,
    recipeOverrides: state.recipeOverrides,
    ingredients: state.ingredients,
    stockTs: state.stockTs,
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
  state.stocked = new Set(Object.entries(state.stockTs).filter(([, e]) => e.on).map(([k]) => k));
  localStorage.setItem(SEED_KEY, state.seedId);
  localStorage.setItem(SEED_TS_KEY, String(state.seedTs));
  localStorage.setItem(RECIPES_KEY, JSON.stringify(state.recipeOverrides));
  localStorage.setItem(INGREDIENTS_KEY, JSON.stringify(state.ingredients));
  localStorage.setItem(STOCK_KEY, JSON.stringify([...state.stocked]));
  localStorage.setItem(STOCK_TS_KEY, JSON.stringify(state.stockTs));
  state.records = deriveRecords();
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
          if (v && typeof v.on === 'boolean') out[k] = { on: v.on, ts: Number(v.ts) || 0 };
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
  for (const k of state.stocked) if (!state.stockTs[k]?.on) state.stockTs[k] = { on: true, ts: now };
  for (const [k, e] of Object.entries(state.stockTs)) if (e.on && !state.stocked.has(k)) state.stockTs[k] = { on: false, ts: now };
}

export function saveStock(): void {
  syncStockTs();
  localStorage.setItem(STOCK_KEY, JSON.stringify([...state.stocked]));
  localStorage.setItem(STOCK_TS_KEY, JSON.stringify(state.stockTs));
  fireMutate('stock');
}

export function toggleStock(key: string): void {
  if (state.stocked.has(key)) state.stocked.delete(key);
  else state.stocked.add(key);
  saveStock();
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
  const p = parseLine(`${rec.name}: ${rec.recipe}`)!;
  return { rec, p, base: baseSpirit(p), alc: estAlcoholOz(p) };
}
