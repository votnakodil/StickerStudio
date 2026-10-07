import type { ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { SPRING_SWAP } from '@/shared/lib/motion'
import styles from './AnimatedNumber.module.css'

/** Places are keyed from the right so unchanged digits keep their mounted glyph. */
export function AnimatedNumber({ value, renderDigit }: { value: number; renderDigit?: (digit: string) => ReactNode }) {
  const reduce = useReducedMotion()
  const digits = String(value).split('')
  return <span className={styles.number}>
    <AnimatePresence initial={false} mode="popLayout">
      {digits.map((digit, index) => <motion.span key={digits.length - index - 1} className={styles.place}
        data-slot="animated-number-place" data-place={digits.length - index - 1}
        initial={{ width: reduce ? '1ch' : 0, opacity: 0 }} animate={{ width: '1ch', opacity: 1 }}
        exit={{ width: 0, opacity: 0 }} transition={reduce ? { duration: 0 } : SPRING_SWAP}>
        <span className={styles.measure} aria-hidden="true">{digit}</span>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span key={digit} className={styles.digit} data-digit={digit}
            initial={{ opacity: 0, y: reduce ? 0 : 8, filter: reduce ? 'none' : 'blur(3px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: reduce ? 0 : -8, filter: reduce ? 'none' : 'blur(3px)' }}
            transition={reduce ? { duration: 0 } : SPRING_SWAP}>{renderDigit ? renderDigit(digit) : digit}</motion.span>
        </AnimatePresence>
      </motion.span>)}
    </AnimatePresence>
  </span>
}
