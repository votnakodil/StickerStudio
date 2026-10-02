import { useExportActions, type ExportActionsOptions, LIBRARY_PROMPT_SECONDS } from '@/features/editor/model/useExportActions'

import { AnimatePresence, motion } from 'motion/react'

import vkWorkspaceIcon from '@/shared/assets/vkworkspace.webp'
import { StatefulButton } from '@/shared/ui/StatefulButton/StatefulButton'
import { Button } from '@/shared/ui/Button/Button'
import { Countdown } from '@/shared/ui/Countdown/Countdown'
import { SuccessCheck } from '@/shared/ui/SuccessCheck/SuccessCheck'
import { SPRING_SWAP } from '@/shared/lib/motion'

import styles from './ExportActions.module.css'
import { VkWorkspaceSheet } from '@/features/vk-workspace'

export function ExportActions({ canvas, stickerName, active = true, onFinish }: ExportActionsOptions) {
  const {
    pngState,
    libraryState,
    alreadySaved,
    seconds,
    error,
    vkOpen,
    setVkOpen,
    reduceMotion,
    libraryAnimation,
    libraryTextAnimation,
    prompting,
    dismiss,
    savePng,
    accept,
    saveLibrary,
    revealTransition,
  } = useExportActions({ canvas, stickerName, active, onFinish })

  return <div className={styles.actions}>
    <StatefulButton variant="secondary" size="md" className={styles.action}
      state={pngState} disabled={!canvas || prompting || libraryState === 'loading'} onClick={savePng}
      loadingText="Saving…" successText="PNG saved" errorText="Try again">
      Save PNG
    </StatefulButton>
    <motion.div className={styles.librarySurface} data-prompting={prompting} animate={libraryAnimation}>
      <StatefulButton variant="primary" size="md" className={`${styles.action} ${styles.libraryAction}`}
        state={libraryState} disabled={!canvas || pngState === 'loading'} aria-disabled={alreadySaved || undefined} onClick={saveLibrary}
        textAnimate={libraryTextAnimation}
        iconWidth={prompting ? 28 : 0} pressScale={prompting || alreadySaved ? 1 : undefined}
        loadingText="Saving…" successText="Saved to Library" errorText="Try again"
        successIcon={<SuccessCheck size={24} className={styles.librarySuccess} />}
        icon={prompting ? <AnimatePresence initial={false} mode="popLayout">
          <motion.span key="countdown" className={styles.libraryIcon}
            initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.7 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.7 }}
            transition={reduceMotion ? { duration: 0 } : SPRING_SWAP}>
            <Countdown seconds={seconds} duration={LIBRARY_PROMPT_SECONDS} />
          </motion.span>
        </AnimatePresence> : undefined}>
        {alreadySaved ? 'Already saved' : prompting ? 'Save to Library?' : 'Save to Library'}
      </StatefulButton>
      <motion.div className={styles.confirmReveal} initial={false}
        animate={{ height: prompting ? 'auto' : 0, opacity: prompting ? 1 : 0 }}
        transition={revealTransition} inert={!prompting} aria-hidden={!prompting}>
        <div className={styles.confirmActions}>
          <Button variant="secondary" size="sm" className={`${styles.choice} ${styles.yesChoice}`} whileHover={undefined} onClick={accept}>Yes</Button>
          <Button variant="secondary" size="sm" className={`${styles.choice} ${styles.noChoice}`} whileHover={undefined} onClick={dismiss}>No</Button>
        </div>
      </motion.div>
    </motion.div>
    <VkWorkspaceSheet canvas={canvas} stickerName={stickerName || 'sticker'} open={vkOpen} onOpenChange={setVkOpen} trigger={<StatefulButton variant="primary" size="md" className={`${styles.action} ${styles.vkAction}`}
      disabled={prompting || pngState === 'loading' || libraryState === 'loading'}
      icon={<img src={vkWorkspaceIcon} width={18} height={18} alt="" aria-hidden="true" />}>
      VK Workspace
    </StatefulButton>} />
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </div>
}
