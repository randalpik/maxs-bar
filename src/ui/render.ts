import type { Derived, FoodCat, Ingredient, Profile } from '../core/types';
import { state, derive } from '../core/state';
import { FAMILY_LABEL, SPIRIT_FAMILIES, METHOD_ORDER, titleCase } from '../parser/parser';
import { FOOD_CATS, FOOD_CAT_LABEL, DEFAULT_FOOD_CAT } from '../recipes/food';
import { icon, amountTag } from '../ingredients/icons';
import {
  buildStockCtx, isAvailable, missingCount, ingredientKey, effectiveChip,
  SECTION_ORDER, SECTION_LABEL,
} from '../ingredients/ingredients';
import type { StockCtx, IngredientEntry } from '../ingredients/ingredients';
import { runtimeCatalog } from '../ingredients/catalog';
import { CATEGORIES_ID, HOME_ID, OTHER_CAT, profileCats, effectiveCat, catLabel } from '../profiles/profiles';
import { parseSyrups } from '../recipes/syrups';
import type { Syrup } from '../recipes/syrups';
import { $ } from '../core/dom';

/* ============================================================
   Rendering
   ============================================================ */
const main = $('#main');

const COCKTAIL_KEYS: Record<"group" | "sort", [string, string][]> = {
  group: [
    ["spirit", "By spirit"],
    ["citrus", "By citrus"],
    ["syrup", "By syrup"],
    ["liqueur", "By liqueur"],
    ["method", "By method"],
  ],
  sort: [
    ["base", "By base spirit"],
    ["name", "By name"],
    ["alcohol", "By ABV"],
    ["missing", "By missing ingredients"],
    ["edited", "By date modified"],
  ],
};
// Food drops base/method/alcohol (meaningless) and groups/sorts by its category.
const FOOD_KEYS: Record<"group" | "sort", [string, string][]> = {
  group: [["category", "By category"]],
  sort: [
    ["category", "By category"],
    ["name", "By name"],
    ["missing", "By missing ingredients"],
    ["edited", "By date modified"],
  ],
};

/** The group/sort key options for the current page + mode. */
function keyOpts(): [string, string][] {
  return (state.page === 'food' ? FOOD_KEYS : COCKTAIL_KEYS)[state.mode];
}

/** A food recipe's category (defaulting if somehow unset). */
function foodCatOf(d: Derived): FoodCat {
  return d.rec.foodCat ?? DEFAULT_FOOD_CAT;
}

export function fillKeySel(): void {
  const sel = $<HTMLSelectElement>('#keySel');
  sel.innerHTML = '';
  const opts = keyOpts();
  for (const [v, l] of opts) {
    const o = document.createElement('option');
    o.value = v; o.textContent = l; sel.appendChild(o);
  }
  if (!opts.some(o => o[0] === state.key)) state.key = opts[0]![0];
  sel.value = state.key;
}

