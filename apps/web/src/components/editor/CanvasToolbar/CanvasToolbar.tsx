import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import {
  IconArrowUturnLeft,
  IconArrowUturnRight,
  IconCursorarrow,
  IconHandRaised,
  IconTextformat,
  IconTrash,
} from 'symbols-react'
import {
  addStickerText,
  deleteSelectedObjects,
  redo,
  setEditorTool,
  undo,
} from '@sticker-studio/editor'
import { useHotkeys } from 'react-hotkeys-hook'
import { animate, motion, useMotionValue, useReducedMotion } from 'motion/react'
import { useEditorStore } from '../../../stores/editorStore'
import { SPRING_EDITOR_REVEAL } from '../../../lib/ease'
import styles from './CanvasToolbar.module.css'

type ToolId =
  | 'move'
  | 'hand'
  | 'text'

type ToolbarPosition = { x: number; y: number }
type PixelPosition = { left: number; top: number }

const TOOLBAR_POSITION_KEY = 'sticker-studio:toolbar-position'
const TOOLBAR_MARGIN = 8

function loadToolbarPosition(): ToolbarPosition | null {
  try {
    const stored = window.localStorage.getItem(TOOLBAR_POSITION_KEY)
    if (!stored) return null
    const position = JSON.parse(stored) as ToolbarPosition
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) return null
    return { x: Math.min(1, Math.max(0, position.x)), y: Math.min(1, Math.max(0, position.y)) }
  } catch {
    return null
  }
}

function toolbarBounds(width: number, height: number) {
  const minLeft = width + TOOLBAR_MARGIN * 2 <= window.innerWidth ? TOOLBAR_MARGIN : 0
  const minTop = height + TOOLBAR_MARGIN * 2 <= window.innerHeight ? TOOLBAR_MARGIN : 0
  return {
    minLeft,
    maxLeft: Math.max(minLeft, window.innerWidth - width - minLeft),
    minTop,
    maxTop: Math.max(minTop, window.innerHeight - height - minTop),
  }
}

function clampToolbarPosition(left: number, top: number, width: number, height: number): PixelPosition {
  const bounds = toolbarBounds(width, height)
  return {
    left: Math.min(bounds.maxLeft, Math.max(bounds.minLeft, left)),
    top: Math.min(bounds.maxTop, Math.max(bounds.minTop, top)),
  }
}

function toolbarEntrance(position: PixelPosition, width: number, height: number) {
  const { left, top } = position
  const right = window.innerWidth - left - width
  const bottom = window.innerHeight - top - height
  const padding = 48
  const edge = Math.min(left, right, top, bottom)
  if (edge === left) return { x: -left - width - padding, y: 0 }
  if (edge === right) return { x: right + width + padding, y: 0 }
  if (edge === top) return { x: 0, y: -top - height - padding }
  return { x: 0, y: bottom + height + padding }
}

export interface CanvasToolbarProps {
  corner?: number
}

