/**
 * IndexedDB-Speicher ohne Zusatzbibliothek.
 *
 * DB 'lernzeit' v1:
 *   store 'docs': key 'meta' → Meta, key 'm-YYYY-MM' → MonthDoc
 *   store 'sys':  key 'schema' → number
 */
import type { Meta, MonthDoc, State } from '../domain/types.ts'
import type { DocChanges, Storage, Stored } from './Storage.ts'

const DB_NAME = 'lernzeit'
const DB_VERSION = 1
const DOCS = 'docs'
const SYS = 'sys'
const MONTH_PREFIX = 'm-'

const req = <T>(r: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })

const done = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('Transaktion abgebrochen'))
  })

function open(name: string, factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = factory.open(name, DB_VERSION)
    r.onupgradeneeded = () => {
      const db = r.result
      if (!db.objectStoreNames.contains(DOCS)) db.createObjectStore(DOCS)
      if (!db.objectStoreNames.contains(SYS)) db.createObjectStore(SYS)
    }
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
    r.onblocked = () => reject(new Error('IndexedDB blockiert'))
  })
}

export class IdbStorage implements Storage {
  private db: Promise<IDBDatabase>

  constructor(name = DB_NAME, factory: IDBFactory = indexedDB) {
    this.db = open(name, factory)
  }

  async load(): Promise<Stored | null> {
    const db = await this.db
    const tx = db.transaction([DOCS, SYS], 'readonly')
    const docs = tx.objectStore(DOCS)
    const [keys, values, schema] = await Promise.all([
      req(docs.getAllKeys()),
      req(docs.getAll()),
      req(tx.objectStore(SYS).get('schema') as IDBRequest<number | undefined>),
    ])
    if (!keys.length) return null
    let meta: Meta | null = null
    const months: Record<string, MonthDoc> = {}
    keys.forEach((k, i) => {
      if (k === 'meta') meta = values[i] as Meta
      else if (typeof k === 'string' && k.startsWith(MONTH_PREFIX)) months[k.slice(MONTH_PREFIX.length)] = values[i] as MonthDoc
    })
    const state: State = { meta: meta ?? { acts: [], run: null, last: null, u: 0 }, months }
    return { state, schema: schema ?? 1 }
  }

  async save(changes: DocChanges, schema: number): Promise<void> {
    const db = await this.db
    const tx = db.transaction([DOCS, SYS], 'readwrite')
    const docs = tx.objectStore(DOCS)
    if (changes.meta) docs.put(changes.meta, 'meta')
    for (const [k, v] of Object.entries(changes.months ?? {})) {
      if (v) docs.put(v, MONTH_PREFIX + k)
      else docs.delete(MONTH_PREFIX + k)
    }
    tx.objectStore(SYS).put(schema, 'schema')
    await done(tx)
  }

  async replaceAll(state: State, schema: number): Promise<void> {
    const db = await this.db
    const tx = db.transaction([DOCS, SYS], 'readwrite')
    const docs = tx.objectStore(DOCS)
    docs.clear()
    docs.put(state.meta, 'meta')
    for (const [k, v] of Object.entries(state.months)) docs.put(v, MONTH_PREFIX + k)
    tx.objectStore(SYS).put(schema, 'schema')
    await done(tx)
  }

  async close(): Promise<void> {
    ;(await this.db).close()
  }
}
