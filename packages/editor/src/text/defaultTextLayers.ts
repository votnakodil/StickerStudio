import { palette } from '@sticker-studio/theme'
import type { StickerCanvasPreset } from '../types'

/** Shared appearance and frame for captions and newly added text. */
export const DEFAULT_TEXT_STYLE = {
  width: 1010, frameHeight: 113, fontSize: 100,
  fontFamily: 'SF Pro Text', fontWeight: 900, fill: palette.ink,
  textAlign: 'center', verticalAlign: 'middle', autoSize: true,
  stroke: { enabled: true, width: 7, color: palette.white, opacity: 1 },
} satisfies Omit<StickerCanvasPreset['texts'][number], 'text' | 'left' | 'top'>

/** Opening captions shared by library templates and new cutout stickers. */
export function createDefaultStickerTextLayers(topText = 'TOP TEXT', bottomText = 'BOTTOM TEXT'): StickerCanvasPreset['texts'] {
  return [
    { text: topText, top: 0, fontSize: 165, frameHeight: 186.45 },
    { text: bottomText, top: 897, fontSize: 100, frameHeight: 113 },
  ].map(layer => ({
    ...DEFAULT_TEXT_STYLE, ...layer, left: 0,
    stroke: { ...DEFAULT_TEXT_STYLE.stroke },
  }))
}
