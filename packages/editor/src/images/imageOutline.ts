import { smoothOutlineDistances } from './smoothOutlineDistances'
import { outlinePixels } from './outlinePixels'
import type { StickerImage } from '../types'
import { FabricImage } from 'fabric'
import { DEFAULT_STROKE, MAX_STROKE_WIDTH } from '../stroke/stroke'

export type OutlineCache = {
  distances: Float32Array
  width: number
  height: number
  padding: number
  scale: number
  colored?: HTMLCanvasElement
  coloredWidth?: number
  coloredColor?: string
}

// Only unmodified image elements can share an immutable source contour. Edited
// canvas pixels keep their own object cache and never enter this bounded cache.
const sourceOutlines = new Map<string, OutlineCache>()
function sourceKey(image: StickerImage) {
  const element = image.getElement()
  return element instanceof HTMLImageElement && element.src
    ? `${element.src}|${image.width}|${image.height}` : undefined
}
function cachedSource(image: StickerImage) {
  const key = typeof HTMLImageElement === 'undefined' ? undefined : sourceKey(image)
  const cache = key ? sourceOutlines.get(key) : undefined
  if (cache) imageOutlines.set(image, { ...cache })
  return cache
}

/** Warm library artwork before navigation so the real stroke can travel with it. */
export async function preloadStickerImageOutline(source: string, signal?: AbortSignal) {
  const image = await FabricImage.fromURL(source, { crossOrigin: 'anonymous', signal }) as StickerImage
  image.stickerStroke = { ...DEFAULT_STROKE, enabled: true }
  try { await prepareImageOutline(image, signal) }
  finally { image.dispose() }
}

export const imageOutlines = new WeakMap<StickerImage, OutlineCache>()

export function imageOutlineCache(image: StickerImage): OutlineCache {
  const existing = imageOutlines.get(image) ?? cachedSource(image)
  if (existing) return existing
  const { pixels, width, height, padding, scale } = outlineMask(image)
  const distances = smoothOutlineDistances(pixels, width, height, scale)
  const cache = { distances, width, height, padding, scale }
  imageOutlines.set(image, cache)
  return cache
}

function outlineMask(image: StickerImage) {
  const scale = Math.max(1, Math.min(2, 2048 / Math.max(image.width, image.height)))
  const padding = Math.ceil(MAX_STROKE_WIDTH * scale) + 2
  const width = Math.ceil(image.width * scale) + padding * 2
  const height = Math.ceil(image.height * scale) + padding * 2
  const mask = document.createElement('canvas')
  mask.width = width
  mask.height = height
  const context = mask.getContext('2d', { willReadFrequently: true })!
  context.drawImage(image.getElement(), padding, padding, image.width * scale, image.height * scale)
  const pixels = context.getImageData(0, 0, width, height).data
  return { pixels, width, height, padding, scale }
}

/** Prepare expensive contour geometry without blocking route animations. */
export async function prepareImageOutline(image: StickerImage, signal?: AbortSignal) {
  signal?.throwIfAborted()
  if (imageOutlines.has(image) || !image.stickerStroke?.enabled || cachedSource(image)) return
  if (typeof Worker === 'undefined') { imageOutlineCache(image); return }
  const element = image.getElement()
  const stroke = { ...image.stickerStroke }
  const { pixels, width, height, padding, scale } = outlineMask(image)
  const worker = new Worker(new URL('./imageOutline.worker.ts', import.meta.url), { type: 'module' })
  try {
    const result = await new Promise<{ distances: Float32Array; coloredPixels: Uint8ClampedArray }>((resolve, reject) => {
      const abort = () => { cleanup(); reject(signal?.reason ?? new DOMException('Aborted', 'AbortError')) }
      signal?.addEventListener('abort', abort, { once: true })
      const cleanup = () => signal?.removeEventListener('abort', abort)
      worker.onmessage = (event: MessageEvent<{ distances: Float32Array; coloredPixels: Uint8ClampedArray }>) => { cleanup(); resolve(event.data) }
      worker.onerror = (event) => { cleanup(); reject(new Error(event.message)) }
      worker.postMessage({ pixels, width, height, scale, stroke }, [pixels.buffer])
    })
    signal?.throwIfAborted()
    // Never attach geometry to pixels replaced during an async preparation.
    if (image.getElement() === element) {
      const cache: OutlineCache = { distances: result.distances, width, height, padding, scale }
      if (image.stickerStroke.width === stroke.width && image.stickerStroke.color === stroke.color) {
        cache.colored = coloredOutline(result.coloredPixels, width, height)
        cache.coloredWidth = stroke.width
        cache.coloredColor = stroke.color
      }
      imageOutlines.set(image, cache)
      const key = typeof HTMLImageElement === 'undefined' ? undefined : sourceKey(image)
      if (key) {
        if (sourceOutlines.size >= 8) sourceOutlines.delete(sourceOutlines.keys().next().value ?? '')
        sourceOutlines.set(key, { ...cache })
      }
    }
  } finally {
    worker.terminate()
  }
}

export function drawImageOutline(context: CanvasRenderingContext2D, image: StickerImage) {
  const stroke = image.stickerStroke
  if (!stroke?.enabled || stroke.width <= 0 || stroke.opacity <= 0) return
  const cache = imageOutlineCache(image)
  if (!cache.colored || cache.coloredWidth !== stroke.width || cache.coloredColor !== stroke.color) {
    cache.colored = coloredOutline(outlinePixels(cache.distances, cache.scale, stroke.width, stroke.color), cache.width, cache.height)
    cache.coloredWidth = stroke.width
    cache.coloredColor = stroke.color
  }
  context.save()
  context.globalAlpha *= stroke.opacity
  context.drawImage(cache.colored, -image.width / 2 - cache.padding / cache.scale, -image.height / 2 - cache.padding / cache.scale,
    image.width + cache.padding * 2 / cache.scale, image.height + cache.padding * 2 / cache.scale)
  context.restore()
}

function coloredOutline(pixels: Uint8ClampedArray, width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')!
  const imageData = context.createImageData(width, height)
  imageData.data.set(pixels)
  context.putImageData(imageData, 0, 0)
  return canvas
}
