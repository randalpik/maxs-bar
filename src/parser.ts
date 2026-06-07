import type { Classified, Ingredient, ParsedLine, Role, Rule } from './types';

/* ============================================================
   Cocktail shorthand parser  (validated headless against drinks.txt)
   ============================================================ */

export const SPIRIT_ORDER = ['rum', 'whiskey', 'tequila', 'gin', 'brandy', 'cachaça', 'absinthe', 'aquavit', 'neutral'];
export const SPIRIT_LABEL: Record<string, string> = {
  rum: 'Rum', whiskey: 'Whiskey', tequila: 'Tequila', gin: 'Gin', brandy: 'Brandy',
  cachaça: 'Cachaça', absinthe: 'Absinthe', aquavit: 'Aquavit', neutral: 'Neutral spirit',
};
export const METHOD_ORDER = ['shaken', 'stirred', 'built'];

const RULES: Rule[] = [
  // Specific bitters first (own colours); the generic /bitters/ below is the fallback.
  { re: /angostura/, cat: 'bitters', shape: 'triangle', color: '#A8412E', abv: 0.44 },
  { re: /peychaud/, cat: 'bitters', shape: 'triangle', color: '#D14B3A', abv: 0.44 },
  { re: /orange bitters/, cat: 'bitters', shape: 'triangle', color: '#E0892B', abv: 0.44 },
  { re: /peach bitters/, cat: 'bitters', shape: 'triangle', color: '#E6A968', abv: 0.44 },
  { re: /chocolate bitters/, cat: 'bitters', shape: 'triangle', color: '#5A3520', abv: 0.44 },
  { re: /cardamom bitters/, cat: 'bitters', shape: 'triangle', color: '#7E8B4A', abv: 0.44 },
  { re: /bitters/, cat: 'bitters', shape: 'triangle', color: '#8A5A33', abv: 0.44 },
  { re: /ginger beer/, cat: 'soda', shape: 'soda', color: '#C9A24B', abv: 0, disp: 'Ginger beer' },
  { re: /tonic/, cat: 'soda', shape: 'soda', color: '#DCE8EE', abv: 0, disp: 'Tonic water' },
  { re: /soda|seltzer/, cat: 'soda', shape: 'soda', color: '#DCE8EE', abv: 0, disp: 'Soda water' },
  { re: /milk/, cat: 'dairy', shape: 'droplet', color: '#F0EDE3', abv: 0, disp: 'Milk' },
  { re: /egg/, cat: 'egg', shape: 'ellipse', color: '#F2EEE0', abv: 0, disp: 'Egg white' },
  { re: /brown sugar/, cat: 'sugar', shape: 'diamond', color: '#9B6B3A', abv: 0, disp: 'Brown sugar' },
  { re: /sugar/, cat: 'sugar', shape: 'diamond', color: '#D8C9A0', abv: 0 },
  { re: /saline/, cat: 'other', shape: 'diamond', color: '#DDE6EC', abv: 0, disp: 'Saline solution' },
  { re: /espresso|cold brew/, cat: 'other', shape: 'droplet', color: '#3A2417', abv: 0, disp: 'Espresso' },
  { re: /luxardo|maraschino/, cat: 'liqueur', shape: 'hexagon', color: '#E7E1D2', abv: 0.32, disp: 'Luxardo' },
  { re: /curaçao|curacao|triple sec|cointreau/, cat: 'liqueur', shape: 'hexagon', color: '#E0892B', abv: 0.40, disp: 'Orange Curaçao' },
  { re: /violette|violet/, cat: 'liqueur', shape: 'hexagon', color: '#7A4FA3', abv: 0.20, disp: 'Crème de violette' },
  { re: /elderflower|germain/, cat: 'liqueur', shape: 'hexagon', color: '#E6E0AE', abv: 0.20, disp: 'Elderflower liqueur' },
  { re: /kahlua|kahlúa|coffee liqueur/, cat: 'liqueur', shape: 'hexagon', color: '#3A2417', abv: 0.20, disp: 'Kahlúa' },
  { re: /bailey/, cat: 'liqueur', shape: 'hexagon', color: '#CBA980', abv: 0.17, disp: "Bailey's" },
  { re: /cacao/, cat: 'liqueur', shape: 'hexagon', color: '#5A3A29', abv: 0.24, disp: 'Crème de cacao' },
  { re: /amaretto/, cat: 'liqueur', shape: 'hexagon', color: '#9B5A2A', abv: 0.24, disp: 'Amaretto' },
  { re: /bénédictine|benedictine/, cat: 'liqueur', shape: 'hexagon', color: '#C8902E', abv: 0.40, disp: 'Bénédictine' },
  { re: /yellow chartreuse/, cat: 'liqueur', shape: 'hexagon', color: '#D7C23A', abv: 0.40, disp: 'Yellow Chartreuse' },
  { re: /green chartreuse/, cat: 'liqueur', shape: 'hexagon', color: '#3E7A33', abv: 0.55, disp: 'Green Chartreuse' },
  { re: /chartreuse/, cat: 'liqueur', shape: 'hexagon', color: '#4E7B36', abv: 0.40, disp: 'Chartreuse' },
  { re: /campari/, cat: 'liqueur', shape: 'hexagon', color: '#C3122E', abv: 0.24, disp: 'Campari' },
  { re: /blackberry|mûre|mure|cassis/, cat: 'liqueur', shape: 'hexagon', color: '#4A2540', abv: 0.20, disp: 'Blackberry liqueur' },
  { re: /sweet vermouth/, cat: 'fortified', shape: 'glass', color: '#7A2E2E', abv: 0.17, disp: 'Sweet vermouth' },
  { re: /dry vermouth/, cat: 'fortified', shape: 'glass', color: '#D7D1A0', abv: 0.17, disp: 'Dry vermouth' },
  { re: /vermouth/, cat: 'fortified', shape: 'glass', color: '#B0734A', abv: 0.17, disp: 'Vermouth' },
  { re: /lillet/, cat: 'fortified', shape: 'glass', color: '#E6D98A', abv: 0.17, disp: 'Lillet Blanc' },
  { re: /champagne|sparkling|prosecco/, cat: 'fortified', shape: 'glass', color: '#E8E2B0', abv: 0.12, disp: 'Champagne' },
  { re: /wine/, cat: 'fortified', shape: 'glass', color: '#6E1F2E', abv: 0.13, disp: 'Red wine' },
  { re: /simple/, cat: 'syrup', shape: 'droplet', color: '#DDE2E6', abv: 0, disp: 'Simple syrup', syrup: 'simple' },
  { re: /honey/, cat: 'syrup', shape: 'droplet', color: '#D6A93B', abv: 0, disp: 'Honey syrup', syrup: 'honey' },
  { re: /cinnamon/, cat: 'syrup', shape: 'droplet', color: '#8A4B2A', abv: 0, disp: 'Cinnamon syrup', syrup: 'cinnamon' },
  { re: /lapsang/, cat: 'syrup', shape: 'droplet', color: '#5C3A24', abv: 0, disp: 'Lapsang syrup', syrup: 'lapsang' },
  { re: /orgeat/, cat: 'syrup', shape: 'bottle', color: '#E6DAB8', abv: 0, disp: 'Orgeat', syrup: 'orgeat' },
  { re: /syrup/, cat: 'syrup', shape: 'droplet', color: '#C9B98A', abv: 0, disp: 'Syrup', syrup: 'generic' },
  { re: /arugula/, cat: 'herb', shape: 'leaf', color: '#6B8F3F', abv: 0, disp: 'Arugula extract' },
  { re: /mint/, cat: 'herb', shape: 'leaf', color: '#6FAE4B', abv: 0, disp: 'Mint' },
  { re: /grapefruit/, cat: 'citrus', shape: 'circle', color: '#E8806B', abv: 0, disp: 'Grapefruit', citrus: 'grapefruit' },
  { re: /lime/, cat: 'citrus', shape: 'circle', color: '#8FBF3F', abv: 0, disp: 'Lime', citrus: 'lime' },
  { re: /lemon/, cat: 'citrus', shape: 'circle', color: '#E6C84B', abv: 0, disp: 'Lemon', citrus: 'lemon' },
  { re: /orange/, cat: 'citrus', shape: 'circle', color: '#E0892B', abv: 0, disp: 'Orange', citrus: 'orange' },
  { re: /pomegranate/, cat: 'fruit', shape: 'circle', color: '#9E2A3A', abv: 0, disp: 'Pomegranate' },
  { re: /cranberry/, cat: 'fruit', shape: 'circle', color: '#B5293A', abv: 0, disp: 'Cranberry' },
  { re: /raspberry/, cat: 'fruit', shape: 'circle', color: '#B02A4A', abv: 0, disp: 'Raspberry' },
  { re: /cherry/, cat: 'fruit', shape: 'circle', color: '#B5293A', abv: 0, disp: 'Cherry' },
  { re: /nutmeg/, cat: 'spice', shape: 'diamond', color: '#8A5A2A', abv: 0, disp: 'Nutmeg' },
  { re: /absinthe/, cat: 'spirit', shape: 'squircle', color: '#9FCB3B', abv: 0.62, fam: 'absinthe', disp: 'Absinthe' },
  { re: /apple brandy|calvados/, cat: 'spirit', shape: 'squircle', color: '#B86A2A', abv: 0.40, fam: 'brandy', disp: 'Apple brandy' },
  { re: /cognac/, cat: 'spirit', shape: 'squircle', color: '#9B4D1E', abv: 0.40, fam: 'brandy', disp: 'Cognac' },
  { re: /brandy/, cat: 'spirit', shape: 'squircle', color: '#A85A2A', abv: 0.40, fam: 'brandy', disp: 'Brandy' },
  { re: /light rum/, cat: 'spirit', shape: 'squircle', color: '#E6D7A6', abv: 0.40, fam: 'rum', disp: 'Light rum' },
  { re: /dark rum/, cat: 'spirit', shape: 'squircle', color: '#6E3F1C', abv: 0.40, fam: 'rum', disp: 'Dark rum' },
  { re: /jamaican rum/, cat: 'spirit', shape: 'squircle', color: '#8A4B1E', abv: 0.40, fam: 'rum', disp: 'Jamaican rum' },
  { re: /rum/, cat: 'spirit', shape: 'squircle', color: '#C99A5B', abv: 0.40, fam: 'rum', disp: 'Rum' },
  { re: /bourbon/, cat: 'spirit', shape: 'squircle', color: '#B5651D', abv: 0.40, fam: 'whiskey', disp: 'Bourbon' },
  { re: /rye/, cat: 'spirit', shape: 'squircle', color: '#C06A22', abv: 0.40, fam: 'whiskey', disp: 'Rye' },
  { re: /scotch/, cat: 'spirit', shape: 'squircle', color: '#A85A1A', abv: 0.40, fam: 'whiskey', disp: 'Scotch' },
  { re: /whisk/, cat: 'spirit', shape: 'squircle', color: '#B5651D', abv: 0.40, fam: 'whiskey', disp: 'Whiskey' },
  { re: /tequila|mezcal/, cat: 'spirit', shape: 'squircle', color: '#E6E0AE', abv: 0.40, fam: 'tequila', disp: 'Tequila' },
  { re: /cachaça|cachaca/, cat: 'spirit', shape: 'squircle', color: '#E1DBAE', abv: 0.40, fam: 'cachaça', disp: 'Cachaça' },
  { re: /aquavit|akvavit/, cat: 'spirit', shape: 'squircle', color: '#E6E6D6', abv: 0.40, fam: 'aquavit', disp: 'Aquavit' },
  { re: /vodka/, cat: 'spirit', shape: 'squircle', color: '#E2E8EE', abv: 0.40, fam: 'neutral', disp: 'Vodka' },
  { re: /\bgin\b/, cat: 'spirit', shape: 'squircle', color: '#DCEAF0', abv: 0.40, fam: 'gin', disp: 'Gin' },
  { re: /spirit/, cat: 'spirit', shape: 'squircle', color: '#E0E6EC', abv: 0.40, fam: 'neutral', disp: 'Spirit' },
];

