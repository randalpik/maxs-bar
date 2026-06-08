import { getStore } from '@netlify/blobs';

/* The three blob stores backing sync. In a deployed function (and under `netlify dev`)
   getStore auto-resolves credentials from the function context — no secrets to wire up.
   `state` uses strong consistency so the etag conditional writes in push.ts are reliable. */

/** Account records: key = lowercased account name → { name, salt, hash, created }. */
export const accountsStore = () => getStore('bar-accounts');

/** Sessions: key = opaque token → { account, created }. One row per signed-in device. */
export const sessionsStore = () => getStore('bar-sessions');

/** The shared synced document: key = account → SyncPayload JSON. Its etag is the version. */
export const stateStore = () => getStore({ name: 'bar-state', consistency: 'strong' });
