import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { SPRING_SWAP } from '@/shared/lib/motion'
import styles from './Countdown.module.css'

export function Countdown({ seconds, duration = 7 }: { seconds: number; duration?: number }) {
  const reduceMotion = useReducedMotion()
  return <span className={styles.countdown} role="img" aria-label={`${seconds} seconds remaining`}>
    <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
      <motion.circle cx="16" cy="16" r="10" fill="none" stroke="var(--palette-white)"
        strokeWidth="2" strokeLinecap="round" initial={{ pathLength: 1 }}
        animate={{ pathLength: 0 }} transition={{ duration, ease: 'linear' }} />
    </svg>
    <AnimatePresence initial={false} mode="popLayout">
      <motion.span key={seconds} className={styles.digit} aria-hidden="true"
        initial={{ opacity: 0, y: reduceMotion ? 0 : 8, filter: reduceMotion ? 'none' : 'blur(3px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: reduceMotion ? 0 : -8, filter: reduceMotion ? 'none' : 'blur(3px)' }}
        transition={reduceMotion ? { duration: 0 } : SPRING_SWAP}>{seconds}</motion.span>
    </AnimatePresence>
  </span>
}
