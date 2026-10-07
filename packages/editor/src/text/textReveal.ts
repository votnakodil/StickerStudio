import { Textbox } from 'fabric'
import type { StickerCanvas } from '../types'

/** Match the live canvas's text pixels, including retina scale and cached glyphs. */
export function createStickerTextReveal(canvas: StickerCanvas, texts?: readonly Textbox[]) {
  const scale = canvas.getRetinaScaling()
  const source = document.createElement('canvas')
  source.width = canvas.getWidth() * scale
  source.height = canvas.getHeight() * scale
  const context = source.getContext('2d')
  if (!context) throw new Error('Could not prepare the sticker text preview.')
  context.imageSmoothingEnabled = canvas.imageSmoothingEnabled
  Object.assign(context, { patternQuality: canvas.patternQuality })
  context.scale(scale, scale)
  context.transform(...canvas.viewportTransform)
  for (const object of texts ?? canvas.getObjects()) {
    if (object instanceof Textbox && object.visible) object.render(context)
  }
  return source
}
