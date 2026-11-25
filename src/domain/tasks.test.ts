import { describe, expect, it } from 'vitest'
import { normalizeState } from './normalize.ts'
import { emptyState } from './state.ts'
import {
  addTask,
  allTasks,
  canStart,
  deleteTask,
  findTask,
  minDropIndex,
  moveOpenTask,
  moveTask,
  rollover,
  runningTask,
  taskTimes,
  tasksByDay,
  tasksOn,
  toggleTaskDone,
  toggleTaskTimer,
  updateTask,
} from './tasks.ts'
import { addAct, clickAct, clickPause, delAct, stop } from './tracker.ts'
import type { State } from './types.ts'

const T0 = new Date('2026-11-18T10:00:00').getTime()
const ms = (min: number) => T0 + min * 60_000
const sec = (min: number) => Math.floor(ms(min) / 1000)
const titles = (s: State, day: string) => tasksOn(s, day).map((t) => t.title)

/** Fächer Mathe (a1) + Physik (a2) und Tasks am 18.11. */
function base(...names: string[]): State {
  let s = addAct(addAct(emptyState(), 'Mathe', 1000), 'Physik', 2000)
  names.forEach((n, i) => (s = addTask(s, n, '2026-11-18', T0, { id: 't' + (i + 1) })))
  return s
}
const act = (s: State, name: string) => s.meta.acts.find((a) => a.name === name)!.id

describe('Tasks anlegen', () => {
  it('hängt ans Ende des Tages, im Monatsdokument des Tages', () => {
    const s = base('A', 'B')
    expect(titles(s, '2026-11-18')).toEqual(['A', 'B'])
    expect(s.months['2026-11']!.k!.map((t) => t.o)).toEqual([0, 1])
  })

  it('trimmt, ignoriert leere Titel, merkt das Fach', () => {
    const s0 = base()
    expect(addTask(s0, '   ', '2026-11-18', T0)).toBe(s0)
    const s = addTask(s0, '  Blatt 3 ', '2026-12-01', T0, { act: act(s0, 'Mathe'), id: 'x' })
    expect(findTask(s, 'x')).toMatchObject({ title: 'Blatt 3', d: '2026-12-01', act: act(s0, 'Mathe'), o: 0 })
    expect(s.months['2026-12']!.k).toHaveLength(1)
  })
})

describe('Oben einfügen und Reihenfolge nur unter offenen (Home)', () => {
  it('top: neuer Task steht ganz oben', () => {
    let s = base('A', 'B')
    s = addTask(s, 'Neu', '2026-11-18', T0, { top: true })
    expect(titles(s, '2026-11-18')).toEqual(['Neu', 'A', 'B'])
    s = addTask(emptyState(), 'X', '2026-11-18', T0, { top: true })
    expect(titles(s, '2026-11-18')).toEqual(['X'])
  })

  it('moveOpenTask zählt erledigte nicht mit', () => {
    // Reihenfolge: A(erledigt) B C(erledigt) D
    let s = base('A', 'B', 'C', 'D')
    s = toggleTaskDone(toggleTaskDone(s, 't1', T0), 't3', T0)
    const open = (st: State) => tasksOn(st, '2026-11-18').filter((t) => !t.done).map((t) => t.title)
    expect(open(moveOpenTask(s, 't4', '2026-11-18', 0, T0))).toEqual(['D', 'B'])
    expect(open(moveOpenTask(s, 't2', '2026-11-18', 1, T0))).toEqual(['D', 'B'])
    expect(open(moveOpenTask(s, 't2', '2026-11-18', 9, T0))).toEqual(['D', 'B'])
    expect(open(moveOpenTask(s, 't2', '2026-11-18', 0, T0))).toEqual(['B', 'D'])
    // nur erledigte vorhanden → an den Anfang
    let e = base('A')
    e = toggleTaskDone(e, 't1', T0)
    e = addTask(e, 'X', '2026-11-19', T0, { id: 'x' })
    e = moveOpenTask(e, 'x', '2026-11-18', 0, T0)
    expect(titles(e, '2026-11-18')).toEqual(['X', 'A'])
  })
})

