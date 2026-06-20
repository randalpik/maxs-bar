import type { Classified, Form, ParseCtx, Recipe } from '../core/types';
import { state, derive, saveStock } from '../core/state';
import { sentenceCase, titleCase, SPIRIT_FAMILIES, BASE_UNITS, setUnits } from '../parser/parser';
import type { UnitDef } from '../core/types';
import { ingredientKey, umbrellasForCat, CONSUMABLE } from './ingredients';
import { CATEGORY_BY_ID, CATEGORIES } from './categories';
import { defaultLocationForCat } from './locations';
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

/** A category's default trailing forms (citrus juice/wedge/peel, bitters dash) — read
 *  straight from the category table. Garnish is never a category default (real garnishes
 *  declare it per-ingredient). An ingredient with explicit `forms` overrides this. */
function synthForms(cat: string): Form[] | undefined {
  return CATEGORY_BY_ID.get(cat)?.forms;
}

/** The no-override baseline forms for a key+category: explicit seed forms, else the
 *  category default, else the universal default (a bare oz pour). Used by the modal to
 *  decide whether the edited forms differ from the default (and so need storing). */
export function baselineForms(key: string | null, cat: string): Form[] {
  const seed = key ? byKey.get(key) : undefined;
  return seed?.forms ?? synthForms(cat) ?? [{ keyword: '', role: 'pour' }];
}

/** Migrate a legacy stored form: the old `role:'garnish'` (when garnish was a measure)
 *  becomes a bare `count` carrying the `garnish` process. Harmless for current forms. */
function normalizeForms(forms?: Form[]): Form[] | undefined {
  return forms?.map(f =>
    (f.role as string) === 'garnish' ? { ...f, role: 'count' as const, process: f.process ?? 'garnish' } : f);
}

/** The forms in effect for a key: explicit override forms, else explicit seed forms,
 *  else the category default. Drives the alias index and the classifier. */
function formsFor(cat: string, seedForms?: Form[], ovForms?: Form[]): Form[] | undefined {
  return normalizeForms(ovForms) ?? seedForms ?? synthForms(cat);
}

/** Register a key's form keywords/aliases as "<key> <token>" → key, so every form of
 *  an ingredient (lime / lime juice / lime wedge / lime peel …) resolves to one key.
 *  Generalises the former hardcoded citrus loop — citrus synth reproduces it exactly. */
function indexForms(index: Map<string, string>, key: string, forms?: Form[]): void {
  for (const f of forms ?? [])
    for (const tok of [f.keyword, ...(f.aliases ?? [])])
      index.set((key + ' ' + tok).trim(), key);
}

/** Recipe-text name -> key, one index per parse context. Built in precedence passes:
 *  identities, then unscoped aliases + form tokens, then context-scoped aliases — so a
 *  scoped alias deliberately shadows another entry's identity in its context (cocktail
 *  "honey" → honey syrup over the raw honey entry) without depending on seed order.
 *  Form tokens index unfiltered in both contexts (resolution is generous; the *forms a
 *  classification returns* are what get context-filtered). */
function buildAliasIndex(ctx: ParseCtx): Map<string, string> {
  const idx = new Map<string, string>();
  for (const ing of INGREDIENTS) idx.set(ing.key, ing.key);
  for (const ing of INGREDIENTS) {
    for (const a of ing.aliases ?? []) idx.set(a.toLowerCase(), ing.key);
    indexForms(idx, ing.key, formsFor(ing.cat, ing.forms));
  }
  for (const ing of INGREDIENTS)
    for (const a of (ctx === 'food' ? ing.foodAliases : ing.cocktailAliases) ?? [])
      idx.set(a.toLowerCase(), ing.key);
  return idx;
}
const ALIAS_INDEX: Record<ParseCtx, Map<string, string>> = {
  cocktail: buildAliasIndex('cocktail'),
  food: buildAliasIndex('food'),
};

/** The forms in effect in a parse context: scoped forms apply only in their own. */
function ctxForms(forms: Form[] | undefined, ctx: ParseCtx): Form[] | undefined {
  return forms?.filter(f => !f.ctx || f.ctx === ctx);
}

/** The full leading-unit registry the parser should recognise: the built-in base set
 *  plus every extra unit declared by any seed ingredient or live override (later id
 *  wins). Feeds setUnits at startup and after any ingredient edit, so a unit declared
 *  on one ingredient (e.g. bread → "slice") is recognised positionally everywhere. */
