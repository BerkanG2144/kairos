/**
 * Getrackte Zeit als Kalender-Blöcke („was habe ich wirklich gemacht“).
 * Quelle sind die Sessions + der laufende Timer; Pausen erscheinen nicht.
 */
import { PAUSE } from './constants.ts'
import { countedBlocks } from './sessions.ts'
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

export { MERGE_GAP_SEC, MIN_BLOCK_SEC } from './sessions.ts'

const clockMin = (sec: number): number => {
  const d = new Date(sec * 1000)
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60
}

/**
 * Getrackte Blöcke je Tag für die angegebenen Tage (ohne Pausen, ohne Blöcke unter 5 min –
 * gleiche Regel wie Stunden und Statistik). Blöcke über Mitternacht werden geteilt;
 * Grundlage ist die lokale Uhrzeit (auch an Tagen mit Zeitumstellung).
 */
export function trackedByDay(s: State, days: string[], nowSec: number): Record<string, Tracked[]> {
  const out: Record<string, Tracked[]> = {}
  if (!days.length) return out
  const list = countedBlocks(s, nowSec).filter((b) => b.a !== PAUSE)
  for (const day of days) {
    const ds = parseDayKey(day).getTime() / 1000
    const de = addDays(parseDayKey(day), 1).getTime() / 1000
    const res: Tracked[] = []
    for (const x of list) {
      if (x.end < ds || x.start >= de || (x.end === ds && !x.live)) continue
      const a = Math.max(x.start, ds)
      const b = Math.min(x.end, de)
      res.push({
        a: x.a,
        ...(x.k ? { k: x.k } : {}),
        s: clockMin(a),
        e: b >= de ? 1440 : clockMin(b),
        start: x.start,
        end: x.end,
        live: x.live,
      })
    }
    out[day] = res
  }
  return out
}

/**
 * Löscht einen beendeten Block: alle Sessions mit gleichem Fach und Task, die ganz in seinem
 * Zeitraum liegen (genau die, aus denen er zusammengesetzt ist – auch über Mitternacht/Monatsgrenze).
 */
export function deleteTracked(s: State, b: Pick<Tracked, 'a' | 'k' | 'start' | 'end'>, nowMs: number): State {
  const first = monthKeyOfSec(b.start)
  const last = monthKeyOfSec(b.end)
  let months = s.months
  for (const [mk, doc] of Object.entries(s.months)) {
    if (mk < first || mk > last) continue
    const keep = doc.s.filter(([a, st, en, k]) => !(a === b.a && k === b.k && st >= b.start && en <= b.end))
    if (keep.length !== doc.s.length) months = { ...months, [mk]: { ...doc, s: keep, u: nowMs } }
  }
  return months === s.months ? s : { ...s, months }
}
