import { useCallback, useEffect, useRef, useState } from 'react'
import { cutoutApi, CutoutServiceError } from '../api/cutoutApi'
import { photoStorage } from '../api/photoStorage'
import { runPhotoCutout } from './runPhotoCutout'
import type { CutoutPhotoState } from './types'

export function useCustomPhoto(id: string | undefined) {
  const [state, setState] = useState<CutoutPhotoState & { resultUrl?: string }>({ id: id ?? '', stage: 'loading' })
  const [version, setVersion] = useState(0)
  const [cancelBusy, setCancelBusy] = useState(false)
  const controllerRef = useRef<AbortController | null>(null)
  const actionRef = useRef(false)
  const lifetime = useRef(0)
  useEffect(() => {
    if (!id) return
    const epoch = ++lifetime.current
    const controller = new AbortController()
    controllerRef.current = controller
    let resultUrl: string | undefined
    void runPhotoCutout(id, { storage: photoStorage, api: cutoutApi, signal: controller.signal, notify: (next) => {
      if (controller.signal.aborted) return
      if (next.photo?.result && !resultUrl) resultUrl = URL.createObjectURL(next.photo.result)
      setState({ ...next, resultUrl })
    } })
    return () => { lifetime.current = epoch + 1; controller.abort(); controllerRef.current = null; if (resultUrl) URL.revokeObjectURL(resultUrl) }
  }, [id, version])
  const retry = useCallback(async () => {
    if (!id || actionRef.current) return
    actionRef.current = true
    const epoch = lifetime.current
    try {
      const photo = await photoStorage.get(id)
      if (!photo || epoch !== lifetime.current) return
      if (state.errorStatus === 404 || state.errorStatus === 410 || photo.job && ['failed', 'expired', 'cancelled', 'delivered'].includes(photo.job.status)) {
        await photoStorage.put({ ...photo, job: undefined, result: undefined, resultAcknowledged: false, idempotencyKey: crypto.randomUUID() })
      }
      if (epoch === lifetime.current) setVersion((current) => current + 1)
    } catch (cause) {
      if (epoch === lifetime.current) setState((current) => ({ ...current, stage: 'error', error: cause instanceof Error ? cause.message : 'Could not retry this photo.' }))
    } finally { actionRef.current = false }
  }, [id, state.errorStatus])
  const cancel = useCallback(async () => {
    const photo = state.photo
    const controller = controllerRef.current
    const epoch = lifetime.current
    if (!photo?.job || photo.job.status !== 'queued' || actionRef.current || !controller) return false
    actionRef.current = true
    setCancelBusy(true)
    try {
      await cutoutApi.cancel(photo.job.jobId, controller.signal)
      if (controller.signal.aborted) return false
      controller.abort()
      const next = { ...photo, job: { ...photo.job, status: 'cancelled' as const } }
      await photoStorage.put(next)
      if (epoch !== lifetime.current) return false
      setState({ id: photo.id, stage: 'cancelled', photo: next })
      return true
    } catch (cause) {
      if (epoch === lifetime.current) setState((current) => ({ ...current, notice: cause instanceof CutoutServiceError && cause.status === 409
        ? 'Your photo has started processing and can no longer be cancelled.' : 'Could not cancel. Your photo is still being processed.' }))
      return false
    } finally { actionRef.current = false; if (epoch === lifetime.current) setCancelBusy(false) }
  }, [state.photo])
  return { ...(state.id === id ? state : { id: id ?? '', stage: 'loading' as const }), retry, cancel, cancelBusy }
}
