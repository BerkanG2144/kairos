import { describe, expect, it } from 'vitest'
import { addDays, clockStr, dayKey, fmt, isoWeek, mondayOf, monthKeyOfSec, parseDayKey } from './time.ts'

const at = (s: string) => Math.floor(new Date(s).getTime() / 1000)

describe('isoWeek', () => {
  it.each([
    ['2026-01-01', 1], // Donnerstag → KW 1
    ['2025-12-29', 1], // Montag, gehört schon zu KW 1/2026
    ['2027-01-01', 53], // Freitag → KW 53/2026
    ['2027-01-04', 1],
    ['2024-12-30', 1],
    ['2026-11-18', 47],
    ['2021-01-03', 53], // Sonntag → KW 53/2020
  ])('%s → KW %i', (d, kw) => {
    expect(isoWeek(parseDayKey(d))).toBe(kw)
  })
})

describe('mondayOf', () => {
  it('liefert den Montag 00:00 derselben Woche', () => {
    expect(dayKey(mondayOf(new Date(2026, 10, 18, 15)))).toBe('2026-11-16') // Mi
    expect(dayKey(mondayOf(new Date(2026, 10, 22, 23, 59)))).toBe('2026-11-16') // So
    expect(dayKey(mondayOf(new Date(2026, 10, 16, 0, 0)))).toBe('2026-11-16') // Mo
    expect(mondayOf(new Date(2026, 10, 18, 15)).getHours()).toBe(0)
  })
  it('über die Sommerzeit-Umstellung', () => {
    // So 29.03.2026 = Umstellung; Montag davor ist 23.03.
    expect(dayKey(mondayOf(new Date(2026, 2, 29, 12)))).toBe('2026-03-23')
    expect(dayKey(addDays(new Date(2026, 2, 28), 1))).toBe('2026-03-29')
    expect(dayKey(addDays(new Date(2026, 2, 29), 1))).toBe('2026-03-30')
  })
})

describe('Formatierung', () => {
  it('fmt', () => {
    expect(fmt(0)).toBe('0m')
    expect(fmt(30)).toBe('<1m')
    expect(fmt(60)).toBe('1m')
    expect(fmt(3600)).toBe('1h 00m')
    expect(fmt(2 * 3600 + 5 * 60 + 59)).toBe('2h 05m')
  })
  it('clockStr', () => {
    expect(clockStr(0)).toBe('00:00:00')
    expect(clockStr(3661)).toBe('01:01:01')
    expect(clockStr(100 * 3600)).toBe('100:00:00')
  })
  it('monthKeyOfSec nutzt lokale Zeit', () => {
    expect(monthKeyOfSec(at('2026-11-30T23:30:00+01:00'))).toBe('2026-11')
    expect(monthKeyOfSec(at('2026-11-30T23:30:00Z'))).toBe('2026-12') // = 00:30 in Berlin
  })
})
