import { describe, expect, it } from 'vitest'
import { layoutDay } from './lanes.ts'
import type { PlanItem } from './types.ts'

const b = (id: string, t: string, e: string): PlanItem => ({ id, type: 'block', title: id, d: '2026-11-18', t, e })
const lanes = (items: PlanItem[]) => Object.fromEntries(layoutDay(items).map((x) => [x.it.id, [x.lane, x.n]]))

describe('layoutDay', () => {
  it('ohne Überlappung: alle volle Breite', () => {
    expect(lanes([b('a', '08:00', '09:00'), b('b', '09:00', '10:00')])).toEqual({ a: [0, 1], b: [0, 1] })
  })

  it('zwei überlappende → zwei Spuren', () => {
    expect(lanes([b('a', '08:00', '10:00'), b('b', '09:00', '11:00')])).toEqual({ a: [0, 2], b: [1, 2] })
  })

  it('freie Spur wird wiederverwendet, Cluster bleibt zusammen', () => {
    // a 8–12 überlappt b 9–10 und c 10:30–11; c kann Spur 1 wiederverwenden
    expect(lanes([b('a', '08:00', '12:00'), b('b', '09:00', '10:00'), b('c', '10:30', '11:00')])).toEqual({
      a: [0, 2],
      b: [1, 2],
      c: [1, 2],
    })
  })

  it('drei gleichzeitig → drei Spuren; danach neuer Cluster', () => {
    expect(
      lanes([b('a', '08:00', '09:00'), b('b', '08:00', '09:00'), b('c', '08:30', '09:30'), b('d', '10:00', '11:00')]),
    ).toEqual({ a: [0, 3], b: [1, 3], c: [2, 3], d: [0, 1] })
  })

  it('längerer Eintrag bei gleichem Start kommt zuerst (linke Spur)', () => {
    expect(lanes([b('kurz', '08:00', '08:30'), b('lang', '08:00', '10:00')])).toEqual({ lang: [0, 2], kurz: [1, 2] })
  })

  it('Mindestdauer 15 min für Überlappung', () => {
    const r = layoutDay([b('a', '08:00', '08:00'), b('b', '08:10', '08:20')])
    expect(r.map((x) => [x.it.id, x.e, x.lane, x.n])).toEqual([
      ['a', 495, 0, 2],
      ['b', 505, 1, 2],
    ])
  })

  it('leer', () => {
    expect(layoutDay([])).toEqual([])
  })
})
