import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // dist-single/ is a build output that lives inside the project; without this the dev server
  // reloads itself every time the single-file bundle is rebuilt.
  server: { watch: { ignored: ['**/dist/**', '**/dist-single/**'] } },
  build: {
    target: 'es2020',
    sourcemap: false,
  },
});
