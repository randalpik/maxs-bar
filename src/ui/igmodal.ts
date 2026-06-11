import { state, setIngredientOverride, resetIngredientOverride } from '../core/state';
import { CATEGORY_ORDER, CATEGORY_LABEL, CATEGORY_BY_ID } from '../ingredients/ingredients';
import { defaultLocationForCat } from '../ingredients/locations';
import { HOME_ID, OTHER_CAT, profileCats, catLabel } from '../profiles/profiles';
import { editableEntry, isKnownKey, isSeedKey, UMBRELLA_PARENTS, reconcileStock, refreshUnits, baselineForms } from '../ingredients/catalog';
import { icon } from '../ingredients/icons';
import { titleCase, FAMILY_LABEL } from '../parser/parser';
import type { Form, Role } from '../core/types';
import { render, esc } from './render';
import { $ } from '../core/dom';

/* ============================================================
   Edit ingredient modal: name + category + icon builder
   (outline picker + colour adjuster, writing into the override store)
   ============================================================ */

/** Outline shapes offered by the picker, roughly grouped vessel → fruit → garnish.
 *  Only currently-used designs are offered; the superseded shapes fizz, ring, ellipse,
 *  diamond and leaf were dropped (no ingredient or auto-classifier uses them). Their
 *  icon() definitions remain as harmless fallbacks for any stale stored override. */
const SHAPES = [
  'squircle', 'hexagon', 'glass', 'can', 'bottle', 'dropper', 'triangle', 'droplet',
  'circle', 'wheel', 'wedge', 'cube',
  'sprig', 'seed', 'ginger', 'egg', 'twist', 'cherry', 'berry',
];


/** The per-ingredient measures a form can resolve to. The global leading prefixes
 *  (top/float/dash/muddled) and quantity rules are NOT here — a form sets the AMOUNT:
 *  a volumetric pour, a splash (dash), or a discrete count. */
const FORM_ROLES: Role[] = ['pour', 'dash', 'count'];
/** Process/positional words a form can default to (the gray tag). float/muddle come from
 *  recipe prefixes, so only garnish/grate are per-ingredient defaults. */
const FORM_PROCESSES: { val: string; label: string }[] = [
  { val: '', label: 'no process' },
  { val: 'garnish', label: 'garnish' },
  { val: 'grate', label: 'grate' },
];
/** Display treatments a form can apply, with their stored value. */
const FORM_DISPS: { val: string; label: string }[] = [
  { val: '', label: 'name only' },
  { val: 'juice', label: 'append "juice"' },
  { val: 'asis', label: 'show keyword' },
];

/** The ingredient's editing category — tracked so a category change can swap the forms
 *  to the new category's default (only when they were still at the old default). */
let editingCat = '';

let editingKey: string | null = null;
let editingShape: string | null = null;
let editingColor = '#C99A5B';
let editingUmbrellas: string[] = [];
let editingAliases: string[] = [];
let editingForms: Form[] = [];

const umbLabel = (u: string): string => FAMILY_LABEL[u] || titleCase(u);

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

/** Populate the Home-location <select> from the Home profile's live category list
 *  (plus the implicit Other). Home's aisles are user-editable, so openIgModal
 *  re-runs this on every open rather than relying on the once-at-startup fill. */
export function fillIgLoc(): void {
  const sel = $<HTMLSelectElement>('#igLoc');
  sel.innerHTML = '';
  const home = state.profiles[HOME_ID];
  for (const c of home ? profileCats(home) : [OTHER_CAT]) {
    const o = document.createElement('option');
    o.value = c; o.textContent = catLabel(c);
    sel.appendChild(o);
  }
}

/** Select a location, surfacing one Home no longer lists as a transient "(removed)"
 *  option — so opening and saving an untouched ingredient never silently rewrites
 *  its stored default. */
function setIgLocValue(loc: string): void {
  const sel = $<HTMLSelectElement>('#igLoc');
  if (![...sel.options].some(o => o.value === loc)) {
    const o = document.createElement('option');
    o.value = loc; o.textContent = `${catLabel(loc)} (removed)`;
    sel.appendChild(o);
  }
  sel.value = loc;
}

/** Show the ABV field only for alcohol-bearing categories; hide + zero it otherwise.
 *  Zeroing on hide means a category change to a non-alcoholic one drops any stale ABV,
 *  and saveIgModal (which already coerces blank/NaN → 0) persists abv:0. */
