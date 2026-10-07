import { useEffect, useRef, useState } from 'react'
import { prepareCustomPhoto } from './customPhotos'

export function usePhotoSelection(onPrepared: (id: string, file: File) => void | Promise<void>) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const selectPhoto = async (file: File) => {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      const id = await prepareCustomPhoto(file)
      if (mounted.current) await onPrepared(id, file)
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Could not prepare this photo.')
    } finally {
      inFlight.current = false
      if (mounted.current) setBusy(false)
    }
  }
  return { selectPhoto, busy, error, setError }
}
