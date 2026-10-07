import { installCanvasPanning } from './canvasPanning'
import { Canvas, FabricImage, Textbox } from 'fabric'
import type { StickerCanvas, StickerTextbox, EditorTool } from '../types'
import { palette } from '@sticker-studio/theme'
import { serializeCanvas, saveHistory } from '../history/history'
import { configureStickerImage } from '../images/imageControls'
import { installImageEraser, refreshEraserCursor } from '../images/imageEraser'
import { installQuickSelection, clearQuickSelection } from '../images/quickSelection'
import { relayoutStickerText } from '../text/textLayout'

export function createStickerCanvas(
  element: HTMLCanvasElement,
) {
  const canvas = new Canvas(
    element,
    {
      width: 1024,
      height: 1024,
      backgroundColor:
        'transparent',
      preserveObjectStacking:
        true,
      selection: true,
    },
  ) as StickerCanvas

  canvas.history = []
  canvas.historyIndex = -1

  canvas.isRestoringHistory =
    false

  canvas.editorTool =
    'move'
  canvas.stickerTextColor = palette.white
  canvas.eraserSize = 25

  canvas.history = [
    serializeCanvas(
      canvas,
    ),
  ]

  canvas.historyIndex = 0

  const drawControls = canvas.drawControls.bind(canvas)
  canvas.drawControls = (context) => {
    if (canvas.editorTool !== 'quick-selection') drawControls(context)
  }

  const styleSelection = () => {
    const active = canvas.getActiveObject()
    if (!active) return
    active.set({
      borderColor: palette.focusBlue,
      borderOpacityWhenMoving: 1,
      borderScaleFactor: 2,
      cornerColor: palette.focusBlue,
      cornerStrokeColor: palette.white,
      transparentCorners: false,
    })
    canvas.requestRenderAll()
  }
  canvas.on('selection:created', styleSelection)
  canvas.on('selection:updated', styleSelection)

  canvas.on(
    'object:added',
    (event) => {
      if (event.target instanceof FabricImage) configureStickerImage(event.target)
      saveHistory(canvas)
    },
  )

  canvas.on(
    'object:modified',
    () => {
      saveHistory(canvas)
    },
  )

  canvas.on(
    'object:removed',
    () => {
      saveHistory(canvas)
    },
  )

  canvas.on(
    'text:changed',
    (event) => {
      const target =
        event.target

      if (
        target instanceof
        Textbox
      ) {
        relayoutStickerText(
          target as
            StickerTextbox,
        )

        canvas.requestRenderAll()
      }
    },
  )

  installCanvasPanning(canvas)

  installImageEraser(canvas)
  installQuickSelection(canvas)
  return canvas
}

export function setEditorTool(
  canvas: StickerCanvas,
  tool: EditorTool,
) {
  canvas.editorTool = tool

  if (tool !== 'quick-selection') clearQuickSelection(canvas)
  if (tool === 'eraser' || tool === 'quick-selection') {
    const selected = canvas.getActiveObject()
    if (!(selected instanceof FabricImage)) {
      const image = canvas.getObjects().findLast(object => object instanceof FabricImage && object.visible)
      if (image) canvas.setActiveObject(image)
    }
    canvas.selection = false
    canvas.skipTargetFind = true
    if (tool === 'eraser') refreshEraserCursor(canvas)
    else { canvas.defaultCursor = canvas.hoverCursor = 'crosshair'; canvas.setCursor('crosshair') }
  } else if (tool === 'hand') {
    canvas.discardActiveObject()

    canvas.selection = false
    canvas.skipTargetFind = true

    canvas.defaultCursor =
      'grab'

    canvas.hoverCursor =
      'grab'

    canvas.setCursor(
      'grab',
    )
  } else {
    canvas.selection = true
    canvas.skipTargetFind = false

    canvas.defaultCursor =
      'default'

    canvas.hoverCursor =
      'move'

    canvas.setCursor(
      'default',
    )
  }

  canvas.requestRenderAll()
}
