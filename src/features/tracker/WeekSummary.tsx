import { Nav } from '../../components/Nav.tsx'
import ui from '../../components/ui.module.css'
import { summarize, weekDays, weekLabel } from '../../domain/summary.ts'
import { fmt } from '../../domain/time.ts'
import type { Act, ByDay } from '../../domain/types.ts'
import { Legend } from './Legend.tsx'
import styles from './Tracker.module.css'

type Props = { byDay: ByDay; acts: Act[]; week: Date; onWeek: (delta: number | null) => void }

/** Kompakte Wochenübersicht unter dem Kalender. onWeek(null) = aktuelle Woche. */
export function WeekSummary({ byDay, acts, week, onWeek }: Props) {
  const summary = summarize(byDay, weekDays(week), acts)
  const { text, kw } = weekLabel(week)
  return (
    <div className={styles.week} aria-label="Woche">
      <div className={ui.head}>
        <span className={ui.label}>Woche</span>
        <Nav
          prev={() => onWeek(-7)}
          next={() => onWeek(7)}
          prevLabel="Vorige Woche"
          nextLabel="Nächste Woche"
          onLabel={() => onWeek(null)}
          labelTitle={`Zur aktuellen Woche (KW ${kw})`}
          labelClassName={styles.weekNavLabel}
        >
          {text}
        </Nav>
      </div>
      <div className={styles.totalSmall} data-testid="week-total">
        {fmt(summary.total)}
      </div>
      <div className={styles.bar}>
        {summary.items.map((it) => (
          <span key={it.id} style={{ flex: it.v, background: it.c }} />
        ))}
      </div>
      <Legend summary={summary} empty="Keine Lernzeit in dieser Woche." compact />
    </div>
  )
}
