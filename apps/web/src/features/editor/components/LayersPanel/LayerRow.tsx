import { useLayoutEffect, useRef, useState } from 'react'
import { Textbox } from 'fabric'
import { Reorder, useDragControls, useReducedMotion } from 'motion/react'
import { IconEye, IconEyeSlash, IconPhoto, IconTextformat } from 'symbols-react'
import { selectStickerLayer, setStickerLayerVisibility, updateStickerTextContent, type StickerCanvas, type StickerLayer } from '@sticker-studio/editor'
import { useEditorStore } from '../../model/editorStore'
import styles from './LayersPanel.module.css'

export function LayerRow({ layer, canvas, onCommit, onKeyboardMove }: {
  layer: StickerLayer
  canvas: StickerCanvas
  onCommit: (id: string) => void
  onKeyboardMove: (id: string, direction: number) => void
}) {
  const activeTool = useEditorStore(state => state.activeTool)
  const selectTool = useEditorStore(state => state.selectTool)
  const controls = useDragControls()
  const dragged = useRef(false)
  const reduce = useReducedMotion()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [returnedFromEdit, setReturnedFromEdit] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const editTarget = useRef<Textbox | null>(null)
  const restoreFocus = useRef(false)
  useLayoutEffect(() => {
    if (editing) { inputRef.current?.focus(); inputRef.current?.select() }
    else if (restoreFocus.current) { restoreFocus.current = false; buttonRef.current?.focus() }
  }, [editing])
  const beginEditing = () => {
    const target = canvas.getObjects()[layer.index]
    if (layer.kind !== 'text' || !(target instanceof Textbox)) return
    if (activeTool === 'quick-selection' || activeTool === 'eraser') selectTool('move')
    selectStickerLayer(canvas, layer.index)
    editTarget.current = target
    setDraft(target.text)
    setEditing(true)
  }
  const finishEditing = (save: boolean, focus: boolean) => {
    const target = editTarget.current
    if (!target) return
    editTarget.current = null
    restoreFocus.current = focus
    setReturnedFromEdit(focus)
    if (save) updateStickerTextContent(canvas, target, draft)
    setEditing(false)
  }
  const thumbnail = <span className={styles.thumbnail} aria-hidden="true">
    {layer.kind === 'image' && layer.thumbnail ? <img src={layer.thumbnail} alt="" draggable={false} />
      : layer.kind === 'text' ? <IconTextformat width={19} height={19} fill="currentColor" />
        : <IconPhoto width={19} height={19} fill="currentColor" />}
  </span>
  const label = <span className={styles.label}>
    {editing ? <input ref={inputRef} className={`${styles.title} ${styles.titleInput}`}
      aria-label="Edit layer text" value={draft} onChange={event => setDraft(event.target.value)}
      onBlur={() => finishEditing(true, false)}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing) return
        if (event.key === 'Enter' || event.key === 'Escape') {
          event.preventDefault(); event.stopPropagation()
          finishEditing(event.key === 'Enter', true)
        }
      }} /> : <span className={styles.title} title={layer.title}>{layer.title}</span>}
    <span className={styles.detail}>{layer.detail}</span>
  </span>

  return (
    <Reorder.Item as="li" value={layer.id} className={styles.row}
      data-layer-id={layer.id} data-selected={layer.selected || undefined} data-hidden={!layer.visible || undefined}
      dragListener={false} dragControls={controls}
      onDragStart={() => { dragged.current = true }}
      onDragEnd={() => onCommit(layer.id)}
      whileDrag={{ scale: reduce ? 1 : 1.025, boxShadow: '0 8px 20px var(--palette-black-alpha16)' }}
      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 32, mass: 0.65 }}
    >
      {editing ? <div className={styles.layerButton}>{thumbnail}{label}</div> :
      <button ref={buttonRef} type="button" className={`${styles.layerButton} ${styles.draggableButton}`}
        aria-label={`Select ${layer.title} layer`} aria-pressed={layer.selected}
        data-edit-return={returnedFromEdit || undefined}
        onBlur={() => setReturnedFromEdit(false)}
        aria-description="Drag to change layer order. Alt and arrow up or down also move the layer."
        aria-keyshortcuts={layer.kind === 'text' ? 'F2 Alt+ArrowUp Alt+ArrowDown' : 'Alt+ArrowUp Alt+ArrowDown'}
        onPointerDown={(event) => {
          dragged.current = false
          if (event.button === 0) controls.start(event)
        }}
        onClick={(event) => {
          if (event.detail !== 0 && dragged.current) return
          if (layer.kind === 'text' && activeTool === 'quick-selection') selectTool('move')
          selectStickerLayer(canvas, layer.index, event.shiftKey)
        }}
        onDoubleClick={beginEditing}
        onKeyDown={(event) => {
          setReturnedFromEdit(false)
          if (event.key === 'F2' && layer.kind === 'text') { event.preventDefault(); beginEditing(); return }
          if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return
          event.preventDefault()
          onKeyboardMove(layer.id, event.key === 'ArrowUp' ? -1 : 1)
        }}
      >
        {thumbnail}{label}
      </button>}
      <button type="button" className={styles.visibilityButton}
        aria-label={`${layer.visible ? 'Hide' : 'Show'} ${layer.title} layer`} aria-pressed={layer.visible}
        title={layer.visible ? 'Hide layer' : 'Show layer'}
        onClick={() => setStickerLayerVisibility(canvas, layer.index, !layer.visible)}
      >
        {layer.visible ? <IconEye width={17} height={17} fill="currentColor" aria-hidden="true" />
          : <IconEyeSlash width={17} height={17} fill="currentColor" aria-hidden="true" />}
      </button>
    </Reorder.Item>
  )
}
