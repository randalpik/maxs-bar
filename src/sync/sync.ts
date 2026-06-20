import { state, buildSyncState, applySyncState, setOnMutate } from '../core/state';
import { reconcileStock, refreshUnits } from '../ingredients/catalog';
import { render } from '../ui/render';
import { $ } from '../core/dom';
import {
  createSyncEngine, httpTransport, authCall, postJSON, type SyncStatus,
} from './sync-engine';

/* ============================================================
   Sync wiring: binds the DOM-free engine (sync-engine.ts) to the real app — the HTTP
   transport, the state.ts payload helpers, a debounced push on every local mutation,
   pull triggers (load / focus / visible poll), the session token, the toolbar status
   indicator, and the three account transitions.

   The app works fully logged-out: nothing here runs until a session exists (initSync
   finds a stored token, or the user signs in / creates an account).
   ============================================================ */

/* ---------------- session storage ---------------- */

const AUTH_KEY = 'backbar.auth.v1';
interface Auth { token: string; account: string; version: string | null; }
let auth: Auth | null = null;

function loadAuth(): Auth | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const a = JSON.parse(raw);
    if (a && typeof a.token === 'string' && typeof a.account === 'string') return { token: a.token, account: a.account, version: a.version ?? null };
  } catch { /* fall through */ }
  return null;
}
function saveAuth(): void {
  if (auth) localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  else localStorage.removeItem(AUTH_KEY);
}

/* ---------------- sync button (toolbar) ---------------- */

let status: SyncStatus = 'off';
const BTN_LABEL: Record<SyncStatus, string> = { off: 'Sync now', idle: 'Sync now', syncing: 'Syncing…', error: 'Sync error' };
/** The toolbar Sync button shows only while signed in; its label reflects sync status,
 *  and clicking it triggers an immediate sync (see syncNow / main.ts wiring). */
function renderSyncBtn(): void {
  const btn = $<HTMLButtonElement>('#syncBtn');
  if (!btn) return;
  btn.style.display = auth ? '' : 'none';
  btn.textContent = BTN_LABEL[status];
  btn.dataset.status = status;
}
function setStatus(s: SyncStatus): void { status = s; renderSyncBtn(); }
export const syncStatus = (): SyncStatus => status;
export const currentAccount = (): string | null => auth?.account ?? null;
/** Manual sync trigger (the toolbar Sync button). No-op when signed out. */
export function syncNow(): void { if (auth) void engine.pullMerge(); }

/* ---------------- engine + wiring ---------------- */

const engine = createSyncEngine({
  transport: httpTransport,
  getLocal: buildSyncState,
  apply: (p) => { applySyncState(p); refreshUnits(); reconcileStock(state.records); render(); },
  getToken: () => auth?.token ?? null,
  getVersion: () => auth?.version ?? null,
  setVersion: (v) => { if (auth) { auth.version = v; saveAuth(); } },
  onStatus: setStatus,
});

let pushTimer: ReturnType<typeof setTimeout> | undefined;
/** Debounce local edits into one push (the three save funcs can fire in quick succession). */
function schedulePush(): void {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { void engine.pushNow(); }, 1200);
}

let pollTimer: ReturnType<typeof setInterval> | undefined;
const onVisible = (): void => { if (document.visibilityState === 'visible') void engine.pullMerge(); };
function startListeners(): void {
  if (pollTimer) return;
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onVisible);
  pollTimer = setInterval(() => { if (document.visibilityState === 'visible') void engine.pullMerge(); }, 60_000);
}
function stopListeners(): void {
  document.removeEventListener('visibilitychange', onVisible);
  window.removeEventListener('focus', onVisible);
  if (pollTimer) { clearInterval(pollTimer); pollTimer = undefined; }
}

function goLive(): void {
  setOnMutate(schedulePush);
  startListeners();
}

/** Called once at startup (after load + first render). If a session is stored, resume
 *  syncing; otherwise stay inert (app works fully logged-out). */
export function initSync(): void {
  auth = loadAuth();
  updateAccountUI();
  if (!auth) { setStatus('off'); return; }
  goLive();
  void engine.pullMerge();
}

/** Create a new account: the current local bar becomes the account's initial state. */
export async function signUp(accountName: string, password: string): Promise<void> {
  const { token, account } = await authCall('/api/signup', accountName, password);
  auth = { token, account, version: null }; saveAuth();
  updateAccountUI();
  goLive();
  await engine.pushNow();
}

/** Sign in to an existing account: DESTRUCTIVE — adopt the account's state, discarding
 *  local data. Callers must warn (hasLocalData) before invoking this. */
export async function signIn(accountName: string, password: string): Promise<void> {
  const { token, account } = await authCall('/api/login', accountName, password);
  auth = { token, account, version: null }; saveAuth();
  updateAccountUI();
  goLive();
  await engine.adopt();
}

/** Sign out: drop the session (best-effort server delete). Local in-app state is untouched. */
export function signOut(): void {
  const token = auth?.token;
  stopListeners();
  setOnMutate(null);
  clearTimeout(pushTimer);
  auth = null; saveAuth();
  setStatus('off');
  updateAccountUI();
  if (token) void postJSON('/api/logout', {}, token).catch(() => { /* best-effort */ });
}

/** Reflect signed-in/out in the toolbar account button + menu entry (created by the UI). */
function updateAccountUI(): void {
  const menuBtn = $('#menuAccount');
  if (menuBtn) menuBtn.textContent = auth ? `Account…` : 'Sign in & sync…';
  renderSyncBtn();
}
