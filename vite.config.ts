
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [
      tailwindcss(),
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
        manifest: {
          name: 'All-Shop | Eletrónica e Gadgets',
          short_name: 'All-Shop',
          description: 'A sua loja virtual de confiança. Smartphones, TV Boxes e Cabos.',
          theme_color: '#3b82f6',
          background_color: '#ffffff',
          display: 'standalone',
          icons: [
            {
              src: 'https://i.imgur.com/nSiZKBf.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'https://i.imgur.com/nSiZKBf.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ],
    base: '/', 
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      chunkSizeWarningLimit: 3000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('firebase')) return 'firebase';
              if (id.includes('react') || id.includes('recharts')) return 'vendor';
              if (id.includes('lucide')) return 'icons';
              if (id.includes('@google/genai')) return 'ai';
              if (id.includes('zxing') || id.includes('barcode')) return 'scanner';
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
