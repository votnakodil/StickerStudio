import { FabricImage } from 'fabric'
import type { StickerCanvas } from '../types'

/** The edited photo in canvas coordinates, without text or decorative outlines. */
export function captureStickerImagePreview(canvas: StickerCanvas): string | undefined {
  const image = canvas.getObjects().find((object): object is FabricImage => object instanceof FabricImage && object.visible)
  if (!image) return undefined
  const preview = document.createElement('canvas')
  preview.width = preview.height = 1024
  const context = preview.getContext('2d')
  if (!context) throw new Error('Could not render the library preview.')
  context.imageSmoothingQuality = 'high'
  context.globalAlpha = image.getObjectOpacity()
  // Object transforms use logical canvas coordinates, independent of pan/zoom.
  // Render the live erased pixels through Fabric's image renderer, bypassing
  // the editor's custom outline renderer and any selection controls.
  context.transform(...image.calcTransformMatrix())
  FabricImage.prototype._render.call(image, context)
  return preview.toDataURL('image/png')
}
