import { SuccessCheck } from '@/shared/ui/SuccessCheck/SuccessCheck'
import styles from './SuccessStep.module.css'

interface SuccessStepProps { onComplete: () => void }

export function SuccessStep({ onComplete }: SuccessStepProps) {
  return (
    <div className={styles.step} role="status" aria-live="polite">
      <SuccessCheck className={styles.successCheck} onComplete={onComplete} />
      <h1>You’re in</h1>
      <p>Opening your library…</p>
    </div>
  )
}
