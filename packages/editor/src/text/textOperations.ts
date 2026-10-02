import { getStickerTextAutoSize } from './textSettings'
import { configureStickerText } from './configureText'
import { Textbox } from 'fabric'
import type { StickerCanvas, StickerTextbox, StickerTextStyle } from '../types'
import { normalizeStickerFontWeight } from '../fontWeights'
import { getStickerStroke, applyTextStroke } from '../stroke/stroke'
import { relayoutStickerText, fitStickerText, fitTextFrameAfterWidthChange } from './textLayout'

export function createStickerText(text: string, left: number, top: number, color: string) {
  return configureStickerText(
    new Textbox(text, {
      left,
      top,
      originX: 'center',
      originY: 'center',
      width: 400,
      fontSize: 72,
      fontWeight: 700,
      fill: color,
      textAlign: 'center',
    }),
  )
}

export function setStickerTextColor(canvas: StickerCanvas, color: string) {
  canvas.stickerTextColor = color
  canvas.getObjects().forEach((object) => {
    if (object instanceof Textbox && !(object as StickerTextbox).stickerCustomFill) object.set('fill', color)
  })
  canvas.requestRenderAll()
}

export function updateStickerTextStyle(
  canvas: StickerCanvas,
  text: Textbox,
  changes: Partial<StickerTextStyle>,
) {
  if (!canvas.getObjects().includes(text)) return
  if (changes.fill !== undefined) (text as StickerTextbox).stickerCustomFill = true
  const frameTop = text.getPointByOrigin(text.originX, 'top')
  const frameWidth = (text as StickerTextbox).stickerFrameWidth ?? text.width
  if (changes.fontFamily !== undefined || changes.fontWeight !== undefined) {
    changes = { ...changes, fontWeight: normalizeStickerFontWeight(
      changes.fontFamily ?? text.fontFamily,
      changes.fontWeight ?? text.fontWeight,
    ) }
  }
  if (changes.stickerAutoSize === false) {
    const object = text as StickerTextbox
    object.stickerStroke = getStickerStroke(text)
    object.stickerStrokeFontSize = text.fontSize
  }
  if (changes.fontSize !== undefined) (text as StickerTextbox).stickerMaxFontSize = changes.fontSize
  if (changes.stickerAutoSize === true) {
    (text as StickerTextbox).stickerMaxFontSize = text.fontSize
    ;(text as StickerTextbox).stickerStrokeFontSize = text.fontSize
  }
  text.set(changes)
  relayoutStickerText(text as StickerTextbox)
  if (getStickerTextAutoSize(text)) {
    fitStickerText(text as StickerTextbox, frameWidth)
    text.setPositionByOrigin(frameTop, text.originX, 'top')
    text.setCoords()
  } else if (['fontSize', 'fontFamily', 'fontWeight', 'fontStyle'].some((key) => key in changes)) {
    fitTextFrameAfterWidthChange(text as StickerTextbox, frameWidth)
    text.setPositionByOrigin(frameTop, text.originX, 'top')
    text.setCoords()
  }
  applyTextStroke(text as StickerTextbox)
  canvas.requestRenderAll()
  canvas.fire('object:modified', { target: text })
}

export function addStickerText(
  canvas: StickerCanvas,
  text = 'NEW TEXT',
) {
  const textCount =
    canvas
      .getObjects()
      .filter(
        (object) =>
          object instanceof
          Textbox,
      )
      .length

  const offset =
    textCount * 28

  const textObject = createStickerText(text, 512 + offset, 512 + offset, canvas.stickerTextColor)

  canvas.add(
    textObject,
  )

  canvas.setActiveObject(
    textObject,
  )

  canvas.requestRenderAll()

  return textObject
}
