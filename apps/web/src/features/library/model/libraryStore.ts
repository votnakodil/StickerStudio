import { upgradeSavedPreviews } from '../lib/upgradeSavedPreviews'
import { invalidatePreparedStickerCanvas, warmPreparedStickerCanvas } from './preparedStickerCanvas'
import { create } from 'zustand'
import { stickerLibrary } from '@/features/library/api/stickerLibrary'

interface LibraryStore {
  previews: Record<string, string>
  templateIds: string[]
  loaded: boolean
  error: string
}

export const useLibraryStore = create<LibraryStore>(() => ({ previews: {}, templateIds: [], loaded: false, error: '' }))
let loading: Promise<void> | undefined

export function loadMyLibrary() {
  if (useLibraryStore.getState().loaded) return Promise.resolve()
  if (!loading) {
    loading = stickerLibrary.list().then(async (saved) => {
      await upgradeSavedPreviews(saved, async (template, design) => {
        let preview: string | undefined
        await warmPreparedStickerCanvas(template.id, async () => design, value => { preview = value })
        return preview
      }, (id, design, preview) => queueDesignWrite(id, () => stickerLibrary.update(id, design, preview)))
      useLibraryStore.setState({ previews: Object.fromEntries(saved.filter(template => template.preview).map(template => [template.id, template.preview!])), templateIds: saved.map((template) => template.id), loaded: true, error: '' })
    }).catch((cause) => {
      useLibraryStore.setState({ loaded: true, error: cause instanceof Error ? cause.message : 'Could not load My Library.' })
    }).finally(() => { loading = undefined })
  }
  return loading
}

export async function saveToMyLibrary(templateId: string, design: string, preview?: string) {
  invalidatePreparedStickerCanvas(templateId)
  await loadMyLibrary()
  const saved = await queueDesignWrite(templateId, () => stickerLibrary.save(templateId, design, preview))
  invalidatePreparedStickerCanvas(templateId)
  useLibraryStore.setState((state) => ({
    templateIds: state.templateIds.includes(saved.template.id)
      ? state.templateIds : [saved.template.id, ...state.templateIds],
    previews: preview === undefined ? state.previews : { ...state.previews, [templateId]: preview },
    loaded: true,
    error: '',
  }))
  return { id: saved.template.id, status: saved.status }
}

const designWrites = new Map<string, Promise<void>>()

export async function getSavedStickerDesign(templateId: string) {
  await designWrites.get(templateId)
  return (await stickerLibrary.get(templateId))?.design
}

function queueDesignWrite<T>(templateId: string, write: () => Promise<T>): Promise<T> {
  const previous = designWrites.get(templateId) ?? Promise.resolve()
  const operation = previous.catch(() => {}).then(write)
  const pending = operation.then(() => {})
  designWrites.set(templateId, pending)
  void pending.finally(() => {
    if (designWrites.get(templateId) === pending) designWrites.delete(templateId)
  }).catch(() => {})
  return operation
}

export async function updateSavedStickerDesign(templateId: string, design: string, preview?: string) {
  invalidatePreparedStickerCanvas(templateId)
  await queueDesignWrite(templateId, () => stickerLibrary.update(templateId, design, preview))
  invalidatePreparedStickerCanvas(templateId)
  if (preview) setSavedStickerPreview(templateId, preview)
}

export function warmSavedStickerCanvas(id: string) {
  return warmPreparedStickerCanvas(id, () => getSavedStickerDesign(id), preview => {
    if (useLibraryStore.getState().previews[id] !== preview) setSavedStickerPreview(id, preview)
  })
}

export function setSavedStickerPreview(id: string, preview: string) {
  useLibraryStore.setState(state => ({ previews: { ...state.previews, [id]: preview } }))
}
