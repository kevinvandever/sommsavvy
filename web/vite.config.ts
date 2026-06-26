import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Redirect the old platform package to our local backend shim, so
      // existing component imports keep working unchanged.
      '@mindstudio-ai/interface': fileURLToPath(
        new URL('./src/lib/platform.ts', import.meta.url),
      ),
    },
  },
  server: {
    allowedHosts: true,
  },
});
