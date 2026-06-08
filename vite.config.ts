import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Project root is the repo root; index.html is the single entry point.
  server: {
    port: 5180,
    // Dev-only: forward the SPA's /api/* calls to a locally-running
    // `npx netlify functions:serve` (port 9999), rewriting to its function paths.
    // Production uses the /api/* redirect in netlify.toml instead, so this is dev-only.
    proxy: {
      '/api': {
        target: 'http://localhost:9999',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '/.netlify/functions'),
      },
    },
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
