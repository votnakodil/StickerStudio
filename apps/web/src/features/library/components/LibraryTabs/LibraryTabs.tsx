import { useLibraryGalleryStore } from '@/features/library/model/libraryGalleryStore'
import { useHeroArtworkTransition } from '@/shared/ui/HeroArtworkTransition/useHeroArtworkTransition'
import { IconMagnifyingglass, IconSquareGrid2x2, IconListBullet } from 'symbols-react'
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useCustomPhotoTemplates } from '@/features/custom-photo'
import { loadMyLibrary, useLibraryStore, warmSavedStickerCanvas } from '@/features/library/model/libraryStore'
import type { StickerTemplate } from '@/features/library/model/stickers'
import { SPRING_EDITOR_REVEAL } from '@/shared/lib/motion'
import { EmptyView } from '@/shared/ui/EmptyView/EmptyView'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/Tabs/Tabs'
import { StickerGallery } from '@/features/library/components/StickerGallery/StickerGallery'
import styles from './LibraryTabs.module.css'

interface LibraryTabsProps {
  stickers: readonly StickerTemplate[]
}

const LIBRARY_SPRING = { type: 'spring', stiffness: 330, damping: 24, mass: 0.7 } as const

export function LibraryTabs({ stickers }: LibraryTabsProps) {
  const { flight } = useHeroArtworkTransition()
  const location = useLocation()
  const libraryVisible = location.pathname === '/library'
  const transitioning = Boolean(flight)
  const collection = useLibraryGalleryStore(state => state.collection)
  const setCollection = useLibraryGalleryStore(state => state.setCollection)
  const layout = useLibraryGalleryStore(state => state.layout)
  const setLayout = useLibraryGalleryStore(state => state.setLayout)
  const templateIds = useLibraryStore((state) => state.templateIds)
  const previews = useLibraryStore(state => state.previews)
  const customTemplates = useCustomPhotoTemplates(templateIds)
  const saved = templateIds.flatMap((id) => {
    const template = stickers.find((sticker) => sticker.id === id) ?? customTemplates.find((sticker) => sticker.id === id)
    return template ? [{ ...template, preview: previews[id]
      ? { ...template.preview, src: previews[id], darkSrc: undefined, framing: undefined, visibleBounds: { left: 0, top: 0, width: 512, height: 512 } } : template.preview }] : []
  })
  const loaded = useLibraryStore((state) => state.loaded)
  const error = useLibraryStore((state) => state.error)
  useEffect(() => { void loadMyLibrary() }, [])
  useEffect(() => {
    // Restore saved canvases after the flight; decoding and contour preparation
    // must not compete with the return animation for the main thread.
    if (!libraryVisible || collection !== 'library' || transitioning) return
    let active = true
    void (async () => {
      for (const id of templateIds.slice(0, 4)) {
        if (!active) break
        await warmSavedStickerCanvas(id)
      }
    })()
    return () => { active = false }
  }, [templateIds, transitioning, libraryVisible, collection])
  return (
    <Tabs value={collection} onValueChange={value => { if (value === 'community' || value === 'library') setCollection(value) }} variant="pill" className={styles.tabs} motionTransition={LIBRARY_SPRING}>
      <div className={styles.toolbar}>
      <TabsList label="Sticker collections" className={styles.list} indicatorClassName={styles.indicator}>
        <TabsTrigger value="community" className={`min-h-11 px-5 ${styles.trigger}`} indicatorClassName={styles.indicator}>Community Library</TabsTrigger>
        <TabsTrigger value="library" className={`min-h-11 px-5 ${styles.trigger}`} indicatorClassName={styles.indicator}>My Library</TabsTrigger>
      </TabsList>
      <Tabs value={layout} onValueChange={value => { if (value === 'grid' || value === 'list') setLayout(value) }} variant="pill" motionTransition={LIBRARY_SPRING}>
        <TabsList label="Library view" className={styles.list} indicatorClassName={styles.indicator}>
          <TabsTrigger value="grid" ariaLabel="Grid view" className={`min-h-11 ${styles.trigger} ${styles.viewTrigger}`} indicatorClassName={styles.indicator}><span title="Grid view"><IconSquareGrid2x2 width={20} height={20} fill="currentColor" aria-hidden="true" /></span></TabsTrigger>
          <TabsTrigger value="list" ariaLabel="List view" className={`min-h-11 ${styles.trigger} ${styles.viewTrigger}`} indicatorClassName={styles.indicator}><span title="List view"><IconListBullet width={20} height={20} fill="currentColor" aria-hidden="true" /></span></TabsTrigger>
        </TabsList>
      </Tabs>
      </div>
      <div className={styles.collections}>
      <TabsContent value="community" className={styles.collection} motionTransition={SPRING_EDITOR_REVEAL} motionOffset={-24}>
        <StickerGallery stickers={stickers} />
      </TabsContent>
      <TabsContent value="library" className={styles.collection} motionTransition={SPRING_EDITOR_REVEAL} motionOffset={24}>
        {saved.length ? <StickerGallery saved stickers={saved} /> : <EmptyView
          className={styles.empty}
          icon={<IconMagnifyingglass width={36} height={36} fill="currentColor" />}
          title={error ? 'Could not load My Library' : loaded ? 'No templates yet' : 'Loading templates…'}
          subtitle={error || 'Templates you save will appear here'}
        />}
      </TabsContent>
      </div>
    </Tabs>
  )
}
