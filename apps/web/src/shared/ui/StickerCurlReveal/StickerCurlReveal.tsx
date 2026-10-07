import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'motion/react'
import type { StickerRevealPlacement } from './stickerUnfold'
import styles from './StickerCurlReveal.module.css'

interface Props { source: HTMLCanvasElement; artworkSource?: HTMLCanvasElement; placement?: StickerRevealPlacement; onComplete: () => void }
export function StickerCurlReveal({ source, artworkSource, placement, onComplete }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()
  useEffect(() => {
    if (reduce) { onComplete(); return }
    const surface = ref.current
    if (!surface) return
    let disposed = false
    let release: (() => void) | undefined
    void import('./renderStickerCurl').then(({ renderStickerCurl }) => {
      if (!disposed) release = renderStickerCurl(surface, source, onComplete, placement, artworkSource)
    }).catch(() => { if (!disposed) onComplete() })
    return () => { disposed = true; release?.() }
  }, [source, artworkSource, placement, reduce, onComplete])
  return <canvas ref={ref} className={styles.surface} aria-hidden="true" data-slot="sticker-curl-reveal" />
}
