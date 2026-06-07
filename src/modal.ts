import { state, save } from './state';
import { parseLine } from './parser';
import { nowISO } from './util';
import { render, chipHTML } from './render';
import { $ } from './dom';

/* ============================================================
   Add / edit modal
   ============================================================ */
let editingName: string | null = null;

export function openModal(name: string | null): void {
  editingName = name || null;
  $('#mTitle').textContent = name ? 'Edit cocktail' : 'Add cocktail';
  $<HTMLElement>('#mDelete').style.display = name ? 'block' : 'none';
  if (name) {
    const r = state.records.find(x => x.name === name)!;
    $<HTMLInputElement>('#fName').value = r.name;
    $<HTMLTextAreaElement>('#fRecipe').value = r.recipe;
  } else {
    $<HTMLInputElement>('#fName').value = '';
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
  const p = parseLine(`${nm}: ${rc}`);
  $('#pvChips').innerHTML = (p && p.ingredients.length)
    ? p.ingredients.map(i => chipHTML(i)).join('')
    : '<span style="color:var(--faint);font-size:11px">…</span>';
}

export function saveModal(): void {
  const name = $<HTMLInputElement>('#fName').value.trim();
  const recipe = $<HTMLTextAreaElement>('#fRecipe').value.trim();
  if (!name || !recipe) { flash(); return; }
  const t = nowISO();
  if (editingName) {
    const r = state.records.find(x => x.name === editingName)!;
    r.name = name; r.recipe = recipe; r.edited = t;
  } else {
    const ex = state.records.find(x => x.name.toLowerCase() === name.toLowerCase());
    if (ex) { ex.recipe = recipe; ex.edited = t; } else state.records.push({ name, recipe, created: t, edited: t });
  }
  save(); closeModal(); render();
}

/** Delete the record currently open in the modal (after confirm). */
export function deleteEditing(): void {
  if (editingName && confirm(`Delete "${editingName}"?`)) {
    state.records = state.records.filter(x => x.name !== editingName);
    save(); closeModal(); render();
  }
}

function flash(): void {
  const w = $<HTMLInputElement>('#fName');
  w.style.borderColor = '#e88';
  setTimeout(() => w.style.borderColor = '', 600);
}
