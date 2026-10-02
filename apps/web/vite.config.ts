import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { projectColorCss, themedColorCss } from '../../packages/theme/src/colors.ts'

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    proxy: {
      '/api/vk': {
        target: 'http://127.0.0.1:4177',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/vk/, '/api'),
        configure: (proxy) => {
          proxy.on('proxyReq', (request) => request.setHeader('Origin', 'http://127.0.0.1:4177'))
        },
      },
    },
  },
  plugins: [
    {
      name: 'sticker-studio-colors',
      resolveId(id) {
        if (id === 'virtual:sticker-studio-colors.css') return '\0sticker-studio-colors.css'
      },
      load(id) {
        if (id === '\0sticker-studio-colors.css') return projectColorCss + themedColorCss
      },
    },
    react(),
    tailwindcss(),
  ],
})
