/**
 * Plan-Items (Kalender-Einträge) liegen in den Monatsdokumenten: months['YYYY-MM'].p,
 * einsortiert nach ihrem Datum d. Alle Funktionen sind rein (State → State).
 */
import { monthKeyOfDay } from './time.ts'
import type { MonthDoc, PlanItem, State } from './types.ts'

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
