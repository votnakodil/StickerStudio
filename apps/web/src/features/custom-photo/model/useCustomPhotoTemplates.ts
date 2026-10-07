import { useEffect, useState } from 'react'
import { photoStorage } from '../api/photoStorage'
import { isCustomPhotoId } from './customPhotos'
import { createCustomPhotoPreviewCache, type CustomPhotoPreview } from './customPhotoPreviewCache'

const previews = createCustomPhotoPreviewCache(photoStorage, URL)

export function useCustomPhotoTemplates(ids: readonly string[]) {
  const [templates, setTemplates] = useState<CustomPhotoPreview[]>(() => previews.peek(ids))
  useEffect(() => {
    let active = true
    previews.retain(ids)
    void Promise.all(ids.filter(isCustomPhotoId).map(id => previews.get(id))).then(photos => {
      if (active) setTemplates(photos.flatMap(photo => photo ?? []))
    }).catch(() => { if (active) setTemplates(previews.peek(ids)) })
    return () => { active = false }
  }, [ids])
  return templates.filter(template => ids.includes(template.id))
}
