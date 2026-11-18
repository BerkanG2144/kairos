/** Zusammenfassungen und Beschriftungen für Tagesbilanz, Woche und Monatskalender. */
import { LEARN_DAY_MIN_SEC, MONTHS_SHORT, PAUSE } from './constants.ts'
import { learned } from './sessions.ts'
import { addDays, dayKey, isoWeek } from './time.ts'
import type { Act, ByDay, DayTotals } from './types.ts'

export const WEEKDAYS_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'] as const
export const WEEKDAYS_MON_FIRST = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const

/** Farbe für Sessions eines unbekannten (z. B. hart gelöschten) Fachs. */
export const UNKNOWN_COLOR = '#55596a'

export type Item = { id: string; name: string; c: string; v: number }
export type Summary = { items: Item[]; total: number; pause: number }

/** Sekunden pro Fach → sortierte Liste (größte zuerst), Pause ausgenommen. */
export function toItems(per: DayTotals, acts: Act[]): Item[] {
  const out: Item[] = []
  for (const [id, v] of Object.entries(per)) {
    if (id === PAUSE || !(v > 0)) continue
    const a = acts.find((x) => x.id === id)
    out.push({ id, name: a ? a.name : 'Gelöscht', c: a ? a.c : UNKNOWN_COLOR, v })
  }
  return out.sort((x, y) => y.v - x.v)
}

/** Zusammenfassung über beliebige Tage. */
export function summarize(byDay: ByDay, days: Date[], acts: Act[]): Summary {
  const per: DayTotals = {}
  let pause = 0
  for (const d of days) {
    const m = byDay[dayKey(d)]
    if (!m) continue
    for (const [a, v] of Object.entries(m)) {
      if (a === PAUSE) pause += v
      else per[a] = (per[a] ?? 0) + v
    }
  }
  const items = toItems(per, acts)
  return { items, total: items.reduce((s, x) => s + x.v, 0), pause }
}

export const weekDays = (monday: Date): Date[] => Array.from({ length: 7 }, (_, i) => addDays(monday, i))

/** Ganzzahliger Anteil in Prozent (wie Legacy: gerundet). */
export const pct = (v: number, total: number): number => (total > 0 ? Math.round((v / total) * 100) : 0)

/** 'Heute' bzw. 'Mi, 18. Nov' */
export function dayLabel(d: Date, today: Date): string {
  if (dayKey(d) === dayKey(today)) return 'Heute'
  return `${WEEKDAYS_SHORT[d.getDay()]}, ${d.getDate()}. ${MONTHS_SHORT[d.getMonth()]}`
}

/** '16.–22. Nov' bzw. '30. Nov – 6. Dez', plus Kalenderwoche. */
export function weekLabel(monday: Date): { text: string; kw: number } {
  const d6 = addDays(monday, 6)
  const text =
    monday.getMonth() === d6.getMonth()
      ? `${monday.getDate()}.–${d6.getDate()}. ${MONTHS_SHORT[d6.getMonth()]}`
      : `${monday.getDate()}. ${MONTHS_SHORT[monday.getMonth()]} – ${d6.getDate()}. ${MONTHS_SHORT[d6.getMonth()]}`
  return { text, kw: isoWeek(monday) }
}

/** Deckkraft im Monatskalender: null unter 60 s, sonst 0.32 + 0.68·min(1, sek/4h). */
export function heatAlpha(sec: number): number | null {
  if (sec < LEARN_DAY_MIN_SEC) return null
  return 0.32 + 0.68 * Math.min(1, sec / (4 * 3600))
}

/** Lernzeit eines Tages aus byDay. */
export const learnedOn = (byDay: ByDay, d: Date): number => learned(byDay[dayKey(d)])

/** Monatsraster: leere Zellen vor dem 1. (Mo-basiert) und Anzahl Tage. */
export function monthGrid(y: number, m: number): { offset: number; days: number } {
  return { offset: (new Date(y, m, 1).getDay() + 6) % 7, days: new Date(y, m + 1, 0).getDate() }
}

/** SVG-Pfad eines Tortenstücks (Winkel in Radiant, 0 = 3 Uhr, im Uhrzeigersinn). */
export function piePath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const x0 = cx + r * Math.cos(a0)
  const y0 = cy + r * Math.sin(a0)
  const x1 = cx + r * Math.cos(a1)
  const y1 = cy + r * Math.sin(a1)
  const large = a1 - a0 > Math.PI ? 1 : 0
  return `M${cx} ${cy}L${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}Z`
}
