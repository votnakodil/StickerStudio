import { motionTokens } from '@/shared/lib/motion'
import { useHeroArtworkTransition } from '@/shared/ui/HeroArtworkTransition/useHeroArtworkTransition'
import { preloadStickerImageOutline } from '@sticker-studio/editor'
import { useEffect } from 'react'
import { loadEditorFonts } from '@/features/editor'
import { LibraryTabs } from '@/features/library'
import { stickers } from '@/features/library'
import styles from './LibraryPage.module.css'

export function LibraryPage({ leaving = false }: { leaving?: boolean }) {
  const reduceMotion = useReducedMotion()
  const { flight } = useHeroArtworkTransition()
  const waitingForDestination = flight?.direction === 'open' && !flight.to
  const fadingOut = leaving && !waitingForDestination
  useEffect(() => { void loadEditorFonts().catch(() => { /* EditorCanvas reports a font loading failure when opened. */ }) }, [])
  useEffect(() => {
    const controller = new AbortController()
    void Promise.all(stickers.map(sticker => preloadStickerImageOutline(sticker.preview.src, controller.signal)))
      .catch(() => { /* EditorCanvas retries preparation and reports errors when opened. */ })
    return () => controller.abort()
  }, [])
  return (
    <motion.main className={styles.page}
      initial={false}
      animate={{ opacity: fadingOut ? 0 : 1, pointerEvents: leaving ? 'none' : 'auto' }}
      transition={{ duration: reduceMotion ? 0 : motionTokens.duration.considered, ease: motionTokens.ease.standard }}
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
