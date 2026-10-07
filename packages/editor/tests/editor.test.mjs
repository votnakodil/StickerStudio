import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getEnv, setEnv, Textbox, FabricImage, Point, util } from 'fabric'
import { getEnv as getNodeEnv } from 'fabric/node'
import { addStickerText, commitStickerLayerScale, createStickerCanvas, exportStickerBlob, getStickerCanvasBackground, getStickerLayers, getStickerStroke, initializeStickerCanvas, normalizeStickerFontWeight, redo, reorderStickerLayers, undo, updateStickerCanvasBackground, updateStickerStroke, updateStickerTextStyle } from '../src/index.ts'

import * as editor from '../src/index.ts'
import { resizeStickerTextWidth, resizeStickerTextHeight } from '../src/text/textControls.ts'

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
  assert.deepEqual(getStickerStroke(canvas.getObjects().find(object => object instanceof Textbox)), { enabled: true, width: 7, color: '#ffffff', opacity: 1 })
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


test('initial image stroke belongs to the starting history and survives undo/redo', async () => withCanvas(async canvas => {
  globalThis.document = getEnv().document
  const source = getEnv().document.createElement('canvas')
  source.width = 32; source.height = 32
  const context = source.getContext('2d')
  context.fillStyle = '#ff0000'; context.fillRect(8, 8, 16, 16)
  const image = await initializeStickerCanvas(canvas, source.toDataURL(), { topText: 'TOP', bottomText: 'BOTTOM', imageStroke: { enabled: true, width: 10, color: '#ffffff', opacity: 1 } })
  assert.deepEqual(getStickerStroke(image), { enabled: true, width: 10, color: '#ffffff', opacity: 1 })
  assert.equal(canvas.history.length, 1)
  const originalLayers = getStickerLayers(canvas).map(layer => layer.id)
  updateStickerStroke(canvas, image, { enabled: false })
  await undo(canvas)
  assert.equal(getStickerStroke(canvas.getObjects().find(object => object instanceof FabricImage)).enabled, true)
  assert.deepEqual(getStickerLayers(canvas).map(layer => layer.id), originalLayers)
  await redo(canvas)
  assert.equal(getStickerStroke(canvas.getObjects().find(object => object instanceof FabricImage)).enabled, false)
}))

test('reveal snapshot includes the white outline without changing layers or history', async () => withCanvas(async canvas => {
  globalThis.document = getEnv().document
  const source = getEnv().document.createElement('canvas')
  source.width = 64; source.height = 64
  const context = source.getContext('2d')
  context.fillStyle = '#ff0000'; context.fillRect(16, 16, 32, 32)
  const image = await initializeStickerCanvas(canvas, source.toDataURL(), { topText: 'TOP', bottomText: 'BOTTOM', imageStroke: { enabled: true, width: 10, color: '#ffffff', opacity: 1 } })
  const history = [...canvas.history]
  const layers = getStickerLayers(canvas)
  assert.equal(typeof editor.createStickerImageReveal, 'function')
  const snapshot = editor.createStickerImageReveal(canvas, image)
  const pixels = snapshot.source.getContext('2d').getImageData(0, 0, snapshot.source.width, snapshot.source.height).data
  let white = 0; let opaque = 0
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] > 200) { opaque++; if (pixels[i] > 250 && pixels[i+1] > 250 && pixels[i+2] > 250) white++ }
  }
  assert.ok(white > 0)
  assert.ok(opaque > white)
  assert.equal(snapshot.artworkSource.width, snapshot.width)
  assert.equal(snapshot.artworkSource.height, snapshot.height)
  const plain = snapshot.artworkSource.getContext('2d').getImageData(0, 0, snapshot.width, snapshot.height).data
  let borderOnly = 0; let matchingArtwork = 0
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] > 200 && plain[i + 3] === 0) borderOnly++
    if (plain[i + 3] === 255 && plain[i] === 255 && plain[i + 1] === 0) {
      assert.deepEqual([...pixels.slice(i, i + 4)], [...plain.slice(i, i + 4)])
      matchingArtwork++
    }
  }
  assert.ok(borderOnly > 0, 'aligned textures must isolate the fading outline')
  assert.ok(matchingArtwork > 0, 'artwork must remain unchanged during the outline fade')
  assert.equal(snapshot.source.width, snapshot.width)
  assert.equal(snapshot.source.height, snapshot.height)
  assert.deepEqual(canvas.history, history)
  assert.deepEqual(getStickerLayers(canvas), layers)
  assert.equal(image.visible, true)
}))


