import type { SyncPayload } from './types';
import { mergePayload } from './merge';

/* ============================================================
   Sync engine + HTTP transport (no DOM, no state, no localStorage).

   The orchestration core, kept free of globals so the conflict-retry logic is
   unit-testable with a fake transport and in-memory state (see sync.test.ts). The
   DOM/state/session wiring that binds this to the real app lives in sync.ts.
   ============================================================ */

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'error';

export interface PullResult { payload: SyncPayload | null; version: string | null; }
export type PushResult =
  | { ok: true; version: string | null }
  | { ok: false; version: string | null; payload: SyncPayload | null };

export interface Transport {
  pull(token: string): Promise<PullResult>;
  push(token: string, payload: SyncPayload, baseVersion: string | null): Promise<PushResult>;
}

export interface SyncDeps {
  transport: Transport;
  getLocal: () => SyncPayload;
  /** Replace local state with a payload and persist it (must NOT re-fire the mutate hook). */
  apply: (p: SyncPayload) => void;
  getToken: () => string | null;
  getVersion: () => string | null;
  setVersion: (v: string | null) => void;
  onStatus?: (s: SyncStatus) => void;
}

/** Order-independent structural compare — used to skip a redundant push when the merge
 *  produced exactly what the server already holds. */
export function stable(v: unknown): string {
  return JSON.stringify(v, (_k, val) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.fromEntries(Object.entries(val).sort(([a], [b]) => a.localeCompare(b)))
      : val);
}

const MAX_RETRIES = 6;

export function createSyncEngine(deps: SyncDeps) {
  const status = (s: SyncStatus) => deps.onStatus?.(s);

  /** Apply a merged payload only when it differs from current local state, so a pull that
   *  changes nothing doesn't trigger a re-render (which would reflow every recipe card). */
  function applyIfChanged(next: SyncPayload): void {
    if (stable(next) !== stable(deps.getLocal())) deps.apply(next);
  }

  /** Push local state, resolving conflicts by merging the server's copy and retrying
   *  with its new version. Convergent + idempotent, so the bounded loop always settles. */
  async function pushNow(): Promise<void> {
    const token = deps.getToken();
    if (!token) return;
    status('syncing');
    try {
      for (let i = 0; i < MAX_RETRIES; i++) {
        const res = await deps.transport.push(token, deps.getLocal(), deps.getVersion());
        if (res.ok) { deps.setVersion(res.version); status('idle'); return; }
        deps.setVersion(res.version);
        if (res.payload) applyIfChanged(mergePayload(deps.getLocal(), res.payload));
      }
      status('error'); // exhausted retries (someone is writing in a tight loop)
    } catch { status('error'); }
  }

  /** Steady-state pull: merge the server's copy into local, then push back iff local was
   *  ahead (so the other devices converge). No-op churn is avoided by the equality check. */
  async function pullMerge(): Promise<void> {
    const token = deps.getToken();
    if (!token) return;
    status('syncing');
    try {
      const { payload, version } = await deps.transport.pull(token);
      deps.setVersion(version);
      if (!payload) { await pushNow(); return; }       // server empty → seed it from local
      const merged = mergePayload(deps.getLocal(), payload);
      applyIfChanged(merged);                          // re-render only if our state actually changed
      if (stable(merged) !== stable(payload)) await pushNow();
      else status('idle');
    } catch { status('error'); }
  }

  /** Destructive sign-in adoption: take the server's state exactly, discarding local. */
  async function adopt(): Promise<void> {
    const token = deps.getToken();
    if (!token) return;
    status('syncing');
    try {
      const { payload, version } = await deps.transport.pull(token);
      deps.setVersion(version);
      if (payload) deps.apply(payload);
      else await pushNow();                            // account has no doc yet → seed from local
      status('idle');
    } catch { status('error'); }
  }

  return { pushNow, pullMerge, adopt };
}

/* ---------------- HTTP transport (relative /api/* → works under netlify dev and prod) ---------------- */

export async function postJSON(path: string, body: unknown, token?: string): Promise<Response> {
  return fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
}

export const httpTransport: Transport = {
  async pull(token) {
    const r = await fetch('/api/pull', { headers: { authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`pull ${r.status}`);
    const j = await r.json();
    return { payload: (j.payload ?? null) as SyncPayload | null, version: j.version ?? null };
  },
  async push(token, payload, baseVersion) {
    const r = await fetch('/api/push', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ payload, baseVersion }),
    });
    if (r.status === 409) { const j = await r.json(); return { ok: false, version: j.version ?? null, payload: (j.payload ?? null) as SyncPayload | null }; }
    if (!r.ok) throw new Error(`push ${r.status}`);
    const j = await r.json();
    return { ok: true, version: j.version ?? null };
  },
};

export interface AuthError extends Error { status?: number; }
/** POST credentials to signup/login; returns the issued token + canonical account name. */
export async function authCall(path: string, accountName: string, password: string): Promise<{ token: string; account: string }> {
  const r = await postJSON(path, { accountName, password });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e: AuthError = new Error(j.error || `request failed (${r.status})`); e.status = r.status; throw e; }
  return { token: j.token, account: j.account };
}