export const titleCase = (s: string): string => s.replace(/\b\w/g, c => c.toUpperCase());
export const sentenceCase = (s: string): string => { s = s.toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); };

/** The full regex classifier. Build-time only in production: the generator uses it
 *  to bake the ingredient seed, and the app swaps in a seed-backed classifier at
 *  startup (see setClassifier). Tests use this default. */
export function classify(name: string): Classified {
  const ls = name.toLowerCase();
  for (const r of RULES) {
    if (r.re.test(ls)) return { ...r, disp: r.disp || titleCase(name) };
  }
  return { cat: 'other', shape: 'circle', color: '#8C857A', abv: 0, disp: titleCase(name) };
}

/** The classifier parseIngredient uses. Swappable so the app can resolve ingredients
 *  from the precomputed seed instead of running the regex table at runtime. */
let activeClassifier: (name: string) => Classified = classify;
export function setClassifier(fn: (name: string) => Classified): void { activeClassifier = fn; }

const FRAC: Record<string, number> = { '1/2': .5, '1/4': .25, '3/4': .75, '1/3': 1 / 3, '2/3': 2 / 3, '1/6': 1 / 6, '1/8': .125, '3/2': 1.5, '5/2': 2.5 };

export function parseNum(t: string): number | null {
  const f = FRAC[t];
  if (f !== undefined) return f;
  if (/^\d+\/\d+$/.test(t)) { const [a, b] = t.split('/').map(Number); return a! / b!; }
  if (/^\d+(\.\d+)?$/.test(t)) return parseFloat(t);
  return null;
}

