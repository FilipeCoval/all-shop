
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Carrega as variáveis de ambiente
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    base: '/', 
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
            utils: ['lucide-react', 'react-barcode', '@zxing/library', '@google/genai']
          }
        }
      }
    },
    // Isto é crucial para a API do Gemini funcionar no browser/telemóvel
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY || "")
    }
  };
});
