import { useEffect, useState } from 'react'
import styles from './SuccessStep.module.css'

interface SuccessStepProps { onComplete: () => void }

export function SuccessStep({ onComplete }: SuccessStepProps) {
  const [state, setState] = useState<'out' | 'in'>('out')

  useEffect(() => {
    const frame = requestAnimationFrame(() => setState('in'))
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div className={styles.step} role="status" aria-live="polite">
      <span className={styles.successCheck} data-state={state} aria-hidden="true">
        <svg viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="21" stroke="currentColor" strokeWidth="2" />
          <path d="M13 24.5 21 32 36 16" pathLength="20" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" onAnimationEnd={onComplete} />
        </svg>
      </span>
      <h1>You’re in</h1>
      <p>Opening your library…</p>
    </div>
  )
}
