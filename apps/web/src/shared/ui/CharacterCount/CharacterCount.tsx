import { motion, useReducedMotion } from 'motion/react'
import styles from './CharacterCount.module.css'

export function CharacterCount({ count, limit }: { count: number; limit: number }) {
  const reduced = useReducedMotion()
  const progress = Math.min(1, Math.max(0, count / Math.max(1, limit)))
  const tone = progress >= 0.9 ? 'error' : progress >= 0.75 ? 'warning' : 'success'

  return <span className={styles.counter} data-tone={tone} role="img" aria-label={`${count} of ${limit} characters`}>
    <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
      <circle cx="16" cy="16" r="14" fill="none" stroke="var(--theme-border)" strokeWidth="2" />
      <motion.circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
        initial={false} animate={{ pathLength: progress, opacity: count > 0 ? 1 : 0 }}
        transition={{ duration: reduced ? 0 : 0.16, ease: 'easeOut' }} />
    </svg>
    <span className={styles.digit} aria-hidden="true">{count}</span>
  </span>
}
