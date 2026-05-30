import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/lottery-tracker/',   // ← 改成你的 GitHub repo 名稱
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'IG 抽獎追蹤',
        short_name: '抽獎追蹤',
        description: '追蹤 Instagram 抽獎，不再錯過開獎日期',
        theme_color: '#7191AA',
        background_color: '#F7F4F1',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/lottery-tracker/',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})
