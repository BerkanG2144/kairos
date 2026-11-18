import { describe, expect, it } from 'vitest'
import { PAUSE } from './constants.ts'
import { daysLabel, hoursLabel, lastWeeks, rangeStats, streaks } from './stats.ts'
import { dayKey } from './time.ts'
import type { Act, ByDay } from './types.ts'

const acts: Act[] = [
  { id: 'a', name: 'Mathe', c: '#111' },
  { id: 'b', name: 'Physik', c: '#222' },
]
const today = new Date(2026, 10, 18, 15, 0)

/** Lerntage relativ zu heute: { -1: {a: 3600} } */
const days = (spec: Record<number, Record<string, number>>): ByDay =>
  Object.fromEntries(Object.entries(spec).map(([off, m]) => [dayKey(new Date(2026, 10, 18 + Number(off))), m]))

describe('streaks', () => {
  it('zählt ab heute, wenn heute gelernt', () => {
    expect(streaks(days({ 0: { a: 60 }, '-1': { a: 100 }, '-2': { a: 100 }, '-4': { a: 100 } }), today)).toEqual({ cur: 3, best: 3 })
  })
  it('zählt ab gestern, wenn heute (noch) nicht gelernt', () => {
    expect(streaks(days({ '-1': { a: 100 }, '-2': { a: 100 } }), today).cur).toBe(2)
    expect(streaks(days({ 0: { a: 59 }, '-1': { a: 100 } }), today).cur).toBe(1)
  })
  it('Lücke von 2 Tagen → 0', () => {
    expect(streaks(days({ '-2': { a: 100 } }), today).cur).toBe(0)
  })
  it('Pause und < 60 s zählen nicht', () => {
    expect(streaks(days({ 0: { [PAUSE]: 9999, a: 30 }, '-1': { a: 100 } }), today)).toEqual({ cur: 1, best: 1 })
  })
  it('Rekord über alle Zeit, auch über Monats- und Jahresgrenzen', () => {
    const byDay: ByDay = {
      '2025-12-30': { a: 100 },
      '2025-12-31': { a: 100 },
      '2026-01-01': { a: 100 },
      '2026-01-02': { a: 100 },
      '2026-01-04': { a: 100 },
      '2026-11-17': { a: 100 },
    }
    expect(streaks(byDay, today)).toEqual({ cur: 1, best: 4 })
  })
  it('über die Zeitumstellung hinweg zusammenhängend', () => {
    const byDay: ByDay = { '2026-03-28': { a: 100 }, '2026-03-29': { a: 100 }, '2026-03-30': { a: 100 }, '2026-10-25': { a: 100 }, '2026-10-26': { a: 100 } }
    expect(streaks(byDay, new Date(2026, 2, 30, 12)).cur).toBe(3)
    expect(streaks(byDay, today).best).toBe(3)
  })
  it('leer', () => {
    expect(streaks({}, today)).toEqual({ cur: 0, best: 0 })
  })
})

describe('rangeStats', () => {
  const byDay = days({
    1: { a: 9999 }, // Zukunft – ignoriert
    0: { a: 1800, b: 30, [PAUSE]: 600 },
    '-6': { b: 3600 },
    '-7': { a: 7200 }, // nur in 30 Tagen
    '-40': { a: 100 }, // nur in Jahr/Gesamt
  })

  it('7 Tage inkl. heute', () => {
    expect(rangeStats(byDay, '7', today, acts)).toEqual({
      items: [
        { id: 'b', name: 'Physik', c: '#222', v: 3630, days: 1 },
        { id: 'a', name: 'Mathe', c: '#111', v: 1800, days: 1 },
      ],
      total: 5430,
      studyDays: 2,
      avg: 2715,
    })
  })
  it('30 Tage / Jahr / Gesamt', () => {
    expect(rangeStats(byDay, '30', today, acts)).toMatchObject({ total: 12630, studyDays: 3 })
    expect(rangeStats(byDay, '365', today, acts)).toMatchObject({ total: 12730, studyDays: 4 })
    expect(rangeStats(byDay, 'all', today, acts).items[0]).toMatchObject({ id: 'a', v: 9100, days: 3 })
  })
  it('leer', () => {
    expect(rangeStats({}, '30', today, acts)).toEqual({ items: [], total: 0, studyDays: 0, avg: 0 })
  })
})

describe('lastWeeks', () => {
  it('12 Wochen, älteste zuerst, aktuelle markiert, Pause ignoriert', () => {
    const byDay: ByDay = { '2026-11-16': { a: 3600, [PAUSE]: 500 }, '2026-11-22': { b: 1800 }, '2026-08-31': { a: 100 }, '2026-08-30': { a: 100 } }
    const { weeks, max } = lastWeeks(byDay, today, acts)
    expect(weeks).toHaveLength(12)
    expect(dayKey(weeks[0]!.monday)).toBe('2026-08-31')
    expect(weeks[0]!.total).toBe(100) // 30.08. liegt davor
    expect(weeks[11]).toMatchObject({ kw: 47, total: 5400, current: true })
    expect(weeks[11]!.segs.map((s) => s.id)).toEqual(['a', 'b'])
    expect(weeks.filter((w) => w.current)).toHaveLength(1)
    expect(max).toBe(5400)
  })
  it('Maßstab mindestens 1 h', () => {
    expect(lastWeeks({}, today, acts).max).toBe(3600)
  })
})

describe('Labels', () => {
  it('hoursLabel', () => {
    expect(hoursLabel(59)).toBe('')
    expect(hoursLabel(60)).toBe('0h')
    expect(hoursLabel(38520)).toBe('10.7h')
    expect(hoursLabel(3600)).toBe('1h')
  })
  it('daysLabel', () => {
    expect(daysLabel(1)).toBe('1 Tag')
    expect(daysLabel(0)).toBe('0 Tage')
    expect(daysLabel(5)).toBe('5 Tage')
  })
})
