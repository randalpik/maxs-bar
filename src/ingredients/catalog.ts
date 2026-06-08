import type { Classified, Recipe } from '../core/types';
import { state, derive, saveStock } from '../core/state';
import { sentenceCase, titleCase, SPIRIT_FAMILIES } from '../parser/parser';
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

/** Umbrella parents offered in the edit modal's dropdown: the seed's existing parents
 *  plus every base-spirit family (so e.g. "spirit", "gin" are assignable even before any
 *  ingredient is a child of them — assigning a child then makes the parent an effective
 *  generic). New umbrella *names* still can't be invented in the UI. */
export const UMBRELLA_PARENTS: string[] = [...new Set([...HIDDEN, ...SPIRIT_FAMILIES])].sort();

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

/** Resolve a recipe-text name to a user-added/aliased ingredient key (not in the
 *  seed). Matches the override key directly, with a trailing " juice" stripped (as
 *  ingredientKey does), or any of the override's aliases. */
function resolveUserKey(lname: string): string | undefined {
  const stripped = lname.replace(/\s+juice$/, '');
  for (const [key, ov] of Object.entries(state.ingredients)) {
    if (ov.removed) continue;
    if (key === lname || key === stripped) return key;
    if (ov.aliases?.some(a => a.toLowerCase() === lname)) return key;
  }
  return undefined;
}

/** Classify a recipe ingredient name. A name resolves to a key via the seed index
 *  (key/alias/citrus form) or, failing that, a user override (added key or user alias).
 *  A seed key classifies from the committed entry (with overrides); a non-seed key from
 *  its override alone; anything unresolved is a neutral unknown. So user-added and
 *  user-aliased ingredients classify in recipe text just like seed ones. */
export function seedClassify(name: string): Classified {
  const lname = name.toLowerCase();
  const key = aliasIndex.get(lname) ?? resolveUserKey(lname);
  if (!key) return { cat: 'unknown', shape: '', color: FALLBACK_COLOR, abv: 0, disp: sentenceCase(name) };
  const ing = byKey.get(key);
  const ov = state.ingredients[key];
  if (ing) {
    // Seed ingredient. A user abv override feeds the alcohol estimate; a user umbrella
    // override flows into fam + matching. disp/color/shape stay seed-derived (display
    // overrides are layered in effectiveChip).
    return {
      cat: ing.cat, shape: ing.shape ?? '', color: ing.color, abv: ov?.abv ?? ing.abv,
      disp: ing.disp, fam: familyOf(key, ov?.umbrellas ?? ing.umbrellas),
      syrup: ing.syrup, citrus: ing.citrus,
    };
  }
  // User-added ingredient — classify from its override alone.
  const cat = ov!.cat ?? 'other';
  return {
    cat, shape: ov!.shape ?? '', color: ov!.color ?? FALLBACK_COLOR, abv: ov!.abv ?? 0,
    disp: ov!.disp ?? titleCase(key), fam: familyOf(key, ov!.umbrellas),
    citrus: cat === 'citrus' ? key : undefined,
  };
}

/** Build the stockable catalog from the committed list + user overrides, with usage
 *  counts from the current recipes. Effective generics are hidden; edits apply,
 *  removals drop, additions append. The display category is derived via sectionFor. */
