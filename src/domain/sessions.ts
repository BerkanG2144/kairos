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

/** Gleiches Fach (und gleicher Task) mit höchstens so viel Lücke gehört zu einem Block. */
export const MERGE_GAP_SEC = 60
/**
 * Beendete Blöcke unter dieser Dauer sind „Rauschen“ und zählen nirgends (Kalender, Stunden,
 * Statistik, Task-Zeiten). Gespeichert bleiben sie trotzdem. Ein laufender Block zählt immer.
 */
export const MIN_BLOCK_SEC = 5 * 60

/** Zusammenhängende Zeit eines Fachs (und Tasks): aus einer oder mehreren Sessions, ggf. inkl. laufendem Timer. */
export type Block = {
  a: ActId
  k?: string
  /** echte Zeitpunkte (s) */
  start: number
  end: number
  live: boolean
  /** die einzelnen Stücke [start, end] – für die Verteilung auf Tage */
  parts: [number, number][]
}

/**
 * Alle Sessions (inkl. Pausen und laufendem Timer bis `now`) als Blöcke, nach Start sortiert.
 * Zusammengefasst wird je Fach+Task, wenn die Lücke höchstens MERGE_GAP_SEC beträgt.
 */
export function blocks(state: State, now: number): Block[] {
  // byDay, Task-Zeiten und Kalender fragen pro Sekunde mit demselben (state, now) – einmal rechnen reicht.
  if (cache && cache.state === state && cache.now === now) return cache.out
  const out = computeBlocks(state, now)
  cache = { state, now, out }
  return out
}

let cache: { state: State; now: number; out: Block[] } | null = null

function computeBlocks(state: State, now: number): Block[] {
  const raw: { a: ActId; k?: string; t0: number; t1: number; live: boolean }[] = []
  for (const m in state.months)
    for (const [a, t0, t1, k] of state.months[m]?.s ?? []) raw.push({ a, ...(k ? { k } : {}), t0, t1, live: false })
  const r = state.meta.run
  if (r) raw.push({ a: r.a, ...(r.k ? { k: r.k } : {}), t0: r.t, t1: Math.max(r.t, now), live: true })
  raw.sort((x, y) => x.t0 - y.t0 || x.t1 - y.t1)

  const out: Block[] = []
  const open = new Map<string, Block>() // letzter Block je Fach+Task
  for (const x of raw) {
    const key = `${x.a}\u0000${x.k ?? ''}`
    const b = open.get(key)
    if (b && x.t0 - b.end <= MERGE_GAP_SEC) {
      b.end = Math.max(b.end, x.t1)
      b.live ||= x.live
      b.parts.push([x.t0, x.t1])
      continue
    }
    const nb: Block = { a: x.a, ...(x.k ? { k: x.k } : {}), start: x.t0, end: x.t1, live: x.live, parts: [[x.t0, x.t1]] }
    out.push(nb)
    open.set(key, nb)
  }
  return out
}

/** Zählt der Block (lang genug oder läuft gerade)? */
export const counts = (b: Block): boolean => b.live || b.end - b.start >= MIN_BLOCK_SEC

/** Nur die zählenden Blöcke. */
export const countedBlocks = (state: State, now: number): Block[] => blocks(state, now).filter(counts)

/**
 * Sekunden pro Tag und Fach (inkl. Pause), inklusive laufendem Timer bis `now`.
 * Sessions über Mitternacht werden aufgeteilt; Blöcke unter 5 min zählen nicht.
 */
export function byDay(state: State, now: number): ByDay {
  const out: ByDay = {}
  for (const b of countedBlocks(state, now)) for (const [t0, t1] of b.parts) addSpan(out, b.a, t0, t1)
  return out
}

/** Lernzeit (ohne Pause) eines Tages. */
export function learned(m: DayTotals | undefined): number {
  let s = 0
  if (!m) return s
  for (const a in m) if (a !== PAUSE) s += m[a] ?? 0
  return s
}
