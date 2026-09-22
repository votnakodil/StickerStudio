import {
  addStickerText,
  deleteSelectedObjects,
  redo,
  undo,
} from '@sticker-studio/editor'
import { motion } from 'motion/react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useEditorStore } from '../../stores/editorStore'

export function EditorToolbar() {
  const canvas = useEditorStore((state) => state.canvas)

  const handleAddText = () => {
    if (!canvas) {
      return
    }

    addStickerText(canvas)
  }

  const handleDelete = () => {
    if (!canvas) {
      return
    }

    deleteSelectedObjects(canvas)
  }

  const handleUndo = () => {
    if (!canvas) {
      return
    }

    void undo(canvas)
  }

  const handleRedo = () => {
    if (!canvas) {
      return
    }

    void redo(canvas)
  }

  useHotkeys(
    ['backspace', 'delete'],
    handleDelete,
    {
      preventDefault: true,
      enabled: Boolean(canvas),
    },
  )

  useHotkeys(
    'meta+z',
    handleUndo,
    {
      preventDefault: true,
      enabled: Boolean(canvas),
    },
  )

  useHotkeys(
    'meta+shift+z',
    handleRedo,
    {
      preventDefault: true,
      enabled: Boolean(canvas),
    },
  )

  return (
    <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-neutral-800/80 p-2 shadow-2xl backdrop-blur-xl">
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

      <motion.button
        type="button"
        disabled={!canvas}
        onClick={handleUndo}
        whileTap={{ scale: 0.9 }}
        className="flex h-10 w-10 items-center justify-center rounded-xl text-lg text-white transition-colors hover:bg-white/10 disabled:opacity-30"
        title="Undo"
      >
        ↶
      </motion.button>

      <motion.button
        type="button"
        disabled={!canvas}
        onClick={handleRedo}
        whileTap={{ scale: 0.9 }}
        className="flex h-10 w-10 items-center justify-center rounded-xl text-lg text-white transition-colors hover:bg-white/10 disabled:opacity-30"
        title="Redo"
      >
        ↷
      </motion.button>

      <motion.button
        type="button"
        disabled={!canvas}
        onClick={handleDelete}
        whileTap={{ scale: 0.9 }}
        className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-medium text-white transition-colors hover:bg-white/10 disabled:opacity-30"
        title="Delete selection"
      >
        ⌫
      </motion.button>
    </div>
  )
}