import { state, setIngredientOverride, resetIngredientOverride } from './state';
import { CATEGORY_ORDER, CATEGORY_LABEL } from './ingredients';
import { editableEntry, isKnownKey, isSeedKey, UMBRELLA_PARENTS, reconcileStock } from './catalog';
import { icon } from './icons';
import { titleCase, FAMILY_LABEL } from './parser';
import { render, esc } from './render';
import { $ } from './dom';

/* ============================================================
   Edit ingredient modal: name + category + icon builder
   (outline picker + colour adjuster, writing into the override store)
   ============================================================ */

/** Outline shapes offered by the picker, roughly grouped vessel → fruit → garnish.
 *  Only currently-used designs are offered; the superseded shapes fizz, ring, ellipse,
 *  diamond and leaf were dropped (no ingredient or auto-classifier uses them). Their
 *  icon() definitions remain as harmless fallbacks for any stale stored override. */
const SHAPES = [
  'squircle', 'hexagon', 'glass', 'bottle', 'dropper', 'triangle', 'droplet',
  'circle', 'wheel', 'wedge', 'cube',
  'sprig', 'seed', 'ginger', 'egg', 'twist', 'cherry', 'berry',
];

let editingKey: string | null = null;
let editingShape: string | null = null;
let editingColor = '#C99A5B';
let editingUmbrellas: string[] = [];
let editingAliases: string[] = [];

const umbLabel = (u: string): string => FAMILY_LABEL[u] || titleCase(u);

/** Populate the category <select> once, from the catalog category order. */
export function fillIgCat(): void {
  const sel = $<HTMLSelectElement>('#igCat');
  sel.innerHTML = '';
  for (const c of CATEGORY_ORDER) {
    const o = document.createElement('option');
    o.value = c; o.textContent = CATEGORY_LABEL[c] || titleCase(c);
    sel.appendChild(o);
  }
}

/** Wire the builder's interactive bits once at startup. */
export function initIgBuilder(): void {
  $('#igShapes').addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.ig-shape');
    if (!b) return;
    editingShape = b.dataset.shape || null;
    renderBuilder();
  });
  $<HTMLInputElement>('#igColor').addEventListener('input', e => {
    editingColor = (e.target as HTMLInputElement).value;
    renderBuilder();
  });
  // Umbrellas: pick a parent from the dropdown to add it.
  $<HTMLSelectElement>('#igUmbSel').addEventListener('change', e => {
    const v = (e.target as HTMLSelectElement).value;
    if (v && !editingUmbrellas.includes(v)) editingUmbrellas.push(v);
    renderRelations();
  });
  // Aliases: type + Enter to add.
  $<HTMLInputElement>('#igAliasInput').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const inp = e.target as HTMLInputElement;
    const v = inp.value.trim().toLowerCase();
    if (v && !editingAliases.includes(v)) editingAliases.push(v);
    inp.value = '';
    renderRelations();
  });
  // Deletable chips in both lists.
  const del = (e: Event) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-rel]');
    if (!b) return;
    const val = b.dataset.val!;
    if (b.dataset.rel === 'umb') editingUmbrellas = editingUmbrellas.filter(u => u !== val);
    else editingAliases = editingAliases.filter(a => a !== val);
    renderRelations();
  };
  $('#igUmbChips').addEventListener('click', del);
  $('#igAliasChips').addEventListener('click', del);
}

/** One deletable pill in the umbrella/alias editors. */
function relChip(val: string, label: string, kind: 'umb' | 'alias'): string {
  return `<span class="rel-chip">${esc(label)}<button type="button" data-rel="${kind}" data-val="${esc(val)}" title="remove" tabindex="-1">×</button></span>`;
}

/** Redraw the umbrella + alias chip lists and the umbrella dropdown options. */
function renderRelations(): void {
  $('#igUmbChips').innerHTML = editingUmbrellas.length
    ? editingUmbrellas.map(u => relChip(u, umbLabel(u), 'umb')).join('')
    : '<span class="rel-empty">none</span>';
  const sel = $<HTMLSelectElement>('#igUmbSel');
  const avail = UMBRELLA_PARENTS.filter(p => !editingUmbrellas.includes(p));
  sel.innerHTML =
    '<option value="">add umbrella…</option>' +
    avail
      .map((p) => `<option value="${esc(p)}">${esc(umbLabel(p))}</option>`)
      .join("");
  sel.disabled = !avail.length;
  $('#igAliasChips').innerHTML = editingAliases.length
    ? editingAliases.map(a => relChip(a, a, 'alias')).join('')
    : '<span class="rel-empty">none</span>';
}

