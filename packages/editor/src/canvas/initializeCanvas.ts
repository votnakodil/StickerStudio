import type { StickerCanvas, StickerTemplateText, StickerTextbox, StickerImage } from '../types'
import { addStickerImage, getVisibleImageBounds } from '../images/imageOperations'
import { Textbox, type FabricImage } from 'fabric'
import { normalizeStickerFontWeight } from '../fontWeights'
import { getTextContentHeight, fitStickerText } from '../text/textLayout'
import { DEFAULT_STROKE, normalizeStroke, applyImageStroke } from '../stroke/stroke'
import { configureStickerText } from '../text/configureText'
import { serializeCanvas } from '../history/history'
import { updateStickerImageSmoothing } from '../images/imageSmoothing'
import { createDefaultStickerTextLayers } from '../text/defaultTextLayers'
import { prepareImageOutline } from '../images/imageOutline'

export async function initializeStickerCanvas(
  canvas: StickerCanvas,
  source: string,
  text: StickerTemplateText,
  signal?: AbortSignal,
  onLayoutReady?: (image: FabricImage) => void,
) {
  const image = await addStickerImage(canvas, source, signal)
  ;(image as StickerImage).stickerStroke = normalizeStroke(text.imageStroke ?? { ...DEFAULT_STROKE, enabled: true })
  applyImageStroke(image as StickerImage)
  if (text.imageRoundness !== undefined) updateStickerImageSmoothing(canvas, image, text.imageRoundness, false)
  image.dirty = true
  canvas.cancelRequestedRender()
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
  } else {
    const bounds = text.imageFit
      ? { left: 0, top: 0, width: image.width, height: image.height }
      : getVisibleImageBounds(image)
    const fit = text.imageFit ?? { width: 512, height: 640 }
    const scale = Math.min(fit.width / bounds.width, fit.height / bounds.height)

    image.set({
      left: 512 - (bounds.left + bounds.width / 2 - image.width / 2) * scale,
      top: 512 - (bounds.top + bounds.height / 2 - image.height / 2) * scale,
      scaleX: scale,
      scaleY: scale,
    })
    image.setCoords()
  }
  const layers = text.preset?.texts ?? createDefaultStickerTextLayers(text.topText, text.bottomText)
  // Presets list text layers from front to back, like the Layers panel.
  for (const layer of [...layers].reverse()) {
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
  signal?.throwIfAborted()
  onLayoutReady?.(image)
  // Expose final layout before the worker finishes, but prevent an early render
  // from rebuilding the same contour synchronously on the animation thread.
  canvas.cancelRequestedRender()
  await prepareImageOutline(image as StickerImage, signal)
  canvas.requestRenderAll()
  canvas.history = [serializeCanvas(canvas)]
  canvas.historyIndex = 0
  return image
}
