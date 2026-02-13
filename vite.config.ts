
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
        devOptions: {
          enabled: true
        },
        manifest: {
          name: 'All-Shop',
          short_name: 'All-Shop',
          description: 'A sua loja virtual completa para eletrônicos e gadgets.',
          theme_color: '#3b82f6',
          background_color: '#f8fafc',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: 'https://i.imgur.com/nSiZKBf.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'https://i.imgur.com/nSiZKBf.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'firebase-storage-images',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 30 // 30 dias
                }
              }
            },
            {
              urlPattern: /^https:\/\/i\.imgur\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'imgur-images',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 30 // 30 dias
                }
              }
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
              if (id.includes('react')) return 'vendor';
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
