/** Statistik-Tab: Tagesbilanz (heute) und Zeitraum-Auswertung. */
import { LEARN_DAY_MIN_SEC, PAUSE } from './constants.ts'
import { learned } from './sessions.ts'
import { toItems, type Item } from './summary.ts'
import { dayKey, mondayOf } from './time.ts'
import type { Act, ByDay, DayTotals } from './types.ts'

/** Kalender-Zeiträume bis einschließlich heute. 'day' = Tagesbilanz eines einzelnen Tages (Standard: heute) */
export type Range = 'day' | 'week' | 'month' | 'year'
export const RANGES: { r: Range; label: string }[] = [
  { r: 'day', label: 'Heute' },
  { r: 'week', label: 'Diese Woche' },
  { r: 'month', label: 'Dieser Monat' },
  { r: 'year', label: 'Dieses Jahr' },
]
export const isRange = (x: unknown): x is Range => RANGES.some((r) => r.r === x)

export type ActStat = Item & { days: number }
export type RangeStats = { items: ActStat[]; total: number; studyDays: number; avg: number }

const isLearnDay = (m: DayTotals | undefined) => learned(m) >= LEARN_DAY_MIN_SEC

/** Erster Tag des Zeitraums: heute, Montag dieser Woche, 1. des Monats, 1. Januar. */
export function rangeStart(range: Range, today: Date): Date {
  if (range === 'week') return mondayOf(today)
  if (range === 'month') return new Date(today.getFullYear(), today.getMonth(), 1)
  if (range === 'year') return new Date(today.getFullYear(), 0, 1)
  return new Date(today.getFullYear(), today.getMonth(), today.getDate())
}

/** Auswertung vom Beginn des Zeitraums bis einschließlich heute. */
export function rangeStats(byDay: ByDay, range: Range, today: Date, acts: Act[]): RangeStats {
  const tk = dayKey(today)
  const cutoff = dayKey(rangeStart(range, today))
  const per: DayTotals = {}
  const perDays: Record<string, number> = {}
  let studyDays = 0
  for (const [k, m] of Object.entries(byDay)) {
    if (k > tk || k < cutoff) continue
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

export const daysLabel = (n: number): string => `${n} ${n === 1 ? 'Tag' : 'Tage'}`
