import './styles.css';
import { setClassifier } from './parser';
import { seedClassify } from './catalog';
import { state, load, save, seedRecords, toggleStock } from './state';
import { toCSV } from './csv';
import { fillKeySel, render, layoutCards, updateIngredientChip } from './render';
import { openModal, closeModal, saveModal, updatePreview, deleteEditing } from './modal';
import { openIgModal, closeIgModal, saveIgModal, resetIgModal, removeIgModal, fillIgCat, initIgBuilder } from './igmodal';
import { download, exportTXT, importTXT, importCSV, exportIngredientsCSV } from './io';
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
$('#addBtn').addEventListener('click', () => openModal(null));
$('#addIgBtn').addEventListener('click', () => openIgModal(null));
$('#main').addEventListener('click', e => {
  const t = e.target as HTMLElement;
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
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); closeIgModal(); } });

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
  else if (act === 'exp-ing') exportIngredientsCSV();
  else if (act === 'imp-txt' || act === 'imp-csv') $('#fileIn').click();
  else if (act === 'reset') { if (confirm('Reset to the original seed list? Local changes will be lost.')) { state.records = seedRecords(); save(); render(); } }
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
if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutCards);

/* init */
setClassifier(seedClassify); // resolve recipe ingredients from the seed, not the regex
load(); fillKeySel(); fillIgCat(); initIgBuilder(); render();
