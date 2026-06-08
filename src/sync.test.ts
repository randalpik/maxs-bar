import { describe, it, expect } from 'vitest';
import type { SyncPayload } from './types';
import { createSyncEngine, type Transport } from './sync-engine';

/* Engine orchestration over a fake transport + in-memory state — no DOM, no network.
   Verifies the pull→merge→apply→push flow, the push→409→re-pull→merge→retry loop, and
   the destructive sign-in adopt. (The merge itself is exhaustively covered in merge.test.) */

const P = (p: Partial<SyncPayload>): SyncPayload =>
  ({ seedId: 'classics', seedTs: 0, recipeOverrides: {}, ingredients: {}, stockTs: {}, ...p });
const ro = (recipe: string, edited: string) => ({ recipe, edited });

/** A fake server: monotonic version counter, optimistic-concurrency on baseVersion. */
function fakeServer(initial: { payload: SyncPayload | null; version: string | null } = { payload: null, version: null }) {
  const srv = { payload: initial.payload, version: initial.version };
  let n = srv.version ? Number(srv.version.slice(1)) : 0;
  const transport: Transport = {
    pull: async () => ({ payload: srv.payload, version: srv.version }),
    push: async (_t, payload, base) => {
      if (base !== srv.version) return { ok: false, version: srv.version, payload: srv.payload };
      srv.version = 'v' + ++n;
      srv.payload = payload;
      return { ok: true, version: srv.version };
    },
  };
  return { srv, transport };
}

function engineOver(localInit: SyncPayload, server: ReturnType<typeof fakeServer>, initialVersion: string | null = null) {
  let local = localInit;
  let version = initialVersion;
  let applies = 0;
  const statuses: string[] = [];
  const engine = createSyncEngine({
    transport: server.transport,
    getLocal: () => local,
    apply: (p) => { local = p; applies++; },
    getToken: () => 'token',
    getVersion: () => version,
    setVersion: (v) => { version = v; },
    onStatus: (s) => statuses.push(s),
  });
  return { engine, getLocal: () => local, getVersion: () => version, statuses, applyCount: () => applies };
}

describe('pullMerge', () => {
  it('merges the server doc into local and pushes back when local was ahead', async () => {
    const server = fakeServer({ payload: P({ recipeOverrides: { b: ro('B', '2026-01-01T00:00:00.000Z') } }), version: 'v1' });
    const h = engineOver(P({ recipeOverrides: { a: ro('A', '2026-01-02T00:00:00.000Z') } }), server);
    await h.engine.pullMerge();
    expect(Object.keys(h.getLocal().recipeOverrides).sort()).toEqual(['a', 'b']);   // both present locally
    expect(Object.keys(server.srv.payload!.recipeOverrides).sort()).toEqual(['a', 'b']); // server converged
    expect(h.getVersion()).toBe(server.srv.version);
  });

  it('does not push when the merge equals what the server already holds', async () => {
    const server = fakeServer({ payload: P({ recipeOverrides: { a: ro('A', '2026-01-01T00:00:00.000Z') } }), version: 'v1' });
    const h = engineOver(P({}), server);                 // local empty ⇒ merge == server
    await h.engine.pullMerge();
    expect(h.getLocal().recipeOverrides.a!.recipe).toBe('A');
    expect(server.srv.version).toBe('v1');               // untouched — no redundant push
    expect(h.statuses.at(-1)).toBe('idle');
  });

  it('does not apply/re-render when the pull changes nothing locally', async () => {
    const same = P({ recipeOverrides: { a: ro('A', '2026-01-01T00:00:00.000Z') } });
    const server = fakeServer({ payload: same, version: 'v1' });
    const h = engineOver(P({ recipeOverrides: { a: ro('A', '2026-01-01T00:00:00.000Z') } }), server); // identical to server
    await h.engine.pullMerge();
    expect(h.applyCount()).toBe(0);                      // no re-render → no recipe reflow
    expect(server.srv.version).toBe('v1');               // and no push
  });

  it('seeds an empty server from local', async () => {
    const server = fakeServer();                         // payload null
    const h = engineOver(P({ recipeOverrides: { mine: ro('M', '2026-01-01T00:00:00.000Z') } }), server);
    await h.engine.pullMerge();
    expect(server.srv.payload!.recipeOverrides.mine!.recipe).toBe('M');
  });
});

describe('pushNow conflict handling', () => {
  it('re-pulls, merges and retries when the version is stale', async () => {
    // Another device already advanced the server to v2 with its own edit.
    const server = fakeServer({ payload: P({ recipeOverrides: { remote: ro('R', '2026-01-01T00:00:00.000Z') } }), version: 'v2' });
    const h = engineOver(P({ recipeOverrides: { local: ro('L', '2026-01-02T00:00:00.000Z') } }), server, 'v1'); // stale base
    await h.engine.pushNow();
    expect(Object.keys(server.srv.payload!.recipeOverrides).sort()).toEqual(['local', 'remote']);
    expect(Object.keys(h.getLocal().recipeOverrides).sort()).toEqual(['local', 'remote']);
    expect(server.srv.version).toBe('v3');               // v2 (conflict) → merge → v3 (success)
    expect(h.getVersion()).toBe('v3');
  });
});

describe('adopt (destructive sign-in)', () => {
  it('replaces local with the server doc exactly and does not push', async () => {
    const server = fakeServer({ payload: P({ recipeOverrides: { srv: ro('S', '2026-01-01T00:00:00.000Z') }, seedId: 'maxs-list', seedTs: 5 }), version: 'v1' });
    const h = engineOver(P({ recipeOverrides: { local: ro('L', '2026-09-09T00:00:00.000Z') }, seedId: 'empty' }), server);
    await h.engine.adopt();
    expect(Object.keys(h.getLocal().recipeOverrides)).toEqual(['srv']); // local discarded despite newer ts
    expect(h.getLocal().seedId).toBe('maxs-list');
    expect(server.srv.version).toBe('v1');               // adopt never pushes
  });

  it('seeds from local when the account has no doc yet', async () => {
    const server = fakeServer();
    const h = engineOver(P({ ingredients: { gin: { color: '#abc', ts: 1 } } }), server);
    await h.engine.adopt();
    expect(server.srv.payload!.ingredients.gin!.color).toBe('#abc');
  });
});

describe('failure handling', () => {
  it('reports error and leaves local untouched when the transport throws', async () => {
    const transport: Transport = { pull: async () => { throw new Error('network'); }, push: async () => { throw new Error('network'); } };
    let local = P({ recipeOverrides: { a: ro('A', '2026-01-01T00:00:00.000Z') } });
    const statuses: string[] = [];
    const engine = createSyncEngine({
      transport, getLocal: () => local, apply: (p) => { local = p; },
      getToken: () => 'token', getVersion: () => null, setVersion: () => {}, onStatus: (s) => statuses.push(s),
    });
    await engine.pullMerge();
    expect(statuses.at(-1)).toBe('error');
    expect(local.recipeOverrides.a!.recipe).toBe('A'); // unchanged
  });

  it('does nothing when signed out (no token)', async () => {
    const server = fakeServer({ payload: P({ recipeOverrides: { x: ro('X', '2026-01-01T00:00:00.000Z') } }), version: 'v1' });
    let local = P({});
    const engine = createSyncEngine({
      transport: server.transport, getLocal: () => local, apply: (p) => { local = p; },
      getToken: () => null, getVersion: () => null, setVersion: () => {},
    });
    await engine.pullMerge();
    expect(Object.keys(local.recipeOverrides)).toEqual([]); // never pulled
  });
});
