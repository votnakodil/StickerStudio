import type { StickerStrokeSettings, StickerTextbox, StickerImage, StickerCanvas } from '../types'
import { palette } from '@sticker-studio/theme'
import { getStickerTextAutoSize } from '../text/textSettings'
import { Textbox } from 'fabric'
import type { FabricImage } from 'fabric'

export const DEFAULT_STROKE: StickerStrokeSettings = {
  enabled: false,
  width: 10,
  color: palette.white,
  opacity: 1,
}

export const MAX_STROKE_WIDTH = 60

export function normalizeStroke(value: unknown): StickerStrokeSettings {
  const input = value && typeof value === 'object' ? value as Partial<StickerStrokeSettings> : {}
  return {
    enabled: input.enabled === true,
    width: typeof input.width === 'number' && Number.isFinite(input.width) ? Math.max(1, Math.min(MAX_STROKE_WIDTH, input.width)) : DEFAULT_STROKE.width,
    color: typeof input.color === 'string' && /^#[\da-f]{6}$/i.test(input.color) ? input.color.toLowerCase() : DEFAULT_STROKE.color,
    opacity: typeof input.opacity === 'number' && Number.isFinite(input.opacity) ? Math.max(0, Math.min(1, input.opacity)) : DEFAULT_STROKE.opacity,
  }
}

export function textStrokeScale(text: StickerTextbox) {
  return getStickerTextAutoSize(text)
    ? text.fontSize / (text.stickerStrokeFontSize ?? text.stickerMaxFontSize ?? text.fontSize) : 1
}

export function applyTextStroke(text: StickerTextbox) {
  const stroke = text.stickerStroke ?? DEFAULT_STROKE
  text.set({
    stroke: stroke.enabled ? hexWithOpacity(stroke.color, stroke.opacity) : null,
    strokeWidth: stroke.enabled ? stroke.width * 2 * textStrokeScale(text) : 0,
    paintFirst: 'stroke',
  })
}

export function hexWithOpacity(color: string, opacity: number) {
  const hex = color.replace('#', '')
  return `rgba(${parseInt(hex.slice(0, 2), 16)}, ${parseInt(hex.slice(2, 4), 16)}, ${parseInt(hex.slice(4, 6), 16)}, ${opacity})`
}

export function getStickerStroke(object: Textbox | FabricImage): StickerStrokeSettings {
  const stroke = normalizeStroke((object as StickerTextbox | StickerImage).stickerStroke)
  return object instanceof Textbox ? { ...stroke, width: Math.round(stroke.width * textStrokeScale(object as StickerTextbox) * 100) / 100 } : stroke
}

export function updateStickerStroke(
  canvas: StickerCanvas,
  object: Textbox | FabricImage,
  changes: Partial<StickerStrokeSettings>,
) {
  if (!canvas.getObjects().includes(object)) return
  const base = normalizeStroke((object as StickerTextbox | StickerImage).stickerStroke)
  if (object instanceof Textbox && changes.width !== undefined) (object as StickerTextbox).stickerStrokeFontSize = object.fontSize
  const stroke = normalizeStroke({ ...base, ...changes })
  ;(object as StickerTextbox | StickerImage).stickerStroke = stroke
  if (object instanceof Textbox) applyTextStroke(object as StickerTextbox)
  object.dirty = true
  canvas.requestRenderAll()
  canvas.fire('object:modified', { target: object })
}
