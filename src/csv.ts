import type { Recipe } from './types';
import { nowISO } from './util';

/* ============================================================
   CSV  (RFC-4180-ish: quote fields containing , " or newline)
   ============================================================ */
function csvField(s: unknown): string {
  const v = String(s ?? '');
  return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}

export function toCSV(recs: Recipe[]): string {
  const head = 'name,recipe,created,edited';
  return head + '\n' + recs.map(r => [r.name, r.recipe, r.created, r.edited].map(csvField).join(',')).join('\n');
}

export function parseCSV(text: string): Recipe[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let f = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c;
    } else {
      if (c === '"') q = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
      else if (c === '\r') { /* skip */ }
      else f += c;
    }
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  if (!rows.length) return [];
  rows.shift(); // header
  return rows
    .filter(r => r.length >= 2 && r[0])
    .map(r => ({ name: r[0]!, recipe: r[1]!, created: r[2] || nowISO(), edited: r[3] || nowISO() }));
}
