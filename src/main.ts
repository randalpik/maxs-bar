import './styles.css';
import { setClassifier } from './parser';
import { seedClassify, runtimeCatalog, isSeedKey } from './catalog';
import { state, load, toggleStock, hasSeed, resetAll } from './state';
import { toCSV } from './csv';
import { fillKeySel, render, layoutCards, updateIngredientChip } from './render';
import { openModal, closeModal, saveModal, updatePreview, deleteEditing } from './modal';
import { openIgModal, closeIgModal, saveIgModal, resetIgModal, removeIgModal, fillIgCat, initIgBuilder } from './igmodal';
import { openSeedModal, closeSeedModal, confirmSeed, seedModalForced } from './seedmodal';
import { download, exportTXT, importTXT, importCSV, exportIngredientsJSON } from './io';
import { $ } from './dom';

/* ============================================================
   Wire up
   ============================================================ */
const tabs = $('#tabs');
/** Switch tabs: set state.page and sync the tab + toolbar classes. Caller renders. */
function selectPage(page: 'recipes' | 'ingredients' | 'syrups'): void {
  state.page = page;
  [...tabs.children].forEach(x => x.classList.toggle('on', (x as HTMLElement).dataset.page === page));
  const bar = $('.bar');
  bar.classList.toggle('page-ingredients', page === 'ingredients');
  bar.classList.toggle('page-syrups', page === 'syrups');
}
/** Act on the recipe-chip "plan" button:
 *  - a hidden seed generic (e.g. rum/syrup/spirit, whose colour only shows in recipes)
 *    → open its edit modal in place, so it can be recoloured or self-tagged;
 *  - a normal stocked ingredient → jump to the Ingredients page and scroll to it
 *    (or, for a generic with no own entry, its first child), flashing it;
 *  - nothing in the list (e.g. from a user-added recipe) → open the add modal prefilled. */
function jumpToIngredient(key: string, label: string): void {
  const cat = runtimeCatalog(state.records);
  const shown = cat.entries.some(e => e.key === key);
  if (!shown && isSeedKey(key)) { openIgModal(key); return; }   // edit the hidden generic here
  selectPage('ingredients');
  render();
  requestAnimationFrame(() => {
    const main = $('#main');
    const chips = [...main.querySelectorAll<HTMLElement>('.chip.ig')];
    const child = cat.entries.find(e => e.umbrellas.includes(key));
    const target = chips.find(c => c.dataset.ing === key) ?? chips.find(c => c.dataset.ing === child?.key);
    if (!target) { openIgModal(null, label); return; }
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add('flash');
    setTimeout(() => target.classList.remove('flash'), 1300);
  });
}

tabs.addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest('button');
  if (!b) return;
  selectPage(b.dataset.page as 'recipes' | 'ingredients' | 'syrups');
  render();
});
$('#modeSeg').addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest('button');
  if (!b) return;
  state.mode = b.dataset.mode as 'group' | 'sort';
  [...$('#modeSeg').children].forEach(x => x.classList.toggle('on', x === b));
  fillKeySel(); render();
});
$<HTMLSelectElement>('#keySel').addEventListener('change', e => { state.key = (e.target as HTMLSelectElement).value; render(); });
$<HTMLInputElement>('#search').addEventListener('input', e => { state.query = (e.target as HTMLInputElement).value; render(); });
$('#searchClear').addEventListener('click', () => {
  const inp = $<HTMLInputElement>('#search');
  inp.value = ''; state.query = ''; inp.focus(); render();
});
$('#addBtn').addEventListener('click', () => openModal(null));
$('#addIgBtn').addEventListener('click', () => openIgModal(null));
$('#main').addEventListener('click', e => {
  const t = e.target as HTMLElement;
  // Goto button (recipe chips): jump to the ingredient on the Ingredients page.
  const gotoEl = t.closest<HTMLElement>('[data-goto-ig]');
  if (gotoEl) {
    const label = gotoEl.closest('.chip')?.querySelector('.nm')?.textContent || gotoEl.dataset.gotoIg!;
    jumpToIngredient(gotoEl.dataset.gotoIg!, label);
    return;
  }
  // Find button (on every chip): jump to Recipes filtered by that ingredient.
  const find = t.closest<HTMLElement>('[data-find]');
  if (find) {
    selectPage('recipes');
    state.query = find.dataset.find!;
    $<HTMLInputElement>('#search').value = state.query;
    render();
    return;
  }
  if (state.page === 'ingredients') {
    const editIg = t.closest<HTMLElement>('[data-ig-edit]');
    if (editIg) { openIgModal(editIg.dataset.igEdit!); return; }
    const ing = t.closest<HTMLElement>('[data-ing]');
    if (ing) { toggleStock(ing.dataset.ing!); updateIngredientChip(ing); }
    return;
  }
  const b = t.closest<HTMLElement>('[data-edit]');
  if (b) openModal(b.dataset.edit!);
});

