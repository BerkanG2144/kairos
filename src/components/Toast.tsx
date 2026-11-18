import type { ReactNode } from 'react'
import styles from './Toast.module.css'

type Props = {
  children: ReactNode
  primary: { label: string; onClick: () => void }
  secondary: { label: string; onClick: () => void }
}

/** Schwebende Leiste unten mittig mit zwei Aktionen. */
export function Toast({ children, primary, secondary }: Props) {
  return (
    <div className={styles.toast} role="alert">
      <span>{children}</span>
      <button type="button" className={styles.primary} onClick={primary.onClick}>
        {primary.label}
      </button>
      <button type="button" className={styles.secondary} onClick={secondary.onClick}>
        {secondary.label}
      </button>
    </div>
  )
}
