import anton from '../assets/stickers/anton.png'
import nastya from '../assets/stickers/nastya.png'
import max from '../assets/stickers/max.png'
import sanya from '../assets/stickers/sanya.png'
import type { StickerCanvasPreset } from '@sticker-studio/editor'

export interface StickerTemplate {
  id: string
  name: string
  editorDefaults?: StickerCanvasPreset
  preview: {
    src: string
    darkSrc?: string
    framing?: {
      scale: number
      x: number
      y: number
    }
    visibleBounds: { left: number; top: number; width: number; height: number }
  }
}

function defaultPreset(name: string, imageTop = 50, imageSize = 1024, imageLeft = (1024 - imageSize) / 2): StickerCanvasPreset {
  return {
    image: { left: imageLeft, top: imageTop, width: imageSize, height: imageSize, opacity: 1 },
    texts: [
      {
        text: name.toUpperCase(), left: 0, top: -7, width: 1010, frameHeight: 186.45,
        fontFamily: 'SF Pro Text', fontSize: 165, fontWeight: 900, fill: '#ffffff',
        textAlign: 'center', verticalAlign: 'middle', autoSize: true,
        stroke: { enabled: true, width: 7, color: '#17191f', opacity: 1 },
      },
      {
        text: 'TEXT', left: 0, top: 880, width: 1010, frameHeight: 113,
        fontFamily: 'SF Pro Text', fontSize: 100, fontWeight: 900, fill: '#ffffff',
        textAlign: 'center', verticalAlign: 'middle', autoSize: true,
        stroke: { enabled: true, width: 7, color: '#17191f', opacity: 1 },
      },
    ],
  }
}

export const stickers: readonly StickerTemplate[] = [
  { id: 'anton', name: 'Anton', editorDefaults: defaultPreset('Anton', 33, 992, 33), preview: { src: anton, framing: { scale: 1.08, x: -10, y: -5 }, visibleBounds: { left: 113, top: 56, width: 399, height: 456 } } },
  { id: 'nastya', name: 'Nastya', editorDefaults: defaultPreset('Nastya', 0), preview: { src: nastya, framing: { scale: 1, x: 0, y: 2 }, visibleBounds: { left: 0, top: 100, width: 512, height: 412 } } },
  { id: 'max', name: 'Max', editorDefaults: defaultPreset('Max'), preview: { src: max, framing: { scale: 1.2, x: 0, y: -2 }, visibleBounds: { left: 96, top: 64, width: 320, height: 448 } } },
  { id: 'sanya', name: 'Sanya', editorDefaults: defaultPreset('Sanya', 62, 900), preview: { src: sanya, framing: { scale: 1.09, x: 0, y: 0 }, visibleBounds: { left: 105, top: 67, width: 301, height: 375 } } },
]

/** Mirrors initializeStickerCanvas's placement for the 512 px transparent template artwork. */
export function initialStickerImagePlacement(sticker: StickerTemplate) {
  if (sticker.editorDefaults) return { ...sticker.editorDefaults.image, angle: 0, opacity: sticker.editorDefaults.image.opacity ?? 1 }
  const bounds = sticker.preview.visibleBounds
  const scale = Math.min(512 / bounds.width, 640 / bounds.height)
  const size = 512 * scale
  const centerX = 512 - (bounds.left + bounds.width / 2 - 256) * scale
  const centerY = 512 - (bounds.top + bounds.height / 2 - 256) * scale
  return { left: centerX - size / 2, top: centerY - size / 2, width: size, height: size, angle: 0, opacity: 1 }
}

export function findStickerById(id: string | undefined): StickerTemplate | undefined {
  const currentId = id === 'party-max' ? 'max' : id
  return stickers.find((sticker) => sticker.id === currentId)
}
