import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'milli/web': resolve(here, '../src/web.ts'),
    },
  },
  server: {
    fs: { allow: [resolve(here, '..')] },
  },
});
