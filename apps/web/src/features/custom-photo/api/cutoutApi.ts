import type { CutoutApi, CutoutJob, CutoutStatus } from '../model/types'

export class CutoutServiceError extends Error {
  readonly status: number
  readonly retryAfterSeconds: number
  constructor(status: number, message: string, retryAfterSeconds = 2) {
    super(message)
    this.name = 'CutoutServiceError'
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
  }
}
const statuses: readonly string[] = ['queued', 'processing', 'completed', 'delivered', 'failed', 'expired', 'cancelled']
function date(value: unknown): value is string { return typeof value === 'string' && Number.isFinite(Date.parse(value)) }
function nullableDate(value: unknown): value is string | null { return value === null || date(value) }
function counter(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 }
function status(value: unknown): value is CutoutStatus { return typeof value === 'string' && statuses.includes(value) }
export function parseCutoutJob(value: unknown): CutoutJob {
  if (!value || typeof value !== 'object' || !('jobId' in value) || typeof value.jobId !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(value.jobId)
    || !('status' in value) || !status(value.status)
    || !('queuePosition' in value) || !counter(value.queuePosition)
    || !('jobsAhead' in value) || !counter(value.jobsAhead)
    || !('estimatedWaitSeconds' in value) || !counter(value.estimatedWaitSeconds)
    || !('createdAt' in value) || !date(value.createdAt)
    || !('startedAt' in value) || !nullableDate(value.startedAt)
    || !('completedAt' in value) || !nullableDate(value.completedAt)
    || !('cancelledAt' in value) || !nullableDate(value.cancelledAt)) {
    throw new CutoutServiceError(502, 'The background removal service returned an invalid job.')
  }
  if ('durationMs' in value && !counter(value.durationMs)) throw new CutoutServiceError(502, 'Invalid processing duration.')
  if ('error' in value && typeof value.error !== 'string') throw new CutoutServiceError(502, 'Invalid job error.')
  return { jobId: value.jobId, status: value.status, queuePosition: value.queuePosition, jobsAhead: value.jobsAhead,
    estimatedWaitSeconds: value.estimatedWaitSeconds, createdAt: value.createdAt, startedAt: value.startedAt,
    completedAt: value.completedAt, cancelledAt: value.cancelledAt,
    ...('durationMs' in value && counter(value.durationMs) ? { durationMs: value.durationMs } : {}),
    ...('error' in value && typeof value.error === 'string' ? { error: value.error } : {}) }
}
function responseError(body: unknown, statusCode: number): string {
  if (body && typeof body === 'object' && 'detail' in body) {
    if (typeof body.detail === 'string') return body.detail
    if (Array.isArray(body.detail)) {
      const reasons = body.detail.flatMap((entry: unknown) => {
        if (!entry || typeof entry !== 'object' || !('msg' in entry) || typeof entry.msg !== 'string') return []
        const field = 'loc' in entry && Array.isArray(entry.loc)
          ? entry.loc.filter((part: unknown) => typeof part === 'string' && part !== 'body').join('.') : ''
        return [`${field ? `${field}: ` : ''}${entry.msg}`]
      })
      if (reasons.length) return `Photo upload was rejected: ${reasons.join('; ')}`
    }
  }
  return `Background removal returned HTTP ${statusCode}.`
}
function retryAfter(value: string | null) {
  if (!value) return 2
  const seconds = Number(value)
  return Number.isFinite(seconds) ? Math.max(2, Math.ceil(seconds)) : Math.max(2, Math.ceil((Date.parse(value) - Date.now()) / 1000) || 2)
}
export function createCutoutApi(base = '/api/cutout'): CutoutApi {
  async function request(path: string, init?: RequestInit) {
    let response: Response
    try { response = await fetch(`${base}/jobs${path}`, { credentials: 'same-origin', cache: 'no-store', ...init }) }
    catch (cause) {
      if (init?.signal?.aborted) throw cause
      throw new CutoutServiceError(0, 'Connection lost. Your photo will resume automatically.')
    }
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null)
      const detail = responseError(body, response.status)
      throw new CutoutServiceError(response.status, detail, retryAfter(response.headers.get('Retry-After')))
    }
    return response
  }
  const jobPath = (id: string) => `/${encodeURIComponent(id)}`
  return {
    async create(source, key, signal) {
      // Safari cannot reliably serialize file-backed Blobs restored from IndexedDB.
      // Materialize the saved bytes so multipart serialization uses an in-memory Blob.
      const bytes = await source.arrayBuffer()
      signal?.throwIfAborted()
      const upload = new Blob([bytes], { type: source.type })
      const form = new FormData()
      form.append('file', upload, 'photo')
      return parseCutoutJob(await (await request('', { method: 'POST', headers: { 'Idempotency-Key': key }, body: form, signal })).json())
    },
    async get(id, signal) { return parseCutoutJob(await (await request(jobPath(id), { signal })).json()) },
    async result(id, signal) {
      const response = await request(`${jobPath(id)}/result`, { signal })
      const blob = await response.blob()
      const bytes = new Uint8Array(await blob.slice(0, 8).arrayBuffer())
      if (blob.type !== 'image/png' || bytes.length !== 8 || ![137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte)) {
        throw new Error('Could not receive the finished PNG. Please try again.')
      }
      // Check that the received bytes decode before the runner can ACK delivery.
      const image = await createImageBitmap(blob)
      image.close()
      return blob
    },
    async acknowledge(id, signal) { await request(`${jobPath(id)}/result`, { method: 'DELETE', signal }) },
    async cancel(id, signal) { await request(jobPath(id), { method: 'DELETE', signal }) },
  }
}
export const cutoutApi = createCutoutApi()
