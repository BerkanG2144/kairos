import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CURRENT_FILE } from '../domain/autosave.ts'
import { addAct } from '../domain/tracker.ts'
import type { State } from '../domain/types.ts'
import { MemoryDeviceSettings } from '../storage/device.ts'
import { fakeFolder } from '../storage/fakeFolder.ts'
import { writeFolderBackup, type FolderDir } from '../storage/folder.ts'
import { MemoryStorage } from '../storage/memory.ts'
import { FolderBackup } from './folderBackup.ts'
import { Store } from './store.ts'

const NOW = new Date('2026-11-18T15:00:00+01:00').getTime()

async function setup(opts: { stored?: ReturnType<typeof fakeFolder>; withData?: boolean } = {}) {
  const store = await Store.open(new MemoryStorage(), () => Date.now())
  if (opts.withData !== false) store.dispatch((s, n) => addAct(s, 'Mathe', n))
  const settings = new MemoryDeviceSettings()
  if (opts.stored) await settings.set('backupDir', opts.stored.dir)
  const picked = fakeFolder('Gewählt')
  const pick = vi.fn(async (): Promise<FolderDir | null> => picked.dir)
  const fb = new FolderBackup(store, { settings, supported: true, pick, write: writeFolderBackup })
  await fb.init()
  return { store, settings, fb, picked, pick }
}

const saved = (files: Map<string, string>) => JSON.parse(files.get(CURRENT_FILE) ?? 'null')?.data as State | undefined

describe('FolderBackup', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })
  afterEach(() => vi.useRealTimers())

  it('nicht unterstützt (Firefox/Safari) → nichts passiert', async () => {
    const store = await Store.open(new MemoryStorage())
    const fb = new FolderBackup(store, { settings: new MemoryDeviceSettings(), supported: false, pick: vi.fn(), write: vi.fn() })
    await fb.init()
    expect(fb.get()).toEqual({ kind: 'unsupported' })
  })

  it('ohne gemerkten Ordner aus; Ordner wählen sichert sofort und merkt ihn', async () => {
    const { fb, picked, settings } = await setup()
    expect(fb.get().kind).toBe('off')
    await fb.enable()
    await fb.flush()
    expect(saved(picked.files)?.meta.acts.map((a) => a.name)).toEqual(['Mathe'])
    expect(picked.files.has('kairos-2026-11-18.json')).toBe(true)
    expect(fb.get()).toEqual({ kind: 'active', folder: 'Gewählt', savedAt: NOW, error: null })
    expect(await settings.get('backupDir')).toBe(picked.dir)
  })

  it('Abbruch im Auswahldialog lässt alles wie es ist', async () => {
    const { fb, pick } = await setup()
    pick.mockResolvedValueOnce(null)
    await fb.enable()
    expect(fb.get().kind).toBe('off')
  })

  it('bündelt schnelle Änderungen zu einem Schreibvorgang nach kurzer Pause', async () => {
    const { fb, picked, store } = await setup()
    await fb.enable()
    await fb.flush()
    const before = picked.state.writes
    store.dispatch((s, n) => addAct(s, 'Physik', n))
    store.dispatch((s, n) => addAct(s, 'Chemie', n))
    await vi.advanceTimersByTimeAsync(1000)
    expect(picked.state.writes).toBe(before)
    await vi.advanceTimersByTimeAsync(1500)
    await fb.flush()
    expect(picked.state.writes).toBe(before + 2) // aktuell + Tageskopie
    expect(saved(picked.files)?.meta.acts.map((a) => a.name)).toEqual(['Mathe', 'Physik', 'Chemie'])
  })

  it('flush schreibt eine ausstehende Änderung sofort (Seite wird geschlossen)', async () => {
    const { fb, picked, store } = await setup()
    await fb.enable()
    await fb.flush()
    store.dispatch((s, n) => addAct(s, 'Physik', n))
    await fb.flush()
    expect(saved(picked.files)?.meta.acts).toHaveLength(2)
  })

  it('leerer Stand überschreibt nie eine vorhandene Sicherung', async () => {
    const stored = fakeFolder('Alt')
    stored.files.set(CURRENT_FILE, '{"wichtig":true}')
    const { fb } = await setup({ stored, withData: false })
    expect(fb.get().kind).toBe('active')
    await fb.flush()
    await fb.saveNow()
    expect(stored.files.get(CURRENT_FILE)).toBe('{"wichtig":true}')
  })

  it('gemerkter Ordner mit dauerhafter Erlaubnis → läuft ohne Rückfrage', async () => {
    const stored = fakeFolder('Kairos', 'granted')
    const { fb } = await setup({ stored })
    await fb.flush()
    expect(fb.get()).toMatchObject({ kind: 'active', folder: 'Kairos' })
    expect(saved(stored.files)?.meta.acts).toHaveLength(1)
  })

  it('Erlaubnis abgelaufen → pausiert; nach Fortsetzen wird nachgeholt', async () => {
    const stored = fakeFolder('Kairos', 'prompt')
    const { fb, store } = await setup({ stored })
    expect(fb.get()).toEqual({ kind: 'paused', folder: 'Kairos' })
    store.dispatch((s, n) => addAct(s, 'Physik', n))
    await vi.advanceTimersByTimeAsync(5000)
    expect(stored.files.size).toBe(0)
    await fb.resume()
    await fb.flush()
    expect(fb.get().kind).toBe('active')
    expect(saved(stored.files)?.meta.acts).toHaveLength(2)
  })

  it('Schreibfehler: Erlaubnis entzogen → pausiert, Ordner weg → Fehlermeldung, nächster Versuch klappt', async () => {
    const { fb, picked, store } = await setup()
    await fb.enable()
    await fb.flush()
    picked.state.failWith = 'NotFoundError'
    store.dispatch((s, n) => addAct(s, 'Physik', n))
    await fb.flush()
    expect(fb.get()).toMatchObject({ kind: 'active', error: 'Ordner nicht gefunden – verschoben oder gelöscht?', savedAt: NOW })
    picked.state.failWith = null
    await fb.saveNow()
    expect(fb.get()).toMatchObject({ kind: 'active', error: null })
    picked.state.failWith = 'NotAllowedError'
    store.dispatch((s, n) => addAct(s, 'Bio', n))
    await fb.flush()
    expect(fb.get().kind).toBe('paused')
  })

  it('Ausschalten: kein Schreiben mehr, Ordner vergessen', async () => {
    const { fb, picked, store, settings } = await setup()
    await fb.enable()
    await fb.flush()
    await fb.disable()
    const writes = picked.state.writes
    store.dispatch((s, n) => addAct(s, 'Physik', n))
    await vi.advanceTimersByTimeAsync(5000)
    expect(picked.state.writes).toBe(writes)
    expect(fb.get().kind).toBe('off')
    expect(await settings.get('backupDir')).toBeUndefined()
  })
})
