import { motion, useAnimationControls, useReducedMotion } from 'motion/react'
import { Switch } from '@/shared/ui/Switch/Switch'
import { ShakeFeedback } from '@/shared/ui/ShakeFeedback/ShakeFeedback'
import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { clearQuickSelection, hasQuickSelection, invertQuickSelection, setQuickSelectionOptions, subscribeQuickSelection, type StickerCanvas } from '@sticker-studio/editor'
import { RadioGroup, RadioGroupItem } from '@/shared/ui/RadioGroup/RadioGroup'
import { Button } from '@/shared/ui/Button/Button'
import { BubbleSlider } from '@/shared/ui/BubbleSlider/BubbleSlider'
import { NumberInput } from '@/shared/ui/NumberInput/NumberInput'
import { useEditorStore } from '../../model/editorStore'
import inspector from '../InspectorPanel/InspectorPanel.module.css'
import styles from './QuickSelectionPanel.module.css'

export function QuickSelectionPanel({ canvas }: { canvas: StickerCanvas }) {
  const autoErase = useEditorStore(state => state.quickSelectionAutoErase)
  const setAutoErase = useEditorStore(state => state.setQuickSelectionAutoErase)
  const feedback = useAnimationControls()
  const reduceMotion = useReducedMotion()
  const emphasizeAutoErase = () => {
    if (reduceMotion) return
    feedback.stop()
    void feedback.start({ scale: [1, 1.07, 1], transition: { duration: 0.28, times: [0, 0.35, 1], ease: 'easeOut' } })
  }
  const mode = useEditorStore(state => state.quickSelectionMode)
  const size = useEditorStore(state => state.quickSelectionSize)
  const setMode = useEditorStore(state => state.setQuickSelectionMode)
  const setSize = useEditorStore(state => state.setQuickSelectionSize)
  const subscribe = useCallback((notify: () => void) => subscribeQuickSelection(canvas, notify), [canvas])
  const read = useCallback(() => hasQuickSelection(canvas), [canvas])
  const selected = useSyncExternalStore(subscribe, read, () => false)
  useEffect(() => { setQuickSelectionOptions(canvas, mode, size) }, [canvas, mode, size])
  return <div className={inspector.content}>
    <section className={inspector.section} aria-label="Quick selection settings">
      <h3>Selection</h3>
      <RadioGroup value={mode} onValueChange={value => { if (value === 'add' || value === 'subtract') setMode(value) }} aria-label="Selection mode">
        <RadioGroupItem value="add" label="Add" description="Change the selection mode to Add. Painting over the image will add areas to your existing selection." />
        <ShakeFeedback blocked={autoErase} onBlockedAttempt={emphasizeAutoErase}>
          <RadioGroupItem disabled={autoErase} className={styles.lockedChoice} value="subtract" label="Subtract" description="Change the selection mode to Subtract. Painting over the image will subtract areas from your existing selection." />
        </ShakeFeedback>
      </RadioGroup>
    </section>
    <section className={inspector.section} aria-label="Automatic erasing">
      <div className={inspector.autoSizeRow}>
        <motion.span animate={feedback} style={{ display: 'inline-block', transformOrigin: 'left center' }}>Auto erase</motion.span>
        <motion.span animate={feedback} style={{ display: 'inline-flex', transformOrigin: 'right center' }}>
          <Switch checked={autoErase} onCheckedChange={setAutoErase} ariaLabel="Auto erase" />
        </motion.span>
      </div>
    </section>
    <section className={inspector.section} aria-label="Selection brush size">
      <div className={inspector.strokeFieldHeading}><span>Brush size</span>
        <label className={`${inspector.sizeField} ${inspector.strokeWidthInput}`}>
          <NumberInput min={4} max={120} value={size} ariaLabel="Selection brush size" onValueChange={setSize} /><span>px</span>
        </label>
      </div>
      <BubbleSlider className={inspector.strokeSlider} showBubble={false} min={4} max={120} value={size} aria-label="Selection brush size" onValueChange={setSize} />
    </section>
    <section className={`${inspector.section} ${styles.actions}`}>
      <Button variant="primary" size="sm" whileHover={undefined} disabled={!selected} onClick={() => invertQuickSelection(canvas)}>Invert selection</Button>
      <Button className={styles.deselect} variant="secondary" size="sm" whileHover={undefined} disabled={!selected} onClick={() => clearQuickSelection(canvas)}>Deselect</Button>
      <p className={styles.hint}>{autoErase ? 'Move over the image to preview an area in light blue. Paint to select it, then release to erase it.' : 'Move over the image to preview an area in light blue. Paint to select it, then press Delete or use the trash button to erase it.'}</p>
    </section>
  </div>
}
