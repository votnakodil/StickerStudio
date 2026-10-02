import { getStickerTextAutoSize } from './textSettings'
import type { StickerTextbox } from '../types'
import { palette } from '@sticker-studio/theme'
import { Rect } from 'fabric'
import { applyTextStroke } from '../stroke/stroke'

export const MIN_TEXT_FRAME_HEIGHT = 24

export function getTextFrameHeight(
  text: StickerTextbox,
) {
  return Math.max(
    MIN_TEXT_FRAME_HEIGHT,
    text.stickerFrameHeight ??
      text.height,
  )
}

export function getTextContentHeight(
  text: StickerTextbox,
) {
  return Math.max(
    MIN_TEXT_FRAME_HEIGHT,
    text.calcTextHeight(),
  )
}

export function isTextOverflowing(
  text: StickerTextbox,
) {
  return (
    getTextContentHeight(text) >
    getTextFrameHeight(text) + 0.5
  )
}

export function renderOverflowIndicator(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
) {
  const size = 9

  ctx.save()
  ctx.translate(left, top)

  ctx.fillStyle = palette.white
  ctx.strokeStyle = palette.neutral002
  ctx.lineWidth = 1

  ctx.fillRect(
    -size / 2,
    -size / 2,
    size,
    size,
  )

  ctx.strokeRect(
    -size / 2,
    -size / 2,
    size,
    size,
  )

  ctx.restore()
}

export function updateOverflowIndicator(
  text: StickerTextbox,
) {
  const overflowing =
    isTextOverflowing(text)

  if (text.controls.mb) {
    text.controls.mb.visible =
      !overflowing
  }

  if (text.controls.overflow) {
    text.controls.overflow.visible =
      overflowing
  }
}

export function updateTextClip(
  text: StickerTextbox,
) {
  const frameHeight =
    getTextFrameHeight(text)

  let clip = text.clipPath

  if (!(clip instanceof Rect)) {
    clip = new Rect({
      left: 0,
      top: 0,
      originX: 'center',
      originY: 'center',
      width: text.width,
      height: frameHeight,
    })

    text.clipPath = clip
  } else {
    clip.set({
      left: 0,
      top: 0,
      originX: 'center',
      originY: 'center',
      width: text.width,
      height: frameHeight,
    })
  }

  text.set(
    'height',
    frameHeight,
  )

  text.dirty = true
  text.setCoords()

  updateOverflowIndicator(text)
}

export function relayoutStickerText(
  text: StickerTextbox,
) {
  const frameHeight =
    getTextFrameHeight(text)

  const frameWidth = text.stickerFrameWidth ?? text.width
  text.initDimensions()
  text._set('width', frameWidth)

  text.stickerFrameHeight =
    frameHeight

  text.set(
    'height',
    frameHeight,
  )

  updateTextClip(text)
}


export function fitStickerText(text: StickerTextbox, frameWidth = text.stickerFrameWidth ?? text.width) {
  text.stickerFrameWidth = frameWidth
  const frameHeight = getTextFrameHeight(text)
  const maximum = text.stickerMaxFontSize ?? text.fontSize
  const measure = (size: number) => {
    text.set({ fontSize: size, width: frameWidth })
    text.initDimensions()
    return text.width <= frameWidth + 0.01 && text.calcTextHeight() <= frameHeight + 0.01
  }
  let size = maximum
  if (!measure(maximum)) {
    let low = 0.1
    let high = maximum
    for (let i = 0; i < 16; i += 1) {
      const mid = (low + high) / 2
      if (measure(mid)) low = mid
      else high = mid
    }
    size = low
  }
  measure(size)
  applyTextStroke(text)
  text.set({ width: frameWidth, height: frameHeight })
  text.stickerFrameHeight = frameHeight
  updateTextClip(text)
}

export function fitTextFrameAfterWidthChange(
  text: StickerTextbox,
  frameWidth = text.width,
) {
  text.stickerFrameWidth = frameWidth
  if (getStickerTextAutoSize(text)) {
    fitStickerText(text, frameWidth)
    return
  }
  text._set('width', frameWidth)
  text.stickerFrameHeight = getTextContentHeight(text)
  updateTextClip(text)
}

export function showAllText(
  text: StickerTextbox,
) {
  text.initDimensions()

  const fullHeight =
    getTextContentHeight(text)

  text.stickerFrameHeight =
    fullHeight

  text.set(
    'height',
    fullHeight,
  )

  updateTextClip(text)

  text.canvas?.requestRenderAll()
}
