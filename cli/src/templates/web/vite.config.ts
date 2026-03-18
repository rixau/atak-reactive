import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist-assets/web', target: 'chrome80' },
  server: {
    host: true,
    port: 5173,
    watch: { usePolling: true, interval: 500 },
  },
});
