import type { Ingredient, Recipe } from './types';
import { state, derive } from './state';
import { iconFor } from './icons';
import { titleCase } from './parser';

/* ============================================================
   Ingredient catalog + stock matching

   Ingredients are never stored — they fall out of parsing recipes.
   This module derives a canonical, deduped list of the ingredients
   used across all recipes, and decides whether a given recipe
   ingredient is "available" given the user's stocked set.
   ============================================================ */

/* Two kinds of umbrella:
 *  - Generic umbrellas (UMBRELLA_NAMES below): the generic term is HIDDEN from the
 *    stock list and its specific members are shown; a recipe asking for the generic
 *    matches if any member is stocked. e.g. "Rum" hidden, "Light rum"/"Dark rum" shown.
 *  - Ingredient-side umbrellas (citrus): the parent is SHOWN and its members are
 *    HIDDEN — one stockable item that guarantees its derivatives. e.g. stocking
 *    "Lemon" covers lemon juice, peel and wheel. Handled by `ingredientKey` folding. */

/** Names that *can* act as generic umbrella terms. Whether a given one actually
 *  behaves as an umbrella depends on the data: it's only generic if a specific
 *  member of its family also appears in the recipes (see `buildCatalog`'s `active`).
 *  e.g. "Tequila" has no sub-types here, so it's just a stockable ingredient. */
export const UMBRELLA_NAMES = new Set(['rum', 'whiskey', 'brandy', 'tequila', 'vermouth', 'chartreuse', 'syrup', 'spirit', 'bitters']);

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

/** Broader family used for generic→family matching. */
export function umbrellaKey(i: Ingredient): string {
  if (i.cat === 'spirit') return 'spirit:' + (i.fam || '—');
  if (i.cat === 'syrup') return 'syrup';
  if (i.cat === 'bitters') return 'bitters';
  const d = i.disp.toLowerCase();
  if (/vermouth/.test(d)) return 'vermouth';
  if (/chartreuse/.test(d)) return 'chartreuse';
  return 'self:' + ingredientKey(i);
}

/** Umbrella for a *user-added* ingredient, derived from its catalog category so a
 *  generic recipe ingredient (e.g. "syrup") matches when this is stocked. Mirrors the
 *  umbrella names umbrellaKey() assigns, but from the category the user picked. Spirits
 *  stay self-scoped — we capture no family when adding, so a lone added spirit shouldn't
 *  blanket-satisfy every recipe calling for the generic "spirit". */
export function umbrellaForAdd(key: string, cat: string, disp: string): string {
  if (cat === 'syrup') return 'syrup';
  if (cat === 'bitters') return 'bitters';
  const d = disp.toLowerCase();
  if (/vermouth/.test(d)) return 'vermouth';
  if (/chartreuse/.test(d)) return 'chartreuse';
  return 'self:' + key;
}

/** Catalog category for an ingredient — regroups a few parser categories for the
 *  stock list without touching the parser: extracts split out, cranberry/pomegranate/
 *  pineapple juices treated as store-bought mixers, herbs+spices and dairy+egg merged. */
export function displayCat(i: Ingredient): string {
  if (/extract/i.test(i.disp)) return 'extract';
  const key = ingredientKey(i);
  if (i.cat === 'fruit' && (key === 'cranberry' || key === 'pomegranate' || key === 'pineapple')) return 'mixer';
  if (i.cat === 'soda') return 'mixer';
  if (i.cat === 'herb' || i.cat === 'spice') return 'herbspice';
  if (i.cat === 'dairy' || i.cat === 'egg') return 'dairyegg';
  return i.cat;
}

/** True when this ingredient's name *could* be an umbrella (e.g. plain "Rum").
 *  Use `isGeneric` for whether it actually behaves as one given the data. */
export function isUmbrellaName(i: Ingredient): boolean {
  return UMBRELLA_NAMES.has(ingredientKey(i));
}

/** True when this ingredient actually functions as an umbrella: it has an
 *  umbrella name AND a specific member of its family exists in the recipes. */
