import { state, save } from '../core/state';
import type { FoodCat } from '../core/types';
import { parseLine } from '../parser/parser';
import { FOOD_CATS, FOOD_CAT_LABEL, DEFAULT_FOOD_CAT } from '../recipes/food';
import { nowISO } from '../core/util';
import { render, chipHTML, layoutChipGroup } from './render';
import { confirmModal } from './confirm';
import { $ } from '../core/dom';

/* ============================================================
   Add / edit modal
   ============================================================ */
let editingName: string | null = null;
/** The kind being added/edited — fixed by the record (edit) or the active tab (add).
 *  The editor never converts between kinds. */
let editingType: 'cocktail' | 'food' = 'cocktail';

const COCKTAIL_HINT = 'Format: <code>Name: 2 spirit, 3/4 lime, 3/4 syrup (method)</code>. Units default to oz. Tokens: <code>top</code>, <code>float</code>, <code>dash</code>, <code>muddled</code>, <code>(built)</code>, <code>(stirred)</code>. The recipe string is the source of truth.';
const FOOD_HINT = 'Format: <code>Name: ingredient, ingredient, …</code>. Pick a category above. Ingredient chips work just like cocktails — stocked items aren\'t flagged.';

/** Fill the food-category select (once is fine; values are stable). */
function ensureFoodCatOptions(): void {
  const sel = $<HTMLSelectElement>('#fFoodCat');
  if (sel.options.length) return;
  for (const c of FOOD_CATS) {
    const o = document.createElement('option');
    o.value = c; o.textContent = FOOD_CAT_LABEL[c]; sel.appendChild(o);
  }
}

export function openModal(name: string | null): void {
  editingName = name || null;
  const r = name ? state.records.find(x => x.name === name)! : null;
  editingType = r ? (r.recipeType === 'food' ? 'food' : 'cocktail') : (state.page === 'food' ? 'food' : 'cocktail');
  const food = editingType === 'food';
  const noun = food ? 'dish' : 'cocktail';
  $('#mTitle').textContent = `${name ? 'Edit' : 'Add'} ${noun}`;
  $('#mHint').innerHTML = food ? FOOD_HINT : COCKTAIL_HINT;
  $<HTMLElement>('#mDelete').style.display = name ? 'block' : 'none';
  ensureFoodCatOptions();
  $<HTMLElement>('#fFoodCatField').style.display = food ? '' : 'none';
  $<HTMLSelectElement>('#fFoodCat').value = (r?.foodCat as FoodCat) ?? DEFAULT_FOOD_CAT;
  if (r) {
    $<HTMLInputElement>('#fName').value = r.name;
    $<HTMLInputElement>('#fAuthor').value = r.author;
    $<HTMLTextAreaElement>('#fRecipe').value = r.recipe;
  } else {
    $<HTMLInputElement>('#fName').value = '';
    $<HTMLInputElement>('#fAuthor').value = '';
    $<HTMLTextAreaElement>('#fRecipe').value = '';
  }
  updatePreview();
  $('#overlay').classList.add('open');
  $<HTMLInputElement>('#fName').focus();
}

export function closeModal(): void { $('#overlay').classList.remove('open'); }

export function updatePreview(): void {
  const nm = $<HTMLInputElement>('#fName').value.trim() || 'Cocktail';
  const rc = $<HTMLTextAreaElement>('#fRecipe').value.trim();
  const p = parseLine(`${nm}: ${rc}`, editingType); // preview parses in the kind being edited
  $('#pvChips').innerHTML = (p && p.ingredients.length)
    ? p.ingredients.map(i => chipHTML(i)).join('')
    : '<span style="color:var(--faint);font-size:11px">…</span>';
  // Fit/equalize the preview chips the same way every #main chip group is fitted.
  requestAnimationFrame(() => layoutChipGroup($('#pvChips')));
}

export function saveModal(): void {
  const name = $<HTMLInputElement>('#fName').value.trim();
  const author = $<HTMLInputElement>('#fAuthor').value.trim();
  const recipe = $<HTMLTextAreaElement>('#fRecipe').value.trim();
  if (!name || !recipe) { flash(); return; }
  const food = editingType === 'food';
  const recipeType = food ? 'food' as const : undefined;
  const foodCat = food ? ($<HTMLSelectElement>('#fFoodCat').value as FoodCat) : undefined;
  const t = nowISO();
  if (editingName) {
    const r = state.records.find(x => x.name === editingName)!;
    r.name = name; r.recipe = recipe; r.author = author; r.edited = t; r.recipeType = recipeType; r.foodCat = foodCat;
  } else {
    const ex = state.records.find(x => x.name.toLowerCase() === name.toLowerCase());
    if (ex) { ex.recipe = recipe; ex.author = author; ex.edited = t; ex.recipeType = recipeType; ex.foodCat = foodCat; }
    else state.records.push({ name, recipe, created: t, edited: t, author, recipeType, foodCat });
  }
  save(); closeModal(); render();
}

/** Delete the record currently open in the modal (after confirm). */
export async function deleteEditing(): Promise<void> {
  if (!editingName) return;
  const ok = await confirmModal({
    title: 'Delete recipe',
    message: `Delete “${editingName}”? This can't be undone.`,
    confirmText: 'Delete',
    danger: true,
  });
  if (ok) {
    state.records = state.records.filter(x => x.name !== editingName);
    save(); closeModal(); render();
  }
}

function flash(): void {
  const w = $<HTMLInputElement>('#fName');
  w.style.borderColor = '#e88';
  setTimeout(() => w.style.borderColor = '', 600);
}
