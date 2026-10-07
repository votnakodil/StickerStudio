import { useCallback } from 'react'
import { createStickerImageReveal, createStickerTextReveal, type StickerCanvas } from '@sticker-studio/editor'
import { Textbox, type FabricImage } from 'fabric'

/** Prepare canvas textures directly, avoiding asynchronous PNG encode/decode. */
export function useStickerArtworkSnapshot() {
  const prepareArtworkSnapshot = useCallback((canvas: StickerCanvas, image: FabricImage, fullCanvas = false) => {
    const snapshot = createStickerImageReveal(canvas, image)
    if (fullCanvas) return {
      source: snapshot.source,
      left: snapshot.left / 1024 * 100,
      top: snapshot.top / 1024 * 100,
      width: snapshot.width / 1024 * 100,
      height: snapshot.height / 1024 * 100,
    }
    const center = image.getCenterPoint()
    const width = image.width * image.scaleX
    const height = image.height * image.scaleY
    return {
      source: snapshot.source,
      left: (snapshot.left - center.x + width / 2) / width * 100,
      top: (snapshot.top - center.y + height / 2) / height * 100,
      width: snapshot.width / width * 100,
      height: snapshot.height / height * 100,
    }
  }, [])
  const prepareTextSnapshot = useCallback((canvas: StickerCanvas) => {
    const texts = canvas.getObjects().filter((object): object is Textbox => object instanceof Textbox)
    const title = [...texts].sort((a, b) => a.getCenterPoint().y - b.getCenterPoint().y)[0]
    return { textSource: createStickerTextReveal(canvas, texts.filter(text => text !== title)),
      titleSource: createStickerTextReveal(canvas, title ? [title] : []) }
  }, [])
  return { prepareArtworkSnapshot, prepareTextSnapshot }
}
