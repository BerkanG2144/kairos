import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { cx } from '../../components/cx.ts'
import { Hours } from '../../components/Hours.tsx'
import ui from '../../components/ui.module.css'
import { MONTHS } from '../../domain/constants.ts'
import { byDay as sessionsByDay } from '../../domain/sessions.ts'
import { todayAndWeek, WEEKDAYS_SHORT } from '../../domain/summary.ts'
import { addTask, findTask, minDropIndex, moveTask, runningTask, taskTimes, tasksByDay, toggleTaskDone, toggleTaskTimer, updateTask } from '../../domain/tasks.ts'
import { addDays, dayKey, parseDayKey } from '../../domain/time.ts'
import { actById, activeActs } from '../../domain/tracker.ts'
import type { Task } from '../../domain/types.ts'
import { useAppState, useDispatch } from '../../state/StoreProvider.tsx'
import { useNow } from '../../state/useNow.ts'
import styles from './Plan.module.css'
import { TaskCard } from './TaskCard.tsx'
import { TaskEditor } from './TaskEditor.tsx'
import { useTaskDrag } from './useTaskDrag.ts'

const shift = (day: string, n: number) => dayKey(addDays(parseDayKey(day), n))
/** So viele Tage werden beim Scrollen an den Rändern nachgeladen. */
const CHUNK = 14

function daysBetween(from: string, to: string): string[] {
  const out: string[] = []
  for (let d = parseDayKey(from); dayKey(d) <= to; d = addDays(d, 1)) out.push(dayKey(d))
  return out
}

/** Abstand von Spalte zu Spalte (Breite + Lücke). */
function colStep(band: HTMLElement): number {
  const cols = band.querySelectorAll<HTMLElement>('[data-plan-day]')
  return cols.length > 1 ? cols[1]!.offsetLeft - cols[0]!.offsetLeft : 300
}

