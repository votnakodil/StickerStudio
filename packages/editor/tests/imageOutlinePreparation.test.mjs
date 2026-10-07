import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getEnv as getNodeEnv } from 'fabric/node'
import { setEnv, Textbox, FabricImage } from 'fabric'
import { createStickerCanvas } from '../src/canvas/createCanvas.ts'
import { initializeStickerCanvas } from '../src/canvas/initializeCanvas.ts'
import { imageOutlines, prepareImageOutline } from '../src/images/imageOutline.ts'
import { outlinePixels } from '../src/images/outlinePixels.ts'
import { smoothOutlineDistances } from '../src/images/smoothOutlineDistances.ts'

const document = getNodeEnv().document

async function withWorker(run) {
  const originalWorker = globalThis.Worker
  const originalDocument = globalThis.document
  const workers = []
  class OutlineWorker {
    terminated = false
    constructor() { workers.push(this) }
    postMessage(request, transfer) { this.request = request; assert.equal(transfer[0], request.pixels.buffer) }
    terminate() { this.terminated = true }
    finish() {
      const { pixels, width, height, scale, stroke } = this.request
      this.result = smoothOutlineDistances(pixels, width, height, scale)
      this.coloredPixels = outlinePixels(this.result, scale, stroke.width, stroke.color)
      this.onmessage({ data: { distances: this.result, coloredPixels: this.coloredPixels } })
    }
  }
  globalThis.Worker = OutlineWorker
  globalThis.document = document
  const element = document.createElement('canvas')
  element.width = element.height = 32
  const context = element.getContext('2d')
  context.beginPath(); context.arc(16, 16, 10, 0, Math.PI * 2); context.fill()
  const image = { width: 32, height: 32, stickerStroke: { enabled: true, width: 7, color: '#ffffff' }, getElement: () => element }
  try { await run(image, workers) }
  finally { globalThis.Worker = originalWorker; globalThis.document = originalDocument }
}

test('outline preparation waits for the worker and retains the exact rounded distance field', async () => withWorker(async (image, workers) => {
  const pending = prepareImageOutline(image)
  assert.equal(imageOutlines.has(image), false, 'animation can continue before geometry is ready')
  assert.equal(workers.length, 1)
  workers[0].finish()
  await pending
  assert.deepEqual(imageOutlines.get(image).distances, workers[0].result)
  const cache = imageOutlines.get(image)
  assert.equal(cache.coloredWidth, 7)
  assert.equal(cache.coloredColor, '#ffffff')
  // Compare through the same Canvas round trip, including its premultiplied alpha.
  const expectedSurface = document.createElement('canvas')
  expectedSurface.width = cache.width; expectedSurface.height = cache.height
  const expectedContext = expectedSurface.getContext('2d')
  const expectedPixels = expectedContext.createImageData(cache.width, cache.height)
  expectedPixels.data.set(workers[0].coloredPixels)
  expectedContext.putImageData(expectedPixels, 0, 0)
  assert.deepEqual(cache.colored.getContext('2d').getImageData(0, 0, cache.width, cache.height).data,
    expectedContext.getImageData(0, 0, cache.width, cache.height).data)
  assert.equal(workers[0].terminated, true)
  await prepareImageOutline(image)
  assert.equal(workers.length, 1, 'a prepared image reuses its geometry')
}))

test('leaving during preparation terminates the worker without attaching a stale outline', async () => withWorker(async (image, workers) => {
  const controller = new AbortController()
  const pending = prepareImageOutline(image, controller.signal)
  controller.abort()
  await assert.rejects(pending, { name: 'AbortError' })
  assert.equal(workers[0].terminated, true)
  assert.equal(imageOutlines.has(image), false)
  await assert.rejects(prepareImageOutline(image, controller.signal), { name: 'AbortError' })
  assert.equal(workers.length, 1)
}))

test('replaced image pixels cannot receive a previously requested outline', async () => withWorker(async (image, workers) => {
  const pending = prepareImageOutline(image)
  image.getElement = () => document.createElement('canvas')
  workers[0].finish()
  await pending
  assert.equal(imageOutlines.has(image), false)
  assert.equal(workers[0].terminated, true)
}))

test('worker failures reject preparation and release its resources', async () => withWorker(async (image, workers) => {
  const pending = prepareImageOutline(image)
  workers[0].onerror({ message: 'worker failed' })
  await assert.rejects(pending, /worker failed/)
  assert.equal(workers[0].terminated, true)
  assert.equal(imageOutlines.has(image), false)
}))


test('initial layout is available before the outline worker completes, with one initial history entry', async () => withWorker(async (source, workers) => {
  setEnv(getNodeEnv())
  const canvas = createStickerCanvas(document.createElement('canvas'))
  let reportLayout
  const layoutReady = new Promise(resolve => { reportLayout = resolve })
  try {
    const pending = initializeStickerCanvas(canvas, source.getElement().toDataURL(), {
      topText: 'TOP', bottomText: 'BOTTOM',
    }, undefined, image => reportLayout(image))
    const image = await layoutReady
    assert.equal(workers.length, 1)
    assert.equal(imageOutlines.has(image), false)
    assert.deepEqual(canvas.getObjects().filter(object => object instanceof Textbox).map(object => object.text), ['BOTTOM', 'TOP'])
    assert.equal(image.left, 512)
    workers[0].finish()
    assert.equal(await pending, image)
    assert.equal(imageOutlines.has(image), true)
    assert.equal(canvas.history.length, 1)
    assert.equal(canvas.historyIndex, 0)
  } finally { await canvas.dispose() }
}))


test('a stroke changed during preparation cannot receive the old colored bitmap', async () => withWorker(async (image, workers) => {
  const pending = prepareImageOutline(image)
  image.stickerStroke.width = 12
  workers[0].finish()
  await pending
  const cache = imageOutlines.get(image)
  assert.deepEqual(cache.distances, workers[0].result)
  assert.equal(cache.colored, undefined)
  assert.equal(cache.coloredWidth, undefined)
  assert.equal(workers[0].terminated, true)
}))


test('unchanged library images reuse warmed contours without sharing mutable stroke settings', async () => withWorker(async (image, workers) => {
  setEnv(getNodeEnv())
  const originalImageClass = globalThis.HTMLImageElement
  globalThis.HTMLImageElement = document.defaultView.HTMLImageElement
  try {
    const source = image.getElement().toDataURL()
    const loaded = await FabricImage.fromURL(source)
    image.getElement = () => loaded.getElement()
    const preparing = prepareImageOutline(image)
    workers[0].finish()
    await preparing
    const second = { ...image, stickerStroke: { ...image.stickerStroke } }
    await prepareImageOutline(second)
    assert.equal(workers.length, 1, 'opening the warmed image starts no second worker')
    const firstCache = imageOutlines.get(image)
    const secondCache = imageOutlines.get(second)
    assert.notEqual(firstCache, secondCache)
    assert.equal(firstCache.distances, secondCache.distances)
    secondCache.coloredWidth = 19
    assert.equal(firstCache.coloredWidth, 7, 'editing a stroke cannot mutate the warmed paint record')
    const editedPixels = document.createElement('canvas')
    const edited = { ...second, getElement: () => editedPixels }
    const rebuilding = prepareImageOutline(edited)
    assert.equal(workers.length, 2, 'edited pixels must calculate their own geometry')
    workers[1].finish()
    await rebuilding
    assert.notEqual(imageOutlines.get(edited).distances, firstCache.distances)
    loaded.dispose()
  } finally { globalThis.HTMLImageElement = originalImageClass }
}))
