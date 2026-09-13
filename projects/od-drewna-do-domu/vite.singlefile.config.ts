import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * One-off "open it and look" build: inlines every script (including the lazily-loaded 3D
 * chunk) and stylesheet into a single dist-single/index.html. Not used for real deployment —
 * that stays on the normal `npm run build`, which keeps the 3D scene as its own downloaded
 * chunk so mobile visitors never fetch it.
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
