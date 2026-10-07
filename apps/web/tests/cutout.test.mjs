import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseCutoutJob, CutoutServiceError, createCutoutApi } from '../src/features/custom-photo/api/cutoutApi.ts'
import { runPhotoCutout } from '../src/features/custom-photo/model/runPhotoCutout.ts'
import { validatePhoto } from '../src/features/custom-photo/model/photoValidation.ts'

const job = (status = 'queued') => ({ jobId: 'test-job', status, queuePosition: status === 'queued' ? 2 : 0, jobsAhead: status === 'queued' ? 2 : 0, estimatedWaitSeconds: status === 'queued' ? 50 : 0, createdAt: '2026-10-03T18:00:00Z', startedAt: null, completedAt: null, cancelledAt: null })
const photo = () => ({ id: 'custom-test', name: 'Photo', source: new Blob(['source'], { type: 'image/png' }), idempotencyKey: 'persisted-safe-key', createdAt: 1 })
function fixture(initial = photo()) {
  let stored = initial
  const events = []
  const storage = { get: async () => stored, put: async (value) => { stored = value; events.push('persist') } }
  const api = { create: async () => job('completed'), get: async () => job('completed'), result: async () => new Blob(['png'], { type: 'image/png' }), acknowledge: async () => { events.push('ack') } }
  return { storage, api, events, read: () => stored, notify: (state) => events.push(state.stage), wait: async () => {}, signal: new AbortController().signal }
}

test('cutout boundary rejects unknown statuses and invalid queue data', () => {
  assert.equal(parseCutoutJob(job()).jobsAhead, 2)
  for (const data of [{ ...job(), status: 'surprise' }, { ...job(), jobsAhead: -1 }, { ...job(), queuePosition: 1.5 }, { ...job(), jobId: '../result' }, { ...job(), estimatedWaitSeconds: NaN }, { ...job(), createdAt: 'bad' }]) assert.throws(() => parseCutoutJob(data))
})

test('photo validation enforces supported formats, nonempty files and 20 MiB upload limit', () => {
  assert.equal(validatePhoto({ size: 20 * 1024 * 1024, type: 'image/webp' }), null)
  for (const file of [{ size: 0, type: 'image/png' }, { size: 20 * 1024 * 1024 + 1, type: 'image/png' }, { size: 1, type: 'image/svg+xml' }]) assert.ok(validatePhoto(file))
})

test('cutout result is durably retained before delivery acknowledgement', async () => {
  const f = fixture()
  f.api.acknowledge = async () => { assert.ok(f.read().result instanceof Blob); f.events.push('ack') }
  await runPhotoCutout('custom-test', f)
  assert.equal(f.read().resultAcknowledged, true)
  assert.ok(f.events.indexOf('ready') < f.events.indexOf('ack'))
})

test('failed local result retention never acknowledges server delivery', async () => {
  const f = fixture()
  f.storage.put = async (value) => { if (value.result) throw new Error('Storage full') }
  await runPhotoCutout('custom-test', f)
  assert.equal(f.events.includes('ack'), false)
  assert.equal(f.events.at(-1), 'error')
})

test('lost create response retries the persisted idempotency key', async () => {
  const f = fixture()
  const keys = []
  f.api.create = async (_blob, key) => { keys.push(key); if (keys.length === 1) throw new CutoutServiceError(0, 'Network unavailable'); return job('completed') }
  await runPhotoCutout('custom-test', f)
  assert.deepEqual(keys, ['persisted-safe-key', 'persisted-safe-key'])
  assert.ok(f.read().result)
})

test('refresh resumes a persisted job without submitting the photo again', async () => {
  const f = fixture({ ...photo(), job: job('queued') })
  f.api.create = async () => { assert.fail('Existing job must not be resubmitted') }
  await runPhotoCutout('custom-test', f)
  assert.ok(f.read().result)
})

test('aborting while receiving a result prevents acknowledgement', async () => {
  const f = fixture()
  const controller = new AbortController()
  f.signal = controller.signal
  f.api.result = async () => { controller.abort(); return new Blob(['png'], { type: 'image/png' }) }
  await runPhotoCutout('custom-test', f)
  assert.equal(f.events.includes('ack'), false)
  assert.equal(f.read().result, undefined)
})

