import { describe, expect, it } from 'vitest'
import { PAUSE } from './constants.ts'
import { blocks, byDay, learned } from './sessions.ts'
import { emptyState } from './state.ts'
import type { State } from './types.ts'

const at = (s: string) => Math.floor(new Date(s).getTime() / 1000)

const withSessions = (s: State['months'][string]['s'], run: State['meta']['run'] = null): State => ({
  ...emptyState(),
  meta: { ...emptyState().meta, run },
  months: { '2026-11': { s, u: 0 } },
})

describe('byDay – Tages-Splitting', () => {
  it('Session innerhalb eines Tages', () => {
    const r = byDay(withSessions([['a', at('2026-11-18T10:00:00'), at('2026-11-18T11:30:00')]]), 0)
    expect(r).toEqual({ '2026-11-18': { a: 5400 } })
  })

  it('Session über Mitternacht wird am Tageswechsel geteilt', () => {
    const r = byDay(withSessions([['a', at('2026-11-18T23:00:00'), at('2026-11-19T01:15:00')]]), 0)
    expect(r).toEqual({ '2026-11-18': { a: 3600 }, '2026-11-19': { a: 4500 } })
  })

  it('Session über mehrere Tage', () => {
    const r = byDay(withSessions([['a', at('2026-11-18T22:00:00'), at('2026-11-20T02:00:00')]]), 0)
    expect(r['2026-11-18']).toEqual({ a: 7200 })
    expect(r['2026-11-19']).toEqual({ a: 86400 })
    expect(r['2026-11-20']).toEqual({ a: 7200 })
  })

  it('Session über Monatsgrenze (liegt im Startmonat)', () => {
    const s = withSessions([['a', at('2026-11-30T23:30:00'), at('2026-12-01T00:30:00')]])
    expect(byDay(s, 0)).toEqual({ '2026-11-30': { a: 1800 }, '2026-12-01': { a: 1800 } })
  })

  it('Tag mit Zeitumstellung (23 h) wird korrekt geteilt', () => {
    // 29.03.2026: 02:00 → 03:00. Von 00:00 bis 00:00 am Folgetag sind 23 h.
    const s: State = {
      ...emptyState(),
      months: { '2026-03': { s: [['a', at('2026-03-28T23:00:00+01:00'), at('2026-03-30T01:00:00+02:00')]], u: 0 } },
    }
    const r = byDay(s, 0)
    expect(r['2026-03-28']).toEqual({ a: 3600 })
    expect(r['2026-03-29']).toEqual({ a: 23 * 3600 })
    expect(r['2026-03-30']).toEqual({ a: 3600 })
  })

  it('addiert mehrere Sessions und Fächer, Pause separat', () => {
    const r = byDay(
      withSessions([
        ['a', at('2026-11-18T10:00:00'), at('2026-11-18T10:30:00')],
        [PAUSE, at('2026-11-18T10:30:00'), at('2026-11-18T10:40:00')],
        ['a', at('2026-11-18T10:40:00'), at('2026-11-18T11:00:00')],
        ['b', at('2026-11-18T12:00:00'), at('2026-11-18T12:10:00')],
      ]),
      0,
    )
    expect(r['2026-11-18']).toEqual({ a: 3000, [PAUSE]: 600, b: 600 })
    expect(learned(r['2026-11-18'])).toBe(3600)
  })

  it('zählt den laufenden Timer bis jetzt mit, auch über Mitternacht', () => {
    const s = withSessions([], { a: 'a', t: at('2026-11-18T23:50:00') })
    expect(byDay(s, at('2026-11-19T00:05:00'))).toEqual({
      '2026-11-18': { a: 600 },
      '2026-11-19': { a: 300 },
    })
  })

  it('laufender Timer mit Start in der Zukunft zählt 0', () => {
    const s = withSessions([], { a: 'a', t: at('2026-11-18T12:00:00') })
    expect(byDay(s, at('2026-11-18T11:00:00'))).toEqual({})
  })

  it('learned ignoriert Pause und leere Tage', () => {
    expect(learned(undefined)).toBe(0)
    expect(learned({ [PAUSE]: 500 })).toBe(0)
  })
})

describe('Blöcke unter 5 min zählen nicht', () => {
  const T = (hm: string) => at(`2026-11-18T${hm}`)

  it('kurze Session fällt weg, genau 5 min zählt; kurze Pause fällt auch weg', () => {
    const r = byDay(
      withSessions([
        ['a', T('10:00:00'), T('10:04:59')],
        ['b', T('11:00:00'), T('11:05:00')],
        [PAUSE, T('11:05:00'), T('11:07:00')],
        [PAUSE, T('12:00:00'), T('12:10:00')],
      ]),
      0,
    )
    expect(r).toEqual({ '2026-11-18': { b: 300, [PAUSE]: 600 } })
  })

  it('kurze Stücke mit ≤ 1 min Lücke ergeben zusammen einen zählenden Block (Lücke selbst zählt nicht)', () => {
    const r = byDay(
      withSessions([
        ['a', T('10:00:00'), T('10:03:00')],
        ['a', T('10:03:50'), T('10:06:00')],
      ]),
      0,
    )
    expect(r['2026-11-18']).toEqual({ a: 180 + 130 })
  })

  it('Fach mit Task und ohne Task sind getrennte Blöcke', () => {
    const r = byDay(
      withSessions([
        ['a', T('10:00:00'), T('10:03:00'), 't1'],
        ['a', T('10:03:10'), T('10:06:00')],
      ]),
      0,
    )
    expect(r).toEqual({})
  })

  it('laufender Timer zählt sofort und verschmilzt mit einer Session kurz davor', () => {
    const s = withSessions([['a', T('10:00:00'), T('10:02:00')]], { a: 'a', t: T('10:02:30') })
    expect(byDay(s, T('10:03:30'))['2026-11-18']).toEqual({ a: 120 + 60 })
    expect(blocks(s, T('10:03:30'))).toMatchObject([{ a: 'a', start: T('10:00:00'), end: T('10:03:30'), live: true }])
    // nur der laufende Timer (1 min) – zählt trotzdem
    expect(byDay(withSessions([], { a: 'b', t: T('11:00:00') }), T('11:01:00'))['2026-11-18']).toEqual({ b: 60 })
  })

  it('Unterbrechung durch ein anderes Fach trennt nicht (je Fach+Task gruppiert)', () => {
    const bs = blocks(
      withSessions([
        ['a', T('10:00:00'), T('10:03:00')],
        ['b', T('10:03:00'), T('10:03:20')],
        ['a', T('10:03:30'), T('10:06:00')],
      ]),
      0,
    )
    expect(bs.map((b) => [b.a, b.end - b.start])).toEqual([
      ['a', 360],
      ['b', 20],
    ])
  })
})
