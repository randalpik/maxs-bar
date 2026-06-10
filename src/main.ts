import './styles.css';
import { setClassifier } from './parser/parser';
import { seedClassify, runtimeCatalog, isSeedKey, reconcileStock, refreshUnits } from './ingredients/catalog';
import { state, load, toggleStock, hasSeed, resetAll } from './core/state';
import { fillKeySel, render, layoutCards, updateIngredientChip } from './ui/render';
import { openModal, closeModal, saveModal, updatePreview, deleteEditing } from './ui/modal';
import { openIgModal, closeIgModal, saveIgModal, resetIgModal, removeIgModal, fillIgCat, fillIgLoc, initIgBuilder } from './ui/igmodal';
import { initLocationDrag } from './ui/drag';
import { openSeedModal, closeSeedModal, confirmSeed, seedModalForced } from './ui/seedmodal';
import { confirmModal } from './ui/confirm';
import {
  exportRecipesJSON, exportIngredientsJSON, exportStockJSON,
  importRecipes, importIngredientsJSON, importStockJSON,
} from './io/io';
import { initSync, syncNow } from './sync/sync';
import { openAcctModal, closeAcctModal, createAccount, doSignIn, doSignOut } from './sync/acct';
import { $ } from './core/dom';

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
  pushNav();
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

/* ---- navigation history: browser-back undoes tab / find / goto jumps ----
 * Each navigation pushes the view state ({page, query}) so the browser back
 * button steps back through tab switches and the automatic jumps from the chip
 * find/goto buttons. Filter-box typing is NOT pushed (it would flood history);
 * back skips transient filters to the last real navigation. */
function pushNav(): void {
  const nav = { page: state.page, query: state.query };
  const cur = history.state as typeof nav | null;
  if (cur && cur.page === nav.page && cur.query === nav.query) return; // no-op (e.g. active tab)
  history.pushState(nav, '');
}
function restoreNav(nav: { page?: string; query?: string }): void {
  state.query = nav.query || '';
  $<HTMLInputElement>('#search').value = state.query;
  selectPage((nav.page as 'recipes' | 'ingredients' | 'syrups') || 'recipes');
  render();
}
window.addEventListener('popstate', e => restoreNav(e.state || { page: 'recipes', query: '' }));

tabs.addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest('button');
  if (!b) return;
  selectPage(b.dataset.page as 'recipes' | 'ingredients' | 'syrups');
  render();
  pushNav();
});
$('#modeSeg').addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest('button');
  if (!b) return;
  state.mode = b.dataset.mode as 'group' | 'sort';
  [...$('#modeSeg').children].forEach(x => x.classList.toggle('on', x === b));
  fillKeySel(); render();
});
$('#igModeSeg').addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest('button');
  if (!b) return;
  state.igMode = b.dataset.mode as 'stock' | 'location';
  [...$('#igModeSeg').children].forEach(x => x.classList.toggle('on', x === b));
  render();
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
    pushNav();
    return;
  }
  if (state.page === 'ingredients') {
    const editIg = t.closest<HTMLElement>('[data-ig-edit]');
    if (editIg) { openIgModal(editIg.dataset.igEdit!); return; }
    // Location mode: clicking a chip never toggles stock (it would fight the drag).
    if (state.igMode === 'location') return;
    const ing = t.closest<HTMLElement>('[data-ing]');
    if (ing) { toggleStock(ing.dataset.ing!); updateIngredientChip(ing); }
    return;
  }
  const b = t.closest<HTMLElement>('[data-edit]');
  if (b) openModal(b.dataset.edit!);
});

$('#mCancel').addEventListener('click', closeModal);
$('#mSave').addEventListener('click', saveModal);
$('#mDelete').addEventListener('click', () => { void deleteEditing(); });
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

$('#acctCreate').addEventListener('click', () => { void createAccount(); });
$('#acctSignin').addEventListener('click', () => { void doSignIn(); });
$('#acctSignout').addEventListener('click', doSignOut);
$('#acctClose').addEventListener('click', closeAcctModal);
$('#acctOverlay').addEventListener('click', e => { if (e.target === $('#acctOverlay')) closeAcctModal(); });
$('#syncBtn').addEventListener('click', () => syncNow());
$('#acctPass').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); void doSignIn(); } });

document.addEventListener('keydown', e => { if (e.key === 'Escape' && !seedModalForced()) { closeModal(); closeIgModal(); closeSeedModal(); closeAcctModal(); } });

const menu = $('#menu');
$('#menuBtn').addEventListener('click', e => { e.stopPropagation(); menu.classList.toggle('open'); });
document.addEventListener('click', () => menu.classList.remove('open'));
menu.querySelector('.pop')!.addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('button');
  if (!b) return;
  const act = b.dataset.act;
  menu.classList.remove('open');
  if (act === 'exp-recipes') exportRecipesJSON();
  else if (act === 'exp-ing') exportIngredientsJSON();
  else if (act === 'exp-stock') exportStockJSON();
  else if (act === 'imp-recipes') startImport('recipes');
  else if (act === 'imp-ing') startImport('ingredients');
  else if (act === 'imp-stock') startImport('stock');
  else if (act === 'account') openAcctModal();
  else if (act === 'switch-seed') openSeedModal({ forced: false });
  else if (act === 'reset') {
    void (async () => {
      const ok = await confirmModal({
        title: 'Reset everything',
        message: 'This clears your recipes, ingredient edits, and stock, then asks you to pick a starter list again.',
        confirmText: 'Reset everything',
        danger: true,
      });
      if (ok) {
        resetAll();
        render();
        openSeedModal({ forced: true });
      }
    })();
  }
});

// Single hidden file input, retargeted per import kind. Recipes accept the
// human-readable formats too; ingredients and stock are JSON only.
let pendingImport: 'recipes' | 'ingredients' | 'stock' = 'recipes';
function startImport(kind: typeof pendingImport): void {
  pendingImport = kind;
  const inp = $<HTMLInputElement>('#fileIn');
  inp.accept = kind === 'recipes'
    ? '.txt,.csv,.json,text/plain,text/csv,application/json'
    : '.json,application/json';
  inp.click();
}
$<HTMLInputElement>('#fileIn').addEventListener('change', e => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    const text = r.result as string;
    if (pendingImport === 'recipes') importRecipes(text, f.name);
    else if (pendingImport === 'ingredients') importIngredientsJSON(text);
    else importStockJSON(text);
    (e.target as HTMLInputElement).value = '';
  };
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
load(); reconcileStock(state.records); // clean up any pre-existing stuck stock state
refreshUnits(); // install base units + any the user declared on an ingredient
fillKeySel(); fillIgCat(); fillIgLoc(); initIgBuilder(); initLocationDrag(); render();
history.replaceState({ page: state.page, query: state.query }, ''); // seed initial nav entry
if (!hasSeed()) openSeedModal({ forced: true });
initSync(); // resume a stored session (no-op when signed out); app works fully logged-out
