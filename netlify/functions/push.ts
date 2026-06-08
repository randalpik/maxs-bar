import { stateStore } from './_lib/blobs';
import { authAccount } from './_lib/auth';
import { isValidPayload, withinSize } from './_lib/payload';
import { json, error } from './_lib/respond';

/* PUT /api/push  (bearer)  { payload, baseVersion } -> 200 { version } | 409 { version, payload }
   Optimistic concurrency: the write only lands if the server's version still equals the
   client's baseVersion (or, first time, if no doc exists). On a 409 the caller re-pulls,
   merges, and retries — the merge is convergent, so it always settles. */
export default async (req: Request): Promise<Response> => {
  if (req.method !== 'PUT' && req.method !== 'POST') return error(405, 'method not allowed');
  const account = await authAccount(req);
  if (!account) return error(401, 'not signed in');

  const body = await req.json().catch(() => null) as { payload?: unknown; baseVersion?: unknown } | null;
  if (!body || !isValidPayload(body.payload)) return error(400, 'invalid payload');
  if (!withinSize(body.payload)) return error(413, 'payload too large');

  const store = stateStore();
  const baseVersion = typeof body.baseVersion === 'string' && body.baseVersion ? body.baseVersion : undefined;
  // First push for the account creates the doc (onlyIfNew); subsequent pushes require the
  // version to be unchanged (onlyIfMatch). Either way a stale write returns modified:false.
  const opts = baseVersion ? { onlyIfMatch: baseVersion } : { onlyIfNew: true };
  const res = await store.setJSON(account, body.payload, opts);

  if (!res.modified) {
    const cur = await store.getWithMetadata(account, { type: 'json' });
    return json({ conflict: true, version: cur?.etag ?? null, payload: cur?.data ?? null }, 409);
  }
  // `etag` is present on a successful conditional write; fall back to a metadata read if not.
  let version = res.etag ?? null;
  if (!version) version = (await store.getMetadata(account))?.etag ?? null;
  return json({ version });
};
