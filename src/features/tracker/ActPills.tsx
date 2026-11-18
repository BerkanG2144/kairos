import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { cx } from '../../components/cx.ts'
import ui from '../../components/ui.module.css'
import { ACT_NAME_MAX } from '../../domain/constants.ts'
import { activeActs, addAct, clickAct, delAct } from '../../domain/tracker.ts'
import { useAppState, useDispatch } from '../../state/StoreProvider.tsx'
import styles from './TimerPanel.module.css'

const LONG_PRESS_MS = 550

/** Fächer als Pills: Klick startet/stoppt/wechselt, × (Hover bzw. lange drücken) → Löschbestätigung. */
export function ActPills() {
  const state = useAppState()
  const dispatch = useDispatch()
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const [showX, setShowX] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const pressTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const suppressClick = useRef(false)
  const run = state.meta.run

  // Tippen/Klicken außerhalb einer Pill schließt × und Bestätigung.
  useEffect(() => {
    const onDown = (e: globalThis.PointerEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest('[data-pill]')) {
        setShowX(null)
        setConfirmDel(null)
      }
    }
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      clearTimeout(pressTimer.current)
    }
  }, [])

  const onPointerDown = (id: string) => (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return
    clearTimeout(pressTimer.current)
    pressTimer.current = setTimeout(() => {
      suppressClick.current = true
      setShowX(id)
    }, LONG_PRESS_MS)
  }
  const cancelPress = () => clearTimeout(pressTimer.current)

  const add = (name: string) => {
    if (name.trim()) dispatch((s, n) => addAct(s, name, n))
  }

  return (
    <>
      {activeActs(state).map((a) =>
        confirmDel === a.id ? (
          <span key={a.id} data-pill className={cx(ui.pill, styles.confirm)}>
            <span>löschen?</span>
            <button
              type="button"
              className={styles.yes}
              onClick={() => {
                setConfirmDel(null)
                dispatch((s, n) => delAct(s, a.id, n))
              }}
            >
              ja
            </button>
            <button type="button" className={styles.no} onClick={() => setConfirmDel(null)}>
              nein
            </button>
          </span>
        ) : (
          <span
            key={a.id}
            data-pill
            className={cx(ui.pill, styles.act, run?.a === a.id && styles.on, showX === a.id && styles.showX)}
            style={run?.a === a.id ? { background: a.c } : undefined}
            onPointerDown={onPointerDown(a.id)}
            onPointerUp={cancelPress}
            onPointerLeave={cancelPress}
            onPointerCancel={cancelPress}
            onContextMenu={(e) => {
              if (matchMedia('(hover: none)').matches) e.preventDefault()
            }}
          >
            <button
              type="button"
              className={styles.actMain}
              aria-pressed={run?.a === a.id}
              onClick={() => {
                if (suppressClick.current) {
                  suppressClick.current = false
                  return
                }
                dispatch((s, n) => clickAct(s, a.id, n))
              }}
            >
              <span className={ui.dot} style={{ background: a.c }} />
              <span>{a.name}</span>
            </button>
            <button type="button" className={styles.x} title="Entfernen" aria-label={`${a.name} entfernen`} onClick={() => setConfirmDel(a.id)}>
              ×
            </button>
          </span>
        ),
      )}
      {adding ? (
        <form
          className={styles.addForm}
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault()
            const input = e.currentTarget.elements.namedItem('name') as HTMLInputElement
            add(input.value)
            setAdding(false)
          }}
        >
          <input
            name="name"
            autoFocus
            maxLength={ACT_NAME_MAX}
            placeholder="z. B. Französisch"
            aria-label="Neues Fach"
            onKeyDown={(e) => {
              if (e.key === 'Escape') setAdding(false)
            }}
            onBlur={(e) => {
              add(e.currentTarget.value)
              setAdding(false)
            }}
          />
        </form>
      ) : (
        <button type="button" className={cx(ui.pill, styles.ghost)} title="Fach hinzufügen" aria-label="Fach hinzufügen" onClick={() => setAdding(true)}>
          +
        </button>
      )}
    </>
  )
}
