import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startCutoutTunnel } from './cutout-tunnel.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const vite = resolve(dirname(require.resolve('vite/package.json')), 'bin/vite.js')
const stopTunnel = process.env.CUTOUT_TUNNEL === 'off' ? () => {} : startCutoutTunnel()
const web = spawn(process.execPath, [vite, ...process.argv.slice(2)], {
  cwd: resolve(root, 'apps/web'), stdio: 'inherit', env: process.env,
})
let stopping = false
const stop = () => {
  if (stopping) return
  stopping = true
  stopTunnel()
  web.kill('SIGTERM')
}
process.once('SIGINT', stop)
process.once('SIGTERM', stop)
web.once('error', (error) => { console.error(error.message); stop(); process.exitCode = 1 })
web.once('close', (code) => { stopTunnel(); process.exitCode = stopping ? 0 : code ?? 1 })
