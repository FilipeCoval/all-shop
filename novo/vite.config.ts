import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'esnext'
  },
  // Removemos 'define: { process.env: {} }' pois pode interferir com a deteção de ambiente em alguns casos
  // O Vite trata automaticamente env vars que começam com VITE_
});