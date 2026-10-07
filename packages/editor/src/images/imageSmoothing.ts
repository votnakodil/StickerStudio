import type { FabricImage } from 'fabric'
import type { StickerCanvas, StickerImage } from '../types'
import { imageOutlines } from './imageOutline'
import { applyImageErasure } from './imageErasure'
import { smoothImagePixels } from './smoothImagePixels'

interface OriginalImage {
  element: ReturnType<FabricImage['getElement']>
  pixels?: ImageData
}
const originals = new WeakMap<FabricImage, OriginalImage>()

export function getStickerImageSmoothing(image: FabricImage) {
  const amount = (image as StickerImage).stickerEdgeSmoothing
  return typeof amount === 'number' && Number.isFinite(amount) ? Math.max(0, Math.min(100, amount)) : 0
}

/** Capture the source once. Saved designs always reference these unmodified pixels. */
export function configureImageSmoothing(image: FabricImage) {
  if (originals.has(image)) return
  originals.set(image, { element: image.getElement() })
  const source = image.getSrc()
  const getSrc = image.getSrc.bind(image)
  image.getSrc = (filtered = false) => filtered ? getSrc(true) : source
  const amount = getStickerImageSmoothing(image)
  ;(image as StickerImage).stickerEdgeSmoothing = amount
  if (amount > 0) applyImageSmoothing(image, amount)
  else applyImageErasure(image, image.getElement())
}

function applyImageSmoothing(image: FabricImage, amount: number) {
  const original = originals.get(image)
  if (!original) return
  if (amount === 0) image.setElement(original.element)
  else {
    const width = Math.max(1, Math.round(image.width))
    const height = Math.max(1, Math.round(image.height))
    const surface = document.createElement('canvas')
    surface.width = width
    surface.height = height
    const context = surface.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Could not smooth the image edges.')
    let pixels = original.pixels
    if (!pixels) {
      context.drawImage(original.element, 0, 0, width, height)
      pixels = context.getImageData(0, 0, width, height)
      original.pixels = pixels
    }
    const result = context.createImageData(width, height)
    result.data.set(smoothImagePixels(pixels.data, width, height, amount))
    context.putImageData(result, 0, 0)
    image.setElement(surface)
  }
  applyImageErasure(image, image.getElement())
  ;(image as StickerImage).stickerEdgeSmoothing = amount
  imageOutlines.delete(image as StickerImage)
  image.dirty = true
  image.setCoords()
}

export function updateStickerImageSmoothing(canvas: StickerCanvas, image: FabricImage, value: number, commit = true) {
  if (!canvas.getObjects().includes(image)) return
  const amount = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0
  configureImageSmoothing(image)
  if (getStickerImageSmoothing(image) !== amount) applyImageSmoothing(image, amount)
  canvas.requestRenderAll()
  if (commit) commitStickerImageSmoothing(canvas, image)
}

export function commitStickerImageSmoothing(canvas: StickerCanvas, image: FabricImage) {
  if (!canvas.getObjects().includes(image)) return
  canvas.requestRenderAll()
  canvas.fire('object:modified', { target: image })
}

/** Unmodified pixels are persisted together with editable smoothing/erase settings. */
export function getOriginalStickerImageElement(image: FabricImage) {
  return originals.get(image)?.element ?? image.getElement()
}
