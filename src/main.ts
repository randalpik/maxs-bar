import './styles.css';
import { state, load, save, seedRecords } from './state';
import { toCSV } from './csv';
import { fillKeySel, render, layoutCards } from './render';
import { openModal, closeModal, saveModal, updatePreview, deleteEditing } from './modal';
import { download, exportTXT, importTXT } from './io';
import { $ } from './dom';

/* ============================================================
   Wire up
   ============================================================ */
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
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-edit]');
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
  else if (act === 'imp-txt') $('#fileIn').click();
  else if (act === 'reset') { if (confirm('Reset to the original seed list? Local changes will be lost.')) { state.records = seedRecords(); save(); render(); } }
});
$<HTMLInputElement>('#fileIn').addEventListener('change', e => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => { importTXT(r.result as string); (e.target as HTMLInputElement).value = ''; };
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
