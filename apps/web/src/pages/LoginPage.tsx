import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { EmailStep } from '../components/auth/EmailStep/EmailStep'
import { LoginHeroCards } from '../components/auth/LoginHeroCards/LoginHeroCards'
import { OtpStep } from '../components/auth/OtpStep/OtpStep'
import { SuccessStep } from '../components/auth/SuccessStep/SuccessStep'
import { authService, isAllowedEmail, normalizeEmail } from '../services/auth'
import styles from './LoginPage.module.css'

type Stage = 'email' | 'sendingCode' | 'otp' | 'verifying' | 'success'

export function LoginPage() {
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()
  const [stage, setStage] = useState<Stage>('email')
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [otpError, setOtpError] = useState<string | null>(null)
  const [resendUntil, setResendUntil] = useState(0)
  const [expiresAt, setExpiresAt] = useState(0)
  const [now, setNow] = useState(0)
  const inFlight = useRef(false)

  useEffect(() => {
    if (stage !== 'otp' && stage !== 'verifying') return
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [stage])

  useEffect(() => {
    if (stage !== 'success') return
    const timeout = window.setTimeout(() => navigate('/library', { replace: true }), reduceMotion ? 350 : 1350)
    return () => window.clearTimeout(timeout)
  }, [stage, navigate, reduceMotion])

  useEffect(() => {
    const normalized = normalizeEmail(email)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || isAllowedEmail(normalized)) return
    const timeout = window.setTimeout(() => setEmailError('Use your @free-lines.ru email address.'), 800)
    return () => window.clearTimeout(timeout)
  }, [email])

  const sendCode = async () => {
    const normalized = normalizeEmail(email)
    if (!isAllowedEmail(normalized)) {
      setEmailError('Enter a valid @free-lines.ru email address.')
      return
    }
    if (inFlight.current) return
    inFlight.current = true
    setStage('sendingCode')
    setEmailError(null)
    try {
      const challenge = await authService.sendOtp(normalized)
      const sentAt = Date.now()
      setEmail(normalized)
      setNow(sentAt)
      setExpiresAt(sentAt + challenge.expiresIn * 1000)
      setResendUntil(sentAt + challenge.resendIn * 1000)
      setOtpError(null)
      setStage('otp')
    } catch {
      setEmailError('Could not send the code. Please try again.')
      setStage('email')
    } finally {
      inFlight.current = false
    }
  }

  const updateEmail = (value: string) => {
    setEmail(value)
    setEmailError(null)
  }

  const showEmailError = () => {
    if (email.trim() && !isAllowedEmail(email)) setEmailError('Use your @free-lines.ru email address.')
  }

  const showSlideError = () => {
    if (!isAllowedEmail(email)) setEmailError('Enter a valid @free-lines.ru email address.')
  }

  const verifyCode = async (code: string) => {
    if (inFlight.current) return
    if (Date.now() >= expiresAt) {
      setOtpError('This code has expired. Request a new one.')
      return
    }
    inFlight.current = true
    setStage('verifying')
    setOtpError(null)
    try {
      const verified = await authService.verifyOtp(email, code)
      if (verified) setStage('success')
      else {
        setOtpError('That code is incorrect. Try again.')
        setStage('otp')
      }
    } catch (error) {
      setOtpError(error instanceof Error && error.message === 'expired' ? 'This code has expired. Request a new one.' : 'Verification failed. Please try again.')
      setStage('otp')
    } finally {
      inFlight.current = false
    }
  }

  const resendCode = async () => {
    if (inFlight.current || Date.now() < resendUntil) return
    inFlight.current = true
    setStage('verifying')
    setOtpError(null)
    try {
      const challenge = await authService.sendOtp(email)
      const sentAt = Date.now()
      setNow(sentAt)
      setExpiresAt(sentAt + challenge.expiresIn * 1000)
      setResendUntil(sentAt + challenge.resendIn * 1000)
    } catch {
      setOtpError('Could not resend the code. Please try again.')
    } finally {
      inFlight.current = false
      setStage('otp')
    }
  }

  const step = stage === 'sendingCode' ? 'email' : stage === 'verifying' ? 'otp' : stage
  const transition = reduceMotion ? { duration: 0 } : { duration: .3, ease: 'easeOut' as const }

  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <LoginHeroCards />
        <div className={styles.formSpace}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={step} className={styles.step} initial={{ opacity: 0, y: reduceMotion ? 0 : 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduceMotion ? 0 : -12 }} transition={transition}>
              {step === 'email' && <EmailStep email={email} onEmailChange={updateEmail} onEmailBlur={showEmailError} onInvalidSlide={showSlideError} onConfirm={sendCode} busy={stage === 'sendingCode'} error={emailError} />}
              {step === 'otp' && <OtpStep email={email} busy={stage === 'verifying'} error={otpError} resendSeconds={Math.max(0, Math.ceil((resendUntil - now) / 1000))} onVerify={verifyCode} onResend={resendCode} onBack={() => { setOtpError(null); setStage('email') }} onEdit={() => setOtpError(null)} />}
              {step === 'success' && <SuccessStep onComplete={() => navigate('/library', { replace: true })} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </main>
  )
}
