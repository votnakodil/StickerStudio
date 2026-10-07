import { getTextFrameStrokeWidth, changeTextFrameDimension } from './textFrameGeometry'
import { getStickerTextAutoSize } from './textSettings'
import { controlsUtils } from 'fabric'
import type { Textbox } from 'fabric'
import type { StickerTextbox, StickerCanvas } from '../types'
import { fitStickerText, fitTextFrameAfterWidthChange, MIN_TEXT_FRAME_HEIGHT, updateTextClip, getTextFrameHeight } from './textLayout'
import type { AlignmentGuide } from '../alignmentGuides'
import { RESIZE_SNAP_DISTANCE } from '../canvas/controls'

export const changeStickerTextWidth: typeof controlsUtils.changeObjectWidth = (_event, transform, x, y) => {
  const text = transform.target as StickerTextbox
  if (!getStickerTextAutoSize(text)) return changeTextFrameDimension('width', transform, x, y)
  const point = controlsUtils.getLocalPoint(transform, transform.originX, transform.originY, x, y)
  const origin = typeof transform.originX === 'number' ? transform.originX - 0.5
    : transform.originX === 'left' ? -0.5 : transform.originX === 'right' ? 0.5 : 0
  if (origin !== 0 && (origin > 0 ? point.x >= 0 : point.x <= 0)) return false
  const padding = getTextFrameStrokeWidth(text) / (text.strokeUniform ? text.scaleX : 1)
  const width = Math.max(1, Math.abs(point.x * (origin === 0 ? 2 : 1) / text.scaleX) - padding)
  const changed = Math.abs(text.width - width) > 0.01
  text._set('width', width)
  text.stickerFrameWidth = width
  return changed
}

export const resizeStickerTextWidth = (
  eventData: Parameters<typeof controlsUtils.changeObjectWidth>[0],
  transform: Parameters<typeof controlsUtils.changeObjectWidth>[1],
  x: number,
  y: number,
) => {
  const text = transform.target as StickerTextbox
  const anchor = text.getPointByOrigin(transform.originX, 'top')
  const changed = changeStickerTextWidth(eventData, transform, x, y)
  if (!changed) return false

  const frameWidth = text.width
  if (getStickerTextAutoSize(text)) fitStickerText(text, frameWidth)
  else {
    text.initDimensions()
    fitTextFrameAfterWidthChange(text)
  }
  text.setPositionByOrigin(anchor, transform.originX, 'top')
  text.setCoords()
  return true
}

export const resizeStickerTextHeight =
  controlsUtils.wrapWithFixedAnchor(
    (
      _eventData,
      transform,
      x,
      y,
    ) => {
      const text =
        transform.target as StickerTextbox

      const changed =
        changeTextFrameDimension(
          'height',
          transform,
          x,
          y,
        )

      text.stickerFrameHeight =
        Math.max(
          MIN_TEXT_FRAME_HEIGHT,
          text.height,
        )

      text.set(
        'height',
        text.stickerFrameHeight,
      )

      if (getStickerTextAutoSize(text)) fitStickerText(text)
      else updateTextClip(text)

      return changed
    },
  )

export const resizeStickerTextFrame =
  controlsUtils.wrapWithFixedAnchor(
    (
      eventData,
      transform,
      x,
      y,
    ) => {
      const text =
        transform.target as StickerTextbox

      const previousFrameHeight =
        getTextFrameHeight(text)

      const widthChanged =
        changeStickerTextWidth(
          eventData,
          transform,
          x,
          y,
        )

      const frameWidth = text.width
      if (!getStickerTextAutoSize(text)) text.initDimensions()

      text.set(
        'height',
        previousFrameHeight,
      )

      const heightChanged =
        changeTextFrameDimension(
          'height',
          transform,
          x,
          y,
        )

      text.stickerFrameHeight =
        Math.max(
          MIN_TEXT_FRAME_HEIGHT,
          text.height,
        )

      text.set(
        'height',
        text.stickerFrameHeight,
      )

      if (getStickerTextAutoSize(text)) fitStickerText(text, frameWidth)
      else updateTextClip(text)

      return (
        widthChanged ||
        heightChanged
      )
    },
  )

export function snapStickerTextFrame(
  canvas: StickerCanvas,
  object: Textbox,
  corner: string,
): AlignmentGuide[] {
  if (object.angle !== 0 || object.scaleX <= 0 || object.scaleY <= 0) return []

  const rightSide = corner === 'mr' || corner === 'tr' || corner === 'br'
  const leftSide = corner === 'ml' || corner === 'tl' || corner === 'bl'
  const bottomSide = corner === 'mb' || corner === 'bl' || corner === 'br'
  const topSide = corner === 'mt' || corner === 'tl' || corner === 'tr'
  if (!rightSide && !leftSide && !bottomSide && !topSide) return []

  object.setCoords()
  const bounds = object.getBoundingRect()
  const destinationX = rightSide ? canvas.getWidth() : 0
  const destinationY = bottomSide ? canvas.getHeight() : 0
  const deltaX = destinationX - (rightSide ? bounds.left + bounds.width : bounds.left)
  const deltaY = destinationY - (bottomSide ? bounds.top + bounds.height : bounds.top)
  const snapX = (rightSide || leftSide) && Math.abs(deltaX) <= RESIZE_SNAP_DISTANCE
  const snapY = (bottomSide || topSide) && Math.abs(deltaY) <= RESIZE_SNAP_DISTANCE
  if (!snapX && !snapY) return []

  const fitHeight = corner === 'ml' || corner === 'mr'
  const fixedX = rightSide ? 'left' : leftSide ? 'right' : object.originX
  const fixedY = bottomSide ? 'top' : topSide ? 'bottom' : fitHeight ? 'top' : object.originY
  const fixedPoint = object.getPointByOrigin(fixedX, fixedY)
  const frameHeight = getTextFrameHeight(object as StickerTextbox)
  if (snapX) {
    const width = Math.max(1, object.width + (rightSide ? deltaX : -deltaX) / object.scaleX)
    ;(object as StickerTextbox).stickerFrameWidth = width
    if (getStickerTextAutoSize(object)) object._set('width', width)
    else object.set('width', width)
    if (!getStickerTextAutoSize(object)) object.initDimensions()
  }
  if (fitHeight) {
    fitTextFrameAfterWidthChange(object as StickerTextbox)
  } else {
    const height = Math.max(MIN_TEXT_FRAME_HEIGHT,
      frameHeight + (snapY ? (bottomSide ? deltaY : -deltaY) / object.scaleY : 0))
    ;(object as StickerTextbox).stickerFrameHeight = height
    object.set('height', height)
    if (getStickerTextAutoSize(object)) fitStickerText(object as StickerTextbox)
    else updateTextClip(object as StickerTextbox)
  }
  object.setPositionByOrigin(fixedPoint, fixedX, fixedY)
  object.setCoords()

  return [
    ...(snapX ? [{ orientation: 'vertical' as const, position: destinationX, source: rightSide ? 'end' as const : 'start' as const }] : []),
    ...(snapY ? [{ orientation: 'horizontal' as const, position: destinationY, source: bottomSide ? 'end' as const : 'start' as const }] : []),
  ]
}