test('custom image fitting constrains the full frame including transparent margins', async () => withCanvas(async canvas => {
  globalThis.document = getEnv().document
  const source = getEnv().document.createElement('canvas')
  source.width = 128; source.height = 128
  const context = source.getContext('2d')
  context.fillStyle = '#ff0000'; context.fillRect(32, 16, 64, 96)
  const image = await initializeStickerCanvas(canvas, source.toDataURL(), { topText: 'TOP', bottomText: 'BOTTOM', imageFit: { width: 640, height: 760 }, imageStroke: { enabled: true, width: 15, color: '#ffffff', opacity: 1 } })
  assert.ok(Math.abs(128 * image.scaleY - 640) < 0.01)
  assert.equal(128 * image.scaleX, 640)
  assert.equal(getStickerStroke(image).width, 15)
  assert.equal(canvas.history.length, 1)
}))


test('image selection bounds include the silhouette stroke and restore it with history', async () => withCanvas(async canvas => {
  globalThis.document = getEnv().document
  const source = getEnv().document.createElement('canvas')
  source.width = 64; source.height = 64
  const context = source.getContext('2d')
  context.fillStyle = '#ff0000'; context.fillRect(0, 0, 64, 64)
  const image = await initializeStickerCanvas(canvas, source.toDataURL(), { topText: 'TOP', bottomText: 'BOTTOM', imageStroke: { enabled: true, width: 10, color: '#ffffff', opacity: 1 } })
  const bounds = image.getBoundingRect()
  assert.equal(image.stroke, null) // No rectangular native stroke is painted.
  assert.equal(image.strokeWidth, 20)
  assert.ok(Math.abs(bounds.width - (image.width + 20) * image.scaleX) < 0.01)
  assert.ok(Math.abs(bounds.height - (image.height + 20) * image.scaleY) < 0.01)
  assert.ok(Math.abs(bounds.top + bounds.height - (image.top + image.height * image.scaleY / 2 + 10 * image.scaleY)) < 0.01)
  updateStickerStroke(canvas, image, { width: 20 })
  assert.equal(image.strokeWidth, 40)
  updateStickerStroke(canvas, image, { enabled: false })
  assert.equal(image.strokeWidth, 0)
  await undo(canvas)
  const restored = canvas.getObjects().find(object => object instanceof FabricImage)
  assert.equal(restored.strokeWidth, 40)
  assert.equal(getStickerStroke(restored).width, 20)
  await redo(canvas)
  assert.equal(canvas.getObjects().find(object => object instanceof FabricImage).strokeWidth, 0)
}))

