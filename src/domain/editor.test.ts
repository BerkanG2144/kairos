import { describe, expect, it } from 'vitest'
import { followingInSeries, formFromItem, itemFromForm, removeSeriesFrom, saveEdit, switchType, weeklyDates } from './editor.ts'
import { allPlan, newDraft } from './plan.ts'
import { emptyState } from './state.ts'
import type { Act, PlanItem } from './types.ts'

const acts: Act[] = [{ id: 'a1', name: 'Mathe', c: '#111' }]
const ids = () => {
  let i = 0
  return () => `id${++i}`
}

describe('Formular', () => {
  it('formFromItem: „Wöchentlich bis“ = +12 Wochen', () => {
    expect(formFromItem(newDraft('x', '2026-11-18'))).toMatchObject({ t: '09:00', e: '10:00', act: '', repeat: false, until: '2027-02-10' })
  })

  it('switchType: zu Block → 09:00 + 1 h; zu Abgabe → 23:59', () => {
    const f = formFromItem(newDraft('x', '2026-11-18', 'abgabe'))
    expect(switchType(f, 'block')).toMatchObject({ type: 'block', t: '09:00', e: '10:00' })
    const k = formFromItem(newDraft('x', '2026-11-18', 'klausur'))
    expect(switchType(k, 'abgabe').t).toBe('23:59')
    expect(switchType({ ...k, t: '08:00' }, 'termin')).toMatchObject({ t: '08:00', e: '09:00' })
    // Block → Termin: Zeiten bleiben
    expect(switchType({ ...formFromItem(newDraft('x', '2026-11-18')), t: '14:00', e: '16:00' }, 'termin')).toMatchObject({ t: '14:00', e: '16:00' })
  })

  it('itemFromForm: leerer Titel → Fachname, sonst Fehler', () => {
    const base = newDraft('x', '2026-11-18')
    const f = formFromItem(base)
    expect(itemFromForm(base, f, acts)).toEqual({ ok: false, error: 'title' })
    const r = itemFromForm(base, { ...f, act: 'a1' }, acts)
    expect(r.ok && r.it).toEqual({ id: 'x', type: 'block', title: 'Mathe', act: 'a1', d: '2026-11-18', t: '09:00', e: '10:00' })
  })

  it('itemFromForm: Ende vor Start → Start + 1 h; ungültiges Datum', () => {
    const base = newDraft('x', '2026-11-18')
    const f = { ...formFromItem(base), title: 'T' }
    expect(itemFromForm(base, { ...f, t: '14:00', e: '13:00' }, acts)).toMatchObject({ it: { t: '14:00', e: '15:00' } })
    expect(itemFromForm(base, { ...f, t: '', e: '' }, acts)).toMatchObject({ it: { t: '09:00', e: '10:00' } })
    expect(itemFromForm(base, { ...f, d: '' }, acts)).toEqual({ ok: false, error: 'date' })
  })

  it('itemFromForm: Typwechsel entfernt e, done nur bei Abgabe, act entfernbar', () => {
    const base: PlanItem = { id: 'x', type: 'abgabe', title: 'B5', act: 'a1', d: '2026-11-18', t: '23:59', done: true, g: 's' }
    const f = formFromItem(base)
    expect(itemFromForm(base, f, acts)).toMatchObject({ it: { done: true, g: 's' } })
    const r = itemFromForm(base, { ...f, type: 'klausur', act: '', t: '' }, acts)
    expect(r.ok && r.it).toEqual({ id: 'x', type: 'klausur', title: 'B5', d: '2026-11-18', g: 's' })
  })
})

describe('Serien', () => {
  it('weeklyDates inkl. Enddatum, max 60', () => {
    expect(weeklyDates('2026-11-18', '2026-12-02')).toEqual(['2026-11-18', '2026-11-25', '2026-12-02'])
    expect(weeklyDates('2026-11-18', '2026-11-17')).toEqual([])
    expect(weeklyDates('2026-01-01', '2030-01-01')).toHaveLength(60)
  })

  it('weeklyDates über Zeitumstellung bleibt am selben Wochentag', () => {
    expect(weeklyDates('2026-03-23', '2026-04-06')).toEqual(['2026-03-23', '2026-03-30', '2026-04-06'])
  })

  it('saveEdit: neue Serie mit gemeinsamer g, erster behält ID, über Monatsgrenzen', () => {
    const it: PlanItem = { id: 'x', type: 'block', title: 'Mathe', d: '2026-11-18', t: '10:00', e: '12:00' }
    const s = saveEdit(emptyState(), it, { repeat: true, until: '2026-12-09' }, true, 1, ids())
    const all = allPlan(s)
    expect(all.map((i) => [i.id, i.d, i.g])).toEqual([
      ['x', '2026-11-18', 'id1'],
      ['id2', '2026-11-25', 'id1'],
      ['id3', '2026-12-02', 'id1'],
      ['id4', '2026-12-09', 'id1'],
    ])
    expect(Object.keys(s.months)).toEqual(['2026-11', '2026-12'])
  })

  it('saveEdit: Bearbeiten erzeugt nie eine Serie; until < d → Einzeltermin', () => {
    const it: PlanItem = { id: 'x', type: 'block', title: 'M', d: '2026-11-18', t: '10:00', e: '11:00' }
    expect(allPlan(saveEdit(emptyState(), it, { repeat: true, until: '2027-01-01' }, false, 1, ids()))).toHaveLength(1)
    expect(allPlan(saveEdit(emptyState(), it, { repeat: true, until: '2026-11-01' }, true, 1, ids()))).toEqual([it])
  })

  it('followingInSeries / removeSeriesFrom („alle folgenden“)', () => {
    const it: PlanItem = { id: 'x', type: 'block', title: 'M', d: '2026-11-18', t: '10:00', e: '11:00' }
    const s = saveEdit(emptyState(), it, { repeat: true, until: '2026-12-16' }, true, 1, ids())
    const third = allPlan(s).find((i) => i.d === '2026-12-02')!
    expect(followingInSeries(s, third)).toBe(2)
    expect(followingInSeries(s, allPlan(s).at(-1)!)).toBe(0)
    const after = removeSeriesFrom(s, third, 2)
    expect(allPlan(after).map((i) => i.d)).toEqual(['2026-11-18', '2026-11-25'])
  })

  it('removeSeriesFrom ohne Serie löscht nur den Eintrag', () => {
    const it: PlanItem = { id: 'x', type: 'abgabe', title: 'A', d: '2026-11-18' }
    const s = saveEdit(saveEdit(emptyState(), it, { repeat: false, until: '' }, true, 1, ids()), { ...it, id: 'y' }, { repeat: false, until: '' }, true, 1, ids())
    expect(allPlan(removeSeriesFrom(s, it, 2)).map((i) => i.id)).toEqual(['y'])
  })
})
