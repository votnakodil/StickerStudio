import assert from 'node:assert/strict'
import { test } from 'node:test'
import { setEnv, getEnv, FabricImage, Textbox, ActiveSelection } from 'fabric'
import { getEnv as getNodeEnv } from 'fabric/node'
import { captureStickerDesign, restoreStickerDesign, createStickerCanvas, initializeStickerCanvas, eraseStickerImagePath, updateStickerCanvasBackground, updateStickerStroke, updateStickerImageSmoothing, getStickerLayers } from '../src/index.ts'
setEnv(getNodeEnv())
globalThis.document = getEnv().document

test('saved design restores every editable layer, its transform, masks, and background', async () => {
  const canvas = createStickerCanvas(document.createElement('canvas'))
  const restored = createStickerCanvas(document.createElement('canvas'))
  try {
    const source = document.createElement('canvas')
    source.width = source.height = 128
    source.getContext('2d').fillRect(0, 0, 128, 128)
    const image = await initializeStickerCanvas(canvas, source.toDataURL(), { topText: 'SAVED', bottomText: 'BOTTOM' })
    image.set({ left: 381, top: 624, scaleX: 2.1, scaleY: 1.7, angle: 23, flipX: true, opacity: 0.65, lockRotation: true })
    updateStickerStroke(canvas, image, { width: 11, color: '#123456', enabled: true, opacity: 0.7 })
    updateStickerImageSmoothing(canvas, image, 40)
    eraseStickerImagePath(canvas, image, [{ x: 20, y: 30 }, { x: 80, y: 70 }], 18)
    const text = canvas.getObjects().find(object => object instanceof Textbox)
    text.set({ text: 'Edited text', left: 54, top: 752, angle: -12, opacity: 0.8, fill: '#e12345', visible: false, underline: true })
    text.stickerCustomFill = true
    updateStickerCanvasBackground(canvas, '#abcdef')
    const ids = getStickerLayers(canvas).map(layer => layer.id)
    const saved = captureStickerDesign(canvas)
    assert.equal(JSON.parse(saved).version, 1)
    await restoreStickerDesign(restored, saved)
    const next = restored.getObjects().find(object => object instanceof FabricImage)
    for (const key of ['left', 'top', 'scaleX', 'scaleY', 'angle', 'flipX', 'opacity', 'lockRotation']) assert.equal(next[key], image[key], key)
    assert.deepEqual(next.stickerStroke, image.stickerStroke)
    assert.deepEqual(next.stickerErasedPaths, image.stickerErasedPaths)
    assert.equal(next.stickerEdgeSmoothing, 40)
    const nextText = restored.getObjects().find(object => object instanceof Textbox && object.text === 'Edited text')
    assert.ok(nextText)
    for (const key of ['left', 'top', 'angle', 'opacity', 'fill', 'visible', 'underline']) assert.equal(nextText[key], text[key], key)
    assert.equal(restored.backgroundColor, '#abcdef')
    assert.deepEqual(getStickerLayers(restored).map(layer => layer.id), ids)
    assert.equal(restored.history.length, 1)
    assert.ok(JSON.parse(saved).canvas.objects.find(layer => layer.type === 'Image').src.startsWith('data:image/png'))
  } finally { await canvas.dispose(); await restored.dispose() }
})

test('saving an active multiselection preserves world-space layer positions', async () => {
  const canvas = createStickerCanvas(document.createElement('canvas'))
  const restored = createStickerCanvas(document.createElement('canvas'))
  try {
    const one = new Textbox('ONE', { left: 150, top: 220, width: 160 })
    const two = new Textbox('TWO', { left: 460, top: 510, width: 170 })
    canvas.add(one, two)
    const selection = new ActiveSelection([one, two], { canvas })
    canvas.setActiveObject(selection)
    selection.set({ left: selection.left + 70, top: selection.top - 30, angle: 15, scaleX: 1.2, scaleY: 1.2 })
    const matrices = [one, two].map(object => object.calcTransformMatrix())
    await restoreStickerDesign(restored, captureStickerDesign(canvas))
    restored.getObjects().forEach((object, index) => object.calcTransformMatrix().forEach((value, i) => assert.ok(Math.abs(value - matrices[index][i]) < 0.02)))
    assert.equal(canvas.getActiveObject(), selection, 'saving does not disturb selection')
  } finally { await canvas.dispose(); await restored.dispose() }
})

