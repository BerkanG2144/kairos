import { cx } from '../../components/cx.ts'
import { sortItems } from '../../domain/plan.ts'
import { WEEKDAYS_MON_FIRST } from '../../domain/summary.ts'
import { addDays, dayKey, mondayOf } from '../../domain/time.ts'
import type { Act, PlanItem } from '../../domain/types.ts'
import { Chip } from './Chip.tsx'
import styles from './MonthView.module.css'
import type { OrgActions } from './types.ts'

const MAX_CHIPS = 3

type Props = {
  y: number
  m: number
  plan: Record<string, PlanItem[]>
  acts: Act[]
  actions: OrgActions
  today: Date
  onPickDay: (d: Date) => void
}

export function MonthView({ y, m, plan, acts, actions, today, onPickDay }: Props) {
  const start = mondayOf(new Date(y, m, 1))
  const end = addDays(mondayOf(new Date(y, m + 1, 0)), 6)
  const tk = dayKey(today)
  const cells: Date[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) cells.push(d)

  return (
    <div>
      <div className={styles.head}>
        {WEEKDAYS_MON_FIRST.map((w) => (
          <div key={w} className={styles.dh}>
            {w}
          </div>
        ))}
      </div>
      <div className={styles.grid}>
        {cells.map((d) => {
          const k = dayKey(d)
          const its = sortItems(plan[k] ?? [])
          return (
            <div
              key={k}
              role="button"
              tabIndex={0}
              className={cx(styles.mc, d.getMonth() !== m && styles.out, k === tk && styles.today)}
              onClick={() => onPickDay(d)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target === e.currentTarget) onPickDay(d)
              }}
              data-day={k}
            >
              <div className={styles.num}>
                <b>{d.getDate()}</b>
                <button
                  type="button"
                  title="Eintrag hinzufügen"
                  aria-label={`Abgabe am ${d.getDate()}. hinzufügen`}
                  onClick={(e) => {
                    e.stopPropagation()
                    actions.create(k, 'abgabe')
                  }}
                >
                  +
                </button>
              </div>
              {its.slice(0, MAX_CHIPS).map((it) => (
                <Chip key={it.id} it={it} acts={acts} actions={actions} withTime compact />
              ))}
              {its.length > MAX_CHIPS && <div className={styles.more}>+{its.length - MAX_CHIPS} weitere</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
