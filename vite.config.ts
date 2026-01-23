import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Carrega as variáveis de ambiente
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    base: '/', 
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false
    },
    // Isto é crucial para a API do Gemini funcionar no browser/telemóvel
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY || "")
    }
  };
});
