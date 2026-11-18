/**
 * App-Store ohne React: hält den State, wendet reine Aktionen an und speichert
 * nur die Dokumente, die sich geändert haben (Referenzvergleich – die Domain-
 * Funktionen arbeiten unveränderlich). Schreibvorgänge laufen strikt nacheinander.
 */
import { migrate, SCHEMA_VERSION } from '../domain/migrate.ts'
import { normalizeState } from '../domain/normalize.ts'
import { emptyState } from '../domain/state.ts'
import type { State } from '../domain/types.ts'
import type { DocChanges, Storage } from '../storage/Storage.ts'

export type Action = (s: State, nowMs: number) => State

export type SaveStatus = 'ok' | 'error'

export function diff(prev: State, next: State): DocChanges | null {
  const changes: DocChanges = {}
  let any = false
  if (prev.meta !== next.meta) {
    changes.meta = next.meta
    any = true
  }
  const months: NonNullable<DocChanges['months']> = {}
  for (const k in next.months) if (prev.months[k] !== next.months[k]) months[k] = next.months[k]!
  for (const k in prev.months) if (!(k in next.months)) months[k] = null
  if (Object.keys(months).length) {
    changes.months = months
    any = true
  }
  return any ? changes : null
}

export class Store {
  private state: State
  private listeners = new Set<() => void>()
  private queue: Promise<void> = Promise.resolve()
  status: SaveStatus = 'ok'

  private constructor(
    private storage: Storage,
    initial: State,
    private now: () => number,
  ) {
    this.state = initial
  }

  /** Lädt, normalisiert und migriert. Speichert zurück, falls die Migration etwas geändert hat. */
  static async open(storage: Storage, now: () => number = Date.now): Promise<Store> {
    const stored = await storage.load()
    if (!stored) return new Store(storage, emptyState(), now)
    const n = normalizeState(stored.state)
    const base = n?.state ?? emptyState()
    const state = migrate(base, stored.schema, now())
    const store = new Store(storage, state, now)
    if (stored.schema < SCHEMA_VERSION || state !== base) store.persist(stored.state, state)
    return store
  }

  get = (): State => this.state

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  dispatch = (action: Action): void => {
    const prev = this.state
    const next = action(prev, this.now())
    if (next === prev) return
    this.state = next
    this.emit()
    this.persist(prev, next)
  }

  /** Ersetzt alle Daten (Import). */
  replace = (state: State): Promise<void> => {
    this.state = state
    this.emit()
    return this.enqueue(() => this.storage.replaceAll(state, SCHEMA_VERSION))
  }

  /** Wartet, bis alle ausstehenden Schreibvorgänge erledigt sind. */
  flush = (): Promise<void> => this.queue

  private persist(prev: State, next: State) {
    const changes = diff(prev, next)
    if (changes) void this.enqueue(() => this.storage.save(changes, SCHEMA_VERSION))
  }

  private enqueue(job: () => Promise<void>): Promise<void> {
    this.queue = this.queue.then(job).then(
      () => this.setStatus('ok'),
      (e: unknown) => {
        console.error('[lernzeit] Speichern fehlgeschlagen', e)
        this.setStatus('error')
      },
    )
    return this.queue
  }

  private setStatus(s: SaveStatus) {
    if (this.status === s) return
    this.status = s
    this.emit()
  }

  private emit() {
    for (const fn of this.listeners) fn()
  }
}
