import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

const backendTarget = process.env.MARTS_DEV_BACKEND_URL ?? 'http://127.0.0.1:8090'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/marts/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5000,
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/marts/api': {
        target: backendTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/marts/, ''),
      },
      '/marts/ws': {
        target: backendTarget,
        ws: true,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/marts\/ws/, '/api/ws'),
      },
      '/__mockup': {
        target: 'http://localhost:800',
        changeOrigin: true,
        ws: true,
      },
      '/graf': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            const loc = proxyRes.headers['location']
            if (loc) {
              proxyRes.headers['location'] = loc.replace(/^https?:\/\/[^/]+(\/graf)/, '$1')
            }
          })
        },
      },
      '/prom': {
        target: 'http://localhost:9090',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            const loc = proxyRes.headers['location']
            if (loc) {
              proxyRes.headers['location'] = loc.replace(/^https?:\/\/[^/]+(\/prom)/, '$1')
            }
          })
        },
      },
    },
  },
})


