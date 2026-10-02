import { useSyncExternalStore } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { SPRING_REVEAL } from '@/shared/lib/motion'
import max from '@/shared/assets/stickers/max.png'
import sanya from '@/shared/assets/stickers/sanya.png'
import anton from '@/shared/assets/stickers/anton.png'
import styles from './LoginHeroCards.module.css'

const portraits = [
  { name: 'Max', src: max },
  { name: 'Sanya', src: sanya },
  { name: 'Anton', src: anton },
]

function subscribeToViewport(onChange: () => void) {
  window.addEventListener('resize', onChange)
  return () => window.removeEventListener('resize', onChange)
}

function getViewportWidth() {
  return window.innerWidth
}

function getServerViewportWidth() {
  return 1440
}

export function LoginHeroCards() {
  const viewportWidth = useSyncExternalStore(subscribeToViewport, getViewportWidth, getServerViewportWidth)
  const reduceMotion = useReducedMotion()
  const openX = viewportWidth <= 350 ? 49 : viewportWidth <= 400 ? 64 : viewportWidth <= 540 ? 86 : 196
  const closedX = viewportWidth <= 540 ? 25 : 38

  return (
    <div className={styles.stage} aria-label="Sticker Studio portraits">
      {portraits.map((portrait, index) => {
        const direction = index === 0 ? -1 : 1
        const isOuterCard = index < 2
        const delay = index === 0 ? 0 : 0.035

        return (
          <motion.div
            key={portrait.name}
            className={`${styles.card} ${styles[`card${index}`]}`}
            initial={isOuterCard && !reduceMotion ? { x: direction * closedX, y: 6, rotate: direction * 7, scale: 0.97 } : false}
            animate={isOuterCard ? { x: direction * openX, y: 18, rotate: direction * 14, scale: 1 } : undefined}
            transition={reduceMotion ? { duration: 0 } : {
              x: { ...SPRING_REVEAL, delay },
              y: { type: 'spring', stiffness: 420, damping: 25, mass: 0.8, delay },
              rotate: { type: 'spring', stiffness: 420, damping: 24, mass: 0.8, delay },
              scale: { type: 'spring', stiffness: 420, damping: 25, mass: 0.8, delay },
            }}
          >
            <img src={portrait.src} alt={portrait.name} draggable={false} />
          </motion.div>
        )
      })}
    </div>
  )
}
