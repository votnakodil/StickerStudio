import type { Variants } from 'motion/react'
import { EASE_OUT, SPRING_SWAP } from '@/shared/lib/motion/ease'

export const TEXT_SWAP_STAGGER = 0.025

export const TEXT_SWAP_VARIANTS: Variants = {
  initial: { opacity: 0, y: '105%', filter: 'blur(6px)' },
  animate: (delay: number = 0) => ({
    opacity: 1,
    y: '0%',
    filter: 'blur(0px)',
    transition: { ...SPRING_SWAP, delay },
  }),
  exit: (delay: number = 0) => ({
    opacity: 0,
    y: '-105%',
    filter: 'blur(6px)',
    transition: { duration: 0.16, ease: EASE_OUT, delay: delay * 0.5 },
  }),
}