export function CanvasToolbar({
  corner = 14,
}: CanvasToolbarProps) {
  const reduceMotion = useReducedMotion()
  const canvas = useEditorStore(
    (state) => state.canvas,
  )

  const [tool, setTool] =
    useState<ToolId>('move')
  const [savedPosition, setSavedPosition] = useState<ToolbarPosition | null>(loadToolbarPosition)
  const [pixelPosition, setPixelPosition] = useState<PixelPosition | null>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const barEntranceRef = useRef<HTMLDivElement>(null)
  const entranceStarted = useRef(false)
  const entranceX = useMotionValue(0)
  const entranceY = useMotionValue(0)
  const latestPosition = useRef<PixelPosition | null>(null)
  const drag = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null)

  useLayoutEffect(() => {
    const placeSavedPosition = () => {
      if (drag.current) return
      if (!barRef.current) return
      const rect = barRef.current.getBoundingClientRect()
      const bounds = toolbarBounds(rect.width, rect.height)
      const next = savedPosition ? {
        left: bounds.minLeft + savedPosition.x * (bounds.maxLeft - bounds.minLeft),
        top: bounds.minTop + savedPosition.y * (bounds.maxTop - bounds.minTop),
      } : { left: rect.left, top: rect.top }
      latestPosition.current = savedPosition ? next : null
      setPixelPosition(savedPosition ? next : null)

      if (!entranceStarted.current) {
        entranceStarted.current = true
        if (!reduceMotion) {
          const offset = toolbarEntrance(next, rect.width, rect.height)
          entranceX.set(offset.x)
          entranceY.set(offset.y)
          animate(entranceX, 0, SPRING_EDITOR_REVEAL)
          animate(entranceY, 0, SPRING_EDITOR_REVEAL)
        }
      }
    }

    placeSavedPosition()
    window.addEventListener('resize', placeSavedPosition)
    return () => window.removeEventListener('resize', placeSavedPosition)
  }, [savedPosition, reduceMotion, entranceX, entranceY])

  const updatePosition = (left: number, top: number) => {
    const rect = barRef.current?.getBoundingClientRect()
    if (!rect) return
    const next = clampToolbarPosition(left, top, rect.width, rect.height)
    latestPosition.current = next
    setPixelPosition(next)
  }

  const savePosition = () => {
    const rect = barRef.current?.getBoundingClientRect()
    const position = latestPosition.current
    if (!rect || !position) return
    const bounds = toolbarBounds(rect.width, rect.height)
    const next = {
      x: bounds.maxLeft === bounds.minLeft ? 0 : (position.left - bounds.minLeft) / (bounds.maxLeft - bounds.minLeft),
      y: bounds.maxTop === bounds.minTop ? 0 : (position.top - bounds.minTop) / (bounds.maxTop - bounds.minTop),
    }
    setSavedPosition(next)
    try {
      window.localStorage.setItem(TOOLBAR_POSITION_KEY, JSON.stringify(next))
    } catch {
      // The toolbar remains movable when browser storage is unavailable.
    }
  }

  const startDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || !barRef.current) return
    const rect = barEntranceRef.current?.getBoundingClientRect() ?? barRef.current.getBoundingClientRect()
    entranceX.stop()
    entranceY.stop()
    entranceX.set(0)
    entranceY.set(0)
    drag.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    }
    updatePosition(rect.left, rect.top)
    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  const moveDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const active = drag.current
    if (!active || active.pointerId !== event.pointerId) return
    updatePosition(event.clientX - active.offsetX, event.clientY - active.offsetY)
  }

  const finishDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return
    moveDrag(event)
    drag.current = null
    savePosition()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const moveWithKeyboard = (event: KeyboardEvent<HTMLButtonElement>) => {
    const offset = event.shiftKey ? 20 : 10
    const delta = {
      ArrowLeft: [-offset, 0],
      ArrowRight: [offset, 0],
      ArrowUp: [0, -offset],
      ArrowDown: [0, offset],
    }[event.key]
    if (!delta || !barRef.current) return
    event.preventDefault()
    const rect = barEntranceRef.current?.getBoundingClientRect() ?? barRef.current.getBoundingClientRect()
    entranceX.stop()
    entranceY.stop()
    entranceX.set(0)
    entranceY.set(0)
    updatePosition(rect.left + delta[0], rect.top + delta[1])
    savePosition()
  }

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
        ...(pixelPosition && {
          left: pixelPosition.left,
          top: pixelPosition.top,
          bottom: 'auto',
          transform: 'none',
        }),
      }) as CSSProperties,
    [safeCorner, toolCorner, pixelPosition],
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
      ref={barRef}
      className={styles.barWell}
      style={toolbarStyle}
    >
      <motion.div ref={barEntranceRef} className={styles.barEntrance} style={{ x: entranceX, y: entranceY }}>
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
          <IconCursorarrow
            width="18"
            height="18"
            fill="currentColor"
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
          <IconHandRaised
            width="18"
            height="18"
            fill="currentColor"
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
          <IconTextformat
            width="18"
            height="18"
            fill="currentColor"
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
          <IconArrowUturnLeft
            width="18"
            height="18"
            fill="currentColor"
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
          <IconArrowUturnRight
            width="18"
            height="18"
            fill="currentColor"
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
          <IconTrash
            width="18"
            height="18"
            fill="currentColor"
            aria-hidden="true"
          />
        </button>

        <div className={styles.barSplit} />

        <button
          type="button"
          className={`${styles.barTool} ${styles.barGrip}`}
          aria-label="Move toolbar"
          title="Drag to move toolbar; arrow keys also work"
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          onKeyDown={moveWithKeyboard}
        >
          <span className={styles.barGripDots} aria-hidden="true" />
        </button>
      </div>
      </motion.div>
    </div>
  )
}
