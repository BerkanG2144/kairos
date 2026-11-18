import { useEffect, type ReactNode } from 'react'
import styles from './Modal.module.css'

/** Modal; mobil als Bottom-Sheet. Schließt bei Klick auf den Hintergrund und Escape. */
export function Modal({ onClose, children, label }: { onClose: () => void; children: ReactNode; label: string }) {
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
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </div>
  )
}
