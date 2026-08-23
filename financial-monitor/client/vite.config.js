import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3005,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        timeout: 10000,       // 10 s proxy timeout (was default 30s+)
      }
    },
    // Pre-transform the most-used entry files on cold start
    warmup: {
      clientFiles: [
        './src/App.jsx',
        './src/pages/Dashboard.jsx',
        './src/pages/Stocks.jsx',
        './src/pages/Markets.jsx',
        './src/components/shared.jsx',
      ]
    },
    hmr: {
      timeout: 3000,         // fail faster on stale HMR connections
    }
  },
  // Pre-bundle heavy dependencies at startup so page loads don't trigger transforms
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'axios'],
    force: false,            // only re-bundle when deps actually change
  },
  build: {
    outDir: '../client-build',
    emptyOutDir: true,
    // Split vendor chunk so the main bundle stays small
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          http:   ['axios'],
        }
      }
    }
  }
})
