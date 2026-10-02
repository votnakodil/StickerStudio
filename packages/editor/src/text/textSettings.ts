import type { Textbox } from 'fabric'
import type { StickerTextbox } from '../types'

export function getStickerTextAutoSize(text: Textbox) {
  return (text as StickerTextbox).stickerAutoSize !== false
}
