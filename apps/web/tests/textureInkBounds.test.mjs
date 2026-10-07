import assert from 'node:assert/strict'
import { test } from 'node:test'
import { textureReadRegion, readTextureInkBounds } from '../src/shared/ui/HeroArtworkTransition/textureInkBounds.ts'

test('title readback is limited to its padded screen bounds at retina resolution', () => {
  assert.deepEqual(textureReadRegion({ left: 100, top: 200, width: 512, height: 512 },
    { left: 120, top: 220, width: 450, height: 50 }, 2048, 2048, 5),
  { left: 60, top: 60, width: 1840, height: 240 })
})
test('readback keeps texture coordinates and exact alpha bounds', () => {
  const pixels = new Uint8ClampedArray(4 * 4 * 3)
  pixels[(1 * 4 + 2) * 4 + 3] = 255
  const context = { getImageData(x, y, width, height) {
    assert.deepEqual([x, y, width, height], [100, 200, 4, 3])
    return { data: pixels }
  } }
  assert.deepEqual(readTextureInkBounds(context, { left: 100, top: 200, width: 4, height: 3 }),
    { left: 102, top: 201, width: 1, height: 1 })
})
test('regions stay inside the texture and missing geometry safely reads the whole texture', () => {
  const surface = { left: 0, top: 0, width: 100, height: 100 }
  assert.deepEqual(textureReadRegion(surface, { left: -20, top: -20, width: 140, height: 140 }, 512, 512, 10),
    { left: 0, top: 0, width: 512, height: 512 })
  assert.deepEqual(textureReadRegion(surface, undefined, 512, 512, 10),
    { left: 0, top: 0, width: 512, height: 512 })
})
