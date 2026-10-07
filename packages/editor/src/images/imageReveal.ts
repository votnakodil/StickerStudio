import type { FabricImage } from 'fabric'
import type { StickerCanvas } from '../types'

export interface StickerImageReveal {
  source: HTMLCanvasElement
  artworkSource: HTMLCanvasElement
  left: number
  top: number
  width: number
  height: number
}

// Render the configured image, including its outline, without mutating the canvas.
export function createStickerImageReveal(canvas: StickerCanvas, image: FabricImage): StickerImageReveal {
  const surface = document.createElement('canvas')
  surface.width = canvas.getWidth()
  surface.height = canvas.getHeight()
  const context = surface.getContext('2d')
  if (!context) throw new Error('Could not prepare the sticker reveal.')
  image.render(context)
  const bounds = image.getBoundingRect()
  // Bounding geometry already includes the silhouette outline. Keep a small antialiasing margin.
  const padding = 2
  const left = Math.floor(bounds.left - padding)
  const top = Math.floor(bounds.top - padding)
  const width = Math.ceil(bounds.left + bounds.width + padding) - left
  const height = Math.ceil(bounds.top + bounds.height + padding) - top
  const source = document.createElement('canvas')
  source.width = width
  source.height = height
  const cropped = source.getContext('2d')
  if (!cropped) throw new Error('Could not prepare the sticker reveal.')
  cropped.drawImage(surface, -left, -top)
  const artworkSource = document.createElement('canvas')
  artworkSource.width = width
  artworkSource.height = height
  const artwork = artworkSource.getContext('2d')
  if (!artwork) throw new Error('Could not prepare the sticker artwork.')
  artwork.translate(-left, -top)
  artwork.transform(...image.calcTransformMatrix())
  artwork.globalAlpha = image.opacity
  artwork.drawImage(image.getElement(), -image.width / 2, -image.height / 2, image.width, image.height)
  return { source, artworkSource, left, top, width, height }
}