export function effectiveUnits(): UnitDef[] {
  const m = new Map<string, UnitDef>(BASE_UNITS.map(u => [u.id, u]));
  // Every unit a form references ("wedge","sprig","slice") registers as a discrete unit
  // (volOz null) — base wins on a name clash. This is the single source of count-units;
  // declaring one in a form's "counts as" makes it recognised globally + positionally.
  const add = (forms?: Form[]) => {
    for (const f of forms ?? []) if (f.unit && !m.has(f.unit)) m.set(f.unit, { id: f.unit, volOz: null });
  };
  for (const c of CATEGORIES) add(c.forms);
  for (const ing of INGREDIENTS) add(ing.forms);
  for (const ov of Object.values(state.ingredients)) if (!ov.removed) add(ov.forms);
  return [...m.values()];
}

/** Re-derive and install the parser's recognised unit registry. Call after any change
 *  to ingredient definitions (edit, import, sync pull) so newly-declared units parse. */
export function refreshUnits(): void { setUnits(effectiveUnits()); }

/** Every key any seed ingredient lists as an umbrella parent (incl. self-references). */
const UMBRELLA_REFS = new Set<string>(INGREDIENTS.flatMap(i => i.umbrellas ?? []));

/** Effective generics hidden from the stock list: a key listed as a parent by some
 *  *other* ingredient and not self-tagged. A self-tagged key (e.g. gin, tequila) stays
 *  stockable while still acting as a parent — mirrors runtimeCatalog's "self-tag =
 *  concrete" rule, so SEED_KEYS matches what the catalog actually shows. */
const HIDDEN = ((): Set<string> => {
  const refByOther = new Set<string>(), selfTagged = new Set<string>();
  for (const i of INGREDIENTS) for (const u of i.umbrellas ?? []) (u === i.key ? selfTagged : refByOther).add(u);
  return new Set([...refByOther].filter(k => !selfTagged.has(k)));
})();

/** Umbrella parents offered in the edit modal's dropdown: every key already used as a
 *  parent (incl. self-tagged generics like "tequila") plus every base-spirit family (so
 *  e.g. "spirit", "gin" are assignable even before any ingredient is a child of them —
 *  assigning a child then makes the parent an effective generic). New umbrella *names*
 *  still can't be invented in the UI. */
export const UMBRELLA_PARENTS: string[] = [...new Set([...UMBRELLA_REFS, ...SPIRIT_FAMILIES])].sort();

/** Stockable committed keys (everything that isn't a hidden effective generic). */
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
 *  user-aliased ingredients classify in recipe text just like seed ones. The parse
 *  context picks the alias index and filters the returned forms (user aliases stay
 *  context-free). */
export function seedClassify(name: string, ctx: ParseCtx = 'cocktail'): Classified {
  const lname = name.toLowerCase();
  const key = ALIAS_INDEX[ctx].get(lname) ?? resolveUserKey(lname);
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
      syrup: ing.syrup, citrus: ing.citrus, key,
      forms: ctxForms(formsFor(ing.cat, ing.forms, ov?.forms), ctx),
    };
  }
  // User-added ingredient — classify from its override alone.
  const cat = ov!.cat ?? 'other';
  return {
    cat, shape: ov!.shape ?? '', color: ov!.color ?? FALLBACK_COLOR, abv: ov!.abv ?? 0,
    disp: ov!.disp ?? titleCase(key), fam: familyOf(key, ov!.umbrellas),
    citrus: cat === 'citrus' ? key : undefined, key,
    forms: ctxForms(formsFor(cat, undefined, ov!.forms), ctx),
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
      forms: formsFor(ov?.cat ?? s.cat, s.forms, ov?.forms),
      umbrella: umbrellas.filter(u => u !== CONSUMABLE)[0] ?? 'self:' + s.key,
      defaultLoc: ov?.defaultLocation ?? s.defaultLocation ?? defaultLocationForCat(ov?.cat ?? s.cat),
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
      forms: formsFor(cat, undefined, ov.forms),
      umbrella: umbrellas.filter(u => u !== CONSUMABLE)[0] ?? 'self:' + key,
      defaultLoc: ov.defaultLocation ?? defaultLocationForCat(cat),
      count: 0,
    });
  }

  for (const rec of records)
    for (const i of derive(rec).p.ingredients) {
      const e = map.get(ingredientKey(i));
      if (e) e.count++;
    }

  // The "consumable" umbrella isn't matched like a generic — it just adds one use
  // (consumable on its own) on top of any recipe usage.
  for (const e of map.values()) if (e.umbrellas.includes(CONSUMABLE)) e.count++;

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
  for (const k of [...state.pending]) if (!stockable.has(k)) { state.pending.delete(k); changed = true; }
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
    forms: formsFor(ov?.cat ?? s.cat, s.forms, ov?.forms),
    umbrella: umbrellas.filter(u => u !== CONSUMABLE)[0] ?? 'self:' + key,
    defaultLoc: ov?.defaultLocation ?? s.defaultLocation ?? defaultLocationForCat(ov?.cat ?? s.cat),
    count: 0,
  };
}
