export const SAVED_PREVIEW_VERSION = 1

export interface SavedTemplate {
  id: string
  createdAt: number
  updatedAt?: number
  preview?: string
  previewVersion?: number
  design?: string
}

export interface SaveTemplateResult {
  template: SavedTemplate
  status: 'saved' | 'already_saved'
}

/** Replace this adapter with HTTP calls when designs move to SQL storage. */
export interface StickerLibraryRepository {
  list(): Promise<SavedTemplate[]>
  get(templateId: string): Promise<SavedTemplate | undefined>
  save(templateId: string, design: string, preview?: string): Promise<SaveTemplateResult>
  update(templateId: string, design: string, preview?: string): Promise<void>
}

let connection: Promise<IDBDatabase> | undefined

function database() {
  if (!connection) {
    connection = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('sticker-studio-library', 2)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('templates')) {
          request.result.createObjectStore('templates', { keyPath: 'id' })
        }
      }
      request.onsuccess = () => {
        const db = request.result
        db.onversionchange = () => { db.close(); connection = undefined }
        resolve(db)
      }
      request.onerror = () => { connection = undefined; reject(request.error) }
      request.onblocked = () => { connection = undefined; reject(new Error('Close other Sticker Studio tabs and try again.')) }
    })
  }
  return connection
}

export const stickerLibrary: StickerLibraryRepository = {
  async list(): Promise<SavedTemplate[]> {
    const db = await database()
    return new Promise((resolve, reject) => {
      const request = db.transaction('templates').objectStore('templates').getAll()
      request.onsuccess = () => resolve((request.result as SavedTemplate[]).sort((a, b) => b.createdAt - a.createdAt))
      request.onerror = () => reject(request.error)
    })
  },
  async get(templateId: string): Promise<SavedTemplate | undefined> {
    const db = await database()
    return new Promise((resolve, reject) => {
      const request = db.transaction('templates').objectStore('templates').get(templateId)
      request.onsuccess = () => resolve(request.result as SavedTemplate | undefined)
      request.onerror = () => reject(request.error)
    })
  },
  async update(templateId: string, design: string, preview?: string): Promise<void> {
    const db = await database()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('templates', 'readwrite')
      const store = transaction.objectStore('templates')
      const request = store.get(templateId)
      request.onsuccess = () => {
        if (request.result) store.put({ ...request.result, design, ...(preview === undefined ? {} : { preview, previewVersion: SAVED_PREVIEW_VERSION }), updatedAt: Date.now() })
      }
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error ?? new Error('Could not save changes.'))
    })
  },
  async save(templateId: string, design: string, preview?: string): Promise<SaveTemplateResult> {
    const db = await database()
    const template = { id: templateId, createdAt: Date.now(), updatedAt: Date.now(), design, preview, previewVersion: preview === undefined ? undefined : SAVED_PREVIEW_VERSION }
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('templates', 'readwrite')
      const store = transaction.objectStore('templates')
      const request = store.get(templateId)
      let result: SaveTemplateResult = { template, status: 'saved' }
      request.onsuccess = () => {
        if (request.result) {
          const existing = request.result as SavedTemplate
          result = { template: { ...existing, design, ...(preview === undefined ? {} : { preview, previewVersion: SAVED_PREVIEW_VERSION }), updatedAt: Date.now() }, status: 'already_saved' }
          store.put(result.template)
        } else store.add(template)
      }
      transaction.oncomplete = () => resolve(result)
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error ?? new Error('Could not save to My Library.'))
    })
  },
}
