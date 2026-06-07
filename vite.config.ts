import { defineConfig } from 'vite';

export default defineConfig({
  // Project root is the repo root; index.html is the single entry point.
  build: {
    outDir: 'dist',
    target: 'es2022',
  },
});
