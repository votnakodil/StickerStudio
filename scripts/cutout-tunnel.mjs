import { spawn } from 'node:child_process'
import { get } from 'node:http'
import { createConnection } from 'node:net'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Node fetch blocks port 4190; this server-side check uses the HTTP client.
export function checkCutoutHealth(signal, address = 'http://127.0.0.1:4190/health') {
  return new Promise(resolve => {
    const request = get(address, { signal }, response => {
      if (response.statusCode !== 200) { response.resume(); resolve(false); return }
      let body = ''
      response.setEncoding('utf8')
      response.on('data', chunk => {
        body += chunk
        if (body.length > 4096) { request.destroy(); resolve(false) }
      })
      response.once('error', () => resolve(false))
      response.once('end', () => {
        try { const health = JSON.parse(body); resolve(health?.status === 'ok' && health?.cutout === 'ok') }
        catch { resolve(false) }
      })
    })
    request.setTimeout(2000, () => { request.destroy(); resolve(false) })
    request.once('error', () => resolve(false))
  })
}

export function isCutoutPortInUse(signal) {
  return new Promise(resolve => {
    const socket = createConnection({ host: '127.0.0.1', port: 4190, signal })
    const finish = value => { socket.destroy(); resolve(value) }
    socket.once('connect', () => finish(true))
    socket.once('error', () => finish(false))
    socket.setTimeout(500, () => finish(false))
  })
}

export function startCutoutTunnel({
  host = process.env.CUTOUT_SSH_HOST || 'de-vps',
  checkHealth = checkCutoutHealth,
  portInUse = isCutoutPortInUse,
  spawnSsh = (args) => spawn('ssh', args, { stdio: ['ignore', 'ignore', 'inherit'] }),
  schedule = setTimeout,
  cancelSchedule = clearTimeout,
  log = console.log,
} = {}) {
  let child = null
  let timer = null
  let stopped = false
  let ready = null
  const controller = new AbortController()
  const queue = (delay) => {
    if (stopped) return
    if (timer !== null) cancelSchedule(timer)
    timer = schedule(() => { timer = null; void tick() }, delay)
  }
  const tick = async () => {
    const healthy = await checkHealth(controller.signal)
    if (stopped) return
    if (healthy !== ready) {
      log(healthy ? '[cutout] API connection ready.' : '[cutout] Connecting to the private API; saved uploads resume when ready.')
      ready = healthy
    }
    if (!healthy && !child) {
      // An existing tunnel can stay open while its upstream is recovering.
      // Do not fight that listener or open duplicate forwards.
      const occupied = await portInUse(controller.signal)
      if (stopped) return
      if (occupied) { queue(3000); return }
      try {
        const connection = spawnSsh([
          '-N', '-T', '-o', 'BatchMode=yes', '-o', 'ExitOnForwardFailure=yes',
          '-o', 'ConnectTimeout=10', '-o', 'ServerAliveInterval=15',
          '-o', 'ServerAliveCountMax=2',
          '-L', '127.0.0.1:4190:127.0.0.1:4190', host,
        ])
        child = connection
        const closed = () => {
          if (child !== connection) return
          child = null
          queue(3000)
        }
        connection.once('error', closed)
        connection.once('close', closed)
      } catch { queue(3000); return }
    }
    queue(3000)
  }
  void tick()
  return () => {
    if (stopped) return
    stopped = true
    controller.abort()
    if (timer !== null) cancelSchedule(timer)
    const owned = child
    child = null
    owned?.kill('SIGTERM')
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const stop = startCutoutTunnel()
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
}
