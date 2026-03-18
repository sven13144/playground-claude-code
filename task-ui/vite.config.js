import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/odata': 'http://localhost:8080',
      '/llm': {
        target: 'http://localhost:6655',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/llm/, '/anthropic'),
      },
    },
  },
})
