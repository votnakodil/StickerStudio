import type { StickerTemplate } from '../../../data/stickers'
import { AddPhotoCard } from '../AddPhotoCard/AddPhotoCard'
import { StickerCard } from '../StickerCard/StickerCard'

interface StickerGalleryProps {
  stickers: readonly StickerTemplate[]
}

export function StickerGallery({ stickers }: StickerGalleryProps) {
  return (
    <section aria-label="Sticker templates">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5">
        {stickers.map((sticker) => <StickerCard key={sticker.id} sticker={sticker} />)}
        <AddPhotoCard />
      </div>
    </section>
  )
}
