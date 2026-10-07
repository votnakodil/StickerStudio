import { useEffect } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { motionTokens } from '@/shared/lib/motion'
import styles from './ShineSweep.module.css'

interface Props {
  /** Transparent image mask; only its opaque artwork receives the shine. */
  mask: string
  onComplete?: () => void
}
export function ShineSweep({ mask, onComplete }: Props) {
  const reduce = useReducedMotion()
  useEffect(() => { if (reduce) onComplete?.() }, [reduce, onComplete])
  if (reduce) return null
  return <div className={styles.surface} aria-hidden="true" data-slot="shine-sweep"
    style={{ maskImage: `url("${mask}")`, WebkitMaskImage: `url("${mask}")` }}>
    <motion.div className={styles.band}
      initial={{ x: '22%', y: '-22%' }}
      animate={{ x: '-22%', y: '22%' }}
      transition={{ duration: motionTokens.duration.stickerShine, ease: 'linear' }}
      onAnimationComplete={onComplete} />
  </div>
}
