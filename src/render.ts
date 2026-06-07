import type { Derived, Ingredient } from './types';
import { state, derive } from './state';
import { SPIRIT_LABEL, SPIRIT_ORDER, METHOD_ORDER, titleCase } from './parser';
import { icon, amountTag } from './icons';
import {
  buildStockCtx, isAvailable, missingCount, ingredientKey, effectiveChip,
  CATEGORY_ORDER, CATEGORY_LABEL,
} from './ingredients';
import type { StockCtx, IngredientEntry } from './ingredients';
import { runtimeCatalog } from './catalog';
import { parseSyrups } from './syrups';
import type { Syrup } from './syrups';
import { $ } from './dom';

/* ============================================================
   Rendering
   ============================================================ */
const main = $('#main');

const KEY_OPTS: Record<'group' | 'sort', [string, string][]> = {
  group: [['spirit', 'By spirit'], ['citrus', 'By citrus'], ['syrup', 'By syrup'], ['liqueur', 'By liqueur'], ['method', 'By method']],
  sort: [['base', 'Base spirit'], ['name', 'Name'], ['alcohol', 'Alcohol (est.)'], ['missing', 'Missing ingredients'], ['edited', 'Last modified']],
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

/** Inset top-right "find recipes with this ingredient" button. `key` is the search
 *  term fed into the recipe filter; `label` is the human name for the tooltip. */
export function findBtn(key: string, label: string): string {
  return `<button type="button" class="find" data-find="${esc(key)}" title="Find recipes with ${esc(label)}" tabindex="-1">`
    + `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="7" cy="7" r="5"/><path d="M11 11l3.5 3.5"/></svg>`
    + `</button>`;
}

export function chipHTML(i: Ingredient, ctx?: StockCtx, searchable = false): string {
  const { disp, color, shape } = effectiveChip(i);
  const { amount, tag } = amountTag(i);
  // Available/stocked chips stay plain; only flag what's missing (no ctx -> plain, e.g. modal preview).
  const cls = ctx && !isAvailable(i, ctx) ? ' unstocked' : '';
  return `<div class="chip${cls}">`
    + (shape ? icon(shape, color) : '<span class="ph"></span>')
    + `<span class="nm">${esc(disp)}</span>`
    + `<span class="qwrap">`
    + (tag ? `<span class="tag">${tag}</span>` : '')
    + (amount ? `<span class="q">${esc(amount)}</span>` : '')
    + `</span>`
    + (searchable ? findBtn(ingredientKey(i), disp) : '')
    + `</div>`;
}

function cardHTML(d: Derived, idx: number, ctx?: StockCtx): string {
  const baseL = d.base ? SPIRIT_LABEL[d.base] || titleCase(d.base) : '—';
  const drinks = +(d.alc / 0.6).toFixed(2);
  const meta = [
    `<span><b>${esc(baseL)}</b></span>`,
    `<span>${d.p.method}</span>`,
    `<span class="alc">${drinks} ${drinks === 1 ? 'drink' : 'drinks'}</span>`,
  ].join('');
  return `<article class="card" style="animation-delay:${Math.min(idx * 28, 420)}ms">`
    + `<button class="edit" data-edit="${esc(d.rec.name)}" title="edit"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M11 2l3 3-8 8-4 1 1-4z"/></svg></button>`
    + `<div class="head"><h2>${esc(d.rec.name)}${d.rec.author ? ` <span class="byline">${esc(d.rec.author)}</span>` : ''}</h2><div class="meta">${meta}</div></div>`
    + d.p.ingredients.map(i => chipHTML(i, ctx, true)).join('')
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
  if (state.page === 'ingredients') { renderIngredients(); return; }
  if (state.page === 'syrups') { renderSyrups(); return; }

  const data = state.records.map(derive).filter(matchQuery);
  $('#count').textContent = state.records.length + ' recipes';
  if (!data.length) { main.innerHTML = '<div class="empty">No recipes match.</div>'; return; }

  const ctx = buildStockCtx(runtimeCatalog(state.records), state.stocked);

  if (state.mode === 'sort') {
    const arr = [...data];
    if (state.key === 'name') arr.sort((a, b) => a.rec.name.localeCompare(b.rec.name));
    else if (state.key === 'alcohol') arr.sort((a, b) => b.alc - a.alc);
    else if (state.key === 'missing') arr.sort((a, b) => missingCount(a.p.ingredients, ctx) - missingCount(b.p.ingredients, ctx) || a.rec.name.localeCompare(b.rec.name));
    else if (state.key === 'edited') arr.sort((a, b) => (b.rec.edited || '').localeCompare(a.rec.edited || '') || a.rec.name.localeCompare(b.rec.name));
    else { // base spirit
      const oi = (f: string | null) => { const x = SPIRIT_ORDER.indexOf(f as string); return x < 0 ? 99 : x; };
      arr.sort((a, b) => oi(a.base) - oi(b.base) || a.rec.name.localeCompare(b.rec.name));
    }
    const lbl = KEY_OPTS.sort.find(o => o[0] === state.key)![1];
    main.innerHTML = `<div class="grouphead"><span class="lbl">Sorted · ${lbl}</span><span class="cnt">${arr.length}</span><span class="rule"></span></div>`
      + `<div class="grid">${arr.map((d, i) => cardHTML(d, i, ctx)).join('')}</div>`;
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
    html += `<div class="grid">${items.map(d => cardHTML(d, gi++, ctx)).join('')}</div>`;
  }
  main.innerHTML = html;
  requestAnimationFrame(layoutCards);
}

/* ---------- syrups page (read-only reference) ---------- */

function syrupCardHTML(s: Syrup, idx: number): string {
  return `<article class="card syrup" style="animation-delay:${Math.min(idx * 28, 420)}ms">`
    + `<div class="head"><h2>${esc(s.name)}</h2></div>`
    + `<ol class="steps">${s.steps.map(t => `<li>${esc(t)}</li>`).join('')}</ol>`
    + `</article>`;
}

export function renderSyrups(): void {
  const syrups = parseSyrups();
  $('#count').textContent = `${syrups.length} syrup${syrups.length === 1 ? '' : 's'}`;
  if (!syrups.length) { main.innerHTML = '<div class="empty">No syrups.</div>'; return; }
  main.innerHTML = `<div class="grouphead"><span class="lbl">Syrups</span><span class="cnt">${syrups.length}</span><span class="rule"></span></div>`
    + `<div class="grid">${syrups.map((s, i) => syrupCardHTML(s, i)).join('')}</div>`;
}

/* ---------- ingredients page ---------- */

const IG_TITLE = {
  stocked: 'In stock — click to mark out',
  out: 'Out of stock — click to mark stocked',
} as const;

/** Toggle one ingredient chip in place after its stock state changed, and refresh
 *  the header count — avoids rebuilding #main (which jumps the scroll position).
 *  Safe because on the ingredients page each catalog key maps to exactly one chip
 *  and stocking one item never changes another's display. */
export function updateIngredientChip(el: HTMLElement): void {
  const stocked = state.stocked.has(el.dataset.ing!);
  el.classList.toggle('unstocked', !stocked);
  el.title = stocked ? IG_TITLE.stocked : IG_TITLE.out;
  const chips = main.querySelectorAll<HTMLElement>('.chip.ig');
  const n = [...chips].filter(c => !c.classList.contains('unstocked')).length;
  $('#count').textContent = `${n} of ${chips.length} stocked`;
}

function igChipHTML(e: IngredientEntry, stocked: boolean): string {
  const cls = 'chip ig' + (stocked ? '' : ' unstocked');
  const title = stocked ? IG_TITLE.stocked : IG_TITLE.out;
  return `<div class="${cls}" data-ing="${esc(e.key)}" title="${esc(title)}">`
    + `<button type="button" class="ig-edit-btn" data-ig-edit="${esc(e.key)}" title="Edit ${esc(e.disp)}" tabindex="-1">`
    + `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M11 2l3 3-8 8-4 1 1-4z"/></svg></button>`
    + (e.shape ? icon(e.shape, e.color) : '<span class="ph"></span>')
    + `<span class="nm">${esc(e.disp)}</span>`
    + `<span class="qwrap"><span class="tag">${e.count} use${e.count === 1 ? '' : 's'}</span></span>`
    + findBtn(e.key, e.disp)
    + `</div>`;
}

export function renderIngredients(): void {
  const { entries } = runtimeCatalog(state.records);
  const total = entries.length;
  const stockedCount = entries.reduce((n, e) => n + (state.stocked.has(e.key) ? 1 : 0), 0);
  $('#count').textContent = `${stockedCount} of ${total} stocked`;
  if (!total) { main.innerHTML = '<div class="empty">No ingredients yet.</div>'; return; }

  const byCat = new Map<string, IngredientEntry[]>();
  for (const e of entries) {
    let arr = byCat.get(e.cat);
    if (!arr) { arr = []; byCat.set(e.cat, arr); }
    arr.push(e);
  }
  const cats = [...CATEGORY_ORDER, ...[...byCat.keys()].filter(c => !CATEGORY_ORDER.includes(c))];

  // An umbrella is a real group only when it has more than one member; lone
  // items (their own "self:" umbrella, or a family with no siblings) are singletons.
  const umbCount = new Map<string, number>();
  for (const e of entries) umbCount.set(e.umbrella, (umbCount.get(e.umbrella) ?? 0) + 1);
  const grouped = (e: IngredientEntry) => (umbCount.get(e.umbrella) ?? 0) > 1;

  let html = '';
  for (const cat of cats) {
    const items = byCat.get(cat);
    if (!items || !items.length) continue;
    // Grouped items first (clustered by umbrella), then singletons; alpha within each.
    items.sort((a, b) => {
      const ga = grouped(a), gb = grouped(b);
      if (ga !== gb) return ga ? -1 : 1;
      if (ga && a.umbrella !== b.umbrella) return a.umbrella.localeCompare(b.umbrella);
      return a.disp.localeCompare(b.disp);
    });
    html += `<div class="grouphead"><span class="lbl">${esc(CATEGORY_LABEL[cat] || titleCase(cat))}</span><span class="cnt">${items.length}</span><span class="rule"></span></div>`;
    html += `<div class="ig-grid">${items.map(e => igChipHTML(e, state.stocked.has(e.key))).join('')}</div>`;
  }
  main.innerHTML = html;
  requestAnimationFrame(layoutCards);
}

/** Min chip border-box width that keeps the top-right find button off the icon. */
const FIND_FLOOR = 76;

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
  const v = Math.ceil(w + extra + 0.5);
  // Reserve width so the inset top-right find button clears the centered 30px icon.
  return c.querySelector('.find') ? Math.max(v, FIND_FLOOR) : v;
}

/** Fit each chip in a container to its widest wrapped line, then equalize heights. */
function layoutChipGroup(container: HTMLElement): void {
  const chips = [...container.querySelectorAll<HTMLElement>('.chip')];
  if (!chips.length) return;
  chips.forEach(c => { c.style.height = ''; c.style.width = ''; });
  // Shrink each chip to its widest wrapped line — no dead horizontal space.
  const widths = chips.map(chipNeededWidth);
  chips.forEach((c, k) => { c.style.width = widths[k] + 'px'; });
  // Equalize every chip to the tallest; CSS distributes contents top-to-bottom.
  const maxH = Math.max(...chips.map(c => c.offsetHeight));
  chips.forEach(c => { c.style.height = maxH + 'px'; });
}

export function layoutCards(): void {
  // Recipe cards and ingredient-category grids both get the same chip fitting.
  document.querySelectorAll<HTMLElement>('#main .card, #main .ig-grid').forEach(layoutChipGroup);
}
