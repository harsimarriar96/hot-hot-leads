import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// All API traffic lives under /api; /health and /webhooks stay at the root.
// Override the target with VITE_API_TARGET when the API runs on another port.
const API_TARGET = process.env.VITE_API_TARGET ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': API_TARGET,
      '/health': API_TARGET,
      '/webhooks': API_TARGET,
    },
  },
  // @hothotleads/types is a workspace symlink compiled to CommonJS. Vite only runs its
  // CommonJS transform under node_modules by default, so include the package explicitly
  // for both the production bundle and the dev server's dependency pre-bundling.
  optimizeDeps: {
    include: ['@hothotleads/types'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    commonjsOptions: {
      include: [/node_modules/, /packages\/types\/dist/],
    },
  },
});
