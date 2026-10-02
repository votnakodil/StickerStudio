import type { StickerImage } from '../types'
import { MAX_STROKE_WIDTH } from '../stroke/stroke'

export type OutlineCache = {
  distances: Float32Array
  width: number
  height: number
  padding: number
  colored?: HTMLCanvasElement
  coloredWidth?: number
  coloredColor?: string
}

export const imageOutlines = new WeakMap<StickerImage, OutlineCache>()

export function imageOutlineCache(image: StickerImage): OutlineCache {
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

export function drawImageOutline(context: CanvasRenderingContext2D, image: StickerImage) {
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
