import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

type Placement = 'top' | 'bottom' | 'left' | 'right'

interface FloatingPopoverProps {
  anchorRef: RefObject<HTMLElement | null>
  children: ReactNode
  className?: string
  label: string
  onClose: () => void
}

const GAP = 9
const EDGE = 8

export function FloatingPopover({ anchorRef, children, className, label, onClose }: FloatingPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const popover = popoverRef.current
    const anchor = anchorRef.current
    if (!popover || !anchor) return

    const position = () => {
      const trigger = anchor.getBoundingClientRect()
      const { width, height } = popover.getBoundingClientRect()
      const viewportWidth = document.documentElement.clientWidth
      const viewportHeight = document.documentElement.clientHeight
      const positions: Record<Placement, { left: number; top: number }> = {
        bottom: { left: trigger.right - width, top: trigger.bottom + GAP },
        top: { left: trigger.right - width, top: trigger.top - height - GAP },
        left: { left: trigger.left - width - GAP, top: trigger.top + (trigger.height - height) / 2 },
        right: { left: trigger.right + GAP, top: trigger.top + (trigger.height - height) / 2 },
      }
      const fits = ({ left, top }: { left: number; top: number }) =>
        left >= EDGE && top >= EDGE && left + width <= viewportWidth - EDGE && top + height <= viewportHeight - EDGE
      const order: Placement[] = ['bottom', 'top', 'left', 'right']
      const placement = order.find((side) => fits(positions[side])) ?? order.reduce((best, side) => {
        const available = (point: { left: number; top: number }) =>
          Math.max(0, Math.min(viewportWidth - EDGE, point.left + width) - Math.max(EDGE, point.left)) *
          Math.max(0, Math.min(viewportHeight - EDGE, point.top + height) - Math.max(EDGE, point.top))
        return available(positions[side]) > available(positions[best]) ? side : best
      }, order[0])
      const { left, top } = positions[placement]
      popover.style.left = `${Math.max(EDGE, Math.min(left, viewportWidth - width - EDGE))}px`
      popover.style.top = `${Math.max(EDGE, Math.min(top, viewportHeight - height - EDGE))}px`
      popover.style.visibility = 'visible'
      popover.dataset.placement = placement
    }

    position()
    const observer = new ResizeObserver(position)
    observer.observe(anchor)
    observer.observe(popover)
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
    }
  }, [anchorRef])

  useLayoutEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node
      if (!anchorRef.current?.contains(target) && !popoverRef.current?.contains(target)) onClose()
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [anchorRef, onClose])

  return createPortal(
    <div ref={popoverRef} className={className} role="dialog" aria-label={label} style={{ visibility: 'hidden' }}>
      {children}
    </div>,
    document.body,
  )
}
