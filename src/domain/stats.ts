/** Statistik-Tab: Tagesbilanz (heute), Zeitraum-Auswertung, Serien. */
import { LEARN_DAY_MIN_SEC, PAUSE } from './constants.ts'
import { learned } from './sessions.ts'
import { toItems, type Item } from './summary.ts'
import { addDays, dayKey, parseDayKey, startOfDay } from './time.ts'
import type { Act, ByDay, DayTotals } from './types.ts'

/** 'day' = Tagesbilanz eines einzelnen Tages (Standard: heute) */
export type Range = 'day' | '7' | '30' | '365' | 'all'
export const RANGES: { r: Range; label: string }[] = [
  { r: 'day', label: 'Heute' },
  { r: '7', label: '7 Tage' },
  { r: '30', label: '30 Tage' },
  { r: '365', label: 'Jahr' },
  { r: 'all', label: 'Gesamt' },
]
export const isRange = (x: unknown): x is Range => RANGES.some((r) => r.r === x)

export type ActStat = Item & { days: number }
export type RangeStats = { items: ActStat[]; total: number; studyDays: number; avg: number }

const isLearnDay = (m: DayTotals | undefined) => learned(m) >= LEARN_DAY_MIN_SEC

/** Auswertung für die letzten n Tage inkl. heute (bzw. nur heute / alles bis heute). */
export function rangeStats(byDay: ByDay, range: Range, today: Date, acts: Act[]): RangeStats {
  const tk = dayKey(today)
  const n = range === 'day' ? 1 : Number(range)
  const cutoff = range === 'all' ? '' : dayKey(addDays(today, -(n - 1)))
  const per: DayTotals = {}
  const perDays: Record<string, number> = {}
  let studyDays = 0
  for (const [k, m] of Object.entries(byDay)) {
    if (k > tk || (cutoff && k < cutoff)) continue
    if (isLearnDay(m)) studyDays++
    for (const [a, v] of Object.entries(m)) {
      if (a === PAUSE) continue
      per[a] = (per[a] ?? 0) + v
      if (v >= LEARN_DAY_MIN_SEC) perDays[a] = (perDays[a] ?? 0) + 1
    }
  }
  const items = toItems(per, acts).map((it) => ({ ...it, days: perDays[it.id] ?? 0 }))
  const total = items.reduce((s, x) => s + x.v, 0)
  return { items, total, studyDays, avg: studyDays ? Math.round(total / studyDays) : 0 }
}

/**
 * Aktuelle Serie: aufeinanderfolgende Lerntage ab heute rückwärts – oder ab gestern,
 * wenn heute noch nichts gelernt wurde. Rekord: längste Serie über alle Zeit.
 */
export function streaks(byDay: ByDay, today: Date): { cur: number; best: number } {
  const done = (d: Date) => isLearnDay(byDay[dayKey(d)])
  let cur = 0
  let d = startOfDay(today)
  if (!done(d)) d = addDays(d, -1)
  while (done(d)) {
    cur++
    d = addDays(d, -1)
  }

  let best = 0
  let run = 0
  let prev: Date | null = null
  for (const k of Object.keys(byDay).filter((k) => isLearnDay(byDay[k])).sort()) {
    run = prev && dayKey(addDays(prev, 1)) === k ? run + 1 : 1
    best = Math.max(best, run)
    prev = parseDayKey(k)
  }
  return { cur, best }
}

export const daysLabel = (n: number): string => `${n} ${n === 1 ? 'Tag' : 'Tage'}`
