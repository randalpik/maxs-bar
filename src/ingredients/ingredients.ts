import type { Form, Ingredient, Recipe } from '../core/types';
import { state, derive } from '../core/state';
import { iconFor } from './icons';
import { defaultLocationForCat } from './locations';
import { titleCase } from '../parser/parser';

/* ============================================================
   Ingredient catalog + stock matching

   Ingredients are never stored on recipes — they fall out of parsing. This module
   (a) derives a deduped, canonical catalog from a set of recipes via the parser
   (buildCatalog — used at build time by the seed generator and by tests), and
   (b) decides whether a recipe ingredient is "available" given the stocked set.

   Umbrellas, the new way: each catalog entry carries `umbrellas` — the parent ids
   it is a CHILD of (e.g. "Light rum" -> ["rum"]). A parent (e.g. "Rum") is an
   *effective generic*: it has children, so it's hidden from the stock list and a
   recipe asking for it matches when any child is stocked. The relationship is data,
   not a separate table; "active" umbrellas and hidden parents are just derivations
   over the `umbrellas` lists. Overlap is allowed — an ingredient can list several
   parents. (Citrus is the other kind: derivatives fold onto the fruit via
   ingredientKey, so stocking "Lemon" covers its juice/peel/wheel.)
   ============================================================ */

// The category taxonomy (single namespace, == display sections) lives in categories.ts;
// re-exported here so existing call sites keep importing from ingredients.ts.
export { CATEGORY_ORDER, CATEGORY_LABEL, SECTION_ORDER, SECTION_LABEL, CATEGORY_BY_ID, CATEGORIES } from './categories';
export type { CategoryDef } from './categories';
import { CATEGORY_BY_ID } from './categories';

/** The special umbrella marking an ingredient as consumable on its own. Unlike a real
 *  umbrella it isn't a matchable generic parent — it only bumps the ingredients-page
 *  use count by 1 and is skipped when picking an entry's visual cluster key. */
export const CONSUMABLE = 'consumable';

/** Stable identity for an ingredient. For citrus, this folds every derivative
 *  (juice, peel, wheel, twist) onto the fruit itself, so stocking "Lemon" covers
 *  them all. Otherwise it's the canonical display name, lowercased, with a
 *  trailing " juice" stripped. This is what the stocked set stores. */
export function ingredientKey(i: Ingredient): string {
  // The classifier's resolved key folds every form to one stock identity (lime juice/
  // wedge/peel → "lime"; egg white/yolk → "egg"). Unknowns carry no key, so fall back
  // to the display name (minus a trailing " juice").
  if (i.key) return i.key;
  return i.disp.toLowerCase().replace(/\s+juice$/, '');
}

/** Resolve the display name, colour and icon shape for a recipe-chip ingredient,
 *  applying the user's saved override (if any) over the parser-derived defaults. */
export function effectiveChip(i: Ingredient): { disp: string; color: string; shape: string | null } {
  const ov = state.ingredients[ingredientKey(i)];
  return {
    disp: ov?.disp ?? i.disp,
    color: ov?.color ?? i.color,
    shape: ov && ov.shape !== undefined ? ov.shape : iconFor(i),
  };
}

/** Umbrella parents a *user-added* ingredient belongs to. The category default (e.g.
 *  syrup→[syrup], bitters→[bitters]) comes from the category table; vermouth/chartreuse
 *  are name heuristics so a generic recipe ingredient matches when stocked. Spirits are
 *  intentionally omitted — a lone added spirit shouldn't satisfy every "spirit" call. */
export function umbrellasForCat(cat: string, disp: string): string[] {
  const d = disp.toLowerCase();
  if (/vermouth/.test(d)) return ['vermouth'];
  if (/chartreuse/.test(d)) return ['chartreuse'];
  return CATEGORY_BY_ID.get(cat)?.umbrellas ?? [];
}

export interface IngredientEntry {
  key: string;
  disp: string;
  cat: string;
  color: string;
  shape: string | null;
  /** Alcohol by volume (fraction 0–1), seed value with any user override applied. */
  abv: number;
  /** Parent umbrella ids this is a child of (for generic-match). */
  umbrellas: string[];
  /** Extra recipe-text names that resolve here (seed + user override). */
  aliases: string[];
  /** Effective trailing forms (explicit override/seed, else the category default).
   *  Surfaced so the modal can show & edit citrus's juice/wedge/peel mechanism. */
  forms?: Form[];
  /** Primary umbrella for stock-list visual clustering (umbrellas[0] or self). */
  umbrella: string;
  /** Effective default physical location (override ?? seed ?? category default). */
  defaultLoc: string;
  count: number;
}

export interface Catalog {
  entries: IngredientEntry[];
  /** Umbrella ids that have ≥1 child present (generic-match targets). */
  active: Set<string>;
}

/* ---- Build-time umbrella derivation (parser-based; used by buildCatalog/gen) ---- */

/** Names that can act as a generic umbrella term when a specific sibling exists. */
const UMBRELLA_NAMES = new Set(['rum', 'whiskey', 'brandy', 'tequila', 'vermouth', 'chartreuse', 'syrup', 'spirit', 'bitters']);

/** The umbrella "group" an ingredient classifies into (e.g. spirit:rum, syrup). */
function umbrellaGroup(i: Ingredient): string {
  if (i.cat === 'spirit') return 'spirit:' + (i.fam || '—');
  if (i.cat === 'syrup') return 'syrup';
  if (i.cat === 'bitters') return 'bitters';
  const d = i.disp.toLowerCase();
  if (/vermouth/.test(d)) return 'vermouth';
  if (/chartreuse/.test(d)) return 'chartreuse';
  return 'self:' + ingredientKey(i);
}

