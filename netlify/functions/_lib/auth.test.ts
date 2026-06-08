import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, newToken, accountKey } from './auth';

/* The auth primitives are Node-built-in crypto only (no dependency). These guard the
   essentials: scrypt round-trips, salts are unique, and tokens look right. */

describe('password hashing (scrypt)', () => {
  it('verifies the correct password and rejects a wrong one', () => {
    const { salt, hash } = hashPassword('correct horse battery');
    expect(verifyPassword('correct horse battery', salt, hash)).toBe(true);
    expect(verifyPassword('wrong password', salt, hash)).toBe(false);
  });

  it('uses a random salt, so two hashes of the same password differ', () => {
    const a = hashPassword('same'); const b = hashPassword('same');
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
    expect(verifyPassword('same', a.salt, a.hash)).toBe(true);
  });
});

describe('tokens + account keys', () => {
  it('tokens are unique 64-hex-char strings', () => {
    const t = newToken();
    expect(t).toMatch(/^[0-9a-f]{64}$/);
    expect(newToken()).not.toBe(t);
  });

  it('account keys are case- and whitespace-normalised', () => {
    expect(accountKey('  The Smiths ')).toBe('the smiths');
  });
});
