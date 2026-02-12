
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    base: '/', 
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      chunkSizeWarningLimit: 1500, // Aumenta limite para silenciar avisos não críticos
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Separação inteligente de bibliotecas
            if (id.includes('node_modules')) {
              if (id.includes('firebase')) return 'firebase';
              if (id.includes('react') || id.includes('react-dom')) return 'vendor';
              if (id.includes('lucide') || id.includes('zxing') || id.includes('google')) return 'utils';
              return 'libs'; // O restante vai para um chunk genérico
            }
          }
        }
      }
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY || "")
    }
  };
});

