import { create } from 'zustand'
import { stickerLibrary } from '@/features/library/api/stickerLibrary'

interface LibraryStore {
  templateIds: string[]
  loaded: boolean
  error: string
}

export const useLibraryStore = create<LibraryStore>(() => ({ templateIds: [], loaded: false, error: '' }))
let loading: Promise<void> | undefined

export function loadMyLibrary() {
  if (useLibraryStore.getState().loaded) return Promise.resolve()
  if (!loading) {
    loading = stickerLibrary.list().then((saved) => {
      useLibraryStore.setState({ templateIds: saved.map((template) => template.id), loaded: true, error: '' })
    }).catch((cause) => {
      useLibraryStore.setState({ loaded: true, error: cause instanceof Error ? cause.message : 'Could not load My Library.' })
    }).finally(() => { loading = undefined })
  }
  return loading
}

export async function saveToMyLibrary(templateId: string) {
  await loadMyLibrary()
  const saved = await stickerLibrary.save(templateId)
  useLibraryStore.setState((state) => ({
    templateIds: state.templateIds.includes(saved.template.id)
      ? state.templateIds : [saved.template.id, ...state.templateIds],
    loaded: true,
    error: '',
  }))
  return { id: saved.template.id, status: saved.status }
}
