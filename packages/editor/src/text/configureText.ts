import { configureTextFrameGeometry } from './textFrameGeometry'
import { getStickerTextAutoSize } from './textSettings'
import type { StickerTextbox, StickerCanvas } from '../types'
import { getTextFrameHeight, getTextContentHeight, fitStickerText, fitTextFrameAfterWidthChange, relayoutStickerText, renderOverflowIndicator, isTextOverflowing, showAllText } from './textLayout'
import { DEFAULT_STROKE, applyTextStroke } from '../stroke/stroke'
import { createResizeControl, keepControlsInsideCanvas } from '../canvas/controls'
import { resizeStickerTextFrame, resizeStickerTextWidth, resizeStickerTextHeight } from './textControls'
import { Control, Textbox } from 'fabric'

export function configureStickerText(
  text: StickerTextbox,
) {
  if (!text.stickerDistributedAlignmentInstalled) {
    const initDimensions = text.initDimensions.bind(text)
    const enlargeSpaces = text.enlargeSpaces.bind(text)
    const originalSpacing = text.charSpacing
    text.initDimensions = () => {
      // A nonzero tracking value makes Fabric draw/export individual graphemes.
      // The actual spacing is calculated independently for each visual line below.
      text.charSpacing = text.textAlign === 'justify' ? 0.000001 : originalSpacing
      initDimensions()
    }
    text.enlargeSpaces = () => {
      if (text.textAlign !== 'justify') {
        enlargeSpaces()
        return
      }
      for (let lineIndex = 0; lineIndex < text._textLines.length; lineIndex += 1) {
        const line = text._textLines[lineIndex]
        const naturalWidth = text.getLineWidth(lineIndex)
        if (line.length < 2 || naturalWidth >= text.width) continue
        const gap = (text.width - naturalWidth) / (line.length - 1)
        const bounds = text.__charBounds[lineIndex]
        for (let index = 0; index <= line.length; index += 1) {
          const bound = bounds[index]
          bound.left += Math.min(index, line.length - 1) * gap
          if (index < line.length - 1) {
            bound.width += gap
            bound.kernedWidth += gap
          }
        }
      }
    }
    text.stickerDistributedAlignmentInstalled = true
  }

  text.stickerFrameHeight =
    getTextFrameHeight(text)

  text.stickerFrameWidth ??= text.width
  text.stickerAutoSize ??= true
  text.stickerMaxFontSize ??= text.fontSize
  text.stickerStrokeFontSize ??= text.stickerMaxFontSize
  text.stickerVerticalAlign ??= 'top'
  text.stickerStroke ??= { ...DEFAULT_STROKE }
  applyTextStroke(text)
  configureTextFrameGeometry(text)
  if (!text.stickerTopOffsetInstalled) {
    const originalTopOffset = text._getTopOffset
    text._getTopOffset = () => {
      const freeSpace = getTextFrameHeight(text) - getTextContentHeight(text)
      const factor = text.stickerVerticalAlign === 'bottom' ? 1 : text.stickerVerticalAlign === 'middle' ? 0.5 : 0
      return originalTopOffset.call(text) + freeSpace * factor
    }
    text.stickerTopOffsetInstalled = true
  }

  if (!text.stickerEditingLayoutInstalled) {
    const updateFromTextArea = text.updateFromTextArea.bind(text)
    text.updateFromTextArea = () => {
      const frameTop = text.getPointByOrigin(text.originX, 'top')
      const frameWidth = text.stickerFrameWidth ?? text.width
      updateFromTextArea()
      if (getStickerTextAutoSize(text)) fitStickerText(text, frameWidth)
      else fitTextFrameAfterWidthChange(text, frameWidth)
      text.setPositionByOrigin(frameTop, text.originX, 'top')
      text.setCoords()
      text.updateTextareaPosition()
    }
    text.on('editing:exited', () => {
      relayoutStickerText(text)
      text.setCoords()
      text.canvas?.requestRenderAll()
    })
    text.stickerEditingLayoutInstalled = true
  }

  text.controls = {
    ...text.controls,

    tl: createResizeControl(
      -0.5,
      -0.5,
      'nwse-resize',
      resizeStickerTextFrame,
    ),

    tr: createResizeControl(
      0.5,
      -0.5,
      'nesw-resize',
      resizeStickerTextFrame,
    ),

    bl: createResizeControl(
      -0.5,
      0.5,
      'nesw-resize',
      resizeStickerTextFrame,
    ),

    br: createResizeControl(
      0.5,
      0.5,
      'nwse-resize',
      resizeStickerTextFrame,
    ),

    ml: createResizeControl(
      -0.5,
      0,
      'ew-resize',
      resizeStickerTextWidth,
    ),

    mr: createResizeControl(
      0.5,
      0,
      'ew-resize',
      resizeStickerTextWidth,
    ),

    mt: createResizeControl(
      0,
      -0.5,
      'ns-resize',
      resizeStickerTextHeight,
    ),

    mb: createResizeControl(
      0,
      0.5,
      'ns-resize',
      resizeStickerTextHeight,
    ),

    overflow: new Control({
      x: 0,
      y: 0.5,

      cursorStyle: 'pointer',

      visible: false,

      render:
        renderOverflowIndicator,

      mouseUpHandler: (
        _eventData,
        transform,
      ) => {
        const target =
          transform.target as StickerTextbox

        if (
          !isTextOverflowing(
            target,
          )
        ) {
          return false
        }

        showAllText(target)

        target.canvas?.fire(
          'object:modified',
          {
            target,
          },
        )

        return true
      },
    }),
  }

  keepControlsInsideCanvas(text)

  relayoutStickerText(text)

  return text
}

export function configureStickerTexts(
  canvas: StickerCanvas,
) {
  canvas
    .getObjects()
    .filter(
      (object) =>
        object instanceof Textbox,
    )
    .forEach((object) => {
      configureStickerText(
        object as StickerTextbox,
      )
    })
}
