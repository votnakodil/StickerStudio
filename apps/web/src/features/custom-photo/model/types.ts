export type CutoutStatus = 'queued' | 'processing' | 'completed' | 'delivered' | 'failed' | 'expired' | 'cancelled'
export interface CutoutJob {
  jobId: string
  status: CutoutStatus
  queuePosition: number
  jobsAhead: number
  estimatedWaitSeconds: number
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  durationMs?: number
  error?: string
}
export interface CustomPhoto {
  id: string
  name: string
  source: Blob
  idempotencyKey: string
  createdAt: number
  job?: CutoutJob
  result?: Blob
  resultAcknowledged?: boolean
}
export interface CutoutPhotoState {
  id: string
  resultSource?: 'download' | 'storage'
  stage: 'loading' | 'uploading' | 'queued' | 'processing' | 'receiving' | 'ready' | 'error' | 'cancelled'
  photo?: CustomPhoto
  notice?: string
  error?: string
  errorStatus?: number
}
export interface PhotoStorage {
  get(id: string): Promise<CustomPhoto | undefined>
  put(photo: CustomPhoto): Promise<void>
}
export interface CutoutApi {
  create(source: Blob, key: string, signal?: AbortSignal): Promise<CutoutJob>
  get(jobId: string, signal?: AbortSignal): Promise<CutoutJob>
  result(jobId: string, signal?: AbortSignal): Promise<Blob>
  acknowledge(jobId: string, signal?: AbortSignal): Promise<void>
  cancel(jobId: string, signal?: AbortSignal): Promise<void>
}
