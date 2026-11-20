import { describe, expect, it } from 'vitest'
import { notesSummary, notesText, patchItem, setNotes } from './notes.ts'
import { allPlan, findItem, saveItem } from './plan.ts'
import { emptyState } from './state.ts'
import type { PlanItem } from './types.ts'

const exam: PlanItem = { id: 'k', type: 'klausur', title: 'Analysis', d: '2026-12-10', t: '09:00', act: 'a' }
const base = () => saveItem(emptyState(), exam, 1)

describe('Notizen speichern', () => {
  it('setzt und entfernt n', () => {
    const s = setNotes(base(), 'k', '<p>Hallo</p>', 5)
    expect(findItem(s, 'k')!.it.n).toBe('<p>Hallo</p>')
    expect(s.months['2026-12']!.u).toBe(5)
    const cleared = setNotes(s, 'k', '', 6)
    expect('n' in findItem(cleared, 'k')!.it).toBe(false)
  })

  it('gleicher Inhalt → derselbe State (kein Speichern)', () => {
    const s = setNotes(base(), 'k', '<p>x</p>', 5)
    expect(setNotes(s, 'k', '<p>x</p>', 6)).toBe(s)
    expect(setNotes(s, 'gibtsnicht', '<p>y</p>', 6)).toBe(s)
  })
})

describe('Eigenschaften ändern (patchItem)', () => {
  it('ändert nur die angegebenen Felder und behält Notizen', () => {
    const s = patchItem(setNotes(base(), 'k', '<p>n</p>', 2), 'k', { t: '', act: 'b', ic: 'rocket' }, 3)
    expect(allPlan(s)).toEqual([{ id: 'k', type: 'klausur', title: 'Analysis', d: '2026-12-10', act: 'b', n: '<p>n</p>', ic: 'rocket' }])
  })

  it('Datum in anderem Monat → Eintrag zieht samt Notizen um', () => {
    const s = patchItem(setNotes(base(), 'k', '<p>n</p>', 2), 'k', { d: '2027-01-05' }, 3)
    expect(s.months['2026-12']!.p).toEqual([])
    expect(findItem(s, 'k')).toMatchObject({ k: '2027-01', it: { n: '<p>n</p>', d: '2027-01-05' } })
  })

  it('ignoriert ungültiges Datum und leeren Titel', () => {
    const s = base()
    expect(patchItem(s, 'k', { d: '' }, 3)).toBe(s)
    expect(patchItem(s, 'k', { title: '   ' }, 3)).toBe(s)
  })
})

describe('Zusammenfassung für die Karte', () => {
  it('Text ohne Tags, Entities dekodiert, Blöcke getrennt', () => {
    expect(notesText('<h1>Themen</h1><p>A &amp; B<br>C&nbsp;&lt;D&gt;</p><ul><li>eins</li><li>zwei</li></ul>')).toBe('Themen A & B C <D> eins zwei')
    expect(notesText('<ul><li>Folgen<ul><li>Stetigkeit</li></ul></li></ul>')).toBe('Folgen Stetigkeit')
    expect(notesText(undefined)).toBe('')
  })

  it('zählt Checklisten-Punkte', () => {
    const html = '<ul data-type="todo"><li data-checked="true">a</li><li data-checked="false">b</li><li data-checked="true">c</li></ul><ul><li>d</li></ul>'
    expect(notesSummary(html)).toEqual({ text: 'a b c d', todo: 3, done: 2 })
    expect(notesSummary(undefined)).toEqual({ text: '', todo: 0, done: 0 })
  })
})