function matchQuery(d: Derived): boolean {
  if (!state.query) return true;
  const q = state.query.toLowerCase();
  if (d.rec.name.toLowerCase().includes(q)) return true;
  if (d.p.method.toLowerCase().includes(q)) return true; // shaken / stirred / built
  // Beyond the ingredient name, match its structural words too: unit (oz, tsp…),
  // category (spirit, syrup…), spirit family (whiskey…), role (dash, top…) and
  // process (muddle, float, garnish…) — so e.g. "muddle" or "tsp" find recipes.
  return d.p.ingredients.some(i =>
    [i.disp, i.name, i.cat, i.fam, i.unit, i.role, i.process]
      .some(v => v != null && v.toLowerCase().includes(q)));
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

/** Inset top-left "open this ingredient on the Ingredients page" button (recipe
 *  chips only). `key` is the stock identity; `label` is the human name. */
export function gotoBtn(key: string, label: string): string {
  return `<button type="button" class="goto-ig" data-goto-ig="${esc(key)}" title="Open ${esc(label)} in ingredients" tabindex="-1">`
    + `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">`
    + `<path d="M6 3.5h8M6 8h8M6 12.5h8"/><circle cx="2.6" cy="3.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="2.6" cy="8" r="1.1" fill="currentColor" stroke="none"/><circle cx="2.6" cy="12.5" r="1.1" fill="currentColor" stroke="none"/>`
    + `</svg></button>`;
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
    + (searchable ? gotoBtn(ingredientKey(i), disp) + findBtn(ingredientKey(i), disp) : '')
    + `</div>`;
}

function cardHTML(d: Derived, idx: number, ctx?: StockCtx): string {
  let meta: string;
  if (d.rec.recipeType === 'food') {
    // Food shows just its category in place of base-spirit/method/ABV.
    meta = `<span><b>${esc(FOOD_CAT_LABEL[foodCatOf(d)])}</b></span>`;
  } else {
    const baseL = d.base ? FAMILY_LABEL[d.base] || titleCase(d.base) : '—';
    const drinks = +(d.alc / 0.6).toFixed(2);
    meta = [
      `<span><b>${esc(baseL)}</b></span>`,
      `<span>${d.p.method}</span>`,
      `<span class="alc">${drinks} ${drinks === 1 ? 'drink' : 'drinks'}</span>`,
    ].join('');
  }
  return `<article class="card" style="animation-delay:${Math.min(idx * 28, 420)}ms">`
    + `<button class="edit" data-edit="${esc(d.rec.name)}" title="edit"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M11 2l3 3-8 8-4 1 1-4z"/></svg></button>`
    + `<div class="head"><h2>${esc(d.rec.name)}${d.rec.author ? ` <span class="byline">${esc(d.rec.author)}</span>` : ''}</h2><div class="meta">${meta}</div></div>`
    + d.p.ingredients.map(i => chipHTML(i, ctx, true)).join('')
    + `</article>`;
}

function groupsFor(d: Derived): string[] {
  if (state.key === 'spirit') { const s = [...new Set(d.p.ingredients.filter(i => i.cat === 'spirit' || (i.cat === 'fortified' && i.fam)).map(i => i.fam))]; return s.length ? (s as string[]) : ['—']; }
  if (state.key === 'citrus') { const s = [...new Set(d.p.ingredients.filter(i => i.cat === 'citrus').map(i => i.citrus))]; return s.length ? (s as string[]) : ['—']; }
  if (state.key === 'syrup') { const s = [...new Set(d.p.ingredients.filter(i => i.cat === 'syrup').map(i => i.syrup))]; return s.length ? (s as string[]) : ['—']; }
  if (state.key === 'liqueur') { const s = [...new Set(d.p.ingredients.filter(i => i.cat === 'liqueur').map(i => i.disp))]; return s.length ? s : ['—']; }
  if (state.key === 'method') { return [d.p.method]; }
  if (state.key === 'category') { return [foodCatOf(d)]; }
  return ['—'];
}

function groupLabel(g: string): string {
  if (state.key === 'spirit') return FAMILY_LABEL[g] || titleCase(g);
  if (state.key === 'syrup') return g === 'generic' ? 'Syrup' : titleCase(g) + ' syrup';
  if (state.key === 'category') return FOOD_CAT_LABEL[g as FoodCat] || titleCase(g);
  return titleCase(g);
}

function groupSortKeys(): string[] | null {
  if (state.key === 'spirit') return SPIRIT_FAMILIES;
  if (state.key === 'method') return METHOD_ORDER;
  if (state.key === 'category') return FOOD_CATS;
  return null;
}

/** A category section: its header and grid wrapped in one bordered box, so the
 *  whole group reads as a unit (the `.group` panel in styles.css). `gridClass` is
 *  'grid' for recipe/syrup cards, 'ig-grid' for the ingredients page. */
function groupSection(label: string, count: number, body: string, gridClass = 'grid', dataCat?: string): string {
  return `<section class="group">`
    + `<div class="grouphead"><span class="lbl">${esc(label)}</span><span class="cnt">${count}</span><span class="rule"></span></div>`
    + `<div class="${gridClass}"${dataCat !== undefined ? ` data-cat="${esc(dataCat)}"` : ''}>${body}</div>`
    + `</section>`;
}

export function render(): void {
  if (state.page === 'ingredients') { renderIngredients(); return; }
  if (state.page === 'syrups') { renderSyrups(); return; }

  // Cocktails and Food share this path; each page shows only its own recipe kind.
  const foodPage = state.page === 'food';
  const pageRecs = state.records.filter(r => (r.recipeType === 'food') === foodPage);
  const data = pageRecs.map(derive).filter(matchQuery);
  $('#count').textContent = `${pageRecs.length} ${foodPage ? 'dishes' : 'recipes'}`;
  if (!pageRecs.length) { main.innerHTML = `<div class="empty">${foodPage ? 'No food recipes yet — add one with “+ Add”.' : 'No recipes yet.'}</div>`; return; }
  if (!data.length) { main.innerHTML = '<div class="empty">No recipes match.</div>'; return; }

  const ctx = buildStockCtx(runtimeCatalog(state.records), state.stocked);

  if (state.mode === 'sort') {
    const arr = [...data];
    if (state.key === 'name') arr.sort((a, b) => a.rec.name.localeCompare(b.rec.name));
    else if (state.key === 'alcohol') arr.sort((a, b) => b.alc - a.alc);
    else if (state.key === 'missing') arr.sort((a, b) => missingCount(a.p.ingredients, ctx) - missingCount(b.p.ingredients, ctx) || a.rec.name.localeCompare(b.rec.name));
    else if (state.key === 'edited') arr.sort((a, b) => (b.rec.edited || '').localeCompare(a.rec.edited || '') || a.rec.name.localeCompare(b.rec.name));
    else if (state.key === 'category') { // food category
      const oi = (c: FoodCat) => { const x = FOOD_CATS.indexOf(c); return x < 0 ? 99 : x; };
      arr.sort((a, b) => oi(foodCatOf(a)) - oi(foodCatOf(b)) || a.rec.name.localeCompare(b.rec.name));
    }
    else { // base spirit
      const oi = (f: string | null) => { const x = SPIRIT_FAMILIES.indexOf(f as string); return x < 0 ? 99 : x; };
      arr.sort((a, b) => oi(a.base) - oi(b.base) || a.rec.name.localeCompare(b.rec.name));
    }

    // Binnable sorts (base spirit, missing ingredients, food category) split into category headers
    // like group mode. The array is already in bin order, so grouping it into a
    // Map (insertion-ordered) yields the bins in the right order, name-sorted within.
    if (state.key === 'base' || state.key === 'missing' || state.key === 'category') {
      const binKey = (d: Derived): string =>
        state.key === 'base' ? (d.base || '—')
        : state.key === 'category' ? foodCatOf(d)
        : String(missingCount(d.p.ingredients, ctx));
      const binLabel = (k: string): string => {
        if (state.key === 'base') return k === '—' ? '—' : (FAMILY_LABEL[k] || titleCase(k));
        if (state.key === 'category') return FOOD_CAT_LABEL[k as FoodCat] || titleCase(k);
        return k === '0' ? 'Ready to make' : `${k} missing`;
      };
      const bins = new Map<string, Derived[]>();
      for (const d of arr) { const k = binKey(d); (bins.get(k) ?? bins.set(k, []).get(k)!).push(d); }
      let html = '', gi = 0;
      for (const [k, items] of bins) {
        html += groupSection(binLabel(k), items.length, items.map(d => cardHTML(d, gi++, ctx)).join(''));
      }
      main.innerHTML = html;
      scheduleLayout();
      return;
    }

    const lbl = keyOpts().find(o => o[0] === state.key)![1];
    main.innerHTML = groupSection(`Sorted · ${lbl}`, arr.length, arr.map((d, i) => cardHTML(d, i, ctx)).join(''));
    scheduleLayout();
    return;
  }

  // group mode — recipes that don't match the grouping (e.g. no syrup) are dropped
  // rather than collected into a catch-all "—" bin.
  const map = new Map<string, Derived[]>();
  for (const d of data) {
    for (const g of groupsFor(d)) {
      if (g === '—') continue;
      let arr = map.get(g);
      if (!arr) { arr = []; map.set(g, arr); }
      arr.push(d);
    }
  }
  if (!map.size) { main.innerHTML = '<div class="empty">No recipes match this grouping.</div>'; return; }
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
    html += groupSection(groupLabel(g), items.length, items.map(d => cardHTML(d, gi++, ctx)).join(''));
  }
  main.innerHTML = html;
  scheduleLayout();
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
  main.innerHTML = groupSection('Syrups', syrups.length, syrups.map((s, i) => syrupCardHTML(s, i)).join(''));
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
  // One chip serves both affordances: tap toggles stock, drag rearranges placement
  // (drag is armed on any real profile — see drag.ts). The toggle title is the primary
  // hint; a >5px drag suppresses the trailing click so it never toggles by accident.
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

/** Profile view (any real profile — Home or custom): ingredients bucketed into the
 *  profile's categories by effectiveCat and ordered by stored position. One screen does
 *  both jobs at once — tap a chip to toggle stock, drag it to rearrange placement. Every
 *  profile category is rendered (empty ones included) as a drop target. hideUnstocked
 *  drops unstocked entries (a per-profile filter); hideOther drops the implicit Other
 *  group, which also makes it undraggable-into. */
function renderProfile(p: Profile, entries: IngredientEntry[]): void {
  const shown = p.hideUnstocked ? entries.filter(e => state.stocked.has(e.key)) : entries;
  const stockedCount = entries.reduce((n, e) => n + (state.stocked.has(e.key) ? 1 : 0), 0);
  $('#count').textContent = `${stockedCount} of ${entries.length} stocked`;

  const cats = profileCats(p).filter(c => !(p.hideOther && c === OTHER_CAT));
  const byCat = new Map<string, IngredientEntry[]>(cats.map(id => [id, []]));
  for (const e of shown) byCat.get(effectiveCat(p, e.key, e.defaultLoc))?.push(e); // hideOther: Other entries just aren't shown

  let html = '';
  for (const id of cats) {
    const items = byCat.get(id)!;
    items.sort((a, b) => {
      const pa = p.placements[a.key]?.pos ?? Infinity, pb = p.placements[b.key]?.pos ?? Infinity;
      return pa - pb || a.disp.localeCompare(b.disp);
    });
    const body = items.map(e => igChipHTML(e, state.stocked.has(e.key))).join('');
    html += groupSection(catLabel(id), items.length, body, 'ig-grid loc-grid', id);
  }
  main.innerHTML = html || '<div class="empty">No ingredients to show.</div>';
  scheduleLayout();
}

/** (Re)fill the profile selector and sync the Categories-sentinel toolbar class.
 *  Runs on every ingredients render, so the toolbar tracks profile changes from any
 *  source — modal saves, deletions, sync pulls. The option rebuild is skipped when
 *  nothing changed so an open dropdown isn't disturbed mid-interaction. */
export function fillProfileSel(): void {
  const sel = $<HTMLSelectElement>('#profileSel');
  const customs = Object.values(state.profiles)
    .filter(p => !p.deleted && p.id !== HOME_ID)
    .sort((a, b) => a.name.localeCompare(b.name));
  const opts: [string, string][] = [
    [CATEGORIES_ID, 'Categories'],
    [HOME_ID, state.profiles[HOME_ID]?.name ?? 'Home'],
    ...customs.map(p => [p.id, p.name] as [string, string]),
    ['__add', 'Add profile…'],
  ];
  const sig = JSON.stringify(opts) + '|' + state.profileId;
  if (sel.dataset.sig !== sig) {
    sel.dataset.sig = sig;
    sel.innerHTML = '';
    for (const [v, l] of opts) {
      const o = document.createElement('option');
      o.value = v; o.textContent = l; sel.appendChild(o);
    }
    sel.value = state.profileId;
  }
  $('.bar').classList.toggle('profile-categories', state.profileId === CATEGORIES_ID);
}

export function renderIngredients(): void {
  fillProfileSel();
  const { entries } = runtimeCatalog(state.records);
  const total = entries.length;
  if (!total) { main.innerHTML = '<div class="empty">No ingredients yet.</div>'; $('#count').textContent = '0 of 0 stocked'; return; }
  const profile = state.profiles[state.profileId];
  if (state.profileId !== CATEGORIES_ID && profile && !profile.deleted) { renderProfile(profile, entries); return; }
  // Categories sentinel: the taxonomy view (no placements, so no drag — just stock toggling).
  const stockedCount = entries.reduce((n, e) => n + (state.stocked.has(e.key) ? 1 : 0), 0);
  $('#count').textContent = `${stockedCount} of ${total} stocked`;

  // Section == category now; group directly by the entry's category.
  const byCat = new Map<string, IngredientEntry[]>();
  for (const e of entries) {
    let arr = byCat.get(e.cat);
    if (!arr) { arr = []; byCat.set(e.cat, arr); }
    arr.push(e);
  }
  const cats = [...SECTION_ORDER, ...[...byCat.keys()].filter(c => !SECTION_ORDER.includes(c))];

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
    html += groupSection(SECTION_LABEL[cat] || titleCase(cat), items.length, items.map(e => igChipHTML(e, state.stocked.has(e.key))).join(''), 'ig-grid');
  }
  main.innerHTML = html;
  scheduleLayout();
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
export function layoutChipGroup(container: HTMLElement): void {
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

/* Chip fitting measures wrapped-line widths, which only settle once the web fonts
   have loaded. Running it during the initial paint (before fonts arrive) forces a
   layout against the fallback font, then re-flows when fonts land — the "flash of
   unstyled content". So the FIRST layout is deferred to fonts.ready, and the page is
   held hidden (the inline `html:not(.ready) body` gate in index.html) until then.
   Once fonts are ready, every later render lays out synchronously in a rAF. */
let fontsReady = false;
function scheduleLayout(): void {
  if (fontsReady) requestAnimationFrame(layoutCards);
  // else: the fonts.ready handler below runs the first layout once fonts arrive.
}

const whenFonts = document.fonts?.ready ?? Promise.resolve();
whenFonts.then(() => {
  fontsReady = true;
  layoutCards();                                  // first layout, with correct font metrics
  document.documentElement.classList.add('ready'); // reveal the page (inline gate in index.html)
});