$('#mCancel').addEventListener('click', closeModal);
$('#mSave').addEventListener('click', saveModal);
$('#mDelete').addEventListener('click', deleteEditing);
$('#overlay').addEventListener('click', e => { if (e.target === $('#overlay')) closeModal(); });
$('#fName').addEventListener('input', updatePreview);
$('#fRecipe').addEventListener('input', updatePreview);

$('#igCancel').addEventListener('click', closeIgModal);
$('#igSave').addEventListener('click', saveIgModal);
$('#igReset').addEventListener('click', resetIgModal);
$('#igRemove').addEventListener('click', removeIgModal);
$('#igOverlay').addEventListener('click', e => { if (e.target === $('#igOverlay')) closeIgModal(); });

$('#seedConfirm').addEventListener('click', confirmSeed);
$('#seedCancel').addEventListener('click', closeSeedModal);
$('#seedOverlay').addEventListener('click', e => { if (e.target === $('#seedOverlay')) closeSeedModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !seedModalForced()) { closeModal(); closeIgModal(); closeSeedModal(); } });

const menu = $('#menu');
$('#menuBtn').addEventListener('click', e => { e.stopPropagation(); menu.classList.toggle('open'); });
document.addEventListener('click', () => menu.classList.remove('open'));
menu.querySelector('.pop')!.addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('button');
  if (!b) return;
  const act = b.dataset.act;
  menu.classList.remove('open');
  if (act === 'exp-csv') download('drinks.csv', toCSV(state.records), 'text/csv');
  else if (act === 'exp-txt') exportTXT();
  else if (act === 'exp-ing') exportIngredientsJSON();
  else if (act === 'imp-txt' || act === 'imp-csv') $('#fileIn').click();
  else if (act === 'switch-seed') openSeedModal({ forced: false });
  else if (act === 'reset') {
    if (confirm('Reset everything? This clears your recipes, ingredient edits, and stock, then asks you to pick a starter list again.')) {
      resetAll();
      render();
      openSeedModal({ forced: true });
    }
  }
});
$<HTMLInputElement>('#fileIn').addEventListener('change', e => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f) return;
  const r = new FileReader();
  const isCsv = /\.csv$/i.test(f.name);
  r.onload = () => { (isCsv ? importCSV : importTXT)(r.result as string); (e.target as HTMLInputElement).value = ''; };
  r.readAsText(f);
});

let layoutTimer: ReturnType<typeof setTimeout>;
window.addEventListener('resize', () => {
  clearTimeout(layoutTimer);
  layoutTimer = setTimeout(layoutCards, 120);
});
// First-paint layout (and the fonts.ready gate) lives in render.ts now.

/* init */
setClassifier(seedClassify); // resolve recipe ingredients from the seed, not the regex
load(); fillKeySel(); fillIgCat(); initIgBuilder(); render();
if (!hasSeed()) openSeedModal({ forced: true });