for (const usePreset of [false, true]) {
  test(`opening captions use the same defaults for cutouts and templates (preset=${usePreset})`, async () => withCanvas(async canvas => {
    globalThis.document = getEnv().document
    const source = getEnv().document.createElement('canvas')
    source.width = 512; source.height = 512
    source.getContext('2d').fillRect(100, 60, 300, 380)
    const layers = editor.createDefaultStickerTextLayers()
    const image = await initializeStickerCanvas(canvas, source.toDataURL(), {
      topText: 'TOP TEXT', bottomText: 'BOTTOM TEXT', imageFit: { width: 900, height: 900 },
      ...(usePreset ? { preset: { image: { left: 62, top: 62, width: 900, height: 900 }, texts: layers } } : {}),
    })
    assert.deepEqual(getStickerStroke(image), { enabled: true, width: 7, color: '#ffffff', opacity: 1 })
    assert.equal(image.width * image.scaleX, 900)
    assert.equal(image.height * image.scaleY, 900)
    const texts = canvas.getObjects().filter(object => object instanceof Textbox)
    assert.deepEqual(texts.map(text => text.text), ['BOTTOM TEXT', 'TOP TEXT'])
    for (const text of texts) {
      assert.equal(text.fontFamily, 'SF Pro Text')
      assert.equal(text.fontWeight, 900)
      assert.equal(text.fill, '#17191f')
      assert.equal(text.stickerCustomFill, true)
      assert.equal(text.stickerAutoSize, true)
      assert.equal(text.textAlign, 'center')
      assert.equal(text.stickerVerticalAlign, 'middle')
      const bounds = text.getBoundingRect()
      assert.ok(bounds.left >= 0, 'opening caption starts inside the canvas')
      assert.ok(bounds.top >= 0, 'opening caption starts below the top edge')
      assert.ok(bounds.left + bounds.width <= 1024 + 0.01, 'caption stroke and right handle fit inside the canvas')
      assert.ok(bounds.top + bounds.height <= 1024 + 0.01, 'caption stroke fits above the bottom edge')
      assert.equal(bounds.left, 0, 'opening caption frame aligns with the canvas left edge')
      assert.deepEqual(text.stickerStroke, { enabled: true, width: 7, color: '#ffffff', opacity: 1 })
    }
    assert.equal(canvas.history.length, 1)
    updateStickerTextStyle(canvas, texts[0], { fill: '#ffffff' })
    await undo(canvas)
    assert.equal(canvas.getObjects().filter(object => object instanceof Textbox)[0].fill, '#17191f')
    await redo(canvas)
    assert.equal(canvas.getObjects().filter(object => object instanceof Textbox)[0].fill, '#ffffff')
  }))
}

test('edge smoothing changes the image silhouette with stroke off and resets to original pixels', async () => withCanvas(async canvas => {
  globalThis.document = getEnv().document
  assert.equal(typeof editor.updateStickerImageSmoothing, 'function')
  const source = document.createElement('canvas')
  source.width = 64; source.height = 64
  const context = source.getContext('2d')
  context.fillStyle = '#d04020'
  context.fillRect(12, 12, 40, 40)
  context.fillRect(30, 6, 1, 6)
  const original = context.getImageData(0, 0, 64, 64).data
  const image = await initializeStickerCanvas(canvas, source.toDataURL(), { topText: 'TOP', bottomText: 'BOTTOM', imageStroke: { enabled: false, width: 10, color: '#ffffff', opacity: 1 } })
  const read = () => {
    const target = document.createElement('canvas'); target.width = 64; target.height = 64
    const ctx = target.getContext('2d'); ctx.drawImage(image.getElement(), 0, 0)
    return ctx.getImageData(0, 0, 64, 64).data
  }
  const placement = [image.left, image.top, image.scaleX, image.scaleY]
  editor.updateStickerImageSmoothing(canvas, image, 100)
  const smoothed = read()
  assert.ok(smoothed[(8 * 64 + 30) * 4 + 3] < 100, 'remove a narrow protrusion from the actual image')
  assert.ok(smoothed[(12 * 64 + 12) * 4 + 3] < 200, 'round the silhouette corner')
  assert.deepEqual([...smoothed.slice((32 * 64 + 32) * 4, (32 * 64 + 32) * 4 + 4)], [208, 64, 32, 255], 'interior photo stays sharp and retains its color')
  assert.equal(getStickerStroke(image).enabled, false)
  assert.deepEqual([image.left, image.top, image.scaleX, image.scaleY], placement)
  editor.updateStickerImageSmoothing(canvas, image, 0)
  assert.deepEqual(read(), original, 'reset must recover the original pixels exactly')
}))

