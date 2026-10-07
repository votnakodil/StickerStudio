import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getEnv, setEnv } from 'fabric'
import { getEnv as nodeEnv } from 'fabric/node'
import { createStickerCanvas, initializeStickerCanvas, setEditorTool, paintQuickSelection, hasQuickSelection, setQuickSelectionAutoErase } from '../src/index.ts'
setEnv(nodeEnv()); globalThis.document = getEnv().document

test('Space drag pans from editing tools without moving layers, erasing or clearing selection', async () => {
  const canvas = createStickerCanvas(document.createElement('canvas'))
  const view = document.defaultView
  const key = type => view.dispatchEvent(new view.KeyboardEvent(type, { code: 'Space', key: ' ', cancelable: true }))
  const mouse = (target, type, x, y) => target.dispatchEvent(new view.MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true, cancelable: true }))
  try {
    const source = document.createElement('canvas'); source.width = source.height = 64
    source.getContext('2d').fillRect(0, 0, 64, 64)
    const image = await initializeStickerCanvas(canvas, source.toDataURL(), { topText: 'TOP', bottomText: 'BOTTOM' })
    canvas.setActiveObject(image)
    for (const tool of ['move', 'eraser', 'quick-selection']) {
      setEditorTool(canvas, tool)
      if (tool === 'quick-selection') { paintQuickSelection(canvas, image, 30, 30); setQuickSelectionAutoErase(canvas, true) }
      const before = [...canvas.viewportTransform], matrix = image.calcTransformMatrix(), history = canvas.historyIndex
      key('keydown'); assert.equal(canvas.defaultCursor, 'grab')
      mouse(canvas.upperCanvasEl, 'mousedown', 100, 100)
      mouse(document, 'mousemove', 130, 120)
      mouse(document, 'mouseup', 130, 120)
      key('keyup')
      assert.equal(canvas.viewportTransform[4], before[4] + 30)
      assert.equal(canvas.viewportTransform[5], before[5] + 20)
      assert.equal(canvas.editorTool, tool); assert.equal(canvas.getActiveObject(), image)
      assert.deepEqual(image.calcTransformMatrix(), matrix)
      assert.equal(canvas.historyIndex, history)
      assert.equal(image.stickerErasedPaths?.length ?? 0, 0)
      assert.equal(image.stickerErasedRegions?.length ?? 0, 0)
      if (tool === 'quick-selection') assert.equal(hasQuickSelection(canvas), true)
    }
    key('keydown'); mouse(canvas.upperCanvasEl, 'mousedown', 0, 0)
    view.dispatchEvent(new view.Event('blur'))
    const before = [...canvas.viewportTransform]
    mouse(document, 'mousemove', 200, 100)
    assert.deepEqual(canvas.viewportTransform, before, 'losing window focus stops panning')
    const input = document.createElement('input'); document.body.append(input)
    const event = new view.KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true, cancelable: true })
    input.dispatchEvent(event); assert.equal(event.defaultPrevented, false, 'Space still works in fields')
    input.remove()
  } finally { await canvas.dispose() }
})
