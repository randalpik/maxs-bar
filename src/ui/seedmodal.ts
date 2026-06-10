import { state, switchSeed } from '../core/state';
import { SEEDS } from '../recipes/seeds';
import { render } from './render';
import { $ } from '../core/dom';

/* ============================================================
   Choose / switch seed modal

   Opened forced on first run (no seed chosen yet) — the user must pick before
   the app is usable, so Cancel and backdrop/Esc dismissal are disabled. Opened
   unforced from the menu ("Switch seed…"), where cancelling is allowed.
   ============================================================ */
let forced = false;

/** Whether the modal is currently open in forced (no-dismiss) mode. */
export function seedModalForced(): boolean {
  return forced && $('#seedOverlay').classList.contains('open');
}

export function fillSeedSel(): void {
  const sel = $<HTMLSelectElement>('#seedSel');
  sel.innerHTML = '';
  for (const s of SEEDS) {
    const o = document.createElement('option');
    o.value = s.id; o.textContent = s.label;
    sel.appendChild(o);
  }
  if (state.seedId && SEEDS.some(s => s.id === state.seedId)) sel.value = state.seedId;
}

export function openSeedModal(opts: { forced: boolean }): void {
  forced = opts.forced;
  fillSeedSel();
  $('#seedTitle').textContent = forced ? 'Choose a starter list' : 'Switch seed';
  $<HTMLElement>('#seedCancel').style.display = forced ? 'none' : 'block';
  $<HTMLElement>('#seedClose').style.display = forced ? 'none' : 'grid'; // no dismiss on first run

  $('#seedOverlay').classList.add('open');
}

export function closeSeedModal(): void {
  if (forced) return; // a choice is required on first run
  $('#seedOverlay').classList.remove('open');
}

export function confirmSeed(): void {
  switchSeed($<HTMLSelectElement>('#seedSel').value);
  forced = false;
  $('#seedOverlay').classList.remove('open');
  render();
}
