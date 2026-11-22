/**
 * Plan-Items (Kalender-Einträge) liegen in den Monatsdokumenten: months['YYYY-MM'].p,
 * einsortiert nach ihrem Datum d. Alle Funktionen sind rein (State → State).
 */
import { fromMin, monthKeyOfDay, toMin } from './time.ts'
import type { Act, MonthDoc, PlanItem, PlanType, State } from './types.ts'

export function allPlan(s: State): PlanItem[] {
  const out: PlanItem[] = []
  for (const k in s.months) {
    const p = s.months[k]?.p
    if (p) out.push(...p)
  }
  return out
}

export function findItem(s: State, id: string): { k: string; i: number; it: PlanItem } | null {
  for (const k in s.months) {
    const p = s.months[k]?.p
    if (!p) continue
    const i = p.findIndex((x) => x.id === id)
    if (i >= 0) return { k, i, it: p[i]! }
  }
  return null
}

/** Legt an oder ersetzt (gleiche id). Wechselt das Datum den Monat, zieht das Item um. */
export function saveItem(s: State, it: PlanItem, nowMs: number): State {
  const months = { ...s.months }
  const f = findItem(s, it.id)
  const nk = monthKeyOfDay(it.d)
  if (f && f.k !== nk) {
    const old = months[f.k]!
    months[f.k] = { ...old, p: (old.p ?? []).filter((x) => x.id !== it.id), u: nowMs }
  }
  const m: MonthDoc = months[nk] ?? { s: [], p: [], u: 0 }
  const p = [...(m.p ?? [])]
  const j = p.findIndex((x) => x.id === it.id)
  if (j >= 0) p[j] = it
  else p.push(it)
  months[nk] = { ...m, p, u: nowMs }
  return { ...s, months }
}

export function removeItem(s: State, id: string, nowMs: number): State {
  const f = findItem(s, id)
  if (!f) return s
  const m = s.months[f.k]!
  return {
    ...s,
    months: { ...s.months, [f.k]: { ...m, p: (m.p ?? []).filter((x) => x.id !== id), u: nowMs } },
  }
}

/* ---------- Darstellung ---------- */

export const TYPES: Record<PlanType, { label: string; c: string }> = {
  block: { label: 'Block', c: '#71b2f4' },
  abgabe: { label: 'Abgabe', c: '#f6c6a0' },
  klausur: { label: 'Klausur', c: '#f2a9bd' },
  termin: { label: 'Sonstiges', c: '#8a8a8c' },
}

/** Block/Termin mit Start und Ende → im Zeitraster; alles andere in der Zeile „fällig“. */
export const isTimed = (it: PlanItem): boolean => (it.type === 'block' || it.type === 'termin') && !!it.t && !!it.e

/** Farbe: Fach, sonst Typ. */
export function itemColor(it: PlanItem, acts: Act[]): string {
  const a = it.act ? acts.find((x) => x.id === it.act) : undefined
  return a ? a.c : TYPES[it.type].c
}

const TYPE_RANK: Record<PlanType, number> = { klausur: 0, abgabe: 1, termin: 2, block: 3 }

/** Nach Datum + Uhrzeit (ohne Uhrzeit ans Tagesende), dann Klausur < Abgabe < Termin < Block. */
export function sortItems(arr: PlanItem[]): PlanItem[] {
  return arr
    .slice()
    .sort((a, b) => (a.d + (a.t ?? '99')).localeCompare(b.d + (b.t ?? '99')) || TYPE_RANK[a.type] - TYPE_RANK[b.type])
}

/** 'YYYY-MM-DD' → Einträge (unsortiert). */
export function planByDay(s: State): Record<string, PlanItem[]> {
  const m: Record<string, PlanItem[]> = {}
  for (const it of allPlan(s)) (m[it.d] ??= []).push(it)
  return m
}

/** Abgabe abhaken / wieder öffnen. */
export function toggleDone(s: State, id: string, nowMs: number): State {
  const f = findItem(s, id)
  if (!f) return s
  const { done, ...rest } = f.it
  return saveItem(s, done ? rest : { ...rest, done: true }, nowMs)
}

/** Zufällige Item-ID (wie Legacy: 'p' + Zeit + Zufall). */
export const newId = (nowMs: number = Date.now()): string => 'p' + nowMs.toString(36) + Math.random().toString(36).slice(2, 6)

/**
 * Entwurf für einen neuen Eintrag mit Typ-abhängigen Standardwerten:
 * Block/Termin 09:00 + 1 h, Abgabe fällig 23:59.
 */
export function newDraft(id: string, d: string, type: PlanType = 'block', t?: string, e?: string): PlanItem {
  const it: PlanItem = { id, type, title: '', d }
  if (type === 'block' || type === 'termin') {
    it.t = t ?? '09:00'
    it.e = e ?? fromMin((toMin(it.t) ?? 0) + 60)
  } else if (type === 'abgabe') it.t = t ?? '23:59'
  else if (t) it.t = t
  return it
}
