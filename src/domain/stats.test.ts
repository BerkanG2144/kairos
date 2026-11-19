import { describe, expect, it } from 'vitest'
import { PAUSE } from './constants.ts'
import { daysLabel, rangeStats } from './stats.ts'
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
  it('Heute: nur der heutige Tag', () => {
    const r = rangeStats(byDay, 'day', today, acts)
    expect(r.total).toBe(Object.entries(byDay[dayKey(today)] ?? {}).filter(([a]) => a !== PAUSE).reduce((s, [, v]) => s + v, 0))
    expect(r.studyDays).toBeLessThanOrEqual(1)
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

describe('Labels', () => {
  it('daysLabel', () => {
    expect(daysLabel(1)).toBe('1 Tag')
    expect(daysLabel(0)).toBe('0 Tage')
    expect(daysLabel(5)).toBe('5 Tage')
  })
})
