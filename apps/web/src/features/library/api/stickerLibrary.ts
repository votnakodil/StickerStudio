export interface SavedTemplate {
  id: string
  createdAt: number
}

export interface SaveTemplateResult {
  template: SavedTemplate
  status: 'saved' | 'already_saved'
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

export const stickerLibrary = {
  async list(): Promise<SavedTemplate[]> {
    const db = await database()
    return new Promise((resolve, reject) => {
      const request = db.transaction('templates').objectStore('templates').getAll()
      request.onsuccess = () => resolve((request.result as SavedTemplate[]).sort((a, b) => b.createdAt - a.createdAt))
      request.onerror = () => reject(request.error)
    })
  },
  async save(templateId: string): Promise<SaveTemplateResult> {
    const db = await database()
    const template = { id: templateId, createdAt: Date.now() }
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('templates', 'readwrite')
      const store = transaction.objectStore('templates')
      const request = store.get(templateId)
      let result: SaveTemplateResult = { template, status: 'saved' }
      request.onsuccess = () => {
        if (request.result) result = { template: request.result as SavedTemplate, status: 'already_saved' }
        else store.add(template)
      }
      transaction.oncomplete = () => resolve(result)
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error ?? new Error('Could not save to My Library.'))
    })
  },
}
