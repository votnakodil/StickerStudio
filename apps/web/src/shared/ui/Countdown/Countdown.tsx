import { motion } from 'motion/react'
import { AnimatedNumber } from '@/shared/ui/AnimatedNumber/AnimatedNumber'
import styles from './Countdown.module.css'

export function Countdown({ seconds, duration = 7 }: { seconds: number; duration?: number }) {
  return <span className={styles.countdown} role="img" aria-label={`${seconds} seconds remaining`}>
    <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
      <motion.circle cx="16" cy="16" r="10" fill="none" stroke="var(--palette-white)"
        strokeWidth="2" strokeLinecap="round" initial={{ pathLength: 1 }}
        animate={{ pathLength: 0 }} transition={{ duration, ease: 'linear' }} />
    </svg>
    <span className={styles.digit} aria-hidden="true"><AnimatedNumber value={seconds} /></span>
  </span>
}
