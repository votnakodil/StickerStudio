import type { StickerCanvas, StickerTextbox, StickerImage } from '../types'
import { Textbox, FabricImage } from 'fabric'
import { normalizeStroke } from '../stroke/stroke'
import { configureStickerTexts } from '../text/configureText'
import { setStickerTextColor } from '../text/textOperations'
import { notifyCanvasBackgroundChanged } from '../canvas/backgroundEvents'

export function serializeCanvas(canvas: StickerCanvas) {
  return JSON.stringify(
    canvas.toObject([
      'stickerAutoSize',
      'stickerMaxFontSize',
      'stickerStrokeFontSize',
      'stickerFrameWidth',
      'stickerFrameHeight',
      'stickerCustomFill',
      'stickerVerticalAlign',
      'stickerStroke',
    ]),
  )
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
) {
  canvas.isRestoringHistory = true

  try {
    await canvas.loadFromJSON(
      JSON.parse(serialized),
      (
        serializedObject,
        instance,
      ) => {
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
    setStickerTextColor(canvas, canvas.stickerTextColor)
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
