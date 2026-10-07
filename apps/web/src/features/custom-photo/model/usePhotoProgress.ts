import { useEffect, useRef, useState } from 'react'
import type { CutoutPhotoState } from './types'
import { photoCountdownDeadline, remainingPhotoSeconds, photoProgressMessage, photoQueuePosition, photoProcessingOverrunStep, queueCountdown, type QueueCountdown } from './photoProgress'

export function usePhotoProgress(state: CutoutPhotoState) {
  const { id, stage, photo } = state
  const queue = useRef<QueueCountdown | null>(null)
  const processingStart = useRef<{ id: string; time: number } | null>(null)
  const key = `${id}:${stage}`
  const [countdown, setCountdown] = useState<{ key: string; seconds: number | null; overrunStep: number } | null>(null)
  useEffect(() => {
    const observedAt = Date.now()
    if (stage === 'processing' && processingStart.current?.id !== id) processingStart.current = { id, time: observedAt }
    if (stage !== 'processing') processingStart.current = null
    const job = photo?.job
    if (stage === 'queued' && job?.status === 'queued') queue.current = queueCountdown(job, observedAt, queue.current)
    else queue.current = null
    const deadline = queue.current?.deadline ?? photoCountdownDeadline({ id, stage, photo }, observedAt, processingStart.current?.time ?? observedAt)
    const tick = () => {
      const now = Date.now()
      const seconds = remainingPhotoSeconds(deadline, now)
      const overrunStep = stage === 'processing' ? photoProcessingOverrunStep(deadline, now) : 0
      setCountdown(current => current?.key === key && current.seconds === seconds && current.overrunStep === overrunStep ? current : { key, seconds, overrunStep })
    }
    const firstTick = window.setTimeout(tick, 0)
    const timer = deadline === null ? null : window.setInterval(tick, 1000)
    const visibility = () => { if (!document.hidden) tick() }
    document.addEventListener('visibilitychange', visibility)
    return () => {
      window.clearTimeout(firstTick)
      if (timer !== null) window.clearInterval(timer)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [id, stage, photo, key])
  const seconds = countdown?.key === key ? countdown.seconds : null
  const overrunStep = countdown?.key === key ? countdown.overrunStep : 0
  return { seconds, message: photoProgressMessage(state, seconds, overrunStep), queuePosition: photoQueuePosition(state) }
}