test('edge smoothing survives serialized history, undo/redo, and PNG rendering', async () => withCanvas(async canvas => {
  globalThis.document = getEnv().document
  assert.equal(typeof editor.updateStickerImageSmoothing, 'function')
  const source = document.createElement('canvas'); source.width = 64; source.height = 64
  const context = source.getContext('2d'); context.fillStyle = '#d04020'; context.fillRect(12, 12, 40, 40)
  const originalUrl = source.toDataURL()
  const image = await initializeStickerCanvas(canvas, originalUrl, { topText: 'TOP', bottomText: 'BOTTOM', imageStroke: { enabled: false, width: 10, color: '#ffffff', opacity: 1 } })
  const ids = getStickerLayers(canvas).map(layer => layer.id)
  editor.updateStickerImageSmoothing(canvas, image, 60, false)
  editor.updateStickerImageSmoothing(canvas, image, 100, false)
  assert.equal(canvas.history.length, 1, 'preview should not create undo entries')
  editor.commitStickerImageSmoothing(canvas, image)
  assert.equal(canvas.history.length, 2)
  const saved = JSON.parse(canvas.history[1]).objects.find(object => object.type === 'Image')
  assert.equal(saved.src, originalUrl, 'keep the original source in saved designs')
  assert.equal(saved.stickerEdgeSmoothing, 100)
  const snapshot = editor.createStickerImageReveal(canvas, image).artworkSource.toDataURL()
  const blob = await exportStickerBlob(canvas)
  assert.ok(blob.size > 0)
  await undo(canvas)
  let restored = canvas.getObjects().find(object => object instanceof FabricImage)
  assert.equal(editor.getStickerImageSmoothing(restored), 0)
  await redo(canvas)
  restored = canvas.getObjects().find(object => object instanceof FabricImage)
  assert.equal(editor.getStickerImageSmoothing(restored), 100)
  assert.equal(editor.createStickerImageReveal(canvas, restored).artworkSource.toDataURL(), snapshot)
  assert.deepEqual(getStickerLayers(canvas).map(layer => layer.id), ids)
}))

test('roundness reshapes broad corners while retaining a crisp image edge', async () => {
  const { smoothImagePixels } = await import('../src/images/smoothImagePixels.ts')
  const width = 256
  const original = new Uint8ClampedArray(width * width * 4)
  for (let y = 48; y < 208; y++) for (let x = 48; x < 208; x++) {
    original.set([208, 64, 32, 255], (y * width + x) * 4)
  }
  const rounded = smoothImagePixels(original, width, width, 100)
  assert.ok(rounded[(52 * width + 52) * 4 + 3] < 80, 'round a broad corner, not only its outermost pixels')
  assert.equal(rounded[(128 * width + 128) * 4 + 3], 255)
  const transition = []
  for (let y = 36; y < 64; y++) {
    const alpha = rounded[(y * width + 128) * 4 + 3]
    if (alpha > 0 && alpha < 255) transition.push(y)
  }
  assert.ok(transition.length <= 2, 'roundness must not introduce a feathered edge')
  const low = smoothImagePixels(original, width, width, 15)
  assert.ok(low[(52 * width + 52) * 4 + 3] > rounded[(52 * width + 52) * 4 + 3], 'the slider must increase contour rounding')
})

test('roundness keeps the same detailed contour during dragging, commit and export', async () => withCanvas(async canvas => {
  globalThis.document = getEnv().document
  const source = document.createElement('canvas'); source.width = 512; source.height = 512
  const context = source.getContext('2d'); context.fillStyle = '#d04020'; context.fillRect(100, 100, 300, 300)
  const image = await initializeStickerCanvas(canvas, source.toDataURL(), { topText: 'TOP', bottomText: 'BOTTOM', imageStroke: { enabled: true, width: 10, color: '#ffffff', opacity: 1 } })
  editor.updateStickerImageSmoothing(canvas, image, 75, false)
  const dragging = editor.createStickerImageReveal(canvas, image).artworkSource.toDataURL()
  assert.equal(image.width, 512)
  assert.equal(image.height, 512)
  assert.equal(image.stickerEdgeSmoothing, 75)
  assert.equal(canvas.history.length, 1)
  await exportStickerBlob(canvas)
  assert.equal(editor.createStickerImageReveal(canvas, image).artworkSource.toDataURL(), dragging, 'export must not change the displayed edge')
  assert.equal(canvas.history.length, 1, 'export should not create an editing history entry')
  editor.commitStickerImageSmoothing(canvas, image)
  assert.equal(canvas.history.length, 2)
  const committed = editor.createStickerImageReveal(canvas, image).artworkSource.toDataURL()
  assert.equal(committed, dragging, 'release must not replace a blurred preview')
  editor.updateStickerImageSmoothing(canvas, image, 0)
  editor.updateStickerImageSmoothing(canvas, image, 75)
  assert.equal(editor.createStickerImageReveal(canvas, image).artworkSource.toDataURL(), committed)
}))


