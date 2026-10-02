import { controlsUtils, FabricImage, Control } from 'fabric'
import type { StickerImage, StickerCanvas } from '../types'
import { DEFAULT_STROKE } from '../stroke/stroke'
import { drawImageOutline } from './imageOutline'
import { keepControlsInsideCanvas, RESIZE_SNAP_DISTANCE } from '../canvas/controls'
import type { AlignmentGuide } from '../alignmentGuides'

export const scaleStickerImageFromSide = controlsUtils.wrapWithFireEvent(
  'scaling',
  controlsUtils.wrapWithFixedAnchor((_eventData, transform, x, y) => {
    const image = transform.target
    if (!(image instanceof FabricImage) || image.lockScalingX || image.lockScalingY) return false

    const horizontal = transform.corner === 'ml' || transform.corner === 'mr'
    const pointer = controlsUtils.getLocalPoint(transform, transform.originX, transform.originY, x, y)
    const dimensions = image._getTransformedDimensions()
    const axisPosition = horizontal ? pointer.x : pointer.y
    const axisDimension = horizontal ? dimensions.x : dimensions.y
    if (!axisDimension) return false

    const centered = transform.originX === 'center' && transform.originY === 'center'
    const scale = Math.max(
      0.05,
      Math.abs(axisPosition * (horizontal ? image.scaleX : image.scaleY) / axisDimension) * (centered ? 2 : 1),
    )
    if (Math.abs(image.scaleX - scale) < 0.0001 && Math.abs(image.scaleY - scale) < 0.0001) return false

    image.set({ scaleX: scale, scaleY: scale })
    return true
  }),
)

export function configureStickerImage(image: FabricImage) {
  const sticker = image as StickerImage
  sticker.stickerStroke ??= { ...DEFAULT_STROKE }
  if (!sticker.stickerStrokeRendererInstalled) {
    const renderImage = image._render
    image._render = (context) => {
      drawImageOutline(context, sticker)
      renderImage.call(image, context)
    }
    sticker.stickerStrokeRendererInstalled = true
  }
  image.set('objectCaching', false)
  const sideControl = (x: number, y: number) => new Control({
    x,
    y,
    actionHandler: scaleStickerImageFromSide,
    cursorStyleHandler: controlsUtils.scaleCursorStyleHandler,
    actionName: 'scale',
  })

  image.controls = {
    ...image.controls,
    ml: sideControl(-0.5, 0),
    mr: sideControl(0.5, 0),
    mt: sideControl(0, -0.5),
    mb: sideControl(0, 0.5),
  }
  keepControlsInsideCanvas(image)
}

export function snapStickerImageFrame(
  canvas: StickerCanvas,
  image: FabricImage,
  corner: string,
): AlignmentGuide[] {
  if (image.angle !== 0 || image.scaleX <= 0 || image.scaleY <= 0) return []

  const right = corner === 'mr' || corner === 'tr' || corner === 'br'
  const left = corner === 'ml' || corner === 'tl' || corner === 'bl'
  const bottom = corner === 'mb' || corner === 'bl' || corner === 'br'
  const top = corner === 'mt' || corner === 'tl' || corner === 'tr'
  const horizontal = right || left
  const vertical = bottom || top
  if (!horizontal && !vertical) return []

  image.setCoords()
  const bounds = image.getBoundingRect()
  const candidates: { guide: AlignmentGuide; delta: number; dimension: number; positive: boolean }[] = []
  if (horizontal) {
    const destination = right ? canvas.getWidth() : 0
    candidates.push({ guide: { orientation: 'vertical', position: destination, source: right ? 'end' : 'start' },
      delta: destination - (right ? bounds.left + bounds.width : bounds.left), dimension: bounds.width / image.scaleX, positive: right })
  }
  if (vertical) {
    const destination = bottom ? canvas.getHeight() : 0
    candidates.push({ guide: { orientation: 'horizontal', position: destination, source: bottom ? 'end' : 'start' },
      delta: destination - (bottom ? bounds.top + bounds.height : bounds.top), dimension: bounds.height / image.scaleX, positive: bottom })
  }
  // A corner controls both axes. Snap to the closest edge with one scale factor,
  // rather than stretching the image independently to two incompatible edges.
  const match = candidates.filter((candidate) => Math.abs(candidate.delta) <= RESIZE_SNAP_DISTANCE)
    .sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))[0]
  if (!match || !match.dimension) return []

  const oppositeX = horizontal ? right ? 'left' : 'right' : image.originX
  const oppositeY = vertical ? bottom ? 'top' : 'bottom' : image.originY
  const fixedPoint = image.getPointByOrigin(oppositeX, oppositeY)
  const ratio = image.scaleY / image.scaleX
  const scale = image.scaleX + (match.positive ? match.delta : -match.delta) / match.dimension
  if (scale < 0.05) return []

  image.set({ scaleX: scale, scaleY: scale * ratio })
  image.setPositionByOrigin(fixedPoint, oppositeX, oppositeY)
  image.setCoords()

  const snapped = image.getBoundingRect()
  return candidates.filter(({ guide }) => {
    const edge = guide.orientation === 'vertical'
      ? guide.source === 'end' ? snapped.left + snapped.width : snapped.left
      : guide.source === 'end' ? snapped.top + snapped.height : snapped.top
    return Math.abs(edge - guide.position) < 0.5
  }).map(({ guide }) => guide)
}
