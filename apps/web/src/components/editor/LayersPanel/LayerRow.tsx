import { useRef } from 'react'
import { Reorder, useDragControls, useReducedMotion } from 'motion/react'
import { IconEye, IconEyeSlash, IconPhoto, IconTextformat } from 'symbols-react'
import { selectStickerLayer, setStickerLayerVisibility, type StickerCanvas, type StickerLayer } from '@sticker-studio/editor'
import styles from './LayersPanel.module.css'

export function LayerRow({ layer, canvas, onCommit, onKeyboardMove }: {
  layer: StickerLayer
  canvas: StickerCanvas
  onCommit: (id: string) => void
  onKeyboardMove: (id: string, direction: number) => void
}) {
  const controls = useDragControls()
  const dragged = useRef(false)
  const reduce = useReducedMotion()

  return (
    <Reorder.Item as="li" value={layer.id} className={styles.row}
      data-layer-id={layer.id} data-selected={layer.selected || undefined} data-hidden={!layer.visible || undefined}
      dragListener={false} dragControls={controls}
      onDragStart={() => { dragged.current = true }}
      onDragEnd={() => onCommit(layer.id)}
      whileDrag={{ scale: reduce ? 1 : 1.025, boxShadow: '0 8px 20px rgba(0,0,0,0.16)' }}
      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 32, mass: 0.65 }}
    >
      <button type="button" className={`${styles.layerButton} ${styles.draggableButton}`}
        aria-label={`Select ${layer.title} layer`} aria-pressed={layer.selected}
        aria-description="Drag to change layer order. Alt and arrow up or down also move the layer."
        aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
        onPointerDown={(event) => {
          dragged.current = false
          if (event.button === 0) controls.start(event)
        }}
        onClick={(event) => {
          if (event.detail !== 0 && dragged.current) return
          selectStickerLayer(canvas, layer.index, event.shiftKey)
        }}
        onKeyDown={(event) => {
          if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return
          event.preventDefault()
          onKeyboardMove(layer.id, event.key === 'ArrowUp' ? -1 : 1)
        }}
      >
        <span className={styles.thumbnail} aria-hidden="true">
          {layer.kind === 'image' && layer.thumbnail ? <img src={layer.thumbnail} alt="" draggable={false} />
            : layer.kind === 'text' ? <IconTextformat width={19} height={19} fill="currentColor" />
              : <IconPhoto width={19} height={19} fill="currentColor" />}
        </span>
        <span className={styles.label}>
          <span className={styles.title} title={layer.title}>{layer.title}</span>
          <span className={styles.detail}>{layer.detail}</span>
        </span>
      </button>
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
