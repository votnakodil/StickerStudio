import assert from 'node:assert/strict'
import { test } from 'node:test'
import { FabricImage, getEnv, setEnv } from 'fabric'
import { getEnv as getNodeEnv } from 'fabric/node'
import { createStickerCanvas, addStickerText, getStickerLayers, undo } from '@sticker-studio/editor'
import { useEditorStore } from '../src/features/editor/model/editorStore.ts'

setEnv(getNodeEnv())
globalThis.document = getEnv().document

test('eraser starts with a 25 px brush in both the engine and settings', async () => {
  const canvas = createStickerCanvas(document.createElement('canvas'))
  try {
    assert.equal(canvas.eraserSize, 25)
    assert.equal(useEditorStore.getState().eraserSize, 25)
    useEditorStore.getState().setCanvas(canvas)
    assert.equal(canvas.eraserSize, 25)
  } finally {
    useEditorStore.getState().setCanvas(null)
    await canvas.dispose()
  }
})

test('clicking active Eraser returns to the previous layer after undo replaces its objects', async () => {
  const canvas = createStickerCanvas(document.createElement('canvas'))
  try {
    const source = document.createElement('canvas')
    source.width = source.height = 32
    const image = new FabricImage(source)
    canvas.add(image)
    const text = addStickerText(canvas, 'KEEP ME')
    canvas.setActiveObject(text)
    useEditorStore.getState().setCanvas(canvas)
    const previousId = getStickerLayers(canvas).find(layer => layer.selected).id
    useEditorStore.getState().selectTool('eraser')
    assert.equal(canvas.editorTool, 'eraser')
    assert.equal(canvas.getActiveObject(), image)
    addStickerText(canvas, 'NEW')
    await undo(canvas)
    useEditorStore.getState().selectTool('eraser')
    assert.equal(useEditorStore.getState().activeTool, 'move')
    assert.equal(canvas.editorTool, 'move')
    assert.equal(getStickerLayers(canvas).find(layer => layer.selected).id, previousId)
    assert.equal(canvas.getActiveObject().text, 'KEEP ME')
  } finally {
    useEditorStore.getState().setCanvas(null)
    await canvas.dispose()
  }
})
