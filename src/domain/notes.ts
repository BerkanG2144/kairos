/**
 * Notizen an Plan-Items (v4): `n` = bereinigtes HTML aus dem Notiz-Editor, `ic` = Icon-Schlüssel.
 * Das HTML kommt immer kanonisch aus `features/notes/sanitize.ts` (feste Tags und Attribute),
 * deshalb reichen hier einfache reguläre Ausdrücke.
 */
import { findItem, saveItem } from './plan.ts'
import type { PlanItem, State } from './types.ts'

/** Felder, die sich auf der Notizseite ändern lassen. `undefined` bzw. '' entfernt das Feld. */
export type ItemPatch = Partial<Pick<PlanItem, 'title' | 'act' | 'd' | 't' | 'n' | 'ic'>>

/**
 * Ändert einzelne Felder eines Eintrags auf Basis des *aktuellen* Stands (nie einer Momentaufnahme),
 * damit gleichzeitig gespeicherte Notizen nicht überschrieben werden. Ohne Änderung: derselbe State.
 */
export function patchItem(s: State, id: string, patch: ItemPatch, nowMs: number): State {
  const f = findItem(s, id)
  if (!f) return s
  const next: PlanItem = { ...f.it }
  let changed = false
  for (const [k, v] of Object.entries(patch) as [keyof ItemPatch, string | undefined][]) {
    if (k === 'd' && !/^\d{4}-\d{2}-\d{2}$/.test(v ?? '')) continue
    if (k === 'title' && !v?.trim()) continue
    const val = v === '' ? undefined : v
    if (next[k] === val) continue
    if (val === undefined) delete next[k]
    else next[k] = val
    changed = true
  }
  return changed ? saveItem(s, next, nowMs) : s
}

/** Notizen speichern; leere Notizen entfernen das Feld. */
export const setNotes = (s: State, id: string, html: string, nowMs: number): State => patchItem(s, id, { n: html }, nowMs)

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' }

/** Reiner Text der Notizen (Blöcke durch Leerzeichen getrennt). */
export function notesText(html: string | undefined): string {
  if (!html) return ''
  return html
    .replace(/<(br|hr)>|<\/?(p|h1|h2|h3|ul|ol|li|blockquote|pre)\b[^>]*>/g, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e: string) => ENTITIES[e]!)
    .replace(/\s+/g, ' ')
    .trim()
}

export type NotesSummary = { text: string; todo: number; done: number }

/** Für die Karte: Textanfang und Checklisten-Stand (erledigt / gesamt). */
export function notesSummary(html: string | undefined): NotesSummary {
  const h = html ?? ''
  const done = h.match(/<li data-checked="true">/g)?.length ?? 0
  const open = h.match(/<li data-checked="false">/g)?.length ?? 0
  return { text: notesText(h), todo: done + open, done }
}
