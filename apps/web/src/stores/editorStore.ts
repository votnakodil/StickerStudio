import { create } from 'zustand'
import type { createStickerCanvas } from '@sticker-studio/editor'

type StickerCanvas = ReturnType<typeof createStickerCanvas>

interface EditorStore {
  canvas: StickerCanvas | null
  setCanvas: (canvas: StickerCanvas | null) => void
}

export const useEditorStore = create<EditorStore>((set) => ({
  canvas: null,

  setCanvas: (canvas) => {
    set({ canvas })
  },
}))