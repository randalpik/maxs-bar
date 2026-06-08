import { sessionsStore } from './_lib/blobs';
import { bearer } from './_lib/auth';
import { noContent, error } from './_lib/respond';

/* POST /api/logout  (bearer) -> 204
   Deletes just this device's session blob; other household devices stay signed in.
   Idempotent — deleting an unknown/expired token is a no-op. */
export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return error(405, 'method not allowed');
  const token = bearer(req);
  if (token) await sessionsStore().delete(token);
  return noContent();
};
