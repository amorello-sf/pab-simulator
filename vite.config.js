import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Questions bundle is ~305KB uncompressed → allow a larger chunk before Vite warns
    chunkSizeWarningLimit: 800,
  },
  server: {
    port: 5173,
  },
});
