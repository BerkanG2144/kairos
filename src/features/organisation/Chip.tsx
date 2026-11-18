import { cx, vars } from '../../components/cx.ts'
import { itemColor } from '../../domain/plan.ts'
import type { Act, PlanItem } from '../../domain/types.ts'
import { Check } from '../../components/Check.tsx'
import styles from './Chip.module.css'
import type { OrgActions } from './types.ts'

/** Kompakter Eintrag (Zeile „fällig“ und Monatsansicht). */
/** compact: Monatsansicht – mobil ohne Uhrzeit. */
export function Chip({ it, acts, actions, withTime, compact }: { it: PlanItem; acts: Act[]; actions: OrgActions; withTime?: boolean; compact?: boolean }) {
  const c = itemColor(it, acts)
  const done = it.type === 'abgabe' && !!it.done
  const title = (it.type === 'klausur' ? 'Klausur · ' : '') + it.title
  return (
    <div
      role="button"
      tabIndex={0}
      className={cx(styles.chip, it.type === 'klausur' && styles.kl, done && styles.done, compact && styles.compact)}
      style={vars({ '--c': c })}
      onClick={(e) => {
        e.stopPropagation()
        actions.open(it)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') actions.open(it)
      }}
      data-item={it.id}
    >
      {it.type === 'abgabe' && <Check small on={done} color={c} label={`${it.title} erledigt`} onToggle={() => actions.toggleDone(it.id)} />}
      {withTime && it.t && <span className={styles.ti}>{it.t}</span>}
      <span className={styles.x}>{title}</span>
    </div>
  )
}
