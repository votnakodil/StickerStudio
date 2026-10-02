import { LibraryTabs } from '@/features/library'
import { stickers } from '@/features/library'
import styles from './LibraryPage.module.css'

export function LibraryPage({ leaving = false }: { leaving?: boolean }) {
  const reduceMotion = useReducedMotion()
  return (
    <motion.main className={styles.page}
      initial={false}
      animate={{ opacity: leaving ? 0 : 1, pointerEvents: leaving ? 'none' : 'auto' }}
      transition={{ duration: reduceMotion ? 0 : 0.32 }}
    >
      <div className="mx-auto w-full max-w-[88rem] px-5 pb-16 pt-10 sm:px-8 sm:pt-14">
        <header className="mb-5 sm:mb-6">
          <p className={styles.eyebrow}>Sticker Studio</p>
          <h1 className={styles.title}>Choose a sticker</h1>
          <p className={styles.subtitle}>Choose a sticker made by community, or create your own</p>
        </header>
        <LibraryTabs stickers={stickers} />
      </div>
    </motion.main>
  )
}
import { motion, useReducedMotion } from 'motion/react'
