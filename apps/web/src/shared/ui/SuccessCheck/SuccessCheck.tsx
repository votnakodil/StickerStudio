import { useEffect, useState, type CSSProperties } from 'react'
import styles from './SuccessCheck.module.css'

export function SuccessCheck({ size = 112, className, onComplete }: {
  size?: number
  className?: string
  onComplete?: () => void
}) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true))
    const timer = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? window.setTimeout(() => onComplete?.(), 630) : undefined
    return () => { cancelAnimationFrame(frame); window.clearTimeout(timer) }
  }, [onComplete])
  const style = { '--check-size': `${size}px`, '--check-y-amount': `${size * 0.35}px`, '--check-blur-from': `${size * 10 / 112}px` } as CSSProperties
  return <span className={`${styles.check} ${className ?? ''}`} data-state={visible ? 'in' : 'out'} style={style} aria-hidden="true">
    <svg viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="21" stroke="currentColor" strokeWidth="2" />
      <path d="M13 24.5 21 32 36 16" pathLength="20" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" onAnimationEnd={onComplete} />
    </svg>
  </span>
}