describe('Verschieben', () => {
  it('innerhalb des Tages umsortieren', () => {
    let s = base('A', 'B', 'C')
    s = moveTask(s, 't3', '2026-11-18', 0, T0)
    expect(titles(s, '2026-11-18')).toEqual(['C', 'A', 'B'])
    s = moveTask(s, 't3', '2026-11-18', 2, T0)
    expect(titles(s, '2026-11-18')).toEqual(['A', 'B', 'C'])
    expect(tasksOn(s, '2026-11-18').map((t) => t.o)).toEqual([0, 1, 2])
  })

  it('an einen anderen Tag (auch über die Monatsgrenze), an die gewünschte Stelle', () => {
    let s = base('A', 'B')
    s = addTask(s, 'X', '2026-12-01', T0, { id: 'tx' })
    s = moveTask(s, 't1', '2026-12-01', 0, T0)
    expect(titles(s, '2026-11-18')).toEqual(['B'])
    expect(titles(s, '2026-12-01')).toEqual(['A', 'X'])
    expect(s.months['2026-11']!.k!.map((t) => t.id)).toEqual(['t2'])
  })

  it('gleiche Stelle → unverändert (kein Speichern)', () => {
    const s = base('A', 'B')
    expect(moveTask(s, 't2', '2026-11-18', 1, T0)).toBe(s)
    expect(moveTask(s, 't2', '2026-11-18', 99, T0)).toBe(s)
    expect(moveTask(s, 'gibts-nicht', '2026-11-18', 0, T0)).toBe(s)
  })
})

describe('Bearbeiten, abhaken, löschen', () => {
  it('Titel/Fach/Tag ändern; neuer Tag → ans Ende', () => {
    let s = base('A', 'B')
    s = addTask(s, 'Z', '2026-11-19', T0, { id: 'tz' })
    s = updateTask(s, 't1', { title: 'A2', act: act(s, 'Mathe'), d: '2026-11-19' }, T0)
    expect(titles(s, '2026-11-19')).toEqual(['Z', 'A2'])
    expect(findTask(s, 't1')!.act).toBe(act(s, 'Mathe'))
    s = updateTask(s, 't1', { act: null }, T0)
    expect(findTask(s, 't1')!.act).toBeUndefined()
    expect(updateTask(s, 't1', { title: '  ' }, T0)).toBe(s)
  })

  it('abhaken stoppt den eigenen Timer; wieder öffnen', () => {
    let s = base('A')
    s = updateTask(s, 't1', { act: act(s, 'Mathe') }, T0)
    s = toggleTaskTimer(s, 't1', ms(0))
    s = toggleTaskDone(s, 't1', ms(10))
    expect(s.meta.run).toBeNull()
    expect(findTask(s, 't1')!.done).toBe(true)
    s = toggleTaskDone(s, 't1', ms(11))
    expect(findTask(s, 't1')!.done).toBeUndefined()
  })

  it('löschen stoppt den Timer, die Zeit bleibt als Session', () => {
    let s = base('A')
    s = toggleTaskTimer(s, 't1', ms(0), act(s, 'Mathe'))
    s = deleteTask(s, 't1', ms(5))
    expect(allTasks(s)).toHaveLength(0)
    expect(s.meta.run).toBeNull()
    expect(s.months['2026-11']!.s).toEqual([[act(s, 'Mathe'), sec(0), sec(5), 't1']])
  })
})

