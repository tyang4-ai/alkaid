/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: { port: 3000, open: false },
  worker: { format: 'es' },
  build: {
    target: 'es2020',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        dashboard: resolve(__dirname, 'dashboard/index.html'),
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
