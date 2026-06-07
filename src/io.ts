import { state, save } from './state';
import { parseLine } from './parser';
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

export function importTXT(text: string): void {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l && l.includes(':'));
  const t = nowISO();
  for (const line of lines) {
    const p = parseLine(line);
    if (!p || !p.name) continue;
    const recipe = p.body + (p.hasMethod ? ` (${p.method})` : '');
    const ex = state.records.find(x => x.name.toLowerCase() === p.name.toLowerCase());
    if (ex) { ex.recipe = recipe; ex.edited = t; } else state.records.push({ name: p.name, recipe, created: t, edited: t });
  }
  save(); render();
}
