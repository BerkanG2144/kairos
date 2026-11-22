/** Editor-Logik für Plan-Einträge: Formular ↔ Item, Typwechsel, Serien, Löschen. */
import { allPlan, removeItem, saveItem } from './plan.ts'
import { addDays, dayKey, fromMin, parseDayKey, toMin } from './time.ts'
import type { Act, PlanItem, PlanType, State } from './types.ts'

export type EditorForm = {
  type: PlanType
  title: string
  /** Fach-ID oder '' */
  act: string
  d: string
  t: string
  e: string
  repeat: boolean
  until: string
}

/** Höchstzahl Termine einer Serie. */
export const SERIES_MAX = 60
/** Standard für „Wöchentlich bis“: +12 Wochen. */
export const SERIES_DEFAULT_WEEKS = 12

export const isTimedType = (t: PlanType): boolean => t === 'block' || t === 'termin'

export const TITLE_PLACEHOLDER: Record<PlanType, string> = {
  block: 'z. B. LA2 Blatt 5 rechnen',
  abgabe: 'z. B. Blatt 5',
  klausur: 'z. B. Lineare Algebra 2',
  termin: 'z. B. Gym',
}

/** Beschriftung des Zeitfelds je Typ. */
export const timeLabel = (t: PlanType): string => (isTimedType(t) ? 'Von' : t === 'abgabe' ? 'Fällig um' : 'Uhrzeit')

export function formFromItem(it: PlanItem): EditorForm {
  return {
    type: it.type,
    title: it.title,
    act: it.act ?? '',
    d: it.d,
    t: it.t ?? '',
    e: it.e ?? '',
    repeat: false,
    until: dayKey(addDays(parseDayKey(it.d), 7 * SERIES_DEFAULT_WEEKS)),
  }
}

/** Typwechsel im Editor mit sinnvollen Zeit-Vorgaben (wie Legacy). */
export function switchType(f: EditorForm, type: PlanType): EditorForm {
  const out = { ...f, type }
  if (isTimedType(type) && !isTimedType(f.type)) {
    if (!out.t || out.t === '23:59') out.t = '09:00'
    if (!out.e) out.e = fromMin((toMin(out.t) ?? 0) + 60)
  }
  if (type === 'abgabe' && !out.t) out.t = '23:59'
  return out
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Formular → Item. Leerer Titel → Fachname; ohne beides ungültig ('title').
 * Block/Termin: Ende muss nach Start liegen, sonst Start + 1 h.
 */
export function itemFromForm(base: PlanItem, f: EditorForm, acts: Act[]): { ok: true; it: PlanItem } | { ok: false; error: 'title' | 'date' } {
  const a = f.act ? acts.find((x) => x.id === f.act) : undefined
  const title = f.title.trim() || (a ? a.name : '')
  if (!title) return { ok: false, error: 'title' }
  if (!DAY_RE.test(f.d)) return { ok: false, error: 'date' }

  const { act: _a, t: _t, e: _e, done, ...rest } = base
  const it: PlanItem = { ...rest, type: f.type, title, d: f.d }
  if (a) it.act = a.id
  if (isTimedType(f.type)) {
    it.t = f.t || '09:00'
    const start = toMin(it.t) ?? 0
    it.e = f.e && (toMin(f.e) ?? 0) > start ? f.e : fromMin(start + 60)
  } else if (f.t) it.t = f.t
  if (f.type === 'abgabe' && done) it.done = true
  return { ok: true, it }
}

/** Wöchentliche Daten ab d bis einschließlich until (max. SERIES_MAX). */
export function weeklyDates(d: string, until: string, max = SERIES_MAX): string[] {
  const out: string[] = []
  for (let dd = parseDayKey(d); dayKey(dd) <= until && out.length < max; dd = addDays(dd, 7)) out.push(dayKey(dd))
  return out
}

/**
 * Speichert den Editor-Inhalt. Bei neuen Einträgen mit „Wöchentlich bis“ entsteht eine
 * Serie (gemeinsame g); der erste Termin behält die ID des Entwurfs.
 */
export function saveEdit(s: State, it: PlanItem, f: Pick<EditorForm, 'repeat' | 'until'>, isNew: boolean, nowMs: number, makeId: () => string): State {
  if (isNew && f.repeat && f.until >= it.d) {
    const g = makeId()
    return weeklyDates(it.d, f.until).reduce((acc, d, i) => saveItem(acc, { ...it, id: i ? makeId() : it.id, d, g }, nowMs), s)
  }
  return saveItem(s, it, nowMs)
}

/** Anzahl späterer Termine derselben Serie. */
export function followingInSeries(s: State, it: PlanItem): number {
  if (!it.g) return 0
  return allPlan(s).filter((x) => x.g === it.g && x.d > it.d).length
}

/** „Alle folgenden“: diesen und alle späteren Termine der Serie löschen. */
export function removeSeriesFrom(s: State, it: PlanItem, nowMs: number): State {
  if (!it.g) return removeItem(s, it.id, nowMs)
  return allPlan(s)
    .filter((x) => x.g === it.g && x.d >= it.d)
    .reduce((acc, x) => removeItem(acc, x.id, nowMs), s)
}
