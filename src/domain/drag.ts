/** Zeit-Mathematik für Drag & Drop im Wochenraster (Minuten seit Mitternacht). */
import { SNAP_MIN } from './lanes.ts'

export const snap = (m: number, step = SNAP_MIN): number => Math.round(m / step) * step

/** Bereich [h0, h1] in Minuten. */
export const clampMin = (m: number, h0: number, h1: number): number => Math.max(h0 * 60, Math.min(h1 * 60, m))

/** Ziehen auf freier Fläche: Start/Ende aus Anker a und aktueller Position b; Klick ohne Ziehen → 1 h. */
export function createRange(a: number, b: number, moved: boolean): { s: number; e: number } {
  if (!moved) return { s: a, e: a + 60 }
  const s = Math.min(a, b)
  return { s, e: Math.max(Math.max(a, b), s + SNAP_MIN) }
}

/** Verschieben: neue Startzeit aus Zeigerposition minus Greifpunkt; Dauer bleibt, Tag wird nicht verlassen. */
export function moveRange(raw: number, grab: number, dur: number, h0: number, h1: number): { s: number; e: number } {
  const s = Math.max(h0 * 60, Math.min(h1 * 60 - dur, snap(raw - grab)))
  return { s, e: s + dur }
}

/** Länge ändern: Ende mindestens Start + 15 min. */
export function resizeEnd(s: number, raw: number, h0: number, h1: number): number {
  return Math.max(s + SNAP_MIN, clampMin(snap(raw), h0, h1))
}
