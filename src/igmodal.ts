import { state, setIngredientOverride, resetIngredientOverride } from './state';
import { CATEGORY_ORDER, CATEGORY_LABEL } from './ingredients';
import { runtimeCatalog, isKnownKey, isSeedKey } from './catalog';
import { icon } from './icons';
import { titleCase } from './parser';
import { render } from './render';
import { $ } from './dom';

/* ============================================================
   Edit ingredient modal: name + category + icon builder
   (outline picker + colour adjuster, writing into the override store)
   ============================================================ */

/** Outline shapes offered by the picker, roughly grouped vessel → fruit → garnish. */
const SHAPES = [
  'squircle', 'hexagon', 'glass', 'bottle', 'dropper', 'triangle', 'droplet', 'fizz',
  'circle', 'ring', 'wheel', 'wedge', 'ellipse', 'diamond', 'cube',
  'leaf', 'sprig', 'seed', 'ginger', 'egg', 'twist', 'cherry', 'berry',
];

let editingKey: string | null = null;
let editingShape: string | null = null;
let editingColor = '#C99A5B';

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
    $('#igTitle').textContent = 'Add ingredient';
    $<HTMLInputElement>('#igName').value = prefillName;
    $<HTMLInputElement>('#igAbv').value = '';
    sel.value = CATEGORY_ORDER[0]!;
    $<HTMLElement>('#igRemove').style.display = 'none';
    $<HTMLElement>('#igReset').style.display = 'none';
  } else {
    const entry = runtimeCatalog(state.records).entries.find(e => e.key === key);
    if (!entry) return;
    editingKey = key;
    editingShape = entry.shape;
    editingColor = entry.color;
    $('#igTitle').textContent = `Edit ${entry.disp}`;
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
  const patch = { disp, cat: $<HTMLSelectElement>('#igCat').value, color: editingColor, shape: editingShape, abv };
  if (editingKey) {
    setIngredientOverride(editingKey, patch);
  } else {
    // New ingredient: key from the name; block if it collides with an existing one.
    const key = disp.toLowerCase().replace(/\s+juice$/, '').trim();
    if (isKnownKey(key)) { flashName(); return; }
    setIngredientOverride(key, patch);
  }
  closeIgModal();
  render();
}

export function resetIgModal(): void {
  if (!editingKey) return;
  resetIngredientOverride(editingKey);
  closeIgModal();
  render();
}

/** Remove a seed ingredient (tombstone so it stays hidden) or delete an added one. */
export function removeIgModal(): void {
  if (!editingKey) return;
  if (isSeedKey(editingKey)) setIngredientOverride(editingKey, { removed: true });
  else resetIngredientOverride(editingKey);
  closeIgModal();
  render();
}

function flashName(): void {
  const w = $<HTMLInputElement>('#igName');
  w.style.borderColor = '#e88';
  setTimeout(() => w.style.borderColor = '', 600);
}
