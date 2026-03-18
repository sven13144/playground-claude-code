import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/odata': 'http://localhost:8080',
      '/events': { target: 'http://localhost:8080', changeOrigin: false },
    },
  },
})
