import { useState, type FormEvent } from 'react'
import { cx } from '../../components/cx.ts'
import { Modal } from '../../components/Modal.tsx'
import ui from '../../components/ui.module.css'
import { deleteTask, TASK_TITLE_MAX, updateTask } from '../../domain/tasks.ts'
import { fmt } from '../../domain/time.ts'
import type { Task } from '../../domain/types.ts'
import { useAppState, useDispatch } from '../../state/StoreProvider.tsx'
import styles from './TaskEditor.module.css'

/** Task bearbeiten: Titel, Fach, Tag; löschen mit Rückfrage. */
export function TaskEditor({ task, time, onClose }: { task: Task; time: number; onClose: () => void }) {
  const state = useAppState()
  const dispatch = useDispatch()
  const [title, setTitle] = useState(task.title)
  const [act, setAct] = useState<string | undefined>(task.act)
  const [day, setDay] = useState(task.d)
  const [confirmDel, setConfirmDel] = useState(false)
  const acts = state.meta.acts.filter((a) => !a.del || a.id === task.act)

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    dispatch((s, n) => updateTask(s, task.id, { title, act: act ?? null, d: day || task.d }, n))
    onClose()
  }

  return (
    <Modal onClose={onClose} label="Task bearbeiten">
      <form className={styles.form} autoComplete="off" onSubmit={onSubmit}>
        <input
          className={styles.title}
          aria-label="Titel"
          maxLength={TASK_TITLE_MAX}
          value={title}
          autoFocus
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className={styles.f}>
          <span>Fach</span>
          <div className={styles.acts} role="radiogroup" aria-label="Fach">
            {acts.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={act === a.id}
                className={cx(styles.opt, act === a.id && styles.on)}
                onClick={() => setAct(a.id)}
              >
                <span className={ui.dot} style={{ background: a.c }} />
                {a.name}
              </button>
            ))}
            <button type="button" role="radio" aria-checked={!act} className={cx(styles.opt, !act && styles.on)} onClick={() => setAct(undefined)}>
              Kein Fach
            </button>
          </div>
        </div>
        <div className={styles.r2}>
          <label className={styles.f}>
            Tag
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
          </label>
          <div className={styles.f}>
            Gelernt
            <span className={styles.time}>{fmt(time)}</span>
          </div>
        </div>
        <div className={styles.actions}>
          {confirmDel ? (
            <>
              <span className={styles.ask}>Wirklich löschen?</span>
              <button
                type="button"
                className={cx(styles.btn, styles.dang)}
                onClick={() => {
                  dispatch((s, n) => deleteTask(s, task.id, n))
                  onClose()
                }}
              >
                Löschen
              </button>
              <button type="button" className={styles.btn} onClick={() => setConfirmDel(false)}>
                Nein
              </button>
            </>
          ) : (
            <button type="button" className={cx(styles.btn, styles.dang)} onClick={() => setConfirmDel(true)}>
              Löschen
            </button>
          )}
          <span className={styles.sp} />
          <button type="button" className={styles.btn} onClick={onClose}>
            Abbrechen
          </button>
          <button type="submit" className={cx(styles.btn, styles.pri)}>
            Speichern
          </button>
        </div>
      </form>
    </Modal>
  )
}
