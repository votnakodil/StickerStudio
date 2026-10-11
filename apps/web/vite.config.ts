import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { projectColorCss, themedColorCss } from '../../packages/theme/src/colors.ts'
import { localHttpsOptions } from '../../scripts/local-https.mjs'
import { isAllowedLocalApiRequest, productionOriginFor, PRODUCTION_API_ORIGIN } from '../../scripts/production-api-proxy.mjs'

const LOCAL_ORIGIN = 'https://localhost:5173'
const root = fileURLToPath(new URL('../../', import.meta.url))

function productionApiProxy(): ProxyOptions {
  return {
    target: PRODUCTION_API_ORIGIN,
    changeOrigin: true,
    cookieDomainRewrite: '',
    bypass(req, res) {
      if (isAllowedLocalApiRequest(req, LOCAL_ORIGIN)) return
      if (res) { res.statusCode = 403; res.end('Forbidden') }
      return '/__api_proxy_forbidden__'
    },
    configure(proxy) {
      proxy.on('proxyReq', (upstream, req) => {
        const origin = productionOriginFor(req)
        if (origin) upstream.setHeader('Origin', origin)
      })
    },
  }
}

export default defineConfig(({ command }) => ({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    https: command === 'serve' ? localHttpsOptions(root) : undefined,
    proxy: {
      '/api/auth': productionApiProxy(),
      '/api/cutout': productionApiProxy(),
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
}))
