import type { StickerCanvas } from '../types'

export const canvasBackgroundListeners = new WeakMap<StickerCanvas, Set<() => void>>()

export function notifyCanvasBackgroundChanged(canvas: StickerCanvas) {
  canvasBackgroundListeners.get(canvas)?.forEach((listener) => listener())
}

export function subscribeStickerCanvasBackground(canvas: StickerCanvas, listener: () => void) {
  let listeners = canvasBackgroundListeners.get(canvas)
  if (!listeners) {
    listeners = new Set()
    canvasBackgroundListeners.set(canvas, listeners)
  }
  listeners.add(listener)
  return () => listeners.delete(listener)
}
