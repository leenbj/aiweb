import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  esbuild: {
    // 跳过TypeScript类型检查，只进行转译
    target: 'es2020',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@/shared': fileURLToPath(new URL('../shared', import.meta.url)),
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0', // 监听所有接口
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path,
      },
    },
  },
  define: {
    global: 'globalThis',
  },
})