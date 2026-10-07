import type { CutoutJob, CutoutPhotoState } from './types'

export const PHOTO_PROCESSING_ESTIMATE_SECONDS = 30
export const PHOTO_OVERRUN_MESSAGE_INTERVAL_MS = 5000
const overrunMessages = [
  'Taking a little longer…',
  'Still working on it…',
  'A little more time…',
  'We’re on it…',
] as const

/** Keep the phrase sequence tied to the processing deadline across polls and refreshes. */
export function photoProcessingOverrunStep(deadline: number | null, now: number) {
  return deadline === null ? 0 : Math.max(0, Math.floor((now - deadline) / PHOTO_OVERRUN_MESSAGE_INTERVAL_MS))
}

/** Queue estimates end at processing start; processing has a separate approximate budget. */
export function photoCountdownDeadline(state: CutoutPhotoState, observedAt: number, processingObservedAt: number) {
  const job = state.photo?.job
  if (state.stage === 'queued' && job?.status === 'queued') return observedAt + job.estimatedWaitSeconds * 1000
  if (state.stage !== 'processing') return null
  const startedAt = job?.startedAt ? Date.parse(job.startedAt) : processingObservedAt
  return startedAt + PHOTO_PROCESSING_ESTIMATE_SECONDS * 1000
}

export function remainingPhotoSeconds(deadline: number | null, now: number) {
  return deadline === null ? null : Math.max(0, Math.ceil((deadline - now) / 1000))
}

export function photoProgressMessage(state: CutoutPhotoState, seconds: number | null, overrunStep = 0) {
  if (state.stage === 'error') return "Couldn’t remove background"
  if (state.stage === 'cancelled') return 'Photo cancelled'
  if (state.notice) {
    if (state.notice.startsWith('Reconnecting')) return 'Reconnecting…'
    if (state.notice.startsWith('Your photo has started')) return 'Already processing…'
    if (state.notice.startsWith('Could not cancel')) return 'Could not cancel…'
    return 'Waiting for the service…'
  }
  if (state.stage === 'processing') return seconds === 0 ? overrunMessages[overrunStep % overrunMessages.length] ?? overrunMessages[0] : 'Removing background'
  if (state.stage === 'uploading') return 'Uploading'
  if (state.stage === 'queued') return 'Waiting'
  if (state.stage === 'ready') return 'Preparing'
  if (state.stage === 'receiving') return 'Preparing'
  return 'Waiting'
}

export function photoQueuePosition(state: CutoutPhotoState) {
  const job = state.photo?.job
  return state.stage === 'queued' && job?.status === 'queued' && job.queuePosition > 1 ? job.queuePosition : null
}

export interface QueueCountdown { jobId: string; position: number; estimate: number; deadline: number }
export function queueCountdown(job: CutoutJob, observedAt: number, previous: QueueCountdown | null): QueueCountdown {
  if (previous?.jobId === job.jobId && previous.position === job.queuePosition && previous.estimate === job.estimatedWaitSeconds) return previous
  return { jobId: job.jobId, position: job.queuePosition, estimate: job.estimatedWaitSeconds, deadline: observedAt + job.estimatedWaitSeconds * 1000 }
}

/** English ordinal endings include the teen exceptions (11th, 12th, 13th). */
export function photoQueueOrdinalSuffix(position: number) {
  const lastTwo = position % 100
  if (lastTwo >= 11 && lastTwo <= 13) return 'th'
  switch (position % 10) {
    case 1: return 'st'
    case 2: return 'nd'
    case 3: return 'rd'
    default: return 'th'
  }
}
