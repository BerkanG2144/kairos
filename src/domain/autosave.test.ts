import { describe, expect, it } from 'vitest'
import { CURRENT_FILE, dailyFile, filesToPrune, hasContent, isDailyFile, KEEP_DAYS } from './autosave.ts'
import { emptyState } from './state.ts'

describe('autosave', () => {
  it('Tagesdatei nach lokalem Datum (kurz nach Mitternacht schon der neue Tag)', () => {
    expect(dailyFile(new Date('2026-11-18T23:59:00+01:00'))).toBe('kairos-2026-11-18.json')
    expect(dailyFile(new Date('2026-11-19T00:01:00+01:00'))).toBe('kairos-2026-11-19.json')
  })

  it('erkennt nur echte Tagesdateien', () => {
    expect(isDailyFile('kairos-2026-11-18.json')).toBe(true)
    expect(isDailyFile(CURRENT_FILE)).toBe(false)
    expect(isDailyFile('kairos-backup-2026-11-18_1500.json')).toBe(false)
    expect(isDailyFile('kairos-2026-11-18.json.crswap')).toBe(false)
    expect(isDailyFile('notizen.txt')).toBe(false)
  })

  it('räumt nur die ältesten Tagesdateien über dem Limit auf', () => {
    const days = Array.from({ length: KEEP_DAYS + 3 }, (_, i) => dailyFile(new Date(2026, 9, 1 + i)))
    const names = [CURRENT_FILE, 'eigene-notiz.json', ...days.slice().reverse()]
    expect(filesToPrune(names)).toEqual(days.slice(0, 3))
    expect(filesToPrune(days.slice(0, KEEP_DAYS))).toEqual([])
    expect(filesToPrune([CURRENT_FILE])).toEqual([])
  })

  it('leerer Stand gilt als ohne Inhalt', () => {
    const s = emptyState()
    expect(hasContent(s)).toBe(false)
    expect(hasContent({ ...s, months: { '2026-11': { s: [], p: [], u: 1 } } })).toBe(false)
    expect(hasContent({ ...s, meta: { ...s.meta, acts: [{ id: 'a', name: 'Mathe', c: '#fff' }] } })).toBe(true)
    expect(hasContent({ ...s, months: { '2026-11': { s: [['a', 1, 2]], u: 1 } } })).toBe(true)
    expect(hasContent({ ...s, months: { '2026-11': { s: [], p: [{ id: 'p', type: 'termin', title: 'x', d: '2026-11-18' }], u: 1 } } })).toBe(true)
  })
})
