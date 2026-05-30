import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    ...(mode !== 'test' ? [
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: false,   // disable SW in dev — stops Workbox logging Supabase URLs
        },
        manifest: {
          name: 'Shule — School Management',
          short_name: 'Shule',
          description: 'Offline-capable school management for Ugandan secondary schools',
          theme_color: '#0d9488',
          background_color: '#f8fafc',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/api/],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/rest/,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'supabase-rest',
                networkTimeoutSeconds: 5,
                expiration: { maxEntries: 100, maxAgeSeconds: 86400 },
              },
            },
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/auth/,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'supabase-auth',
                networkTimeoutSeconds: 3,
              },
            },
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/storage/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'supabase-storage',
                expiration: { maxEntries: 200, maxAgeSeconds: 604800 },
              },
            },
          ],
        },
      }),
    ] : []),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['node_modules', 'dist', 'e2e/**', '.idea', '.git', '.cache'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      exclude: [
        'src/test/**',
        'src/docs/**',
        'src/lib/reportCardPdf.ts',
      ],
      thresholds: {
        lines:      65,
        functions:  60,
        branches:   50,
        statements: 65,
      },
    },
  },
}))
