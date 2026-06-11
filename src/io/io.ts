import { state, save, saveIngredients, saveStock, setProfilePlacement, deriveRecords, SEED_KEY, RECIPES_KEY } from '../core/state';
import { HOME_ID } from '../profiles/profiles';
import { parseLine } from '../parser/parser';
import { parseCSV } from '../parser/csv';
import { runtimeCatalog, reconcileStock, refreshUnits } from '../ingredients/catalog';
import {
  buildRecipesExport, parseRecipesImport, isRecipesExport,
  buildIngredientsExport, parseIngredientsImport, isIngredientsExport,
  buildStockExport, parseStockImport, buildProfileExport,
} from './transfer';
import { nowISO } from '../core/util';
import { render } from '../ui/render';

/* ============================================================
   Import / export — DOM + persistence wrappers around transfer.ts.

   JSON is the canonical format: seed + override diffs for recipes and ingredients,
   a flat key list for stock. .txt / .csv remain accepted on recipe IMPORT only,
   for human-readable intake (an additive merge, not a full replace).
   ============================================================ */
export function download(filename: string, text: string, type: string): void {
  const b = new Blob([text], { type });
  const u = URL.createObjectURL(b);
  const a = document.createElement('a');
  a.href = u; a.download = filename; a.click();
  URL.revokeObjectURL(u);
}

const json = (v: unknown): string => JSON.stringify(v, null, 2) + '\n';

/* ---------- exports ---------- */

/** Recipes as a seed-relative diff (the canonical format). */
export function exportRecipesJSON(): void {
  download('recipes.json', json(buildRecipesExport()), 'application/json');
}

/** Ingredient overrides as a seed-format diff, for reconciling into the seed. */
export function exportIngredientsJSON(): void {
  download('ingredients.json', json(buildIngredientsExport()), 'application/json');
}

/** Stocked keys as a flat list. */
export function exportStockJSON(): void {
  download('stock.json', json(buildStockExport()), 'application/json');
}

/** The currently selected profile (toolbar Export — hidden for Categories). */
export function exportProfileJSON(): void {
  const p = state.profiles[state.profileId];
  if (!p || p.deleted) return;
  const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'profile';
  download(`profile-${slug}.json`, json(buildProfileExport(p)), 'application/json');
}

/* ---------- recipe import (json | csv | txt) ---------- */

/** Full-replace the recipe override layer (and seed) from a recipes-export JSON. */
function applyRecipesImport(data: Parameters<typeof parseRecipesImport>[0]): void {
  const { seed, overrides } = parseRecipesImport(data);
  state.recipeOverrides = overrides;
  if (seed) { state.seedId = seed; localStorage.setItem(SEED_KEY, seed); }
  localStorage.setItem(RECIPES_KEY, JSON.stringify(overrides));
  state.records = deriveRecords();
  render();
}

/** Import recipes from a .json (full replace), or .csv / .txt (additive merge for
 *  human-readable intake). The format is sniffed from the content, then filename. */
export function importRecipes(text: string, filename = ''): void {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) {
    try {
      const data = JSON.parse(trimmed);
      if (isRecipesExport(data)) { applyRecipesImport(data); return; }
    } catch { /* not our JSON — fall through to csv/txt */ }
  }
  if (/\.csv$/i.test(filename) || /^name\s*,\s*recipe/i.test(trimmed)) importCSV(text);
  else importTXT(text);
}

/** Additive merge from `Name: recipe` lines (upsert by case-insensitive name). */
export function importTXT(text: string): void {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l && l.includes(':'));
  const t = nowISO();
  for (const line of lines) {
    const p = parseLine(line);
    if (!p || !p.name) continue;
    const recipe = p.body + (p.hasMethod ? ` (${p.method})` : '');
    const ex = state.records.find(x => x.name.toLowerCase() === p.name.toLowerCase());
    if (ex) { ex.recipe = recipe; ex.edited = t; } else state.records.push({ name: p.name, recipe, created: t, edited: t, author: '' });
  }
  save(); render();
}

/** Additive merge from CSV (name,recipe,created,edited,author), upsert by name. */
export function importCSV(text: string): void {
  let recs;
  try { recs = parseCSV(text); } catch { return; }
  const t = nowISO();
  for (const r of recs) {
    if (!r.name) continue;
    const ex = state.records.find(x => x.name.toLowerCase() === r.name.toLowerCase());
    if (ex) { ex.recipe = r.recipe; ex.edited = r.edited || t; ex.author = r.author || ex.author; }
    else state.records.push({ name: r.name, recipe: r.recipe, created: r.created || t, edited: r.edited || t, author: r.author || '' });
  }
  save(); render();
}

/* ---------- ingredient import (json, full replace) ---------- */

export function importIngredientsJSON(text: string): void {
  let data;
  try { data = JSON.parse(text); } catch { return; }
  if (!isIngredientsExport(data)) return;
  state.ingredients = parseIngredientsImport(data);
  saveIngredients();
  refreshUnits();                  // imported defs may declare new units
  reconcileStock(state.records);   // imported defs may hide a previously-stocked ingredient
  render();
}

/* ---------- stock import (json flat list, unknown keys ignored) ---------- */

export function importStockJSON(text: string): void {
  let data;
  try { data = JSON.parse(text); } catch { return; }
  const known = new Set(runtimeCatalog(state.records).entries.map(e => e.key));
  const { stocked, placements } = parseStockImport(data, known);
  state.stocked = stocked;
  saveStock();                                   // create on:true entries for the imported keys
  // Legacy stock files carried Home placements (loc/pos); fold them into the Home profile.
  if (placements.length) setProfilePlacement(HOME_ID, placements.map(p => ({ key: p.key, cat: p.loc, pos: p.pos })));
  render();
}
