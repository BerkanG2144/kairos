import { cx } from '../../components/cx.ts'
import { Nav } from '../../components/Nav.tsx'
import ui from '../../components/ui.module.css'
import { MONTHS } from '../../domain/constants.ts'
import { heatAlpha, learnedOn, monthGrid, WEEKDAYS_MON_FIRST } from '../../domain/summary.ts'
import { dayKey, fmt } from '../../domain/time.ts'
import type { ByDay } from '../../domain/types.ts'
import styles from './Tracker.module.css'

type Props = {
  byDay: ByDay
  view: { y: number; m: number }
  onView: (v: { y: number; m: number }) => void
}

/** Monat als Heatmap der Lernzeit; Zeit eines Tages beim Hovern. Heute ist markiert. */
export function MonthCalendar({ byDay, view, onView }: Props) {
  const { offset, days } = monthGrid(view.y, view.m)
  const todayK = dayKey(new Date())
  const shift = (n: number) => {
    const d = new Date(view.y, view.m + n, 1)
    onView({ y: d.getFullYear(), m: d.getMonth() })
  }

  return (
    <div>
      <div className={ui.head}>
        <span className={ui.label}>
          {MONTHS[view.m]} {view.y}
        </span>
        <Nav prev={() => shift(-1)} next={() => shift(1)} prevLabel="Voriger Monat" nextLabel="Nächster Monat" />
      </div>
      <div className={styles.grid}>
        {WEEKDAYS_MON_FIRST.map((w) => (
          <div key={w} className={styles.wd}>
            {w}
          </div>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <div key={`e${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const d = new Date(view.y, view.m, i + 1)
          const k = dayKey(d)
          const sec = learnedOn(byDay, d)
          const al = heatAlpha(sec)
          return (
            <div
              key={k}
              data-day={k}
              className={cx(styles.day, k === todayK && styles.today, al != null && (al > 0.55 ? styles.dark : styles.light))}
              style={al != null ? { background: `rgba(var(--mint-rgb), ${al.toFixed(2)})` } : undefined}
              title={al != null ? fmt(sec) : undefined}
              aria-label={`${i + 1}.${al != null ? ` – ${fmt(sec)}` : ''}`}
              aria-current={k === todayK ? 'date' : undefined}
            >
              {i + 1}
            </div>
          )
        })}
      </div>
    </div>
  )
}
