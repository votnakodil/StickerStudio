import { CutoutServiceError } from '../api/cutoutApi'
import type { CustomPhoto, CutoutApi, CutoutPhotoState, PhotoStorage } from './types'

export function waitForCutout(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted()
    const abort = () => { clearTimeout(timer); reject(signal.reason) }
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, milliseconds)
    signal.addEventListener('abort', abort, { once: true })
  })
}
interface CutoutDependencies {
  storage: PhotoStorage
  api: Pick<CutoutApi, 'create' | 'get' | 'result' | 'acknowledge'>
  signal: AbortSignal
  notify: (state: CutoutPhotoState) => void
  wait?: typeof waitForCutout
}
export async function runPhotoCutout(id: string, { storage, api, signal, notify, wait = waitForCutout }: CutoutDependencies) {
  let photo: CustomPhoto | undefined
  try { photo = await storage.get(id) }
  catch (cause) { if (!signal.aborted) notify({ id, stage: 'error', error: cause instanceof Error ? cause.message : 'Could not restore this photo.' }); return }
  if (signal.aborted) return
  if (!photo) { notify({ id, stage: 'error', error: 'This photo is no longer on your device. Choose it again from the library.' }); return }
  let resultSource: 'download' | 'storage' = 'storage'
  let needsStatus = Boolean(photo.job)
  while (!signal.aborted) {
    try {
      if (photo.result) {
        notify({ id, stage: 'ready', photo, resultSource })
        if (!photo.job || photo.resultAcknowledged) return
        try { await api.acknowledge(photo.job.jobId, signal) }
        catch (cause) { if (!(cause instanceof CutoutServiceError && [404, 410].includes(cause.status))) throw cause }
        signal.throwIfAborted()
        await storage.put({ ...photo, resultAcknowledged: true })
        return
      }
      if (!photo.job) {
        notify({ id, stage: 'uploading', photo })
        const job = await api.create(photo.source, photo.idempotencyKey, signal)
        signal.throwIfAborted()
        const next: CustomPhoto = { ...photo, job }
        await storage.put(next)
        photo = next
      } else if (needsStatus) {
        const job = await api.get(photo.job.jobId, signal)
        signal.throwIfAborted()
        const next: CustomPhoto = { ...photo, job }
        await storage.put(next)
        photo = next
      }
      signal.throwIfAborted()
      const job = photo.job
      if (!job) throw new Error('Could not restore the photo job.')
      needsStatus = true
      if (job.status === 'completed') {
        notify({ id, stage: 'receiving', photo })
        const result = await api.result(job.jobId, signal)
        signal.throwIfAborted()
        const next: CustomPhoto = { ...photo, result, resultAcknowledged: false }
        // A committed IndexedDB transaction must precede the destructive ACK.
        await storage.put(next)
        photo = next
        resultSource = 'download'
        continue
      }
      if (job.status === 'delivered') {
        const retained = await storage.get(id)
        signal.throwIfAborted()
        if (retained?.result) { photo = retained; continue }
        throw new CutoutServiceError(410, 'This result is no longer available. Try this photo again.')
      }
      if (job.status === 'failed' || job.status === 'expired') {
        notify({ id, stage: 'error', photo, error: job.error || (job.status === 'failed' ? 'Background removal failed. Try this photo again.' : 'This result expired. Try this photo again.'), errorStatus: 410 })
        return
      }
      if (job.status === 'cancelled') { notify({ id, stage: 'cancelled', photo }); return }
      notify({ id, stage: job.status === 'processing' ? 'processing' : 'queued', photo })
      await wait(2000, signal)
    } catch (cause) {
      if (signal.aborted) return
      if (cause instanceof CutoutServiceError && [404, 410].includes(cause.status)) {
        try {
          const retained = await storage.get(id)
          signal.throwIfAborted()
          if (retained?.result) { photo = retained; continue }
        } catch { if (signal.aborted) return }
      }
      if (cause instanceof CutoutServiceError && [0, 429, 502, 503, 504, 409].includes(cause.status)) {
        if (!photo.result) notify({ id, stage: photo.job?.status === 'processing' ? 'processing' : photo.job ? 'queued' : 'uploading', photo,
          notice: cause.status === 429 ? 'The queue is full. Your photo will retry automatically.' : cause.status === 503 ? 'The service is busy. Your photo will retry automatically.' : 'Reconnecting… Your photo is saved and will resume automatically.' })
        try { await wait(cause.retryAfterSeconds * 1000, signal) } catch { return }
        continue
      }
      // The retained PNG stays usable even if a later ACK fails.
      if (photo.result) { notify({ id, stage: 'ready', photo, resultSource }); return }
      notify({ id, stage: 'error', photo, error: cause instanceof Error ? cause.message : 'Could not remove the background.', errorStatus: cause instanceof CutoutServiceError ? cause.status : undefined })
      return
    }
  }
}