test('completed local photo remains usable when server metadata has expired', async () => {
  const f = fixture({ ...photo(), job: job('completed'), result: new Blob(['png']), resultAcknowledged: false })
  f.api.get = async () => { assert.fail('Retained result does not need polling') }
  f.api.acknowledge = async () => { throw new CutoutServiceError(404, 'Job not found') }
  await runPhotoCutout('custom-test', f)
  assert.ok(f.events.includes('ready'))
  assert.equal(f.read().resultAcknowledged, true)
})

test('another tab receiving and acknowledging the result still leaves the local PNG usable', async () => {
  const original = { ...photo(), job: job('completed') }
  const f = fixture(original)
  let reads = 0
  f.storage.get = async () => ++reads === 1 ? original : { ...original, result: new Blob(['png']), resultAcknowledged: true }
  f.api.result = async () => { throw new CutoutServiceError(410, 'Already delivered') }
  await runPhotoCutout('custom-test', f)
  assert.equal(f.events.at(-1), 'ready')
})

test('queue-full and low-disk responses respect Retry-After before reusing the attempt', async () => {
  for (const [status, seconds] of [[429, 30], [503, 300]]) {
    const f = fixture()
    let attempts = 0
    const delays = []
    f.api.create = async () => { if (++attempts === 1) throw new CutoutServiceError(status, 'Unavailable', seconds); return job('completed') }
    f.wait = async (milliseconds) => { delays.push(milliseconds) }
    await runPhotoCutout('custom-test', f)
    assert.deepEqual(delays, [seconds * 1000])
    assert.ok(f.read().result)
  }
})

test('a lost acknowledgement retries delivery without downloading or processing again', async () => {
  const f = fixture()
  let downloads = 0
  let acknowledgements = 0
  f.api.result = async () => { downloads++; return new Blob(['png']) }
  f.api.acknowledge = async () => { if (++acknowledgements === 1) throw new CutoutServiceError(0, 'Disconnected') }
  await runPhotoCutout('custom-test', f)
  assert.equal(downloads, 1)
  assert.equal(acknowledgements, 2)
  assert.equal(f.read().resultAcknowledged, true)
})


test('upload validation errors preserve the rejected field and reason without exposing input', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({ detail: [{ loc: ['body', 'file'], msg: 'Field required', type: 'missing', input: 'private-image-bytes' }] }), { status: 422 })
  try {
    await assert.rejects(createCutoutApi().create(photo().source, 'persisted-safe-key'), (error) => {
      assert.equal(error.status, 422)
      assert.equal(error.message, 'Photo upload was rejected: file: Field required')
      assert.equal(error.message.includes('private-image-bytes'), false)
      return true
    })
  } finally { globalThis.fetch = originalFetch }
})


test('upload materializes persisted file bytes before constructing the multipart request', async () => {
  const originalFetch = globalThis.fetch
  const source = new File(['persisted-image-bytes'], 'original.png', { type: 'image/png' })
  const originalArrayBuffer = source.arrayBuffer.bind(source)
  let materialized = false
  source.arrayBuffer = async () => { materialized = true; return originalArrayBuffer() }
  globalThis.fetch = async (_url, init) => {
    assert.equal(materialized, true)
    assert.equal(init.headers['Idempotency-Key'], 'persisted-safe-key')
    const upload = init.body.get('file')
    assert.equal(upload.type, 'image/png')
    assert.equal(await upload.text(), 'persisted-image-bytes')
    // Inspect the encoded HTTP body, rather than only the FormData container.
    const request = new Request('http://localhost/api/cutout/jobs', init)
    assert.match(request.headers.get('Content-Type'), /^multipart\/form-data; boundary=/)
    const encoded = await request.text()
    assert.ok(encoded.includes('name="file"; filename="photo"'))
    assert.ok(encoded.includes('persisted-image-bytes'))
    return Response.json(job())
  }
  try { await createCutoutApi().create(source, 'persisted-safe-key') }
  finally { globalThis.fetch = originalFetch }
})


test('newly downloaded results are distinguished from retained results for the one-time reveal', async () => {
  const fresh = fixture()
  const ready = []
  fresh.notify = state => { if (state.stage === 'ready') ready.push(state.resultSource) }
  await runPhotoCutout('custom-test', fresh)
  assert.deepEqual(ready, ['download'])
  const restored = fixture({ ...photo(), result: new Blob(['retained']), resultAcknowledged: true })
  restored.notify = state => { if (state.stage === 'ready') ready.push(state.resultSource) }
  await runPhotoCutout('custom-test', restored)
  assert.deepEqual(ready, ['download', 'storage'])
})
