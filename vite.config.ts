import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: [
        'favicon-v2-32x32.png',
        'apple-touch-icon-v2.png',
        'pwa-v2-192x192.png',
        'pwa-v2-512x512.png',
        'pwa-maskable-v2-512x512.png',
      ],
      manifest: {
        id: '/',
        name: '진폭 TS STUDIO - TS 장르 전문 AI 소설 스튜디오',
        short_name: '진폭 TS STUDIO',
        description: 'TS 작품, 시리즈, 세계관과 개성 있는 AI 작가를 한곳에서 관리하는 전문 창작 스튜디오',
        lang: 'ko',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#111827',
        theme_color: '#111827',
        orientation: 'any',
        categories: ['productivity', 'books', 'writing'],
        icons: [
          { src: '/pwa-v2-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-v2-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pwa-maskable-v2-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
      },
      devOptions: { enabled: true },
    }),
  ],
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, './src/@core'),
      '@modules': path.resolve(__dirname, './src/@modules'),
      '@shared': path.resolve(__dirname, './src/@shared'),
      '@services': path.resolve(__dirname, './src/@services'),
      '@stores': path.resolve(__dirname, './src/@stores'),
      '@pages': path.resolve(__dirname, './src/@pages'),
      '@security': path.resolve(__dirname, './src/@security'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) return 'vendor-react';
          if (id.includes('node_modules/zustand')) return 'vendor-zustand';
          if (id.includes('node_modules/@google/genai')) return 'vendor-ai';
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
});
