import {
  ActiveSelection,
  Canvas,
  Control,
  FabricImage,
  Point,
  Rect,
  Textbox,
  controlsUtils,
} from 'fabric'
export { snapStickerObject, type AlignmentGuide } from './alignmentGuides'
import type { AlignmentGuide } from './alignmentGuides'
import { normalizeStickerFontWeight } from './fontWeights'
export { getStickerFontWeights, normalizeStickerFontWeight } from './fontWeights'

type HistoryEntry = string

type StickerTextbox = Textbox & {
  stickerAutoSize?: boolean
  stickerMaxFontSize?: number
  stickerStrokeFontSize?: number
  stickerFrameWidth?: number
  stickerFrameHeight?: number
  stickerCustomFill?: boolean
  stickerVerticalAlign?: 'top' | 'middle' | 'bottom'
  stickerTopOffsetInstalled?: boolean
  stickerEditingLayoutInstalled?: boolean
  stickerDistributedAlignmentInstalled?: boolean
  stickerStroke?: StickerStrokeSettings
}

type StickerImage = FabricImage & {
  stickerStroke?: StickerStrokeSettings
  stickerStrokeRendererInstalled?: boolean
}

export type StickerStrokeSettings = {
  enabled: boolean
  width: number
  color: string
  opacity: number
}

const DEFAULT_STROKE: StickerStrokeSettings = {
  enabled: false,
  width: 10,
  color: '#ffffff',
  opacity: 1,
}
const MAX_STROKE_WIDTH = 60

function normalizeStroke(value: unknown): StickerStrokeSettings {
  const input = value && typeof value === 'object' ? value as Partial<StickerStrokeSettings> : {}
  return {
    enabled: input.enabled === true,
    width: typeof input.width === 'number' && Number.isFinite(input.width) ? Math.max(1, Math.min(MAX_STROKE_WIDTH, input.width)) : DEFAULT_STROKE.width,
    color: typeof input.color === 'string' && /^#[\da-f]{6}$/i.test(input.color) ? input.color.toLowerCase() : DEFAULT_STROKE.color,
    opacity: typeof input.opacity === 'number' && Number.isFinite(input.opacity) ? Math.max(0, Math.min(1, input.opacity)) : DEFAULT_STROKE.opacity,
  }
}

export type StickerTextStyle = {
  fontFamily: string
  fontSize: number
  fontWeight: number | string
  fontStyle: string
  underline: boolean
  linethrough: boolean
  fill: string
  textAlign: string
  stickerAutoSize: boolean
  stickerVerticalAlign: 'top' | 'middle' | 'bottom'
}

export type EditorTool = 'move' | 'hand'

export interface StickerCanvas extends Canvas {
  history: HistoryEntry[]
  historyIndex: number
  isRestoringHistory: boolean
  editorTool: EditorTool
  stickerTextColor: string
}

const MIN_TEXT_FRAME_HEIGHT = 24
const RESIZE_SNAP_DISTANCE = 24

type OutlineCache = {
  distances: Float32Array
  width: number
  height: number
  padding: number
  colored?: HTMLCanvasElement
  coloredWidth?: number
  coloredColor?: string
}
const imageOutlines = new WeakMap<StickerImage, OutlineCache>()
const canvasBackgroundListeners = new WeakMap<StickerCanvas, Set<() => void>>()

function notifyCanvasBackgroundChanged(canvas: StickerCanvas) {
  canvasBackgroundListeners.get(canvas)?.forEach((listener) => listener())
}

