import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createPeriodicDesignSaver } from '../src/features/editor/lib/periodicDesignSaver.ts'

test('periodic saver serializes writes, saves the latest change, and skips unchanged designs', async () => {
  let current = 'initial'
  const writes = []
  let release
  const saver = createPeriodicDesignSaver({ initial: current, read: () => current, intervalMs: 60000,
    write: async value => { writes.push(value); if (value === 'first') await new Promise(resolve => { release = resolve }) },
    onError: error => { throw error }, onSaved: () => {} })
  try {
    current = 'first'; saver.markDirty(); const first = saver.flush()
    current = 'latest'; saver.markDirty(); saver.flush()
    assert.deepEqual(writes, ['first'])
    release(); await first
    assert.deepEqual(writes, ['first', 'latest'])
    saver.markDirty(); await saver.flush()
    assert.equal(writes.length, 2)
    current = 'on-leave'; saver.markDirty(); await saver.stop()
    assert.equal(writes.at(-1), 'on-leave')
  } finally { await saver.stop() }
})

test('failed background save retries without losing the current design', async () => {
  let attempts = 0, errors = 0
  const saver = createPeriodicDesignSaver({ initial: 'old', read: () => 'new', intervalMs: 60000,
    write: async () => { if (++attempts === 1) throw new Error('offline') }, onError: () => { errors++ }, onSaved: () => {} })
  try { saver.markDirty(); await saver.flush(); await saver.flush(); assert.equal(attempts, 2); assert.equal(errors, 1) }
  finally { await saver.stop() }
})

test('dirty changes are saved by the periodic timer without an explicit flush', async () => {
  let complete
  const saved = new Promise(resolve => { complete = resolve })
  const writes = []
  const saver = createPeriodicDesignSaver({ initial: 'old', read: () => 'changed', intervalMs: 10,
    write: async value => { writes.push(value) }, onError: error => { throw error }, onSaved: () => complete() })
  let timeout
  try {
    saver.markDirty()
    await Promise.race([saved, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('periodic save did not run')), 1000) })])
    assert.deepEqual(writes, ['changed'])
  } finally { clearTimeout(timeout); await saver.stop() }
})


test('a restored design needs no eager snapshot and saves its first edit on leave', async () => {
  let reads = 0
  const writes = []
  const saver = createPeriodicDesignSaver({ read: () => { reads++; return 'edited layers' }, intervalMs: 60000,
    write: async value => { writes.push(value) }, onError: error => { throw error }, onSaved: () => {} })
  try {
    await saver.flush()
    assert.equal(reads, 0)
    assert.deepEqual(writes, [])
    saver.markDirty()
    await saver.stop()
    assert.equal(reads, 1)
    assert.deepEqual(writes, ['edited layers'])
    saver.markDirty()
    await saver.flush()
    assert.equal(writes.length, 1)
  } finally { await saver.stop() }
})
