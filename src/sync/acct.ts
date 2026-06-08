import { hasLocalData } from '../core/state';
import { signUp, signIn, signOut, currentAccount } from './sync';
import { confirmModal } from '../ui/confirm';
import { $ } from '../core/dom';

/* ============================================================
   Account / sync modal: create account, sign in (destructive), sign out.
   Mirrors the other overlays — the heavy lifting lives in sync.ts.
   ============================================================ */

const SIGN_IN_WARNING =
  "Signing in replaces this device's data with the account's. Your local recipes, stock and ingredient edits will be lost unless you've exported a backup first.";

function setMsg(text: string, isError = true): void {
  const m = $('#acctMsg');
  m.textContent = text;
  m.classList.toggle('err', isError && !!text);
}
function creds(): { name: string; pass: string } {
  return { name: $<HTMLInputElement>('#acctName').value.trim(), pass: $<HTMLInputElement>('#acctPass').value };
}
function busy(b: boolean): void {
  $<HTMLButtonElement>('#acctCreate').disabled = b;
  $<HTMLButtonElement>('#acctSignin').disabled = b;
}
function friendly(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  return m || 'Something went wrong — try again.';
}

export function openAcctModal(): void {
  const account = currentAccount();
  $<HTMLElement>('#acctSignedOut').style.display = account ? 'none' : '';
  $<HTMLElement>('#acctSignedIn').style.display = account ? '' : 'none';
  if (account) {
    $('#acctWho').textContent = account;
  } else {
    $<HTMLInputElement>('#acctName').value = '';
    $<HTMLInputElement>('#acctPass').value = '';
    setMsg('');
  }
  $('#acctOverlay').classList.add('open');
  if (!account) $<HTMLInputElement>('#acctName').focus();
}

export function closeAcctModal(): void { $('#acctOverlay').classList.remove('open'); }

export async function createAccount(): Promise<void> {
  const { name, pass } = creds();
  if (!name || pass.length < 6) { setMsg('Enter a name and a password of at least 6 characters.'); return; }
  busy(true); setMsg('Creating account…', false);
  try { await signUp(name, pass); closeAcctModal(); }
  catch (e) { setMsg(friendly(e)); }
  finally { busy(false); }
}

export async function doSignIn(): Promise<void> {
  const { name, pass } = creds();
  if (!name || !pass) { setMsg('Enter your account name and password.'); return; }
  // destructive — adopts the account exactly, discarding local data
  if (hasLocalData() && !await confirmModal({
    title: 'Sign in', message: SIGN_IN_WARNING, confirmText: 'Sign in & replace', danger: true,
  })) return;
  busy(true); setMsg('Signing in…', false);
  try { await signIn(name, pass); closeAcctModal(); }
  catch (e) { setMsg(friendly(e)); }
  finally { busy(false); }
}

/** Sign out leaves the current in-app state untouched (just drops the session). */
export function doSignOut(): void { signOut(); closeAcctModal(); }
