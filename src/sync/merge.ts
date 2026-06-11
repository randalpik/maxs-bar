import type { RecipeOverride, IngredientOverride, StockEntry, SyncPayload, Profile } from '../core/types';

/* ============================================================
   Per-key last-write-wins merge (pure — no state, DOM or I/O).

   The crux of cross-device sync. Two devices sharing one account each hold a
   SyncPayload; merging them must converge regardless of order or how many times it
   runs, so concurrent edits on different items never clobber each other. We model
   each slice as an LWW-map: per key, the entry with the newer timestamp wins, with a
   deterministic tie-break on equal timestamps (clock skew / same-millisecond edits).
   That total order makes the merge commutative, associative and idempotent — the
   formal property that guarantees every device lands on the same state.

   Timestamps: recipes reuse the existing ISO `edited`; ingredients carry a `ts`
   (epoch-ms) stamped by setIngredientOverride; stock entries carry `ts`. Anything
   missing a timestamp reads as 0, so legacy/pre-sync data loses to a genuine edit.

   Deletions: recipe tombstones ({removed:true, edited}) compete like any other entry,
   so a delete at T2 beats an edit at T1 (and vice-versa). Ingredients have no
   tombstone, so the maps are unioned — a local reset (key dropped) loses to a
   concurrent remote edit and the ingredient resurrects. That trade-off is accepted
   (data isn't personal; local backups exist).
   ============================================================ */

/** Epoch-ms of a recipe override's last change (tombstones included via `edited`). */
const recipeTs = (o: RecipeOverride): number => (o.edited ? Date.parse(o.edited) : 0) || 0;

/** Pick the winner of two values by (timestamp, then a deterministic tie-break). The
 *  tie-break — larger JSON string wins — is arbitrary but stable across devices, so a
 *  same-timestamp clash resolves identically everywhere and the merge still converges. */
function pick<V>(a: V, ta: number, b: V, tb: number): V {
  if (ta !== tb) return ta > tb ? a : b;
  return JSON.stringify(a) >= JSON.stringify(b) ? a : b;
}

/** Union two keyed maps, resolving shared keys by `pick` over the supplied timestamp. */
function mergeMap<V>(local: Record<string, V>, remote: Record<string, V>, ts: (v: V) => number): Record<string, V> {
  const out: Record<string, V> = { ...local };
  for (const k of Object.keys(remote)) {
    const rv = remote[k]!;
    const lv = out[k];
    out[k] = lv === undefined ? rv : pick(lv, ts(lv), rv, ts(rv));
  }
  return out;
}

export function mergeRecipeOverrides(local: Record<string, RecipeOverride>, remote: Record<string, RecipeOverride>): Record<string, RecipeOverride> {
  return mergeMap(local, remote, recipeTs);
}

export function mergeIngredients(local: Record<string, IngredientOverride>, remote: Record<string, IngredientOverride>): Record<string, IngredientOverride> {
  return mergeMap(local, remote, o => o.ts ?? 0);
}

export function mergeStock(local: Record<string, StockEntry>, remote: Record<string, StockEntry>): Record<string, StockEntry> {
  return mergeMap(local, remote, e => e.ts);
}

/** Two-level merge for store profiles. Meta (name, cats, flags, deleted) is
 *  whole-profile LWW on the profile `ts` — a deletion is a tombstone competing like
 *  any other meta edit, so a later edit legitimately resurrects. Placements merge
 *  per-ingredient on their own `ts` regardless of which side won the meta, so
 *  concurrent drags on different items both survive a profile rename/reorder.
 *  A tombstone keeps its placements empty (deleteProfile drops them; merging into
 *  a tombstone would just carry dead weight the resurrection path doesn't need). */
export function mergeProfiles(local: Record<string, Profile>, remote: Record<string, Profile>): Record<string, Profile> {
  const out: Record<string, Profile> = { ...local };
  for (const id of Object.keys(remote)) {
    const rv = remote[id]!;
    const lv = out[id];
    if (lv === undefined) { out[id] = rv; continue; }
    const meta = pick(lv, lv.ts, rv, rv.ts);
    out[id] = meta.deleted
      ? { ...meta, placements: {} }
      : { ...meta, placements: mergeMap(lv.placements ?? {}, rv.placements ?? {}, p => p.ts) };
  }
  return out;
}

/** Merge two full payloads. `seedId` is a single scalar, resolved by its own LWW
 *  (`seedTs`); each override slice merges per key. Convergent + idempotent. */
export function mergePayload(local: SyncPayload, remote: SyncPayload): SyncPayload {
  const seed = pick(
    { seedId: local.seedId, seedTs: local.seedTs }, local.seedTs,
    { seedId: remote.seedId, seedTs: remote.seedTs }, remote.seedTs,
  );
  return {
    seedId: seed.seedId,
    seedTs: seed.seedTs,
    recipeOverrides: mergeRecipeOverrides(local.recipeOverrides, remote.recipeOverrides),
    ingredients: mergeIngredients(local.ingredients, remote.ingredients),
    stockTs: mergeStock(local.stockTs, remote.stockTs),
    profiles: mergeProfiles(local.profiles ?? {}, remote.profiles ?? {}),
  };
}
