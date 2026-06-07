import type { Recipe } from '../types';
import { parseLine } from '../parser';
import { classicsText } from './classics';
import { maxsText } from './maxs-list';

/* ============================================================
   Recipe seeds + inheritance

   Each seed is a block of shorthand recipe lines. A seed may `inherit` another:
   resolveSeed() resolves the parent first, then upserts the child's lines by
   (case-insensitive) name — a matching name overrides the inherited recipe, a
   new name appends. So "Max's List" = Classics + Max's tweaks/originals.

   Seed recipes carry a stable created/edited sentinel so re-deriving the catalog
   on every load never registers a spurious edit (see state.diffRecords).
   ============================================================ */
export interface SeedDef {
  id: string;
  label: string;
  inherits?: string;
  text: string;
}

export const SEEDS: SeedDef[] = [
  { id: 'classics', label: 'Classics', text: classicsText },
  { id: 'maxs-list', label: "Max's List", inherits: 'classics', text: maxsText },
  { id: 'empty', label: 'Empty', text: '' },
];

/** The seed adopted for pre-existing installs during migration; also the modal default. */
export const DEFAULT_SEED = 'maxs-list';

/** Stable timestamp for seed-provided recipes (must not be Date.now() — see header). */
export const SEED_TS = '2020-01-01T00:00:00.000Z';

export const seedDef = (id: string): SeedDef | undefined => SEEDS.find(s => s.id === id);

function linesToRecipes(text: string): Recipe[] {
  return text.split('\n').map(l => l.trim()).filter(Boolean).flatMap(line => {
    const p = parseLine(line);
    if (!p || !p.name) return [];
    return [{ name: p.name, recipe: p.body + (p.hasMethod ? ` (${p.method})` : ''), created: SEED_TS, edited: SEED_TS, author: '' }];
  });
}

/** Resolve a seed id to its full recipe list, walking the inheritance chain. */
export function resolveSeed(id: string): Recipe[] {
  const def = seedDef(id);
  if (!def) return [];
  const out = def.inherits ? resolveSeed(def.inherits) : [];
  const idx = new Map(out.map((r, i) => [r.name.toLowerCase(), i]));
  for (const r of linesToRecipes(def.text)) {
    const k = r.name.toLowerCase();
    const at = idx.get(k);
    if (at === undefined) { idx.set(k, out.length); out.push(r); }
    else out[at] = r;
  }
  return out;
}