export function subscribeStickerCanvasBackground(canvas: StickerCanvas, listener: () => void) {
  let listeners = canvasBackgroundListeners.get(canvas)
  if (!listeners) {
    listeners = new Set()
    canvasBackgroundListeners.set(canvas, listeners)
  }
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getStickerCanvasBackground(canvas: StickerCanvas) {
  return typeof canvas.backgroundColor === 'string' && canvas.backgroundColor
    ? canvas.backgroundColor
    : 'transparent'
}

export function updateStickerCanvasBackground(canvas: StickerCanvas, color: string) {
  if (color !== 'transparent' && !/^#[\da-f]{6}$/i.test(color)) return
  if (getStickerCanvasBackground(canvas).toLowerCase() === color.toLowerCase()) return
  canvas.backgroundColor = color
  canvas.requestRenderAll()
  saveHistory(canvas)
  notifyCanvasBackgroundChanged(canvas)
}

function imageOutlineCache(image: StickerImage): OutlineCache {
  const existing = imageOutlines.get(image)
  if (existing) return existing
  const padding = MAX_STROKE_WIDTH + 2
  const width = Math.ceil(image.width) + padding * 2
  const height = Math.ceil(image.height) + padding * 2
  const mask = document.createElement('canvas')
  mask.width = width
  mask.height = height
  const context = mask.getContext('2d', { willReadFrequently: true })!
  context.drawImage(image.getElement(), padding, padding, image.width, image.height)
  const pixels = context.getImageData(0, 0, width, height).data
  const distances = new Float32Array(width * height)
  for (let index = 0; index < distances.length; index++) {
    distances[index] = pixels[index * 4 + 3] > 8 ? 0 : 1e6
  }
  const diagonal = Math.SQRT2
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x
      if (x > 0) distances[index] = Math.min(distances[index], distances[index - 1] + 1)
      if (y > 0) {
        distances[index] = Math.min(distances[index], distances[index - width] + 1)
        if (x > 0) distances[index] = Math.min(distances[index], distances[index - width - 1] + diagonal)
        if (x < width - 1) distances[index] = Math.min(distances[index], distances[index - width + 1] + diagonal)
      }
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const index = y * width + x
      if (x < width - 1) distances[index] = Math.min(distances[index], distances[index + 1] + 1)
      if (y < height - 1) {
        distances[index] = Math.min(distances[index], distances[index + width] + 1)
        if (x < width - 1) distances[index] = Math.min(distances[index], distances[index + width + 1] + diagonal)
        if (x > 0) distances[index] = Math.min(distances[index], distances[index + width - 1] + diagonal)
      }
    }
  }
  const cache = { distances, width, height, padding }
  imageOutlines.set(image, cache)
  return cache
}

function drawImageOutline(context: CanvasRenderingContext2D, image: StickerImage) {
  const stroke = image.stickerStroke
  if (!stroke?.enabled || stroke.width <= 0 || stroke.opacity <= 0) return
  const cache = imageOutlineCache(image)
  if (!cache.colored || cache.coloredWidth !== stroke.width || cache.coloredColor !== stroke.color) {
    const canvas = document.createElement('canvas')
    canvas.width = cache.width
    canvas.height = cache.height
    const outlineContext = canvas.getContext('2d')!
    const pixels = outlineContext.createImageData(cache.width, cache.height)
    const hex = stroke.color.replace('#', '')
    const red = parseInt(hex.slice(0, 2), 16)
    const green = parseInt(hex.slice(2, 4), 16)
    const blue = parseInt(hex.slice(4, 6), 16)
    for (let index = 0; index < cache.distances.length; index++) {
      const coverage = Math.min(1, Math.max(0, stroke.width + 0.5 - cache.distances[index]))
      if (!coverage) continue
      const pixel = index * 4
      pixels.data[pixel] = red
      pixels.data[pixel + 1] = green
      pixels.data[pixel + 2] = blue
      pixels.data[pixel + 3] = Math.round(coverage * 255)
    }
    outlineContext.putImageData(pixels, 0, 0)
    cache.colored = canvas
    cache.coloredWidth = stroke.width
    cache.coloredColor = stroke.color
  }
  context.save()
  context.globalAlpha *= stroke.opacity
  context.drawImage(cache.colored, -image.width / 2 - cache.padding, -image.height / 2 - cache.padding,
    image.width + cache.padding * 2, image.height + cache.padding * 2)
  context.restore()
}

function textStrokeScale(text: StickerTextbox) {
  return getStickerTextAutoSize(text)
    ? text.fontSize / (text.stickerStrokeFontSize ?? text.stickerMaxFontSize ?? text.fontSize) : 1
}

