import { useCallback, useEffect, useRef, useState } from 'react'

export function usePhotoArrival(onLaunch: (id: string, src: string) => void) {
  const [preview, setPreview] = useState<{ id: string; src: string; width: number; height: number; phase: 'drop' | 'compress' | 'fill' } | null>(null)
  const launched = useRef(false)
  const advancedPhase = useRef<string | null>(null)
  const lifetime = useRef(0)
  const source = useRef<string | null>(null)
  useEffect(() => () => {
    lifetime.current++
    if (source.current) URL.revokeObjectURL(source.current)
  }, [])
  const prepareArrival = useCallback(async (id: string, file: File) => {
    launched.current = false
    advancedPhase.current = null
    const epoch = ++lifetime.current
    const src = URL.createObjectURL(file)
    if (source.current) URL.revokeObjectURL(source.current)
    source.current = src
    const image = new Image()
    image.src = src
    try { await image.decode() }
    catch (error) {
      if (epoch === lifetime.current) { URL.revokeObjectURL(src); source.current = null }
      throw error
    }
    if (epoch !== lifetime.current) return
    setPreview({ id, src, width: image.naturalWidth, height: image.naturalHeight, phase: 'drop' })
  }, [])
  const completeArrival = useCallback(() => {
    if (!preview || launched.current) return
    launched.current = true
    onLaunch(preview.id, preview.src)
    // The flight has synchronously captured these pixels; release the upload
    // preview even when Back reuses the same library page before it unmounts.
    setPreview(null)
    if (source.current) URL.revokeObjectURL(source.current)
    source.current = null
  }, [preview, onLaunch])
  const advance = useCallback(() => {
    if (!preview || launched.current || advancedPhase.current === preview.phase) return
    advancedPhase.current = preview.phase
    if (preview.phase === 'drop') setPreview({ ...preview, phase: 'compress' })
    else if (preview.phase === 'compress') setPreview({ ...preview, phase: 'fill' })
    else completeArrival()
  }, [preview, completeArrival])
  return { preview, prepareArrival, advance, completeArrival }
}
