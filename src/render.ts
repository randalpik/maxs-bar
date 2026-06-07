import type { Derived, Ingredient } from './types';
import { state, derive } from './state';
import { SPIRIT_LABEL, SPIRIT_ORDER, METHOD_ORDER, titleCase } from './parser';
import { icon, iconFor, amountTag } from './icons';
import { $ } from './dom';

/* ============================================================
   Rendering
   ============================================================ */
const main = $('#main');

const KEY_OPTS: Record<'group' | 'sort', [string, string][]> = {
  group: [['spirit', 'By spirit'], ['citrus', 'By citrus'], ['syrup', 'By syrup'], ['liqueur', 'By liqueur'], ['method', 'By method']],
  sort: [['base', 'Base spirit'], ['name', 'Name'], ['alcohol', 'Alcohol (est.)']],
};

export function fillKeySel(): void {
  const sel = $<HTMLSelectElement>('#keySel');
  sel.innerHTML = '';
  for (const [v, l] of KEY_OPTS[state.mode]) {
    const o = document.createElement('option');
    o.value = v; o.textContent = l; sel.appendChild(o);
  }
  if (!KEY_OPTS[state.mode].some(o => o[0] === state.key)) state.key = KEY_OPTS[state.mode][0]![0];
  sel.value = state.key;
}

function matchQuery(d: Derived): boolean {
  if (!state.query) return true;
  const q = state.query.toLowerCase();
  if (d.rec.name.toLowerCase().includes(q)) return true;
  return d.p.ingredients.some(i => i.disp.toLowerCase().includes(q) || i.name.toLowerCase().includes(q));
}

export function esc(s: unknown): string {
  return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
}

export function chipHTML(i: Ingredient): string {
  const shp = iconFor(i);
  const { amount, tag } = amountTag(i);
  return `<div class="chip">`
    + (shp ? icon(shp, i.color) : '<span class="ph"></span>')
    + `<span class="nm">${esc(i.disp)}</span>`
    + `<span class="qwrap">`
    + (tag ? `<span class="tag">${tag}</span>` : '')
    + (amount ? `<span class="q">${esc(amount)}</span>` : '')
    + `</span>`
    + `</div>`;
}

function cardHTML(d: Derived, idx: number): string {
  const baseL = d.base ? SPIRIT_LABEL[d.base] || titleCase(d.base) : '—';
  const drinks = +(d.alc / 0.6).toFixed(2);
  const meta = [
    `<span><b>${esc(baseL)}</b></span>`,
    `<span>${d.p.method}</span>`,
    `<span class="alc">${drinks} ${drinks === 1 ? 'drink' : 'drinks'}</span>`,
  ].join('');
  return `<article class="card" style="animation-delay:${Math.min(idx * 28, 420)}ms">`
    + `<button class="edit" data-edit="${esc(d.rec.name)}" title="edit"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M11 2l3 3-8 8-4 1 1-4z"/></svg></button>`
    + `<div class="head"><h2>${esc(d.rec.name)}</h2><div class="meta">${meta}</div></div>`
    + d.p.ingredients.map(chipHTML).join('')
    + `</article>`;
}

function groupsFor(d: Derived): string[] {
  if (state.key === 'spirit') { const s = [...new Set(d.p.ingredients.filter(i => i.cat === 'spirit').map(i => i.fam))]; return s.length ? (s as string[]) : ['—']; }
  if (state.key === 'citrus') { const s = [...new Set(d.p.ingredients.filter(i => i.cat === 'citrus').map(i => i.citrus))]; return s.length ? (s as string[]) : ['—']; }
  if (state.key === 'syrup') { const s = [...new Set(d.p.ingredients.filter(i => i.cat === 'syrup').map(i => i.syrup))]; return s.length ? (s as string[]) : ['—']; }
  if (state.key === 'liqueur') { const s = [...new Set(d.p.ingredients.filter(i => i.cat === 'liqueur').map(i => i.disp))]; return s.length ? s : ['—']; }
  if (state.key === 'method') { return [d.p.method]; }
  return ['—'];
}

