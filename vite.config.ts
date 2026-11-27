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
          'icons/icon-192.svg',
          'icons/icon-512.svg',
          'icons/apple-touch-icon.svg',
        ],
        manifest: {
          name: 'RiVibe — Spatial Music & Recommendations',
          short_name: 'RiVibe',
          description:
            'Warm spatial glass music player, live internet radio, and Spotify-style personalized song recommendations powered by public music APIs.',
          theme_color: '#18130f',
          background_color: '#120e0b',
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
            {
              src: 'icons/icon-192.svg',
              sizes: '192x192',
              type: 'image/svg+xml',
              purpose: 'any',
            },
          ],
          shortcuts: [
            {
              name: 'Made For You',
              short_name: 'For You',
              url: './?view=made-for-you',
            },
            {
              name: 'Vibe Radio',
              short_name: 'Radio',
              url: './?view=radio',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/(itunes\.apple\.com|is\d-ssl\.mzstatic\.com|api\.listenbrainz\.org|de1\.api\.radio-browser\.info)\/.*/i,
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
