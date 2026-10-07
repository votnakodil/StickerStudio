import { photoStorage } from '../api/photoStorage'
import { validatePhoto } from './photoValidation'
import type { CustomPhoto } from './types'

export const isCustomPhotoId = (id: string | undefined): id is string => Boolean(id?.startsWith('custom-'))
export async function prepareCustomPhoto(file: File) {
  const error = validatePhoto(file)
  if (error) throw new Error(error)
  const photo: CustomPhoto = { id: `custom-${crypto.randomUUID()}`, name: file.name.replace(/\.[^.]+$/, '') || 'My photo', source: file,
    idempotencyKey: crypto.randomUUID(), createdAt: Date.now() }
  await photoStorage.put(photo)
  return photo.id
}