function groupLabel(g: string): string {
  if (state.key === 'spirit') return SPIRIT_LABEL[g] || titleCase(g);
  if (state.key === 'syrup') return g === 'generic' ? 'Syrup' : titleCase(g) + ' syrup';
  return titleCase(g);
}

function groupSortKeys(): string[] | null {
  if (state.key === 'spirit') return SPIRIT_ORDER;
  if (state.key === 'method') return METHOD_ORDER;
  return null;
}

export function render(): void {
  const data = state.records.map(derive).filter(matchQuery);
  $('#count').textContent = state.records.length + ' recipes';
  if (!data.length) { main.innerHTML = '<div class="empty">No recipes match.</div>'; return; }

  if (state.mode === 'sort') {
    const arr = [...data];
    if (state.key === 'name') arr.sort((a, b) => a.rec.name.localeCompare(b.rec.name));
    else if (state.key === 'alcohol') arr.sort((a, b) => b.alc - a.alc);
    else { // base spirit
      const oi = (f: string | null) => { const x = SPIRIT_ORDER.indexOf(f as string); return x < 0 ? 99 : x; };
      arr.sort((a, b) => oi(a.base) - oi(b.base) || a.rec.name.localeCompare(b.rec.name));
    }
    const lbl = KEY_OPTS.sort.find(o => o[0] === state.key)![1];
    main.innerHTML = `<div class="grouphead"><span class="lbl">Sorted · ${lbl}</span><span class="cnt">${arr.length}</span><span class="rule"></span></div>`
      + `<div class="grid">${arr.map((d, i) => cardHTML(d, i)).join('')}</div>`;
    requestAnimationFrame(layoutCards);
    return;
  }

  // group mode
  const map = new Map<string, Derived[]>();
  for (const d of data) {
    for (const g of groupsFor(d)) {
      let arr = map.get(g);
      if (!arr) { arr = []; map.set(g, arr); }
      arr.push(d);
    }
  }
  const keys = [...map.keys()];
  const order = groupSortKeys();
  keys.sort((a, b) => {
    if (a === '—') return 1;
    if (b === '—') return -1;
    if (order) { const ia = order.indexOf(a), ib = order.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); }
    return groupLabel(a).localeCompare(groupLabel(b));
  });
  let html = '', gi = 0;
  for (const g of keys) {
    const items = map.get(g)!.sort((a, b) => a.rec.name.localeCompare(b.rec.name));
    html += `<div class="grouphead"><span class="lbl">${esc(groupLabel(g))}</span><span class="cnt">${items.length}</span><span class="rule"></span></div>`;
    html += `<div class="grid">${items.map(d => cardHTML(d, gi++)).join('')}</div>`;
  }
  main.innerHTML = html;
  requestAnimationFrame(layoutCards);
}

function chipNeededWidth(c: HTMLElement): number {
  let w = 0;
  c.querySelectorAll('.nm,.q,.tag').forEach(el => {
    const r = document.createRange();
    r.selectNodeContents(el);
    for (const rect of r.getClientRects()) if (rect.width > w) w = rect.width;
  });
  const ic = c.querySelector('svg,.ph');
  if (ic) w = Math.max(w, ic.getBoundingClientRect().width);
  const cs = getComputedStyle(c);
  const extra = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
  return Math.ceil(w + extra + 0.5);
}

export function layoutCards(): void {
  document.querySelectorAll<HTMLElement>('#main .card').forEach(card => {
    const chips = [...card.querySelectorAll<HTMLElement>('.chip')];
    if (!chips.length) return;
    chips.forEach(c => { c.style.height = ''; c.style.width = ''; });
    // Shrink each chip to its widest wrapped line — no dead horizontal space.
    const widths = chips.map(chipNeededWidth);
    chips.forEach((c, k) => { c.style.width = widths[k] + 'px'; });
    // Equalize every chip to the tallest; CSS distributes contents top-to-bottom.
    const maxH = Math.max(...chips.map(c => c.offsetHeight));
    chips.forEach(c => { c.style.height = maxH + 'px'; });
  });
}
