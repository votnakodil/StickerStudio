import { useId, useRef, useState } from 'react'
import { motion, useAnimationControls, useReducedMotion } from 'motion/react'
import type { StickerCanvas } from '@sticker-studio/editor'
import { Button } from '@/shared/ui/Button/Button'
import { CloseButton } from '@/shared/ui/CloseButton/CloseButton'
import { EASE_OUT, SPRING_EDITOR_REVEAL, SPRING_EXPORT_COLLAPSE } from '@/shared/lib/motion'
import { ExportToggleIcon } from '@/features/editor/components/ExportPanel/ExportToggleIcon'
import { ExportActions } from '@/features/editor/components/ExportPanel/ExportActions'
import styles from './ExportPanel.module.css'

export function ExportPanel({ canvas, stickerId, stickerName }: { canvas: StickerCanvas | null; stickerId?: string; stickerName?: string }) {
  const [open, setOpen] = useState(false)
  const reduceMotion = useReducedMotion()
  const panelAnimation = useAnimationControls()
  const panelRef = useRef<HTMLElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const actionsId = useId()
  const transition = reduceMotion ? { duration: 0 }
    : open ? SPRING_EDITOR_REVEAL : SPRING_EXPORT_COLLAPSE
  const headerTransition = reduceMotion ? { duration: 0 }
    : { type: 'tween' as const, duration: 0.32, ease: EASE_OUT }

  const close = () => {
    const height = panelRef.current?.getBoundingClientRect().height ?? 48
    panelAnimation.stop()
    panelAnimation.set({ height })
    setOpen(false)
    if (reduceMotion) panelAnimation.set({ height: 48 })
    else void panelAnimation.start({
      height: 48,
      transition: SPRING_EXPORT_COLLAPSE,
    })
    triggerRef.current?.focus()
  }

  return <motion.section ref={panelRef} className={styles.panel} initial={false} animate={panelAnimation}
    onKeyDown={(event) => {
      if (event.key === 'Escape' && open) {
        event.preventDefault()
        event.stopPropagation()
        close()
      }
    }}>
    <div className={styles.header}>
    <Button ref={triggerRef} variant="primary" size="md" className={styles.headerTrigger}
      whileHover={undefined} whileTap={undefined}
      aria-label={open ? 'Close export options' : 'Export'} aria-expanded={open}
      aria-controls={actionsId} onClick={() => {
        if (open) close()
        else {
          panelAnimation.stop()
          panelAnimation.set({ height: 'auto' })
          setOpen(true)
        }
      }} />
      <span className={styles.title}>Export</span>
      <motion.span className={styles.spacer} initial={false}
        animate={{ flexGrow: open ? 1 : 0 }} transition={headerTransition} />
      <span className={styles.icon} data-open={open}>
        {open ? <CloseButton aria-label="Close export" onClick={close} /> : <ExportToggleIcon open={false} />}
      </span>
    </div>
    <motion.div id={actionsId} className={styles.reveal} initial={false}
      animate={{ height: open ? 'auto' : 0 }}
      transition={transition} inert={!open} aria-hidden={!open}>
      <div className={styles.content}>
        <ExportActions canvas={canvas} stickerId={stickerId} stickerName={stickerName} active={open} onFinish={close} />
      </div>
    </motion.div>
  </motion.section>
}
