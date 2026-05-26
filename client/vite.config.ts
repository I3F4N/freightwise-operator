import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'FreightWise B2B Logistics',
        short_name: 'FreightWise',
        description: 'FreightWise B2B Logistics Operator Web/PWA',
        theme_color: '#ffffff',
        icons: [] // Empty for now, as no UI/assets
      }
    })
  ],
  server: {
    host: true, // Needed for docker
    port: 5173
  }
})
