import { state, upsertProfile, deleteProfile, setCurrentProfile } from '../core/state';
import type { Profile } from '../core/types';
import { HOME_ID, OTHER_CAT, makeProfile, catLabel, isReservedCat } from '../profiles/profiles';
import { parseProfileImport, isProfileExport, type ProfileExportPlacement } from '../io/transfer';
import { runtimeCatalog } from '../ingredients/catalog';
import { confirmModal } from './confirm';
import { render, esc } from './render';
import { $ } from '../core/dom';

/* ============================================================
   Add / edit store-profile modal (one modal, two modes — like the ingredient
   modal's openIgModal(key | null)).

   The category rows in #profCats ARE the working draft: add/remove/drag edit the
   DOM, and save reads the order back (same philosophy as the Location-mode chip
   drag). Nothing persists until Save. Other is a pinned row outside the drag list.

   Add mode additionally offers "Import from file…" (per the backlog, import is
   add-only): a parsed file fills the modal's fields, so the user can tweak the
   name or aisles before creating. Edit mode offers Delete instead (never for Home).
   ============================================================ */

let editingId: string | null = null;
/** Placements parsed from an imported file, applied on save (add mode only). */
let importedPlacements: ProfileExportPlacement[] | null = null;

const nameInput = (): HTMLInputElement => $<HTMLInputElement>('#profName');
const hideUnstockedBox = (): HTMLInputElement => $<HTMLInputElement>('#profHideUnstocked');
const hideOtherBox = (): HTMLInputElement => $<HTMLInputElement>('#profHideOther');
const skipPendingBox = (): HTMLInputElement => $<HTMLInputElement>('#profSkipPending');

function rowHTML(cat: string): string {
  return `<div class="prof-cat" data-cat="${esc(cat)}">`
    + `<span class="grip" aria-hidden="true"><svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor"><circle cx="2.5" cy="2.5" r="1.4"/><circle cx="7.5" cy="2.5" r="1.4"/><circle cx="2.5" cy="7" r="1.4"/><circle cx="7.5" cy="7" r="1.4"/><circle cx="2.5" cy="11.5" r="1.4"/><circle cx="7.5" cy="11.5" r="1.4"/></svg></span>`
    + `<span class="nm">${esc(catLabel(cat))}</span>`
    + `<button type="button" class="prof-cat-x" title="Remove category" aria-label="Remove ${esc(catLabel(cat))}">×</button>`
    + `</div>`;
}

function renderCatRows(cats: string[]): void {
  $('#profCats').innerHTML = cats.map(rowHTML).join('');
}

/** The draft category order — the DOM rows, top to bottom. */
function domCats(): string[] {
  return [...$('#profCats').querySelectorAll<HTMLElement>('.prof-cat')].map(r => r.dataset.cat!);
}

function addCatFromInput(): void {
  const inp = $<HTMLInputElement>('#profCatInput');
  const name = inp.value.trim();
  if (!name || isReservedCat(name)) { inp.value = ''; return; }
  const lower = name.toLowerCase();
  if (domCats().some(c => c.toLowerCase() === lower || catLabel(c).toLowerCase() === lower)) { inp.select(); return; }
  $('#profCats').insertAdjacentHTML('beforeend', rowHTML(name));
  inp.value = '';
  inp.focus();
}

export function openProfileModal(id: string | null): void {
  editingId = id;
  importedPlacements = null;
  const p = id ? state.profiles[id] : null;
  if (id && !p) return;
  $('#profTitle').textContent = p ? 'Edit profile' : 'Add profile';
  nameInput().value = p?.name ?? '';
  renderCatRows(p ? [...p.cats] : []);
  hideUnstockedBox().checked = p?.hideUnstocked ?? false;
  hideOtherBox().checked = p?.hideOther ?? false;
  skipPendingBox().checked = p?.skipPending ?? false;
  $('#profImport').style.display = p ? 'none' : '';
  $('#profDelete').style.display = p && id !== HOME_ID ? '' : 'none';
  $('#profileOverlay').classList.add('open');
  nameInput().focus();
}

export function closeProfileModal(): void {
  $('#profileOverlay').classList.remove('open');
  editingId = null;
  importedPlacements = null;
}

