import type { Recipe, RecipeOverride, IngredientOverride } from './types';
import type { SeedIngredient } from './ingredients-seed';
import { state } from './state';
import { buildIngredientsExport } from './ingredients-export';

/* ============================================================
   Import / export transforms (pure — no DOM, localStorage or render).

   The canonical model for both recipes and ingredients is seed + overrides;
   exports are that override diff, imports fully replace the override layer.
   Every importer is the exact inverse of its exporter: import(file) followed by
   the paired export reproduces the same file (see transfer.test.ts).

   The DOM/persist/render wrappers live in io.ts.
   ============================================================ */

/* ---------- recipes (diff JSON) ---------- */

export interface RecipesExport {
  /** The seed the overrides are diffed against. */
  seed: string;
  /** Added + edited recipes (full record), name-sorted. */
  recipes: Recipe[];
  /** Lowercased names of tombstoned seed recipes, sorted. */
  removed: string[];
}

/** The user's recipe layer as a seed-relative diff. Reads state.recipeOverrides
 *  (already a genuine diff, maintained by save()). Field order is fixed so a
 *  round-trip is byte-stable. */
export function buildRecipesExport(): RecipesExport {
  const recipes: Recipe[] = [];
  const removed: string[] = [];
  for (const [k, o] of Object.entries(state.recipeOverrides)) {
    if (o.removed) { removed.push(k); continue; }
    recipes.push({ name: o.name ?? k, recipe: o.recipe ?? '', author: o.author ?? '', created: o.created ?? '', edited: o.edited ?? '' });
  }
  recipes.sort((a, b) => a.name.localeCompare(b.name));
  removed.sort();
  return { seed: state.seedId, recipes, removed };
}

/** Parse a recipes export into a fresh override map + seed (full replace). Returns
 *  the pieces; the io.ts wrapper persists them and re-derives records. */
export function parseRecipesImport(data: RecipesExport): { seed?: string; overrides: Record<string, RecipeOverride> } {
  const overrides: Record<string, RecipeOverride> = {};
  for (const r of data.recipes ?? []) {
    if (!r.name) continue;
    overrides[r.name.toLowerCase()] = { name: r.name, recipe: r.recipe ?? '', author: r.author ?? '', created: r.created ?? '', edited: r.edited ?? '' };
  }
  for (const k of data.removed ?? []) overrides[String(k).toLowerCase()] = { removed: true };
  const seed = typeof data.seed === 'string' && data.seed ? data.seed : undefined;
  return { seed, overrides };
}

/** Recognise our recipes-export JSON shape. */
export function isRecipesExport(v: unknown): v is RecipesExport {
  return !!v && typeof v === 'object' && Array.isArray((v as RecipesExport).recipes);
}

/* ---------- ingredients (seed-format diff JSON) ---------- */

export interface IngredientsExport {
  ingredients: SeedIngredient[];
  removed: string[];
}

/** Re-exported so io.ts has one import site for the whole transfer layer. */
export { buildIngredientsExport };

/** Parse an ingredients export into a fresh override map (full replace). The
 *  exported entries are full (merged) seed-format objects; storing their persisted
 *  fields as the override reproduces them on the next buildIngredientsExport. */
export function parseIngredientsImport(data: IngredientsExport): Record<string, IngredientOverride> {
  const out: Record<string, IngredientOverride> = {};
  for (const e of data.ingredients ?? []) {
    if (!e.key) continue;
    const ov: IngredientOverride = { disp: e.disp, cat: e.cat, color: e.color, shape: e.shape ?? null, abv: e.abv };
    if (e.aliases?.length) ov.aliases = e.aliases;
    if (e.umbrellas?.length) ov.umbrellas = e.umbrellas;
    out[e.key] = ov;
  }
  for (const k of data.removed ?? []) out[String(k)] = { removed: true };
  return out;
}

export function isIngredientsExport(v: unknown): v is IngredientsExport {
  return !!v && typeof v === 'object' && Array.isArray((v as IngredientsExport).ingredients);
}

/* ---------- stock list (flat key array) ---------- */

/** The stocked keys, sorted. A stock list is deliberately just a flat list of
 *  keys — syncing it touches every ingredient, unlike the scoped override diffs. */
export function buildStockExport(): string[] {
  return [...state.stocked].sort();
}

/** Reset everything to unstocked, then stock each listed key that exists in the
 *  current catalog — keys with no matching ingredient are ignored, so a stock list
 *  syncs cleanly across slightly different ingredient sets. */
export function parseStockImport(keys: unknown, known: Set<string>): Set<string> {
  const out = new Set<string>();
  if (Array.isArray(keys)) for (const k of keys) if (typeof k === 'string' && known.has(k)) out.add(k);
  return out;
}
