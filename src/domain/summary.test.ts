import { describe, expect, it } from 'vitest'
import { PAUSE } from './constants.ts'
import { dayLabel, longDayLabel, pct, piePath, summarize, todayAndWeek, toItems, UNKNOWN_COLOR, weekDays, weekLabel } from './summary.ts'
import { dayKey } from './time.ts'
import type { Act } from './types.ts'

const acts: Act[] = [
  { id: 'a', name: 'Mathe', c: '#111' },
  { id: 'b', name: 'Physik', c: '#222', del: true },
]

describe('toItems / summarize', () => {
  it('sortiert absteigend, ohne Pause und Nullwerte; gelöschte Fächer behalten Namen', () => {
    expect(toItems({ a: 100, b: 300, [PAUSE]: 50, z: 10, n: 0 }, acts)).toEqual([
      { id: 'b', name: 'Physik', c: '#222', v: 300 },
      { id: 'a', name: 'Mathe', c: '#111', v: 100 },
      { id: 'z', name: 'Gelöscht', c: UNKNOWN_COLOR, v: 10 },
    ])
  })

  it('summiert über Tage, Pause separat', () => {
    const mon = new Date(2026, 10, 16)
    const byDay = {
      '2026-11-16': { a: 100, [PAUSE]: 20 },
      '2026-11-22': { a: 50, b: 10 },
      '2026-11-23': { a: 999 }, // nächste Woche
    }
    expect(summarize(byDay, weekDays(mon), acts)).toEqual({
      items: [
        { id: 'a', name: 'Mathe', c: '#111', v: 150 },
        { id: 'b', name: 'Physik', c: '#222', v: 10 },
      ],
      total: 160,
      pause: 20,
    })
  })

  it('weekDays liefert Mo–So', () => {
    expect(weekDays(new Date(2026, 9, 26)).map(dayKey)).toEqual([
      '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01',
    ])
  })

  it('pct', () => {
    expect(pct(1, 3)).toBe(33)
    expect(pct(2, 3)).toBe(67)
    expect(pct(5, 0)).toBe(0)
  })
})

describe('Beschriftungen', () => {
  const today = new Date(2026, 10, 18, 14)
  it('dayLabel', () => {
    expect(dayLabel(new Date(2026, 10, 18), today)).toBe('Heute')
    expect(dayLabel(new Date(2026, 10, 17), today)).toBe('Di, 17. Nov')
    expect(dayLabel(new Date(2026, 2, 1), today)).toBe('So, 1. Mär')
  })
  it('weekLabel innerhalb und über Monatsgrenze', () => {
    expect(weekLabel(new Date(2026, 10, 16))).toEqual({ text: '16.–22. Nov', kw: 47 })
    expect(weekLabel(new Date(2026, 10, 30))).toEqual({ text: '30. Nov – 6. Dez', kw: 49 })
    expect(weekLabel(new Date(2026, 11, 28))).toEqual({ text: '28. Dez – 3. Jan', kw: 53 })
  })
})

describe('piePath', () => {
  it('Viertel und großer Bogen', () => {
    expect(piePath(84, 84, 82, -Math.PI / 2, 0)).toBe('M84 84L84.00 2.00A82 82 0 0 1 166.00 84.00Z')
    expect(piePath(84, 84, 82, 0, Math.PI * 1.5)).toContain(' 0 1 1 ')
  })
})

describe('Home: Datum und Summen', () => {
  it('longDayLabel', () => {
    expect(longDayLabel(new Date(2026, 10, 18))).toBe('Mittwoch, 18. November')
    expect(longDayLabel(new Date(2026, 10, 22))).toBe('Sonntag, 22. November')
  })

  it('todayAndWeek zählt heute und Mo–So der laufenden Woche (ohne Pause, ohne Vorwoche)', () => {
    const bd = {
      '2026-11-15': { a: 9999 }, // Sonntag der Vorwoche
      '2026-11-16': { a: 3600, _p: 600 },
      '2026-11-18': { a: 1800, b: 600 },
      '2026-11-20': { a: 100 }, // Zukunft in derselben Woche (z. B. Uhr verstellt) zählt mit
    }
    expect(todayAndWeek(bd, new Date(2026, 10, 18, 15))).toEqual({ today: 2400, week: 6100 })
  })
})
