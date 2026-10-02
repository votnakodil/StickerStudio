import { IconEnvelope } from 'symbols-react'
import { isAllowedEmail } from '@/features/auth/api/index'
import { SlideToConfirm } from '@/features/auth/components/SlideToConfirm/SlideToConfirm'
import { Input } from '@/shared/ui/Input/Input'
import { TextShimmer } from '@/shared/ui/TextShimmer/TextShimmer'
import styles from './EmailStep.module.css'

interface EmailStepProps {
  email: string
  onEmailChange: (value: string) => void
  onEmailBlur: () => void
  onInvalidSlide: () => void
  onConfirm: () => void
  busy: boolean
  error: string | null
}

export function EmailStep({ email, onEmailChange, onEmailBlur, onInvalidSlide, onConfirm, busy, error }: EmailStepProps) {
  return (
    <div className={styles.step}>
      <TextShimmer as="h1" duration={2.5} repeatDelay={5}>Welcome to Sticker Studio</TextShimmer>
      <div className={styles.emailGroup}>
        <label className={styles.emailLabel} htmlFor="login-email">Your email</label>
        <p className={styles.domainHint}>*available for @free-lines.ru accounts</p>
        <Input
          id="login-email"
          appearance="auth"
          type="email"
          inputMode="email"
          autoComplete="email"
          spellCheck={false}
          placeholder="name@free-lines.ru"
          value={email}
          onChange={onEmailChange}
          onBlur={onEmailBlur}
          error={error ?? undefined}
          success={isAllowedEmail(email)}
          disabled={busy}
          leftIcon={<IconEnvelope fill="currentColor" />}
          className={styles.emailInput}
        />
      </div>
      <div className={styles.slideWrap}>
        <SlideToConfirm disabled={!isAllowedEmail(email) || busy} onInvalidAttempt={onInvalidSlide} onConfirm={onConfirm} />
      </div>
    </div>
  )
}
