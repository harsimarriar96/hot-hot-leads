import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const API_TARGET = 'http://localhost:3010';

// The API and the SPA share these path prefixes (e.g. /settings is both a React
// Router route and a Nest controller). Page navigations need the SPA; XHR/fetch
// needs the API. Vite picks based on the Accept header.
const sharedWithSpa = {
  target: API_TARGET,
  bypass(req: { method?: string; url?: string; headers: Record<string, string | string[] | undefined> }) {
    const accept = String(req.headers.accept ?? '');
    if (req.method === 'GET' && accept.includes('text/html')) {
      return req.url;
    }
  },
};

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
      '/chat': sharedWithSpa,
      '/onboarding': sharedWithSpa,
      '/products': sharedWithSpa,
      '/settings': sharedWithSpa,
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