test('eraser removes a continuous image path, survives roundness and restores with undo', async () => withCanvas(async canvas => {
  assert.equal(typeof editor.eraseStickerImagePath, 'function')
  globalThis.document = getEnv().document
  const source = document.createElement('canvas')
  source.width = source.height = 128
  const context = source.getContext('2d')
  context.fillStyle = '#ff0000'
  context.fillRect(0, 0, 128, 128)
  const image = await FabricImage.fromURL(source.toDataURL())
  canvas.add(image)
  const originalSource = image.getSrc()
  const id = getStickerLayers(canvas)[0].id
  const startHistory = canvas.history.length
  editor.eraseStickerImagePath(canvas, image, [{ x: 24, y: 64 }, { x: 104, y: 64 }], 12)
  const alpha = (object, x, y) => {
    const surface = document.createElement('canvas')
    surface.width = surface.height = 128
    const ctx = surface.getContext('2d')
    ctx.drawImage(object.getElement(), 0, 0)
    return ctx.getImageData(x, y, 1, 1).data[3]
  }
  assert.equal(alpha(image, 64, 64), 0)
  assert.equal(alpha(image, 64, 32), 255)
  assert.equal(image.getSrc(), originalSource)
  assert.equal(canvas.history.length, startHistory + 1)
  editor.updateStickerImageSmoothing(canvas, image, 70)
  assert.equal(alpha(image, 64, 64), 0)
  await undo(canvas)
  await undo(canvas)
  assert.equal(alpha(canvas.getObjects()[0], 64, 64), 255)
  await redo(canvas)
  assert.equal(alpha(canvas.getObjects()[0], 64, 64), 0)
  assert.equal(getStickerLayers(canvas)[0].id, id)
}))


test('eraser brush follows rotated and scaled images without moving the layer', async () => withCanvas(async canvas => {
  globalThis.document = getEnv().document
  const source = document.createElement('canvas')
  source.width = source.height = 128
  const context = source.getContext('2d')
  context.fillStyle = '#ff0000'
  context.fillRect(0, 0, 128, 128)
  const image = await FabricImage.fromURL(source.toDataURL())
  image.set({ left: 400, top: 300, scaleX: 2, scaleY: 1.5, angle: 35 })
  canvas.add(image)
  canvas.setActiveObject(image)
  editor.setEditorTool(canvas, 'eraser')
  editor.setEraserSize(canvas, 40)
  const initialHistory = canvas.history.length
  const scenePoint = util.transformPoint(new Point(0, 0), image.calcTransformMatrix())
  const event = { e: { button: 0, altKey: false }, scenePoint }
  // Fabric clears selection on empty-target brush clicks before emitting mouse:down.
  canvas.fire('mouse:down:before', event)
  canvas.discardActiveObject()
  canvas.fire('mouse:down', event)
  canvas.fire('mouse:move', { ...event, scenePoint: util.transformPoint(new Point(20, 0), image.calcTransformMatrix()) })
  canvas.fire('mouse:up', event)
  const surface = document.createElement('canvas')
  surface.width = surface.height = 128
  const ctx = surface.getContext('2d')
  ctx.drawImage(image.getElement(), 0, 0)
  assert.equal(ctx.getImageData(64, 64, 1, 1).data[3], 0)
  assert.equal(ctx.getImageData(84, 64, 1, 1).data[3], 0)
  assert.equal(ctx.getImageData(64, 32, 1, 1).data[3], 255)
  assert.deepEqual([image.left, image.top, image.scaleX, image.scaleY, image.angle], [400, 300, 2, 1.5, 35])
  assert.equal(canvas.history.length, initialHistory + 1)
  assert.equal(canvas.getActiveObject(), image)
}))


