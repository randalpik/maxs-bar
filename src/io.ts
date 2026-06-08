import { state, save } from './state';
import { parseLine } from './parser';
import { parseCSV } from './csv';
import { buildIngredientsExport } from './ingredients-export';
import { nowISO } from './util';
import { render } from './render';

/* ============================================================
   Import / export
   ============================================================ */
export function download(filename: string, text: string, type: string): void {
  const b = new Blob([text], { type });
  const u = URL.createObjectURL(b);
  const a = document.createElement('a');
  a.href = u; a.download = filename; a.click();
  URL.revokeObjectURL(u);
}

export function exportTXT(): void {
  const txt = state.records.map(r => `${r.name}: ${r.recipe}`).join('\n\n') + '\n';
  download('drinks.txt', txt, 'text/plain');
}

/** Export the user's ingredient overrides as JSON in the canonical seed format, so
 *  hand-created/edited entries can be reconciled into ingredients-seed.ts. The diff
 *  assembly lives in ingredients-export.ts (pure / unit-tested). */
export function exportIngredientsJSON(): void {
  download('ingredients.json', JSON.stringify(buildIngredientsExport(), null, 2) + '\n', 'application/json');
}

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

/** Import recipes from a CSV in the same shape we export (name,recipe,created,edited).
 *  Existing recipes (matched case-insensitively by name) are updated in place;
 *  created/edited timestamps from the file are preserved so a round-trip is lossless. */
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
