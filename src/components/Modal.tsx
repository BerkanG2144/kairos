import { useEffect, type ReactNode } from 'react'
import { cx } from './cx.ts'
import styles from './Modal.module.css'

/**
 * Modal; mobil als Bottom-Sheet. Schließt bei Klick auf den Hintergrund und Escape.
 * `wide`: großes Fenster ohne Innenabstand (Notizseite).
 */
export function Modal({ onClose, children, label, wide }: { onClose: () => void; children: ReactNode; label: string; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className={styles.modal}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={cx(styles.sheet, wide && styles.wide)} role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </div>
  )
}
