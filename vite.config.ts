import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Project root is the repo root; index.html is the single entry point.
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
