import type { StickerCanvas, StickerTextbox, StickerImage } from '../types'
import { Textbox, FabricImage } from 'fabric'
import { normalizeStroke } from '../stroke/stroke'
import { configureStickerTexts } from '../text/configureText'
import { setStickerTextColor } from '../text/textOperations'
import { notifyCanvasBackgroundChanged } from '../canvas/backgroundEvents'
import { layerId, restoreLayerId } from '../layers/layerIdentity'

export function serializeCanvas(canvas: StickerCanvas) {
  const objects = canvas.getObjects()
  const properties = [
    'lockMovementX', 'lockMovementY', 'lockScalingX', 'lockScalingY', 'lockRotation', 'lockSkewingX', 'lockSkewingY',
    'stickerAutoSize', 'stickerMaxFontSize', 'stickerStrokeFontSize',
    'stickerFrameStrokeWidth', 'stickerFrameWidth', 'stickerFrameHeight', 'stickerCustomFill',
    'stickerVerticalAlign', 'stickerStroke', 'stickerEdgeSmoothing', 'stickerErasedPaths', 'stickerErasedRegions',
  ]
  return JSON.stringify({
    ...canvas.toObject(properties),
    objects: objects.map(object => ({ ...object.toObject(properties), stickerLayerId: layerId(object) })),
  })
}

export function saveHistory(
  canvas: StickerCanvas,
) {
  if (
    canvas.isRestoringHistory
  ) {
    return
  }

  const serialized =
    serializeCanvas(canvas)

  const current =
    canvas.history[
      canvas.historyIndex
    ]

  if (
    serialized === current
  ) {
    return
  }

  canvas.history =
    canvas.history.slice(
      0,
      canvas.historyIndex + 1,
    )

  canvas.history.push(
    serialized,
  )

  canvas.historyIndex =
    canvas.history.length - 1
}

export async function restoreHistory(
  canvas: StickerCanvas,
  serialized: string,
  beforeRender?: () => Promise<void>,
) {
  canvas.isRestoringHistory = true

  try {
    await canvas.loadFromJSON(
      JSON.parse(serialized),
      (
        serializedObject,
        instance,
      ) => {
        if (instance) restoreLayerId(instance, (serializedObject as { stickerLayerId?: unknown }).stickerLayerId)
        if (instance instanceof Textbox || instance instanceof FabricImage) {
          const stroke = (serializedObject as { stickerStroke?: unknown }).stickerStroke
          ;(instance as StickerTextbox | StickerImage).stickerStroke = normalizeStroke(stroke)
        }
        if (
          instance instanceof
          Textbox
        ) {
          const frameHeight =
            (
              serializedObject as {
                stickerFrameHeight?:
                  unknown
              }
            )
              .stickerFrameHeight

          if (
            typeof frameHeight ===
            'number'
          ) {
            ;(
              instance as
                StickerTextbox
            ).stickerFrameHeight =
              frameHeight
          }

          const verticalAlign = (serializedObject as { stickerVerticalAlign?: unknown }).stickerVerticalAlign
          if (verticalAlign === 'top' || verticalAlign === 'middle' || verticalAlign === 'bottom') {
            ;(instance as StickerTextbox).stickerVerticalAlign = verticalAlign
          }
        }
      },
    )

    configureStickerTexts(
      canvas,
    )
    if (canvas.editorTool === 'eraser') {
      const image = canvas.getObjects().findLast(object => object instanceof FabricImage && object.visible)
      if (image) canvas.setActiveObject(image)
    }
    setStickerTextColor(canvas, canvas.stickerTextColor)
    await beforeRender?.()
  } finally {
    canvas.isRestoringHistory =
      false
  }

  canvas.requestRenderAll()
  notifyCanvasBackgroundChanged(canvas)
}

export async function undo(
  canvas: StickerCanvas,
) {
  if (
    canvas.historyIndex <= 0
  ) {
    return
  }

  canvas.historyIndex -= 1

  await restoreHistory(
    canvas,
    canvas.history[
      canvas.historyIndex
    ],
  )
}

export async function redo(
  canvas: StickerCanvas,
) {
  if (
    canvas.historyIndex >=
    canvas.history.length - 1
  ) {
    return
  }

  canvas.historyIndex += 1

  await restoreHistory(
    canvas,
    canvas.history[
      canvas.historyIndex
    ],
  )
}
