/** Organisation: Klausuren mit Countdown und Lern-Fortschritt im zugehörigen Fach. */
import { MONTHS_SHORT, PAUSE } from './constants.ts'
import { sortItems } from './plan.ts'
import { WEEKDAYS_SHORT } from './summary.ts'
import { addDays, dayDiff, dayKey, mondayOf, parseDayKey } from './time.ts'
import type { ActId, ByDay, PlanItem } from './types.ts'

export type ExamRow = { it: PlanItem; n: number; word: string | null; tone: 'urgent' | 'soon' | ''; date: string }

const row = (it: PlanItem, today: Date): ExamRow => {
  const n = dayDiff(it.d, today)
  const dt = parseDayKey(it.d)
  return {
    it,
    n,
    word: n === 0 ? 'Heute' : n === 1 ? 'Morgen' : null,
    tone: n >= 0 && n <= 1 ? 'urgent' : n >= 0 && n <= 7 ? 'soon' : '',
    date: `${WEEKDAYS_SHORT[dt.getDay()]}, ${dt.getDate()}. ${MONTHS_SHORT[dt.getMonth()]} ${dt.getFullYear()}${it.t ? ` · ${it.t}` : ''}`,
  }
}

/** Anstehende Klausuren (ab heute, nächste zuerst) mit Countdown: Heute/Morgen, rosa ≤ 1, gelb ≤ 7. */
export const examRows = (all: PlanItem[], today: Date): ExamRow[] =>
  sortItems(all.filter((it) => it.type === 'klausur' && dayDiff(it.d, today) >= 0)).map((it) => row(it, today))

/** Vergangene Klausuren, jüngste zuerst. */
export const pastExamRows = (all: PlanItem[], today: Date): ExamRow[] =>
  sortItems(all.filter((it) => it.type === 'klausur' && dayDiff(it.d, today) < 0))
    .reverse()
    .map((it) => row(it, today))

export type Progress = {
  /** gelernt in der aktuellen Woche (Mo–So) */
  week: number
  /** gelernt insgesamt */
  total: number
  /** kumulierte Lernzeit am Ende jedes der letzten `days` Tage (ältester zuerst, letzter = heute) */
  series: number[]
}

/** Lern-Fortschritt eines Fachs (Grundlage: byDay – kurze Blöcke zählen dort schon nicht). */
export function progress(byDay: ByDay, act: ActId, today: Date, days = 28): Progress {
  if (act === PAUSE) return { week: 0, total: 0, series: Array(days).fill(0) }
  const tk = dayKey(today)
  const first = dayKey(addDays(today, -(days - 1)))
  const mon = dayKey(mondayOf(today))
  let total = 0
  let before = 0
  let week = 0
  const perDay: Record<string, number> = {}
  for (const [k, m] of Object.entries(byDay)) {
    const v = m[act] ?? 0
    if (!v || k > tk) continue
    total += v
    if (k < first) before += v
    else perDay[k] = v
    if (k >= mon) week += v
  }
  const series: number[] = []
  let acc = before
  for (let i = days - 1; i >= 0; i--) {
    acc += perDay[dayKey(addDays(today, -i))] ?? 0
    series.push(acc)
  }
  return { week, total, series }
}

/** Stunden mit einer Nachkommastelle und Komma: „0,3h“, „12,5h“. */
export const hoursDe = (sec: number): string => `${(Math.round(sec / 360) / 10).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}h`
