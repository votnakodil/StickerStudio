import { useEffect, useState } from 'react'
import { BackButton } from '@/shared/ui/BackButton/BackButton'
import { motion, Reorder } from 'motion/react'
import {
  IconPlus,
  IconSquareStack,
} from 'symbols-react'
import {
  addStickerText,
  commitStickerLayerOrder,
  getStickerCanvasBackground,
  getStickerLayers,
  selectStickerCanvas,
  reorderStickerLayers,
  subscribeStickerCanvasBackground,
  type StickerLayer,
} from '@sticker-studio/editor'
import { useEditorStore } from '@/features/editor/model/editorStore'
import styles from './LayersPanel.module.css'
import { LayerRow } from '@/features/editor/components/LayersPanel/LayerRow'
import { ExportPanel } from '@/features/editor/components/ExportPanel/ExportPanel'

export function LayersPanel({ onBeforeBack, stickerId }: { onBeforeBack?: () => void; stickerId?: string }) {
  const canvas = useEditorStore((state) => state.canvas)
  const [layers, setLayers] = useState<StickerLayer[]>([])
  const displayedLayers = canvas ? layers : []

  const reorder = (ids: string[]) => {
    if (!canvas || !reorderStickerLayers(canvas, ids)) return
    setLayers(getStickerLayers(canvas))
  }

  const moveWithKeyboard = (id: string, direction: number) => {
    if (!canvas) return
    const ids = getStickerLayers(canvas).map((layer) => layer.id)
    const from = ids.indexOf(id)
    const to = from + direction
    if (from < 0 || to < 0 || to >= ids.length) return
    ids.splice(from, 1)
    ids.splice(to, 0, id)
    reorder(ids)
    commitStickerLayerOrder(canvas, id)
  }

  useEffect(() => {
    if (!canvas) return

    const syncLayers = () => setLayers(getStickerLayers(canvas))
    const events = [
      'object:added',
      'object:removed',
      'object:modified',
      'text:changed',
      'selection:created',
      'selection:updated',
      'selection:cleared',
    ] as const

    syncLayers()
    events.forEach((event) => canvas.on(event, syncLayers))
    const unsubscribeBackground = subscribeStickerCanvasBackground(canvas, syncLayers)

    return () => {
      events.forEach((event) => canvas.off(event, syncLayers))
      unsubscribeBackground()
    }
  }, [canvas])

  return (
    <aside className={styles.panel} aria-label="Layers">
      <div className={styles.surface}>
        <header className={styles.header}>
          <BackButton to="/library" state={{ returningSticker: stickerId }} aria-label="Back to sticker library" title="Back to library"
            onClick={(event) => {
              if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) onBeforeBack?.()
            }}>
          </BackButton>
          <div className={styles.heading}>
            <IconSquareStack width={18} height={18} fill="currentColor" aria-hidden="true" />
            <h2>Layers</h2>
            <span className={styles.count}>{canvas ? displayedLayers.length + 1 : 0}</span>
          </div>
          <button
            type="button"
            className={styles.addButton}
            aria-label="Add text layer"
            title="Add text layer"
            disabled={!canvas}
            onClick={() => canvas && addStickerText(canvas)}
          >
            <IconPlus width={16} height={16} fill="currentColor" aria-hidden="true" />
          </button>
        </header>

        <motion.div className={styles.list} layoutScroll>
          <Reorder.Group as="ol" axis="y" className={styles.objectList} values={displayedLayers.map((layer) => layer.id)} onReorder={reorder}>
            {canvas && displayedLayers.map((layer) => <LayerRow key={layer.id} layer={layer} canvas={canvas}
              onCommit={(id) => commitStickerLayerOrder(canvas, id)} onKeyboardMove={moveWithKeyboard} />)}
          </Reorder.Group>
          {canvas && (
            <ol className={styles.canvasList}>
            <li className={styles.row} data-selected={displayedLayers.every((layer) => !layer.selected) || undefined}>
              <button
                type="button"
                className={styles.layerButton}
                aria-label="Select canvas"
                aria-pressed={displayedLayers.every((layer) => !layer.selected)}
                onClick={() => selectStickerCanvas(canvas)}
              >
                <span className={`${styles.thumbnail} ${styles.canvasThumbnail}`} aria-hidden="true" style={getStickerCanvasBackground(canvas) === 'transparent' ? undefined : {
                  backgroundColor: getStickerCanvasBackground(canvas),
                  backgroundImage: 'none',
                }} />
                <span className={styles.label}>
                  <span className={styles.title}>Canvas</span>
                  <span className={styles.detail}>{canvas.getWidth()} × {canvas.getHeight()} px</span>
                </span>
              </button>
            </li>
            </ol>
          )}
        </motion.div>
        <footer className={styles.footer}>
          <ExportPanel canvas={canvas} stickerName={stickerId} />
        </footer>
      </div>
    </aside>
  )
}