function syncAbvVisibility(): void {
  const show = !!CATEGORY_BY_ID.get($<HTMLSelectElement>('#igCat').value)?.abv;
  $<HTMLElement>('.ig-abv').style.display = show ? '' : 'none';
  if (!show) $<HTMLInputElement>('#igAbv').value = '0';
}

/** Wire the builder's interactive bits once at startup. */
export function initIgBuilder(): void {
  // ABV toggles per category; the forms may also follow the category (see onCatChange).
  $<HTMLSelectElement>('#igCat').addEventListener('change', () => { syncAbvVisibility(); onCatChange(); });
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
  // Umbrellas: pick a parent from the dropdown to add it.
  $<HTMLSelectElement>('#igUmbSel').addEventListener('change', e => {
    const v = (e.target as HTMLSelectElement).value;
    if (v && !editingUmbrellas.includes(v)) editingUmbrellas.push(v);
    renderRelations();
  });
  // Aliases: type + Enter to add.
  $<HTMLInputElement>('#igAliasInput').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const inp = e.target as HTMLInputElement;
    const v = inp.value.trim().toLowerCase();
    if (v && !editingAliases.includes(v)) editingAliases.push(v);
    inp.value = '';
    renderRelations();
  });
  // Forms: populate the measure/process/disp pickers once (default row + keyword-add row),
  // then wire the editors. A form's "counts as" field is also how a count-unit is declared.
  const roleOpts = FORM_ROLES.map(r => `<option value="${r}">${r}</option>`).join('');
  const procOpts = FORM_PROCESSES.map(p => `<option value="${esc(p.val)}">${esc(p.label)}</option>`).join('');
  const dispOpts = FORM_DISPS.map(d => `<option value="${esc(d.val)}">${esc(d.label)}</option>`).join('');
  $<HTMLSelectElement>('#igFormRole').innerHTML = roleOpts;
  $<HTMLSelectElement>('#igDefRole').innerHTML = roleOpts;
  $<HTMLSelectElement>('#igFormProcess').innerHTML = procOpts;
  $<HTMLSelectElement>('#igDefProcess').innerHTML = procOpts;
  $<HTMLSelectElement>('#igFormDisp').innerHTML = dispOpts;
  $<HTMLSelectElement>('#igDefDisp').innerHTML = dispOpts;
  // The default (bare/empty-keyword) form: edit its measure + process + display in place.
  $<HTMLSelectElement>('#igDefRole').addEventListener('change', e => {
    const role = (e.target as HTMLSelectElement).value as Role;
    setDefaultForm({ role });
    $<HTMLInputElement>('#igDefUnit').placeholder = role === 'pour' ? 'oz' : 'counts as';
  });
  $<HTMLInputElement>('#igDefUnit').addEventListener('input', e =>
    setDefaultForm({ unit: (e.target as HTMLInputElement).value.trim().toLowerCase() || undefined }));
  $<HTMLSelectElement>('#igDefProcess').addEventListener('change', e =>
    setDefaultForm({ process: ((e.target as HTMLSelectElement).value || undefined) as Form['process'] }));
  $<HTMLSelectElement>('#igDefDisp').addEventListener('change', e =>
    setDefaultForm({ disp: ((e.target as HTMLSelectElement).value || undefined) as Form['disp'] }));
  // A keyword form (trailing word like wedge/peel/white): keyword + measure + optional
  // count unit + process + display. A blank unit on a count = a bare number ("Egg white"/1).
  $('#igFormAdd').addEventListener('click', () => {
    const kw = $<HTMLInputElement>('#igFormKw').value.trim().toLowerCase();
    if (!kw || editingForms.some(f => f.keyword === kw)) return;
    const role = $<HTMLSelectElement>('#igFormRole').value as Role;
    const disp = $<HTMLSelectElement>('#igFormDisp').value as Form['disp'] | '';
    const process = $<HTMLSelectElement>('#igFormProcess').value as Form['process'] | '';
    const unit = $<HTMLInputElement>('#igFormUnit').value.trim().toLowerCase();
    const form: Form = { keyword: kw, role };
    if (role === 'count' && unit) form.unit = unit;
    if (process) form.process = process as Form['process'];
    if (disp) form.disp = disp as Form['disp'];
    editingForms.push(form);
    $<HTMLInputElement>('#igFormKw').value = '';
    $<HTMLInputElement>('#igFormUnit').value = '';
    renderRelations();
  });
  // Deletable chips across the umbrella/alias/form editors.
  const del = (e: Event) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-rel]');
    if (!b) return;
    const val = b.dataset.val!;
    if (b.dataset.rel === 'umb') editingUmbrellas = editingUmbrellas.filter(u => u !== val);
    else if (b.dataset.rel === 'alias') editingAliases = editingAliases.filter(a => a !== val);
    else if (b.dataset.rel === 'form') editingForms = editingForms.filter(f => f.keyword !== val);
    renderRelations();
  };
  $('#igUmbChips').addEventListener('click', del);
  $('#igAliasChips').addEventListener('click', del);
  $('#igFormChips').addEventListener('click', del);
}

