import { useEffect, useRef, useState } from 'react'
import { cx, vars } from '../../components/cx.ts'
import { Modal } from '../../components/Modal.tsx'
import { examRows, pastExamRows } from '../../domain/exams.ts'
import { patchItem, setNotes } from '../../domain/notes.ts'
import { findItem, removeItem } from '../../domain/plan.ts'
import { useAppState, useDispatch } from '../../state/StoreProvider.tsx'
import { NOTE_ICONS, NoteIcon } from './icons.tsx'
import { NotesEditor } from './NotesEditor.tsx'
import styles from './ExamNotes.module.css'

type Props = { id: string; today: Date; onClose: () => void }

/** Notizseite einer Klausur (wie eine Notion-Seite): Icon, Titel, Eigenschaften, Notizen. */
export function ExamNotes({ id, today, onClose }: Props) {
  const state = useAppState()
  const dispatch = useDispatch()
  const it = findItem(state, id)?.it
  const [title, setTitle] = useState(it?.title ?? '')
  const [picker, setPicker] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  // Titel auch beim Schließen per Esc/Klick daneben speichern (dabei gibt es kein blur)
  const latest = useRef({ title, saved: it?.title ?? '' })
  latest.current = { title, saved: it?.title ?? '' }
  useEffect(
    () => () => {
      const t = latest.current.title.trim().slice(0, 60)
      if (t && t !== latest.current.saved) dispatch((s, n) => patchItem(s, id, { title: t }, n))
    },
    [dispatch, id],
  )

  // Gelöscht (auch in einem anderen Tab) → schließen
  useEffect(() => {
    if (!it) onClose()
  }, [it, onClose])

  useEffect(() => {
    if (!picker) return
    const off = (e: PointerEvent) => {
      if (!pickerRef.current?.contains(e.target as Node)) setPicker(false)
    }
    document.addEventListener('pointerdown', off)
    return () => document.removeEventListener('pointerdown', off)
  }, [picker])

  if (!it) return null

  const act = state.meta.acts.find((a) => a.id === it.act)
  const acts = state.meta.acts.filter((a) => !a.del || a.id === it.act)
  const color = act?.c ?? 'var(--mute)'
  const letter = (act?.name ?? it.title).slice(0, 1).toUpperCase()
  const row = examRows([it], today)[0] ?? pastExamRows([it], today)[0]!
  const countdown = row.n < 0 ? 'vorbei' : (row.word ?? `in ${row.n} Tagen`)
  const patch = (p: Parameters<typeof patchItem>[2]) => dispatch((s, n) => patchItem(s, id, p, n))

  const saveTitle = () => {
    const t = title.trim().slice(0, 60)
    if (!t) setTitle(it.title)
    else if (t !== it.title) patch({ title: t })
  }

  return (
    <Modal onClose={onClose} label={`Notizen: ${it.title}`} wide>
      <div className={styles.page} style={vars({ '--c': color, '--sticky-top': '46px' })}>
        <div className={styles.bar}>
          {confirmDel ? (
            <>
              <span className={styles.ask}>Klausur samt Notizen löschen?</span>
              <button
                type="button"
                className={cx(styles.barBtn, styles.dang)}
                onClick={() => {
                  dispatch((s, n) => removeItem(s, id, n))
                  onClose()
                }}
              >
                Löschen
              </button>
              <button type="button" className={styles.barBtn} onClick={() => setConfirmDel(false)}>
                Abbrechen
              </button>
            </>
          ) : (
            <button type="button" className={styles.barBtn} onClick={() => setConfirmDel(true)}>
              Löschen
            </button>
          )}
          <button type="button" className={cx(styles.barBtn, styles.close)} aria-label="Schließen" title="Schließen (Esc)" onClick={onClose}>
            ×
          </button>
        </div>

        <div className={styles.head}>
          <div className={styles.iconWrap} ref={pickerRef}>
            <button type="button" className={styles.icon} aria-label="Icon ändern" aria-expanded={picker} title="Icon ändern" onClick={() => setPicker((x) => !x)}>
              <NoteIcon ic={it.ic} letter={letter} size={30} />
            </button>
            {picker && (
              <div className={styles.picker} role="menu" aria-label="Icons">
                {Object.entries(NOTE_ICONS).map(([k, v]) => (
                  <button
                    key={k}
                    type="button"
                    role="menuitemradio"
                    aria-checked={it.ic === k}
                    aria-label={v.label}
                    title={v.label}
                    className={cx(styles.pick, it.ic === k && styles.picked)}
                    onClick={() => {
                      patch({ ic: k })
                      setPicker(false)
                    }}
                  >
                    <NoteIcon ic={k} letter="" size={20} />
                  </button>
                ))}
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={!it.ic}
                  aria-label="Anfangsbuchstabe"
                  title="Anfangsbuchstabe"
                  className={cx(styles.pick, styles.letter, !it.ic && styles.picked)}
                  onClick={() => {
                    patch({ ic: '' })
                    setPicker(false)
                  }}
                >
                  {letter}
                </button>
              </div>
            )}
          </div>
          <input
            className={styles.title}
            value={title}
            maxLength={60}
            aria-label="Titel"
            placeholder="Ohne Titel"
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                e.currentTarget.blur()
              }
            }}
          />
        </div>

        <dl className={styles.props}>
          <dt>Fach</dt>
          <dd>
            <select value={it.act ?? ''} aria-label="Fach" onChange={(e) => patch({ act: e.target.value })}>
              <option value="">—</option>
              {acts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </dd>
          <dt>Datum</dt>
          <dd>
            <input type="date" required value={it.d} aria-label="Datum" onChange={(e) => patch({ d: e.target.value })} />
            <span className={cx(styles.count, row.n >= 0 && row.tone === 'urgent' && styles.urgent, row.n >= 0 && row.tone === 'soon' && styles.soon)}>{countdown}</span>
          </dd>
          <dt>Uhrzeit</dt>
          <dd>
            <input type="time" value={it.t ?? ''} aria-label="Uhrzeit" onChange={(e) => patch({ t: e.target.value })} />
          </dd>
        </dl>

        <NotesEditor key={id} html={it.n ?? ''} color={color} onSave={(html) => dispatch((s, n) => setNotes(s, id, html, n))} />
      </div>
    </Modal>
  )
}
