import { Nav } from '../../components/Nav.tsx'
import ui from '../../components/ui.module.css'
import { dayLabel, summarize } from '../../domain/summary.ts'
import { addDays, dayKey, fmt } from '../../domain/time.ts'
import type { Act, ByDay } from '../../domain/types.ts'
import { Legend } from './Legend.tsx'
import { PieChart } from './PieChart.tsx'
import styles from './Tracker.module.css'

type Props = { byDay: ByDay; acts: Act[]; sel: Date; onSelect: (d: Date) => void; className?: string }

export function DayBalance({ byDay, acts, sel, onSelect, className }: Props) {
  const today = new Date()
  const summary = summarize(byDay, [sel], acts)
  const isToday = dayKey(sel) === dayKey(today)
  return (
    <section className={className} aria-label="Tagesbilanz">
      <div className={ui.head}>
        <span className={ui.label}>Tagesbilanz</span>
        <Nav
          prev={() => onSelect(addDays(sel, -1))}
          next={() => onSelect(addDays(sel, 1))}
          prevLabel="Voriger Tag"
          nextLabel="Nächster Tag"
          onLabel={() => onSelect(new Date())}
          labelTitle="Zu heute"
        >
          {dayLabel(sel, today)}
        </Nav>
      </div>
      <div className={styles.total} data-testid="day-total">
        {fmt(summary.total)}
      </div>
      <div className={styles.split}>
        <PieChart className={styles.pie} items={summary.items} total={summary.total} />
        <Legend summary={summary} empty={isToday ? 'Heute noch nichts gelernt.' : 'An diesem Tag nichts gelernt.'} />
      </div>
    </section>
  )
}
