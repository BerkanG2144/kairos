import { describe, expect, it } from 'vitest'
import { PAUSE } from './constants.ts'
import { emptyState } from './state.ts'
import { deleteTracked, trackedByDay } from './tracked.ts'
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

  it('verschiedene Tasks im selben Fach bleiben getrennt; Sessions unter 5 min fehlen', () => {
    const s = st([
      ['m', at('2026-11-18T10:00:00'), at('2026-11-18T10:30:00'), 'a'],
      ['m', at('2026-11-18T10:30:00'), at('2026-11-18T11:00:00'), 'b'],
      ['p', at('2026-11-18T12:00:00'), at('2026-11-18T12:04:59')],
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

  it('Grenze 5 min: beendet ab genau 5 min ein Block; laufender Timer sofort sichtbar', () => {
    const s = st([['m', at('2026-11-18T10:00:00'), at('2026-11-18T10:05:00')]])
    expect(trackedByDay(s, ['2026-11-18'], 0)['2026-11-18']).toHaveLength(1)
    const r = st([], { a: 'm', t: at('2026-11-18T14:00:00') })
    expect(trackedByDay(r, ['2026-11-18'], at('2026-11-18T14:00:00'))['2026-11-18']).toMatchObject([{ s: 840, e: 840, live: true }])
    expect(trackedByDay(r, ['2026-11-18'], at('2026-11-18T14:02:00'))['2026-11-18']).toMatchObject([{ s: 840, e: 842, live: true }])
    // vor 5 min beendet → verschwindet
    const done = st([['m', at('2026-11-18T14:00:00'), at('2026-11-18T14:04:59')]])
    expect(trackedByDay(done, ['2026-11-18'], at('2026-11-18T14:10:00'))['2026-11-18']).toEqual([])
  })

  it('Tage ohne Einträge sind leere Listen', () => {
    expect(trackedByDay(emptyState(), ['2026-11-18', '2026-11-19'], 0)).toEqual({ '2026-11-18': [], '2026-11-19': [] })
  })
})

describe('deleteTracked', () => {
  const all = (s: State) => Object.values(s.months).flatMap((m) => m.s)

  it('löscht genau die zusammengefassten Sessions des Blocks, sonst nichts', () => {
    const s = st([
      ['p', at('2026-11-18T09:00:00'), at('2026-11-18T10:00:00')], // anderes Fach direkt davor
      ['m', at('2026-11-18T10:00:00'), at('2026-11-18T10:30:00'), 't1'],
      ['m', at('2026-11-18T10:30:40'), at('2026-11-18T11:00:00'), 't1'],
      ['m', at('2026-11-18T11:00:00'), at('2026-11-18T11:20:00')], // gleiches Fach ohne Task direkt danach
      ['m', at('2026-11-18T14:00:00'), at('2026-11-18T15:00:00'), 't1'], // späterer Block
    ])
    const b = trackedByDay(s, ['2026-11-18'], 0)['2026-11-18']!.find((x) => x.k === 't1')!
    expect([b.start, b.end]).toEqual([at('2026-11-18T10:00:00'), at('2026-11-18T11:00:00')])
    const r = deleteTracked(s, b, 9)
    expect(all(r).map((x) => [x[0], x[3]])).toEqual([
      ['p', undefined],
      ['m', undefined],
      ['m', 't1'],
    ])
    expect(r.months['2026-11']!.u).toBe(9)
  })

  it('über Monatsgrenze: Block am 1. enthält den Teil aus dem Vormonat; löschen trifft beide Monate', () => {
    const s = st([
      ['m', at('2026-11-30T23:40:00'), at('2026-11-30T23:59:50')],
      ['m', at('2026-12-01T00:00:10'), at('2026-12-01T00:30:00')],
    ])
    const b = trackedByDay(s, ['2026-12-01'], 0)['2026-12-01']![0]!
    expect([b.s, b.start]).toEqual([0, at('2026-11-30T23:40:00')])
    expect(all(deleteTracked(s, b, 1))).toEqual([])
    expect(deleteTracked(s, { a: 'x', start: 0, end: 1 }, 1)).toBe(s)
  })
})
