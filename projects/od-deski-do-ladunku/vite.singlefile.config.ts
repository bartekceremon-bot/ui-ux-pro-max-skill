import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

/** The favicon is the last external request left; a data URI makes the file truly standalone. */
function inlineFavicon(): Plugin {
  return {
    name: 'inline-favicon',
    enforce: 'post',
    transformIndexHtml(html) {
      const svg = readFileSync('public/favicon.svg', 'utf8');
      const uri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
      return html.replaceAll('./favicon.svg', uri);
    },
  };
}

/**
 * "Open it and look" build: inlines every script and stylesheet into one
 * dist-single/index.html so the site runs straight off disk with no server.
 * Real deployments use `npm run build`, which keeps the 3D chunk separate.
 */
export default defineConfig({
  plugins: [react(), viteSingleFile(), inlineFavicon()],
  build: {
    target: 'es2020',
    sourcemap: false,
    outDir: 'dist-single',
    cssCodeSplit: false,
  },
});
