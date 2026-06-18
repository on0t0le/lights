import { defineConfig } from 'vite';

export default defineConfig({
  base: '/lights/',
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
});
