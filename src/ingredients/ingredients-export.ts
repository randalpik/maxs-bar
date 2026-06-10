import { state } from '../core/state';
import { titleCase } from '../parser/parser';
import { SECTION_ORDER } from './ingredients';
import { INGREDIENTS } from './ingredients-seed';
import type { SeedIngredient } from './ingredients-seed';

/* ============================================================
   Seed-format ingredient export (pure; no DOM)

   Produces the user's ingredient overrides as a diff against the committed seed,
   so hand-created/edited entries can be reconciled into ingredients-seed.ts. The
   download wrapper lives in io.ts. Categories share a single (raw) namespace with
   the seed — the edit modal stores raw categories — so cat is compared directly.
   ============================================================ */

const FALLBACK_COLOR = '#8C857A';

function seedShape(seed: SeedIngredient | undefined, ov: { shape?: string | null }): string | null {
  return ov.shape !== undefined ? ov.shape : (seed?.shape ?? null);
}

/** Build a seed-format object from a seed entry + the user's override, in the
 *  canonical field order, omitting empty optionals. */
function mergedEntry(key: string, seed: SeedIngredient | undefined, ov: typeof state.ingredients[string]): SeedIngredient {
  const out: SeedIngredient = {
    key,
    disp: ov.disp ?? seed?.disp ?? titleCase(key),
    cat: ov.cat ?? seed?.cat ?? 'other',
    color: ov.color ?? seed?.color ?? FALLBACK_COLOR,
    shape: seedShape(seed, ov),
    abv: ov.abv ?? seed?.abv ?? 0,
  };
  // Preserve seed-only structured fields (not yet UI-editable); forward-compatible
  // with user-edited aliases/umbrellas once those land. (fam is derived from
  // umbrellas, so it's never emitted.)
  if (seed?.syrup) out.syrup = seed.syrup;
  if (seed?.citrus) out.citrus = seed.citrus;
  const aliases = ov.aliases ?? seed?.aliases;
  const umbrellas = ov.umbrellas ?? seed?.umbrellas;
  if (aliases?.length) out.aliases = aliases;
  if (umbrellas?.length) out.umbrellas = umbrellas;
  const forms = ov.forms ?? seed?.forms;
  if (forms?.length) out.forms = forms;
  return out;
}

/** An exported ingredient: a full entry for an addition, or just `key` + the
 *  changed fields for an edit (so the diff is clear at a glance). */
export type IngredientDiffEntry = { key: string } & Partial<Omit<SeedIngredient, 'key'>>;

/** For an edited seed ingredient, the key plus only the fields whose merged value
 *  differs from the seed (canonical field order). Returns null for a no-op edit. */
function sparseDiff(seed: SeedIngredient, m: SeedIngredient): IngredientDiffEntry | null {
  const out: IngredientDiffEntry = { key: m.key };
  let changed = false;
  if (m.disp !== seed.disp) { out.disp = m.disp; changed = true; }
  if (m.cat !== seed.cat) { out.cat = m.cat; changed = true; }
  if (m.color !== seed.color) { out.color = m.color; changed = true; }
  if ((m.shape ?? null) !== (seed.shape ?? null)) { out.shape = m.shape ?? null; changed = true; }
  if (m.abv !== seed.abv) { out.abv = m.abv; changed = true; }
  if (JSON.stringify(m.aliases ?? []) !== JSON.stringify(seed.aliases ?? [])) { out.aliases = m.aliases; changed = true; }
  if (JSON.stringify(m.umbrellas ?? []) !== JSON.stringify(seed.umbrellas ?? [])) { out.umbrellas = m.umbrellas; changed = true; }
  if (JSON.stringify(m.forms ?? []) !== JSON.stringify(seed.forms ?? [])) { out.forms = m.forms; changed = true; }
  return changed ? out : null;
}

/** The user's ingredient overrides as a seed-format diff: `ingredients` holds
 *  additions (full entries) and edits (key + only the changed fields), `removed`
 *  lists tombstoned seed keys. Only what differs from the seed is emitted. */
export function buildIngredientsExport(): { ingredients: IngredientDiffEntry[]; removed: string[] } {
  const seedByKey = new Map(INGREDIENTS.map(i => [i.key, i]));
  // Carry the full merged entry alongside the (possibly sparse) output entry so we
  // can still sort by section + display name even when the output omits cat/disp.
  const rows: { sec: string; disp: string; entry: IngredientDiffEntry }[] = [];
  const removed: string[] = [];
  for (const [key, ov] of Object.entries(state.ingredients)) {
    const seed = seedByKey.get(key);
    if (ov.removed) { if (seed) removed.push(key); continue; }
    const m = mergedEntry(key, seed, ov);
    const entry = seed ? sparseDiff(seed, m) : m;   // edit → sparse; addition → full entry
    if (!entry) continue;                           // no-op edit
    rows.push({ sec: m.cat, disp: m.disp, entry });
  }
  const ord = (c: string) => { const i = SECTION_ORDER.indexOf(c); return i < 0 ? 99 : i; };
  rows.sort((a, b) => ord(a.sec) - ord(b.sec) || a.disp.localeCompare(b.disp));
  removed.sort();
  return { ingredients: rows.map(r => r.entry), removed };
}