/** Build the deduped catalog from recipes via the parser, assigning each ingredient
 *  its umbrella parents. The full set is returned (generics included) — hiding the
 *  effective generics is the consumer's job (a parent is whatever appears in some
 *  entry's `umbrellas`). Edits/colours/shapes from the override store are applied. */
export function buildCatalog(records: Recipe[]): Catalog {
  const parsed = records.map(rec => derive(rec).p);

  // One representative parsed ingredient per stock key.
  const rep = new Map<string, Ingredient>();
  for (const p of parsed) for (const i of p.ingredients) {
    const key = ingredientKey(i);
    if (!rep.has(key)) rep.set(key, i);
  }

  // Group keys by umbrella group, then resolve each group's parent id and children.
  const byGroup = new Map<string, string[]>();
  for (const [key, i] of rep) {
    const g = umbrellaGroup(i);
    (byGroup.get(g) ?? byGroup.set(g, []).get(g)!).push(key);
  }
  const umbrellasByKey = new Map<string, string[]>();
  for (const [g, keys] of byGroup) {
    const named = keys.find(k => UMBRELLA_NAMES.has(k));     // explicit generic term, e.g. "rum"
    const parent = named ?? (keys.length >= 2 ? g : null);   // else a multi-member group (e.g. vermouth)
    if (!parent) continue;                                   // lone item -> no umbrella
    for (const k of keys) if (k !== parent) umbrellasByKey.set(k, [parent]);
  }

  const map = new Map<string, IngredientEntry>();
  for (const [key, i] of rep) {
    const citrus = i.cat === 'citrus';
    const shp = citrus ? 'circle' : iconFor(i);
    const ov = state.ingredients[key];
    const umbrellas = umbrellasByKey.get(key) ?? [];
    map.set(key, {
      key,
      disp: ov?.disp ?? (citrus ? titleCase(i.citrus!) : i.disp),
      cat: ov?.cat ?? i.cat,                                 // raw parser category
      color: ov?.color ?? i.color,
      shape: ov && ov.shape !== undefined ? ov.shape : shp,
      abv: ov?.abv ?? i.abv,
      umbrellas: ov?.umbrellas ?? umbrellas,
      aliases: ov?.aliases ?? [],
      umbrella: umbrellas[0] ?? 'self:' + key,
      defaultLoc: defaultLocationForCat(ov?.cat ?? i.cat),
      count: 0,
    });
  }

  // Usage counts (display only).
  for (const p of parsed) for (const i of p.ingredients) {
    const e = map.get(ingredientKey(i));
    if (e) e.count++;
  }

  const active = new Set<string>([...umbrellasByKey.values()].flat());
  return { entries: [...map.values()], active };
}

export interface StockCtx {
  stocked: Set<string>;
  stockedUmbrellas: Set<string>;
  pending: Set<string>;
  pendingUmbrellas: Set<string>;
  active: Set<string>;
  removed: Set<string>;
}

/** Precompute, for one render: the stocked/pending keys, the umbrella ids each covers
 *  (union of each entry's parents), and the removed keys (always render unstocked). */
export function buildStockCtx(cat: Catalog, stocked: Set<string>, pending: Set<string> = new Set()): StockCtx {
  const stockedUmbrellas = new Set<string>();
  const pendingUmbrellas = new Set<string>();
  for (const e of cat.entries) {
    if (stocked.has(e.key)) for (const u of e.umbrellas) stockedUmbrellas.add(u);
    if (pending.has(e.key)) for (const u of e.umbrellas) pendingUmbrellas.add(u);
  }
  const removed = new Set(Object.entries(state.ingredients).filter(([, o]) => o.removed).map(([k]) => k));
  return { stocked, stockedUmbrellas, pending, pendingUmbrellas, active: cat.active, removed };
}

/** A recipe ingredient is available if its exact item is stocked, or — for an
 *  effective generic (a key that is an active umbrella parent) — if any child is
 *  stocked. Removed ingredients are never available. Pending counts as NOT available. */
export function isAvailable(i: Ingredient, ctx: StockCtx): boolean {
  const key = ingredientKey(i);
  if (ctx.removed.has(key)) return false;
  if (ctx.stocked.has(key)) return true;
  if (ctx.active.has(key)) return ctx.stockedUmbrellas.has(key);
  return false;
}

export type ChipStatus = 'available' | 'pending' | 'missing';

/** Three-way status for a recipe-chip render: available (stocked), pending (tagged
 *  for purchase — not yet had), or missing. Mirrors isAvailable's exact/umbrella logic. */
export function chipStatus(i: Ingredient, ctx: StockCtx): ChipStatus {
  if (isAvailable(i, ctx)) return 'available';
  const key = ingredientKey(i);
  if (ctx.removed.has(key)) return 'missing';
  if (ctx.pending.has(key)) return 'pending';
  if (ctx.active.has(key)) return ctx.pendingUmbrellas.has(key) ? 'pending' : 'missing';
  return 'missing';
}

/** Distinct unstocked ingredients in a recipe, deduped by stock identity so e.g.
 *  lime juice + lime wedge (both folding to "lime") count once. */
export function missingCount(ings: Ingredient[], ctx: StockCtx): number {
  const missing = new Set<string>();
  for (const i of ings) if (!isAvailable(i, ctx)) missing.add(ingredientKey(i));
  return missing.size;
}
