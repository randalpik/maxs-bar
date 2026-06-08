/* Tiny Response helpers. Functions are same-origin with the SPA (served via the
   /api/* redirect), so no CORS headers are needed. */

export const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export const noContent = (): Response => new Response(null, { status: 204 });

export const error = (status: number, message: string): Response => json({ error: message }, status);
