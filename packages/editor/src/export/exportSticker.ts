import type { StickerCanvas } from '../types'
import { Textbox, FabricImage } from 'fabric'

export async function exportStickerBlob(canvas: StickerCanvas): Promise<Blob> {
  if (canvas.getWidth() !== 1024 || canvas.getHeight() !== 1024) {
    throw new Error('Sticker canvas must be 1024 × 1024 pixels.')
  }
  const fonts = typeof document !== 'undefined' ? document.fonts : undefined
  if (fonts) {
    await Promise.all(canvas.getObjects().filter((object): object is Textbox => object instanceof Textbox)
      .map((text) => fonts.load(`${text.fontStyle} ${text.fontWeight} ${text.fontSize}px "${text.fontFamily}"`, text.text)))
    await fonts.ready
  }
  await Promise.all(canvas.getObjects().filter((object): object is FabricImage => object instanceof FabricImage)
    .map(async (image) => {
      const element = image.getElement()
      if (typeof HTMLImageElement !== 'undefined' && element instanceof HTMLImageElement && !element.complete) await element.decode()
    }))

  const viewport = canvas.viewportTransform
  let pending: Promise<Blob | null>
  try {
    canvas.viewportTransform = [1, 0, 0, 1, 0, 0]
    canvas.calcViewportBoundaries()
    pending = canvas.toBlob({ format: 'png', multiplier: 1, enableRetinaScaling: false })
  } finally {
    canvas.viewportTransform = viewport
    canvas.calcViewportBoundaries()
  }
  const blob = await pending
  if (!blob) throw new Error('Could not render the sticker PNG.')
  return blob
}
