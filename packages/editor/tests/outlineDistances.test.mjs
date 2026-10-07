import assert from 'node:assert/strict'
import { test } from 'node:test'
import { smoothOutlineDistances } from '../src/images/smoothOutlineDistances.ts'
import { outlineDistances } from '../src/images/outlineDistances.ts'

test('outline distances follow circular arcs without chamfer facets and retain alpha coverage', () => {
  const width = 25, pixels = new Uint8ClampedArray(width * width * 4)
  pixels[(12 * width + 12) * 4 + 3] = 255
  const distances = outlineDistances(pixels, width, width)
  for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) {
    assert.ok(Math.abs(distances[y * width + x] - Math.hypot(x - 12, y - 12)) < 1e-5)
  }
  pixels[(12 * width + 12) * 4 + 3] = 128
  assert.ok(Math.abs(outlineDistances(pixels, width, width)[12 * width + 12] - 127 / 255) < 1e-5)
  assert.ok(outlineDistances(new Uint8ClampedArray(16), 2, 2).every(Number.isFinite))
})


test('outer stroke rounds small contour bumps without widening or feathering the edge', () => {
  const width = 160, height = 160, pixels = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const radius = 45 + (x % 6 < 3 && y > 80 ? 1 : 0)
    if (Math.hypot(x - 80, y - 80) <= radius) pixels[(y * width + x) * 4 + 3] = 255
  }
  const original = pixels.slice()
  const before = outlineDistances(pixels, width, height)
  const after = smoothOutlineDistances(pixels, width, height, 1)
  const boundary = field => {
    const positions = []
    for (let x = 60; x <= 100; x++) {
      for (let y = 110; y < height - 1; y++) {
        const a = field[y * width + x], b = field[(y + 1) * width + x]
        if (a <= 10 && b > 10) { positions.push(y + (10 - a) / (b - a)); break }
      }
    }
    return positions
  }
  const raw = boundary(before), rounded = boundary(after)
  assert.equal(rounded.length, raw.length)
  const roughness = points => points.slice(1, -1).reduce((sum, p, i) => sum + Math.abs(points[i] - 2 * p + points[i + 2]), 0)
  assert.ok(roughness(rounded) < roughness(raw) * 0.35, 'the outside curve removes source pixel bumps')
  assert.ok(Math.max(...rounded.map((y, i) => Math.abs(y - raw[i]))) < 1.5, 'outline thickness stays consistent')
  // Distance thresholding retains a narrow antialias transition rather than a blurred halo.
  const column = rounded[20], floor = Math.floor(column)
  assert.ok(after[(floor + 2) * width + 80] - after[(floor - 2) * width + 80] > 3.5)
  assert.deepEqual(pixels, original, 'the source is retained')
})


test('rounded contour preserves straight stroke widths and empty transparency', () => {
  const width = 100, height = 100, pixels = new Uint8ClampedArray(width * height * 4)
  for (let y = 20; y < 70; y++) for (let x = 20; x < 80; x++) pixels[(y * width + x) * 4 + 3] = 255
  const field = smoothOutlineDistances(pixels, width, height, 1)
  for (const thickness of [1, 5, 15]) {
    assert.ok(Math.abs(field[(70 + thickness - 1) * width + 50] - thickness) < 0.4, 'flat edges retain their requested thickness')
  }
  assert.ok(smoothOutlineDistances(new Uint8ClampedArray(1600), 20, 20, 2).every(value => value > 60), 'empty cutouts stay empty')
})


test('rounding cannot inflate a 9 px stroke in the inward corner above an ear', () => {
  const width = 160, pixels = new Uint8ClampedArray(width * width * 4)
  for (let y = 20; y < 135; y++) for (let x = 20; x < (y < 80 ? 65 : 125); x++) pixels[(y * width + x) * 4 + 3] = 255
  const exact = outlineDistances(pixels, width, width)
  const rounded = smoothOutlineDistances(pixels, width, width, 1)
  for (let y = 40; y < 100; y++) for (let x = 60; x < 110; x++) {
    const index = y * width + x
    if (rounded[index] <= 9.5) assert.ok(exact[index] <= 10.25, 'the white edge cannot bridge farther than the chosen thickness plus subpixel cleanup')
  }
})
