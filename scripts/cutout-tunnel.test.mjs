import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { checkCutoutHealth, startCutoutTunnel } from './cutout-tunnel.mjs'

const flush = () => new Promise(resolve => setImmediate(resolve))
function fixture(initialHealth) {
  let healthy = initialHealth
  let scheduled
  const children = []
  const logs = []
  const stop = startCutoutTunnel({
    checkHealth: async () => healthy,
    portInUse: async () => false,
    spawnSsh: (args) => {
      const child = new EventEmitter()
      child.args = args
      child.killed = false
      child.kill = () => { child.killed = true }
      children.push(child)
      return child
    },
    schedule: (callback) => { scheduled = callback; return callback },
    cancelSchedule: () => { scheduled = undefined },
    log: message => logs.push(message),
  })
  return { children, logs, stop, setHealth: value => { healthy = value },
    tick: async () => { const callback = scheduled; scheduled = undefined; callback?.(); await flush() } }
}
test('development reuses a healthy connection and reconnects when it disappears', async () => {
  const f = fixture(true)
  await flush()
  assert.equal(f.children.length, 0)
  f.setHealth(false)
  await f.tick()
  assert.equal(f.children.length, 1)
  assert.ok(f.children[0].args.includes('127.0.0.1:4190:127.0.0.1:4190'))
  assert.ok(f.children[0].args.includes('BatchMode=yes'))
  await f.tick()
  assert.equal(f.children.length, 1, 'No duplicate SSH attempts while connecting')
  f.children[0].emit('close', 255)
  await f.tick()
  assert.equal(f.children.length, 2)
  f.stop()
  assert.equal(f.children[1].killed, true)
})
test('shutdown cancels monitoring without killing an existing external connection', async () => {
  const f = fixture(true)
  await flush()
  f.stop()
  await f.tick()
  assert.equal(f.children.length, 0)
})
test('shutdown during a health check cannot create a late SSH process', async () => {
  let resolveHealth
  let attempts = 0
  const stop = startCutoutTunnel({
    checkHealth: () => new Promise(resolve => { resolveHealth = resolve }),
    spawnSsh: () => { attempts++; return new EventEmitter() },
    log: () => {},
  })
  stop()
  resolveHealth(false)
  await flush()
  assert.equal(attempts, 0)
})

test('health monitoring recognizes the proxy contract and rejects an unavailable upstream', async () => {
  let cutout = 'ok'
  const server = createServer((_request, response) => {
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ status: 'ok', cutout }))
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  try {
    const address = `http://127.0.0.1:${server.address().port}/health`
    assert.equal(await checkCutoutHealth(new AbortController().signal, address), true)
    cutout = 'unavailable'
    assert.equal(await checkCutoutHealth(new AbortController().signal, address), false)
  } finally { await new Promise(resolve => server.close(resolve)) }
})

test('an occupied tunnel with an unavailable upstream is monitored without duplicate forwards', async () => {
  let attempts = 0
  const stop = startCutoutTunnel({
    checkHealth: async () => false,
    portInUse: async () => true,
    spawnSsh: () => { attempts++; return new EventEmitter() },
    log: () => {},
  })
  await flush()
  assert.equal(attempts, 0)
  stop()
})
