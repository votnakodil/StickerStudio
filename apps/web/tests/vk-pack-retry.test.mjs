import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadVkWorkspacePacks } from '../src/features/vk-workspace/model/loadVkWorkspacePacks.ts'
import { VkServiceError } from '../src/features/vk-workspace/api/vkWorkspace.ts'

const packs = [{ id: 'test-pack', name: 'Test Pack', stickerCount: 5, needsStickerURL: false, installed: true }]

test('pack loading retries a temporary failure once after five seconds', async () => {
  let calls = 0
  const delays = []
  const result = await loadVkWorkspacePacks(new AbortController().signal, {
    refresh: async () => { if (++calls === 1) throw new VkServiceError('retryable', 'Temporary failure'); return packs },
    wait: async (delay) => { delays.push(delay) },
  })
  assert.deepEqual(result, packs)
  assert.equal(calls, 2)
  assert.deepEqual(delays, [5000])
})

test('a third pack failure is surfaced without further automatic retries', async () => {
  let calls = 0
  const failure = new VkServiceError('retryable', 'Still unavailable')
  await assert.rejects(loadVkWorkspacePacks(new AbortController().signal, {
    refresh: async () => { calls++; throw failure }, wait: async () => {},
  }), error => error === failure)
  assert.equal(calls, 3)
})

test('expired authorization is surfaced immediately without a retry delay', async () => {
  let calls = 0
  const failure = new VkServiceError('auth_required', 'Expired')
  await assert.rejects(loadVkWorkspacePacks(new AbortController().signal, {
    refresh: async () => { calls++; throw failure }, wait: async () => assert.fail('Must not delay authentication failure'),
  }), error => error === failure)
  assert.equal(calls, 1)
})

test('closing during the retry delay aborts it and never requests packs again', async () => {
  const controller = new AbortController()
  let calls = 0
  const pending = loadVkWorkspacePacks(controller.signal, {
    refresh: async () => { calls++; throw new VkServiceError('retryable', 'Temporary failure') },
  })
  await Promise.resolve()
  controller.abort()
  await assert.rejects(pending, error => error.name === 'AbortError')
  assert.equal(calls, 1)
})

test('pack loading can recover on its third and final attempt', async () => {
  let calls = 0
  const delays = []
  const result = await loadVkWorkspacePacks(new AbortController().signal, {
    refresh: async () => { if (++calls < 3) throw new VkServiceError('retryable', 'Temporary failure'); return packs },
    wait: async delay => { delays.push(delay) },
  })
  assert.deepEqual(result, packs)
  assert.equal(calls, 3)
  assert.deepEqual(delays, [5000, 5000])
})

test('invalid requests and permission failures are not automatically repeated', async () => {
  for (const status of [400, 403, 404, 409, 415]) {
    let calls = 0
    const failure = new VkServiceError('retryable', 'Invalid request', status)
    await assert.rejects(loadVkWorkspacePacks(new AbortController().signal, {
      refresh: async () => { calls++; throw failure },
      wait: async () => assert.fail('A permanent HTTP failure must not be delayed'),
    }), error => error === failure)
    assert.equal(calls, 1)
  }
})
