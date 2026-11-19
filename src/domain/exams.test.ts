import { describe, expect, it } from 'vitest'
import { PAUSE } from './constants.ts'
import { examRows, hoursDe, pastExamRows, progress } from './exams.ts'
import type { ByDay, PlanItem } from './types.ts'

const today = new Date(2026, 10, 18, 15) // Mi, 18.11.2026

describe('Klausuren', () => {
  const all: PlanItem[] = [
    { id: 'blk', type: 'block', title: 'B', d: '2026-11-18', t: '10:00', e: '11:00' },
    { id: 'kl-heute', type: 'klausur', title: 'K0', d: '2026-11-18' },
    { id: 'kl-gestern', type: 'klausur', title: 'Kx', d: '2026-11-17' },
    { id: 'kl-alt', type: 'klausur', title: 'Ky', d: '2026-07-01' },
    { id: 'kl-morgen', type: 'klausur', title: 'K1', d: '2026-11-19', t: '08:00' },
    { id: 'kl-woche', type: 'klausur', title: 'K7', d: '2026-11-25' },
    { id: 'kl-spaet', type: 'klausur', title: 'K8', d: '2026-11-26' },
  ]

  it('anstehend: Countdown und Töne, nächste zuerst', () => {
    expect(examRows(all, today).map((r) => [r.it.id, r.n, r.word, r.tone])).toEqual([
      ['kl-heute', 0, 'Heute', 'urgent'],
      ['kl-morgen', 1, 'Morgen', 'urgent'],
      ['kl-woche', 7, null, 'soon'],
      ['kl-spaet', 8, null, ''],
    ])
    expect(examRows(all, today)[1]!.date).toBe('Do, 19. Nov 2026 · 08:00')
  })

  it('vergangen: jüngste zuerst, ohne Ton', () => {
    expect(pastExamRows(all, today).map((r) => [r.it.id, r.n, r.tone])).toEqual([
      ['kl-gestern', -1, ''],
      ['kl-alt', -140, ''],
    ])
  })
})

describe('progress', () => {
  const byDay: ByDay = {
    '2026-10-01': { a: 3600 }, // vor dem 28-Tage-Fenster
    '2026-11-10': { a: 1800, b: 999 }, // Vorwoche
    '2026-11-16': { a: 600, [PAUSE]: 300 }, // Montag dieser Woche
    '2026-11-18': { a: 1200 }, // heute
    '2026-11-19': { a: 7200 }, // Zukunft (zählt nicht)
  }

  it('Woche, Gesamt und kumulierte Reihe', () => {
    const p = progress(byDay, 'a', today)
    expect(p.week).toBe(1800)
    expect(p.total).toBe(3600 + 1800 + 600 + 1200)
    expect(p.series).toHaveLength(28)
    expect(p.series[0]).toBe(3600) // Startwert = alles davor
    expect(p.series.at(-1)).toBe(p.total)
    expect(p.series.at(-3)).toBe(3600 + 1800 + 600) // Mo 16.11.
    expect(p.series.every((v, i) => i === 0 || v >= p.series[i - 1]!)).toBe(true)
  })

  it('Fach ohne Zeit → alles 0', () => {
    expect(progress(byDay, 'x', today)).toEqual({ week: 0, total: 0, series: Array(28).fill(0) })
  })

  it('hoursDe', () => {
    expect(hoursDe(0)).toBe('0,0h')
    expect(hoursDe(1080)).toBe('0,3h')
    expect(hoursDe(45000)).toBe('12,5h')
  })
})
