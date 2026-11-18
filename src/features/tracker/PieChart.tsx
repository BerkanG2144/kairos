import { piePath, type Item } from '../../domain/summary.ts'

const C = 84
const R = 82

/** Kreisdiagramm der Tagesbilanz (168 × 168). */
export function PieChart({ items, total, className }: { items: Item[]; total: number; className?: string }) {
  let body
  if (!total) {
    body = <circle cx={C} cy={C} r={81} fill="none" stroke="var(--line)" strokeWidth={1.5} strokeDasharray="3 5" />
  } else if (items.length === 1) {
    body = <circle cx={C} cy={C} r={R} fill={items[0]!.c} />
  } else {
    let a0 = -Math.PI / 2
    body = items.map((it) => {
      const a1 = a0 + (it.v / total) * Math.PI * 2
      const d = piePath(C, C, R, a0, a1)
      a0 = a1
      return <path key={it.id} d={d} fill={it.c} stroke="var(--bg)" strokeWidth={2} strokeLinejoin="round" />
    })
  }
  return (
    <svg className={className} viewBox="0 0 168 168" aria-hidden="true">
      {body}
    </svg>
  )
}
