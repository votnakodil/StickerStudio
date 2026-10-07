import { useLayoutEffect, useRef, useState } from 'react'

/** Measure natural content, independently of the animated outer pill width. */
export function usePhotoStatusWidth(contentKey: string) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState<number>()
  useLayoutEffect(() => {
    const content = contentRef.current
    if (!content) return
    const measure = () => setWidth(Math.ceil(content.getBoundingClientRect().width) + 2)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(content)
    return () => observer.disconnect()
  }, [contentKey])
  return { contentRef, width }
}
