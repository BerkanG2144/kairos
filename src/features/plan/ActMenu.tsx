import { useEffect, useReducer, useRef } from 'react'
import { createPortal } from 'react-dom'
import ui from '../../components/ui.module.css'
import type { Act } from '../../domain/types.ts'
import styles from './ActMenu.module.css'

type Props = {
  anchor: HTMLElement
  acts: Act[]
  current?: string
  title: string
  /** null = „Kein Fach“ (nur wenn allowNone) */
  onPick: (id: string | null) => void
  onClose: () => void
  allowNone?: boolean
}

/**
 * Kleine Fach-Auswahl am Auslöser. Schließt bei Klick daneben und Escape.
 * Beim Scrollen wandert sie mit; verschwindet der Auslöser aus dem Bild, schließt sie.
 */
export function ActMenu({ anchor: anchorEl, acts, current, title, onPick, onClose, allowNone }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [, reposition] = useReducer((x: number) => x + 1, 0)
  const anchor = anchorEl.getBoundingClientRect()
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })
  useEffect(() => {
    ref.current?.querySelector('button')?.focus({ preventScroll: true })
  }, [])
  useEffect(() => {
    const onClose = () => closeRef.current()
    const down = (e: PointerEvent) => {
      // Klick auf den Auslöser selbst schaltet dort um (sonst würde das Menü sofort wieder aufgehen).
      if (!ref.current?.contains(e.target as Node) && !anchorEl.contains(e.target as Node)) onClose()
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const scroll = (e: Event) => {
      if (ref.current?.contains(e.target as Node)) return
      const r = anchorEl.getBoundingClientRect()
      if (!anchorEl.isConnected || r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) onClose()
      else reposition()
    }
    document.addEventListener('pointerdown', down, true)
    document.addEventListener('keydown', key)
    window.addEventListener('scroll', scroll, true)
    return () => {
      document.removeEventListener('pointerdown', down, true)
      document.removeEventListener('keydown', key)
      window.removeEventListener('scroll', scroll, true)
    }
  }, [anchorEl])

  // Unter dem Auslöser, bei Platzmangel darüber – nie über den Bildschirmrand hinaus (sonst scrollt die Seite).
  const spaceBelow = window.innerHeight - anchor.bottom - 14
  const spaceAbove = anchor.top - 14
  const below = spaceBelow >= 200 || spaceBelow >= spaceAbove
  const left = Math.max(8, Math.min(anchor.left, window.innerWidth - 228))
  const maxHeight = Math.min(320, below ? spaceBelow : spaceAbove)
  const pos = below ? { top: anchor.bottom + 6, left, maxHeight } : { bottom: window.innerHeight - anchor.top + 6, left, maxHeight }

  return createPortal(
    // Portal: React-Events würden sonst bis zur Karte durchblubbern (öffnet sonst den Editor).
    <div
      ref={ref}
      className={styles.menu}
      style={pos}
      role="menu"
      aria-label={title}
      data-nodrag
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className={styles.head}>{title}</div>
      {acts.map((a) => (
        <button key={a.id} type="button" role="menuitemradio" aria-checked={a.id === current} className={styles.item} onClick={() => onPick(a.id)}>
          <span className={ui.dot} style={{ background: a.c }} />
          {a.name}
        </button>
      ))}
      {!acts.length && <div className={styles.empty}>Noch keine Fächer – leg im Tracker eins an.</div>}
      {allowNone && current && (
        <button type="button" role="menuitemradio" aria-checked={false} className={styles.item} onClick={() => onPick(null)}>
          <span className={styles.none} />
          Kein Fach
        </button>
      )}
    </div>,
    document.body,
  )
}
