import type { Ingredient } from './types';

/* ============================================================
   Icons — wireframe outline + flat color fill
   ============================================================ */
export function icon(shape: string, color: string): string {
  const S = 'var(--stroke)';
  const sw = 1.5;
  const w = `stroke="${S}" stroke-width="${sw}" stroke-linejoin="round"`;
  let inner = '';
  switch (shape) {
    case 'circle': inner = `<circle cx="16" cy="16" r="10" fill="${color}" ${w}/>`; break;
    case 'ring': inner = `<circle cx="16" cy="16" r="11" fill="none" stroke="${color}" stroke-width="2"/><circle cx="16" cy="16" r="6" fill="none" stroke="${color}" stroke-width="1.4" opacity=".7"/>`; break;
    case 'squircle': inner = `<rect x="5" y="5" width="22" height="22" rx="7" fill="${color}" ${w}/>`; break;
    case 'droplet': inner = `<path d="M16 3 C16 3 8 13.5 8 19 C8 23.4 11.6 27 16 27 C20.4 27 24 23.4 24 19 C24 13.5 16 3 16 3 Z" fill="${color}" ${w}/>`; break;
    case 'hexagon': inner = `<path d="M16 4 L26 10 L26 22 L16 28 L6 22 L6 10 Z" fill="${color}" ${w}/>`; break;
    case 'glass': inner = `<path d="M7 7 L25 7 L16.5 18 Z" fill="${color}" ${w}/><path d="M16 18 L16 26 M11 26 L21 26" fill="none" ${w} stroke-linecap="round"/>`; break;
    case 'fizz': inner = `<circle cx="16" cy="18" r="9" fill="${color}" opacity=".5" ${w}/><circle cx="13" cy="9" r="1.6" fill="${color}" ${w}/><circle cx="19" cy="7" r="1.3" fill="${color}" ${w}/><circle cx="16" cy="12" r="1.1" fill="${color}" ${w}/>`; break;
    case 'ellipse': inner = `<ellipse cx="16" cy="16" rx="11" ry="8" fill="${color}" ${w}/>`; break;
    case 'diamond': inner = `<path d="M16 5 L26 16 L16 27 L6 16 Z" fill="${color}" ${w}/>`; break;
    case 'leaf': inner = `<path d="M16 4 C26 10,26 22,16 28 C6 22,6 10,16 4 Z" fill="${color}" ${w}/><path d="M16 6 L16 26" fill="none" stroke="${S}" stroke-width="1.1" opacity=".7"/>`; break;
    case 'bottle': inner = `<rect x="13" y="4.5" width="6" height="3" rx="1" fill="${color}" ${w}/><path d="M14.5 7.5 h3 v2.5 h-3 z" fill="${color}" ${w}/><rect x="9" y="10" width="14" height="17" rx="4.5" fill="${color}" ${w}/><path d="M23 14 c4.5 1.2,4.5 5.6,0 6.8" fill="none" ${w}/>`; break;
    case 'triangle': inner = `<path d="M16 8.5 L23.5 22.5 L8.5 22.5 Z" fill="${color}" ${w}/>`; break;
    default: inner = `<circle cx="16" cy="16" r="10" fill="${color}" ${w}/>`;
  }
  return `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}

const FGLY: Record<string, string> = { '0.5000': '½', '0.2500': '¼', '0.7500': '¾', '0.3333': '⅓', '0.6667': '⅔', '0.1667': '⅙', '0.1250': '⅛' };

export function fmtOz(v: number): string {
  const whole = Math.floor(v + 1e-9);
  const frac = v - whole;
  let fs = '';
  if (frac > 1e-6) { const k = frac.toFixed(4); fs = FGLY[k] || String(+frac.toFixed(2)); }
  const s = whole ? (fs ? whole + fs : '' + whole) : (fs || '0');
  return s + ' oz';
}

export function iconFor(i: Ingredient): string | null {
  switch (i.cat) {
    case 'spirit': return 'squircle';
    case 'liqueur': return 'hexagon';
    case 'fortified': return 'glass';
    case 'syrup': return 'bottle';
    case 'bitters': return 'triangle';
    case 'soda': return 'droplet';
    case 'citrus': return (i.role === 'pour' || i.role === 'float' || i.role === 'measure' || i.role === 'dash') ? 'circle' : null;
    case 'fruit': return (i.role === 'pour' || i.role === 'float' || i.role === 'measure' || i.role === 'dash') ? 'droplet' : null;
    default: return null; // egg, sugar, saline, herb, spice, dairy, garnish, other -> iconless
  }
}

export function amountTag(i: Ingredient): { amount: string | null; tag: string | null } {
  switch (i.role) {
    case 'pour': return { amount: fmtOz(i.qty || 0), tag: null };
    case 'float': return { amount: fmtOz(i.qty || 0), tag: 'float' };
    case 'measure': return { amount: (+(i.qty || 0)) + ' tsp', tag: null };
    case 'count': { const n = i.qty || 1; return { amount: n + ' ' + (n === 1 ? 'wedge' : 'wedges'), tag: null }; }
    case 'egg': return { amount: (i.qty || 1) + ' ' + i.eggMod, tag: null };
    case 'muddled': return i.qty
      ? { amount: (i.unit === 'tsp' ? (+i.qty) + ' tsp' : fmtOz(i.qty)), tag: 'muddle' }
      : { amount: 'muddle', tag: null };
    case 'dash': return { amount: 'dash', tag: null };
    case 'bitters': return { amount: 'dash', tag: null };
    case 'top': return { amount: 'top', tag: null };
    default: return { amount: 'garnish', tag: null };
  }
}
