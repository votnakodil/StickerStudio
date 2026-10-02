import { useVkWorkspaceAuth, type VkWorkspaceAuthOptions } from '@/features/vk-workspace/model/useVkWorkspaceAuth'
import { type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { IconEnvelope, IconEye, IconEyeSlash } from 'symbols-react'
import { type StickerCanvas } from '@sticker-studio/editor'
import { VkWorkspacePacks } from '@/features/vk-workspace/components/VkWorkspaceSheet/VkWorkspacePacks'
import { BottomSheet } from '@/shared/ui/BottomSheet/BottomSheet'
import { Stepper, type StepperStep } from '@/shared/ui/Stepper/Stepper'
import { Input } from '@/shared/ui/Input/Input'
import { BackButton } from '@/shared/ui/BackButton/BackButton'
import { Button } from '@/shared/ui/Button/Button'
import { StatefulButton } from '@/shared/ui/StatefulButton/StatefulButton'
import { SuccessCheck } from '@/shared/ui/SuccessCheck/SuccessCheck'

import { motionTokens } from '@/shared/lib/motion'
import { TEXT_SWAP_STAGGER, TEXT_SWAP_VARIANTS } from '@/shared/lib/motion'
import logo from '@/shared/assets/vkworkspace-round.png'
import styles from './VkWorkspaceSheet.module.css'

const steps: StepperStep[] = [
  { id: 'authorization', label: 'Sign in', description: 'Connect your VK Workspace account' },
  { id: 'pack', label: 'Choose a pack', description: 'Select where your sticker will go' },
  { id: 'send', label: 'Send sticker', description: 'Add it to VK Workspace' },
]

const privacyLines = ['Your password is used only to sign in.', 'We don’t store it.']

export function VkWorkspaceSheet({ canvas, stickerName, open, onOpenChange, trigger }: { canvas: StickerCanvas | null; stickerName: string; open: boolean; onOpenChange: (open: boolean) => void; trigger: ReactNode }) {
  return <BottomSheet dimBackdrop={false} trigger={trigger} open={open} onOpenChange={onOpenChange} detents={[0.68, 0.92]} initialDetent={1} title="VK Workspace" description="EXPORT YOUR STICKER" descriptionClassName={styles.eyebrow} closeLabel="Close VK Workspace" className={styles.sheet}>
    <Authorization canvas={canvas} stickerName={stickerName} onFinish={() => onOpenChange(false)} />
  </BottomSheet>
}

function Authorization({ canvas, stickerName, onFinish }: VkWorkspaceAuthOptions) {
  const {
    stage,
    setStage,
    packStep,
    setPackStep,
    finishAuthorization,
    makeSticker,
    email,
    setEmail,
    password,
    setPassword,
    visible,
    setVisible,
    state,
    setState,
    error,
    setError,
    passwordInput,
    emailInput,
    reduced,
    compact,
    busy,
    submit,
    back,
  } = useVkWorkspaceAuth({ canvas, stickerName, onFinish })

  return <div className={styles.layout}>
    <aside className={styles.progress}>
      <Stepper steps={steps.map((step, index) => index === 0 && error ? { ...step, error: 'Sign-in failed. Try again.' } : step)} current={stage === 'pack' ? packStep : stage === 'connected' ? 1 : 0} orientation={compact ? 'horizontal' : 'vertical'} label="VK Workspace export progress" />
    </aside>
    <div className={styles.card}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={stage} className={styles.content}
          initial={{ opacity: 0, y: reduced ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : -8 }}
          transition={reduced ? { duration: 0 } : { duration: motionTokens.duration.exit, ease: motionTokens.ease.standard }}
          onAnimationComplete={() => { if (stage === 'password') passwordInput.current?.focus(); else if (stage === 'email') emailInput.current?.focus() }}>
          {stage === 'pack' ? <VkWorkspacePacks onFinish={onFinish} onBack={() => { setState('idle'); setStage('password') }} makeSticker={makeSticker} filename={`${stickerName || 'sticker'}.png`} onStepChange={setPackStep} /> : <>
          <img className={styles.logo} src={logo} width={72} height={72} alt="VK Workspace" />
          <h2 className={styles.heading}>{stage === 'email' ? 'Sign in to VK Workspace' : stage === 'password' ? 'Enter password' : 'You’re signed in'}</h2>
          <p className={styles.subtitle}>{stage === 'email' ? <>Enter your email to connect<br />your account</> : <><span>{stage === 'password' ? 'From account' : 'Connected as'}</span> <strong>{email}</strong></>}</p>
          {stage === 'connected' ? <div className={styles.connected}>
            <SuccessCheck size={56} onComplete={finishAuthorization} />
            <p>Your account is connected.<br />Pack selection is the next step.</p>
          </div> : <form onSubmit={submit} className={styles.form}>
            {stage === 'email' ? <Input appearance="auth" leftIcon={<IconEnvelope fill="currentColor" aria-hidden="true" />} ref={emailInput} type="email" name="vk-email" autoComplete="username" autoCapitalize="none" spellCheck={false} required aria-label="Email" placeholder="Email" value={email} onChange={setEmail} classNames={{ field: styles.field, input: styles.input }} />
              : <Input appearance="auth" ref={passwordInput} type={visible ? 'text' : 'password'} name="vk-password" autoComplete="current-password" required aria-label="Password" placeholder="Password" value={password} disabled={busy} error={error || undefined}
                  onChange={(value) => { setPassword(value); if (error) { setError(''); setState('idle') } }}
                  classNames={{ field: styles.field, input: styles.input, errorMessage: styles.error }}
                  rightIcon={<Button variant="ghost" size="icon" className={styles.eye} aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} disabled={busy} onClick={() => setVisible(!visible)}>{visible ? <IconEyeSlash width={20} height={20} fill="currentColor" aria-hidden="true" /> : <IconEye width={20} height={20} fill="currentColor" aria-hidden="true" />}</Button>} />}
            <div className={stage === 'password' ? styles.packNavigation : undefined}>
              {stage === 'password' && <BackButton appearance="circle" whileHover={undefined} disabled={busy} onClick={back} aria-label="Back to email" />}
              <StatefulButton whileHover={undefined} type="submit" state={stage === 'password' ? state : 'idle'} className={styles.submit} size="md"
              disabled={stage === 'email' ? !email.trim() : !password || busy} loadingText="Signing in…" successText="Signed in" errorText="Try again">{stage === 'email' ? 'Next' : 'Sign in'}</StatefulButton>
            </div>
            {stage === 'password' && <p className={styles.privacy} aria-label={privacyLines.join(' ')}>
              {privacyLines.map((line, lineIndex) => <span key={line} className={styles.privacyLine} aria-hidden="true">
                {reduced ? line : Array.from(line).map((char, index) => <motion.span key={index} className={styles.privacyLetter}
                  variants={TEXT_SWAP_VARIANTS} initial="initial" animate="animate"
                  custom={0.04 + (index + (lineIndex ? privacyLines[0].length : 0)) * TEXT_SWAP_STAGGER * 0.4}>
                  {char}
                </motion.span>)}
              </span>)}
            </p>}
          </form>}
          </>}
        </motion.div>
      </AnimatePresence>
    </div>
  </div>
}
