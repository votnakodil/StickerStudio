import { isValidStickerReference } from '@/features/vk-workspace/model/stickerReference'
import { useVkWorkspaceUpload, type VkWorkspaceUploadOptions } from '@/features/vk-workspace/model/useVkWorkspaceUpload'
import { AnimatePresence, motion } from 'motion/react'

import { BackButton } from '@/shared/ui/BackButton/BackButton'
import { StatefulButton } from '@/shared/ui/StatefulButton/StatefulButton'
import { Skeleton } from '@/shared/ui/Skeleton/Skeleton'
import { SuccessCheck } from '@/shared/ui/SuccessCheck/SuccessCheck'
import { Input } from '@/shared/ui/Input/Input'

import styles from './VkWorkspaceSheet.module.css'

export function VkWorkspaceStickerUpload({ pack, makeSticker, initialBlob, alreadyUploaded, initialUnknown, onUnconfirmed, filename, onBack, onFinish, onStepChange, onUploaded, newPackName, onCreated }: VkWorkspaceUploadOptions) {
  const { reduceMotion, creationName, preview, preparing, state, error, unknown, reference, setReference, needsReference, busy, complete, upload } = useVkWorkspaceUpload({ pack, makeSticker, initialBlob, alreadyUploaded, initialUnknown, onUnconfirmed, filename, onBack, onFinish, onStepChange, onUploaded, newPackName, onCreated })

  return <div className={styles.reviewControls}>
    <div className={styles.stickerPreview}>
      <AnimatePresence mode="wait" initial={false}>
        {complete && !preparing ? <motion.div key="success" className={styles.uploadSuccess} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12 }}>
          <SuccessCheck size={96} onComplete={onFinish} />
        </motion.div> : <motion.div key="preview" exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.88, filter: 'blur(6px)' }} transition={{ duration: reduceMotion ? 0.12 : 0.22, ease: [0.22, 1, 0.36, 1] }}>
          <Skeleton loading={preparing} avatar lines={2} label="Preparing sticker preview">
            {preview && <img src={preview.url} width={120} height={120} alt={`Sticker preview for ${pack.name}`} />}
          </Skeleton>
        </motion.div>}
      </AnimatePresence>
    </div>
    <h2 className={styles.heading}>{complete ? creationName ? 'Pack created' : 'Sticker uploaded' : unknown ? 'Upload not confirmed' : error ? 'Upload failed' : preparing ? 'Preparing sticker' : needsReference ? 'Sticker link needed' : 'Uploading sticker'}</h2>
    <p className={styles.reviewDescription} role="status">{complete ? <>Your sticker has been added to <strong>{pack.name}</strong>.</> : error || needsReference ? <>Selected pack: <strong>{pack.name}</strong>.</> : <>Uploading your sticker to <strong>{pack.name}</strong>.</>}</p>
    {needsReference && !complete && <div className={styles.packControls}>
      <Input appearance="auth" type="url" aria-label="Existing sticker link" placeholder="Existing sticker link" value={reference} onChange={setReference} disabled={busy || unknown} classNames={{ field: styles.field, input: styles.input }} />
      <p className={styles.packHint}>Paste a link to an existing sticker in this pack: files.myteam.mail.ru/get/…</p>
    </div>}
    {error && <p className={styles.packError} role="alert">{error}</p>}
    <div className={styles.packNavigation}>
      <BackButton appearance="circle" whileHover={undefined} disabled={busy} onClick={onBack} aria-label="Back to packs" />
      <StatefulButton size="md" whileHover={undefined} className={styles.submit} state={state} loadingText="Uploading…" successText="Done" successIcon={null} errorText={unknown ? 'Check your pack' : 'Try again'}
        disabled={busy || preparing || !preview || unknown || (!complete && needsReference && !isValidStickerReference(reference))} onClick={complete ? onFinish : upload}>Upload</StatefulButton>
    </div>
  </div>
}
