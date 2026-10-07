import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getStickerUnfold } from '../src/shared/ui/StickerCurlReveal/stickerUnfold.ts'

test('sticker unfold starts closed, finishes flat, and clamps elapsed time', () => {
  assert.equal(getStickerUnfold(0), 0)
  assert.equal(getStickerUnfold(1), 1)
  assert.equal(getStickerUnfold(-1), 0)
  assert.equal(getStickerUnfold(2), 1)
  assert.ok(getStickerUnfold(0.01) < 0.01)
  assert.ok(getStickerUnfold(0.99) > 0.99)
})

test('sticker fold advances continuously without reopening or overshoot', () => {
  let previous = 0
  for (let step = 1; step <= 100; step++) {
    const next = getStickerUnfold(step / 100)
    assert.ok(next >= previous && next <= 1)
    previous = next
  }
})
