import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'inline',
      manifest: {
        name: 'AttendX Attendance & Payroll',
        short_name: 'AttendX',
        description: 'Smart Attendance, Payroll, Leave Management with Geofencing and Face Recognition',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'https://images.unsplash.com/photo-1599305445671-ac291c95aba9?w=192&fit=crop',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'https://images.unsplash.com/photo-1599305445671-ac291c95aba9?w=512&fit=crop',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
})
