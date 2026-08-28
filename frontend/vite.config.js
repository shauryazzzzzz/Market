import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // Aladdin / tradingview-economy API (port 3001)
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      // Financial Monitor API (port 5000) — proxied at /fm-api
      '/fm-api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/fm-api/, '/api')
      },
      // NewsFeed-Google-AI- API (port 3002) — proxied at /nf-api
      '/nf-api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/nf-api/, '/api')
      }
    }
  },
  build: {
    outDir: '../public-react',
    emptyOutDir: true,
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        crossOriginLoading: false
      }
    }
  }
})
