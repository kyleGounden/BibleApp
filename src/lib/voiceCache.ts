const DB_NAME = 'scripture.voice'
const DB_VERSION = 1
const STORE = 'clips'

type StoredClip = {
  key: string
  sampleRate: number
  samples: ArrayBuffer
}

let opening: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('No IndexedDB'))
  if (!opening) {
    opening = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onerror = () => reject(request.error ?? new Error('IndexedDB failed'))
      request.onsuccess = () => resolve(request.result)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' })
      }
    })
    opening.catch(() => {
      opening = null
    })
  }
  return opening
}

export async function readVoiceClip(key: string): Promise<{ samples: Float32Array; sampleRate: number } | null> {
  try {
    const db = await openDb()
    const row = await new Promise<StoredClip | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const request = tx.objectStore(STORE).get(key)
      request.onerror = () => reject(request.error ?? new Error('Read failed'))
      request.onsuccess = () => resolve(request.result as StoredClip | undefined)
    })
    if (!row?.samples || !row.sampleRate) return null
    return { samples: new Float32Array(row.samples), sampleRate: row.sampleRate }
  } catch {
    return null
  }
}

export async function writeVoiceClip(key: string, samples: Float32Array, sampleRate: number): Promise<void> {
  try {
    const db = await openDb()
    const copy = samples.slice().buffer as ArrayBuffer
    const row: StoredClip = { key, sampleRate, samples: copy }
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const request = tx.objectStore(STORE).put(row)
      request.onerror = () => reject(request.error ?? new Error('Write failed'))
      request.onsuccess = () => resolve()
    })
  } catch {
    /* private mode or quota */
  }
}
