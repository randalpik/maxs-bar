import { accountsStore, sessionsStore } from './_lib/blobs';
import { hashPassword, newToken, accountKey, type AccountRecord, type SessionRecord } from './_lib/auth';
import { validName, validPassword } from './_lib/payload';
import { json, error } from './_lib/respond';

/* POST /api/signup  { accountName, password } -> 201 { token, account }
   Open signup (no invite code). Creating the account does NOT touch the synced
   document — the client pushes its current local state up as the initial account
   state right after, so a new household account starts from the creator's bar. */
export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return error(405, 'method not allowed');
  const body = await req.json().catch(() => null) as { accountName?: unknown; password?: unknown } | null;
  if (!body || !validName(body.accountName) || !validPassword(body.password)) return error(400, 'invalid credentials');

  const key = accountKey(body.accountName);
  const accounts = accountsStore();
  // Explicit existence check first: the production Blobs `onlyIfNew` below makes creation
  // atomic, but the local dev sandbox doesn't enforce conditional writes — this read keeps
  // accounts unique there too (and is the common-case guard everywhere).
  if (await accounts.get(key, { type: 'json' })) return error(409, 'account already exists');

  const { salt, hash } = hashPassword(body.password);
  const record: AccountRecord = { name: body.accountName.trim(), salt, hash, created: new Date().toISOString() };
  const res = await accounts.setJSON(key, record, { onlyIfNew: true });
  if (!res.modified) return error(409, 'account already exists');

  const token = newToken();
  await sessionsStore().setJSON(token, { account: key, created: Date.now() } satisfies SessionRecord);
  return json({ token, account: record.name }, 201);
};