export async function saveProfileModal(): Promise<void> {
  const name = nameInput().value.trim();
  if (!name) { nameInput().focus(); return; }
  const cats = domCats();
  const hideUnstocked = hideUnstockedBox().checked;
  const hideOther = hideOtherBox().checked;
  const skipPending = skipPendingBox().checked;
  const now = Date.now();

  if (editingId) {
    const prev = state.profiles[editingId]!;
    const catsChanged = JSON.stringify(cats) !== JSON.stringify(prev.cats);
    const removed = prev.cats.filter(c => !cats.includes(c));
    const enablingHide = hideUnstocked && !prev.hideUnstocked;
    if (catsChanged || enablingHide) {
      const msgs: string[] = [];
      if (removed.length) msgs.push(`Removing ${removed.map(catLabel).join(', ')} moves the ingredients there to Other.`);
      else if (catsChanged) msgs.push('The category list changed.');
      if (enablingHide) msgs.push('Hiding unstocked immediately clears the saved spot of every out-of-stock ingredient.');
      const ok = await confirmModal({ title: 'Save profile changes', message: msgs.join(' '), confirmText: 'Save' });
      if (!ok) return;
    }
    const next: Profile = { ...prev, name, cats, hideUnstocked, hideOther, skipPending, placements: { ...prev.placements } };
    const removedSet = new Set(removed);
    for (const [k, pl] of Object.entries(next.placements)) {
      if (removedSet.has(pl.cat)) next.placements[k] = { ...pl, cat: OTHER_CAT, ts: now };
    }
    if (enablingHide) {
      // Pending items stay shown, so keep their placement too.
      for (const k of Object.keys(next.placements)) if (!state.stocked.has(k) && !state.pending.has(k)) delete next.placements[k];
    }
    upsertProfile(next);
  } else {
    const p = makeProfile(name);
    p.cats = cats;
    p.hideUnstocked = hideUnstocked;
    p.hideOther = hideOther;
    p.skipPending = skipPending;
    if (importedPlacements) {
      p.placements = Object.fromEntries(importedPlacements.map(pl => [pl.key, { cat: pl.cat, pos: pl.pos, ts: now }]));
    }
    upsertProfile(p);
    setCurrentProfile(p.id);
  }
  closeProfileModal();
  render();
}

export async function deleteProfileModal(): Promise<void> {
  if (!editingId || editingId === HOME_ID) return;
  const p = state.profiles[editingId];
  if (!p) return;
  const ok = await confirmModal({
    title: 'Delete profile',
    message: `Delete “${p.name}” and its ingredient placements? Stock status is global and unaffected.`,
    confirmText: 'Delete',
    danger: true,
  });
  if (!ok) return;
  deleteProfile(editingId);
  closeProfileModal();
  render();
}

/* ---- import (add mode): parsed file fills the modal fields ---- */

function applyProfileImport(text: string): void {
  let data: unknown;
  try { data = JSON.parse(text); } catch { return; }
  if (!isProfileExport(data)) return;
  const known = new Set(runtimeCatalog(state.records).entries.map(e => e.key));
  const parsed = parseProfileImport(data, known);
  nameInput().value = parsed.name;
  renderCatRows(parsed.cats);
  hideUnstockedBox().checked = parsed.hideUnstocked;
  hideOtherBox().checked = parsed.hideOther;
  skipPendingBox().checked = parsed.skipPending;
  importedPlacements = parsed.placements;
}

export function pickProfileImport(): void {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.json,application/json';
  inp.addEventListener('change', () => {
    const f = inp.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => applyProfileImport(String(r.result));
    r.readAsText(f);
  });
  inp.click();
}

/* ---- vertical drag-to-reorder for the category rows ----
 * Lighter cousin of the chip drag (drag.ts): single column, the row itself moves
 * as the live placeholder, pointer capture on the list. The pinned Other row sits
 * outside #profCats so it can't participate. */
export function initProfCatDrag(): void {
  const list = $('#profCats');
  let row: HTMLElement | null = null;
  let startY = 0;
  let pid = -1;
  let dragging = false;

  // The modal body scrolls (.prof-scroll); a wheel scroll mid-drag would slide the
  // list under the held row, so swallow it for the drag's duration. Touch scrolling
  // is already blocked by the rows' touch-action:none.
  const blockWheel = (e: WheelEvent): void => e.preventDefault();

  list.addEventListener('pointerdown', e => {
    const pe = e as PointerEvent;
    const t = e.target as HTMLElement;
    if (t.closest('.prof-cat-x')) return;            // remove button stays a click
    const r = t.closest<HTMLElement>('.prof-cat');
    if (!r) return;
    row = r; startY = pe.clientY; pid = pe.pointerId; dragging = false;
    list.setPointerCapture(pid);
  });
  list.addEventListener('pointermove', e => {
    const pe = e as PointerEvent;
    if (!row || pe.pointerId !== pid) return;
    if (!dragging) {
      if (Math.abs(pe.clientY - startY) < 4) return;
      dragging = true;
      row.classList.add('drag');
      document.addEventListener('wheel', blockWheel, { passive: false, capture: true });
    }
    e.preventDefault();
    const before = [...list.querySelectorAll<HTMLElement>('.prof-cat:not(.drag)')]
      .find(r => { const b = r.getBoundingClientRect(); return pe.clientY < b.top + b.height / 2; }) ?? null;
    if (before) list.insertBefore(row, before);
    else list.appendChild(row);
  });
  const up = (e: PointerEvent): void => {
    if (!row || e.pointerId !== pid) return;
    row.classList.remove('drag');
    document.removeEventListener('wheel', blockWheel, { capture: true });
    row = null; pid = -1; dragging = false;
  };
  list.addEventListener('pointerup', up);
  list.addEventListener('pointercancel', up);

  // Row removal + the add-category input live here too: one init for the section.
  list.addEventListener('click', e => {
    const x = (e.target as HTMLElement).closest('.prof-cat-x');
    if (x) x.closest('.prof-cat')?.remove();
  });
  $('#profCatAdd').addEventListener('click', addCatFromInput);
  $<HTMLInputElement>('#profCatInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addCatFromInput(); }
  });
}
