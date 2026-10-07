import { vkWorkspace, VkServiceError, type VkPack } from '../api/vkWorkspace'

const PACK_RETRY_DELAY_MS = 5000
const PACK_LOAD_ATTEMPTS = 3
const RETRYABLE_HTTP_STATUSES = new Set([408, 429, 500, 502, 503, 504])

function waitForRetry(delay: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
      reject(signal.reason)
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, delay)
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

/** Retry only pack discovery; uploads and pack creation must not be repeated automatically. */
export async function loadVkWorkspacePacks(signal: AbortSignal, {
  refresh = (requestSignal: AbortSignal) => vkWorkspace.refreshPacks(requestSignal),
  wait = waitForRetry,
}: {
  refresh?: (signal: AbortSignal) => Promise<VkPack[]>
  wait?: (delay: number, signal: AbortSignal) => Promise<void>
} = {}): Promise<VkPack[]> {
  for (let attempt = 1; ; attempt++) {
    signal.throwIfAborted()
    try {
      return await refresh(signal)
    } catch (cause) {
      signal.throwIfAborted()
      if (!(cause instanceof VkServiceError) || cause.kind !== 'retryable' || cause.httpStatus !== undefined && !RETRYABLE_HTTP_STATUSES.has(cause.httpStatus) || attempt >= PACK_LOAD_ATTEMPTS) throw cause
      await wait(PACK_RETRY_DELAY_MS, signal)
    }
  }
}
