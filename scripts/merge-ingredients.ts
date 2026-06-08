/**
 * merge-ingredients — reconcile an exported ingredients.json into the seed.
 *
 *   npm run merge-ingredients [path/to/ingredients.json]   (default: ./ingredients.json)
 *
 * Takes the override-diff produced by the app's "Export ingredients" (a
 * { ingredients: SeedIngredient[], removed: string[] } file) and folds it into
 * src/ingredients-seed.ts: added entries are inserted, edited entries overwrite
 * by key, and `removed` keys are deleted. The INGREDIENTS array is fully
 * regenerated (existing entry order preserved, new entries appended key-sorted);
 * the hand-written header comment and the SeedIngredient interface are kept
 * verbatim. Inline comments *inside* the array are not preserved — re-add by hand
 * if needed. Run `npm run build` afterwards to type-check the result.
 *
 * Run via vite-node (handles the TS import + on-the-fly transpile).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { INGREDIENTS, type SeedIngredient } from '../src/ingredients-seed.ts';
import type { IngredientDiffEntry } from '../src/ingredients-export.ts';

const SEED_PATH = 'src/ingredients-seed.ts';
const MARKER = 'export const INGREDIENTS';

const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m',
};
const die = (msg: string): never => { console.error(`${c.red}✗ ${msg}${c.reset}`); process.exit(1); };

/* ---- read the export file ---- */
const jsonPath = process.argv[2] ?? 'ingredients.json';
if (!existsSync(jsonPath)) die(`No file at ${jsonPath}. Pass a path: npm run merge-ingredients -- ~/Downloads/ingredients.json`);

let payload: { ingredients?: IngredientDiffEntry[]; removed?: string[] } = {};
try { payload = JSON.parse(readFileSync(jsonPath, 'utf8')); }
catch (e) { die(`${jsonPath} is not valid JSON: ${(e as Error).message}`); }
if (!Array.isArray(payload.ingredients)) die(`${jsonPath} is not an ingredients export (missing "ingredients" array).`);

const incoming = payload.ingredients ?? [];
const removed = new Set(payload.removed ?? []);

/* ---- merge (by key) ---- */
const order = INGREDIENTS.map(e => e.key);                       // preserve existing order
const byKey = new Map<string, SeedIngredient>(INGREDIENTS.map(e => [e.key, e]));
const norm = (e: SeedIngredient) => JSON.stringify(e, Object.keys(e).sort());

const added: string[] = [], updated: string[] = [], deleted: string[] = [], missing: string[] = [];
let unchanged = 0;

for (const key of removed) {
  if (byKey.delete(key)) deleted.push(key);
  else missing.push(key);
}
for (const e of incoming) {
  if (!e?.key) continue;
  const cur = byKey.get(e.key);
  if (!cur) {
    byKey.set(e.key, e as SeedIngredient);          // addition: full entry
    added.push(e.key);
  } else {
    const next = { ...cur, ...e } as SeedIngredient; // edit: overlay only the changed fields
    if (norm(cur) !== norm(next)) { byKey.set(e.key, next); updated.push(e.key); }
    else unchanged++;
  }
}

// Existing order first (minus deletions), then new keys appended alphabetically.
const finalKeys = [
  ...order.filter(k => byKey.has(k)),
  ...added.slice().sort(),
];
const merged = finalKeys.map(k => byKey.get(k)!);

/* ---- regenerate the array text ---- */
const q = (s: string) => JSON.stringify(s);
const arr = (a: string[]) => `[${a.map(q).join(', ')}]`;
function emit(e: SeedIngredient): string {
  const L = ['  {'];
  L.push(`    key: ${q(e.key)},`);
  L.push(`    disp: ${q(e.disp)},`);
  L.push(`    cat: ${q(e.cat)},`);
  L.push(`    color: ${q(e.color)},`);
  L.push(`    shape: ${e.shape == null ? 'null' : q(e.shape)},`);
  L.push(`    abv: ${e.abv},`);
  if (e.syrup) L.push(`    syrup: ${q(e.syrup)},`);
  if (e.citrus) L.push(`    citrus: ${q(e.citrus)},`);
  if (e.aliases?.length) L.push(`    aliases: ${arr(e.aliases)},`);
  if (e.umbrellas?.length) L.push(`    umbrellas: ${arr(e.umbrellas)},`);
  L.push('  },');
  return L.join('\n');
}

const text = readFileSync(SEED_PATH, 'utf8');
const idx = text.indexOf(MARKER);
if (idx < 0) die(`Couldn't find "${MARKER}" in ${SEED_PATH}.`);
const head = text.slice(0, idx);
const out = `${head}export const INGREDIENTS: SeedIngredient[] = [\n${merged.map(emit).join('\n')}\n];\n`;

/* ---- report + write ---- */
const list = (ks: string[]) => ks.length ? ks.join(', ') : c.dim + '(none)' + c.reset;
console.log(`\n${c.bold}Merging${c.reset} ${c.cyan}${jsonPath}${c.reset} → ${c.cyan}${SEED_PATH}${c.reset}\n`);
console.log(`  ${c.green}+ Added   (${added.length})${c.reset}  ${list(added.slice().sort())}`);
console.log(`  ${c.yellow}~ Updated (${updated.length})${c.reset}  ${list(updated.slice().sort())}`);
console.log(`  ${c.red}- Removed (${deleted.length})${c.reset}  ${list(deleted.slice().sort())}`);
console.log(`  ${c.dim}= Unchanged: ${unchanged}${c.reset}`);
if (missing.length) console.log(`  ${c.dim}(removed keys not in seed, ignored: ${missing.join(', ')})${c.reset}`);

if (!added.length && !updated.length && !deleted.length) {
  console.log(`\n${c.dim}Nothing to merge — seed already matches.${c.reset}\n`);
  process.exit(0);
}

writeFileSync(SEED_PATH, out);
console.log(`\n${c.green}✓${c.reset} Wrote ${SEED_PATH} (${merged.length} ingredients). ${c.dim}Run \`npm run build\` to type-check.${c.reset}\n`);
