import { pad } from '../domain/time.ts'
import styles from './Hours.module.css'

/** Dauer als „2h 05m“ mit großen Zahlen, dahinter eine Beschriftung (z. B. „heute“). */
export function Hours({ sec, label, small, testId }: { sec: number; label: string; small?: boolean; testId?: string }) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return (
    <div className={small ? styles.small : styles.big} data-testid={testId}>
      <b>{h}</b>h <b>{pad(m)}</b>m <span>{label}</span>
    </div>
  )
}
