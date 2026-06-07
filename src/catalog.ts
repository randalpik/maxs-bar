import type { Classified, Recipe } from './types';
import { state, derive } from './state';
import { sentenceCase, titleCase } from './parser';
import { ingredientKey, umbrellaForAdd } from './ingredients';
import type { Catalog, IngredientEntry } from './ingredients';
import { INGREDIENT_CLASS, INGREDIENT_ALIASES, INGREDIENT_SEED, ACTIVE_UMBRELLAS } from './ingredients-seed';

/* ============================================================
   Runtime catalog + classifier (seed-backed; no regex at runtime)

   The ingredient catalog is the committed seed plus the user's overrides
   (edits, additions, removals) — it is NOT re-derived from recipes. Recipe
   text is matched to the seed by name; anything unrecognised falls back to a
   plain, icon-less, sentence-cased chip.
   ============================================================ */

const ACTIVE = new Set(ACTIVE_UMBRELLAS);
const FALLBACK_COLOR = '#8C857A';

/** Keys defined by the committed seed (stockable entries). */
export const SEED_KEYS = new Set(INGREDIENT_SEED.map(e => e.key));
export const isSeedKey = (key: string): boolean => SEED_KEYS.has(key);

/** A key already in use — by a seed/generic classification or a user addition.
 *  Used to block adding a duplicate ingredient. */
export function isKnownKey(key: string): boolean {
  return key in INGREDIENT_CLASS || (key in state.ingredients && !state.ingredients[key]!.removed);
}

/** Classify a recipe ingredient name from the precomputed seed instead of the
 *  regex table. Unknown names get a neutral, icon-less, sentence-cased result. */
export function seedClassify(name: string): Classified {
  const key = INGREDIENT_ALIASES[name.toLowerCase()];
  const c = key ? INGREDIENT_CLASS[key] : undefined;
  if (c) return c;
  return { cat: 'unknown', shape: '', color: FALLBACK_COLOR, abv: 0, disp: sentenceCase(name) };
}

/** Build the stockable catalog from the seed + user overrides, with usage counts
 *  tallied from the current recipes. Edits apply, removals drop, additions append. */
export function runtimeCatalog(records: Recipe[]): Catalog {
  const map = new Map<string, IngredientEntry>();

  // Seed entries with edits applied; removed ones dropped.
  for (const s of INGREDIENT_SEED) {
    const ov = state.ingredients[s.key];
    if (ov?.removed) continue;
    map.set(s.key, {
      key: s.key,
      disp: ov?.disp ?? s.disp,
      cat: ov?.cat ?? s.cat,
      color: ov?.color ?? s.color,
      shape: ov && ov.shape !== undefined ? ov.shape : s.shape,
      umbrella: s.umbrella,
      count: 0,
    });
  }

  // User-added ingredients: override keys absent from the seed (and not removed).
  for (const [key, ov] of Object.entries(state.ingredients)) {
    if (ov.removed || map.has(key)) continue;
    const disp = ov.disp ?? titleCase(key);
    const cat = ov.cat ?? 'other';
    map.set(key, {
      key,
      disp,
      cat,
      color: ov.color ?? FALLBACK_COLOR,
      shape: ov.shape ?? null,
      umbrella: umbrellaForAdd(key, cat, disp),
      count: 0,
    });
  }

  // Usage counts from the recipes (display only — not part of catalog identity).
  for (const rec of records)
    for (const i of derive(rec).p.ingredients) {
      const e = map.get(ingredientKey(i));
      if (e) e.count++;
    }

  return { entries: [...map.values()], active: ACTIVE };
}
