import { create } from 'zustand'
import type { GridListLayout } from '@/shared/ui/GridList'

interface LibraryGalleryStore {
  collection: 'community' | 'library'
  setCollection: (collection: 'community' | 'library') => void
  layout: GridListLayout
  setLayout: (layout: GridListLayout) => void
}

export const useLibraryGalleryStore = create<LibraryGalleryStore>(set => ({
  collection: 'community',
  setCollection: collection => set({ collection }),
  layout: 'grid',
  setLayout: layout => set({ layout }),
}))