/** One deletable pill in the umbrella/alias/form/unit editors. */
function relChip(val: string, label: string, kind: 'umb' | 'alias' | 'form'): string {
  return `<span class="rel-chip">${esc(label)}<button type="button" data-rel="${kind}" data-val="${esc(val)}" title="remove" tabindex="-1">×</button></span>`;
}

/** Summary of a keyword form chip, e.g. "wedge → count · wedge" or "peel → count · garnish · show keyword". */
function formLabel(f: Form): string {
  const disp = f.disp ? FORM_DISPS.find(d => d.val === f.disp)?.label ?? f.disp : '';
  const bits = [f.role, ...(f.unit ? [f.unit] : []), ...(f.process ? [f.process] : []), ...(disp ? [disp] : [])];
  return `${f.keyword} → ${bits.join(' · ')}`;
}

/** Update (or create) the bare/default form — the ingredient's measure with no keyword. */
function setDefaultForm(patch: Partial<Form>): void {
  let def = editingForms.find(f => !f.keyword);
  if (!def) { def = { keyword: '', role: 'pour' }; editingForms.unshift(def); }
  Object.assign(def, patch);
  if (!def.disp) delete def.disp;
  if (!def.process) delete def.process;
  if (!def.unit) delete def.unit;
}

/** On category change, if the forms are still the old category's default (untouched),
 *  swap them to the new category's default — so picking "Citrus" reveals wedge/peel,
 *  "Bitters" shows the dash default, etc. Custom edits are left alone. */
function onCatChange(): void {
  const newCat = $<HTMLSelectElement>('#igCat').value;
  if (JSON.stringify(editingForms) === JSON.stringify(baselineForms(editingKey, editingCat)))
    editingForms = baselineForms(editingKey, newCat).map(f => ({ ...f }));
  editingCat = newCat;
  renderRelations();
}

