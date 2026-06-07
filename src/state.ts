import type { Recipe, Derived, IngredientOverride } from './types';
import { parseLine, baseSpirit, estAlcoholOz } from './parser';
import { toCSV, parseCSV } from './csv';
import { SEED_TXT } from './seed';
import { nowISO } from './util';

/* ============================================================
   State + storage
   ============================================================ */
export const KEY = 'backbar.csv.v2';
export const STOCK_KEY = 'backbar.stock.v1';
export const INGREDIENTS_KEY = 'backbar.ingredients.v1';

/** Shared, mutable app state — replaces the prototype's module-level globals. */
export const state: {
  records: Recipe[];
  mode: 'group' | 'sort';
  key: string;
  query: string;
  page: 'recipes' | 'ingredients' | 'syrups';
  stocked: Set<string>;
  /** Per-ingredient edits, keyed by ingredientKey; layered over parser defaults. */
  ingredients: Record<string, IngredientOverride>;
} = {
  records: [],
  mode: 'group',
  key: 'spirit',
  query: '',
  page: 'recipes',
  stocked: new Set(),
  ingredients: {},
};

export function seedRecords(): Recipe[] {
  return SEED_TXT.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const p = parseLine(line)!;
    const t = nowISO();
    return { name: p.name, recipe: p.body + (p.hasMethod ? ` (${p.method})` : ''), created: t, edited: t, author: '' };
  });
}

export function load(): void {
  loadStock();
  loadIngredients();
  const raw = localStorage.getItem(KEY);
  if (raw) {
    try { state.records = parseCSV(raw); if (state.records.length) return; } catch { /* fall through to seed */ }
  }
  state.records = seedRecords();
  save();
}

export function save(): void { localStorage.setItem(KEY, toCSV(state.records)); }

/** Stocked ingredient keys, persisted separately from recipes. */
export function loadStock(): void {
  try {
    const raw = localStorage.getItem(STOCK_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) state.stocked = new Set(arr.filter((x): x is string => typeof x === 'string'));
  } catch { /* keep empty set */ }
}

export function saveStock(): void { localStorage.setItem(STOCK_KEY, JSON.stringify([...state.stocked])); }

export function toggleStock(key: string): void {
  if (state.stocked.has(key)) state.stocked.delete(key);
  else state.stocked.add(key);
  saveStock();
}

/** Per-ingredient overrides, persisted separately from recipes and stock. */
export function loadIngredients(): void {
  try {
    const raw = localStorage.getItem(INGREDIENTS_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object') state.ingredients = obj;
  } catch { /* keep empty */ }
}

export function saveIngredients(): void {
  localStorage.setItem(INGREDIENTS_KEY, JSON.stringify(state.ingredients));
}

/** Merge a patch into an ingredient's override (dropping keys set back to undefined). */
export function setIngredientOverride(key: string, patch: IngredientOverride): void {
  const next = { ...state.ingredients[key], ...patch };
  for (const k of Object.keys(next) as (keyof IngredientOverride)[]) if (next[k] === undefined) delete next[k];
  if (Object.keys(next).length) state.ingredients[key] = next;
  else delete state.ingredients[key];
  saveIngredients();
}

export function resetIngredientOverride(key: string): void {
  delete state.ingredients[key];
  saveIngredients();
}

export function derive(rec: Recipe): Derived {
  const p = parseLine(`${rec.name}: ${rec.recipe}`)!;
  return { rec, p, base: baseSpirit(p), alc: estAlcoholOz(p) };
}
