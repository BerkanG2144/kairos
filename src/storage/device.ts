/**
 * Geräte-Einstellungen, die NICHT zu den Lerndaten gehören und nie synchronisiert
 * werden (z. B. der Ordner der Sicherung). Eigene kleine IndexedDB.
 */
const DB = 'kairos-device'
const KV = 'kv'

export interface DeviceSettings {
  get<T>(key: string): Promise<T | undefined>
  set(key: string, value: unknown): Promise<void>
  del(key: string): Promise<void>
}

const req = <T>(r: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })

export class IdbDeviceSettings implements DeviceSettings {
  private db: Promise<IDBDatabase>

  constructor(factory: IDBFactory = indexedDB) {
    this.db = new Promise((resolve, reject) => {
      const r = factory.open(DB, 1)
      r.onupgradeneeded = () => r.result.createObjectStore(KV)
      r.onsuccess = () => resolve(r.result)
      r.onerror = () => reject(r.error)
    })
  }

  private async store(mode: IDBTransactionMode) {
    return (await this.db).transaction(KV, mode).objectStore(KV)
  }

  async get<T>(key: string): Promise<T | undefined> {
    return req((await this.store('readonly')).get(key)) as Promise<T | undefined>
  }

  async set(key: string, value: unknown): Promise<void> {
    await req((await this.store('readwrite')).put(value, key))
  }

  async del(key: string): Promise<void> {
    await req((await this.store('readwrite')).delete(key))
  }
}

export class MemoryDeviceSettings implements DeviceSettings {
  private m = new Map<string, unknown>()
  async get<T>(key: string) {
    return this.m.get(key) as T | undefined
  }
  async set(key: string, value: unknown) {
    this.m.set(key, value)
  }
  async del(key: string) {
    this.m.delete(key)
  }
}
