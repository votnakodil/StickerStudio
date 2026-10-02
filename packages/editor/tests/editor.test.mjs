import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getEnv, setEnv, Textbox } from 'fabric'
import { getEnv as getNodeEnv } from 'fabric/node'
import { addStickerText, commitStickerLayerScale, createStickerCanvas, exportStickerBlob, getStickerCanvasBackground, getStickerLayers, getStickerStroke, normalizeStickerFontWeight, redo, reorderStickerLayers, undo, updateStickerCanvasBackground, updateStickerStroke, updateStickerTextStyle } from '../src/index.ts'

setEnv(getNodeEnv())

async function withCanvas(run) {
  const canvas = createStickerCanvas(getEnv().document.createElement('canvas'))
  try {
    await run(canvas)
  } finally {
    await canvas.dispose()
  }
}

test('font weights use the closest supported weight', () => {
  assert.equal(normalizeStickerFontWeight('Impact', 900), 400)
  assert.equal(normalizeStickerFontWeight('SF Pro Text', 600), 600)
  assert.equal(normalizeStickerFontWeight('Arial', 'bold'), 700)
})

test('undo and redo restore background and text styling', async () => withCanvas(async canvas => {
  commitStickerLayerScale(canvas)
  updateStickerCanvasBackground(canvas, '#ffffff')
  const text = addStickerText(canvas, 'HELLO')
  updateStickerTextStyle(canvas, text, { underline: true, stickerVerticalAlign: 'bottom' })
  updateStickerStroke(canvas, text, { enabled: true, width: 7, color: '#000000' })
  await undo(canvas)
  assert.equal(getStickerStroke(canvas.getObjects().find(object => object instanceof Textbox)).enabled, false)
  await redo(canvas)
  const restored = canvas.getObjects().find(object => object instanceof Textbox)
  assert.equal(restored.underline, true)
  assert.equal(restored.stickerVerticalAlign, 'bottom')
  assert.equal(getStickerStroke(restored).enabled, true)
  assert.equal(getStickerCanvasBackground(canvas), '#ffffff')
}))

test('layers preserve IDs while changing their stacking order', async () => withCanvas(async canvas => {
  addStickerText(canvas, 'FIRST')
  addStickerText(canvas, 'SECOND')
  const original = getStickerLayers(canvas)
  const reversedIds = original.map(layer => layer.id).reverse()
  reorderStickerLayers(canvas, reversedIds)
  assert.deepEqual(getStickerLayers(canvas).map(layer => layer.id), reversedIds)
}))

test('PNG export restores viewport and requests a 1024px image', async () => {
  const viewport = [2, 0, 0, 2, 80, 40]
  const blob = new Blob(['png'], { type: 'image/png' })
  const canvas = {
    viewportTransform: viewport,
    getWidth: () => 1024,
    getHeight: () => 1024,
    getObjects: () => [],
    calcViewportBoundaries() {},
    async toBlob(options) {
      assert.deepEqual(this.viewportTransform, [1, 0, 0, 1, 0, 0])
      assert.deepEqual(options, { format: 'png', multiplier: 1, enableRetinaScaling: false })
      return blob
    },
  }
  assert.equal(await exportStickerBlob(canvas), blob)
  assert.equal(canvas.viewportTransform, viewport)
  await assert.rejects(exportStickerBlob({ ...canvas, getWidth: () => 512 }), /1024/)
})


test('real canvas export produces a PNG with a 1024px header', async () => withCanvas(async canvas => {
  addStickerText(canvas, 'PNG')
  canvas.setViewportTransform([0.5, 0, 0, 0.5, 20, 10])
  const blob = await exportStickerBlob(canvas)
  const buffer = await new Promise((resolve, reject) => {
    const reader = new (getEnv().window.FileReader)()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })
  const bytes = Buffer.from(buffer)
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
  assert.equal(bytes.readUInt32BE(16), 1024)
  assert.equal(bytes.readUInt32BE(20), 1024)
  assert.deepEqual(canvas.viewportTransform, [0.5, 0, 0, 0.5, 20, 10])
}))
