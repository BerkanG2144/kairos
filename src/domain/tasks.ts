/**
 * Tasks des Wochenplans (Schema v3). Sie liegen in den Monatsdokumenten:
 * months['YYYY-MM'].k, einsortiert nach ihrem Tag d; die Reihenfolge am Tag steht in o.
 * Alle Funktionen sind rein (State → State).
 */
import { PAUSE } from './constants.ts'
import { countedBlocks } from './sessions.ts'
import { monthKeyOfDay } from './time.ts'
import { actById, start, stop } from './tracker.ts'
import type { ActId, MonthDoc, State, Task } from './types.ts'

export const TASK_TITLE_MAX = 140

const byOrder = (a: Task, b: Task) => a.o - b.o || a.id.localeCompare(b.id)

export const newTaskId = (nowMs: number = Date.now()): string => 't' + nowMs.toString(36) + Math.random().toString(36).slice(2, 6)

export function allTasks(s: State): Task[] {
  const out: Task[] = []
  for (const k in s.months) {
    const arr = s.months[k]!.k
    if (arr) out.push(...arr)
  }
  return out
}

export function findTask(s: State, id: string): Task | null {
  for (const k in s.months) {
    const t = s.months[k]!.k?.find((x) => x.id === id)
    if (t) return t
  }
  return null
}

/** Tag → Tasks in Anzeige-Reihenfolge. */
export function tasksByDay(s: State): Record<string, Task[]> {
  const out: Record<string, Task[]> = {}
  for (const t of allTasks(s)) (out[t.d] ??= []).push(t)
  for (const d in out) out[d]!.sort(byOrder)
  return out
}

export const tasksOn = (s: State, day: string): Task[] =>
  (s.months[monthKeyOfDay(day)]?.k ?? []).filter((t) => t.d === day).sort(byOrder)

/** Schreibt Tasks (anlegen oder ersetzen, gleiche id). Wechselt der Tag den Monat, ziehen sie um. */
function putTasks(s: State, list: Task[], nowMs: number): State {
  if (!list.length) return s
  const ids = new Set(list.map((t) => t.id))
  const months = { ...s.months }
  for (const k in months) {
    const arr = months[k]!.k
    if (arr?.some((t) => ids.has(t.id))) months[k] = { ...months[k]!, k: arr.filter((t) => !ids.has(t.id)), u: nowMs }
  }
  for (const t of list) {
    const mk = monthKeyOfDay(t.d)
    const m: MonthDoc = months[mk] ?? { s: [], u: 0 }
    months[mk] = { ...m, k: [...(m.k ?? []), t], u: nowMs }
  }
  return { ...s, months }
}

/** Neuer Task am Ende des Tages (mit `top` ganz oben). Leerer Titel → unverändert. */
export function addTask(s: State, title: string, day: string, nowMs: number, opts: { act?: ActId; id?: string; top?: boolean } = {}): State {
  const t = title.trim().slice(0, TASK_TITLE_MAX)
  if (!t) return s
  const list = tasksOn(s, day)
  const o = opts.top ? (list[0]?.o ?? 1) - 1 : (list.at(-1)?.o ?? -1) + 1
  const task: Task = { id: opts.id ?? newTaskId(nowMs), title: t, d: day, o }
  if (opts.act) task.act = opts.act
  return putTasks(s, [task], nowMs)
}

/**
 * Verschiebt einen Task an Position `index` des Tages `day` (auch an einen anderen Tag).
 * Die Tasks des Zieltags werden lückenlos neu nummeriert.
 */
export function moveTask(s: State, id: string, day: string, index: number, nowMs: number): State {
  const task = findTask(s, id)
  if (!task) return s
  const before = tasksOn(s, day)
  const list = before.filter((t) => t.id !== id)
  list.splice(Math.max(0, Math.min(index, list.length)), 0, task)
  if (task.d === day && list.every((t, i) => t === before[i])) return s
  const changed = list.flatMap((t, o) => (t.o === o && t.d === day ? [] : [{ ...t, o, d: day }]))
  return putTasks(s, changed, nowMs)
}

/**
 * Wie moveTask, aber `openIndex` zählt nur die offenen Tasks des Tages (Home zeigt
 * erledigte getrennt). Hinter den letzten offenen = openIndex ≥ Anzahl offener.
 */
export function moveOpenTask(s: State, id: string, day: string, openIndex: number, nowMs: number): State {
  const list = tasksOn(s, day).filter((t) => t.id !== id)
  const open = list.filter((t) => !t.done)
  const ref = open[openIndex]
  const lastOpen = open.at(-1)
  const index = ref ? list.indexOf(ref) : lastOpen ? list.indexOf(lastOpen) + 1 : 0
  return moveTask(s, id, day, index, nowMs)
}

export type TaskPatch = { title?: string; act?: ActId | null; d?: string }