/** Redraw the umbrella + alias + form + unit chip lists and the umbrella dropdown. */
function renderRelations(): void {
  $('#igUmbChips').innerHTML = editingUmbrellas.length
    ? editingUmbrellas.map(u => relChip(u, umbLabel(u), 'umb')).join('')
    : '<span class="rel-empty">none</span>';
  const sel = $<HTMLSelectElement>('#igUmbSel');
  const avail = UMBRELLA_PARENTS.filter(p => !editingUmbrellas.includes(p));
  sel.innerHTML =
    '<option value="">add umbrella…</option>' +
    avail
      .map((p) => `<option value="${esc(p)}">${esc(umbLabel(p))}</option>`)
      .join("");
  sel.disabled = !avail.length;
  $('#igAliasChips').innerHTML = editingAliases.length
    ? editingAliases.map(a => relChip(a, a, 'alias')).join('')
    : '<span class="rel-empty">none</span>';
  // The default (empty-keyword) form drives the inline pickers; only keyword forms are chips.
  const def = editingForms.find(f => !f.keyword);
  const defRole = def?.role ?? 'pour';
  $<HTMLSelectElement>('#igDefRole').value = defRole;
  $<HTMLInputElement>('#igDefUnit').value = def?.unit ?? '';
  // Surface the effective unit: a pour defaults to oz (the global default), a count to a
  // bare number unless a unit is given. Placeholder (not a value) so no redundant override.
  $<HTMLInputElement>('#igDefUnit').placeholder = defRole === 'pour' ? 'oz' : 'counts as';
  $<HTMLSelectElement>('#igDefProcess').value = def?.process ?? '';
  $<HTMLSelectElement>('#igDefDisp').value = def?.disp ?? '';
  const kwForms = editingForms.filter(f => f.keyword);
  $('#igFormChips').innerHTML = kwForms.length
    ? kwForms.map(f => relChip(f.keyword, formLabel(f), 'form')).join('')
    : '<span class="rel-empty">none</span>';
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
  fillIgLoc();   // Home's aisles may have changed since the last open
  if (key === null) {
    editingKey = null;
    editingShape = null;
    editingColor = '#C99A5B';
    editingUmbrellas = [];
    editingAliases = [];
    editingCat = CATEGORY_ORDER[0]!;
    editingForms = baselineForms(null, editingCat).map(f => ({ ...f }));
    $('#igTitle').textContent = 'Add ingredient';
    $<HTMLInputElement>('#igName').value = prefillName;
    $<HTMLInputElement>('#igAbv').value = '';
    sel.value = CATEGORY_ORDER[0]!;
    setIgLocValue(defaultLocationForCat(CATEGORY_ORDER[0]!));
    $<HTMLElement>('#igRemove').style.display = 'none';
    $<HTMLElement>('#igReset').style.display = 'none';
  } else {
    const entry = editableEntry(key);   // catalog entry, or a synthesized one for a hidden generic
    if (!entry) return;
    editingKey = key;
    editingShape = entry.shape;
    editingColor = entry.color;
    editingUmbrellas = [...entry.umbrellas];
    editingAliases = [...entry.aliases];
    editingCat = entry.cat;
    // Effective forms (citrus/bitters synth, egg explicit, else the bare-pour default) so
    // the measurement mechanism — incl. each form's count-unit — is visible & editable.
    editingForms = (entry.forms?.length ? entry.forms : baselineForms(key, entry.cat)).map(f => ({ ...f }));
    $('#igTitle').textContent = 'Edit ingredient';
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
    setIgLocValue(entry.defaultLoc);
    $<HTMLElement>('#igRemove').style.display = 'block';
    // Reset only applies to seed ingredients with an edit (added ones use Remove).
    $<HTMLElement>('#igReset').style.display = (isSeedKey(key) && state.ingredients[key]) ? 'block' : 'none';
  }
  syncAbvVisibility();
  renderBuilder();
  renderRelations();
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
  const cat = $<HTMLSelectElement>('#igCat').value;
  // Store the default location only when it deviates from the category default —
  // otherwise leave it undefined so no redundant override is kept.
  const loc = $<HTMLSelectElement>('#igLoc').value;
  const defaultLocation = loc === defaultLocationForCat(cat) ? undefined : loc;
  // Store forms only when they differ from the category/seed baseline, so an untouched
  // edit (e.g. a plain liquid's pour default, or citrus's synth set) keeps no override.
  const isDefaultForms = JSON.stringify(editingForms) === JSON.stringify(baselineForms(editingKey, cat));
  const forms = isDefaultForms ? undefined : editingForms.map(f => ({ ...f }));
  const patch = {
    disp, cat, color: editingColor, shape: editingShape, abv,
    umbrellas: [...editingUmbrellas], aliases: [...editingAliases], defaultLocation,
    forms,
  };
  if (editingKey) {
    setIngredientOverride(editingKey, patch);
  } else {
    // New ingredient: key from the name; block if it collides with an existing one.
    const key = disp.toLowerCase().replace(/\s+juice$/, '').trim();
    if (isKnownKey(key)) { flashName(); return; }
    setIngredientOverride(key, patch);
  }
  refreshUnits();                  // a declared unit may now exist (or have been dropped)
  reconcileStock(state.records);   // a now-hidden ingredient (e.g. self-tag removed) shouldn't stay stocked
  closeIgModal();
  render();
}

export function resetIgModal(): void {
  if (!editingKey) return;
  resetIngredientOverride(editingKey);
  refreshUnits();
  reconcileStock(state.records);
  closeIgModal();
  render();
}

/** Remove a seed ingredient (tombstone so it stays hidden) or delete an added one. */
export function removeIgModal(): void {
  if (!editingKey) return;
  if (isSeedKey(editingKey)) setIngredientOverride(editingKey, { removed: true });
  else resetIngredientOverride(editingKey);
  refreshUnits();
  reconcileStock(state.records);
  closeIgModal();
  render();
}

function flashName(): void {
  const w = $<HTMLInputElement>('#igName');
  w.style.borderColor = '#e88';
  setTimeout(() => w.style.borderColor = '', 600);
}
