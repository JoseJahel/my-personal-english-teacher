import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch.icon.png'],
      manifest: {
        name: 'My Personal English Teacher',
        short_name: 'EnglishTeacher',
        description:
          'Practica inglés sin conexión: pronunciación, gramática y conversación asistidas por modelos que se ejecutan en tu propio navegador.',
        lang: 'es',
        start_url: '/',
        display: 'standalone',
        theme_color: '#1e293b',
        background_color: '#f8fafc',
        icons: [
          {
            src: 'pwa-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Los archivos de máquinas de aprendizaje (pesos de modelos: .onnx, .onnx_data, etc.)
        // NO deben precacharse con Workbox: pueden pesar cientos de MB y transformers.js ya
        // gestiona su propia descarga y persistencia mediante la Cache API del navegador.
        // Aquí solo se preparan los patrones de exclusión; los modelos aún no existen en esta capa.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        globIgnores: ['**/*.onnx', '**/*.onnx_data', '**/models/**'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    css: false,
  },
})
