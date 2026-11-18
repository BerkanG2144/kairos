import { cx } from '../../components/cx.ts'
import ui from '../../components/ui.module.css'
import { pct, type Summary } from '../../domain/summary.ts'
import { fmt } from '../../domain/time.ts'
import styles from './Legend.module.css'

/** Liste „Fach · Zeit · %“, Pause separat darunter. */
export function Legend({ summary, empty, compact }: { summary: Summary; empty: string; compact?: boolean }) {
  const { items, total, pause } = summary
  return (
    <div className={cx(styles.legend, compact && styles.compact)}>
      {!items.length && <div className={ui.empty}>{empty}</div>}
      {items.map((it) => (
        <div key={it.id} className={styles.row}>
          <span className={ui.dot} style={{ background: it.c }} />
          <span className={styles.n}>{it.name}</span>
          <span className={styles.v}>{fmt(it.v)}</span>
          <span className={styles.p}>{pct(it.v, total)}%</span>
        </div>
      ))}
      {pause > 0 && (
        <div className={cx(styles.row, styles.muted)}>
          <span className={ui.dot} style={{ background: 'var(--pause)' }} />
          <span className={styles.n}>Pause</span>
          <span className={styles.v}>{fmt(pause)}</span>
          <span className={styles.p} />
        </div>
      )}
    </div>
  )
}
