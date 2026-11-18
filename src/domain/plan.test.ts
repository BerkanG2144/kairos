import { describe, expect, it } from 'vitest'
import { allPlan, findItem, isTimed, itemColor, newDraft, newId, removeItem, saveItem, sortItems, toggleDone, TYPES } from './plan.ts'
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

describe('Darstellungs-Helfer', () => {
  it('sortItems: Datum, Uhrzeit (ohne → Ende), dann Typ', () => {
    const items: PlanItem[] = [
      item('b', '2026-11-18', { t: '10:00' }),
      { id: 'k', type: 'klausur', title: 'k', d: '2026-11-18' },
      { id: 'a', type: 'abgabe', title: 'a', d: '2026-11-18' },
      item('c', '2026-11-17', { t: '23:00' }),
      { id: 'a2', type: 'abgabe', title: 'a2', d: '2026-11-18', t: '10:00' },
    ]
    expect(sortItems(items).map((i) => i.id)).toEqual(['c', 'a2', 'b', 'k', 'a'])
  })

  it('isTimed / itemColor', () => {
    expect(isTimed(item('x', '2026-11-18', { t: '10:00', e: '11:00' }))).toBe(true)
    expect(isTimed(item('x', '2026-11-18', { t: '10:00' }))).toBe(false)
    expect(isTimed({ id: 'x', type: 'abgabe', title: '', d: '2026-11-18', t: '10:00', e: '11:00' })).toBe(false)
    const acts = [{ id: 'a', name: 'M', c: '#123' }]
    expect(itemColor(item('x', '2026-11-18', { act: 'a' }), acts)).toBe('#123')
    expect(itemColor(item('x', '2026-11-18', { act: 'weg' }), acts)).toBe(TYPES.block.c)
  })

  it('toggleDone', () => {
    let s = saveItem(emptyState(), { id: 'x', type: 'abgabe', title: 'x', d: '2026-11-18' }, 1)
    s = toggleDone(s, 'x', 2)
    expect(findItem(s, 'x')!.it.done).toBe(true)
    s = toggleDone(s, 'x', 3)
    expect('done' in findItem(s, 'x')!.it).toBe(false)
  })
})

describe('newDraft', () => {
  it('Standardwerte je Typ', () => {
    expect(newDraft('x', '2026-11-18')).toEqual({ id: 'x', type: 'block', title: '', d: '2026-11-18', t: '09:00', e: '10:00' })
    expect(newDraft('x', '2026-11-18', 'termin', '23:30')).toMatchObject({ t: '23:30', e: '23:59' })
    expect(newDraft('x', '2026-11-18', 'block', '10:15', '11:00')).toMatchObject({ t: '10:15', e: '11:00' })
    expect(newDraft('x', '2026-11-18', 'abgabe')).toEqual({ id: 'x', type: 'abgabe', title: '', d: '2026-11-18', t: '23:59' })
    expect(newDraft('x', '2026-11-18', 'klausur')).toEqual({ id: 'x', type: 'klausur', title: '', d: '2026-11-18' })
    expect(newDraft('x', '2026-11-18', 'klausur', '08:00').t).toBe('08:00')
  })
  it('newId ist eindeutig genug', () => {
    expect(new Set(Array.from({ length: 200 }, () => newId(1))).size).toBeGreaterThan(195)
  })
})