function applyTextStroke(text: StickerTextbox) {
  const stroke = text.stickerStroke ?? DEFAULT_STROKE
  text.set({
    stroke: stroke.enabled ? hexWithOpacity(stroke.color, stroke.opacity) : null,
    strokeWidth: stroke.enabled ? stroke.width * 2 * textStrokeScale(text) : 0,
    paintFirst: 'stroke',
  })
}

function hexWithOpacity(color: string, opacity: number) {
  const hex = color.replace('#', '')
  return `rgba(${parseInt(hex.slice(0, 2), 16)}, ${parseInt(hex.slice(2, 4), 16)}, ${parseInt(hex.slice(4, 6), 16)}, ${opacity})`
}

function keepControlsInsideCanvas(object: FabricImage | StickerTextbox) {
  // Text controls define its selection border. Clamping individual corners
  // distorts the frame when the text moves near or beyond the canvas edge.
  if (object instanceof Textbox) return
  object.controls = Object.fromEntries(
    Object.entries(object.controls).map(([name, control]) => {
      if (name === 'overflow') return [name, control]
      const clamped = Object.assign(new Control(), control)
      const positionHandler = clamped.positionHandler
      clamped.positionHandler = (dimensions, matrix, target, currentControl) => {
        const position = positionHandler.call(clamped, dimensions, matrix, target, currentControl)
        const canvas = target.canvas
        if (!canvas) return position
        const inset = Math.max(12, target.cornerSize / 2 + 4)
        return new Point(
          Math.min(canvas.getWidth() - inset, Math.max(inset, position.x)),
          Math.min(canvas.getHeight() - inset, Math.max(inset, position.y)),
        )
      }
      return [name, clamped]
    }),
  )
}

