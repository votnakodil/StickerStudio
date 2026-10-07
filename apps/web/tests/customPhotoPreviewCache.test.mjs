import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createCustomPhotoPreviewCache } from '../src/features/custom-photo/model/customPhotoPreviewCache.ts'

test('saved photo previews survive route remounts and release only removed collection entries', async () => {
  let reads = 0, created = 0
  const revoked = []
  const cache = createCustomPhotoPreviewCache({ get: async id => {
    reads++
    return { id, name: 'Photo', result: new Blob(['image']) }
  } }, { createObjectURL: () => `blob:${++created}`, revokeObjectURL: url => revoked.push(url) })
  const [one, duplicate] = await Promise.all([cache.get('custom-photo-one'), cache.get('custom-photo-one')])
  assert.equal(one, duplicate)
  cache.retain(['custom-photo-one'])
  assert.equal(cache.peek(['custom-photo-one'])[0], one, 'return route has its photo synchronously')
  assert.equal(await cache.get('custom-photo-one'), one)
  assert.equal(reads, 1)
  assert.deepEqual(revoked, [])
  cache.retain([])
  assert.deepEqual(cache.peek(['custom-photo-one']), [])
  assert.deepEqual(revoked, ['blob:1'])
})
