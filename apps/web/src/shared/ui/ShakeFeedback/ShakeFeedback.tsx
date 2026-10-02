import { useAnimationControls, motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

/** Shared feedback for an attempted action on a temporarily locked control. */
export function ShakeFeedback({ blocked, children, className, onBlockedAttempt }: {
  blocked: boolean
  children: ReactNode
  className?: string
  onBlockedAttempt?: () => void
}) {
  const controls = useAnimationControls()
  const reduceMotion = useReducedMotion()
  const shake = () => {
    onBlockedAttempt?.()
    if (reduceMotion) return
    controls.stop()
    void controls.start({ x: [0, -5, 4, -3, 2, 0], transition: { duration: 0.32 } })
  }
  return <motion.div className={className} animate={controls}
    style={{ opacity: blocked ? 0.45 : 1 }}
    onPointerDownCapture={(event) => {
      if (!blocked) return
      event.preventDefault()
      event.stopPropagation()
      shake()
    }}
    onKeyDownCapture={(event) => {
      if (!blocked || event.key === 'Tab' || event.key === 'Escape' || event.metaKey || event.ctrlKey || event.altKey) return
      event.preventDefault()
      event.stopPropagation()
      shake()
    }}>
    {children}
  </motion.div>
}
