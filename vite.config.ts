import { defineConfig } from 'vite';

export default defineConfig({
  // Project root is the repo root; index.html is the single entry point.
  server: {
    port: 5180,
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
  },
});