export function runtimeCatalog(records: Recipe[]): Catalog {
  const map = new Map<string, IngredientEntry>();

  // Effective generics (hidden from the stock list) from the *live* umbrella graph
  // (seed lists + user overrides + added ingredients). Self-tag = concrete: a key is
  // hidden only when something OTHER than itself depends on it, so an ingredient that
  // lists its own family (e.g. gin → "gin", or tequila kept generic when mezcal is
  // added) stays visible while still acting as a parent.
  const refByOther = new Set<string>();   // key referenced as a parent by some other ingredient
  const selfTagged = new Set<string>();   // key that lists itself (declares it's concrete)
  const note = (key: string, umbs: string[]) => { for (const u of umbs) (u === key ? selfTagged : refByOther).add(u); };
  for (const s of INGREDIENTS) {
    const ov = state.ingredients[s.key];
    if (ov?.removed) continue;
    note(s.key, ov?.umbrellas ?? s.umbrellas ?? []);
  }
  for (const [key, ov] of Object.entries(state.ingredients)) {
    if (ov.removed || byKey.has(key)) continue;
    note(key, ov.umbrellas ?? umbrellasForCat(ov.cat ?? 'other', ov.disp ?? titleCase(key)));
  }
  const hidden = new Set([...refByOther].filter(k => !selfTagged.has(k)));

  for (const s of INGREDIENTS) {
    if (hidden.has(s.key)) continue;
    const ov = state.ingredients[s.key];
    if (ov?.removed) continue;
    const umbrellas = ov?.umbrellas ?? s.umbrellas ?? [];
    map.set(s.key, {
      key: s.key,
      disp: ov?.disp ?? s.disp,
      cat: ov?.cat ?? s.cat,                   // raw category (single stored namespace)
      color: ov?.color ?? s.color,
      shape: ov && ov.shape !== undefined ? ov.shape : s.shape,
      abv: ov?.abv ?? s.abv,
      umbrellas,
      aliases: ov?.aliases ?? s.aliases ?? [],
      umbrella: umbrellas[0] ?? 'self:' + s.key,
      count: 0,
    });
  }

  // User-added ingredients: override keys absent from the committed list (and not removed).
  for (const [key, ov] of Object.entries(state.ingredients)) {
    if (ov.removed || map.has(key) || byKey.has(key) || hidden.has(key)) continue;
    const disp = ov.disp ?? titleCase(key);
    const cat = ov.cat ?? 'other';
    const umbrellas = ov.umbrellas ?? umbrellasForCat(cat, disp);
    map.set(key, {
      key, disp, cat,
      color: ov.color ?? FALLBACK_COLOR,
      shape: ov.shape ?? null,
      abv: ov.abv ?? 0,
      umbrellas,
      aliases: ov.aliases ?? [],
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

/** Drop stock for any key that's no longer a stockable entry — e.g. an ingredient
 *  that became a hidden effective generic (its self-tag was removed, or another
 *  ingredient now lists it as an umbrella), was removed, or stopped being listed.
 *  Without this a hidden item keeps a stuck "stocked" state. Call after any change
 *  to ingredient definitions. Returns true if it pruned anything. */
export function reconcileStock(records: Recipe[]): boolean {
  const stockable = new Set(runtimeCatalog(records).entries.map(e => e.key));
  let changed = false;
  for (const k of [...state.stocked]) if (!stockable.has(k)) { state.stocked.delete(k); changed = true; }
  if (changed) saveStock();
  return changed;
}

/** The editable view of an ingredient for the modal: its catalog entry when shown, or
 *  — for a hidden seed generic (e.g. rum/syrup/spirit) — a synthesized entry from the
 *  seed + override, so the generic can be recoloured or self-tagged even though it
 *  isn't in the stock list. Undefined for unknown keys. */
export function editableEntry(key: string): IngredientEntry | undefined {
  const shown = runtimeCatalog(state.records).entries.find(e => e.key === key);
  if (shown) return shown;
  const s = byKey.get(key);
  if (!s) return undefined;
  const ov = state.ingredients[key];
  const umbrellas = ov?.umbrellas ?? s.umbrellas ?? [];
  return {
    key,
    disp: ov?.disp ?? s.disp,
    cat: ov?.cat ?? s.cat,
    color: ov?.color ?? s.color,
    shape: ov && ov.shape !== undefined ? ov.shape : s.shape,
    abv: ov?.abv ?? s.abv,
    umbrellas,
    aliases: ov?.aliases ?? s.aliases ?? [],
    umbrella: umbrellas[0] ?? 'self:' + key,
    count: 0,
  };
}
