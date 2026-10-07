import { useEffect, useLayoutEffect, useRef } from 'react'
import { useReducedMotion } from 'motion/react'

/** Align each moving glyph with one gradient and animation across the full phrase. */
export function usePhotoStatusShimmer(contentKey: string, active: boolean) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const phrase = ref.current
    if (!phrase) return
    const measure = () => {
      const bounds = phrase.getBoundingClientRect()
      phrase.style.setProperty('--photo-shimmer-width', `${bounds.width}px`)
      for (const part of phrase.querySelectorAll<HTMLElement>('[data-shimmer-part], [data-digit]')) {
        part.style.setProperty('--photo-shimmer-offset', `${part.getBoundingClientRect().left - bounds.left}px`)
      }
    }
    measure()
    const resize = new ResizeObserver(measure)
    resize.observe(phrase)
    return () => resize.disconnect()
  }, [contentKey])
  useEffect(() => {
    const phrase = ref.current
    if (!phrase || !active || reduce) return
    let frame = 0
    const started = performance.now()
    const sweep = (now: number) => {
      const width = Number.parseFloat(phrase.style.getPropertyValue('--photo-shimmer-width')) || 0
      const progress = ((now - started) % 2000) / 2000
      phrase.style.setProperty('--photo-shimmer-x', `${width * (-2 + 3 * progress)}px`)
      frame = requestAnimationFrame(sweep)
    }
    frame = requestAnimationFrame(sweep)
    return () => cancelAnimationFrame(frame)
  }, [active, reduce])
  return ref
}
