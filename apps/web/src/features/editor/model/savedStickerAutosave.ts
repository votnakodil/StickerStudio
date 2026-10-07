import { captureStickerImagePreview, captureStickerDesign, subscribeStickerCanvasBackground, type StickerCanvas } from '@sticker-studio/editor'
import { setSavedStickerPreview, updateSavedStickerDesign } from '@/features/library'
import { createPeriodicDesignSaver } from '@/features/editor/lib/periodicDesignSaver'

const activeSavers = new WeakMap<StickerCanvas, { flush: () => Promise<void> }>()
export function flushSavedStickerAutosave(canvas: StickerCanvas) { return activeSavers.get(canvas)?.flush() ?? Promise.resolve() }

export function startSavedStickerAutosave(canvas: StickerCanvas, id: string, onError: () => void, onSaved: () => void) {
  const readSnapshot = () => JSON.stringify({ design: captureStickerDesign(canvas), preview: captureStickerImagePreview(canvas) })
  const saver = createPeriodicDesignSaver({
    // The restored design is already saved. Encode only after an edit, so
    // opening a saved card does not spend an animation frame encoding PNGs.
    read: readSnapshot,
    write: serialized => {
      const snapshot: { design: string; preview?: string } = JSON.parse(serialized)
      return updateSavedStickerDesign(id, snapshot.design, snapshot.preview)
    }, onError, onSaved,
  })
  activeSavers.set(canvas, saver)
  const markDirty = () => {
    if (canvas.isRestoringHistory) return
    saver.markDirty()
    const preview = captureStickerImagePreview(canvas)
    if (preview) setSavedStickerPreview(id, preview)
  }
  const disposers = [canvas.on('object:modified', markDirty), canvas.on('object:added', markDirty), canvas.on('object:removed', markDirty), canvas.on('text:changed', markDirty), subscribeStickerCanvasBackground(canvas, markDirty)]
  const flushHidden = () => { if (document.visibilityState === 'hidden') void saver.flush() }
  const flushPage = () => { void saver.flush() }
  document.addEventListener('visibilitychange', flushHidden)
  window.addEventListener('pagehide', flushPage)
  return () => {
    activeSavers.delete(canvas)
    disposers.forEach(dispose => dispose())
    document.removeEventListener('visibilitychange', flushHidden)
    window.removeEventListener('pagehide', flushPage)
    void saver.stop()
  }
}
