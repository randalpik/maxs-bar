/* Maintain src/ingredients-seed.ts — the canonical ingredient list shipped with the app.
 * Run: npm run gen:ingredients
 *
 * The parser RULES regex runs HERE (only here) to classify the ingredients used across the
 * recipe seed. The generator is APPEND-ONLY: it merges newly-seen recipe ingredients into
 * the existing list and never overwrites or removes what's already there. So you can
 * hand-add an ingredient (e.g. a shelf syrup no recipe calls for) directly in
 * ingredients-seed.ts and it survives regeneration. To re-sync an entry from the parser,
 * delete it there and re-run; to drop an ingredient, remove it there.
 *
 * The emitted INGREDIENTS list is the single source: stock list, recipe-chip classification,
 * aliases, and umbrella grouping are all derived from it at runtime (see catalog.ts). */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolveSeed } from '../src/seeds';
import { parseLine, classify } from '../src/parser';
import { buildCatalog, ingredientKey } from '../src/ingredients';
import * as seedMod from '../src/ingredients-seed';

interface SeedIngredient {
  key: string; disp: string; cat: string; color: string; shape: string | null; abv: number;
  fam?: string; syrup?: string; citrus?: string; aliases?: string[]; umbrellas?: string[];
}

// Canonical catalog is seeded from the full Max's List (Classics + Max's).
const recs = resolveSeed('maxs-list');

// Stockable/grouping data (key, disp, cat, color, shape, umbrellas) from the parser.
const cat = buildCatalog(recs);

// Per-key classification fields (abv/fam/syrup/citrus) + non-identity aliases. Citrus
// juice/peel/wheel forms are skipped — they're regenerated from cat:"citrus" at runtime.
const cls = new Map<string, { abv: number; fam?: string; syrup?: string; citrus?: string }>();
const aliasesByKey = new Map<string, Set<string>>();
for (const rec of recs) {
  const p = parseLine(`${rec.name}: ${rec.recipe}`)!;
  for (const i of p.ingredients) {
    const key = ingredientKey(i);
    const c = classify(i.name);
    if (!cls.has(key)) cls.set(key, { abv: c.abv, fam: c.fam, syrup: c.syrup, citrus: c.citrus });
    const name = i.name.toLowerCase();
    if (name === key) continue;
    const citrusForm = c.cat === 'citrus' && new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( juice| peel| wheel| twist| wedge| wedges)?$`).test(name);
    if (citrusForm) continue;
    (aliasesByKey.get(key) ?? aliasesByKey.set(key, new Set()).get(key)!).add(name);
  }
}

const derived: SeedIngredient[] = cat.entries.map(e => {
  const c = cls.get(e.key);
  const aliases = [...(aliasesByKey.get(e.key) ?? [])].sort();
  const out: SeedIngredient = { key: e.key, disp: e.disp, cat: e.cat, color: e.color, shape: e.shape, abv: c?.abv ?? 0 };
  if (c?.fam) out.fam = c.fam;
  if (c?.syrup) out.syrup = c.syrup;
  if (c?.citrus) out.citrus = c.citrus;
  if (aliases.length) out.aliases = aliases;
  if (e.umbrellas.length) out.umbrellas = e.umbrellas;
  return out;
});

// Append-only merge: existing entries (incl. hand-added) win; only new keys are added.
const prev = (seedMod as { INGREDIENTS?: SeedIngredient[] }).INGREDIENTS ?? [];
const byKey = new Map<string, SeedIngredient>(prev.map(e => [e.key, e]));
for (const ni of derived) if (!byKey.has(ni.key)) byKey.set(ni.key, ni);
const ingredients = [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));

const out = `// MAINTAINED by scripts/gen-ingredients.ts — run \`npm run gen:ingredients\`.
// Canonical ingredient list shipped with the app, and the SINGLE source for the stock list,
// recipe-chip classification, aliases, and umbrella grouping (all derived in catalog.ts).
// SAFE to hand-edit: the generator is append-only — it adds ingredients newly seen in recipes
// and never overwrites or removes existing entries. Hand-add a shelf ingredient (e.g. a syrup
// no recipe uses) here and it survives regeneration; to re-sync one from the parser, delete it.
//
//   cat      — parser category (drives icon default + stock grouping via displayCat)
//   aliases  — extra recipe-text names that resolve to this ingredient (identity + citrus
//              juice/peel/wheel forms are derived, so list only real shorthands here)
//   umbrellas— parent ids this is a CHILD of; a key referenced here is an effective generic,
//              hidden from the stock list and satisfied when any child is stocked (overlap ok)

export interface SeedIngredient {
  key: string;
  disp: string;
  cat: string;
  color: string;
  shape: string | null;
  abv: number;
  fam?: string;
  syrup?: string;
  citrus?: string;
  aliases?: string[];
  umbrellas?: string[];
}

export const INGREDIENTS: SeedIngredient[] = ${JSON.stringify(ingredients, null, 2)};
`;

const dest = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'ingredients-seed.ts');
writeFileSync(dest, out);
console.log(`Wrote ${dest}: ${ingredients.length} ingredients (${ingredients.filter(i => i.umbrellas).length} children, ${[...new Set(ingredients.flatMap(i => i.umbrellas ?? []))].length} umbrella parents).`);
