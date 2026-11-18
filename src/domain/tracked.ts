/**
 * Getrackte Zeit als Kalender-Blöcke („was habe ich wirklich gemacht“).
 * Quelle sind die Sessions + der laufende Timer; Pausen erscheinen nicht.
 */
import { PAUSE } from './constants.ts'
import { addDays, monthKeyOfSec, parseDayKey } from './time.ts'
import type { ActId, State } from './types.ts'

export type Tracked = {
  a: ActId
  /** Task-ID, falls der Timer an einem Task lief */
  k?: string
  /** Minuten ab lokaler Mitternacht (Uhrzeit im Raster), Ende bis 1440 */
  s: number
  e: number
  /** echte Zeitpunkte (s) des gesamten Blocks */
  start: number
  end: number
  /** läuft gerade */
  live: boolean
}

/** Gleiches Fach (und gleicher Task) mit höchstens so viel Lücke wird ein Block. */
export const MERGE_GAP_SEC = 60
/** Erst ab dieser Dauer wird ein Block gezeigt (auch ein laufender). Kürzeres wäre nur Rauschen. */
export const MIN_BLOCK_SEC = 5 * 60

const clockMin = (sec: number): number => {
  const d = new Date(sec * 1000)
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60
}

/**
 * Getrackte Blöcke je Tag für die angegebenen Tage. Blöcke über Mitternacht werden
 * geteilt; Grundlage ist die lokale Uhrzeit (auch an Tagen mit Zeitumstellung).
 */
export function trackedByDay(s: State, days: string[], nowSec: number): Record<string, Tracked[]> {
  const out: Record<string, Tracked[]> = {}
  if (!days.length) return out
  const sorted = [...days].sort()
  const from = parseDayKey(sorted[0]!).getTime() / 1000
  const to = addDays(parseDayKey(sorted.at(-1)!), 1).getTime() / 1000

  // Sessions starten im Monat ihres Starts – den Vormonat mitnehmen (über Monatsgrenzen laufende Sessions).
  const months = new Set([monthKeyOfSec(from - 86400 * 31), ...days.map((d) => d.slice(0, 7))])
  type Raw = { a: ActId; k?: string; start: number; end: number; live: boolean }
  const raw: Raw[] = []
  for (const mk of months)
    for (const [a, st, en, k] of s.months[mk]?.s ?? []) {
      if (a === PAUSE || en <= from || st >= to) continue
      raw.push({ a, ...(k ? { k } : {}), start: st, end: en, live: false })
    }
  const r = s.meta.run
  if (r && r.a !== PAUSE && nowSec > r.t && r.t < to && nowSec > from) raw.push({ a: r.a, ...(r.k ? { k: r.k } : {}), start: r.t, end: nowSec, live: true })
  raw.sort((x, y) => x.start - y.start)

  const merged: Raw[] = []
  for (const x of raw) {
    const last = merged.at(-1)
    if (last && last.a === x.a && last.k === x.k && x.start - last.end <= MERGE_GAP_SEC) {
      last.end = Math.max(last.end, x.end)
      last.live ||= x.live
    } else merged.push({ ...x })
  }

  for (const day of days) {
    const ds = parseDayKey(day).getTime() / 1000
    const de = addDays(parseDayKey(day), 1).getTime() / 1000
    const list: Tracked[] = []
    for (const x of merged) {
      if (x.end - x.start < MIN_BLOCK_SEC || x.end <= ds || x.start >= de) continue
      const a = Math.max(x.start, ds)
      const b = Math.min(x.end, de)
      list.push({
        a: x.a,
        ...(x.k ? { k: x.k } : {}),
        s: clockMin(a),
        e: b >= de ? 1440 : clockMin(b),
        start: x.start,
        end: x.end,
        live: x.live,
      })
    }
    out[day] = list
  }
  return out
}
