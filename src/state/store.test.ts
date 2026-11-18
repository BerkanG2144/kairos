import { SCHEMA_VERSION } from '../domain/migrate.ts'
import { describe, expect, it, vi } from 'vitest'
import { emptyState } from '../domain/state.ts'
import { addAct, start, stop } from '../domain/tracker.ts'
import type { State } from '../domain/types.ts'
import { MemoryStorage } from '../storage/memory.ts'
import type { Storage } from '../storage/Storage.ts'
import { diff, Store } from './store.ts'

const T = new Date('2026-11-18T10:00:00').getTime()

describe('diff', () => {
  it('erkennt geänderte, neue und entfernte Dokumente per Referenz', () => {
    const a: State = { meta: emptyState().meta, months: { x: { s: [], u: 0 }, y: { s: [], u: 0 } } }
    expect(diff(a, a)).toBeNull()
    const b: State = { meta: a.meta, months: { x: a.months.x!, z: { s: [], u: 1 } } }
    expect(diff(a, b)).toEqual({ months: { y: null, z: { s: [], u: 1 } } })
    expect(diff(a, { ...a, meta: { ...a.meta } })).toEqual({ meta: a.meta })
  })
})

describe('Store', () => {
  it('startet leer ohne gespeicherte Daten', async () => {
    const store = await Store.open(new MemoryStorage())
    expect(store.get()).toEqual(emptyState())
  })

  it('dispatch aktualisiert, benachrichtigt und speichert', async () => {
    const storage = new MemoryStorage()
    let now = T
    const store = await Store.open(storage, () => now)
    const fn = vi.fn()
    store.subscribe(fn)

    store.dispatch((s, n) => addAct(s, 'Mathe', n))
    const id = store.get().meta.acts[0]!.id
    store.dispatch((s, n) => start(s, id, n))
    now += 60_000
    store.dispatch(stop)
    await store.flush()

    expect(fn).toHaveBeenCalledTimes(3)
    const saved = await storage.load()
    expect(saved?.schema).toBe(SCHEMA_VERSION)
    expect(saved?.state).toEqual(store.get())
    expect(saved?.state.months['2026-11']!.s).toEqual([[id, T / 1000, T / 1000 + 60]])
  })

  it('keine Änderung → kein Speichern, keine Benachrichtigung', async () => {
    const storage = new MemoryStorage()
    const store = await Store.open(storage)
    const save = vi.spyOn(storage, 'save')
    const fn = vi.fn()
    store.subscribe(fn)
    store.dispatch((s) => s)
    await store.flush()
    expect(save).not.toHaveBeenCalled()
    expect(fn).not.toHaveBeenCalled()
  })

  it('migriert beim Laden alte Daten und speichert sie', async () => {
    const legacy: State = {
      meta: { ...emptyState().meta, exams: [{ id: 'e1', name: 'HM', d: '2027-02-10' }] },
      months: {},
    }
    const storage = new MemoryStorage({ state: legacy, schema: 1 })
    const store = await Store.open(storage, () => T)
    await store.flush()
    expect('exams' in store.get().meta).toBe(false)
    const saved = await storage.load()
    expect(saved?.schema).toBe(SCHEMA_VERSION)
    expect(saved?.state.months['2027-02']!.p).toHaveLength(1)
  })

  it('replace ersetzt alles', async () => {
    const storage = new MemoryStorage()
    const store = await Store.open(storage)
    store.dispatch((s, n) => addAct(s, 'Alt', n))
    const imported: State = { ...emptyState(), months: { '2025-01': { s: [['a', 1, 2]], u: 0 } } }
    await store.replace(imported)
    expect(store.get()).toEqual(imported)
    expect((await storage.load())?.state).toEqual(imported)
  })

  it('Speicherfehler setzen status = error, nächster Erfolg wieder ok', async () => {
    const storage = new MemoryStorage()
    const store = await Store.open(storage)
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const save = vi.spyOn(storage as Storage, 'save').mockRejectedValueOnce(new Error('voll'))
    store.dispatch((s, n) => addAct(s, 'A', n))
    await store.flush()
    expect(store.status).toBe('error')
    store.dispatch((s, n) => addAct(s, 'B', n))
    await store.flush()
    expect(store.status).toBe('ok')
    expect(save).toHaveBeenCalledTimes(2)
    err.mockRestore()
  })
})
