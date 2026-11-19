/** Statistik-Tab: Tagesbilanz (heute) und Zeitraum-Auswertung. */
import { LEARN_DAY_MIN_SEC, PAUSE } from './constants.ts'
import { learned } from './sessions.ts'
import { toItems, type Item } from './summary.ts'
import { addDays, dayKey } from './time.ts'
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

export const daysLabel = (n: number): string => `${n} ${n === 1 ? 'Tag' : 'Tage'}`
