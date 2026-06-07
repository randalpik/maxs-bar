import './styles.css';
import { state, load, save, seedRecords, toggleStock } from './state';
import { toCSV } from './csv';
import { fillKeySel, render, layoutCards } from './render';
import { openModal, closeModal, saveModal, updatePreview, deleteEditing } from './modal';
import { download, exportTXT, importTXT, importCSV, exportIngredientsCSV } from './io';
import { $ } from './dom';

/* ============================================================
   Wire up
   ============================================================ */
const tabs = $('#tabs');
tabs.addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest('button');
  if (!b) return;
  state.page = b.dataset.page as 'recipes' | 'ingredients' | 'syrups';
  [...tabs.children].forEach(x => x.classList.toggle('on', x === b));
  const bar = $('.bar');
  bar.classList.toggle('page-ingredients', state.page === 'ingredients');
  bar.classList.toggle('page-syrups', state.page === 'syrups');
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
$('#main').addEventListener('click', e => {
  const t = e.target as HTMLElement;
  if (state.page === 'ingredients') {
    const ing = t.closest<HTMLElement>('[data-ing]');
    if (ing) { toggleStock(ing.dataset.ing!); render(); }
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
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

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
load(); fillKeySel(); render();
