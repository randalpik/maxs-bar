import { state, setIngredientOverride, resetIngredientOverride } from './state';
import { buildCatalog, CATEGORY_ORDER, CATEGORY_LABEL } from './ingredients';
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
  'circle', 'ring', 'wheel', 'ellipse', 'diamond', 'cube',
  'leaf', 'sprig', 'seed', 'egg', 'twist', 'cherry', 'berry',
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

export function openIgModal(key: string): void {
  const entry = buildCatalog(state.records).entries.find(e => e.key === key);
  if (!entry) return;
  editingKey = key;
  editingShape = entry.shape;
  editingColor = entry.color;
  $('#igTitle').textContent = `Edit ${entry.disp}`;
  $<HTMLInputElement>('#igName').value = entry.disp;
  // The category may be one the select doesn't list (rare fall-through cat) — add it.
  const sel = $<HTMLSelectElement>('#igCat');
  if (![...sel.options].some(o => o.value === entry.cat)) {
    const o = document.createElement('option');
    o.value = entry.cat; o.textContent = CATEGORY_LABEL[entry.cat] || titleCase(entry.cat);
    sel.appendChild(o);
  }
  sel.value = entry.cat;
  renderBuilder();
  $<HTMLElement>('#igReset').style.display = state.ingredients[key] ? 'block' : 'none';
  $('#igOverlay').classList.add('open');
  $<HTMLInputElement>('#igName').focus();
}

export function closeIgModal(): void { $('#igOverlay').classList.remove('open'); editingKey = null; }

export function saveIgModal(): void {
  if (!editingKey) return;
  const disp = $<HTMLInputElement>('#igName').value.trim();
  if (!disp) return;
  setIngredientOverride(editingKey, {
    disp,
    cat: $<HTMLSelectElement>('#igCat').value,
    color: editingColor,
    shape: editingShape,
  });
  closeIgModal();
  render();
}

export function resetIgModal(): void {
  if (!editingKey) return;
  resetIngredientOverride(editingKey);
  closeIgModal();
  render();
}
