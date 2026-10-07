import { ActiveSelection, FabricImage, Textbox, util } from 'fabric'
import type { StickerCanvas, StickerImage } from '../types'
import { prepareImageOutline } from '../images/imageOutline'
import { serializeCanvas, restoreHistory } from '../history/history'
import { getOriginalStickerImageElement } from '../images/imageSmoothing'

const sourceUrls = new WeakMap<object, string>()

/** Capture editable layers at save time, with durable image sources. */
export function captureStickerDesign(canvas: StickerCanvas): string {
  const design = JSON.parse(serializeCanvas(canvas)) as ReturnType<StickerCanvas['toObject']>
  design.objects = canvas.getObjects().map((object, index) => {
    const layer = design.objects[index]
    if (object.group instanceof ActiveSelection) {
      const transform = util.qrDecompose(object.calcTransformMatrix())
      Object.assign(layer, { left: transform.translateX, top: transform.translateY,
        originX: 'center', originY: 'center', angle: transform.angle,
        scaleX: Math.abs(transform.scaleX), scaleY: Math.abs(transform.scaleY),
        flipX: transform.scaleX < 0, flipY: transform.scaleY < 0,
        skewX: transform.skewX, skewY: 0 })
    }
    if (object instanceof Textbox) layer.stickerCustomFill = true
    if (object instanceof FabricImage) {
      const source = getOriginalStickerImageElement(object)
      let url = sourceUrls.get(source)
      if (!url) {
        const surface = document.createElement('canvas')
        surface.width = 'naturalWidth' in source ? source.naturalWidth : source.width
        surface.height = 'naturalHeight' in source ? source.naturalHeight : source.height
        const context = surface.getContext('2d')
        if (!context) throw new Error('Could not save the sticker image.')
        context.drawImage(source, 0, 0)
        url = surface.toDataURL('image/png')
        sourceUrls.set(source, url)
      }
      layer.src = url
    }
    return layer
  })
  return JSON.stringify({ version: 1, canvas: design })
}

export async function restoreStickerDesign(canvas: StickerCanvas, design: string, options?: {
  signal?: AbortSignal
  onLayoutReady?: (image: FabricImage) => void
}) {
  const document: unknown = JSON.parse(design)
  if (!document || typeof document !== 'object' || !('version' in document) || document.version !== 1 || !('canvas' in document) || !document.canvas || typeof document.canvas !== 'object' || !('objects' in document.canvas) || !Array.isArray(document.canvas.objects)) {
    throw new Error('This saved sticker format is not supported.')
  }
  const renderOnAddRemove = canvas.renderOnAddRemove
  canvas.renderOnAddRemove = false
  canvas.cancelRequestedRender()
  try {
    await restoreHistory(canvas, JSON.stringify(document.canvas), async () => {
      options?.signal?.throwIfAborted()
      const images = canvas.getObjects().filter((object): object is FabricImage => object instanceof FabricImage)
      if (images[0]) options?.onLayoutReady?.(images[0])
      canvas.cancelRequestedRender()
      await Promise.all(images.map(image => prepareImageOutline(image as StickerImage, options?.signal)))
      options?.signal?.throwIfAborted()
    })
  } finally { canvas.renderOnAddRemove = renderOnAddRemove }
  canvas.discardActiveObject()
  canvas.history = [serializeCanvas(canvas)]
  canvas.historyIndex = 0
}
