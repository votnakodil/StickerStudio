import { addStickerText } from '@sticker-studio/editor'
import { motion } from 'motion/react'
import { useEditorStore } from '../../stores/editorStore'

export function EditorToolbar() {
  const canvas = useEditorStore((state) => state.canvas)

  const handleAddText = () => {
    if (!canvas) {
      return
    }

    addStickerText(canvas)
  }

  return (
    <div className="flex items-center rounded-2xl border border-white/10 bg-neutral-800/80 p-2 shadow-2xl backdrop-blur-xl">
      <motion.button
        type="button"
        disabled={!canvas}
        onClick={handleAddText}
        whileTap={{ scale: 0.9 }}
        className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-semibold text-white transition-colors hover:bg-white/10 disabled:opacity-30"
        title="Add text"
      >
        T
      </motion.button>
    </div>
  )
}