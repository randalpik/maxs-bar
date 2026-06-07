import { state, setIngredientOverride, resetIngredientOverride } from './state';
import { buildCatalog, CATEGORY_ORDER, CATEGORY_LABEL } from './ingredients';
import { icon } from './icons';
import { titleCase } from './parser';
import { render } from './render';
import { $ } from './dom';

/* ============================================================
   Edit ingredient modal (name + category; icon builder lives here later)
   ============================================================ */
let editingKey: string | null = null;

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

export function openIgModal(key: string): void {
  const entry = buildCatalog(state.records).entries.find(e => e.key === key);
  if (!entry) return;
  editingKey = key;
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
  $('#igIconPrev').innerHTML = entry.shape ? icon(entry.shape, entry.color) : '<span class="ph"></span>';
  $<HTMLElement>('#igReset').style.display = state.ingredients[key] ? 'block' : 'none';
  $('#igOverlay').classList.add('open');
  $<HTMLInputElement>('#igName').focus();
}

export function closeIgModal(): void { $('#igOverlay').classList.remove('open'); editingKey = null; }

export function saveIgModal(): void {
  if (!editingKey) return;
  const disp = $<HTMLInputElement>('#igName').value.trim();
  const cat = $<HTMLSelectElement>('#igCat').value;
  if (!disp) { return; }
  setIngredientOverride(editingKey, { disp, cat });
  closeIgModal();
  render();
}

export function resetIgModal(): void {
  if (!editingKey) return;
  resetIngredientOverride(editingKey);
  closeIgModal();
  render();
}
