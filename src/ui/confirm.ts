import { $ } from '../core/dom';

/* ============================================================
   Confirmation modal — in-style replacement for window.confirm.
   Promise-based; stacks above any open modal (overlay z-index 60).
   Esc/Enter are handled on the capture phase so the global keydown
   handler (which closes every modal) never sees them — the parent
   modal underneath stays open.
   ============================================================ */

interface ConfirmOpts {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  /** Style the confirm button as destructive (red). */
  danger?: boolean;
}

let active: ((ok: boolean) => void) | null = null;

export function confirmModal(opts: ConfirmOpts): Promise<boolean> {
  // Only one confirm at a time; a second call cancels the first.
  if (active) active(false);

  const overlay = $('#confirmOverlay');
  const ok = $<HTMLButtonElement>('#cfOk');
  const cancel = $<HTMLButtonElement>('#cfCancel');
  const prevFocus = document.activeElement as HTMLElement | null;

  $('#cfTitle').textContent = opts.title;
  $('#cfMsg').textContent = opts.message;
  ok.textContent = opts.confirmText ?? 'OK';
  cancel.textContent = opts.cancelText ?? 'Cancel';
  ok.classList.toggle('danger', !!opts.danger);
  ok.classList.toggle('primary', !opts.danger);

  return new Promise<boolean>(resolve => {
    const done = (result: boolean): void => {
      active = null;
      overlay.classList.remove('open');
      document.removeEventListener('keydown', onKey, true);
      ok.removeEventListener('click', onOk);
      cancel.removeEventListener('click', onCancel);
      overlay.removeEventListener('click', onBackdrop);
      prevFocus?.focus?.();
      resolve(result);
    };
    const onOk = (): void => done(true);
    const onCancel = (): void => done(false);
    const onBackdrop = (e: MouseEvent): void => { if (e.target === overlay) done(false); };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); done(false); }
      else if (e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); done(true); }
    };

    active = done;
    ok.addEventListener('click', onOk);
    cancel.addEventListener('click', onCancel);
    overlay.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onKey, true); // capture: beat the global handler
    overlay.classList.add('open');
    ok.focus();
  });
}
