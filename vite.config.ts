import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  base: '/',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    cssMinify: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app.html'),
        blog: resolve(__dirname, 'blog.html'),
        checklist: resolve(__dirname, 'checklist.html'),
        parents: resolve(__dirname, 'parents.html'),
        privacy: resolve(__dirname, 'privacy.html'),
      },
      output: {
        manualChunks: {
          'game-blink': ['./src/games/game-blink.ts'],
          'game-tracker': ['./src/games/game-tracker.ts'],
          'game-runner': ['./src/games/game-runner.ts'],
          'game-gymnastics': ['./src/games/game-gymnastics.ts'],
        },
      },
    },
  },
  css: {
    devSourcemap: true,
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff2}'],
        navigateFallback: '/app.html',
        navigateFallbackDenylist: [/^\/api/, /^\/.well-known/],
        runtimeCaching: [
          {
            urlPattern: /\.(?:mp3|mp4|webm|wav)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'media-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
      },
      manifest: {
        name: 'Суперглазка',
        short_name: 'Суперглазка',
        description: 'Интерактивный комикс о здоровье глаз',
        theme_color: '#0a0618',
        background_color: '#0a0618',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'ru',
        icons: [
          { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
});