/** Titel, Fach oder Tag ändern. Neuer Tag → ans Ende dieses Tages. Läuft der Task, wechselt der Timer mit dem Fach. */
export function updateTask(s: State, id: string, patch: TaskPatch, nowMs: number): State {
  const old = findTask(s, id)
  if (!old) return s
  let t: Task = { ...old }
  const title = patch.title?.trim().slice(0, TASK_TITLE_MAX)
  if (title) t.title = title
  if (patch.act === null) delete t.act
  else if (patch.act) t.act = patch.act
  if (patch.d && patch.d !== old.d) {
    const last = tasksOn(s, patch.d).at(-1)
    t = { ...t, d: patch.d, o: last ? last.o + 1 : 0 }
  }
  if (t.title === old.title && t.act === old.act && t.d === old.d) return s
  const out = putTasks(s, [t], nowMs)
  const a = actById(out, t.act ?? null)
  if (runningTask(out) === id && t.act !== old.act) return a && !a.del ? start(out, a.id, nowMs, id) : stop(out, nowMs)
  return out
}

/** Task löschen; läuft sein Timer, wird er vorher gestoppt. Die gelernte Zeit bleibt in der Statistik. */
export function deleteTask(s: State, id: string, nowMs: number): State {
  const t = findTask(s, id)
  if (!t) return s
  const base = runningTask(s) === id ? stop(s, nowMs) : s
  const mk = monthKeyOfDay(t.d)
  const m = base.months[mk]!
  return { ...base, months: { ...base.months, [mk]: { ...m, k: (m.k ?? []).filter((x) => x.id !== id), u: nowMs } } }
}

/**
 * Abhaken / wieder öffnen. Abgehakt wandert der Task ans Ende seines Tages (unter die
 * offenen), wieder geöffnet direkt hinter den letzten offenen. Abhaken stoppt seinen Timer.
 */
export function toggleTaskDone(s: State, id: string, nowMs: number): State {
  const t = findTask(s, id)
  if (!t) return s
  if (t.done) {
    const { done: _d, ...rest } = t
    const reopened = putTasks(s, [rest], nowMs)
    const others = tasksOn(reopened, t.d).filter((x) => x.id !== id)
    return moveOpenTask(reopened, id, t.d, others.filter((x) => !x.done).length, nowMs)
  }
  const base = runningTask(s) === id ? stop(s, nowMs) : s
  const done = putTasks(base, [{ ...t, done: true }], nowMs)
  return moveTask(done, id, t.d, Number.MAX_SAFE_INTEGER, nowMs)
}

/** ID des Tasks, dessen Timer gerade läuft (nicht während einer Pause). */
export const runningTask = (s: State): string | null => {
  const r = s.meta.run
  return r && r.a !== PAUSE ? (r.k ?? null) : null
}

/** Kann der Task direkt gestartet werden (hat er ein aktives Fach)? */
export function canStart(s: State, t: Task): boolean {
  const a = actById(s, t.act ?? null)
  return !!a && !a.del
}

/**
 * ▶/■ auf der Karte: läuft der Task, stoppen; sonst Timer für sein Fach starten.
 * Mit `act` wird ihm vorher dieses Fach zugewiesen (Task ohne Fach). Ein abgehakter Task wird wieder geöffnet.
 * Beim Start rückt der Task an die erste Stelle seines Tages (dort ist er fix, solange er läuft).
 */
export function toggleTaskTimer(s: State, id: string, nowMs: number, act?: ActId): State {
  const old = findTask(s, id)
  if (!old) return s
  if (runningTask(s) === id) return stop(s, nowMs)
  let t = old
  if (act) t = { ...t, act }
  if (t.done) {
    const { done: _d, ...rest } = t
    t = rest
  }
  const a = actById(s, t.act ?? null)
  if (!a || a.del) return s
  const base = t !== old ? putTasks(s, [t], nowMs) : s
  return start(moveTask(base, id, t.d, 0, nowMs), a.id, nowMs, id)
}

/** Kleinste erlaubte Ablageposition an einem Tag: hinter dem laufenden Task (der ist oben fix). */
export function minDropIndex(s: State, day: string): number {
  const id = runningTask(s)
  return id && findTask(s, id)?.d === day ? 1 : 0
}

/**
 * Offene Tasks vergangener Tage wandern an den Anfang von `today`
 * (älteste zuerst, Reihenfolge bleibt). Erledigte bleiben an ihrem Tag.
 */
export function rollover(s: State, today: string, nowMs: number): State {
  const late = allTasks(s)
    .filter((t) => !t.done && t.d < today)
    .sort((a, b) => a.d.localeCompare(b.d) || byOrder(a, b))
  if (!late.length) return s
  const list = [...late, ...tasksOn(s, today)].map((t, o) => ({ ...t, d: today, o }))
  return putTasks(s, list, nowMs)
}

/** Gelernte Sekunden je Task (inkl. laufendem Timer; Blöcke unter 5 min zählen nicht). */
export function taskTimes(s: State, nowSec: number): Record<string, number> {
  const out: Record<string, number> = {}
  for (const b of countedBlocks(s, nowSec)) {
    if (!b.k) continue
    for (const [t0, t1] of b.parts) out[b.k] = (out[b.k] ?? 0) + (t1 - t0)
  }
  return out
}
