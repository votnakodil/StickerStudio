import assert from 'node:assert/strict'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'
import { snapshotPhotoProcessingSurface } from '../src/features/custom-photo/lib/snapshotPhotoProcessingSurface.ts'

function withSurface(run) {
  const dom = new JSDOM('<div id="surface"><div data-slot="image-generation"><div style="background-color: rgb(40, 40, 40)"><canvas width="32" height="32"></canvas></div></div></div>')
  const previous = { document: globalThis.document, getComputedStyle: globalThis.getComputedStyle }
  globalThis.document = dom.window.document
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window)
  try { run(dom.window.document.getElementById('surface')) }
  finally {
    globalThis.document = previous.document
    globalThis.getComputedStyle = previous.getComputedStyle
    dom.window.close()
  }
}

test('photo cancellation freezes the loading dots and their opaque background', () => withSurface(surface => {
  const dots = surface.querySelector('canvas')
  const context = dots.getContext('2d')
  context.fillStyle = 'white'
  context.fillRect(8, 8, 4, 4)
  const snapshot = snapshotPhotoProcessingSurface(surface)
  assert.ok(snapshot)
  assert.equal(snapshot.width, 32)
  assert.equal(snapshot.height, 32)
  const pixel = (x, y) => [...snapshot.getContext('2d').getImageData(x, y, 1, 1).data]
  assert.deepEqual(pixel(0, 0), [40, 40, 40, 255])
  assert.deepEqual(pixel(9, 9), [255, 255, 255, 255])
  context.clearRect(0, 0, 32, 32)
  assert.deepEqual(pixel(9, 9), [255, 255, 255, 255], 'later processing changes cannot alter the return snapshot')
}))

test('a missing loading field does not substitute the original photo', () => withSurface(surface => {
  surface.querySelector('[data-slot="image-generation"]').remove()
  const image = surface.ownerDocument.createElement('img')
  image.src = 'original-photo.png'
  surface.append(image)
  assert.equal(snapshotPhotoProcessingSurface(surface), undefined)
}))
