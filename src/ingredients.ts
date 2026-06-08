import type { Ingredient, Recipe } from './types';
import { state, derive } from './state';
import { iconFor } from './icons';
import { titleCase } from './parser';

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

export const CATEGORY_ORDER = ['spirit', 'liqueur', 'fortified', 'syrup', 'citrus', 'fruit', 'mixer', 'bitters', 'extract', 'herbspice', 'sugar', 'dairyegg', 'other'];
export const CATEGORY_LABEL: Record<string, string> = {
  spirit: 'Spirits', liqueur: 'Liqueurs', fortified: 'Wines', syrup: 'Syrups',
  citrus: 'Citrus', fruit: 'Fruit', mixer: 'Mixers', bitters: 'Bitters',
  extract: 'Extracts', herbspice: 'Herbs & spices', sugar: 'Sugar',
  dairyegg: 'Dairy & egg', other: 'Other',
};

/** Stable identity for an ingredient. For citrus, this folds every derivative
 *  (juice, peel, wheel, twist) onto the fruit itself, so stocking "Lemon" covers
 *  them all. Otherwise it's the canonical display name, lowercased, with a
 *  trailing " juice" stripped. This is what the stocked set stores. */
export function ingredientKey(i: Ingredient): string {
  if (i.cat === 'citrus' && i.citrus) return i.citrus;
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

/** Catalog (display) category — regroups a few parser categories for the stock
 *  list without touching the parser: extracts split out, cranberry/pomegranate/
 *  pineapple juices treated as store-bought mixers, herbs+spices and dairy+egg
 *  merged. Operates on the raw parser category + display name + stock key. */
export function displayCat(cat: string, disp: string, key: string): string {
  if (/extract/i.test(disp)) return 'extract';
  if (cat === 'fruit' && (key === 'cranberry' || key === 'pomegranate' || key === 'pineapple')) return 'mixer';
  if (cat === 'soda') return 'mixer';
  if (cat === 'herb' || cat === 'spice') return 'herbspice';
  if (cat === 'dairy' || cat === 'egg') return 'dairyegg';
  return cat;
}

/** Umbrella parents a *user-added* ingredient belongs to, derived from its catalog
 *  category so a generic recipe ingredient (e.g. "syrup") matches when it's stocked.
 *  Spirits are intentionally omitted — no family is captured when adding, so a lone
 *  added spirit shouldn't blanket-satisfy every recipe calling for "spirit". */
export function umbrellasForCat(cat: string, disp: string): string[] {
  if (cat === 'syrup') return ['syrup'];
  if (cat === 'bitters') return ['bitters'];
  const d = disp.toLowerCase();
  if (/vermouth/.test(d)) return ['vermouth'];
  if (/chartreuse/.test(d)) return ['chartreuse'];
  return [];
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
  /** Primary umbrella for stock-list visual clustering (umbrellas[0] or self). */
  umbrella: string;
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
      umbrellas,
      umbrella: umbrellas[0] ?? 'self:' + key,
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
  active: Set<string>;
  removed: Set<string>;
}

/** Precompute, for one render: the stocked keys, the umbrella ids they cover (union
 *  of each stocked entry's parents), and the removed keys (always render unstocked). */
export function buildStockCtx(cat: Catalog, stocked: Set<string>): StockCtx {
  const stockedUmbrellas = new Set<string>();
  for (const e of cat.entries) if (stocked.has(e.key)) for (const u of e.umbrellas) stockedUmbrellas.add(u);
  const removed = new Set(Object.entries(state.ingredients).filter(([, o]) => o.removed).map(([k]) => k));
  return { stocked, stockedUmbrellas, active: cat.active, removed };
}

/** A recipe ingredient is available if its exact item is stocked, or — for an
 *  effective generic (a key that is an active umbrella parent) — if any child is
 *  stocked. Removed ingredients are never available. */
export function isAvailable(i: Ingredient, ctx: StockCtx): boolean {
  const key = ingredientKey(i);
  if (ctx.removed.has(key)) return false;
  if (ctx.stocked.has(key)) return true;
  if (ctx.active.has(key)) return ctx.stockedUmbrellas.has(key);
  return false;
}

/** Distinct unstocked ingredients in a recipe, deduped by stock identity so e.g.
 *  lime juice + lime wedge (both folding to "lime") count once. */
export function missingCount(ings: Ingredient[], ctx: StockCtx): number {
  const missing = new Set<string>();
  for (const i of ings) if (!isAvailable(i, ctx)) missing.add(ingredientKey(i));
  return missing.size;
}
