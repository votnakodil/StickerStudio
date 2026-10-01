import { IconMagnifyingglass } from 'symbols-react'
import type { StickerTemplate } from '../../../data/stickers'
import { EmptyView } from '../../ui/EmptyView'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/Tabs'
import { StickerGallery } from '../StickerGallery/StickerGallery'
import styles from './LibraryTabs.module.css'

interface LibraryTabsProps {
  stickers: readonly StickerTemplate[]
}

const LIBRARY_SPRING = { type: 'spring', stiffness: 330, damping: 24, mass: 0.7 } as const

export function LibraryTabs({ stickers }: LibraryTabsProps) {
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
        <EmptyView
          className={styles.empty}
          icon={<IconMagnifyingglass width={36} height={36} fill="currentColor" />}
          title="No stickers yet"
          subtitle="Stickers you create will appear here"
        />
      </TabsContent>
    </Tabs>
  )
}
