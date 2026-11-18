import { describe, expect, it } from 'vitest'
import { dueItems, examRows, todayItems, whenLabel } from './agenda.ts'
import type { PlanItem } from './types.ts'

const today = new Date(2026, 10, 18, 15) // Mi
const ab = (id: string, d: string, extra: Partial<PlanItem> = {}): PlanItem => ({ id, type: 'abgabe', title: id, d, ...extra })

describe('whenLabel', () => {
  it.each([
    ['2026-11-17', '12:00', 'überfällig', 'hot'],
    ['2026-11-18', '23:59', 'heute 23:59', 'hot'],
    ['2026-11-18', undefined, 'heute', 'hot'],
    ['2026-11-19', '12:00', 'morgen 12:00', 'hot'],
    ['2026-11-20', '12:00', 'Fr 20.', 'warm'],
    ['2026-11-21', undefined, 'Sa 21.', 'warm'],
    ['2026-11-22', undefined, 'So 22.', ''],
    ['2026-11-24', undefined, 'Di 24.', ''],
    ['2026-11-25', undefined, 'in 7 T', ''],
    ['2027-01-01', undefined, 'in 44 T', ''],
  ] as const)('%s %s → %s', (d, t, text, tone) => {
    expect(whenLabel(ab('x', d, t ? { t } : {}), today)).toEqual({ text, tone })
  })

  it('erledigt → ✓', () => {
    expect(whenLabel(ab('x', '2026-11-10', { done: true }), today)).toEqual({ text: '✓', tone: '' })
  })

  it('über die Zeitumstellung hinweg korrekt', () => {
    expect(whenLabel(ab('x', '2026-10-26'), new Date(2026, 9, 24, 23, 30)).text).toBe('Mo 26.')
    expect(whenLabel(ab('x', '2026-03-30'), new Date(2026, 2, 28, 0, 30)).text).toBe('Mo 30.')
  })
})

describe('Seitenleiste', () => {
  const all: PlanItem[] = [
    ab('alt', '2026-10-01'), // überfällig
    ab('erledigt-alt', '2026-11-10', { done: true }), // nicht heute erledigt → weg
    ab('heute-erledigt', '2026-11-18', { done: true, t: '08:00' }),
    ab('heute', '2026-11-18', { t: '23:59' }),
    ab('morgen', '2026-11-19', { t: '12:00' }),
    ab('grenze', '2026-12-02'), // +14 → drin
    ab('zu-weit', '2026-12-03'),
    { id: 'blk', type: 'block', title: 'B', d: '2026-11-18', t: '10:00', e: '11:00' },
    { id: 'kl-heute', type: 'klausur', title: 'K0', d: '2026-11-18' },
    { id: 'kl-gestern', type: 'klausur', title: 'Kx', d: '2026-11-17' },
    { id: 'kl-morgen', type: 'klausur', title: 'K1', d: '2026-11-19', t: '08:00' },
    { id: 'kl-woche', type: 'klausur', title: 'K7', d: '2026-11-25' },
    { id: 'kl-spaet', type: 'klausur', title: 'K8', d: '2026-11-26' },
  ]

  it('Fällig: offene bis +14 inkl. überfälliger, heute erledigte unten', () => {
    expect(dueItems(all, today).map((i) => i.id)).toEqual(['alt', 'heute', 'morgen', 'grenze', 'heute-erledigt'])
  })

  it('Heute: alle Einträge von heute, sortiert', () => {
    expect(todayItems(all, today).map((i) => i.id)).toEqual(['heute-erledigt', 'blk', 'heute', 'kl-heute'])
  })

  it('Klausuren: Countdown und Töne', () => {
    expect(examRows(all, today).map((r) => [r.it.id, r.n, r.word, r.tone])).toEqual([
      ['kl-heute', 0, 'Heute', 'urgent'],
      ['kl-morgen', 1, 'Morgen', 'urgent'],
      ['kl-woche', 7, null, 'soon'],
      ['kl-spaet', 8, null, ''],
    ])
    expect(examRows(all, today)[1]!.date).toBe('Do, 19. Nov · 08:00')
  })
})
