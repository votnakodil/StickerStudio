import {
  useMemo,
  useState,
  type CSSProperties,
} from 'react'
import {
  Hand,
  MousePointer2,
  Redo2,
  Trash2,
  Type,
  Undo2,
} from 'lucide-react'
import {
  addStickerText,
  deleteSelectedObjects,
  redo,
  setEditorTool,
  undo,
} from '@sticker-studio/editor'
import { useHotkeys } from 'react-hotkeys-hook'
import { useEditorStore } from '../../../stores/editorStore'
import styles from './CanvasToolbar.module.css'

type ToolId =
  | 'move'
  | 'hand'
  | 'text'

export interface CanvasToolbarProps {
  corner?: number
}

export function CanvasToolbar({
  corner = 14,
}: CanvasToolbarProps) {
  const canvas = useEditorStore(
    (state) => state.canvas,
  )

  const [tool, setTool] =
    useState<ToolId>('move')

  const safeCorner = Math.min(
    25,
    Math.max(0, corner),
  )

  const toolCorner = Math.max(
    0,
    safeCorner - 4,
  )

  const toolbarStyle = useMemo(
    () =>
      ({
        '--bar-corner': `${safeCorner}px`,
        '--bar-tool-corner': `${toolCorner}px`,
      }) as CSSProperties,
    [safeCorner, toolCorner],
  )

  const selectTool = (
    nextTool: ToolId,
  ) => {
    setTool(nextTool)

    if (!canvas) {
      return
    }

    if (nextTool === 'move') {
      setEditorTool(
        canvas,
        'move',
      )

      return
    }

    if (nextTool === 'hand') {
      setEditorTool(
        canvas,
        'hand',
      )

      return
    }

    if (nextTool === 'text') {
      setEditorTool(
        canvas,
        'move',
      )

      addStickerText(canvas)
    }
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

  const handleDelete = () => {
    if (!canvas) {
      return
    }

    deleteSelectedObjects(canvas)
  }

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

  useHotkeys(
    ['backspace', 'delete'],
    handleDelete,
    {
      preventDefault: true,
      enabled: Boolean(canvas),
    },
  )

  return (
    <div
      className={styles.barWell}
      style={toolbarStyle}
    >
      <div
        className={styles.barRail}
        role="toolbar"
        aria-label="Sticker tools"
      >
        <button
          type="button"
          className={styles.barTool}
          data-active={
            tool === 'move' ||
            undefined
          }
          aria-label="Move"
          aria-pressed={
            tool === 'move'
          }
          title="Move"
          onClick={() =>
            selectTool('move')
          }
        >
          <MousePointer2
            size={18}
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </button>

        <button
          type="button"
          className={styles.barTool}
          data-active={
            tool === 'hand' ||
            undefined
          }
          aria-label="Hand"
          aria-pressed={
            tool === 'hand'
          }
          title="Hand"
          onClick={() =>
            selectTool('hand')
          }
        >
          <Hand
            size={18}
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </button>

        <div
          className={styles.barSplit}
        />

        <button
          type="button"
          className={styles.barTool}
          data-active={
            tool === 'text' ||
            undefined
          }
          aria-label="Add text"
          aria-pressed={
            tool === 'text'
          }
          title="Add text"
          onClick={() =>
            selectTool('text')
          }
        >
          <Type
            size={18}
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </button>

        <div
          className={styles.barSplit}
        />

        <button
          type="button"
          className={styles.barTool}
          aria-label="Undo"
          title="Undo"
          onClick={handleUndo}
        >
          <Undo2
            size={18}
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </button>

        <button
          type="button"
          className={styles.barTool}
          aria-label="Redo"
          title="Redo"
          onClick={handleRedo}
        >
          <Redo2
            size={18}
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </button>

        <button
          type="button"
          className={styles.barTool}
          aria-label="Delete"
          title="Delete"
          onClick={handleDelete}
        >
          <Trash2
            size={18}
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </button>
      </div>
    </div>
  )
}