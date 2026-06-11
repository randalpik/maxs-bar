import type { Recipe, RecipeOverride, IngredientOverride, Profile } from '../core/types';
import { state } from '../core/state';
import { DEFAULT_FOOD_CAT } from '../recipes/food';
import { profileCats, isReservedCat } from '../profiles/profiles';
import { buildIngredientsExport, type IngredientDiffEntry } from '../ingredients/ingredients-export';

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
    const rec: Recipe = { name: o.name ?? k, recipe: o.recipe ?? '', author: o.author ?? '', created: o.created ?? '', edited: o.edited ?? '' };
    // Only food carries these — cocktail exports stay byte-identical.
    if (o.recipeType === 'food') { rec.recipeType = 'food'; rec.foodCat = o.foodCat ?? DEFAULT_FOOD_CAT; }
    recipes.push(rec);
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
    const ov: RecipeOverride = { name: r.name, recipe: r.recipe ?? '', author: r.author ?? '', created: r.created ?? '', edited: r.edited ?? '' };
    if (r.recipeType === 'food') { ov.recipeType = 'food'; ov.foodCat = r.foodCat ?? DEFAULT_FOOD_CAT; }
    overrides[r.name.toLowerCase()] = ov;
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
  ingredients: IngredientDiffEntry[];
  removed: string[];
}

/** Re-exported so io.ts has one import site for the whole transfer layer. */
export { buildIngredientsExport };

/** Parse an ingredients export into a fresh override map (full replace). Each entry
 *  carries only the fields it changed (additions carry everything), so we copy only
 *  the fields present — storing them as the override reproduces the entry on the
 *  next buildIngredientsExport. */
export function parseIngredientsImport(data: IngredientsExport): Record<string, IngredientOverride> {
  const out: Record<string, IngredientOverride> = {};
  for (const e of data.ingredients ?? []) {
    if (!e.key) continue;
    const ov: IngredientOverride = {};
    if ('disp' in e) ov.disp = e.disp;
    if ('cat' in e) ov.cat = e.cat;
    if ('color' in e) ov.color = e.color;
    if ('shape' in e) ov.shape = e.shape ?? null;
    if ('abv' in e) ov.abv = e.abv;
    if (e.aliases?.length) ov.aliases = e.aliases;
    if (e.umbrellas?.length) ov.umbrellas = e.umbrellas;
    if (e.forms?.length) ov.forms = e.forms;
    out[e.key] = ov;
  }
  for (const k of data.removed ?? []) out[String(k)] = { removed: true };
  return out;
}

export function isIngredientsExport(v: unknown): v is IngredientsExport {
  return !!v && typeof v === 'object' && Array.isArray((v as IngredientsExport).ingredients);
}

/* ---------- stock list (key array, optionally carrying location) ---------- */

/** One exported stocked ingredient: its key, plus its physical-location placement
 *  (loc + pos) when the user has placed it in Location mode. Bare `{key}` for items
 *  left at their default location. */
export interface StockExportEntry {
  key: string;
  loc?: string;
  pos?: number;
}

/** The stocked keys, sorted for a stable round-trip. Stock is global; placement
 *  lives in profiles now and travels via the profile export, so this no longer
 *  emits loc/pos (parseStockImport still reads them from old files). */
export function buildStockExport(): StockExportEntry[] {
  return [...state.stocked].sort().map(key => ({ key }));
}

/** Reset everything to unstocked, then stock each listed key that exists in the
 *  current catalog — keys with no matching ingredient are ignored, so a stock list
 *  syncs cleanly across slightly different ingredient sets. Accepts the object form
 *  and the legacy flat string[]; old-format entries carrying loc/pos come back as
 *  placements for the io.ts wrapper to fold into the Home profile. */
export function parseStockImport(
  data: unknown,
  known: Set<string>,
): { stocked: Set<string>; placements: Array<{ key: string; loc: string; pos: number }> } {
  const stocked = new Set<string>();
  const placements: Array<{ key: string; loc: string; pos: number }> = [];
  if (Array.isArray(data)) {
    for (const item of data) {
      if (typeof item === 'string') { if (known.has(item)) stocked.add(item); continue; }
      if (item && typeof item === 'object' && typeof (item as StockExportEntry).key === 'string') {
        const e = item as StockExportEntry;
        if (!known.has(e.key)) continue;
        stocked.add(e.key);
        if (typeof e.loc === 'string') placements.push({ key: e.key, loc: e.loc, pos: typeof e.pos === 'number' ? e.pos : 0 });
      }
    }
  }
  return { stocked, placements };
}

/* ---------- store profile (single profile JSON) ---------- */

/** One exported placement: which profile category an ingredient sits in and where. */
export interface ProfileExportPlacement {
  key: string;
  cat: string;
  pos: number;
}

/** A single profile: category names + order, the two view flags, and ingredient
 *  placements. Deliberately NO stock state (stock is global, not per-profile) and
 *  no id/timestamps (an import mints fresh ones). */
export interface ProfileExport {
  name: string;
  cats: string[];
  hideUnstocked: boolean;
  hideOther: boolean;
  placements: ProfileExportPlacement[];
}

/** Export a profile, placements sorted by (category order, position, key) for a
 *  stable, human-readable round-trip. */
export function buildProfileExport(p: Profile): ProfileExport {
  const placements: ProfileExportPlacement[] = Object.entries(p.placements)
    .map(([key, pl]) => ({ key, cat: pl.cat, pos: pl.pos }));
  const order = profileCats(p);
  const ci = (c: string) => { const i = order.indexOf(c); return i < 0 ? order.length : i; };
  placements.sort((a, b) => ci(a.cat) - ci(b.cat) || a.pos - b.pos || a.key.localeCompare(b.key));
  return { name: p.name, cats: [...p.cats], hideUnstocked: p.hideUnstocked, hideOther: p.hideOther, placements };
}

/** Parse a profile export: categories are free-form strings (deduped, reserved
 *  'other' dropped — it's implicit); placements whose ingredient the current
 *  catalog doesn't know are skipped, per the backlog. */
export function parseProfileImport(
  data: ProfileExport,
  known: Set<string>,
): { name: string; cats: string[]; hideUnstocked: boolean; hideOther: boolean; placements: ProfileExportPlacement[] } {
  const cats: string[] = [];
  for (const c of data.cats ?? []) {
    const s = String(c).trim();
    if (s && !isReservedCat(s) && !cats.some(x => x.toLowerCase() === s.toLowerCase())) cats.push(s);
  }
  const placements = (data.placements ?? [])
    .filter((pl): pl is ProfileExportPlacement =>
      !!pl && typeof pl === 'object' && typeof pl.key === 'string' && typeof pl.cat === 'string' && known.has(pl.key))
    .map(pl => ({ key: pl.key, cat: pl.cat, pos: typeof pl.pos === 'number' ? pl.pos : 0 }));
  const name = typeof data.name === 'string' && data.name.trim() ? data.name.trim() : 'Imported profile';
  return { name, cats, hideUnstocked: !!data.hideUnstocked, hideOther: !!data.hideOther, placements };
}

/** Recognise our profile-export JSON shape. */
export function isProfileExport(v: unknown): v is ProfileExport {
  return !!v && typeof v === 'object'
    && Array.isArray((v as ProfileExport).cats)
    && Array.isArray((v as ProfileExport).placements);
}
