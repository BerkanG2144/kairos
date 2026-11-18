import { describe, expect, it } from 'vitest'
import { PAUSE } from './constants.ts'
import { emptyState } from './state.ts'
import { trackedByDay } from './tracked.ts'
import { monthKeyOfSec } from './time.ts'
import type { Session, State } from './types.ts'

const at = (iso: string) => Math.floor(new Date(iso).getTime() / 1000)
function st(sessions: Session[], run: State['meta']['run'] = null): State {
  const s = emptyState()
  const months: State['months'] = {}
  for (const x of sessions) {
    const k = monthKeyOfSec(x[1])
    ;(months[k] ??= { s: [], u: 0 }).s.push(x)
  }
  return { meta: { ...s.meta, run }, months }
}

describe('trackedByDay', () => {
  it('Sessions werden Blöcke mit Uhrzeit in Minuten; Pausen fehlen', () => {
    const s = st([
      ['m', at('2026-11-18T10:00:00'), at('2026-11-18T11:30:00')],
      [PAUSE, at('2026-11-18T11:30:00'), at('2026-11-18T11:45:00')],
      ['p', at('2026-11-18T11:45:00'), at('2026-11-18T12:20:30'), 't1'],
    ])
    const r = trackedByDay(s, ['2026-11-18'], at('2026-11-18T20:00:00'))['2026-11-18']!
    expect(r.map((x) => [x.a, x.s, x.e, x.k, x.live])).toEqual([
      ['m', 600, 690, undefined, false],
      ['p', 705, 740.5, 't1', false],
    ])
  })

  it('gleiches Fach mit kurzer Lücke wird zusammengefasst, längere Lücke nicht', () => {
    const s = st([
      ['m', at('2026-11-18T10:00:00'), at('2026-11-18T10:30:00')],
      ['m', at('2026-11-18T10:30:40'), at('2026-11-18T11:00:00')],
      ['m', at('2026-11-18T11:10:00'), at('2026-11-18T11:40:00')],
    ])
    const r = trackedByDay(s, ['2026-11-18'], 0)['2026-11-18']!
    expect(r.map((x) => [x.s, x.e])).toEqual([
      [600, 660],
      [670, 700],
    ])
  })

  it('verschiedene Tasks im selben Fach bleiben getrennt; Mini-Sessions < 1 min fehlen', () => {
    const s = st([
      ['m', at('2026-11-18T10:00:00'), at('2026-11-18T10:30:00'), 'a'],
      ['m', at('2026-11-18T10:30:00'), at('2026-11-18T11:00:00'), 'b'],
      ['p', at('2026-11-18T12:00:00'), at('2026-11-18T12:00:40')],
    ])
    const r = trackedByDay(s, ['2026-11-18'], 0)['2026-11-18']!
    expect(r.map((x) => x.k)).toEqual(['a', 'b'])
  })

  it('laufender Timer wächst live mit; schließt an eine gerade beendete Session an', () => {
    const s = st([['m', at('2026-11-18T14:00:00'), at('2026-11-18T14:20:00')]], { a: 'm', t: at('2026-11-18T14:20:30') })
    const r = trackedByDay(s, ['2026-11-18'], at('2026-11-18T15:00:00'))['2026-11-18']!
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ a: 'm', s: 840, e: 900, live: true })
    // laufende Pause → kein Block
    const p = st([], { a: PAUSE, t: at('2026-11-18T14:00:00') })
    expect(trackedByDay(p, ['2026-11-18'], at('2026-11-18T15:00:00'))['2026-11-18']).toEqual([])
  })

  it('über Mitternacht (auch Monatsgrenze) wird auf beide Tage geteilt', () => {
    const s = st([['m', at('2026-11-30T23:00:00'), at('2026-12-01T01:30:00')]])
    const r = trackedByDay(s, ['2026-11-30', '2026-12-01'], 0)
    expect(r['2026-11-30']!.map((x) => [x.s, x.e])).toEqual([[1380, 1440]])
    expect(r['2026-12-01']!.map((x) => [x.s, x.e])).toEqual([[0, 90]])
  })

  it('Zeitumstellung: Uhrzeiten bleiben Uhrzeiten (29.03.2026, 02→03 Uhr)', () => {
    const s = st([['m', at('2026-03-29T01:00:00+01:00'), at('2026-03-29T04:00:00+02:00')]])
    const r = trackedByDay(s, ['2026-03-29'], 0)['2026-03-29']!
    expect(r.map((x) => [x.s, x.e])).toEqual([[60, 240]])
  })

  it('Tage ohne Einträge sind leere Listen', () => {
    expect(trackedByDay(emptyState(), ['2026-11-18', '2026-11-19'], 0)).toEqual({ '2026-11-18': [], '2026-11-19': [] })
  })
})
