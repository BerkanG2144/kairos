import { COLORS, OLD_COLORS } from './constants.ts'
import { SCHEMA_VERSION } from './migrate.ts'
import { describe, expect, it } from 'vitest'
import { importSummary, makeBackup, parseBackup } from './backup.ts'
import { normalizeState } from './normalize.ts'
import type { State } from './types.ts'

const NOW = new Date('2026-11-18T19:30:00').getTime()

/** So sieht ein Legacy-State aus (inkl. altem exams-Feld). */
const legacy = {
  meta: {
    acts: [
      { id: 'a1', name: 'Mathe', c: '#c7b8f2' },
      { id: 'a2', name: 'Physik', c: '#a9e5c8', del: true },
      { id: 'a3', name: 'Info', c: '#a8c8ec' },
    ],
    run: { a: 'a1', t: 1_763_400_000 },
    last: 'a1',
    u: 1_763_400_000_000,
    exams: [{ id: 'e1', name: 'HM I', d: '2027-02-10', t: '08:00' }],
  },
  months: {
    '2026-10': { s: [['a1', 1_760_000_000, 1_760_003_600], ['_p', 1_760_003_600, 1_760_003_900]], u: 1 },
    '2026-11': {
      s: [['a3', 1_763_000_000, 1_763_001_000]],
      p: [{ id: 'p1', type: 'abgabe', title: 'Blatt 3', act: 'a1', d: '2026-11-20', t: '23:59' }],
      u: 2,
    },
  },
}

const envelope = (data: unknown, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ app: 'lernzeit', format: 1, exportedAt: '2026-11-17T08:05:00.000Z', data, ...extra })

describe('parseBackup', () => {
  it('liest Legacy-Hülle und migriert exams', () => {
    const r = parseBackup(envelope(legacy), NOW)
    if (!r.ok) throw new Error(r.error)
    const { state, acts, sessions, items, skipped, exportedAt } = r.backup
    expect(acts).toBe(2)
    expect(sessions).toBe(3)
    expect(items).toBe(2)
    expect(skipped).toBe(0)
    expect(exportedAt?.toISOString()).toBe('2026-11-17T08:05:00.000Z')
    expect('exams' in state.meta).toBe(false)
    expect(state.months['2027-02']!.p![0]).toMatchObject({ id: 'e1', type: 'klausur', title: 'HM I', t: '08:00' })
    // alles andere unverändert
    // Fächer bleiben, alte Palettenfarben werden auf die neue Palette gehoben (v5)
    expect(state.meta.acts).toEqual(legacy.meta.acts.map((a) => ({ ...a, c: COLORS[OLD_COLORS.indexOf(a.c as (typeof OLD_COLORS)[number])] })))
    expect(state.meta.run).toEqual(legacy.meta.run)
    expect(state.months['2026-10']).toEqual(legacy.months['2026-10'])
  })

  it('akzeptiert ein nacktes State-Objekt', () => {
    const r = parseBackup(JSON.stringify(legacy), NOW)
    expect(r.ok && r.backup.sessions).toBe(3)
    expect(r.ok && r.backup.exportedAt).toBeNull()
  })

  it.each([
    ['kein JSON', '{nope'],
    ['leeres Objekt', '{}'],
    ['null', 'null'],
    ['Array', '[]'],
    ['ohne acts', JSON.stringify({ meta: {}, months: {} })],
    ['acts kein Array', JSON.stringify({ meta: { acts: {} }, months: {} })],
    ['ohne months', JSON.stringify({ meta: { acts: [] } })],
    ['Hülle mit kaputten Daten', envelope({ foo: 1 })],
  ])('lehnt ungültige Datei ab: %s', (_name, text) => {
    expect(parseBackup(text, NOW)).toEqual({ ok: false, error: 'Ungültige Datei' })
  })

  it('lehnt Backups einer neueren Schema-Version ab', () => {
    expect(parseBackup(envelope(legacy, { schema: 99 }), NOW)).toEqual({ ok: false, error: 'Backup ist neuer als die App' })
  })

  it('ergänzt fehlende Felder mit Standardwerten', () => {
    const r = parseBackup(JSON.stringify({ meta: { acts: [] }, months: { '2026-11': {} } }), NOW)
    if (!r.ok) throw new Error(r.error)
    expect(r.backup.state).toEqual({ meta: { acts: [], run: null, last: null, u: 0 }, months: { '2026-11': { s: [], u: 0 } } })
  })

  it('überspringt unbrauchbare Einzeleinträge und zählt sie', () => {
    const broken = {
      meta: { acts: [{ id: 'a1', name: 'Mathe', c: '#fff' }, { name: 'ohne id' }], run: 'kaputt' },
      months: {
        '2026-11': {
          s: [['a1', 10, 20], ['a1', 'x', 20], ['a1', 30, 20], 'quatsch'],
          p: [{ id: 'p1', type: 'block', title: 'ok', d: '2026-11-02' }, { id: 'p2', type: 'unbekannt', d: '2026-11-02' }, { id: 'p3', type: 'block', d: '2.11.' }],
          u: 1,
        },
        kaputt: { s: [] },
      },
    }
    const r = parseBackup(JSON.stringify(broken), NOW)
    if (!r.ok) throw new Error(r.error)
    expect(r.backup.skipped).toBe(1 + 1 + 3 + 2 + 1)
    expect(r.backup.state.meta.acts).toHaveLength(1)
    expect(r.backup.state.months['2026-11']!.s).toEqual([['a1', 10, 20]])
    expect(r.backup.state.months['2026-11']!.p!.map((p) => p.id)).toEqual(['p1'])
  })

  it('behält unbekannte Felder (keine Datenverluste)', () => {
    const n = normalizeState({ meta: { acts: [], extra: 42 }, months: { '2026-11': { s: [], zusatz: 'x' } } })
    expect(n?.state.meta).toMatchObject({ extra: 42 })
    expect(n?.state.months['2026-11']).toMatchObject({ zusatz: 'x' })
  })
})

describe('makeBackup', () => {
  it('Format, Dateiname und Roundtrip', () => {
    const r0 = parseBackup(envelope(legacy), NOW)
    if (!r0.ok) throw new Error(r0.error)
    const state: State = r0.backup.state
    const { filename, json } = makeBackup(state, new Date('2026-11-18T07:04:00'))
    expect(filename).toBe('kairos-backup-2026-11-18_0704.json')
    const o = JSON.parse(json)
    expect(o).toMatchObject({ app: 'lernzeit', format: 1, schema: SCHEMA_VERSION, exportedAt: '2026-11-18T06:04:00.000Z' })
    const r = parseBackup(json, NOW + 1)
    expect(r.ok && r.backup.state).toEqual(state)
  })
})

describe('importSummary', () => {
  it('wie in der Legacy-Datei', () => {
    const r = parseBackup(envelope(legacy), NOW)
    if (!r.ok) throw new Error(r.error)
    expect(importSummary(r.backup)).toBe('Backup vom 17. Nov 09:05 laden? 2 Fächer, 3 Einträge – ersetzt die aktuellen Daten.')
    expect(importSummary({ ...r.backup, exportedAt: null, skipped: 2 })).toBe(
      'Backup laden? 2 Fächer, 3 Einträge (2 unlesbare Einträge übersprungen) – ersetzt die aktuellen Daten.',
    )
  })
})