test('saved design exposes its restored layout before outline preparation and rendering', async () => {
  const canvas = createStickerCanvas(document.createElement('canvas'))
  const restored = createStickerCanvas(document.createElement('canvas'))
  try {
    const source = document.createElement('canvas'); source.width = source.height = 32
    source.getContext('2d').fillRect(0, 0, 32, 32)
    const image = await initializeStickerCanvas(canvas, source.toDataURL(), { topText: 'SAVED' })
    image.set({ left: 321, top: 654, scaleX: 3, scaleY: 2 })
    let layout
    await restoreStickerDesign(restored, captureStickerDesign(canvas), { onLayoutReady: next => {
      layout = { left: next.left, top: next.top, scaleX: next.scaleX, rendering: restored.renderOnAddRemove }
    } })
    assert.deepEqual(layout, { left: 321, top: 654, scaleX: 3, rendering: false })
    assert.equal(restored.renderOnAddRemove, true)
  } finally { await canvas.dispose(); await restored.dispose() }
})

test('library image preview reflects erasure and is independent of viewport zoom', async () => {
  const { captureStickerImagePreview } = await import('../src/index.ts')
  const canvas = createStickerCanvas(document.createElement('canvas'))
  try {
    const source=document.createElement('canvas');source.width=source.height=64
    source.getContext('2d').fillRect(0,0,64,64)
    const image=await initializeStickerCanvas(canvas,source.toDataURL(),{topText:'TITLE',bottomText:'TEXT'})
    const outlinedPreview=captureStickerImagePreview(canvas)
    updateStickerStroke(canvas,image,{enabled:false})
    const before=captureStickerImagePreview(canvas)
    assert.equal(before,outlinedPreview,'editor outlines must not enter the card preview')
    const decoded=await FabricImage.fromURL(before)
    assert.equal(decoded.width,1024);assert.equal(decoded.height,1024)
    decoded.dispose()
    eraseStickerImagePath(canvas,image,[{x:0,y:0},{x:20,y:0}],12)
    const after=captureStickerImagePreview(canvas)
    assert.notEqual(after,before)
    canvas.setViewportTransform([2,0,0,2,100,80])
    assert.equal(captureStickerImagePreview(canvas),after)
  } finally { await canvas.dispose() }
})


test('saved card previews retain native detail up to the editor resolution', async () => {
  const { captureStickerImagePreview } = await import('../src/index.ts')
  const canvas = createStickerCanvas(document.createElement('canvas'))
  try {
    const source = document.createElement('canvas')
    source.width = source.height = 1024
    const context = source.getContext('2d')
    context.fillStyle = '#000000'
    context.fillRect(0, 0, 1024, 1024)
    context.fillStyle = '#ffffff'
    for (let x = 0; x < 1024; x += 2) context.fillRect(x, 0, 1, 1024)
    const image = await initializeStickerCanvas(canvas, source.toDataURL(), { imageStroke: { enabled: false } })
    image.set({ left: 0, top: 0, originX: 'left', originY: 'top', scaleX: 1, scaleY: 1 })
    const preview = await FabricImage.fromURL(captureStickerImagePreview(canvas))
    assert.equal(preview.width, 1024, 'a native-resolution photo must not be reduced to a thumbnail')
    const decoded = document.createElement('canvas')
    decoded.width = decoded.height = 1024
    decoded.getContext('2d').drawImage(preview.getElement(), 0, 0)
    const pixels = decoded.getContext('2d').getImageData(0, 0, 2, 1).data
    assert.equal(pixels[0], 255)
    assert.equal(pixels[4], 0, 'one-pixel photo detail survives preview generation')
    await preview.dispose()
  } finally { await canvas.dispose() }
})


test('saved photo preview preserves canvas position, scale and opacity', async () => {
  const { captureStickerImagePreview } = await import('../src/index.ts')
  const canvas = createStickerCanvas(document.createElement('canvas'))
  try {
    const source = document.createElement('canvas')
    source.width = source.height = 64
    source.getContext('2d').fillRect(0, 0, 64, 64)
    const image = await initializeStickerCanvas(canvas, source.toDataURL(), {})
    image.set({ left: 120, top: 300, originX: 'left', originY: 'top', scaleX: 128 / image.width, scaleY: 128 / image.height, opacity: 0.5 })
    const preview = await FabricImage.fromURL(captureStickerImagePreview(canvas))
    const decoded = document.createElement('canvas')
    decoded.width = decoded.height = 1024
    const context = decoded.getContext('2d')
    context.drawImage(preview.getElement(), 0, 0)
    const alpha = (x, y) => context.getImageData(x, y, 1, 1).data[3]
    assert.equal(alpha(140, 200), 0, 'space above the moved photo remains empty')
    assert.equal(alpha(100, 340), 0, 'left canvas offset remains empty')
    assert.ok(Math.abs(alpha(140, 340) - 128) <= 1, 'photo keeps its canvas opacity')
    assert.ok(alpha(240, 420) > 0, 'scaled photo extends to its canvas bounds')
    assert.equal(alpha(280, 420), 0, 'preview does not refit or enlarge the photo')
    await preview.dispose()
  } finally { await canvas.dispose() }
})
