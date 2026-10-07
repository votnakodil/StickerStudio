import { useLayoutEffect, useRef, type CSSProperties } from 'react'

/** Copy prepared pixels directly; PNG encoding and image decoding add no flight delay. */
export function CanvasTexture({ source, style, kind }: { source: HTMLCanvasElement; style?: CSSProperties; kind: 'artwork' | 'text' | 'title' | 'preview' }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useLayoutEffect(() => {
    const target = ref.current
    if (!target) return
    target.width = source.width
    target.height = source.height
    target.getContext('2d')?.drawImage(source, 0, 0)
  }, [source])
  return <canvas ref={ref} data-hero-texture={kind} aria-hidden="true" style={style} />
}
