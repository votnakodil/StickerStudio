import { captureStickerImagePreview, captureStickerDesign, createStickerCanvas, restoreStickerDesign, setStickerTextColor, type StickerCanvas } from '@sticker-studio/editor'
import { palette } from '@sticker-studio/theme'
import { loadEditorFonts } from '@/shared/lib/editorFonts'
import { createPreparedResourceCache } from '../lib/preparedResourceCache'

const prepared = createPreparedResourceCache<StickerCanvas>(4, canvas => {
  canvas.cancelRequestedRender()
  void canvas.dispose()
})
export const takePreparedStickerCanvas = prepared.take
export const invalidatePreparedStickerCanvas = prepared.invalidate

export function warmPreparedStickerCanvas(id: string, loadDesign: () => Promise<string | undefined>, onPreview?: (preview: string) => void) {
  return prepared.warm(id, async signal => {
    await loadEditorFonts()
    const design = await loadDesign()
    signal.throwIfAborted()
    if (!design) return undefined
    const canvas = createStickerCanvas(document.createElement('canvas'))
    try {
      setStickerTextColor(canvas, matchMedia('(prefers-color-scheme: dark)').matches ? palette.white : palette.ink)
      await restoreStickerDesign(canvas, design, { signal })
      signal.throwIfAborted()
      canvas.renderAll()
      // Prime durable image sources used by autosave before navigation.
      captureStickerDesign(canvas)
      signal.throwIfAborted()
      const preview = captureStickerImagePreview(canvas)
      if (preview) onPreview?.(preview)
      return canvas
    } catch (error) {
      canvas.cancelRequestedRender()
      await canvas.dispose()
      throw error
    }
  })
}
