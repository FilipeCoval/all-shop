import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Carrega as variáveis de ambiente
  // Fix: cast process as any to access cwd() which might not be correctly typed in the environment
  const env = loadEnv(mode, (process as any).cwd(), '');
  
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
      // Usa a chave do ambiente ou uma string vazia se não existir.
      // IMPORTANTE: Nunca coloque chaves reais diretamente aqui se for partilhar o código.
      'process.env.API_KEY': JSON.stringify(env.API_KEY || "")
    }
  };
});
