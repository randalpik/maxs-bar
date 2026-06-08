import { accountsStore, sessionsStore } from './_lib/blobs';
import { verifyPassword, newToken, accountKey, type AccountRecord, type SessionRecord } from './_lib/auth';
import { validName, validPassword } from './_lib/payload';
import { json, error } from './_lib/respond';

/* POST /api/login  { accountName, password } -> 200 { token, account }
   On the client this is the *destructive* transition: after a successful login the
   device pulls and adopts the account's state exactly. A wrong name and a wrong
   password return the same 401 (no account enumeration). */
export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return error(405, 'method not allowed');
  const body = await req.json().catch(() => null) as { accountName?: unknown; password?: unknown } | null;
  if (!body || !validName(body.accountName) || !validPassword(body.password)) return error(400, 'invalid credentials');

  const acc = await accountsStore().get(accountKey(body.accountName), { type: 'json' }) as AccountRecord | null;
  if (!acc || !verifyPassword(body.password, acc.salt, acc.hash)) return error(401, 'incorrect account or password');

  const token = newToken();
  await sessionsStore().setJSON(token, { account: accountKey(acc.name), created: Date.now() } satisfies SessionRecord);
  return json({ token, account: acc.name }, 200);
};
