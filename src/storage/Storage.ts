import type { Meta, MonthDoc, MonthKey, State } from '../domain/types.ts'

export type Stored = { state: State; schema: number }

/** Änderungen an einzelnen Dokumenten. null bei einem Monat = löschen. */
export type DocChanges = {
  meta?: Meta
  months?: Record<MonthKey, MonthDoc | null>
}

/**
 * Persistenz pro Dokument ('meta' + ein Dokument je Monat) – so lässt sich später
 * ein Sync-Backend mit Konfliktauflösung pro Monat ergänzen.
 */
export interface Storage {
  /** null = noch nie gespeichert */
  load(): Promise<Stored | null>
  save(changes: DocChanges, schema: number): Promise<void>
  /** Ersetzt alles (Import). */
  replaceAll(state: State, schema: number): Promise<void>
}
