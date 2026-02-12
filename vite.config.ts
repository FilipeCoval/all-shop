
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
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('firebase')) return 'firebase';
              if (id.includes('react')) return 'vendor';
              if (id.includes('lucide') || id.includes('zxing') || id.includes('google')) return 'utils';
              return 'libs';
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

