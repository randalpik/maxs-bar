import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { sessionsStore } from './blobs';

/* Lightweight custom auth. Passwords are scrypt-hashed with a per-account salt (Node
   built-ins only — no dependency). Sessions are opaque 256-bit random tokens stored
   server-side: a shared household account can have N concurrent device sessions, and
   sign-out is a single blob delete. Data isn't sensitive, but we still never store a
   plaintext password and compare in constant time. */

const KEYLEN = 64;

export interface AccountRecord { name: string; salt: string; hash: string; created: string; }
export interface SessionRecord { account: string; created: number; }

export function hashPassword(password: string, salt = randomBytes(16).toString('hex')): { salt: string; hash: string } {
  return { salt, hash: scryptSync(password, salt, KEYLEN).toString('hex') };
}

export function verifyPassword(password: string, salt: string, hash: string): boolean {
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(password, salt, KEYLEN);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export const newToken = (): string => randomBytes(32).toString('hex');

/** Normalise an account name to its storage key (case-insensitive accounts). */
export const accountKey = (name: string): string => name.trim().toLowerCase();

const bearer = (req: Request): string | null => {
  const m = (req.headers.get('authorization') ?? '').match(/^Bearer\s+(\S+)$/i);
  return m ? m[1]! : null;
};

/** Resolve the request's bearer token to its account key, or null if missing/invalid. */
export async function authAccount(req: Request): Promise<string | null> {
  const token = bearer(req);
  if (!token) return null;
  const sess = await sessionsStore().get(token, { type: 'json' }) as SessionRecord | null;
  return sess?.account ?? null;
}

export { bearer };