describe('Timer am Task', () => {
  it('▶ ohne Fach geht nicht; mit gewähltem Fach wird es gesetzt und gestartet', () => {
    let s = base('A')
    expect(canStart(s, findTask(s, 't1')!)).toBe(false)
    expect(toggleTaskTimer(s, 't1', ms(0))).toBe(s)
    s = toggleTaskTimer(s, 't1', ms(0), act(s, 'Physik'))
    expect(s.meta.run).toEqual({ a: act(s, 'Physik'), t: sec(0), k: 't1' })
    expect(findTask(s, 't1')!.act).toBe(act(s, 'Physik'))
    expect(runningTask(s)).toBe('t1')
  })

  it('■ stoppt; Session trägt die Task-ID; Zeit je Task inkl. laufendem Timer', () => {
    let s = base('A', 'B')
    s = toggleTaskTimer(s, 't1', ms(0), act(s, 'Mathe'))
    s = toggleTaskTimer(s, 't2', ms(20), act(s, 'Physik')) // wechselt direkt
    expect(s.months['2026-11']!.s).toEqual([[act(s, 'Mathe'), sec(0), sec(20), 't1']])
    expect(taskTimes(s, sec(30))).toEqual({ t1: 1200, t2: 600 })
    s = toggleTaskTimer(s, 't2', ms(30))
    expect(s.meta.run).toBeNull()
    expect(taskTimes(s, sec(99))).toEqual({ t1: 1200, t2: 600 })
  })

  it('unter 5 min gestoppt zählt nicht zur Task-Zeit; laufend schon', () => {
    let s = base('A')
    s = toggleTaskTimer(s, 't1', ms(0), act(s, 'Mathe'))
    expect(taskTimes(s, sec(3))).toEqual({ t1: 180 })
    s = toggleTaskTimer(s, 't1', ms(3))
    expect(taskTimes(s, sec(10))).toEqual({})
  })

  it('Fach im Tracker anklicken beendet den Task-Bezug', () => {
    let s = base('A')
    s = toggleTaskTimer(s, 't1', ms(0), act(s, 'Mathe'))
    s = clickAct(s, act(s, 'Physik'), ms(5))
    expect(s.meta.run).toEqual({ a: act(s, 'Physik'), t: sec(5) })
    expect(runningTask(s)).toBeNull()
    expect(s.meta.lk).toBeUndefined()
  })

  it('Pause → Weiter setzt den Task fort', () => {
    let s = base('A')
    s = toggleTaskTimer(s, 't1', ms(0), act(s, 'Mathe'))
    s = clickPause(s, ms(10))
    expect(runningTask(s)).toBeNull()
    expect(taskTimes(s, sec(15))).toEqual({ t1: 600 })
    s = clickPause(s, ms(15))
    expect(s.meta.run).toEqual({ a: act(s, 'Mathe'), t: sec(15), k: 't1' })
    s = stop(s, ms(20))
    expect(taskTimes(s, sec(99))).toEqual({ t1: 900 })
  })

  it('Weiter ohne Task-Bezug, wenn der Task inzwischen erledigt ist', () => {
    let s = base('A')
    s = toggleTaskTimer(s, 't1', ms(0), act(s, 'Mathe'))
    s = clickPause(s, ms(10))
    s = toggleTaskDone(s, 't1', ms(11))
    s = clickPause(s, ms(12))
    expect(s.meta.run).toEqual({ a: act(s, 'Mathe'), t: sec(12) })
  })

  it('Fach eines laufenden Tasks ändern → Timer läuft mit neuem Fach weiter', () => {
    let s = base('A')
    s = toggleTaskTimer(s, 't1', ms(0), act(s, 'Mathe'))
    s = updateTask(s, 't1', { act: act(s, 'Physik') }, ms(10))
    expect(s.meta.run).toEqual({ a: act(s, 'Physik'), t: sec(10), k: 't1' })
    expect(taskTimes(s, sec(15))).toEqual({ t1: 900 })
  })

  it('gelöschtes Fach → Task braucht ein neues Fach', () => {
    let s = base('A')
    s = updateTask(s, 't1', { act: act(s, 'Mathe') }, T0)
    s = delAct(s, act(s, 'Mathe'), T0)
    expect(canStart(s, findTask(s, 't1')!)).toBe(false)
    expect(toggleTaskTimer(s, 't1', ms(0))).toBe(s)
  })
})

