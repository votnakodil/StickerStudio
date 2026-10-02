import type { StickerCanvas, StickerTemplateText, StickerTextbox } from '../types'
import { addStickerImage, getVisibleImageBounds } from '../images/imageOperations'
import { Textbox } from 'fabric'
import { normalizeStickerFontWeight } from '../fontWeights'
import { getTextContentHeight, fitStickerText } from '../text/textLayout'
import { DEFAULT_STROKE } from '../stroke/stroke'
import { configureStickerText } from '../text/configureText'
import { serializeCanvas } from '../history/history'
import { createStickerText } from '../text/textOperations'

export async function initializeStickerCanvas(
  canvas: StickerCanvas,
  source: string,
  text: StickerTemplateText,
  signal?: AbortSignal,
) {
  const image = await addStickerImage(canvas, source, signal)
  if (text.preset) {
    const preset = text.preset
    image.set({
      left: preset.image.left + preset.image.width / 2,
      top: preset.image.top + preset.image.height / 2,
      scaleX: preset.image.width / image.width,
      scaleY: preset.image.height / image.height,
      opacity: preset.image.opacity ?? 1,
    })
    image.setCoords()
    // Presets list text layers from front to back, like the Layers panel.
    for (const layer of [...preset.texts].reverse()) {
      const textbox = new Textbox(layer.text, {
        left: layer.left, top: layer.top, originX: 'left', originY: 'top',
        width: layer.width, fontFamily: layer.fontFamily, fontSize: layer.fontSize,
        fontWeight: normalizeStickerFontWeight(layer.fontFamily, layer.fontWeight),
        fill: layer.fill, textAlign: layer.textAlign,
      }) as StickerTextbox
      textbox.stickerAutoSize = layer.autoSize ?? true
      textbox.stickerMaxFontSize = layer.fontSize
      textbox.stickerFrameHeight = textbox.stickerAutoSize
        ? layer.frameHeight : Math.max(layer.frameHeight, getTextContentHeight(textbox))
      textbox.stickerVerticalAlign = layer.verticalAlign
      textbox.stickerCustomFill = true
      textbox.stickerStroke = layer.stroke ? { ...layer.stroke } : { ...DEFAULT_STROKE }
      configureStickerText(textbox)
      if (textbox.stickerAutoSize) fitStickerText(textbox, layer.width)
      canvas.add(textbox)
    }
    canvas.discardActiveObject()
    canvas.requestRenderAll()
    canvas.history = [serializeCanvas(canvas)]
    canvas.historyIndex = 0
    return image
  }
  const bounds = getVisibleImageBounds(image)
  const scale = Math.min(512 / bounds.width, 640 / bounds.height)

  image.set({
    left: 512 - (bounds.left + bounds.width / 2 - image.width / 2) * scale,
    top: 512 - (bounds.top + bounds.height / 2 - image.height / 2) * scale,
    scaleX: scale,
    scaleY: scale,
  })
  image.setCoords()

  canvas.add(
    createStickerText(text.topText, 512, 108, canvas.stickerTextColor),
    createStickerText(text.bottomText, 512, 912, canvas.stickerTextColor),
  )
  canvas.discardActiveObject()
  canvas.requestRenderAll()
  canvas.history = [serializeCanvas(canvas)]
  canvas.historyIndex = 0
  return image
}
