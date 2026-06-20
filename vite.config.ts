import { defineConfig, type PluginOption } from 'vitest/config';
import http from 'node:http';

const FUNCTIONS_PORT = 9999;

/**
 * Dev-only forwarder for the SPA's /api/* calls to a locally-running
 * `npx netlify functions:serve` (port 9999), rewriting to its function paths.
 * Replaces the declarative `server.proxy` so we can answer a quiet 503 when the
 * functions server isn't running — instead of Vite's proxy dumping a multi-line
 * `AggregateError [ECONNREFUSED]` stack on every poll. The app degrades gracefully
 * (sync just shows an error), so you don't need the functions server up unless
 * you're working on the account/sync system. Production uses the /api/* redirect
 * in netlify.toml instead, so this is dev-only.
 */
function devApiProxy(): PluginOption {
  let warned = false;
  return {
    name: 'dev-api-proxy',
    apply: 'serve',
    configureServer(server) {
      // connect's mount strips '/api', so req.url here is e.g. '/pull?…'.
      server.middlewares.use('/api', (req, res) => {
        const proxyReq = http.request(
          { host: 'localhost', port: FUNCTIONS_PORT, method: req.method, path: '/.netlify/functions' + req.url,
            headers: { ...req.headers, host: `localhost:${FUNCTIONS_PORT}` } },
          (proxyRes) => { res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers); proxyRes.pipe(res); },
        );
        proxyReq.on('error', () => {
          if (!warned) { server.config.logger.warn(`[dev-api-proxy] functions server not reachable on :${FUNCTIONS_PORT} — run \`npx netlify functions:serve\` to enable sync`); warned = true; }
          if (!res.headersSent) res.writeHead(503);
          res.end();
        });
        req.pipe(proxyReq);
      });
    },
  };
}

export default defineConfig({
  // Project root is the repo root; index.html is the single entry point.
  plugins: [devApiProxy()],
  server: {
    port: 5180,
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
  },
  test: {
    // Resolve ingredients from the committed seed in tests, as the app does at startup.
    setupFiles: ['./src/test-setup.ts'],
  },
});
