/**
 * Ordner-Sicherung: Dateinamen und Aufräumregeln.
 *
 * Im gewählten Ordner liegen
 *   kairos-aktuell.json        – immer der neueste Stand
 *   kairos-YYYY-MM-DD.json     – letzter Stand jedes Tages (die neuesten KEEP_DAYS bleiben)
 * Beide im normalen Backup-Format, also jederzeit per „Import“ ladbar.
 */
import { dayKey } from './time.ts'
import type { State } from './types.ts'

export const CURRENT_FILE = 'kairos-aktuell.json'
export const KEEP_DAYS = 30
/** Wartezeit nach einer Änderung, bevor geschrieben wird (bündelt schnelle Klickfolgen). */
export const AUTOSAVE_DELAY_MS = 2000

const DAILY = /^kairos-\d{4}-\d{2}-\d{2}\.json$/

export const dailyFile = (now: Date): string => `kairos-${dayKey(now)}.json`

export const isDailyFile = (name: string): boolean => DAILY.test(name)

/** Tageskopien, die über die neuesten `keep` hinausgehen (älteste zuerst). Andere Dateien bleiben unangetastet. */
export function filesToPrune(names: Iterable<string>, keep = KEEP_DAYS): string[] {
  const daily = [...names].filter(isDailyFile).sort()
  return daily.slice(0, Math.max(0, daily.length - keep))
}

/**
 * Enthält der Stand überhaupt Daten? Ein leerer Stand (z. B. frisch geöffnete App)
 * darf eine vorhandene Sicherung nie überschreiben.
 */
export function hasContent(s: State): boolean {
  if (s.meta.acts.length || s.meta.run) return true
  return Object.values(s.months).some((m) => m.s.length > 0 || (m.p?.length ?? 0) > 0)
}
