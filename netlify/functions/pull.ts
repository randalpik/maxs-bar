import { stateStore } from './_lib/blobs';
import { authAccount } from './_lib/auth';
import { json, error } from './_lib/respond';

/* GET /api/pull  (bearer) -> 200 { payload, version }
   Returns the account's shared document and its current version (the blob etag), or
   { payload: null, version: null } if nothing has been pushed yet. The client merges
   `payload` into its local state. */
export default async (req: Request): Promise<Response> => {
  if (req.method !== 'GET') return error(405, 'method not allowed');
  const account = await authAccount(req);
  if (!account) return error(401, 'not signed in');

  const res = await stateStore().getWithMetadata(account, { type: 'json' });
  if (!res) return json({ payload: null, version: null });
  return json({ payload: res.data, version: res.etag ?? null });
};