export function PlanPage() {
  const state = useAppState()
  const dispatch = useDispatch()
  const running = runningTask(state)
  const now = useNow(true, running ? 1000 : 30_000)
  const today = dayKey(new Date(now * 1000))
  const [range, setRange] = useState(() => ({ from: shift(today, -CHUNK), to: shift(today, 2 * CHUNK) }))
  const [month, setMonth] = useState(today)
  const [editing, setEditing] = useState<string | null>(null)
  const band = useRef<HTMLDivElement>(null)
  const prepended = useRef(0)

  const days = useMemo(() => daysBetween(range.from, range.to), [range])
  const byDay = useMemo(() => tasksByDay(state), [state])
  const times = useMemo(() => taskTimes(state, now), [state, now])
  const acts = activeActs(state)
  const week = useMemo(() => todayAndWeek(sessionsByDay(state, now), new Date(now * 1000)).week, [state, now])

  const { drag, onPointerDown, consumeClick } = useTaskDrag({
    band,
    canDrop: (d) => d >= today,
    minIndex: (d) => minDropIndex(state, d),
    onDrop: (id, d, i) => dispatch((s, n) => moveTask(s, id, d, i, n)),
  })

  // Über Mitternacht offen: heute muss im Band liegen.
  useEffect(() => {
    if (today > shift(range.to, -7)) setRange((r) => ({ ...r, to: shift(today, 2 * CHUNK) }))
  }, [today, range.to])

  /** Links steht vorgestern (Desktop) bzw. heute (schmaler Bildschirm) – so sieht man auch morgen. */
  const scrollToToday = useCallback(
    (smooth: boolean) => {
      const b = band.current
      if (!b) return
      const narrow = b.clientWidth < colStep(b) * 2.5
      const el = b.querySelector<HTMLElement>(`[data-plan-day="${narrow ? today : shift(today, -2)}"]`)
      if (el) b.scrollTo({ left: el.offsetLeft, behavior: smooth ? 'smooth' : 'auto' })
    },
    [today],
  )

  // Einmal beim Öffnen zu heute; Höhe des Bands bis zum Fensterrand.
  useLayoutEffect(() => {
    const b = band.current
    if (!b) return
    const fit = () => {
      b.style.height = `${Math.max(380, window.innerHeight - b.getBoundingClientRect().top - window.scrollY - 20)}px`
    }
    fit()
    scrollToToday(false)
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, []) // nur beim ersten Rendern

  // Links Tage angefügt → Scrollposition ausgleichen, damit nichts springt.
  useLayoutEffect(() => {
    const b = band.current
    if (!b || !prepended.current) return
    b.scrollLeft += prepended.current * colStep(b)
    prepended.current = 0
  }, [range.from])

  const onScroll = () => {
    const b = band.current
    if (!b) return
    const step = colStep(b)
    if (b.scrollLeft < step * 3 && !prepended.current) {
      prepended.current = CHUNK
      setRange((r) => ({ ...r, from: shift(r.from, -CHUNK) }))
    }
    if (b.scrollLeft + b.clientWidth > b.scrollWidth - step * 3) setRange((r) => ({ ...r, to: shift(r.to, CHUNK) }))
    const first = days[Math.min(days.length - 1, Math.round(b.scrollLeft / step))]
    if (first && first.slice(0, 7) !== month.slice(0, 7)) setMonth(first)
  }

  const open = (id: string) => {
    if (!consumeClick()) setEditing(id)
  }
  const editTask = editing ? findTask(state, editing) : null
  const m = parseDayKey(month)

  const card = (t: Task, ghost = false) => (
    <TaskCard
      key={t.id}
      task={t}
      act={actById(state, t.act ?? null)}
      acts={acts}
      time={times[t.id] ?? 0}
      running={running === t.id}
      ghost={ghost}
      onOpen={() => open(t.id)}
      onToggleDone={() => dispatch((s, n) => toggleTaskDone(s, t.id, n))}
      onTimer={(a) => dispatch((s, n) => toggleTaskTimer(s, t.id, n, a))}
      onSetAct={(a) => dispatch((s, n) => updateTask(s, t.id, { act: a }, n))}
      onPointerDown={ghost || running === t.id ? undefined : (e) => onPointerDown(e, t.id)}
    />
  )
  const dragged = drag ? findTask(state, drag.id) : null

  return (
    <main className={styles.page}>
      <div className={styles.head}>
        <div className={styles.headL}>
          <span className={ui.label}>Plan</span>
          <span className={styles.month} data-testid="plan-month">
            {MONTHS[m.getMonth()]} {m.getFullYear()}
          </span>
        </div>
        <div className={styles.headR}>
          <Hours sec={week} label="diese Woche" testId="plan-week" />
          <button type="button" className={styles.todayBtn} onClick={() => scrollToToday(true)}>
            Heute
          </button>
        </div>
      </div>

      <div ref={band} className={cx(styles.band, drag && styles.dragging)} onScroll={onScroll} data-testid="plan-band">
        {days.map((d) => {
          const past = d < today
          const date = parseDayKey(d)
          const list = byDay[d] ?? []
          const target = drag?.day === d
          const visible = drag ? list.filter((t) => t.id !== drag.id) : list
          return (
            <section
              key={d}
              className={cx(styles.col, past && styles.past, d === today && styles.today, target && styles.target)}
              data-plan-day={d}
              aria-label={`${WEEKDAYS_SHORT[date.getDay()]} ${date.getDate()}.${date.getMonth() + 1}.`}
            >
              <header className={styles.colHead}>
                <span className={styles.wd}>{WEEKDAYS_SHORT[date.getDay()]}</span>
                <span className={styles.dn}>{date.getDate()}</span>
                {d === today && <span className={styles.todayTag}>Heute</span>}
              </header>
              {!past && <AddTask day={d} />}
              <div className={styles.list} data-plan-list>
                {visible.map((t, i) => (
                  <div key={t.id} className={styles.slot}>
                    {target && drag.index === i && <div className={styles.drop} style={{ height: drag.h }} />}
                    {card(t)}
                  </div>
                ))}
                {target && drag.index >= visible.length && <div className={styles.drop} style={{ height: drag.h }} />}
              </div>
            </section>
          )
        })}
      </div>

      {drag && dragged && (
        <div className={styles.ghost} style={{ left: drag.x - drag.offX, top: drag.y - drag.offY, width: drag.w }} aria-hidden data-testid="task-ghost">
          {card(dragged, true)}
        </div>
      )}
      {editTask && <TaskEditor task={editTask} time={times[editTask.id] ?? 0} onClose={() => setEditing(null)} />}
    </main>
  )
}

function AddTask({ day }: { day: string }) {
  const dispatch = useDispatch()
  const [v, setV] = useState('')
  const date = parseDayKey(day)
  return (
    <form
      className={styles.add}
      onSubmit={(e) => {
        e.preventDefault()
        if (!v.trim()) return
        dispatch((s, n) => addTask(s, v, day, n))
        setV('')
      }}
    >
      <input
        value={v}
        maxLength={140}
        placeholder="Task hinzufügen…"
        aria-label={`Task hinzufügen am ${date.getDate()}.${date.getMonth() + 1}.`}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setV('')
            e.currentTarget.blur()
          }
        }}
      />
    </form>
  )
}
