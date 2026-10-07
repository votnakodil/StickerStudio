import { useCallback, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import type { FabricImage } from 'fabric'
import { createStickerImageReveal, type StickerCanvas, type StickerImageReveal } from '@sticker-studio/editor'

type Ready = (canvas: StickerCanvas, image: FabricImage) => void
interface Shine { image: StickerImageReveal; mask: string }
export function useStickerReveal(fresh: boolean, onReady: Ready) {
  const reduce = useReducedMotion()
  const pending = useRef<{ canvas: StickerCanvas; image: FabricImage; shine?: Shine } | null>(null)
  const [prepared, setPrepared] = useState(false)
  const [reveal, setReveal] = useState<StickerImageReveal | null>(null)
  const [shine, setShine] = useState<Shine | null>(null)
  const [phase, setPhase] = useState<'preparing' | 'clearing' | 'revealing' | 'complete'>('preparing')
  const finishShine = useCallback(() => { setShine(null) }, [])
  const complete = useCallback(() => {
    const current = pending.current
    if (!current) return
    pending.current = null
    setReveal(null)
    setShine(current.shine ?? null)
    setPhase('complete')
    current.canvas.setActiveObject(current.image)
    current.canvas.requestRenderAll()
    onReady(current.canvas, current.image)
  }, [onReady])
  const prepare = useCallback((canvas: StickerCanvas, image: FabricImage) => {
    pending.current = { canvas, image }
    setPrepared(true)
    if (!fresh || reduce) { complete(); return }
    try {
      const snapshot = createStickerImageReveal(canvas, image)
      pending.current.shine = { image: snapshot, mask: snapshot.source.toDataURL('image/png') }
      setReveal(snapshot)
      setPhase('clearing')
    } catch { complete() }
  }, [fresh, reduce, complete])
  const fail = useCallback(() => {
    pending.current = null
    setPrepared(true)
    setReveal(null)
    setShine(null)
    setPhase('complete')
  }, [])
  const start = useCallback(() => { setPhase(current => current === 'clearing' ? 'revealing' : current) }, [])
  return { prepared, phase, reveal, shine, prepare, start, complete, finishShine, fail }
}
