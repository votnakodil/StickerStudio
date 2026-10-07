import { parseCutoutJob } from './cutoutApi'
import type { CustomPhoto, PhotoStorage } from '../model/types'

let connection: Promise<IDBDatabase> | undefined
function database() {
  if (!connection) connection = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('sticker-studio-custom-photos', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('photos', { keyPath: 'id' })
    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => { db.close(); connection = undefined }
      resolve(db)
    }
    request.onerror = () => { connection = undefined; reject(request.error) }
    request.onblocked = () => { connection = undefined; reject(new Error('Close other Sticker Studio tabs and try again.')) }
  })
  return connection
}
function parsePhoto(value: unknown): CustomPhoto | undefined {
  if (value === undefined) return undefined
  if (!value || typeof value !== 'object' || !('id' in value) || typeof value.id !== 'string'
    || !('name' in value) || typeof value.name !== 'string' || !('source' in value) || !(value.source instanceof Blob)
    || !('idempotencyKey' in value) || typeof value.idempotencyKey !== 'string'
    || !('createdAt' in value) || typeof value.createdAt !== 'number' || !Number.isFinite(value.createdAt)) throw new Error('This saved photo could not be restored.')
  return { id: value.id, name: value.name, source: value.source, idempotencyKey: value.idempotencyKey, createdAt: value.createdAt,
    ...('job' in value && value.job ? { job: parseCutoutJob(value.job) } : {}),
    ...('result' in value && value.result instanceof Blob ? { result: value.result } : {}),
    resultAcknowledged: 'resultAcknowledged' in value && value.resultAcknowledged === true }
}
export const photoStorage: PhotoStorage = {
  async get(id) {
    const db = await database()
    return new Promise((resolve, reject) => {
      const request = db.transaction('photos').objectStore('photos').get(id)
      request.onsuccess = () => { try { resolve(parsePhoto(request.result)) } catch (cause) { reject(cause) } }
      request.onerror = () => reject(request.error)
    })
  },
  async put(photo) {
    const db = await database()
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('photos', 'readwrite')
      transaction.objectStore('photos').put(photo)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error ?? new Error('Could not retain this photo on your device.'))
    })
  },
}
