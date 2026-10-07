import type { PhotoStorage } from './types'

export interface CustomPhotoPreview {
  id: string
  name: string
  preview: { src: string; visibleBounds: { left: number; top: number; width: number; height: number } }
}

/** Preview URLs belong to the saved collection, rather than a route mount. */
export function createCustomPhotoPreviewCache(storage: Pick<PhotoStorage, 'get'>, urls: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'>) {
  const entries = new Map<string, CustomPhotoPreview>()
  const pending = new Map<string, Promise<CustomPhotoPreview | undefined>>()
  return {
    peek(ids: readonly string[]) { return ids.flatMap(id => entries.get(id) ?? []) },
    async get(id: string) {
      const cached = entries.get(id)
      if (cached) return cached
      let loading = pending.get(id)
      if (!loading) {
        loading = storage.get(id).then(photo => {
          if (!photo?.result) return undefined
          const template: CustomPhotoPreview = { id: photo.id, name: photo.name,
            preview: { src: urls.createObjectURL(photo.result), visibleBounds: { left: 0, top: 0, width: 512, height: 512 } } }
          entries.set(id, template)
          return template
        }).finally(() => pending.delete(id))
        pending.set(id, loading)
      }
      return loading
    },
    retain(ids: readonly string[]) {
      const retained = new Set(ids)
      for (const [id, template] of entries) {
        if (!retained.has(id)) { urls.revokeObjectURL(template.preview.src); entries.delete(id) }
      }
    },
  }
}