export function isGeneric(i: Ingredient, active: Set<string>): boolean {
  return isUmbrellaName(i) && active.has(umbrellaKey(i));
}

export interface IngredientEntry {
  key: string;
  disp: string;
  cat: string;
  color: string;
  shape: string | null;
  umbrella: string;
  count: number;
}

export interface Catalog {
  entries: IngredientEntry[];
  /** Umbrella keys that have ≥1 specific (non-umbrella-name) member present. */
  active: Set<string>;
}

/** Build the deduped, canonical ingredient catalog from the recipes.
 *  Effective generics (an umbrella name that has specific members, e.g. "Rum"
 *  when "Light rum" also appears) are excluded — they're matching targets, not
 *  stockable items. An umbrella name with no specific members (e.g. "Tequila")
 *  is kept as a normal stockable ingredient. */
export function buildCatalog(records: Recipe[]): Catalog {
  const parsed = records.map(rec => derive(rec).p);

  // Pass 1: an umbrella is "active" only if a specific member appears.
  const active = new Set<string>();
  for (const p of parsed)
    for (const i of p.ingredients)
      if (!isUmbrellaName(i)) active.add(umbrellaKey(i));

  // Pass 2: dedupe stockable ingredients, dropping effective generics.
  const map = new Map<string, IngredientEntry>();
  for (const p of parsed) {
    for (const i of p.ingredients) {
      if (isGeneric(i, active)) continue;
      const key = ingredientKey(i);
      const citrus = i.cat === 'citrus';
      // Citrus shows the bare fruit (its derivatives all fold onto this key) and
      // always carries the fruit icon even if first seen as an icon-less garnish.
      const shp = citrus ? 'circle' : iconFor(i);
      const ex = map.get(key);
      if (ex) { ex.count++; if (!ex.shape && shp) ex.shape = shp; continue; }
      const ov = state.ingredients[key];
      map.set(key, {
        key,
        // Citrus folds to the bare fruit; other fruits keep "juice" so e.g.
        // "Cranberry juice" reads distinctly from the sodas beside it in Mixers.
        disp: ov?.disp ?? (citrus ? titleCase(i.citrus!) : i.disp),
        cat: ov?.cat ?? displayCat(i),
        color: ov?.color ?? i.color,
        shape: ov && ov.shape !== undefined ? ov.shape : shp,
        umbrella: umbrellaKey(i),
        count: 1,
      });
    }
  }
  return { entries: [...map.values()], active };
}

export interface StockCtx {
  stocked: Set<string>;
  stockedUmbrellas: Set<string>;
  active: Set<string>;
  removed: Set<string>;
}

/** Precompute, for one render, the stocked keys, the umbrellas they cover, and the
 *  set of removed ingredient keys (which always render unstocked). */
export function buildStockCtx(cat: Catalog, stocked: Set<string>): StockCtx {
  const stockedUmbrellas = new Set<string>();
  for (const e of cat.entries) if (stocked.has(e.key)) stockedUmbrellas.add(e.umbrella);
  const removed = new Set(Object.entries(state.ingredients).filter(([, o]) => o.removed).map(([k]) => k));
  return { stocked, stockedUmbrellas, active: cat.active, removed };
}

/** A recipe ingredient is available if its exact item is stocked, or — only for
 *  generics that actually function as umbrellas — if any family member is stocked.
 *  Removed ingredients are never available. */
export function isAvailable(i: Ingredient, ctx: StockCtx): boolean {
  const key = ingredientKey(i);
  if (ctx.removed.has(key)) return false;
  if (ctx.stocked.has(key)) return true;
  if (isGeneric(i, ctx.active)) return ctx.stockedUmbrellas.has(umbrellaKey(i));
  return false;
}

/** Distinct unstocked ingredients in a recipe, deduped by stock identity so e.g.
 *  lime juice + lime wedge (both folding to "lime") count once. */
export function missingCount(ings: Ingredient[], ctx: StockCtx): number {
  const missing = new Set<string>();
  for (const i of ings) if (!isAvailable(i, ctx)) missing.add(ingredientKey(i));
  return missing.size;
}
