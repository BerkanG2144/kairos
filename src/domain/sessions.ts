import { PAUSE } from './constants.ts'
import { dayKey } from './time.ts'
import type { ActId, ByDay, DayTotals, State } from './types.ts'

/**
 * Verteilt eine Zeitspanne auf lokale Kalendertage (Schnitt an Mitternacht).
 * Mutiert `out`.
 */
export function addSpan(out: ByDay, a: ActId, t0: number, t1: number): void {
  let cur = t0
  while (cur < t1) {
    const d = new Date(cur * 1000)
    const next = Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime() / 1000)
    const seg = Math.min(t1, next) - cur
    const k = dayKey(d)
    const m = (out[k] ??= {})
    m[a] = (m[a] ?? 0) + seg
    cur = next
  }
}

/**
 * Sekunden pro Tag und Fach über alle Sessions, inklusive laufendem Timer bis `now`.
 * Sessions über Mitternacht werden aufgeteilt.
 */
export function byDay(state: State, now: number): ByDay {
  const out: ByDay = {}
  for (const k in state.months) {
    for (const [a, t0, t1] of state.months[k]?.s ?? []) addSpan(out, a, t0, t1)
  }
  const r = state.meta.run
  if (r) addSpan(out, r.a, r.t, Math.max(r.t, now))
  return out
}

/** Lernzeit (ohne Pause) eines Tages. */
export function learned(m: DayTotals | undefined): number {
  let s = 0
  if (!m) return s
  for (const a in m) if (a !== PAUSE) s += m[a] ?? 0
  return s
}
