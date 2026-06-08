import { state } from './state';
import { titleCase } from './parser';
import { CATEGORY_ORDER, displayCat } from './ingredients';
import { INGREDIENTS } from './ingredients-seed';
import type { SeedIngredient } from './ingredients-seed';

/* ============================================================
   Seed-format ingredient export (pure; no DOM)

   Produces the user's ingredient overrides as a diff against the committed seed,
   so hand-created/edited entries can be reconciled into ingredients-seed.ts. The
   download wrapper lives in io.ts. Note the category-namespace gap: the edit modal
   works in DISPLAY categories (mixer/herbspice/dairyegg) while the seed stores RAW
   categories (soda/herb/spice/dairy/egg) — so a seed entry's raw category is kept
   unless the user actually changed the display category in the modal.
   ============================================================ */

const FALLBACK_COLOR = '#8C857A';

function seedShape(seed: SeedIngredient | undefined, ov: { shape?: string | null }): string | null {
  return ov.shape !== undefined ? ov.shape : (seed?.shape ?? null);
}

/** Build a seed-format object from a seed entry + the user's override, in the
 *  canonical field order, omitting empty optionals. */
function mergedEntry(key: string, seed: SeedIngredient | undefined, ov: typeof state.ingredients[string]): SeedIngredient {
  const dispCatChanged = seed && ov.cat !== undefined && ov.cat !== displayCat(seed.cat, ov.disp ?? seed.disp, key);
  const out: SeedIngredient = {
    key,
    disp: ov.disp ?? seed?.disp ?? titleCase(key),
    cat: seed ? (dispCatChanged ? ov.cat! : seed.cat) : (ov.cat ?? 'other'),
    color: ov.color ?? seed?.color ?? FALLBACK_COLOR,
    shape: seedShape(seed, ov),
    abv: ov.abv ?? seed?.abv ?? 0,
  };
  // Preserve seed-only structured fields (not yet UI-editable); forward-compatible
  // with user-edited aliases/umbrellas once those land.
  if (seed?.fam) out.fam = seed.fam;
  if (seed?.syrup) out.syrup = seed.syrup;
  if (seed?.citrus) out.citrus = seed.citrus;
  const aliases = (ov as { aliases?: string[] }).aliases ?? seed?.aliases;
  const umbrellas = (ov as { umbrellas?: string[] }).umbrellas ?? seed?.umbrellas;
  if (aliases?.length) out.aliases = aliases;
  if (umbrellas?.length) out.umbrellas = umbrellas;
  return out;
}

/** True if the merged entry differs from the seed entry on any persisted field
 *  (category compared in display space, since that's where the modal edits). */
function differsFromSeed(seed: SeedIngredient, m: SeedIngredient): boolean {
  const dispCat = displayCat(seed.cat, seed.disp, seed.key);
  return m.disp !== seed.disp
    || (m.cat !== seed.cat && m.cat !== dispCat)
    || m.color !== seed.color
    || (m.shape ?? null) !== (seed.shape ?? null)
    || m.abv !== seed.abv
    || JSON.stringify(m.aliases ?? []) !== JSON.stringify(seed.aliases ?? [])
    || JSON.stringify(m.umbrellas ?? []) !== JSON.stringify(seed.umbrellas ?? []);
}

/** The user's ingredient overrides as a seed-format diff: `ingredients` holds added +
 *  edited entries (a paste-able SeedIngredient[]), `removed` lists tombstoned seed keys.
 *  Only what differs from the seed is emitted. */
export function buildIngredientsExport(): { ingredients: SeedIngredient[]; removed: string[] } {
  const seedByKey = new Map(INGREDIENTS.map(i => [i.key, i]));
  const ingredients: SeedIngredient[] = [];
  const removed: string[] = [];
  for (const [key, ov] of Object.entries(state.ingredients)) {
    const seed = seedByKey.get(key);
    if (ov.removed) { if (seed) removed.push(key); continue; }
    const m = mergedEntry(key, seed, ov);
    if (!seed) ingredients.push(m);                          // added ingredient
    else if (differsFromSeed(seed, m)) ingredients.push(m);  // edited seed ingredient
  }
  const ord = (c: string) => { const i = CATEGORY_ORDER.indexOf(c); return i < 0 ? 99 : i; };
  ingredients.sort((a, b) => ord(displayCat(a.cat, a.disp, a.key)) - ord(displayCat(b.cat, b.disp, b.key)) || a.disp.localeCompare(b.disp));
  removed.sort();
  return { ingredients, removed };
}
