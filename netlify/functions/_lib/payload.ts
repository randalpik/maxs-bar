/* Minimal structural validation for untrusted request bodies. The server treats the
   sync payload as opaque (it never parses recipe structure), so this only checks the
   top-level shape and a sane size cap — enough to reject junk and refuse a runaway blob. */

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** A sync payload's top-level shape: { seedId, seedTs, recipeOverrides, ingredients,
 *  stockTs, profiles? } — profiles stays optional so pre-profiles clients validate. */
export function isValidPayload(v: unknown): boolean {
  if (!isObject(v)) return false;
  return typeof v.seedId === 'string'
    && typeof v.seedTs === 'number'
    && isObject(v.recipeOverrides)
    && isObject(v.ingredients)
    && isObject(v.stockTs)
    && (v.profiles === undefined || isObject(v.profiles));
}

/** Reject an oversized document (~5 MB of JSON — far above any real bar). */
export const MAX_PAYLOAD_BYTES = 5_000_000;
export const withinSize = (v: unknown): boolean => JSON.stringify(v).length <= MAX_PAYLOAD_BYTES;

/** Account name: 1–64 visible chars. Password: 6–256 chars. Deliberately permissive —
 *  the threat model is low (non-personal household data), so we only block the absurd. */
export const validName = (v: unknown): v is string => typeof v === 'string' && v.trim().length >= 1 && v.trim().length <= 64;
export const validPassword = (v: unknown): v is string => typeof v === 'string' && v.length >= 6 && v.length <= 256;
