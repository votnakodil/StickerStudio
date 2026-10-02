import { Canvas, FabricImage, Textbox, Point } from 'fabric'
import type { StickerCanvas, StickerTextbox, EditorTool } from '../types'
import { palette } from '@sticker-studio/theme'
import { serializeCanvas, saveHistory } from '../history/history'
import { configureStickerImage } from '../images/imageControls'
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

  canvas.history = [
    serializeCanvas(
      canvas,
    ),
  ]

  canvas.historyIndex = 0

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

  let isPanning = false
  let lastPointerX = 0
  let lastPointerY = 0

  canvas.on(
    'mouse:down',
    (event) => {
      const pointerEvent =
        event.e as MouseEvent

      const shouldPan =
        canvas.editorTool ===
          'hand' ||
        pointerEvent.altKey

      if (!shouldPan) {
        return
      }

      isPanning = true

      lastPointerX =
        pointerEvent.clientX

      lastPointerY =
        pointerEvent.clientY

      canvas.selection =
        false

      canvas.defaultCursor =
        'grabbing'

      canvas.setCursor(
        'grabbing',
      )

      pointerEvent.preventDefault()
    },
  )

  canvas.on(
    'mouse:move',
    (event) => {
      if (!isPanning) {
        return
      }

      const pointerEvent =
        event.e as MouseEvent

      const deltaX =
        pointerEvent.clientX -
        lastPointerX

      const deltaY =
        pointerEvent.clientY -
        lastPointerY

      canvas.relativePan(
        new Point(
          deltaX,
          deltaY,
        ),
      )

      lastPointerX =
        pointerEvent.clientX

      lastPointerY =
        pointerEvent.clientY

      pointerEvent.preventDefault()
    },
  )

  canvas.on(
    'mouse:up',
    () => {
      if (!isPanning) {
        return
      }

      isPanning = false

      if (
        canvas.editorTool ===
        'hand'
      ) {
        canvas.defaultCursor =
          'grab'

        canvas.setCursor(
          'grab',
        )
      } else {
        canvas.selection =
          true

        canvas.defaultCursor =
          'default'

        canvas.setCursor(
          'default',
        )
      }
    },
  )

  return canvas
}

export function setEditorTool(
  canvas: StickerCanvas,
  tool: EditorTool,
) {
  canvas.editorTool = tool

  if (tool === 'hand') {
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