test('roundness fills small transparent notches with photo color without changing source pixels', async () => {
  const { smoothImagePixels } = await import('../src/images/smoothImagePixels.ts')
  const width = 64
  const pixels = new Uint8ClampedArray(width * width * 4)
  for (let y = 8; y < 56; y++) for (let x = 8; x < 56; x++) pixels.set([208, 64, 32, 255], (y * width + x) * 4)
  for (let y = 8; y < 11; y++) pixels.fill(0, (y * width + 31) * 4, (y * width + 32) * 4)
  const original = new Uint8ClampedArray(pixels)
  const result = smoothImagePixels(pixels, width, width, 100)
  const notch = (10 * width + 31) * 4
  assert.ok(result[notch + 3] > 0, 'round the small notch in the silhouette')
  assert.deepEqual([...result.slice(notch, notch + 3)], [208, 64, 32], 'borrow photo RGB without dark fringes')
  assert.deepEqual(smoothImagePixels(pixels, width, width, 100), result, 'cached photo colors preserve the result')
  assert.deepEqual(pixels, original, 'the original cutout remains unmodified')
})


test('cutout initialization applies requested roundness and stroke before the first history snapshot', async () => withCanvas(async canvas => {
  globalThis.document = getEnv().document
  const source = document.createElement('canvas'); source.width = 64; source.height = 64
  const context = source.getContext('2d'); context.fillStyle = '#d04020'; context.fillRect(8, 8, 48, 48)
  const image = await initializeStickerCanvas(canvas, source.toDataURL(), {
    topText: 'TOP TEXT', bottomText: 'BOTTOM TEXT', imageRoundness: 25,
    imageStroke: { enabled: true, width: 15, color: '#ffffff', opacity: 1 },
  })
  assert.equal(editor.getStickerImageSmoothing(image), 25)
  assert.equal(getStickerStroke(image).width, 15)
  assert.equal(canvas.history.length, 1)
  const initial = JSON.parse(canvas.history[0]).objects.find(object => object.type === 'Image')
  assert.equal(initial.stickerEdgeSmoothing, 25)
  assert.equal(initial.stickerStroke.width, 15)
}))


test('text outline thickness keeps frame, anchor and font stable through undo/redo', async () => withCanvas(async canvas => {
  globalThis.document=getEnv().document
  const source=document.createElement('canvas');source.width=source.height=64
  source.getContext('2d').fillRect(0,0,64,64)
  await initializeStickerCanvas(canvas,source.toDataURL(),{topText:'TOP',bottomText:'BOTTOM'})
  let text=canvas.getObjects().find(o=>o instanceof Textbox)
  const capture=t=>{t.setCoords();return{bounds:t.getBoundingRect(),center:t.getCenterPoint(),width:t.width,height:t.height,fontSize:t.fontSize,matrix:t.calcTransformMatrix()}}
  const before=capture(text)
  const cacheBefore=text._getCacheCanvasDimensions()
  updateStickerStroke(canvas,text,{width:40})
  assert.deepEqual(capture(text),before)
  assert.ok(text._getCacheCanvasDimensions().height>cacheBefore.height,'paint cache accommodates the thicker outline')
  const right = text.getPointByOrigin('right', 'center')
  resizeStickerTextWidth({}, { target: text, corner: 'mr', originX: 'left', originY: 'top' }, right.x, right.y)
  const bottom = text.getPointByOrigin('center', 'bottom')
  resizeStickerTextHeight({}, { target: text, corner: 'mb', originX: 'left', originY: 'top' }, bottom.x, bottom.y)
  assert.deepEqual(capture(text),before,'starting a resize does not jump after changing stroke')
  updateStickerStroke(canvas,text,{enabled:false})
  assert.deepEqual(capture(text),before)
  await undo(canvas);text=canvas.getObjects().find(o=>o instanceof Textbox)
  assert.equal(getStickerStroke(text).width,40)
  assert.deepEqual(capture(text),before)
  await undo(canvas);text=canvas.getObjects().find(o=>o instanceof Textbox)
  assert.equal(getStickerStroke(text).width,7)
  assert.deepEqual(capture(text),before)
  await redo(canvas);text=canvas.getObjects().find(o=>o instanceof Textbox)
  assert.deepEqual(capture(text),before)
}))


