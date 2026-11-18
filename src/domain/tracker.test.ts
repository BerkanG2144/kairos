import { describe, expect, it } from 'vitest'
import { COLORS, PAUSE } from './constants.ts'
import { emptyState } from './state.ts'
import { activeActs, addAct, clickAct, clickPause, delAct, start, stop, stopAt } from './tracker.ts'
import type { State } from './types.ts'

const T0 = new Date('2026-11-18T10:00:00').getTime()
const ms = (minutes: number) => T0 + minutes * 60_000
const sec = (minutes: number) => Math.floor(ms(minutes) / 1000)

function withActs(...names: string[]): State {
  return names.reduce((s, n, i) => addAct(s, n, T0 - 1000 * (names.length - i)), emptyState())
}
const sessions = (s: State) => Object.values(s.months).flatMap((m) => m.s)

describe('Fächer', () => {
  it('vergibt die erste unbenutzte Farbe', () => {
    const s = withActs('Mathe', 'Physik')
    expect(s.meta.acts.map((a) => a.c)).toEqual([COLORS[0], COLORS[1]])
    const s2 = addAct(delAct(s, s.meta.acts[0]!.id, T0), 'Chemie', T0 + 1)
    expect(s2.meta.acts.at(-1)!.c).toBe(COLORS[0]) // Farbe des gelöschten wird frei
  })

  it('kürzt und trimmt Namen, ignoriert leere', () => {
    expect(addAct(emptyState(), '   ', T0).meta.acts).toHaveLength(0)
    expect(addAct(emptyState(), '  ' + 'x'.repeat(40), T0).meta.acts[0]!.name).toHaveLength(28)
  })

  it('gleicher Name wie gelöschtes Fach → reaktiviert statt neu', () => {
    let s = withActs('Mathe')
    const id = s.meta.acts[0]!.id
    s = delAct(s, id, T0)
    expect(activeActs(s)).toHaveLength(0)
    s = addAct(s, 'mathe', T0 + 5)
    expect(s.meta.acts).toHaveLength(1)
    expect(s.meta.acts[0]).toEqual({ id, name: 'Mathe', c: COLORS[0] })
  })

  it('gleicher Name wie aktives Fach → keine Änderung', () => {
    const s = withActs('Mathe')
    expect(addAct(s, 'MATHE', T0)).toBe(s)
  })

  it('eindeutige IDs auch bei gleicher Zeit', () => {
    const s = addAct(addAct(emptyState(), 'A', T0), 'B', T0)
    expect(new Set(s.meta.acts.map((a) => a.id)).size).toBe(2)
  })

  it('löschen eines laufenden Fachs beendet die Session', () => {
    let s = withActs('Mathe')
    const id = s.meta.acts[0]!.id
    s = start(s, id, ms(0))
    s = delAct(s, id, ms(10))
    expect(s.meta.run).toBeNull()
    expect(sessions(s)).toEqual([[id, sec(0), sec(10)]])
    expect(s.meta.acts[0]!.del).toBe(true)
  })
})

describe('Timer', () => {
  it('Klick startet, zweiter Klick stoppt', () => {
    let s = withActs('Mathe')
    const id = s.meta.acts[0]!.id
    s = clickAct(s, id, ms(0))
    expect(s.meta.run).toEqual({ a: id, t: sec(0) })
    expect(s.meta.last).toBe(id)
    s = clickAct(s, id, ms(25))
    expect(s.meta.run).toBeNull()
    expect(s.months['2026-11']!.s).toEqual([[id, sec(0), sec(25)]])
  })

  it('anderes Fach wechselt: alte Session endet, neue beginnt', () => {
    let s = withActs('Mathe', 'Physik')
    const [m, p] = s.meta.acts.map((a) => a.id)
    s = clickAct(s, m!, ms(0))
    s = clickAct(s, p!, ms(30))
    expect(s.meta.run).toEqual({ a: p, t: sec(30) })
    expect(sessions(s)).toEqual([[m, sec(0), sec(30)]])
  })

  it('Session < 1 s wird verworfen', () => {
    let s = withActs('Mathe')
    const id = s.meta.acts[0]!.id
    s = start(s, id, T0)
    s = stop(s, T0 + 900)
    expect(sessions(s)).toEqual([])
    expect(s.meta.run).toBeNull()
  })

  it('Pause → Weiter setzt das letzte Fach fort', () => {
    let s = withActs('Mathe')
    const id = s.meta.acts[0]!.id
    s = clickAct(s, id, ms(0))
    s = clickPause(s, ms(20))
    expect(s.meta.run).toEqual({ a: PAUSE, t: sec(20) })
    expect(s.meta.last).toBe(id)
    s = clickPause(s, ms(25))
    expect(s.meta.run).toEqual({ a: id, t: sec(25) })
    expect(sessions(s)).toEqual([
      [id, sec(0), sec(20)],
      [PAUSE, sec(20), sec(25)],
    ])
  })

  it('Weiter ohne (aktives) letztes Fach stoppt nur', () => {
    let s = clickPause(emptyState(), ms(0))
    s = clickPause(s, ms(5))
    expect(s.meta.run).toBeNull()

    let t = withActs('Mathe')
    const id = t.meta.acts[0]!.id
    t = clickAct(t, id, ms(0))
    t = clickPause(t, ms(1))
    t = delAct(t, id, ms(2))
    t = clickPause(t, ms(3))
    expect(t.meta.run).toBeNull()
  })

  it('stopAt stoppt rückwirkend; nie vor dem Start', () => {
    let s = withActs('Mathe')
    const id = s.meta.acts[0]!.id
    s = start(s, id, ms(0))
    expect(sessions(stopAt(s, sec(40), ms(120)))).toEqual([[id, sec(0), sec(40)]])
    expect(sessions(stopAt(s, sec(-5), ms(120)))).toEqual([])
  })

  it('Session landet im Monat ihres Starts', () => {
    const start0 = new Date('2026-11-30T23:30:00').getTime()
    let s = withActs('Mathe')
    const id = s.meta.acts[0]!.id
    s = start(s, id, start0)
    s = stop(s, start0 + 3600_000)
    expect(Object.keys(s.months)).toEqual(['2026-11'])
  })

  it('verändert den Eingabe-State nicht', () => {
    const s = withActs('Mathe')
    const snapshot = JSON.stringify(s)
    const id = s.meta.acts[0]!.id
    stop(clickPause(clickAct(s, id, ms(0)), ms(5)), ms(9))
    delAct(s, id, ms(1))
    expect(JSON.stringify(s)).toBe(snapshot)
  })

  it('setzt updated-at', () => {
    const s = start(withActs('Mathe'), 'x', ms(3))
    expect(s.meta.u).toBe(ms(3))
    expect(stop(s, ms(4)).months['2026-11']!.u).toBe(ms(4))
  })
})
