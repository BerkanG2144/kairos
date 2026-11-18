/**
 * Tracker-Aktionen als reine Funktionen: (State, …, nowMs) → neuer State.
 * Der Eingabe-State wird nie verändert.
 */
import { ACT_NAME_MAX, COLORS, PAUSE } from './constants.ts'
import { monthKeyOfSec } from './time.ts'
import type { Act, ActId, Meta, State } from './types.ts'

const sec = (ms: number) => Math.floor(ms / 1000)

const withMeta = (s: State, patch: Partial<Meta>, nowMs: number): State => ({
  ...s,
  meta: { ...s.meta, ...patch, u: nowMs },
})

export const actById = (s: State, id: ActId | null): Act | undefined =>
  id == null ? undefined : s.meta.acts.find((a) => a.id === id)

/**
 * Beendet den laufenden Timer zum Zeitpunkt `at` (s). Die Session landet im Monat
 * ihres Starts. Sessions < 1 s werden verworfen.
 */
export function endRun(s: State, at: number, nowMs: number): State {
  const r = s.meta.run
  if (!r) return s
  const end = Math.max(r.t, at)
  let months = s.months
  if (end - r.t >= 1) {
    const k = monthKeyOfSec(r.t)
    const doc = months[k] ?? { s: [], u: 0 }
    months = { ...months, [k]: { ...doc, s: [...doc.s, [r.a, r.t, end]], u: nowMs } }
  }
  return { months, meta: { ...s.meta, run: null, u: nowMs } }
}

/** Startet Fach oder Pause; ein laufender Timer wird vorher beendet. */
export function start(s: State, a: ActId, nowMs: number): State {
  const t = sec(nowMs)
  const ended = endRun(s, t, nowMs)
  return withMeta(ended, { run: { a, t }, ...(a !== PAUSE ? { last: a } : {}) }, nowMs)
}

export function stop(s: State, nowMs: number): State {
  return withMeta(endRun(s, sec(nowMs), nowMs), {}, nowMs)
}

/** Stoppt rückwirkend zum Zeitpunkt `at` (s) – für die Lücken-Erkennung. */
export function stopAt(s: State, at: number, nowMs: number): State {
  return withMeta(endRun(s, at, nowMs), {}, nowMs)
}

/** Klick auf ein Fach: laufendes stoppen, sonst starten bzw. wechseln. */
export function clickAct(s: State, id: ActId, nowMs: number): State {
  return s.meta.run?.a === id ? stop(s, nowMs) : start(s, id, nowMs)
}

/** Pause-Button: Pause starten bzw. „Weiter“ mit dem letzten Fach. */
export function clickPause(s: State, nowMs: number): State {
  if (s.meta.run?.a === PAUSE) {
    const last = actById(s, s.meta.last)
    return last && !last.del ? start(s, last.id, nowMs) : stop(s, nowMs)
  }
  return start(s, PAUSE, nowMs)
}

/**
 * Neues Fach. Gleicher Name (ohne Groß/Klein) wie ein vorhandenes → nichts,
 * bzw. ein gelöschtes wird reaktiviert. Farbe = erste unbenutzte der Palette.
 */
export function addAct(s: State, rawName: string, nowMs: number): State {
  const name = rawName.trim().slice(0, ACT_NAME_MAX)
  if (!name) return s
  const same = s.meta.acts.find((a) => a.name.toLowerCase() === name.toLowerCase())
  if (same) {
    if (!same.del) return s
    const acts = s.meta.acts.map((a) => {
      if (a !== same) return a
      const { del: _del, ...rest } = a
      return rest
    })
    return withMeta(s, { acts }, nowMs)
  }
  const used = new Set(s.meta.acts.filter((a) => !a.del).map((a) => a.c))
  const c = COLORS.find((x) => !used.has(x)) ?? COLORS[s.meta.acts.length % COLORS.length]!
  let id = 'a' + nowMs.toString(36)
  while (s.meta.acts.some((a) => a.id === id)) id += 'x'
  return withMeta(s, { acts: [...s.meta.acts, { id, name, c }] }, nowMs)
}

/** Soft delete. Läuft das Fach gerade, wird der Timer beendet. */
export function delAct(s: State, id: ActId, nowMs: number): State {
  if (!actById(s, id)) return s
  const base = s.meta.run?.a === id ? endRun(s, sec(nowMs), nowMs) : s
  const acts = base.meta.acts.map((a): Act => (a.id === id ? { ...a, del: true } : a))
  return withMeta(base, { acts }, nowMs)
}

/** Aktive (nicht gelöschte) Fächer. */
export const activeActs = (s: State): Act[] => s.meta.acts.filter((a) => !a.del)
