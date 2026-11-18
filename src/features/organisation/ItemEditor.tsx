import { useRef, useState, type FormEvent } from 'react'
import { cx } from '../../components/cx.ts'
import { Modal } from '../../components/Modal.tsx'
import { Seg } from '../../components/Seg.tsx'
import {
  followingInSeries,
  formFromItem,
  isTimedType,
  itemFromForm,
  removeSeriesFrom,
  saveEdit,
  switchType,
  timeLabel,
  TITLE_PLACEHOLDER,
  type EditorForm,
} from '../../domain/editor.ts'
import { newId, removeItem, TYPES } from '../../domain/plan.ts'
import type { PlanItem, PlanType } from '../../domain/types.ts'
import { useAppState, useDispatch } from '../../state/StoreProvider.tsx'
import styles from './ItemEditor.module.css'

const TYPE_OPTIONS = (Object.keys(TYPES) as PlanType[]).map((t) => ({ value: t, label: TYPES[t].label }))

type Props = { it: PlanItem; isNew: boolean; onClose: () => void }

export function ItemEditor({ it, isNew, onClose }: Props) {
  const state = useAppState()
  const dispatch = useDispatch()
  const [f, setF] = useState<EditorForm>(() => formFromItem(it))
  const [confirmDel, setConfirmDel] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const acts = state.meta.acts.filter((a) => !a.del || a.id === it.act)
  const actName = acts.find((a) => a.id === f.act)?.name
  const set = (patch: Partial<EditorForm>) => setF((x) => ({ ...x, ...patch }))
  const following = isNew ? 0 : followingInSeries(state, it)

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const r = itemFromForm(it, f, state.meta.acts)
    if (!r.ok) {
      if (r.error === 'title') titleRef.current?.focus()
      return
    }
    dispatch((s, n) => saveEdit(s, r.it, f, isNew, n, () => newId(n)))
    onClose()
  }

  return (
    <Modal onClose={onClose} label={isNew ? 'Neuer Eintrag' : 'Eintrag bearbeiten'}>
      <form className={styles.form} autoComplete="off" onSubmit={onSubmit}>
        <Seg label="Typ" className={styles.seg} options={TYPE_OPTIONS} value={f.type} onChange={(t) => setF((x) => switchType(x, t))} />
        <input
          ref={titleRef}
          className={styles.title}
          maxLength={60}
          placeholder={!f.title.trim() && actName ? actName : TITLE_PLACEHOLDER[f.type]}
          aria-label="Titel"
          value={f.title}
          autoFocus={isNew}
          onChange={(e) => set({ title: e.target.value })}
        />
        <label className={styles.f}>
          Fach
          <select value={f.act} onChange={(e) => set({ act: e.target.value })}>
            <option value="">—</option>
            {acts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.r3}>
          <label className={styles.f}>
            Datum
            <input type="date" required value={f.d} onChange={(e) => set({ d: e.target.value })} />
          </label>
          <label className={styles.f}>
            {timeLabel(f.type)}
            <input type="time" value={f.t} onChange={(e) => set({ t: e.target.value })} />
          </label>
          {isTimedType(f.type) && (
            <label className={styles.f}>
              Bis
              <input type="time" value={f.e} onChange={(e) => set({ e: e.target.value })} />
            </label>
          )}
        </div>
        {isNew && (
          <div className={styles.rep}>
            <label className={styles.repCheck}>
              <input type="checkbox" checked={f.repeat} onChange={(e) => set({ repeat: e.target.checked })} />
              <span>Wöchentlich bis</span>
            </label>
            <input type="date" aria-label="Letzter Termin der Serie" value={f.until} onChange={(e) => set({ until: e.target.value })} />
          </div>
        )}
        <div className={styles.acts}>
          {!isNew &&
            (confirmDel ? (
              <>
                <button
                  type="button"
                  className={cx(styles.btn, styles.dang)}
                  onClick={() => {
                    dispatch((s, n) => removeItem(s, it.id, n))
                    onClose()
                  }}
                >
                  {following ? 'Nur diesen' : 'Wirklich löschen'}
                </button>
                {following > 0 && (
                  <button
                    type="button"
                    className={cx(styles.btn, styles.dang)}
                    onClick={() => {
                      dispatch((s, n) => removeSeriesFrom(s, it, n))
                      onClose()
                    }}
                  >
                    Alle folgenden
                  </button>
                )}
              </>
            ) : (
              <button type="button" className={cx(styles.btn, styles.dang)} onClick={() => setConfirmDel(true)}>
                Löschen
              </button>
            ))}
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
