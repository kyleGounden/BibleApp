import { spawn, type ChildProcess } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin, type PreviewServer, type ProxyOptions, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'

const root = resolve(dirname(fileURLToPath(import.meta.url)))
const apiPort = Number(process.env.API_PORT || 8787)

const apiProxy: Record<string, ProxyOptions> = {
  '/esv-api': {
    target: 'https://api.esv.org',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/esv-api/, ''),
  },
  '/api': {
    target: `http://127.0.0.1:${apiPort}`,
    changeOrigin: true,
  },
}

function churchApi(): Plugin {
  let child: ChildProcess | undefined
  const start = () => {
    if (child) return
    child = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
      cwd: root,
      stdio: 'inherit',
      env: process.env,
    })
    child.on('error', (error) => {
      console.error('Church API did not start.', error)
      child = undefined
    })
    child.on('exit', () => {
      child = undefined
    })
  }
  const stop = () => {
    child?.kill()
    child = undefined
  }
  const attach = (server: ViteDevServer | PreviewServer) => {
    start()
    server.httpServer?.once('close', stop)
  }
  return {
    name: 'church-api',
    configureServer: attach,
    configurePreviewServer: attach,
  }
}

export default defineConfig({
  base: '/',
  plugins: [react(), churchApi()],
  // Kokoro and Transformers must stay on the browser build. Prebundling them
  // resolves the Node entry, which cannot speak in the page.
  optimizeDeps: {
    exclude: ['kokoro-js', '@huggingface/transformers'],
  },
  server: { host: '127.0.0.1', port: 5173, proxy: apiProxy },
  preview: { host: '127.0.0.1', port: 4173, proxy: apiProxy },
})
