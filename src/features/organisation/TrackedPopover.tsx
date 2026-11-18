import { useLayoutEffect, useRef, useState, type SyntheticEvent } from 'react'
import { createPortal } from 'react-dom'
import { cx } from '../../components/cx.ts'
import { WEEKDAYS_SHORT } from '../../domain/summary.ts'
import { findTask } from '../../domain/tasks.ts'
import { fmt, hhmm } from '../../domain/time.ts'
import { deleteTracked, type Tracked } from '../../domain/tracked.ts'
import { stop } from '../../domain/tracker.ts'
import { useAppState, useDispatch } from '../../state/StoreProvider.tsx'
import styles from './TrackedPopover.module.css'

const W = 270
const wd = (sec: number) => WEEKDAYS_SHORT[new Date(sec * 1000).getDay()]
const sameDay = (a: number, b: number) => new Date(a * 1000).toDateString() === new Date(b * 1000).toDateString()

/** Zeitraum „Do 15:00 – 16:10“ bzw. über Mitternacht „Mi 23:40 – Do 00:20“. */
export function trackedRange(t: Pick<Tracked, 'start' | 'end' | 'live'>): string {
  const end = t.live ? 'jetzt' : sameDay(t.start, t.end) ? hhmm(t.end) : `${wd(t.end)} ${hhmm(t.end)}`
  return `${wd(t.start)} ${hhmm(t.start)} – ${end}`
}

/** Events aus der Karte nicht an den Kalender weiterreichen (React-Portale blubbern durch den Komponentenbaum). */
const swallow = (e: SyntheticEvent) => e.stopPropagation()

/**
 * Hover-Karte zu einem getrackten Block: Titel, Fach, Zeitraum und Dauer.
 * Beendet: löschen (mit Rückfrage). Läuft: stoppen. ↗ öffnet den Task.
 */
export function TrackedPopover({
  t,
  anchor,
  onEnter,
  onLeave,
  onClose,
  onOpenTask,
}: {
  t: Tracked
  anchor: HTMLElement
  onEnter: () => void
  onLeave: () => void
  onClose: () => void
  onOpenTask: (id: string) => void
}) {
  const state = useAppState()
  const dispatch = useDispatch()
  const ref = useRef<HTMLDivElement>(null)
  const [confirm, setConfirm] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const act = state.meta.acts.find((a) => a.id === t.a)
  const task = t.k ? findTask(state, t.k) : undefined
  const title = task?.title || act?.name || '—'

  // Rechts neben dem Block, sonst links; vertikal im Fenster halten.
  useLayoutEffect(() => {
    const r = anchor.getBoundingClientRect()
    const h = ref.current?.offsetHeight ?? 160
    const right = r.right + 8 + W <= window.innerWidth - 8
    const left = right ? r.right + 8 : Math.max(8, r.left - 8 - W)
    const top = Math.min(Math.max(8, r.top), window.innerHeight - h - 8)
    setPos((p) => (p && p.left === left && p.top === top ? p : { left, top }))
  })

  // Beim Scrollen (Kalender oder Seite) und mit Esc schließen.
  useLayoutEffect(() => {
    const close = (e: Event) => {
      if (!(e.target instanceof Node && ref.current?.contains(e.target))) onClose()
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('scroll', close, true)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('keydown', key)
    }
  }, [onClose])

  return createPortal(
    <div
      ref={ref}
      data-tracked-pop
      role="dialog"
      aria-label={`Getrackt: ${title}`}
      className={styles.pop}
      style={{ width: W, left: pos?.left ?? -9999, top: pos?.top ?? 0, visibility: pos ? 'visible' : 'hidden' }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onPointerDown={swallow}
      onMouseDown={swallow}
      onClick={swallow}
      onDoubleClick={swallow}
      onKeyDown={swallow}
    >
      <div className={styles.head}>
        <b>{title}</b>
        {task && (
          <button type="button" className={styles.open} aria-label="Task öffnen" title="Task öffnen" onClick={() => onOpenTask(task.id)}>
            ↗
          </button>
        )}
      </div>
      {act && task && (
        <span className={styles.chip} style={{ ['--c' as string]: act.c }}>
          {act.name}
        </span>
      )}
      <div className={cx(styles.time, t.live && styles.liveTime)}>
        {trackedRange(t)} · {fmt(t.end - t.start)}
      </div>
      <div className={styles.actions}>
        {t.live ? (
          <button type="button" className={styles.btn} onClick={() => dispatch((s, n) => stop(s, n))}>
            ■ Stoppen
          </button>
        ) : confirm ? (
          <>
            <button
              type="button"
              className={cx(styles.btn, styles.danger)}
              autoFocus
              onClick={() => {
                dispatch((s, n) => deleteTracked(s, t, n))
                onClose()
              }}
            >
              Wirklich löschen
            </button>
            <button type="button" className={styles.btn} onClick={() => setConfirm(false)}>
              Abbrechen
            </button>
          </>
        ) : (
          <button type="button" className={styles.btn} onClick={() => setConfirm(true)}>
            Löschen
          </button>
        )}
      </div>
    </div>,
    document.body,
  )
}
