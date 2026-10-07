import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { IconArrowUp, IconArrowClockwiseCircleFill, IconExclamationmarkTriangleFill, IconHourglass, IconPhotoFill, IconSparkles, IconXmark, IconXmarkCircleFill } from 'symbols-react'
import { Button } from '@/shared/ui/Button/Button'
import { AnimatedNumber } from '@/shared/ui/AnimatedNumber/AnimatedNumber'
import { usePhotoStatusWidth } from '../../model/usePhotoStatusWidth'
import { usePhotoStatusShimmer } from '../../model/usePhotoStatusShimmer'
import { EASE_OUT, SPRING_EDITOR_REVEAL, TEXT_SWAP_VARIANTS, motionTokens } from '@/shared/lib/motion'
import { photoQueueOrdinalSuffix } from '../../model/photoProgress'
import { usePhotoProgress } from '../../model/usePhotoProgress'
import type { CutoutPhotoState } from '../../model/types'
import { StatusMessage } from './StatusMessage'
import styles from './PhotoCutoutStatus.module.css'

const statusIcons = {
  loading: IconHourglass, uploading: IconArrowUp, queued: IconHourglass,
  processing: IconSparkles, receiving: IconPhotoFill, ready: IconPhotoFill,
  error: IconExclamationmarkTriangleFill, cancelled: IconXmarkCircleFill,
}
interface Props { state: CutoutPhotoState; onCancel: () => void; onRetry: () => void; cancelBusy: boolean }
export function PhotoCutoutStatus({ state, onCancel, onRetry, cancelBusy }: Props) {
  const reduce = useReducedMotion()
  const { message, seconds, queuePosition } = usePhotoProgress(state)
  const queued = state.stage === 'queued' && state.photo?.job?.status === 'queued'
  const showCountdown = seconds !== null && seconds > 0 && !state.notice && !cancelBusy
  const preparing = state.stage === 'ready'
  const statusMessage = preparing ? 'Preparing' : cancelBusy ? 'Cancelling' : queuePosition !== null ? 'You’re' : showCountdown ? queued ? 'Starting in' : state.stage === 'processing' ? 'Removing background. Wait for' : `${message} in` : message
  const contentKey = `${statusMessage}:${seconds}:${queuePosition}`
  const { contentRef, width } = usePhotoStatusWidth(contentKey)
  const showCancel = queued
  const terminal = state.stage === 'error' || state.stage === 'cancelled'
  const shimmerRef = usePhotoStatusShimmer(contentKey, !terminal)
  const iconKey = preparing || state.stage === 'receiving' ? 'preparing' : state.notice ? 'notice' : ['loading', 'queued'].includes(state.stage) ? 'waiting' : state.stage
  const StatusIcon = preparing ? IconPhotoFill : state.notice ? IconExclamationmarkTriangleFill : statusIcons[state.stage]
  if (state.stage === 'cancelled') return null
  return <motion.div className={styles.status} data-slot="photo-progress" data-stage={state.stage}
    initial={reduce ? false : { opacity: 0, y: 8, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
    exit={{ opacity: 0, y: reduce ? 0 : 6, filter: reduce ? 'none' : 'blur(4px)', transition: { duration: reduce ? 0 : motionTokens.duration.considered, ease: EASE_OUT } }}
    transition={{ duration: reduce ? 0 : 0.24, ease: EASE_OUT }}>
    <div className={styles.row}>
      <motion.div className={styles.pill} data-slot="photo-status-pill"
        initial={false} animate={{ width }} transition={reduce ? { duration: 0 } : SPRING_EDITOR_REVEAL}>
        <div ref={contentRef} className={styles.pillContent}>
        <span className={styles.iconSlot} data-slot="photo-status-icon">
          <AnimatePresence initial={false}>
            <motion.span key={iconKey} className={styles.rollingIcon} variants={TEXT_SWAP_VARIANTS}
              initial={reduce ? { opacity: 0 } : 'initial'} animate={reduce ? { opacity: 1 } : 'animate'} exit={reduce ? { opacity: 0 } : 'exit'}>
              <StatusIcon className={styles.icon} fill="currentColor" aria-hidden="true" />
            </motion.span>
          </AnimatePresence>
        </span>
        <span ref={shimmerRef} className={`${styles.phrase} ${terminal ? '' : styles.shimmer}`} data-slot="photo-status-shimmer">
          <span className={statusMessage === 'You’re' ? styles.queueLead : undefined}><StatusMessage message={statusMessage} alert={state.stage === 'error'} /></span>
          <AnimatePresence initial={false} mode="popLayout">
            {queuePosition !== null && <motion.span key="position" className={styles.time} data-slot="photo-queue"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.2 }}>
              <span className={styles.ordinal} aria-hidden="true"><AnimatedNumber value={queuePosition} /><span data-shimmer-part>{photoQueueOrdinalSuffix(queuePosition)}</span></span>
              <span data-shimmer-part aria-hidden="true">in a queue</span>
              <span className={styles.accessible} role="status" aria-live="polite" aria-atomic="true">You’re {queuePosition}{photoQueueOrdinalSuffix(queuePosition)} in a queue</span>
              {showCountdown && <span data-shimmer-part aria-hidden="true">-</span>}
            </motion.span>}
          </AnimatePresence>
          <AnimatePresence initial={false} mode="popLayout">
            {showCountdown && <motion.span key={`time-${queued ? 'queue' : 'processing'}`} className={styles.time}
              data-slot="photo-estimate" aria-label={queued ? 'Estimated time until processing' : 'Approximate processing time remaining'}
              initial={{ opacity: 0, x: reduce ? 0 : -3 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: reduce ? 0 : -3 }}
              transition={{ duration: reduce ? 0 : 0.2, ease: EASE_OUT }}>
              <span aria-hidden="true"><AnimatedNumber value={seconds} /></span>
              <span className={styles.accessible}>{seconds} {seconds === 1 ? 'second' : 'seconds'}</span>
              <span className={styles.fullUnits} data-shimmer-part aria-hidden="true">{seconds === 1 ? 'second' : 'seconds'}</span>
              <span className={styles.shortUnits} data-shimmer-part aria-hidden="true">sec.</span>
            </motion.span>}
          </AnimatePresence>
        </span>
        </div>
      </motion.div>
      <AnimatePresence initial={false} mode="popLayout">
      {showCancel && <Button key="cancel"
        initial={{ opacity: 0, y: reduce ? 0 : 4 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: reduce ? 0 : 4, filter: reduce ? 'none' : 'blur(4px)' }}
        transition={{ duration: reduce ? 0 : motionTokens.duration.standard, ease: EASE_OUT }} className={`${styles.action} ${styles.cancel}`} variant="ghost" size="sm" disabled={cancelBusy || !queued} aria-label={cancelBusy ? 'Cancelling' : 'Cancel'} title="Cancel queued photo" onClick={onCancel}>
        <IconXmark className={styles.icon} fill="currentColor" aria-hidden="true" /><span className={styles.actionLabel}>{cancelBusy ? 'Cancelling' : 'Cancel'}</span>
      </Button>}

      {terminal && state.photo && <Button key="retry"
        initial={{ opacity: 0, y: reduce ? 0 : 4 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: reduce ? 0 : 4, filter: reduce ? 'none' : 'blur(4px)' }}
        transition={{ duration: reduce ? 0 : motionTokens.duration.standard, ease: EASE_OUT }} className={styles.action} variant="secondary" size="sm" onClick={onRetry}>
        <IconArrowClockwiseCircleFill className={styles.icon} fill="currentColor" aria-hidden="true" />Try again
      </Button>}
      </AnimatePresence>
    </div>

  </motion.div>
}
