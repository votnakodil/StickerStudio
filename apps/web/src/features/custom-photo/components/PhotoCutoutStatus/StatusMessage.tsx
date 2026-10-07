import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { TEXT_SWAP_VARIANTS } from '@/shared/lib/motion'
import styles from './PhotoCutoutStatus.module.css'

export function StatusMessage({ message, alert = false }: { message: string; alert?: boolean }) {
  const reduce = useReducedMotion()
  return <span className={styles.message}>
    <span className={styles.measure} aria-hidden="true">{message}</span>
    <span className={styles.accessible} role={alert ? 'alert' : 'status'} aria-live={alert ? 'assertive' : 'polite'}>{message}</span>
    <AnimatePresence initial={false}>
      <motion.span key={message} className={styles.rollingMessage} data-shimmer-part aria-hidden="true" variants={TEXT_SWAP_VARIANTS}
        initial={reduce ? { opacity: 0 } : 'initial'} animate={reduce ? { opacity: 1 } : 'animate'} exit={reduce ? { opacity: 0 } : 'exit'}>
        {message}
      </motion.span>
    </AnimatePresence>
  </span>
}
