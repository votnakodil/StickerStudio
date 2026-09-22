import {
  useMemo,
  useState,
  type CSSProperties,
} from 'react'
import {
  Circle,
  Frame,
  Hand,
  MousePointer2,
  PenTool,
  Redo2,
  Slash,
  Square,
  Star,
  Trash2,
  Type,
  Undo2,
  type LucideIcon,
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
  | 'frame'
  | 'shape'
  | 'pen'
  | 'text'

type ShapeId =
  | 'rect'
  | 'oval'
  | 'line'
  | 'star'

interface ShapeDefinition {
  id: ShapeId
  label: string
  icon: LucideIcon
}

interface ToolDefinition {
  id: Exclude<ToolId, 'shape'>
  label: string
  icon: LucideIcon
}

export interface CanvasToolbarProps {
  corner?: number
}

const TOOLS: ToolDefinition[] = [
  {
    id: 'move',
    label: 'Move',
    icon: MousePointer2,
  },
  {
    id: 'hand',
    label: 'Hand',
    icon: Hand,
  },
  {
    id: 'frame',
    label: 'Frame',
    icon: Frame,
  },
]

const TRAILING_TOOLS: ToolDefinition[] = [
  {
    id: 'pen',
    label: 'Pen',
    icon: PenTool,
  },
  {
    id: 'text',
    label: 'Text',
    icon: Type,
  },
]

const SHAPES: ShapeDefinition[] = [
  {
    id: 'rect',
    label: 'Rectangle',
    icon: Square,
  },
  {
    id: 'oval',
    label: 'Oval',
    icon: Circle,
  },
  {
    id: 'line',
    label: 'Line',
    icon: Slash,
  },
  {
    id: 'star',
    label: 'Star',
    icon: Star,
  },
]

export function CanvasToolbar({
  corner = 14,
}: CanvasToolbarProps) {
  const canvas = useEditorStore(
    (state) => state.canvas,
  )

  const [tool, setTool] =
    useState<ToolId>('move')

  const [shape, setShape] =
    useState<ShapeDefinition>(SHAPES[0])

  const [shapeMenuOpen, setShapeMenuOpen] =
    useState(false)

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

    if (nextTool !== 'shape') {
      setShapeMenuOpen(false)
    }

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

  const selectShape = (
    nextShape: ShapeDefinition,
  ) => {
    setShape(nextShape)
    setTool('shape')
    setShapeMenuOpen(false)
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

  const ShapeIcon = shape.icon

  return (
    <div
      className={styles.barWell}
      style={toolbarStyle}
    >
      <div
        className={styles.barRail}
        role="toolbar"
        aria-label="Canvas tools"
      >
        {TOOLS.map((item) => {
          const Icon = item.icon
          const active =
            tool === item.id

          return (
            <button
              key={item.id}
              type="button"
              className={styles.barTool}
              data-active={
                active || undefined
              }
              aria-label={item.label}
              aria-pressed={active}
              title={item.label}
              onClick={() =>
                selectTool(item.id)
              }
            >
              <Icon
                size={18}
                strokeWidth={1.8}
                aria-hidden="true"
              />
            </button>
          )
        })}

        <div
          className={styles.barSplit}
        />

        <div
          className={styles.barSlot}
        >
          <button
            type="button"
            className={`${styles.barTool} ${styles.barNotch}`}
            data-active={
              tool === 'shape' ||
              undefined
            }
            data-open={
              shapeMenuOpen ||
              undefined
            }
            aria-label={shape.label}
            aria-pressed={
              tool === 'shape'
            }
            title={shape.label}
            onClick={() =>
              selectTool('shape')
            }
          >
            <ShapeIcon
              size={18}
              strokeWidth={1.8}
              aria-hidden="true"
            />
          </button>

          <button
            type="button"
            className={
              styles.barNotchTrigger
            }
            aria-label="Choose shape"
            aria-expanded={
              shapeMenuOpen
            }
            onClick={() =>
              setShapeMenuOpen(
                (open) => !open,
              )
            }
          />

          {shapeMenuOpen && (
            <div
              className={
                styles.barFlyout
              }
              role="menu"
              aria-label="Shapes"
            >
              {SHAPES.map((item) => {
                const Icon =
                  item.icon

                const active =
                  shape.id === item.id

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={
                      styles.barTool
                    }
                    data-active={
                      active ||
                      undefined
                    }
                    role="menuitem"
                    aria-label={
                      item.label
                    }
                    title={item.label}
                    onClick={() =>
                      selectShape(item)
                    }
                  >
                    <Icon
                      size={18}
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div
          className={styles.barSplit}
        />

        {TRAILING_TOOLS.map(
          (item) => {
            const Icon = item.icon
            const active =
              tool === item.id

            return (
              <button
                key={item.id}
                type="button"
                className={
                  styles.barTool
                }
                data-active={
                  active ||
                  undefined
                }
                aria-label={
                  item.label
                }
                aria-pressed={active}
                title={item.label}
                onClick={() =>
                  selectTool(item.id)
                }
              >
                <Icon
                  size={18}
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              </button>
            )
          },
        )}

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