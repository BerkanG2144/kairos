import { describe, expect, it } from 'vitest'
import { allPlan, findItem, removeItem, saveItem } from './plan.ts'
import { emptyState } from './state.ts'
import type { PlanItem } from './types.ts'

const item = (id: string, d: string, extra: Partial<PlanItem> = {}): PlanItem => ({ id, type: 'block', title: id, d, ...extra })

describe('Plan-Items speichern', () => {
  it('legt im Monat des Datums an', () => {
    const s = saveItem(emptyState(), item('x', '2026-11-18'), 5)
    expect(s.months['2026-11']).toEqual({ s: [], p: [item('x', '2026-11-18')], u: 5 })
  })

  it('ersetzt bei gleicher id', () => {
    let s = saveItem(emptyState(), item('x', '2026-11-18'), 1)
    s = saveItem(s, item('x', '2026-11-19', { title: 'neu' }), 2)
    expect(allPlan(s)).toEqual([item('x', '2026-11-19', { title: 'neu' })])
  })

  it('zieht bei Monatswechsel um', () => {
    let s = saveItem(emptyState(), item('x', '2026-11-30'), 1)
    s = saveItem(s, item('x', '2026-12-01'), 2)
    expect(s.months['2026-11']!.p).toEqual([])
    expect(s.months['2026-11']!.u).toBe(2)
    expect(findItem(s, 'x')).toMatchObject({ k: '2026-12', i: 0 })
  })

  it('behält Sessions des Monats', () => {
    const base = { ...emptyState(), months: { '2026-11': { s: [['a', 1, 2]] as [string, number, number][], u: 0 } } }
    expect(saveItem(base, item('x', '2026-11-02'), 1).months['2026-11']!.s).toEqual([['a', 1, 2]])
  })

  it('entfernt', () => {
    let s = saveItem(saveItem(emptyState(), item('x', '2026-11-18'), 1), item('y', '2026-11-18'), 1)
    s = removeItem(s, 'x', 3)
    expect(allPlan(s).map((i) => i.id)).toEqual(['y'])
    expect(removeItem(s, 'gibtsnicht', 4)).toBe(s)
  })
})
