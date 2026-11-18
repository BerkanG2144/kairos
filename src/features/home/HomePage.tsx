import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { cx } from '../../components/cx.ts'
import { Hours } from '../../components/Hours.tsx'
import ui from '../../components/ui.module.css'
import { planByDay } from '../../domain/plan.ts'
import { byDay } from '../../domain/sessions.ts'
import { longDayLabel, todayAndWeek } from '../../domain/summary.ts'
import { addTask, findTask, minDropIndex, moveOpenTask, runningTask, taskTimes, tasksOn, toggleTaskDone, toggleTaskTimer, updateTask } from '../../domain/tasks.ts'
import { dayKey } from '../../domain/time.ts'
import { actById, activeActs } from '../../domain/tracker.ts'
import type { Task } from '../../domain/types.ts'
import { useAppState, useDispatch } from '../../state/StoreProvider.tsx'
import { useNow } from '../../state/useNow.ts'
import { usePref } from '../../state/usePref.ts'
import { TaskCard } from '../plan/TaskCard.tsx'
import { TaskEditor } from '../plan/TaskEditor.tsx'
import { useFlip } from '../plan/useFlip.ts'
import { useTaskDrag } from '../plan/useTaskDrag.ts'
import { DayTimeline } from './DayTimeline.tsx'
import styles from './Home.module.css'

type Where = 'top' | 'bottom'
const isWhere = (x: unknown): x is Where => x === 'top' || x === 'bottom'
type DoneView = 'open' | 'closed'
const isDoneView = (x: unknown): x is DoneView => x === 'open' || x === 'closed'

export function HomePage() {
  const state = useAppState()
  const dispatch = useDispatch()
  const running = runningTask(state)
  const now = useNow(true, state.meta.run ? 1000 : 30_000)
  const today = new Date(now * 1000)
  const day = dayKey(today)
  const [where, setWhere] = usePref<Where>('lernzeit.homeAdd', 'top', isWhere)
  const [doneView, setDoneView] = usePref<DoneView>('lernzeit.homeDone', 'open', isDoneView)
  const [editing, setEditing] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const grid = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)

  const bd = useMemo(() => byDay(state, now), [state, now])
  const totals = todayAndWeek(bd, today)
  const tasks = tasksOn(state, day)
  const open = tasks.filter((t) => !t.done)
  const done = tasks.filter((t) => t.done)
  const times = useMemo(() => taskTimes(state, now), [state, now])
  const acts = activeActs(state)
  const items = useMemo(() => planByDay(state)[day] ?? [], [state, day])

  const { drag, onPointerDown, consumeClick } = useTaskDrag({
    band: list,
    canDrop: (d) => d === day,
    minIndex: (d) => minDropIndex(state, d),
    onDrop: (id, d, i) => dispatch((s, n) => moveOpenTask(s, id, d, i, n)),
  })

  useFlip(list, !drag)

  // Spalten reichen bis zum Fensterrand; Liste und Kalender scrollen für sich.
  useLayoutEffect(() => {
    const g = grid.current
    if (!g) return
    const fit = () => {
      g.style.height = `${Math.max(420, window.innerHeight - g.getBoundingClientRect().top - window.scrollY - 20)}px`
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  const card = (t: Task, opts: { ghost?: boolean; draggable?: boolean } = {}) => (
    <TaskCard
      key={t.id}
      task={t}
      act={actById(state, t.act ?? null)}
      acts={acts}
      time={times[t.id] ?? 0}
      running={running === t.id}
      ghost={opts.ghost}
      onOpen={() => {
        if (!consumeClick()) setEditing(t.id)
      }}
      onToggleDone={() => dispatch((s, n) => toggleTaskDone(s, t.id, n))}
      onTimer={(a) => dispatch((s, n) => toggleTaskTimer(s, t.id, n, a))}
      onSetAct={(a) => dispatch((s, n) => updateTask(s, t.id, { act: a }, n))}
      onPointerDown={opts.draggable && running !== t.id ? (e) => onPointerDown(e, t.id) : undefined}
    />
  )
  const visible = drag ? open.filter((t) => t.id !== drag.id) : open
  const target = drag?.day === day
  const dragged = drag ? findTask(state, drag.id) : null
  const editTask = editing ? findTask(state, editing) : null

  return (
    <main className={styles.page}>
      <div className={styles.head}>
        <h1 className={styles.date}>{longDayLabel(today)}</h1>
        <div>
          <Hours sec={totals.today} label="heute" testId="home-today" />
          <Hours sec={totals.week} label="diese Woche" small testId="home-week" />
        </div>
      </div>

      <div className={styles.grid} ref={grid}>
        <section className={styles.left} aria-label="Tasks heute">
          <div className={styles.bar}>
            <span className={ui.label}>Heute</span>
            <div className={ui.seg} role="radiogroup" aria-label="Neue Tasks einfügen">
              {(['top', 'bottom'] as const).map((w) => (
                <button key={w} type="button" role="radio" aria-checked={where === w} className={cx(where === w && ui.segOn)} onClick={() => setWhere(w)}>
                  {w === 'top' ? '↑ Oben' : '↓ Unten'}
                </button>
              ))}
            </div>
          </div>
          <form
            className={styles.add}
            onSubmit={(e) => {
              e.preventDefault()
              if (!title.trim()) return
              dispatch((s, n) => addTask(s, title, day, n, { top: where === 'top' }))
              setTitle('')
            }}
          >
            <input
              value={title}
              maxLength={140}
              placeholder="Task hinzufügen…"
              aria-label="Task für heute hinzufügen"
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setTitle('')
                  e.currentTarget.blur()
                }
              }}
            />
          </form>

          <div className={styles.list} ref={list} data-plan-list>
            <div className={styles.open} data-plan-day={day} data-testid="home-open">
              {visible.map((t, i) => (
                <div key={t.id} className={styles.slot}>
                  {target && drag.index === i && <div className={styles.drop} style={{ height: drag.h }} />}
                  {card(t, { draggable: true })}
                </div>
              ))}
              {target && drag.index >= visible.length && <div className={styles.drop} style={{ height: drag.h }} />}
              {!open.length && !drag && <div className={ui.empty}>{done.length ? 'Alles erledigt für heute.' : 'Noch keine Tasks für heute.'}</div>}
            </div>

            {done.length > 0 && (
              <>
                <button type="button" className={styles.doneHead} aria-expanded={doneView === 'open'} onClick={() => setDoneView(doneView === 'open' ? 'closed' : 'open')}>
                  <span>Erledigt · {done.length}</span>
                  <span className={styles.toggle}>{doneView === 'open' ? 'Einklappen ⌃' : 'Ausklappen ⌄'}</span>
                </button>
                {doneView === 'open' && (
                  <div className={styles.done} data-testid="home-done">
                    {done.map((t) => card(t))}
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        <section className={styles.right} aria-label="Kalender heute">
          <DayTimeline state={state} day={day} items={items} now={now} />
        </section>
      </div>

      {drag && dragged && (
        <div className={styles.ghost} style={{ left: drag.x - drag.offX, top: drag.y - drag.offY, width: drag.w }} aria-hidden data-testid="task-ghost">
          {card(dragged, { ghost: true })}
        </div>
      )}
      {editTask && <TaskEditor task={editTask} time={times[editTask.id] ?? 0} onClose={() => setEditing(null)} />}
    </main>
  )
}
