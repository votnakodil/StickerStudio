import type { StickerCanvas } from '../types'
import { saveHistory } from '../history/history'
import { notifyCanvasBackgroundChanged } from './backgroundEvents'

export function getStickerCanvasBackground(canvas: StickerCanvas) {
  return typeof canvas.backgroundColor === 'string' && canvas.backgroundColor
    ? canvas.backgroundColor
    : 'transparent'
}

export function updateStickerCanvasBackground(canvas: StickerCanvas, color: string) {
  if (color !== 'transparent' && !/^#[\da-f]{6}$/i.test(color)) return
  if (getStickerCanvasBackground(canvas).toLowerCase() === color.toLowerCase()) return
  canvas.backgroundColor = color
  canvas.requestRenderAll()
  saveHistory(canvas)
  notifyCanvasBackgroundChanged(canvas)
}
