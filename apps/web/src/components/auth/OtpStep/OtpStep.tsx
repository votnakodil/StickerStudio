import { useState } from 'react'
import { IconChevronLeft } from 'symbols-react'
import { OtpInput } from '../../ui/OtpInput'
import styles from './OtpStep.module.css'

interface OtpStepProps {
  email: string
  busy: boolean
  error: string | null
  resendSeconds: number
  onVerify: (code: string) => void
  onResend: () => void
  onBack: () => void
  onEdit: () => void
}

export function OtpStep({ email, busy, error, resendSeconds, onVerify, onResend, onBack, onEdit }: OtpStepProps) {
  const [code, setCode] = useState('')
  const minutes = Math.floor(resendSeconds / 60)
  const seconds = String(resendSeconds % 60).padStart(2, '0')

  return (
    <div className={styles.step}>
      <button type="button" className={styles.back} onClick={onBack} disabled={busy}>
        <IconChevronLeft aria-hidden="true" width={9} height={14} fill="currentColor" /> Back
      </button>
      <h1>Check your email</h1>
      <p className={styles.intro}>Enter the six-digit code sent to <strong>{email}</strong></p>
      <OtpInput
        length={6}
        value={code}
        onChange={(value) => { setCode(value); if (error) onEdit() }}
        onComplete={onVerify}
        label="Verification code"
        hint="Enter your six-digit code."
        errorMessage={error ?? undefined}
        status={error ? 'error' : 'idle'}
        disabled={busy}
        autoFocus
        className={styles.otpInput}
      />
      <button
        className={styles.resend}
        type="button"
        disabled={busy || resendSeconds > 0}
        onClick={() => { setCode(''); onResend() }}
      >
        {resendSeconds > 0 ? `Resend code in ${minutes}:${seconds}` : 'Resend code'}
      </button>
    </div>
  )
}
