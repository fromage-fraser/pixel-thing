import { defineConfig } from 'vite';

// Usage is entirely local: the dev server stays on localhost and the build is plain static files.
export default defineConfig({
  server: { open: true },
  test: { include: ['test/**/*.test.js'] },
});
