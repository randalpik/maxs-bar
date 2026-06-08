import type { Classified, Recipe } from './types';
import { state, derive } from './state';
import { sentenceCase, titleCase, SPIRIT_FAMILIES } from './parser';
import { ingredientKey, umbrellasForCat } from './ingredients';
import type { Catalog, IngredientEntry } from './ingredients';
import { INGREDIENTS } from './ingredients-seed';
import type { SeedIngredient } from './ingredients-seed';

/* ============================================================
   Runtime catalog + classifier (seed-backed; no regex at runtime)

   Everything derives from the single committed INGREDIENTS list plus the user's
   overrides — the catalog is NOT re-derived from recipes. Recipe text is matched to
   the list by name; anything unrecognised falls back to a plain, icon-less chip.
   ============================================================ */

const FALLBACK_COLOR = '#8C857A';

/** key -> committed ingredient (incl. effective generics like "rum"). */
const byKey = new Map<string, SeedIngredient>(INGREDIENTS.map(i => [i.key, i]));

/** Recipe-text name -> key: identity, citrus juice/peel/wheel/… forms (derived from
 *  cat:"citrus"), and each ingredient's declared aliases. */
const aliasIndex = new Map<string, string>();
for (const ing of INGREDIENTS) {
  aliasIndex.set(ing.key, ing.key);
  for (const a of ing.aliases ?? []) aliasIndex.set(a.toLowerCase(), ing.key);
  if (ing.cat === 'citrus') for (const f of ['', ' juice', ' peel', ' wheel', ' twist', ' wedge', ' wedges']) aliasIndex.set((ing.key + f).trim(), ing.key);
}

/** Keys referenced as an umbrella parent = effective generics, hidden from the stock
 *  list and satisfied when any child is stocked. */
const HIDDEN = new Set<string>(INGREDIENTS.flatMap(i => i.umbrellas ?? []));

/** Stockable committed keys (everything that isn't an effective generic). */
export const SEED_KEYS = new Set(INGREDIENTS.filter(i => !HIDDEN.has(i.key)).map(i => i.key));
export const isSeedKey = (key: string): boolean => byKey.has(key);

/** A key already in use — by a committed ingredient (incl. generics) or a live add. */
export function isKnownKey(key: string): boolean {
  return byKey.has(key) || (key in state.ingredients && !state.ingredients[key]!.removed);
}

/** Base-spirit family of an ingredient: the first of [key, ...umbrellas] that is a
 *  recognised spirit family. So light rum (umbrella "rum") → rum, cachaça (umbrella
 *  "rum") → rum, a vermouth (umbrellas ["vermouth","wine"]) → wine, and the generic
 *  "rum"/"gin"/"wine" entries → themselves. fam is no longer stored — it's this view
 *  of the one umbrella hierarchy. */
export function familyOf(key: string, umbrellas: readonly string[] = []): string | undefined {
  return [key, ...umbrellas].find(u => SPIRIT_FAMILIES.includes(u));
}

/** Classify a recipe ingredient name from the committed list. Unknown names get a
 *  neutral, icon-less, sentence-cased result. */
export function seedClassify(name: string): Classified {
  const ing = byKey.get(aliasIndex.get(name.toLowerCase()) ?? '');
  if (!ing) return { cat: 'unknown', shape: '', color: FALLBACK_COLOR, abv: 0, disp: sentenceCase(name) };
  // A user abv override (keyed by the seed key, which is the stock identity for
  // seed ingredients) feeds the recipe alcohol estimate; other fields stay seed-
  // derived (disp/color/shape are layered for display in effectiveChip).
  const abv = state.ingredients[ing.key]?.abv ?? ing.abv;
  return { cat: ing.cat, shape: ing.shape ?? '', color: ing.color, abv, disp: ing.disp, fam: familyOf(ing.key, ing.umbrellas), syrup: ing.syrup, citrus: ing.citrus };
}

/** Build the stockable catalog from the committed list + user overrides, with usage
 *  counts from the current recipes. Effective generics are hidden; edits apply,
 *  removals drop, additions append. The display category is derived via sectionFor. */
export function runtimeCatalog(records: Recipe[]): Catalog {
  const map = new Map<string, IngredientEntry>();

  for (const s of INGREDIENTS) {
    if (HIDDEN.has(s.key)) continue;
    const ov = state.ingredients[s.key];
    if (ov?.removed) continue;
    const umbrellas = s.umbrellas ?? [];
    map.set(s.key, {
      key: s.key,
      disp: ov?.disp ?? s.disp,
      cat: ov?.cat ?? s.cat,                   // raw category (single stored namespace)
      color: ov?.color ?? s.color,
      shape: ov && ov.shape !== undefined ? ov.shape : s.shape,
      abv: ov?.abv ?? s.abv,
      umbrellas,
      umbrella: umbrellas[0] ?? 'self:' + s.key,
      count: 0,
    });
  }

  // User-added ingredients: override keys absent from the committed list (and not removed).
  for (const [key, ov] of Object.entries(state.ingredients)) {
    if (ov.removed || map.has(key) || byKey.has(key)) continue;
    const disp = ov.disp ?? titleCase(key);
    const cat = ov.cat ?? 'other';
    const umbrellas = umbrellasForCat(cat, disp);
    map.set(key, {
      key, disp, cat,
      color: ov.color ?? FALLBACK_COLOR,
      shape: ov.shape ?? null,
      abv: ov.abv ?? 0,
      umbrellas,
      umbrella: umbrellas[0] ?? 'self:' + key,
      count: 0,
    });
  }

  for (const rec of records)
    for (const i of derive(rec).p.ingredients) {
      const e = map.get(ingredientKey(i));
      if (e) e.count++;
    }

  const active = new Set<string>([...map.values()].flatMap(e => e.umbrellas));
  return { entries: [...map.values()], active };
}
