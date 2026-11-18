/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