describe('Abhaken sortiert', () => {
  it('erledigt → ans Ende des Tages; wieder öffnen → hinter den letzten offenen', () => {
    let s = base('A', 'B', 'C', 'D')
    s = toggleTaskDone(s, 't1', T0)
    expect(titles(s, '2026-11-18')).toEqual(['B', 'C', 'D', 'A'])
    s = toggleTaskDone(s, 't3', T0)
    expect(titles(s, '2026-11-18')).toEqual(['B', 'D', 'A', 'C'])
    s = toggleTaskDone(s, 't1', T0)
    expect(titles(s, '2026-11-18')).toEqual(['B', 'D', 'A', 'C'])
    expect(findTask(s, 't1')!.done).toBeUndefined()
    s = toggleTaskDone(s, 't3', T0)
    expect(titles(s, '2026-11-18')).toEqual(['B', 'D', 'A', 'C'])
    s = toggleTaskDone(s, 't2', T0)
    expect(titles(s, '2026-11-18')).toEqual(['D', 'A', 'C', 'B'])
  })
})

describe('Laufender Task ist oben fix', () => {
  it('Start schiebt den Task an die erste Stelle seines Tages', () => {
    let s = base('A', 'B', 'C')
    s = toggleTaskTimer(s, 't3', ms(0), act(s, 'Mathe'))
    expect(titles(s, '2026-11-18')).toEqual(['C', 'A', 'B'])
    expect(runningTask(s)).toBe('t3')
  })

  it('bleibt oben: neuer Task „oben“, Pause → Weiter, Rollover', () => {
    let s = base('A', 'B', 'C')
    s = toggleTaskTimer(s, 't2', ms(0), act(s, 'Mathe'))
    s = addTask(s, 'Neu', '2026-11-18', ms(1), { top: true, id: 'tn' })
    expect(titles(s, '2026-11-18')).toEqual(['B', 'Neu', 'A', 'C'])
    // Pause: B ist frei, C wird darüber gezogen; Weiter → B wieder oben
    s = clickPause(s, ms(2))
    s = moveTask(s, 't3', '2026-11-18', 0, ms(2))
    expect(titles(s, '2026-11-18')[0]).toBe('C')
    s = clickPause(s, ms(3))
    expect(runningTask(s)).toBe('t2')
    expect(titles(s, '2026-11-18')[0]).toBe('B')
    // Rollover: offene von gestern kommen nach oben – aber unter den laufenden
    s = addTask(s, 'Gestern', '2026-11-17', ms(3), { id: 'tg' })
    s = rollover(s, '2026-11-18', ms(4))
    expect(titles(s, '2026-11-18').slice(0, 2)).toEqual(['B', 'Gestern'])
    // Ablegen ganz oben landet direkt unter dem laufenden
    s = moveTask(s, 't1', '2026-11-18', minDropIndex(s, '2026-11-18'), ms(5))
    expect(titles(s, '2026-11-18').slice(0, 2)).toEqual(['B', 'A'])
  })

  it('minDropIndex: am Tag des laufenden Tasks erst ab Position 1, sonst 0; Pause hebt es auf', () => {
    let s = base('A', 'B')
    expect(minDropIndex(s, '2026-11-18')).toBe(0)
    s = toggleTaskTimer(s, 't2', ms(0), act(s, 'Mathe'))
    expect(minDropIndex(s, '2026-11-18')).toBe(1)
    expect(minDropIndex(s, '2026-11-19')).toBe(0)
    s = clickPause(s, ms(5))
    expect(minDropIndex(s, '2026-11-18')).toBe(0)
  })
})