test('new text shares caption styling at 100 px and restores its black fill and white stroke', async () => withCanvas(async canvas => {
  const text = addStickerText(canvas)
  const defaults = editor.createDefaultStickerTextLayers()[1]
  assert.equal(text.fontSize, 100)
  assert.equal(text.fontFamily, defaults.fontFamily); assert.equal(text.fontWeight, defaults.fontWeight)
  assert.equal(text.fill, defaults.fill); assert.equal(text.textAlign, defaults.textAlign)
  assert.equal(text.stickerAutoSize, true); assert.equal(text.stickerVerticalAlign, 'middle')
  assert.equal(text.stickerFrameHeight, defaults.frameHeight); assert.equal(text.width, defaults.width)
  assert.deepEqual(text.stickerStroke, defaults.stroke)
  text.setCoords(); const bounds = text.getBoundingRect()
  assert.equal(bounds.left, 0); assert.equal(bounds.width, 1024)
  updateStickerTextStyle(canvas, text, { fill: '#ff0000' })
  await undo(canvas)
  let restored = canvas.getObjects().find(o => o instanceof Textbox)
  assert.equal(restored.fill, defaults.fill); assert.deepEqual(restored.stickerStroke, defaults.stroke)
  await redo(canvas); restored = canvas.getObjects().find(o => o instanceof Textbox)
  assert.equal(restored.fill, '#ff0000')
}))


test('sidebar text content editing retains its frame and layer ID through undo and redo', async () => withCanvas(async canvas => {
  const text = addStickerText(canvas, 'ORIGINAL')
  const initial = { center: text.getCenterPoint(), width: text.width, height: text.height, stroke: { ...text.stickerStroke } }
  const id = getStickerLayers(canvas)[0].id, history = canvas.historyIndex
  editor.updateStickerTextContent(canvas, text, 'A MUCH LONGER REPLACEMENT CAPTION')
  assert.equal(canvas.historyIndex, history + 1)
  assert.equal(text.width, initial.width); assert.equal(text.height, initial.height)
  assert.deepEqual(text.getCenterPoint(), initial.center)
  assert.deepEqual(text.stickerStroke, initial.stroke)
  assert.equal(getStickerLayers(canvas)[0].id, id)
  assert.ok(text.fontSize <= 100)
  await undo(canvas); let restored = canvas.getObjects().find(o => o instanceof Textbox)
  assert.equal(restored.text, 'ORIGINAL'); assert.equal(getStickerLayers(canvas)[0].id, id)
  await redo(canvas); restored = canvas.getObjects().find(o => o instanceof Textbox)
  assert.equal(restored.text, 'A MUCH LONGER REPLACEMENT CAPTION')
  const unchangedHistory = canvas.historyIndex
  editor.updateStickerTextContent(canvas, restored, restored.text)
  assert.equal(canvas.historyIndex, unchangedHistory, 'unchanged text does not create an undo entry')
}))

test('eraser drag stays one smooth path regardless of render-frame batching', async () => withCanvas(async canvas => {
  globalThis.document = getEnv().document
  const source = document.createElement('canvas')
  source.width = source.height = 128
  source.getContext('2d').fillRect(0, 0, 128, 128)
  const points = [new Point(-35, -25), new Point(-20, -12), new Point(0, -8), new Point(15, 8), new Point(35, 25)]
  const results = []
  for (const flushEach of [false, true]) {
    const image = await FabricImage.fromURL(source.toDataURL())
    canvas.add(image)
    canvas.setActiveObject(image)
    editor.setEditorTool(canvas, 'eraser')
    editor.setEraserSize(canvas, 20)
    const event = point => ({ e: { button: 0, altKey: false }, scenePoint: util.transformPoint(point, image.calcTransformMatrix()) })
    canvas.fire('mouse:down:before', event(points[0]))
    canvas.fire('mouse:down', event(points[0]))
    for (const point of points.slice(1)) {
      canvas.fire('mouse:move', event(point))
      if (flushEach) canvas.fire('before:render')
    }
    canvas.fire('mouse:up')
    assert.equal(image.stickerErasedPaths.length, 1, 'one drag must produce one continuous path')
    assert.equal(image.stickerErasedPaths[0].smooth, true)
    results.push(image.getElement().getContext('2d').getImageData(0, 0, 128, 128).data)
    canvas.remove(image)
  }
  assert.deepEqual(results[0], results[1], 'render cadence must not change the erased contour')
}))