export function parseIngredient(raw: string): Ingredient {
  let s = raw.trim();
  let prefix: string | null = null;
  const pm = s.match(/^(top|float|dash|muddled)\s+/i);
  if (pm) { prefix = pm[1]!.toLowerCase(); s = s.slice(pm[0].length); }
  const tm = s.match(/\s+muddled$/i);
  if (tm) { prefix = 'muddled'; s = s.slice(0, -tm[0].length); }
  let qty: number | null = null;
  let unit: string | null = null;
  const qm = s.match(/^(\d+\s*\/\s*\d+|\d+(?:\.\d+)?)\s*/);
  if (qm) { qty = parseNum(qm[1]!.replace(/\s/g, '')); s = s.slice(qm[0].length); }
  const um = s.match(/^(oz|tsp|tbsp|ml|cl)\s+/i);
  if (um) { unit = um[1]!.toLowerCase(); s = s.slice(um[0].length); }
  const name = s.trim();
  const info = activeClassifier(name);
  const lname = name.toLowerCase();
  const isCount = /\bwedges?\b/.test(lname);
  const isPeel = /\b(peel|wheel|twist)\b/.test(lname);
  let role: Role;
  if (prefix === 'top') role = 'top';
  else if (prefix === 'float') role = 'float';
  else if (prefix === 'dash') role = 'dash';
  else if (prefix === 'muddled') role = 'muddled';
  else if (info.cat === 'egg') role = 'egg';
  else if (info.cat === 'bitters') role = 'bitters';
  else if (isCount) role = 'count';
  else if (qty != null && unit === 'tsp') role = 'measure';
  else if (qty != null) role = 'pour';
  else role = 'garnish';
  if (role === 'pour' && !unit) unit = 'oz';
  if (role === 'count') unit = 'wedge';

  const liquid = role === 'pour' || role === 'float' || role === 'measure' || role === 'dash';
  let disp = info.disp;
  let eggMod: string | null = null;
  if (info.cat === 'egg') {
    const w = lname.split(/\s+/).filter(x => x && x !== 'egg');
    eggMod = w[0] || 'whole'; disp = 'Egg';
  } else if (isPeel) {
    disp = sentenceCase(name);
  } else if (info.cat === 'bitters') {
    disp = sentenceCase(name);
  } else if ((info.cat === 'citrus' || info.cat === 'fruit') && liquid) {
    disp = info.disp + ' juice';
  }

  return {
    raw, name, disp, qty, unit, role, prefix, cat: info.cat, fam: info.fam || null,
    color: info.color, abv: info.abv, citrus: info.citrus || null, syrup: info.syrup || null, eggMod,
  };
}

