interface Options {
  read: () => string
  write: (design: string) => Promise<void>
  initial?: string
  intervalMs?: number
  onError: (error: unknown) => void
  onSaved: () => void
}

/** Serialize writes so an older request can never overwrite a newer snapshot. */
export function createPeriodicDesignSaver({ read, write, initial, intervalMs = 5000, onError, onSaved }: Options) {
  let saved = initial
  let dirty = false
  let pending: string | undefined
  let running: Promise<void> | undefined
  const drain = async () => {
    while (pending !== undefined) {
      const design = pending
      pending = undefined
      try { await write(design); saved = design; onSaved() }
      catch (error) { dirty = true; onError(error) }
    }
  }
  const flush = () => {
    if (!dirty) return running ?? Promise.resolve()
    try {
      const design = read()
      dirty = false
      if (design !== saved || running) pending = design
      if (!running && pending !== undefined) {
        running = drain().finally(() => { running = undefined })
      }
    } catch (error) { dirty = true; onError(error) }
    return running ?? Promise.resolve()
  }
  const timer = setInterval(() => { void flush() }, intervalMs)
  return {
    markDirty: () => { dirty = true },
    flush,
    stop: () => { clearInterval(timer); return flush() },
  }
}
