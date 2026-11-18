/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const BG = '#0c0d11'

export default defineConfig({
  // GitHub Pages liefert unter /<repo>/ aus; der Workflow setzt BASE_PATH.
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    react(),
    VitePWA({
      // Neue Version erst nach Klick laden – nie mitten in einer Eingabe neu starten.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: './',
        name: 'Kairos',
        short_name: 'Kairos',
        description: 'Lernzeit erfassen und das Semester organisieren.',
        lang: 'de',
        start_url: './',
        scope: './',
        display: 'standalone',
        theme_color: BG,
        background_color: BG,
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App-Shell komplett offline; woff wird nicht gebraucht, alle Zielbrowser können woff2.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  css: {
    modules: {
      // Lesbare, eindeutige Klassennamen im Dev-Modus; kurz im Build.
      generateScopedName: process.env.NODE_ENV === 'production' ? '[hash:base64:6]' : '[name]__[local]__[hash:base64:4]',
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
    // Feste Zeitzone, damit Tagesgrenzen-Tests (Mitternacht, Sommerzeit) reproduzierbar sind.
    env: { TZ: 'Europe/Berlin' },
    passWithNoTests: true,
  },
})
