import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { copyFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// ONNX Runtime Web: use the build with an *external* WASM glue file served by
// the app itself (public/ort). The fully bundled variant cannot spawn its
// pthread workers from inside our module worker, which made multi-threaded
// WASM hang; with the glue served as a real file it works (and stays offline).
const ortDist = fileURLToPath(new URL('./node_modules/onnxruntime-web/dist/', import.meta.url));
mkdirSync('public/ort', { recursive: true });
for (const f of ['ort-wasm-simd-threaded.asyncify.mjs', 'ort-wasm-simd-threaded.asyncify.wasm']) {
  copyFileSync(ortDist + f, `public/ort/${f}`);
}

// Camera access (getUserMedia) needs a secure context. localhost is fine;
// to open the dev server from a phone on the LAN run with HTTPS=1.
const https = process.env.HTTPS === '1';
const api = process.env.API_URL ?? 'http://127.0.0.1:8000';

// Cross-origin isolation enables SharedArrayBuffer -> multi-threaded WASM inference.
const isolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  base: './', // relative URLs: the build can be hosted under any sub-path
  plugins: https ? [basicSsl()] : [],
  server: {
    headers: isolation,
    proxy: { '/api': api },
  },
  preview: { headers: isolation },
  resolve: { alias: { 'onnxruntime-web/webgpu': ortDist + 'ort.webgpu.min.mjs' } },
  worker: { format: 'es' },
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
  optimizeDeps: { exclude: ['onnxruntime-web'] },
});
