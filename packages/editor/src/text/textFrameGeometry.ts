import { Point, controlsUtils } from 'fabric'
import type { StickerTextbox } from '../types'

const configured = new WeakSet<StickerTextbox>()
type DimensionOptions = Partial<Pick<StickerTextbox, 'width' | 'height' | 'scaleX' | 'scaleY' | 'skewX' | 'skewY' | 'strokeWidth'>>

export function getTextFrameStrokeWidth(text: StickerTextbox) {
  return text.stickerFrameStrokeWidth ?? text.strokeWidth
}

/** Preserve the opening frame and anchor while the decorative outline changes. */
export function configureTextFrameGeometry(text: StickerTextbox) {
  if (!Number.isFinite(text.stickerFrameStrokeWidth) || (text.stickerFrameStrokeWidth ?? 0) < 0) {
    text.stickerFrameStrokeWidth = text.strokeWidth
  }
  if (configured.has(text)) return
  configured.add(text)
  const transformedDimensions = text._getTransformedDimensions.bind(text)
  const cacheDimensions = text._getCacheCanvasDimensions.bind(text)
  text._getTransformedDimensions = (options: DimensionOptions = {}) => transformedDimensions({ ...options, strokeWidth: getTextFrameStrokeWidth(text) })
  text._getNonTransformedDimensions = () => new Point(text.width, text.height).scalarAdd(getTextFrameStrokeWidth(text))
  text._getCacheCanvasDimensions = () => {
    const cache = cacheDimensions()
    const paint = transformedDimensions({ skewX: 0, skewY: 0 })
    const frame = text._getTransformedDimensions({ skewX: 0, skewY: 0 })
    const scale = text.getTotalObjectScaling()
    const paddingX = Math.max(0, (paint.x - frame.x) * scale.x / text.scaleX)
    const paddingY = Math.max(0, (paint.y - frame.y) * scale.y / text.scaleY)
    return { ...cache, width: cache.width + Math.ceil(paddingX), height: cache.height + Math.ceil(paddingY), x: cache.x + paddingX, y: cache.y + paddingY }
  }
}

/** Fabric's resize handler subtracts the frame inset rather than the paint stroke. */
export function changeTextFrameDimension(dimension: 'width' | 'height', transform: Parameters<typeof controlsUtils.changeObjectWidth>[1], x: number, y: number) {
  const text = transform.target as StickerTextbox
  const axis = dimension === 'width' ? 'x' : 'y'
  const scale = dimension === 'width' ? text.scaleX : text.scaleY
  const origin = dimension === 'width' ? transform.originX : transform.originY
  const originOffset = typeof origin === 'number' ? origin - 0.5 : origin === 'left' || origin === 'top' ? -0.5 : origin === 'right' || origin === 'bottom' ? 0.5 : 0
  const point = controlsUtils.getLocalPoint(transform, transform.originX, transform.originY, x, y)[axis]
  if (originOffset !== 0 && (originOffset > 0 ? point >= 0 : point <= 0)) return false
  const centered = (transform.originX === 'center' || transform.originX === 0.5) && (transform.originY === 'center' || transform.originY === 0.5)
  const inset = getTextFrameStrokeWidth(text) / (text.strokeUniform ? scale : 1)
  const previous = text[dimension]
  text.set(dimension, Math.max(1, Math.abs(point * (centered ? 2 : 1) / scale) - inset))
  return text[dimension] !== previous
}
