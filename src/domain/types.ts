/**
 * Datenmodell – kompatibel zum Legacy-Backup (siehe CLAUDE.md).
 * Kurze Feldnamen (c, d, t, e, g, u) sind bewusst so, nicht umbenennen.
 */

/** Fach-ID oder PAUSE ('_p'). */
export type ActId = string

export type Act = {
  id: ActId
  name: string
  /** Farbe (Hex aus der Palette) */
  c: string
  /** Soft delete – Historie bleibt erhalten */
  del?: true
}

/** Laufender Timer: Fach (oder Pause) und Start in Unix-Sekunden. */
export type Run = { a: ActId; t: number }

/** [Fach-ID, Start (s), Ende (s)] */
export type Session = [a: ActId, start: number, end: number]

export type PlanType = 'block' | 'abgabe' | 'klausur' | 'termin'

export type PlanItem = {
  id: string
  type: PlanType
  title: string
  /** Fach-ID → Farbe */
  act?: ActId
  /** 'YYYY-MM-DD' */
  d: string
  /** 'HH:MM' – Start bzw. Fälligkeit */
  t?: string
  /** 'HH:MM' – Ende (nur block/termin) */
  e?: string
  /** nur abgabe */
  done?: true
  /** Serien-ID (wöchentliche Wiederholung) */
  g?: string
}

/** LEGACY: wird zu PlanItems vom Typ 'klausur' migriert. */
export type LegacyExam = { id: string; name: string; d: string; t?: string }

export type Meta = {
  acts: Act[]
  run: Run | null
  /** zuletzt gelerntes Fach (für „Weiter“ nach Pause) */
  last: ActId | null
  /** updated-at (ms) */
  u: number
  exams?: LegacyExam[]
}

/** 'YYYY-MM' */
export type MonthKey = string

export type MonthDoc = {
  s: Session[]
  p?: PlanItem[]
  u: number
}

export type State = {
  meta: Meta
  months: Record<MonthKey, MonthDoc>
}

/** Sekunden pro Fach (inkl. PAUSE) an einem Tag. */
export type DayTotals = Record<ActId, number>

/** 'YYYY-MM-DD' → Sekunden pro Fach */
export type ByDay = Record<string, DayTotals>
