import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { animate, useReducedMotion } from 'motion/react'
import { FabricImage } from 'fabric'
import { commitStickerImageSmoothing, getStickerImageSmoothing, updateStickerImageSmoothing } from '@sticker-studio/editor'
import { motionTokens } from '@/shared/lib/motion'
import { useEditorStore } from './editorStore'

export function useImageRoundness() {
  const canvas = useEditorStore(state => state.canvas)
  const reduceMotion = useReducedMotion()
  const pending = useRef<{ image: FabricImage; amount: number } | null>(null)
  const animation = useRef<{ stop: () => void } | null>(null)
  const dragging = useRef(false)
  const dragFrame = useRef<number | null>(null)
  const commitRequested = useRef(false)
  const [draft, setDraft] = useState<{ image: FabricImage; amount: number } | null>(null)
  const [error, setError] = useState('')
  const selectedImage = useCallback(() => {
    const objects = canvas?.getActiveObjects() ?? []
    return objects.length === 1 && objects[0] instanceof FabricImage ? objects[0] : null
  }, [canvas])
  const finish = useCallback(() => {
    animation.current?.stop()
    animation.current = null
    if (dragFrame.current !== null) cancelAnimationFrame(dragFrame.current)
    dragFrame.current = null
    const update = pending.current
    pending.current = null
    commitRequested.current = false
    if (canvas && update) {
      try {
        updateStickerImageSmoothing(canvas, update.image, update.amount, false)
        commitStickerImageSmoothing(canvas, update.image)
      } catch { setError('Could not adjust image roundness.') }
    }
    setDraft(null)
  }, [canvas])
  const commit = useCallback(() => {
    // Let the contour settle before saving its final value, rather than snapping on release.
    commitRequested.current = true
    if (!animation.current) finish()
  }, [finish])
  const subscribe = useCallback((notify: () => void) => {
    if (!canvas) return () => {}
    const refresh = () => {
      if (pending.current && selectedImage() !== pending.current.image) finish()
      notify()
    }
    const events = ['selection:created', 'selection:updated', 'selection:cleared', 'object:modified', 'object:removed', 'object:added'] as const
    events.forEach(event => canvas.on(event, refresh))
    return () => { events.forEach(event => canvas.off(event, refresh)) }
  }, [canvas, selectedImage, finish])
  const image = useSyncExternalStore(subscribe, selectedImage, () => null)
  const readAmount = useCallback(() => image ? getStickerImageSmoothing(image) : 0, [image])
  const savedAmount = useSyncExternalStore(subscribe, readAmount, () => 0)
  useEffect(() => () => {
    animation.current?.stop()
    animation.current = null
    if (dragFrame.current !== null) cancelAnimationFrame(dragFrame.current)
    dragFrame.current = null
    const update = pending.current
    pending.current = null
    commitRequested.current = false
    if (canvas && update) {
      updateStickerImageSmoothing(canvas, update.image, update.amount, false)
      commitStickerImageSmoothing(canvas, update.image)
    }
  }, [canvas])
  const changeAmount = (amount: number) => {
    if (!canvas || !image) return
    animation.current?.stop()
    animation.current = null
    commitRequested.current = false
    setError('')
    setDraft({ image, amount })
    const update = { image, amount }
    pending.current = update
    const paint = (value: number) => {
      if (pending.current !== update) return
      try { updateStickerImageSmoothing(canvas, image, value, false) }
      catch {
        animation.current?.stop()
        animation.current = null
        pending.current = null
        setDraft(null)
        setError('Could not adjust image roundness.')
      }
    }
    if (dragging.current) {
      if (dragFrame.current === null) dragFrame.current = requestAnimationFrame(() => {
        dragFrame.current = null
        const latest = pending.current
        if (latest?.image === image) {
          try { updateStickerImageSmoothing(canvas, image, latest.amount, false) }
          catch { pending.current = null; setDraft(null); setError('Could not adjust image roundness.') }
        }
      })
      return
    }
    const current = getStickerImageSmoothing(image)
    if (reduceMotion || current === amount) { paint(amount); return }
    animation.current = animate(current, amount, {
      duration: motionTokens.duration.instant,
      ease: motionTokens.ease.inOut,
      onUpdate: paint,
      onComplete: () => {
        if (pending.current !== update) return
        animation.current = null
        paint(amount)
        if (commitRequested.current) finish()
      },
    })
  }
  const startDrag = () => { dragging.current = true }
  const endDrag = () => { dragging.current = false; finish() }
  return { image, startDrag, endDrag, amount: draft?.image === image ? draft.amount : savedAmount, error, changeAmount, commit }
}
