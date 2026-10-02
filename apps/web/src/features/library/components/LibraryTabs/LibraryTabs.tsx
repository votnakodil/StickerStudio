import { IconMagnifyingglass } from 'symbols-react'
import { useEffect } from 'react'
import { loadMyLibrary, useLibraryStore } from '@/features/library/model/libraryStore'
import type { StickerTemplate } from '@/features/library/model/stickers'
import { EmptyView } from '@/shared/ui/EmptyView/EmptyView'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/Tabs/Tabs'
import { StickerGallery } from '@/features/library/components/StickerGallery/StickerGallery'
import styles from './LibraryTabs.module.css'

interface LibraryTabsProps {
  stickers: readonly StickerTemplate[]
}

const LIBRARY_SPRING = { type: 'spring', stiffness: 330, damping: 24, mass: 0.7 } as const

export function LibraryTabs({ stickers }: LibraryTabsProps) {
  const templateIds = useLibraryStore((state) => state.templateIds)
  const saved = templateIds.flatMap((id) => {
    const template = stickers.find((sticker) => sticker.id === id)
    return template ? [template] : []
  })
  const loaded = useLibraryStore((state) => state.loaded)
  const error = useLibraryStore((state) => state.error)
  useEffect(() => { void loadMyLibrary() }, [])
  return (
    <Tabs defaultValue="community" variant="pill" className={styles.tabs} motionTransition={LIBRARY_SPRING}>
      <TabsList label="Sticker collections" className={styles.list} indicatorClassName={styles.indicator}>
        <TabsTrigger value="community" className={`min-h-11 px-5 ${styles.trigger}`} indicatorClassName={styles.indicator}>Community Library</TabsTrigger>
        <TabsTrigger value="library" className={`min-h-11 px-5 ${styles.trigger}`} indicatorClassName={styles.indicator}>My Library</TabsTrigger>
      </TabsList>
      <TabsContent value="community" className="mt-7">
        <StickerGallery stickers={stickers} />
      </TabsContent>
      <TabsContent value="library" className="mt-7">
        {saved.length ? <StickerGallery stickers={saved} /> : <EmptyView
          className={styles.empty}
          icon={<IconMagnifyingglass width={36} height={36} fill="currentColor" />}
          title={error ? 'Could not load My Library' : loaded ? 'No templates yet' : 'Loading templates…'}
          subtitle={error || 'Templates you save will appear here'}
        />}
      </TabsContent>
    </Tabs>
  )
}