const scaleStickerImageFromSide = controlsUtils.wrapWithFireEvent(
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

function configureStickerImage(image: FabricImage) {
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

function serializeCanvas(canvas: StickerCanvas) {
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

function getTextFrameHeight(
  text: StickerTextbox,
) {
  return Math.max(
    MIN_TEXT_FRAME_HEIGHT,
    text.stickerFrameHeight ??
      text.height,
  )
}

function getTextContentHeight(
  text: StickerTextbox,
) {
  return Math.max(
    MIN_TEXT_FRAME_HEIGHT,
    text.calcTextHeight(),
  )
}

function isTextOverflowing(
  text: StickerTextbox,
) {
  return (
    getTextContentHeight(text) >
    getTextFrameHeight(text) + 0.5
  )
}

function renderOverflowIndicator(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
) {
  const size = 9

  ctx.save()
  ctx.translate(left, top)

  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#111111'
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

function updateOverflowIndicator(
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

function updateTextClip(
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

function relayoutStickerText(
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

/** The requested size is a ceiling; fitting never changes the chosen frame. */
export function getStickerTextAutoSize(text: Textbox) {
  return (text as StickerTextbox).stickerAutoSize !== false
}

function fitStickerText(text: StickerTextbox, frameWidth = text.stickerFrameWidth ?? text.width) {
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

function fitTextFrameAfterWidthChange(
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

function showAllText(
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

// Fabric's width setter reflows the text immediately and expands the frame to
// the longest word. Auto size must store the requested frame before that reflow.
const changeStickerTextWidth: typeof controlsUtils.changeObjectWidth = (event, transform, x, y) => {
  const text = transform.target as StickerTextbox
  if (!getStickerTextAutoSize(text)) return controlsUtils.changeObjectWidth(event, transform, x, y)
  const point = controlsUtils.getLocalPoint(transform, transform.originX, transform.originY, x, y)
  const origin = typeof transform.originX === 'number' ? transform.originX - 0.5
    : transform.originX === 'left' ? -0.5 : transform.originX === 'right' ? 0.5 : 0
  if (origin !== 0 && (origin > 0 ? point.x >= 0 : point.x <= 0)) return false
  const padding = text.strokeWidth / (text.strokeUniform ? text.scaleX : 1)
  const width = Math.max(1, Math.abs(point.x * (origin === 0 ? 2 : 1) / text.scaleX) - padding)
  const changed = Math.abs(text.width - width) > 0.01
  text._set('width', width)
  text.stickerFrameWidth = width
  return changed
}

const resizeStickerTextWidth = (
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

const resizeStickerTextHeight =
  controlsUtils.wrapWithFixedAnchor(
    (
      eventData,
      transform,
      x,
      y,
    ) => {
      const text =
        transform.target as StickerTextbox

      const changed =
        controlsUtils.changeObjectHeight(
          eventData,
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

const resizeStickerTextFrame =
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
        controlsUtils.changeObjectHeight(
          eventData,
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

function createResizeControl(
  x: number,
  y: number,
  cursorStyle: string,
  actionHandler:
    typeof resizeStickerTextFrame,
) {
  return new Control({
    x,
    y,
    cursorStyle,
    actionName: 'resizing',
    actionHandler: controlsUtils.wrapWithFireEvent('resizing', actionHandler),
  })
}

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

function configureStickerText(
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

function configureStickerTexts(
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

function saveHistory(
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

async function restoreHistory(
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
  canvas.stickerTextColor = '#ffffff'

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
      borderColor: '#0a84ff',
      borderOpacityWhenMoving: 1,
      borderScaleFactor: 2,
      cornerColor: '#0a84ff',
      cornerStrokeColor: '#ffffff',
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

function createStickerText(text: string, left: number, top: number, color: string) {
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

export function updateStickerImageOpacity(canvas: StickerCanvas, image: FabricImage, opacity: number) {
  if (!canvas.getObjects().includes(image)) return
  image.set('opacity', Math.max(0, Math.min(1, opacity)))
  canvas.requestRenderAll()
  canvas.fire('object:modified', { target: image })
}

export function getStickerStroke(object: Textbox | FabricImage): StickerStrokeSettings {
  const stroke = normalizeStroke((object as StickerTextbox | StickerImage).stickerStroke)
  return object instanceof Textbox ? { ...stroke, width: Math.round(stroke.width * textStrokeScale(object as StickerTextbox) * 100) / 100 } : stroke
}

export function updateStickerStroke(
  canvas: StickerCanvas,
  object: Textbox | FabricImage,
  changes: Partial<StickerStrokeSettings>,
) {
  if (!canvas.getObjects().includes(object)) return
  const base = normalizeStroke((object as StickerTextbox | StickerImage).stickerStroke)
  if (object instanceof Textbox && changes.width !== undefined) (object as StickerTextbox).stickerStrokeFontSize = object.fontSize
  const stroke = normalizeStroke({ ...base, ...changes })
  ;(object as StickerTextbox | StickerImage).stickerStroke = stroke
  if (object instanceof Textbox) applyTextStroke(object as StickerTextbox)
  object.dirty = true
  canvas.requestRenderAll()
  canvas.fire('object:modified', { target: object })
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

export async function addStickerImage(
  canvas: StickerCanvas,
  url: string,
  signal?: AbortSignal,
) {
  const image =
    await FabricImage.fromURL(
      url,
      {
        crossOrigin:
          'anonymous',
        signal,
      },
    )

  const maxSize = 640

  const width =
    image.width || 1

  const height =
    image.height || 1

  const scale =
    Math.min(
      maxSize / width,
      maxSize / height,
      1,
    )

  image.set({
    left: 512,
    top: 512,

    originX:
      'center',

    originY:
      'center',

    scaleX: scale,
    scaleY: scale,
  })

  canvas.add(image)

  canvas.setActiveObject(
    image,
  )

  canvas.requestRenderAll()

  return image
}

export interface StickerCanvasPreset {
  image: { left: number; top: number; width: number; height: number; opacity?: number }
  texts: {
    text: string
    left: number
    top: number
    width: number
    frameHeight: number
    autoSize?: boolean
    fontFamily: string
    fontSize: number
    fontWeight: number
    fill: string
    textAlign: 'left' | 'center' | 'right'
    verticalAlign: 'top' | 'middle' | 'bottom'
    stroke?: StickerStrokeSettings
  }[]
}

interface StickerTemplateText {
  topText: string
  bottomText: string
  preset?: StickerCanvasPreset
}

function getVisibleImageBounds(image: FabricImage) {
  const width = image.width || 1
  const height = image.height || 1
  const surface = document.createElement('canvas')
  surface.width = width
  surface.height = height
  const context = surface.getContext('2d', { willReadFrequently: true })

  if (!context) return { left: 0, top: 0, width, height }

  try {
    context.drawImage(image.getElement(), 0, 0, width, height)
    const pixels = context.getImageData(0, 0, width, height).data
    let left = width
    let top = height
    let right = -1
    let bottom = -1

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (pixels[(y * width + x) * 4 + 3] > 16) {
          left = Math.min(left, x)
          top = Math.min(top, y)
          right = Math.max(right, x)
          bottom = Math.max(bottom, y)
        }
      }
    }

    if (right >= left && bottom >= top) {
      return { left, top, width: right - left + 1, height: bottom - top + 1 }
    }
  } catch {
    // A source without readable pixels still fits by its full dimensions.
  }

  return { left: 0, top: 0, width, height }
}

export async function initializeStickerCanvas(
  canvas: StickerCanvas,
  source: string,
  text: StickerTemplateText,
  signal?: AbortSignal,
) {
  const image = await addStickerImage(canvas, source, signal)
  if (text.preset) {
    const preset = text.preset
    image.set({
      left: preset.image.left + preset.image.width / 2,
      top: preset.image.top + preset.image.height / 2,
      scaleX: preset.image.width / image.width,
      scaleY: preset.image.height / image.height,
      opacity: preset.image.opacity ?? 1,
    })
    image.setCoords()
    // Presets list text layers from front to back, like the Layers panel.
    for (const layer of [...preset.texts].reverse()) {
      const textbox = new Textbox(layer.text, {
        left: layer.left, top: layer.top, originX: 'left', originY: 'top',
        width: layer.width, fontFamily: layer.fontFamily, fontSize: layer.fontSize,
        fontWeight: normalizeStickerFontWeight(layer.fontFamily, layer.fontWeight),
        fill: layer.fill, textAlign: layer.textAlign,
      }) as StickerTextbox
      textbox.stickerAutoSize = layer.autoSize ?? true
      textbox.stickerMaxFontSize = layer.fontSize
      textbox.stickerFrameHeight = textbox.stickerAutoSize
        ? layer.frameHeight : Math.max(layer.frameHeight, getTextContentHeight(textbox))
      textbox.stickerVerticalAlign = layer.verticalAlign
      textbox.stickerCustomFill = true
      textbox.stickerStroke = layer.stroke ? { ...layer.stroke } : { ...DEFAULT_STROKE }
      configureStickerText(textbox)
      if (textbox.stickerAutoSize) fitStickerText(textbox, layer.width)
      canvas.add(textbox)
    }
    canvas.discardActiveObject()
    canvas.requestRenderAll()
    canvas.history = [serializeCanvas(canvas)]
    canvas.historyIndex = 0
    return image
  }
  const bounds = getVisibleImageBounds(image)
  const scale = Math.min(512 / bounds.width, 640 / bounds.height)

  image.set({
    left: 512 - (bounds.left + bounds.width / 2 - image.width / 2) * scale,
    top: 512 - (bounds.top + bounds.height / 2 - image.height / 2) * scale,
    scaleX: scale,
    scaleY: scale,
  })
  image.setCoords()

  canvas.add(
    createStickerText(text.topText, 512, 108, canvas.stickerTextColor),
    createStickerText(text.bottomText, 512, 912, canvas.stickerTextColor),
  )
  canvas.discardActiveObject()
  canvas.requestRenderAll()
  canvas.history = [serializeCanvas(canvas)]
  canvas.historyIndex = 0
  return image
}

export function deleteSelectedObjects(
  canvas: StickerCanvas,
) {
  const selectedObjects =
    canvas.getActiveObjects()

  if (
    selectedObjects.length ===
    0
  ) {
    return
  }

  canvas.discardActiveObject()

  selectedObjects.forEach(
    (object) => {
      canvas.remove(
        object,
      )
    },
  )

  canvas.requestRenderAll()
}

export interface StickerLayer {
  id: string
  index: number
  kind: 'text' | 'image' | 'other'
  title: string
  detail: string
  thumbnail?: string
  visible: boolean
  selected: boolean
}

const layerIds = new WeakMap<object, string>()
let nextLayerId = 0

function layerId(object: object) {
  let id = layerIds.get(object)
  if (!id) {
    id = `layer-${++nextLayerId}`
    layerIds.set(object, id)
  }
  return id
}

/** The panel lists frontmost objects first; Fabric stores them backmost first. */
export function reorderStickerLayers(canvas: StickerCanvas, frontToBackIds: readonly string[]) {
  const objects = canvas.getObjects()
  const byId = new Map(objects.map((object) => [layerId(object), object]))
  if (frontToBackIds.length !== objects.length || new Set(frontToBackIds).size !== objects.length
    || frontToBackIds.some((id) => !byId.has(id))) return false

  let changed = false
  ;[...frontToBackIds].reverse().forEach((id, index) => {
    changed = canvas.moveObjectTo(byId.get(id)!, index) || changed
  })
  if (changed) canvas.requestRenderAll()
  return changed
}

export function commitStickerLayerOrder(canvas: StickerCanvas, movedId: string) {
  const target = canvas.getObjects().find((object) => layerId(object) === movedId)
  if (target) canvas.fire('object:modified', { target })
}

export function getStickerLayers(canvas: StickerCanvas): StickerLayer[] {
  const selected = canvas.getActiveObjects()

  return canvas.getObjects().map((object, index) => {
    const base = {
      id: layerId(object),
      index,
      visible: object.visible,
      selected: selected.includes(object),
    }

    if (object instanceof Textbox) {
      return {
        ...base,
        kind: 'text' as const,
        title: object.text.trim() || 'Empty text',
        detail: `Text · ${Math.round(object.fontSize)} px`,
      }
    }

    if (object instanceof FabricImage) {
      return {
        ...base,
        kind: 'image' as const,
        title: 'Sticker image',
        detail: 'Image',
        thumbnail: object.getSrc(),
      }
    }

    return {
      ...base,
      kind: 'other' as const,
      title: 'Layer',
      detail: 'Object',
    }
  }).reverse()
}

export function selectStickerLayer(canvas: StickerCanvas, index: number, additive = false) {
  const object = canvas.getObjects()[index]
  if (!object || !object.visible) return

  if (additive) {
    const selected = canvas.getActiveObjects()
    const next = selected.includes(object)
      ? selected.filter((item) => item !== object)
      : [...selected, object]

    canvas.discardActiveObject()
    if (next.length > 1) {
      canvas.setActiveObject(new ActiveSelection(next, { canvas }))
    } else if (next.length === 1) {
      canvas.setActiveObject(next[0])
    }
  } else {
    canvas.setActiveObject(object)
  }
  canvas.requestRenderAll()
}

export function selectStickerCanvas(canvas: StickerCanvas) {
  canvas.discardActiveObject()
  canvas.requestRenderAll()
}

export function scaleSelectedStickerLayers(canvas: StickerCanvas, factor: number) {
  const selection = canvas.getActiveObject()
  if (!selection) return false

  const scaleX = selection.scaleX * factor
  const scaleY = selection.scaleY * factor
  if (Math.min(Math.abs(scaleX), Math.abs(scaleY)) < 0.05 || Math.max(Math.abs(scaleX), Math.abs(scaleY)) > 8) {
    return false
  }

  selection.set({ scaleX, scaleY })
  selection.setCoords()
  canvas.requestRenderAll()
  return true
}

export function commitStickerLayerScale(canvas: StickerCanvas) {
  saveHistory(canvas)
}

export function setStickerLayerVisibility(
  canvas: StickerCanvas,
  index: number,
  visible: boolean,
) {
  const object = canvas.getObjects()[index]
  if (!object || object.visible === visible) return

  if (!visible && canvas.getActiveObjects().includes(object)) {
    canvas.discardActiveObject()
  }

  object.set('visible', visible)
  canvas.fire('object:modified', { target: object })
  canvas.requestRenderAll()
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
