import { DEFAULT_TEXT_STYLE } from './defaultTextLayers'
import { getStickerTextAutoSize } from './textSettings'
import { configureStickerText } from './configureText'
import { Textbox } from 'fabric'
import type { StickerCanvas, StickerTextbox, StickerTextStyle } from '../types'
import { normalizeStickerFontWeight } from '../fontWeights'
import { getStickerStroke, applyTextStroke } from '../stroke/stroke'
import { relayoutStickerText, fitStickerText, fitTextFrameAfterWidthChange } from './textLayout'

export function createStickerText(text: string, left: number, top: number) {
  const defaults = DEFAULT_TEXT_STYLE
  const object = new Textbox(text, {
    left, top, originX: 'center', originY: 'center',
    width: defaults.width, fontSize: defaults.fontSize,
    fontFamily: defaults.fontFamily, fontWeight: defaults.fontWeight,
    fill: defaults.fill, textAlign: defaults.textAlign,
  }) as StickerTextbox
  object.stickerCustomFill = true
  object.stickerAutoSize = defaults.autoSize
  object.stickerMaxFontSize = defaults.fontSize
  object.stickerStrokeFontSize = defaults.fontSize
  object.stickerFrameHeight = defaults.frameHeight
  object.stickerVerticalAlign = defaults.verticalAlign
  object.stickerStroke = { ...defaults.stroke }
  configureStickerText(object)
  fitStickerText(object, defaults.width)
  return object
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

/** Commit sidebar text editing as one undoable change while retaining its frame. */
export function updateStickerTextContent(canvas: StickerCanvas, text: Textbox, content: string) {
  if (!canvas.getObjects().includes(text) || text.text === content) return
  const object = text as StickerTextbox
  const frameTop = text.getPointByOrigin(text.originX, 'top')
  const frameWidth = object.stickerFrameWidth ?? text.width
  text.set('text', content)
  relayoutStickerText(object)
  if (getStickerTextAutoSize(text)) fitStickerText(object, frameWidth)
  text.setPositionByOrigin(frameTop, text.originX, 'top')
  text.setCoords()
  canvas.fire('object:modified', { target: text })
  canvas.requestRenderAll()
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

  const textObject = createStickerText(text, 512, 512 + offset)

  canvas.add(
    textObject,
  )

  canvas.setActiveObject(
    textObject,
  )

  canvas.requestRenderAll()

  return textObject
}