export function parseLine(line: string): ParsedLine | null {
  const idx = line.indexOf(':');
  if (idx < 0) return null;
  const name = line.slice(0, idx).trim();
  let body = line.slice(idx + 1).trim();
  let method = 'shaken';
  let hasMethod = false;
  const mm = body.match(/\(([^)]+)\)\s*$/);
  if (mm) { method = mm[1]!.trim().toLowerCase(); body = body.slice(0, mm.index).trim(); hasMethod = true; }
  const parts = body.split(',').map(p => p.trim()).filter(Boolean);
  return { name, body, method, hasMethod, ingredients: parts.map(parseIngredient) };
}

export function volOz(i: Ingredient): number {
  if (i.role === 'pour' || i.role === 'float') return i.qty || 0;
  if (i.role === 'measure') return (i.qty || 0) / 6;
  if (i.role === 'dash' || i.role === 'bitters') return .03 * (i.qty || 1);
  return 0;
}

export const estAlcoholOz = (r: ParsedLine): number => r.ingredients.reduce((t, i) => t + volOz(i) * i.abv, 0);

export function baseSpirit(r: ParsedLine): string | null {
  const sp = r.ingredients.filter(i => i.cat === 'spirit');
  if (!sp.length) return null;
  sp.sort((a, b) => volOz(b) - volOz(a));
  return sp[0]!.fam;
}
