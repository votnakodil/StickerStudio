/** Bounded, disposable resources; take transfers ownership to the consumer. */
export function createPreparedResourceCache<T>(limit: number, dispose: (value: T) => void) {
  type Entry = { controller: AbortController; value?: T; pending: Promise<void> }
  const entries = new Map<string, Entry>()
  const invalidate = (key: string) => {
    const entry = entries.get(key)
    if (!entry) return
    entries.delete(key)
    entry.controller.abort()
    if (entry.value !== undefined) dispose(entry.value)
  }
  return {
    invalidate,
    warm(key: string, prepare: (signal: AbortSignal) => Promise<T | undefined>) {
      const existing = entries.get(key)
      if (existing) { entries.delete(key); entries.set(key, existing); return existing.pending }
      const controller = new AbortController()
      const entry: Entry = { controller, pending: Promise.resolve() }
      entries.set(key, entry)
      while (entries.size > limit) invalidate(entries.keys().next().value!)
      // Invoke immediately so cancellation can also cover pending decoding.
      entry.pending = prepare(controller.signal).then(value => {
        if (value === undefined) { if (entries.get(key) === entry) entries.delete(key); return }
        if (entries.get(key) !== entry) dispose(value)
        else entry.value = value
      }).catch(() => { if (entries.get(key) === entry) entries.delete(key) })
      return entry.pending
    },
    take(key: string) {
      const entry = entries.get(key)
      if (entry?.value === undefined) return undefined
      entries.delete(key)
      return entry.value
    },
  }
}