/** Draw the preview, colour input and shape tiles for the current selection. */
function renderBuilder(): void {
  $('#igIconPrev').innerHTML = editingShape ? icon(editingShape, editingColor) : '<span class="ph"></span>';
  $<HTMLInputElement>('#igColor').value = editingColor;
  const tile = (shape: string | null, html: string) =>
    `<button type="button" class="ig-shape${shape === editingShape ? ' on' : ''}" data-shape="${shape ?? ''}" title="${shape ?? 'no icon'}">${html}</button>`;
  $('#igShapes').innerHTML =
    tile(null, '<span class="ig-none">—</span>')
    + SHAPES.map(s => tile(s, icon(s, editingColor))).join('');
}

/** Open the modal to edit an existing ingredient (key) or add a new one (null).
 *  `prefillName` seeds the name field of a new ingredient (e.g. when jumping from
 *  a recipe chip that nothing in the list matches). */
export function openIgModal(key: string | null, prefillName = ''): void {
  const sel = $<HTMLSelectElement>('#igCat');
  if (key === null) {
    editingKey = null;
    editingShape = null;
    editingColor = '#C99A5B';
    editingUmbrellas = [];
    editingAliases = [];
    $('#igTitle').textContent = 'Add ingredient';
    $<HTMLInputElement>('#igName').value = prefillName;
    $<HTMLInputElement>('#igAbv').value = '';
    sel.value = CATEGORY_ORDER[0]!;
    $<HTMLElement>('#igRemove').style.display = 'none';
    $<HTMLElement>('#igReset').style.display = 'none';
  } else {
    const entry = editableEntry(key);   // catalog entry, or a synthesized one for a hidden generic
    if (!entry) return;
    editingKey = key;
    editingShape = entry.shape;
    editingColor = entry.color;
    editingUmbrellas = [...entry.umbrellas];
    editingAliases = [...entry.aliases];
    $('#igTitle').textContent = 'Edit ingredient';
    $<HTMLInputElement>('#igName').value = entry.disp;
    // ABV stored as a 0–1 fraction; shown as a percentage.
    $<HTMLInputElement>('#igAbv').value = entry.abv ? String(+(entry.abv * 100).toFixed(1)) : '0';
    // The category may be one the select doesn't list (rare fall-through cat) — add it.
    if (![...sel.options].some(o => o.value === entry.cat)) {
      const o = document.createElement('option');
      o.value = entry.cat; o.textContent = CATEGORY_LABEL[entry.cat] || titleCase(entry.cat);
      sel.appendChild(o);
    }
    sel.value = entry.cat;
    $<HTMLElement>('#igRemove').style.display = 'block';
    // Reset only applies to seed ingredients with an edit (added ones use Remove).
    $<HTMLElement>('#igReset').style.display = (isSeedKey(key) && state.ingredients[key]) ? 'block' : 'none';
  }
  renderBuilder();
  renderRelations();
  $('#igOverlay').classList.add('open');
  $<HTMLInputElement>('#igName').focus();
}

export function closeIgModal(): void { $('#igOverlay').classList.remove('open'); editingKey = null; }

export function saveIgModal(): void {
  const disp = $<HTMLInputElement>('#igName').value.trim();
  if (!disp) { flashName(); return; }
  // ABV entered as a percentage; persist as a 0–1 fraction (blank → 0).
  const pct = parseFloat($<HTMLInputElement>('#igAbv').value);
  const abv = Number.isFinite(pct) ? Math.max(0, Math.min(1, pct / 100)) : 0;
  const patch = {
    disp, cat: $<HTMLSelectElement>('#igCat').value, color: editingColor, shape: editingShape, abv,
    umbrellas: [...editingUmbrellas], aliases: [...editingAliases],
  };
  if (editingKey) {
    setIngredientOverride(editingKey, patch);
  } else {
    // New ingredient: key from the name; block if it collides with an existing one.
    const key = disp.toLowerCase().replace(/\s+juice$/, '').trim();
    if (isKnownKey(key)) { flashName(); return; }
    setIngredientOverride(key, patch);
  }
  reconcileStock(state.records);   // a now-hidden ingredient (e.g. self-tag removed) shouldn't stay stocked
  closeIgModal();
  render();
}

export function resetIgModal(): void {
  if (!editingKey) return;
  resetIngredientOverride(editingKey);
  reconcileStock(state.records);
  closeIgModal();
  render();
}

/** Remove a seed ingredient (tombstone so it stays hidden) or delete an added one. */
export function removeIgModal(): void {
  if (!editingKey) return;
  if (isSeedKey(editingKey)) setIngredientOverride(editingKey, { removed: true });
  else resetIngredientOverride(editingKey);
  reconcileStock(state.records);
  closeIgModal();
  render();
}

function flashName(): void {
  const w = $<HTMLInputElement>('#igName');
  w.style.borderColor = '#e88';
  setTimeout(() => w.style.borderColor = '', 600);
}
