/** Seitenleiste der Organisation: Heute, Fällig, Klausuren. */
import { MONTHS_SHORT } from './constants.ts'
import { sortItems } from './plan.ts'
import { WEEKDAYS_SHORT } from './summary.ts'
import { addDays, dayDiff, dayKey, parseDayKey } from './time.ts'
import type { PlanItem } from './types.ts'

export type Tone = 'hot' | 'warm' | ''

/** Fälligkeits-Label: überfällig / heute HH:MM / morgen HH:MM / Wochentag / „in n T“. */
export function whenLabel(it: PlanItem, today: Date): { text: string; tone: Tone } {
  if (it.done) return { text: '✓', tone: '' }
  const n = dayDiff(it.d, today)
  const at = it.t ? ` ${it.t}` : ''
  if (n < 0) return { text: 'überfällig', tone: 'hot' }
  if (n === 0) return { text: `heute${at}`, tone: 'hot' }
  if (n === 1) return { text: `morgen${at}`, tone: 'hot' }
  const dt = parseDayKey(it.d)
  if (n <= 6) return { text: `${WEEKDAYS_SHORT[dt.getDay()]} ${dt.getDate()}.`, tone: n <= 3 ? 'warm' : '' }
  return { text: `in ${n} T`, tone: '' }
}

export const todayItems = (all: PlanItem[], today: Date): PlanItem[] => sortItems(all.filter((it) => it.d === dayKey(today)))

/** Offene Abgaben bis +14 Tage (inkl. überfälliger), heute erledigte unten. */
export function dueItems(all: PlanItem[], today: Date): PlanItem[] {
  const tk = dayKey(today)
  const lim = dayKey(addDays(today, 14))
  const due = sortItems(all.filter((it) => it.type === 'abgabe' && ((!it.done && it.d <= lim) || (it.done && it.d === tk))))
  return due.sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0))
}

export type ExamRow = { it: PlanItem; n: number; word: string | null; tone: 'urgent' | 'soon' | ''; date: string }

/** Anstehende Klausuren mit Countdown: Heute/Morgen, rosa ≤ 1, gelb ≤ 7. */
export function examRows(all: PlanItem[], today: Date): ExamRow[] {
  return sortItems(all.filter((it) => it.type === 'klausur' && dayDiff(it.d, today) >= 0)).map((it) => {
    const n = dayDiff(it.d, today)
    const dt = parseDayKey(it.d)
    return {
      it,
      n,
      word: n === 0 ? 'Heute' : n === 1 ? 'Morgen' : null,
      tone: n <= 1 ? 'urgent' : n <= 7 ? 'soon' : '',
      date: `${WEEKDAYS_SHORT[dt.getDay()]}, ${dt.getDate()}. ${MONTHS_SHORT[dt.getMonth()]}${it.t ? ` · ${it.t}` : ''}`,
    }
  })
}
