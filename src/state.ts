import type { Recipe, Derived, IngredientOverride, RecipeOverride } from './types';
import { parseLine, baseSpirit, estAlcoholOz } from './parser';
import { parseCSV } from './csv';
import { resolveSeed, DEFAULT_SEED } from './seeds';

/* ============================================================
   State + storage
   ============================================================ */
/** Legacy flat-recipe store, read once for migration; no longer written. */
export const KEY = 'backbar.csv.v2';
export const STOCK_KEY = 'backbar.stock.v1';
export const INGREDIENTS_KEY = 'backbar.ingredients.v1';
export const SEED_KEY = 'backbar.seed.v1';
export const RECIPES_KEY = 'backbar.recipes.v1';

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
  /** Per-ingredient edits, keyed by ingredientKey; layered over parser defaults. */
  ingredients: Record<string, IngredientOverride>;
  /** User recipe diffs vs the resolved seed, keyed by lowercased name. */
  recipeOverrides: Record<string, RecipeOverride>;
} = {
  records: [],
  seedId: '',
  mode: 'group',
  key: 'spirit',
  query: '',
  page: 'recipes',
  stocked: new Set(),
  ingredients: {},
  recipeOverrides: {},
};

/** True once the user has chosen a seed (false on a fresh install). */
export function hasSeed(): boolean { return !!state.seedId; }

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

/** Diff the working list against a base seed into a persistable override map. */
export function diffRecords(records: Recipe[], base: Recipe[]): Record<string, RecipeOverride> {
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
  for (const b of base) if (!present.has(b.name.toLowerCase())) ov[b.name.toLowerCase()] = { removed: true }; // removal
  return ov;
}

export function load(): void {
  loadStock();
  loadIngredients();
  loadRecipeOverrides();
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
}

/** Switch the active seed, re-deriving records so untouched base recipes track
 *  the new seed while the user's adds/edits/removals carry over. Caller renders. */
export function switchSeed(id: string): void {
  state.seedId = id;
  localStorage.setItem(SEED_KEY, id);
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
  for (const k of [KEY, STOCK_KEY, INGREDIENTS_KEY, SEED_KEY, RECIPES_KEY]) localStorage.removeItem(k);
  state.stocked = new Set();
  state.ingredients = {};
  state.recipeOverrides = {};
  state.seedId = '';
  state.records = [];
}

/** Stocked ingredient keys, persisted separately from recipes. */
export function loadStock(): void {
  try {
    const raw = localStorage.getItem(STOCK_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) state.stocked = new Set(arr.filter((x): x is string => typeof x === 'string'));
  } catch { /* keep empty set */ }
}

export function saveStock(): void { localStorage.setItem(STOCK_KEY, JSON.stringify([...state.stocked])); }

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
}

/** Merge a patch into an ingredient's override (dropping keys set back to undefined). */
export function setIngredientOverride(key: string, patch: IngredientOverride): void {
  const next = { ...state.ingredients[key], ...patch };
  for (const k of Object.keys(next) as (keyof IngredientOverride)[]) if (next[k] === undefined) delete next[k];
  if (Object.keys(next).length) state.ingredients[key] = next;
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
