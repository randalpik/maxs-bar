import type { Recipe, Derived } from './types';
import { parseLine, baseSpirit, estAlcoholOz } from './parser';
import { toCSV, parseCSV } from './csv';
import { SEED_TXT } from './seed';
import { nowISO } from './util';

/* ============================================================
   State + storage
   ============================================================ */
export const KEY = 'backbar.csv.v2';

/** Shared, mutable app state — replaces the prototype's module-level globals. */
export const state: {
  records: Recipe[];
  mode: 'group' | 'sort';
  key: string;
  query: string;
} = {
  records: [],
  mode: 'group',
  key: 'spirit',
  query: '',
};

export function seedRecords(): Recipe[] {
  return SEED_TXT.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const p = parseLine(line)!;
    const t = nowISO();
    return { name: p.name, recipe: p.body + (p.hasMethod ? ` (${p.method})` : ''), created: t, edited: t };
  });
}

export function load(): void {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    try { state.records = parseCSV(raw); if (state.records.length) return; } catch { /* fall through to seed */ }
  }
  state.records = seedRecords();
  save();
}

export function save(): void { localStorage.setItem(KEY, toCSV(state.records)); }

export function derive(rec: Recipe): Derived {
  const p = parseLine(`${rec.name}: ${rec.recipe}`)!;
  return { rec, p, base: baseSpirit(p), alc: estAlcoholOz(p) };
}
