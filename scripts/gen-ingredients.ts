/* Maintain src/ingredients-seed.ts — the canonical ingredient list shipped with the app.
 * Run: npm run gen:ingredients
 *
 * The parser RULES regex runs HERE (only here) to classify the ingredients used across the
 * recipe seed. The generator is APPEND-ONLY: it merges newly-seen recipe ingredients into
 * the existing seed and never overwrites or removes what's already there. So you can
 * hand-add an ingredient (e.g. a shelf syrup no recipe calls for) directly in
 * ingredients-seed.ts and it survives regeneration. To re-sync an entry from the parser,
 * delete it there and re-run; to drop an ingredient, remove it there.
 *
 * At runtime the app reads the emitted seed; it never re-derives the catalog from recipes. */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolveSeed } from '../src/seeds';
import { parseLine, classify } from '../src/parser';
import { buildCatalog, ingredientKey } from '../src/ingredients';
import { INGREDIENT_SEED, INGREDIENT_CLASS, INGREDIENT_ALIASES, ACTIVE_UMBRELLAS } from '../src/ingredients-seed';
import type { SeedEntry } from '../src/ingredients-seed';
import type { Classified } from '../src/types';

// Canonical ingredient catalog is seeded from the full Max's List (Classics + Max's).
const recs = resolveSeed('maxs-list');

/* ---- Derive structures from the recipes (the parser runs here) ---- */
const cat = buildCatalog(recs);
const derivedEntries: SeedEntry[] = cat.entries.map(e => ({ key: e.key, disp: e.disp, cat: e.cat, color: e.color, shape: e.shape, umbrella: e.umbrella }));

// Per-key classification (incl. generics like "rum"/"spirit") + a name -> key alias index.
const derivedClass: Record<string, Classified> = {};
const derivedAliases: Record<string, string> = {};
for (const rec of recs) {
  const p = parseLine(`${rec.name}: ${rec.recipe}`)!;
  for (const i of p.ingredients) {
    const key = ingredientKey(i);
    const c = classify(i.name); // strip the rule's `re` regex; keep only Classified fields
    derivedClass[key] = { cat: c.cat, shape: c.shape, color: c.color, abv: c.abv, disp: c.disp, fam: c.fam, syrup: c.syrup, citrus: c.citrus };
    derivedAliases[i.name.toLowerCase()] = key;
  }
}
// Expand common citrus garnish/juice forms so e.g. "lime peel" still matches even if only
// "lime wheel" appeared in the seed recipes.
for (const [key, c] of Object.entries(derivedClass)) {
  if (c.cat !== 'citrus') continue;
  for (const form of ['', ' juice', ' peel', ' wheel', ' twist', ' wedge', ' wedges']) derivedAliases[(key + form).trim()] = key;
}

/* ---- Append-only merge over the existing seed: existing wins, only new keys added ---- */
const seedByKey = new Map(INGREDIENT_SEED.map(e => [e.key, e]));
for (const e of derivedEntries) if (!seedByKey.has(e.key)) seedByKey.set(e.key, e);
const entries = [...seedByKey.values()].sort((a, b) => a.key.localeCompare(b.key));

const classMap: Record<string, Classified> = { ...INGREDIENT_CLASS };
for (const [k, v] of Object.entries(derivedClass)) if (!(k in classMap)) classMap[k] = v;

const aliasMap: Record<string, string> = { ...INGREDIENT_ALIASES };
for (const [k, v] of Object.entries(derivedAliases)) if (!(k in aliasMap)) aliasMap[k] = v;

const active = [...new Set([...ACTIVE_UMBRELLAS, ...cat.active])].sort();

const sortedClass = Object.fromEntries(Object.entries(classMap).sort((a, b) => a[0].localeCompare(b[0])));
const sortedAliases = Object.fromEntries(Object.entries(aliasMap).sort((a, b) => a[0].localeCompare(b[0])));

const out = `// MAINTAINED by scripts/gen-ingredients.ts — run \`npm run gen:ingredients\`.
// Canonical ingredient list shipped with the app. SAFE to hand-edit: the generator is
// append-only — it adds ingredients newly seen in recipes and never overwrites or removes
// existing entries. Hand-add a shelf ingredient (e.g. a syrup no recipe uses) here and it
// survives regeneration. To re-sync an entry from the parser, delete it and regenerate.
import type { Classified } from './types';

export interface SeedEntry {
  key: string;
  disp: string;
  cat: string;
  color: string;
  shape: string | null;
  umbrella: string;
}

/** Stockable catalog ingredients (effective generics excluded). */
export const INGREDIENT_SEED: SeedEntry[] = ${JSON.stringify(entries, null, 2)};

/** Classification per ingredient key (incl. generic umbrellas), used to render
 *  recipe chips at runtime without running the parser regex. */
export const INGREDIENT_CLASS: Record<string, Classified> = ${JSON.stringify(sortedClass, null, 2)};

/** Structural-name -> key index for matching recipe text to the catalog. */
export const INGREDIENT_ALIASES: Record<string, string> = ${JSON.stringify(sortedAliases, null, 2)};

/** Umbrella keys that have at least one specific member (generic-match targets). */
export const ACTIVE_UMBRELLAS: string[] = ${JSON.stringify(active, null, 2)};
`;

const dest = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'ingredients-seed.ts');
writeFileSync(dest, out);
console.log(`Wrote ${dest}: ${entries.length} entries, ${Object.keys(sortedClass).length} classes, ${Object.keys(sortedAliases).length} aliases, ${active.length} active umbrellas.`);
