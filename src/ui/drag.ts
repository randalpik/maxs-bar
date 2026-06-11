import { state, setProfilePlacement } from '../core/state';
import { CATEGORIES_ID } from '../profiles/profiles';
import { render } from './render';
import { $ } from '../core/dom';

/* ============================================================
   Location-mode drag-to-reorder (pointer-based, touch + mouse)

   Active only on the ingredients page in Location mode with a real profile selected
   (the Categories sentinel has no placements). A chip is dragged by its body (the
   edit/find inset buttons keep working). We float a clone under the pointer and
   move the ORIGINAL chip through the DOM as a live placeholder, so on drop the DOM
   order of each touched .loc-grid IS the desired order — we read it back and persist
   (profile category + sequential pos) via setProfilePlacement, then re-render.

   Pairs with CSS `.loc-grid .chip{touch-action:none}` so a drag doesn't scroll.
   ============================================================ */

const THRESHOLD = 5;   // px of movement before a press becomes a drag

let chip: HTMLElement | null = null;       // the chip being dragged (acts as placeholder)
let ghost: HTMLElement | null = null;      // floating clone under the pointer
let sourceGrid: HTMLElement | null = null; // grid the drag began in
let pointerId = -1;
let startX = 0, startY = 0, grabDX = 0, grabDY = 0;
let dragging = false;

function active(): boolean {
  return state.page === 'ingredients' && state.igMode === 'location' && state.profileId !== CATEGORIES_ID;
}

function gridFromPoint(x: number, y: number): HTMLElement | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  if (!el) return null;
  const direct = el.closest<HTMLElement>('.loc-grid[data-cat]');
  if (direct) return direct;
  // Pointer over a section's padding/header — fall back to that section's grid.
  return el.closest('section.group')?.querySelector<HTMLElement>('.loc-grid[data-cat]') ?? null;
}

/** The chip in `grid` to insert the placeholder before (null ⇒ append), given the
 *  pointer position. Row-aware: first the pointer's row is chosen by y, then the slot
 *  within that row by x. Dropping to the right of a row's last item lands at that row's
 *  END (before the next row's first chip), not the start of the section. */
function insertBefore(grid: HTMLElement, x: number, y: number): HTMLElement | null {
  const chips = [...grid.querySelectorAll<HTMLElement>('.chip.ig')].filter(c => c !== chip);
  if (!chips.length) return null;

  // Bucket chips into visual rows by their top edge (in DOM/visual order).
  const rows: Array<{ top: number; bottom: number; items: HTMLElement[] }> = [];
  for (const c of chips) {
    const r = c.getBoundingClientRect();
    const row = rows[rows.length - 1];
    if (row && Math.abs(r.top - row.top) < 4) { row.items.push(c); row.bottom = Math.max(row.bottom, r.bottom); }
    else rows.push({ top: r.top, bottom: r.bottom, items: [c] });
  }

  // Pick the row the pointer is within (or just below); below all rows ⇒ last row.
  const ri = rows.findIndex(rw => y < rw.bottom);
  const row = ri < 0 ? rows[rows.length - 1]! : rows[ri]!;

  // Within the row, insert before the first chip whose horizontal centre is past x.
  for (const c of row.items) {
    const r = c.getBoundingClientRect();
    if (x < r.left + r.width / 2) return c;
  }
  // Past every chip in this row → end of row = before the next row's first chip
  // (or append if this is the last row).
  const idx = rows.indexOf(row);
  return idx < rows.length - 1 ? rows[idx + 1]!.items[0]! : null;
}

function onMove(e: PointerEvent): void {
  if (e.pointerId !== pointerId || !chip) return;
  if (!dragging) {
    if (Math.abs(e.clientX - startX) < THRESHOLD && Math.abs(e.clientY - startY) < THRESHOLD) return;
    beginDrag();
  }
  e.preventDefault();
  // Float the ghost.
  ghost!.style.left = (e.clientX - grabDX) + 'px';
  ghost!.style.top = (e.clientY - grabDY) + 'px';
  // Move the placeholder to the slot under the pointer.
  const grid = gridFromPoint(e.clientX, e.clientY);
  if (!grid) return;
  const before = insertBefore(grid, e.clientX, e.clientY);
  if (before) grid.insertBefore(chip, before);
  else grid.appendChild(chip);
}

function beginDrag(): void {
  dragging = true;
  const r = chip!.getBoundingClientRect();
  grabDX = startX - r.left;
  grabDY = startY - r.top;
  ghost = chip!.cloneNode(true) as HTMLElement;
  ghost.classList.add('drag-ghost');
  ghost.style.width = r.width + 'px';
  ghost.style.height = r.height + 'px';
  ghost.style.left = r.left + 'px';
  ghost.style.top = r.top + 'px';
  document.body.appendChild(ghost);
  chip!.classList.add('drag-src');
  document.body.classList.add('dragging-loc');
}

/** Persist the order of one grid: sequential pos, the grid's category, for every chip. */
function placementsFor(grid: HTMLElement): Array<{ key: string; cat: string; pos: number }> {
  const cat = grid.dataset.cat!;
  return [...grid.querySelectorAll<HTMLElement>('.chip.ig')].map((c, pos) => ({ key: c.dataset.ing!, cat, pos }));
}

function onUp(e: PointerEvent): void {
  if (e.pointerId !== pointerId) return;
  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('pointerup', onUp);
  window.removeEventListener('pointercancel', onUp);
  if (!dragging) { chip = null; pointerId = -1; return; }

  const destGrid = chip!.closest<HTMLElement>('.loc-grid[data-cat]');
  ghost?.remove();
  chip?.classList.remove('drag-src');
  document.body.classList.remove('dragging-loc');

  if (destGrid) {
    const updates = placementsFor(destGrid);
    if (sourceGrid && sourceGrid !== destGrid) updates.push(...placementsFor(sourceGrid));
    setProfilePlacement(state.profileId, updates);
  }
  chip = ghost = sourceGrid = null;
  pointerId = -1;
  dragging = false;
  render();   // rebuild from the persisted placement (also re-runs layoutCards)
}

export function initLocationDrag(): void {
  $('#main').addEventListener('pointerdown', e => {
    const pe = e as PointerEvent;
    if (!active()) return;
    if (pe.pointerType === 'mouse' && pe.button !== 0) return;   // left button only for mouse
    const t = e.target as HTMLElement;
    if (t.closest('.ig-edit-btn,.find')) return;     // let inset buttons do their thing
    const c = t.closest<HTMLElement>('.chip.ig');
    if (!c) return;
    chip = c;
    sourceGrid = c.closest<HTMLElement>('.loc-grid[data-cat]');
    pointerId = pe.pointerId;
    startX = pe.clientX;
    startY = pe.clientY;
    dragging = false;
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  });
}
