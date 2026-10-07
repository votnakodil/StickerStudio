import assert from 'node:assert/strict'
import { test } from 'node:test'
import { upgradeSavedPreviews } from '../src/features/library/lib/upgradeSavedPreviews.ts'
import { SAVED_PREVIEW_VERSION } from '../src/features/library/api/stickerLibrary.ts'

test('old previews become visible only after the replacement is persisted', async () => {
  const templates = [{ id: 'photo', createdAt: 1, design: 'design', preview: 'old' }]
  let finishWrite
  const writing = new Promise(resolve => { finishWrite = resolve })
  let writeStarted = false
  const upgrading = upgradeSavedPreviews(templates, async () => 'new', async (id, design, preview) => {
    assert.deepEqual([id, design, preview], ['photo', 'design', 'new'])
    writeStarted = true
    await writing
  })
  await Promise.resolve()
  assert.equal(writeStarted, true)
  assert.equal(templates[0].preview, 'old')
  finishWrite()
  await upgrading
  assert.equal(templates[0].preview, 'new')
  assert.equal(templates[0].previewVersion, SAVED_PREVIEW_VERSION)
})

test('current previews need no rendering or rewriting after reload', async () => {
  const templates = [{ id: 'photo', createdAt: 1, design: 'design', preview: 'new', previewVersion: SAVED_PREVIEW_VERSION }]
  await upgradeSavedPreviews(templates, async () => assert.fail('unnecessary render'), async () => assert.fail('unnecessary write'))
  assert.equal(templates[0].preview, 'new')
})