describe('Offene Tasks wandern nach heute', () => {
  it('unerledigte vergangene Tasks kommen oben in heute, älteste zuerst; erledigte bleiben', () => {
    let s = emptyState()
    s = addTask(s, 'Mo offen', '2026-11-16', T0, { id: 'm1' })
    s = addTask(s, 'Mo erledigt', '2026-11-16', T0, { id: 'm2' })
    s = addTask(s, 'Di offen', '2026-11-17', T0, { id: 'd1' })
    s = addTask(s, 'Okt offen', '2026-10-30', T0, { id: 'o1' })
    s = addTask(s, 'Heute', '2026-11-18', T0, { id: 'h1' })
    s = addTask(s, 'Morgen', '2026-11-19', T0, { id: 'f1' })
    s = toggleTaskDone(s, 'm2', T0)
    s = rollover(s, '2026-11-18', T0)
    expect(titles(s, '2026-11-18')).toEqual(['Okt offen', 'Mo offen', 'Di offen', 'Heute'])
    expect(titles(s, '2026-11-16')).toEqual(['Mo erledigt'])
    expect(titles(s, '2026-11-19')).toEqual(['Morgen'])
    expect(s.months['2026-10']!.k).toEqual([])
  })

  it('Task-Zeit zählt nur am Tag des Tasks: nach dem Rollover startet sie bei 0', () => {
    let s = base('Analysis') // t1 am 18.11.
    s = toggleTaskTimer(s, 't1', ms(60), act(s, 'Mathe')) // 11:00
    s = toggleTaskTimer(s, 't1', ms(111)) // 11:51 → 51 min
    expect(taskTimes(s, sec(120))).toEqual({ t1: 51 * 60 })
    const tomorrow = ms(24 * 60) // 19.11., 10:00
    s = rollover(s, '2026-11-19', tomorrow)
    expect(tasksOn(s, '2026-11-19').map((t) => t.id)).toEqual(['t1'])
    expect(taskTimes(s, Math.floor(tomorrow / 1000))).toEqual({})
    s = toggleTaskTimer(s, 't1', tomorrow, act(s, 'Mathe'))
    expect(taskTimes(s, Math.floor(tomorrow / 1000) + 600)).toEqual({ t1: 600 })
  })

  it('Session über Mitternacht: nur der Teil am Tag des Tasks zählt', () => {
    let s = base('Nacht') // t1 am 18.11.
    const late = new Date('2026-11-18T23:30:00').getTime()
    s = toggleTaskTimer(s, 't1', late, act(s, 'Mathe'))
    s = toggleTaskTimer(s, 't1', late + 60 * 60_000) // bis 00:30
    expect(taskTimes(s, Math.floor(late / 1000) + 7200)).toEqual({ t1: 30 * 60 })
  })

  it('nichts zu tun → gleicher State', () => {
    const s = base('A')
    expect(rollover(s, '2026-11-18', T0)).toBe(s)
  })
})

describe('Import', () => {
  it('behält Tasks, Task-IDs an Sessions und am Timer; verwirft kaputte Tasks', () => {
    const n = normalizeState({
      meta: { acts: [], run: { a: 'a', t: 5, k: 't1' }, last: 'a', u: 1, lk: 't1' },
      months: {
        '2026-11': {
          s: [['a', 1, 2, 't1'], ['a', 3, 4, 7], ['a', 5, 6]],
          k: [{ id: 't1', title: 'A', d: '2026-11-18', o: 0 }, { id: 't2', d: '2026-11-18' }, { id: 'x', title: 'kaputt' }, 'müll'],
          u: 1,
        },
      },
    })!
    const m = n.state.months['2026-11']!
    expect(m.s).toEqual([['a', 1, 2, 't1'], ['a', 3, 4], ['a', 5, 6]])
    expect(m.k).toEqual([
      { id: 't1', title: 'A', d: '2026-11-18', o: 0 },
      { id: 't2', title: '', d: '2026-11-18', o: 1 },
    ])
    expect(n.skipped).toBe(2)
    expect(n.state.meta.run).toEqual({ a: 'a', t: 5, k: 't1' })
    expect(n.state.meta.lk).toBe('t1')
  })

  it('tasksByDay gruppiert und sortiert', () => {
    let s = base('A', 'B')
    s = moveTask(s, 't2', '2026-11-18', 0, T0)
    s = addTask(s, 'C', '2026-11-20', T0)
    const g = tasksByDay(s)
    expect(Object.keys(g).sort()).toEqual(['2026-11-18', '2026-11-20'])
    expect(g['2026-11-18']!.map((t) => t.title)).toEqual(['B', 'A'])
  })
})
