import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/chat': 'http://localhost:3010',
      '/api': 'http://localhost:3010',
      '/health': 'http://localhost:3010',
      '/onboarding': 'http://localhost:3010',
      '/settings': 'http://localhost:3010',
      '/webhooks': 'http://localhost:3010',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
