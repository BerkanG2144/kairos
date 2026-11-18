/**
 * Schema-Versionen und Migrationen.
 *
 * Version 1 = Legacy-Datei (meta.exams möglich).
 * Version 2 = exams → Plan-Items vom Typ 'klausur'.
 *
 * Regeln: Jede Schemaänderung bekommt eine neue Version + Migration + Test.
 * Migrationen müssen idempotent sein und dürfen keine Daten verlieren.
 */
import { findItem, saveItem } from './plan.ts'
import type { PlanItem, State } from './types.ts'

export const SCHEMA_VERSION = 2

type Migration = { to: number; up: (s: State, nowMs: number) => State }

/** v1 → v2: meta.exams werden Klausur-Einträge im Kalender, danach wird exams entfernt. */
export function migrateExams(s: State, nowMs: number): State {
  if (!('exams' in s.meta)) return s
  let out = s
  for (const e of s.meta.exams ?? []) {
    if (!e?.d || findItem(out, e.id)) continue
    const it: PlanItem = { id: e.id, type: 'klausur', title: e.name || 'Klausur', d: e.d }
    if (e.t) it.t = e.t
    out = saveItem(out, it, nowMs)
  }
  const { exams: _exams, ...meta } = out.meta
  return { ...out, meta: { ...meta, u: nowMs } }
}

const MIGRATIONS: Migration[] = [{ to: 2, up: migrateExams }]

/** Bringt einen (normalisierten) State von Version `from` auf SCHEMA_VERSION. */
export function migrate(s: State, from: number, nowMs: number): State {
  let out = s
  for (const m of MIGRATIONS) if (m.to > from) out = m.up(out, nowMs)
  return out
}
