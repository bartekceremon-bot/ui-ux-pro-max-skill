import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * "Open it and look" build: inlines every script and stylesheet into one
 * dist-single/index.html so the site runs straight off disk with no server.
 * Real deployments use `npm run build`, which keeps the 3D chunk separate.
 */
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    target: 'es2020',
    sourcemap: false,
    outDir: 'dist-single',
    cssCodeSplit: false,
  },
});
