import { describe, expect, it } from 'vitest'
import { migrate, migrateExams, SCHEMA_VERSION } from './migrate.ts'
import { allPlan } from './plan.ts'
import { emptyState } from './state.ts'
import type { State } from './types.ts'

const withExams = (exams: NonNullable<State['meta']['exams']>, months: State['months'] = {}): State => ({
  meta: { ...emptyState().meta, exams },
  months,
})

describe('Migration exams → klausur', () => {
  it('wandelt Klausuren in Plan-Items und entfernt exams', () => {
    const s = migrateExams(
      withExams([
        { id: 'e1', name: 'Analysis', d: '2027-02-10', t: '09:00' },
        { id: 'e2', name: '', d: '2027-03-01' },
      ]),
      7,
    )
    expect('exams' in s.meta).toBe(false)
    expect(s.meta.u).toBe(7)
    expect(s.months['2027-02']!.p).toEqual([{ id: 'e1', type: 'klausur', title: 'Analysis', d: '2027-02-10', t: '09:00' }])
    expect(s.months['2027-03']!.p).toEqual([{ id: 'e2', type: 'klausur', title: 'Klausur', d: '2027-03-01' }])
  })

  it('überspringt Einträge ohne Datum und bereits vorhandene IDs', () => {
    const existing = { id: 'e1', type: 'klausur' as const, title: 'schon da', d: '2027-02-10' }
    const s = migrateExams(
      withExams([{ id: 'e1', name: 'Analysis', d: '2027-02-10' }, { id: 'e3', name: 'ohne', d: '' }], {
        '2027-02': { s: [], p: [existing], u: 0 },
      }),
      1,
    )
    expect(allPlan(s)).toEqual([existing])
  })

  it('ist idempotent und lässt States ohne exams unverändert', () => {
    const s = emptyState()
    expect(migrateExams(s, 1)).toBe(s)
    const once = migrateExams(withExams([{ id: 'e1', name: 'A', d: '2027-02-10' }]), 1)
    expect(migrateExams(once, 2)).toBe(once)
  })

  it('verliert keine Sessions', () => {
    const months = { '2026-11': { s: [['a', 1, 100]] as State['months'][string]['s'], u: 3 } }
    const s = migrate(withExams([{ id: 'e1', name: 'A', d: '2026-11-20' }], months), 1, 9)
    expect(s.months['2026-11']!.s).toEqual([['a', 1, 100]])
    expect(s.months['2026-11']!.p).toHaveLength(1)
  })

  it('migrate ab aktueller Version macht nichts', () => {
    const s = withExams([{ id: 'e1', name: 'A', d: '2027-02-10' }])
    expect(migrate(s, SCHEMA_VERSION, 1)).toBe(s)
  })
})

describe('Migration v2 → v3 (Wochenplan)', () => {
  it('lässt v2-Daten unverändert (nur neue optionale Felder)', () => {
    const s: State = {
      meta: { acts: [{ id: 'a', name: 'Mathe', c: '#fff' }], run: { a: 'a', t: 5 }, last: 'a', u: 1 },
      months: { '2026-11': { s: [['a', 1, 2]], p: [{ id: 'p', type: 'termin', title: 'x', d: '2026-11-18' }], u: 1 } },
    }
    expect(migrate(s, 2, 99)).toBe(s)
  })

  it('v1 → aktuell in einem Schritt', () => {
    const out = migrate(withExams([{ id: 'e1', name: 'Ana', d: '2027-02-10' }]), 1, 7)
    expect(out.meta.exams).toBeUndefined()
    expect(allPlan(out).map((i) => i.title)).toEqual(['Ana'])
  })
})

describe('Migration v3 → v4 (Notizen)', () => {
  it('lässt v3-Daten unverändert (nur neue optionale Felder)', () => {
    const s: State = {
      meta: { acts: [], run: null, last: null, u: 1 },
      months: { '2026-12': { s: [], p: [{ id: 'k', type: 'klausur', title: 'Ana', d: '2026-12-10' }], k: [], u: 1 } },
    }
    expect(SCHEMA_VERSION).toBe(4)
    expect(migrate(s, 3, 99)).toBe(s)
  })
})
