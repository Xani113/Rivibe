import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const base = process.env.VITE_BASE_PATH || './';

  return {
    base,
    server: {
      proxy: {
        '/api': {
          target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'icons/icon-192.png',
          'icons/icon-512.png',
          'icons/apple-touch-icon.png',
        ],
        manifest: {
          name: 'RiVibe — Music & Queue Studio',
          short_name: 'RiVibe',
          description:
            'Fast, distraction-free music streaming with smart queue controls, playlists, and synced lyrics.',
          theme_color: '#090b10',
          background_color: '#0c101b',
          display: 'standalone',
          orientation: 'any',
          start_url: '.',
          scope: '.',
          categories: ['music', 'entertainment'],
          icons: [
            {
              src: 'icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
          shortcuts: [
            {
              name: 'Search Music',
              short_name: 'Search',
              url: './?tab=search',
            },
            {
              name: 'Your Library',
              short_name: 'Library',
              url: './?tab=library',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/(itunes\.apple\.com|is\d-ssl\.mzstatic\.com|discoveryprovider\.audius\.co|lrclib\.net)\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'rivibe-api-cache',
                expiration: {
                  maxEntries: 120,
                  maxAgeSeconds: 60 * 60 * 12,
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: mode === 'development',
        },
      }),
    ],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      exclude: ['**/node_modules/**', '**/dist/**', 'backend/**'],
      css: true,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        include: ['src/engine/**', 'src/services/**', 'src/context/**', 'src/components/**'],
      },
    },
  };
});
