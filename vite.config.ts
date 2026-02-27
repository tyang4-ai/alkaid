/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 3000, open: false },
  build: { target: 'es2020', sourcemap: true },
  test: {
    globals: true,
    environment: 'node',
  },
});
