import type { StickerTemplate } from '@/features/library/model/stickers'
import { useLibraryGalleryStore } from '@/features/library/model/libraryGalleryStore'
import { AddPhotoCard } from '@/features/library/components/AddPhotoCard/AddPhotoCard'
import { StickerCard } from '@/features/library/components/StickerCard/StickerCard'
import { GridList } from '@/shared/ui/GridList'

interface StickerGalleryProps {
  saved?: boolean
  stickers: readonly StickerTemplate[]
}

export function StickerGallery({ stickers, saved = false }: StickerGalleryProps) {
  const layout = useLibraryGalleryStore(state => state.layout)
  return (
    <GridList items={stickers} layout={layout} getKey={sticker => sticker.id}
      label="Sticker templates" trailingItem={context => <AddPhotoCard {...context} />}
      renderItem={(sticker, { layout, flipId }) => <StickerCard saved={saved} sticker={sticker} layout={layout} flipId={flipId} />} />
  )
}
