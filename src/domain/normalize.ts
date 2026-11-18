/**
 * Macht aus unbekannten Daten (Backup-Datei, alte DB) einen gültigen State.
 * Fehlende Felder bekommen Standardwerte (wie in der Legacy-Datei). Unbekannte Felder
 * bleiben erhalten. Strukturell unbrauchbare Einzeleinträge werden verworfen und gezählt.
 */
import type { Act, LegacyExam, Meta, MonthDoc, PlanItem, PlanType, Run, Session, State, Task } from './types.ts'

type Rec = Record<string, unknown>
const isObj = (x: unknown): x is Rec => typeof x === 'object' && x !== null && !Array.isArray(x)
const isStr = (x: unknown): x is string => typeof x === 'string'
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

const DAY = /^\d{4}-\d{2}-\d{2}$/
const MONTH = /^\d{4}-\d{2}$/
const TYPES: readonly PlanType[] = ['block', 'abgabe', 'klausur', 'termin']

export type Normalized = { state: State; skipped: number }

/** Sieht das Objekt wie ein State aus? (gleiche Prüfung wie Legacy-Import) */
export function looksLikeState(x: unknown): x is Rec & { meta: Rec & { acts: unknown[] }; months: unknown } {
  return isObj(x) && isObj(x.meta) && Array.isArray(x.meta.acts) && isObj(x.months)
}

export function normalizeState(raw: unknown): Normalized | null {
  if (!looksLikeState(raw)) return null
  let skipped = 0
  const keep = <T>(ok: boolean, v: T): T[] => {
    if (ok) return [v]
    skipped++
    return []
  }

  const m = raw.meta
  const acts: Act[] = m.acts.flatMap((a) =>
    keep(isObj(a) && isStr(a.id) && isStr(a.name) && isStr(a.c), a as Act),
  )
  const run: Run | null =
    isObj(m.run) && isStr(m.run.a) && isNum(m.run.t) ? { ...(m.run as Run) } : null
  if (m.run != null && !run) skipped++
  if (run && 'k' in run && !isStr(run.k)) delete run.k

  const meta: Meta = {
    ...m,
    acts,
    run,
    last: isStr(m.last) ? m.last : null,
    u: isNum(m.u) ? m.u : 0,
  }
  if ('lk' in meta && !isStr(meta.lk)) delete meta.lk
  if ('exams' in m) {
    meta.exams = Array.isArray(m.exams)
      ? m.exams.flatMap((e) => keep(isObj(e) && isStr(e.id) && isStr(e.d), e as LegacyExam))
      : []
  }

  const months: Record<string, MonthDoc> = {}
  for (const [k, v] of Object.entries(raw.months as Rec)) {
    if (!MONTH.test(k) || !isObj(v)) {
      skipped++
      continue
    }
    const s: Session[] = (Array.isArray(v.s) ? v.s : []).flatMap((x: unknown) =>
      keep(
        Array.isArray(x) && x.length >= 3 && isStr(x[0]) && isNum(x[1]) && isNum(x[2]) && x[2] >= x[1],
        Array.isArray(x) ? (isStr(x[3]) ? [x[0], x[1], x[2], x[3]] : [x[0], x[1], x[2]]) as Session : (['', 0, 0] as Session),
      ),
    )
    const doc: MonthDoc = { ...v, s, u: isNum(v.u) ? v.u : 0 }
    if ('p' in v) {
      doc.p = (Array.isArray(v.p) ? v.p : []).flatMap((x: unknown) =>
        keep(
          isObj(x) && isStr(x.id) && TYPES.includes(x.type as PlanType) && isStr(x.d) && DAY.test(x.d),
          { ...(x as PlanItem), title: isObj(x) && isStr(x.title) ? x.title : '' },
        ),
      )
    }
    if ('k' in v) {
      doc.k = (Array.isArray(v.k) ? v.k : []).flatMap((x: unknown, i: number) =>
        keep(isObj(x) && isStr(x.id) && isStr(x.d) && DAY.test(x.d), {
          ...(x as Task),
          title: isObj(x) && isStr(x.title) ? x.title : '',
          o: isObj(x) && isNum(x.o) ? x.o : i,
        }),
      )
    }
    months[k] = doc
  }

  return { state: { meta, months }, skipped }
}
