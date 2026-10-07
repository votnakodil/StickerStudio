// Adapted from https://beui.dev/components/agents/image-generation (MIT).
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { EASE_OUT, motionTokens } from '@/shared/lib/motion'
import { DitherField } from './DitherField'
import type { ImageGenerationStatus } from './imageGenerationTypes'
import styles from './ImageGeneration.module.css'

const media = {
  queued: { filter: 'blur(4px) saturate(0.75)', opacity: 0, scale: 1.02 },
  generating: { filter: 'blur(3px) saturate(0.85)', opacity: 0, scale: 1.015 },
  refining: { filter: 'blur(1.5px) saturate(0.95)', opacity: 0.62, scale: 1.005 },
  complete: { filter: 'blur(0px) saturate(1)', opacity: 1, scale: 1 },
  error: { filter: 'blur(2px) saturate(0.5)', opacity: 0, scale: 1 },
}
interface Props { children?: ReactNode; status: ImageGenerationStatus; label: string; onOverlayExit?: () => void; appear?: boolean }
export function ImageGeneration({ children, status, label, onOverlayExit, appear = true }: Props) {
  const reduce = useReducedMotion() ?? false
  const active = ['queued', 'generating', 'refining'].includes(status)
  return <div className={styles.surface} data-slot="image-generation" data-state={status} aria-label={label} aria-busy={active}>
    <motion.div className={styles.media} initial={false} animate={reduce ? { opacity: media[status].opacity } : media[status]} transition={{ duration: reduce ? 0 : 0.4, ease: EASE_OUT }}>
      {children}
    </motion.div>
    <AnimatePresence initial={false} onExitComplete={onOverlayExit}>
      {active && <motion.div key="dither" className={styles.overlay} initial={appear ? { opacity: 0 } : false} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: reduce ? 0 : motionTokens.duration.processingDissolve, ease: motionTokens.ease.inOut } }} transition={{ duration: reduce ? 0 : 0.25, ease: EASE_OUT }}>
        <DitherField interactive reduce={reduce} status={status} />
      </motion.div>}
    </AnimatePresence>
  </div>
}
