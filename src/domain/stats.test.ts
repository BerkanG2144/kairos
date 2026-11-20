import { describe, expect, it } from 'vitest'
import { PAUSE } from './constants.ts'
import { daysLabel, isRange, rangeStart, rangeStats } from './stats.ts'
import { dayKey } from './time.ts'
import type { Act, ByDay } from './types.ts'

const acts: Act[] = [
  { id: 'a', name: 'Mathe', c: '#111' },
  { id: 'b', name: 'Physik', c: '#222' },
]
// Mittwoch, 18.11.2026 → Woche ab Mo 16.11., Monat ab 1.11., Jahr ab 1.1.
const today = new Date(2026, 10, 18, 15, 0)
const d = (m: number, day: number) => dayKey(new Date(2026, m, day))

describe('rangeStart', () => {
  it('Kalendergrenzen statt rollierender Tage', () => {
    expect(dayKey(rangeStart('day', today))).toBe('2026-11-18')
    expect(dayKey(rangeStart('week', today))).toBe('2026-11-16')
    expect(dayKey(rangeStart('month', today))).toBe('2026-11-01')
    expect(dayKey(rangeStart('year', today))).toBe('2026-01-01')
  })
  it('Woche: Sonntag gehört zur Woche ab dem Montag davor', () => {
    expect(dayKey(rangeStart('week', new Date(2026, 10, 22, 23, 0)))).toBe('2026-11-16')
    expect(dayKey(rangeStart('week', new Date(2026, 10, 23, 0, 30)))).toBe('2026-11-23')
  })
})

describe('rangeStats', () => {
  const byDay: ByDay = {
    [d(10, 19)]: { a: 9999 }, // Zukunft – ignoriert
    [d(10, 18)]: { a: 1800, b: 30, [PAUSE]: 600 }, // heute
    [d(10, 16)]: { b: 3600 }, // Montag dieser Woche
    [d(10, 15)]: { a: 7200 }, // Sonntag letzte Woche → nur Monat/Jahr
    [d(9, 31)]: { a: 100 }, // Oktober → nur Jahr
    [dayKey(new Date(2025, 11, 31))]: { b: 5000 }, // Vorjahr → nirgends
  }

  it('Diese Woche: ab Montag inkl. heute', () => {
    expect(rangeStats(byDay, 'week', today, acts)).toEqual({
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
    expect(rangeStats(byDay, 'day', today, acts)).toMatchObject({ total: 1830, studyDays: 1 })
  })
  it('Dieser Monat / Dieses Jahr', () => {
    expect(rangeStats(byDay, 'month', today, acts)).toMatchObject({ total: 12630, studyDays: 3 })
    expect(rangeStats(byDay, 'year', today, acts)).toMatchObject({ total: 12730, studyDays: 4 })
    expect(rangeStats(byDay, 'year', today, acts).items[0]).toMatchObject({ id: 'a', v: 9100, days: 3 })
  })
  it('leer', () => {
    expect(rangeStats({}, 'month', today, acts)).toEqual({ items: [], total: 0, studyDays: 0, avg: 0 })
  })
  it('alte gespeicherte Auswahl (7/30/365/Gesamt) ist ungültig → Standard', () => {
    for (const old of ['7', '30', '365', 'all']) expect(isRange(old)).toBe(false)
    expect(isRange('week')).toBe(true)
  })
})

describe('Labels', () => {
  it('daysLabel', () => {
    expect(daysLabel(1)).toBe('1 Tag')
    expect(daysLabel(0)).toBe('0 Tage')
    expect(daysLabel(5)).toBe('5 Tage')
  })
})
