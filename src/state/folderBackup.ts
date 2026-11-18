/**
 * Automatische Ordner-Sicherung: hört auf den Store und schreibt kurz nach jeder
 * Änderung den kompletten Stand in den gewählten Ordner.
 *
 * Bewusst nur eine zusätzliche Kopie – der eigentliche Speicher bleibt die
 * Storage-Schicht (IndexedDB, später ggf. Sync). Der Ordner gehört zum Gerät
 * und wird in den Geräte-Einstellungen gemerkt, nicht in den Lerndaten.
 */
import { AUTOSAVE_DELAY_MS, hasContent } from '../domain/autosave.ts'
import { makeBackup } from '../domain/backup.ts'
import type { State } from '../domain/types.ts'
import type { DeviceSettings } from '../storage/device.ts'
import type { FolderDir } from '../storage/folder.ts'
import type { Store } from './store.ts'

export type FolderStatus =
  | { kind: 'unsupported' }
  | { kind: 'loading' }
  | { kind: 'off' }
  /** Ordner bekannt, aber der Browser will erst wieder eine Erlaubnis (Klick nötig). */
  | { kind: 'paused'; folder: string }
  | { kind: 'active'; folder: string; savedAt: number | null; error: string | null }

export type FolderDeps = {
  settings: DeviceSettings
  supported: boolean
  pick: () => Promise<FolderDir | null>
  write: (dir: FolderDir, json: string, now: Date) => Promise<void>
  now?: () => number
  delayMs?: number
}

const KEY = 'backupDir'

const errName = (e: unknown) => (e instanceof DOMException || e instanceof Error ? e.name : '')

function errorText(e: unknown): string {
  if (errName(e) === 'NotFoundError') return 'Ordner nicht gefunden – verschoben oder gelöscht?'
  if (errName(e) === 'QuotaExceededError') return 'Kein Speicherplatz mehr'
  return 'Schreiben fehlgeschlagen'
}

export class FolderBackup {
  status: FolderStatus
  private dir: FolderDir | null = null
  private written: State | null = null
  private timer: ReturnType<typeof setTimeout> | undefined
  private queue: Promise<void> = Promise.resolve()
  private unsubStore: (() => void) | null = null
  private listeners = new Set<() => void>()
  private now: () => number
  private delay: number

  constructor(
    private store: Store,
    private deps: FolderDeps,
  ) {
    this.status = deps.supported ? { kind: 'loading' } : { kind: 'unsupported' }
    this.now = deps.now ?? Date.now
    this.delay = deps.delayMs ?? AUTOSAVE_DELAY_MS
  }

  get = (): FolderStatus => this.status

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  /** Gemerkten Ordner laden. Hat der Browser die Erlaubnis dauerhaft gespeichert, läuft es ohne Rückfrage. */
  async init(): Promise<void> {
    if (!this.deps.supported) return
    const dir = await this.deps.settings.get<FolderDir>(KEY).catch(() => undefined)
    if (!dir) return this.set({ kind: 'off' })
    this.dir = dir
    const perm = await dir.queryPermission({ mode: 'readwrite' }).catch(() => 'prompt' as const)
    if (perm === 'granted') this.activate()
    else this.set({ kind: 'paused', folder: dir.name })
  }

  /** Ordner wählen (oder wechseln) und sofort sichern. */
  enable = async (): Promise<void> => {
    const dir = await this.deps.pick()
    if (!dir) return
    this.dir = dir
    this.written = null
    await this.deps.settings.set(KEY, dir).catch((e: unknown) => console.warn('[kairos] Ordner konnte nicht gemerkt werden', e))
    this.activate()
  }

  /** Nach Browser-Neustart: Erlaubnis erneut einholen (muss aus einem Klick kommen). */
  resume = async (): Promise<void> => {
    if (!this.dir) return
    const perm = await this.dir.requestPermission({ mode: 'readwrite' }).catch(() => 'denied' as const)
    if (perm === 'granted') this.activate()
  }

  disable = async (): Promise<void> => {
    clearTimeout(this.timer)
    this.unsubStore?.()
    this.unsubStore = null
    this.dir = null
    this.written = null
    await this.deps.settings.del(KEY).catch(() => {})
    this.set({ kind: 'off' })
  }

  saveNow = (): Promise<void> => this.write(true)

  /** Ausstehende Sicherung sofort schreiben (z. B. beim Schließen der Seite). */
  flush = (): Promise<void> => (this.timer ? this.write(false) : this.queue)

  private activate() {
    this.set({ kind: 'active', folder: this.dir?.name ?? '', savedAt: null, error: null })
    this.unsubStore ??= this.store.subscribe(this.onChange)
    void this.write(false)
  }

  private onChange = () => {
    if (this.status.kind !== 'active' || this.store.get() === this.written) return
    clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.write(false), this.delay)
  }

  private write(force: boolean): Promise<void> {
    clearTimeout(this.timer)
    this.timer = undefined
    this.queue = this.queue.then(async () => {
      const dir = this.dir
      if (!dir || this.status.kind !== 'active') return
      const s = this.store.get()
      if (!force && s === this.written) return
      // Ein leerer Stand überschreibt nie eine vorhandene Sicherung.
      if (!hasContent(s)) return
      const now = new Date(this.now())
      try {
        await this.deps.write(dir, makeBackup(s, now).json, now)
        this.written = s
        this.set({ kind: 'active', folder: dir.name, savedAt: now.getTime(), error: null })
      } catch (e) {
        console.error('[kairos] Ordner-Sicherung fehlgeschlagen', e)
        if (errName(e) === 'NotAllowedError' || errName(e) === 'SecurityError') this.set({ kind: 'paused', folder: dir.name })
        else {
          const savedAt = this.status.kind === 'active' ? this.status.savedAt : null
          this.set({ kind: 'active', folder: dir.name, savedAt, error: errorText(e) })
        }
      }
    })
    return this.queue
  }

  private set(s: FolderStatus) {
    this.status = s
    for (const fn of this.listeners) fn()
  }
}
