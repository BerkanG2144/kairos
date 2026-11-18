import { useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Check } from '../../components/Check.tsx'
import { cx, vars } from '../../components/cx.ts'
import ui from '../../components/ui.module.css'
import { clockStr, fmt } from '../../domain/time.ts'
import type { Act, Task } from '../../domain/types.ts'
import { ActMenu } from './ActMenu.tsx'
import styles from './TaskCard.module.css'

type Props = {
  task: Task
  act?: Act
  acts: Act[]
  /** gelernte Sekunden */
  time: number
  running: boolean
  onOpen: () => void
  onToggleDone: () => void
  /** ▶/■; act = vorher zuzuweisendes Fach */
  onTimer: (act?: string) => void
  onSetAct: (act: string | null) => void
  onPointerDown?: (e: ReactPointerEvent<HTMLElement>) => void
  /** mitlaufende Kopie beim Ziehen */
  ghost?: boolean
}

export function TaskCard({ task, act, acts, time, running, onOpen, onToggleDone, onTimer, onSetAct, onPointerDown, ghost }: Props) {
  const [menu, setMenu] = useState<{ el: HTMLElement; start: boolean } | null>(null)
  const usable = !!act && !act.del
  const color = act?.c ?? 'var(--line2)'

  return (
    <div
      className={cx(styles.card, running && styles.running, task.done && styles.done, ghost && styles.ghost)}
      style={vars({ '--c': color })}
      data-task={ghost ? undefined : task.id}
      onPointerDown={onPointerDown}
      onContextMenu={(e) => e.preventDefault()}
      onClick={onOpen}
    >
      <button type="button" className={styles.title} onClick={(e) => (e.stopPropagation(), onOpen())}>
        {task.title}
      </button>
      <div className={styles.row}>
        <span data-nodrag>
          <Check small on={!!task.done} color={act?.c ?? 'var(--mute)'} label={`${task.title} erledigt`} onToggle={onToggleDone} />
        </span>
        <button
          type="button"
          className={cx(styles.act, !act && styles.noAct)}
          data-nodrag
          title="Fach wählen"
          onClick={(e) => {
            e.stopPropagation()
            const el = e.currentTarget
            setMenu((m) => (m ? null : { el, start: false }))
          }}
        >
          {act ? <span className={ui.dot} style={{ background: act.c }} /> : <span className={styles.plus}>+</span>}
          {act ? act.name : 'Fach'}
        </button>
        <span className={styles.sp} />
        {time > 0 && (
          <span className={styles.time} data-testid="task-time">
            {running ? clockStr(time) : fmt(time)}
          </span>
        )}
        <button
          type="button"
          className={cx(styles.play, running && styles.playOn)}
          data-nodrag
          aria-label={running ? `${task.title} stoppen` : `${task.title} starten`}
          onClick={(e) => {
            e.stopPropagation()
            if (running || usable) onTimer()
            else {
              const el = e.currentTarget
              setMenu((m) => (m ? null : { el, start: true }))
            }
          }}
        >
          {running ? <span className={styles.sq} /> : <span className={styles.tri} />}
        </button>
      </div>
      {menu && (
        <ActMenu
          anchor={menu.el}
          acts={acts}
          current={task.act}
          title={menu.start ? 'Fach zum Starten' : 'Fach'}
          allowNone={!menu.start}
          onClose={() => setMenu(null)}
          onPick={(id) => {
            setMenu(null)
            if (menu.start && id) onTimer(id)
            else onSetAct(id)
          }}
        />
      )}
    </div>
  )
}
